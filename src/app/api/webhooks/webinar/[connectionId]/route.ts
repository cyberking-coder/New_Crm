import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getWebinarAdapter } from "@/lib/integrations/webinar/registry";
import type { NormalizedWebhookEvent } from "@/lib/integrations/webinar/types";

type Connection = {
  id: string;
  organization_id: string;
  provider: string;
  webhook_secret: string | null;
  is_active: boolean;
};

type SessionRow = { id: string };
type RegistrantRow = { id: string };

async function resolveSessionId(
  service: ReturnType<typeof createServiceClient>,
  orgId: string,
  providerSessionId: string | undefined,
): Promise<{ sessionId: string | null; webinarId: string | null }> {
  if (!providerSessionId) return { sessionId: null, webinarId: null };
  const { data } = await service
    .from("webinar_sessions")
    .select("id,webinar_id")
    .eq("organization_id", orgId)
    .eq("provider_session_id", providerSessionId)
    .maybeSingle();
  const row = data as { id: string; webinar_id: string } | null;
  return { sessionId: row?.id ?? null, webinarId: row?.webinar_id ?? null };
}

async function resolveRegistrant(
  service: ReturnType<typeof createServiceClient>,
  orgId: string,
  webinarId: string | null,
  email: string,
): Promise<string | null> {
  if (!webinarId) return null;
  const { data } = await service
    .from("webinar_registrants")
    .select("id")
    .eq("organization_id", orgId)
    .eq("webinar_id", webinarId)
    .ilike("email", email)
    .maybeSingle();
  return (data as RegistrantRow | null)?.id ?? null;
}

async function processEvent(
  service: ReturnType<typeof createServiceClient>,
  conn: Connection,
  evt: NormalizedWebhookEvent,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (evt.type === "participant") {
    const { sessionId, webinarId } = await resolveSessionId(
      service,
      conn.organization_id,
      evt.event.provider_session_id,
    );
    if (!webinarId) return { ok: false, error: "no matching webinar session" };

    const registrantId = await resolveRegistrant(
      service,
      conn.organization_id,
      webinarId,
      evt.event.email,
    );

    if (evt.event.kind === "join") {
      const { error } = await service.from("attendance_sessions").insert({
        organization_id: conn.organization_id,
        webinar_id: webinarId,
        session_id: sessionId,
        registrant_id: registrantId,
        email: evt.event.email,
        joined_at: evt.event.occurred_at,
        provider_participant_id: evt.event.provider_participant_id,
        device: evt.event.device,
      });
      if (error) return { ok: false, error: error.message };
    } else {
      // Close the latest open span for this email on this session.
      const { data: open } = await service
        .from("attendance_sessions")
        .select("id,joined_at")
        .eq("organization_id", conn.organization_id)
        .eq("webinar_id", webinarId)
        .ilike("email", evt.event.email)
        .is("left_at", null)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = open as { id: string; joined_at: string } | null;
      if (row) {
        const dur = Math.max(
          0,
          Math.round(
            (new Date(evt.event.occurred_at).getTime() - new Date(row.joined_at).getTime()) / 1000,
          ),
        );
        await service
          .from("attendance_sessions")
          .update({ left_at: evt.event.occurred_at, duration_seconds: dur })
          .eq("id", row.id);
      }
    }

    await service.from("engagement_events").insert({
      organization_id: conn.organization_id,
      webinar_id: webinarId,
      session_id: sessionId,
      registrant_id: registrantId,
      kind: evt.event.kind,
      payload: {
        email: evt.event.email,
        device: evt.event.device,
        provider_participant_id: evt.event.provider_participant_id,
      },
      occurred_at: evt.event.occurred_at,
    });

    // Promote registrant status to attended on first join.
    if (registrantId && evt.event.kind === "join") {
      await service
        .from("webinar_registrants")
        .update({ status: "attended" })
        .eq("id", registrantId)
        .eq("status", "registered");
    }
    return { ok: true };
  }

  if (evt.type === "recording") {
    const { sessionId, webinarId } = await resolveSessionId(
      service,
      conn.organization_id,
      evt.event.provider_session_id,
    );
    if (!webinarId) return { ok: false, error: "no matching webinar session for recording" };
    const { error } = await service.from("recordings").insert({
      organization_id: conn.organization_id,
      webinar_id: webinarId,
      session_id: sessionId,
      title: evt.event.title,
      source: "provider",
      external_url: evt.event.external_url,
      duration_seconds: evt.event.duration_seconds,
      size_bytes: evt.event.size_bytes,
      thumbnail_url: evt.event.thumbnail_url,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (evt.type === "session_lifecycle") {
    const { data } = await service
      .from("webinar_sessions")
      .select("id")
      .eq("organization_id", conn.organization_id)
      .eq("provider_session_id", evt.provider_session_id)
      .maybeSingle();
    const row = data as SessionRow | null;
    if (row) {
      await service
        .from("webinar_sessions")
        .update({ status: evt.status })
        .eq("id", row.id);
    }
    return { ok: true };
  }

  return { ok: true }; // unknown: skip quietly
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const rawBody = await request.text();
  const headers = request.headers;

  const service = createServiceClient();

  const { data: connData, error: connErr } = await service
    .from("integration_connections")
    .select("id,organization_id,provider,webhook_secret,is_active")
    .eq("id", connectionId)
    .eq("category", "webinar")
    .maybeSingle();

  if (connErr) return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  const conn = connData as Connection | null;
  if (!conn) return NextResponse.json({ error: "unknown connection" }, { status: 404 });
  if (!conn.is_active) return NextResponse.json({ error: "connection disabled" }, { status: 403 });

  const adapter = getWebinarAdapter(conn.provider);
  if (!adapter) return NextResponse.json({ error: "unsupported provider" }, { status: 400 });

  // Verify signature.
  const verified = adapter.verifySignature({
    secret: conn.webhook_secret ?? "",
    rawBody,
    headers,
  });
  if (!verified) {
    await service.from("webhook_events").insert({
      organization_id: conn.organization_id,
      connection_id: conn.id,
      direction: "inbound",
      provider: conn.provider,
      event_type: "signature_rejected",
      payload: { reason: "bad signature" },
      status: "failed",
      error: "signature verification failed",
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const parsed = adapter.parseWebhook({ rawBody, headers });
  if (!parsed.valid) {
    await service.from("webhook_events").insert({
      organization_id: conn.organization_id,
      connection_id: conn.id,
      direction: "inbound",
      provider: conn.provider,
      event_type: "parse_error",
      payload: safeJson(rawBody),
      status: "failed",
      error: parsed.reason ?? "parse failed",
    });
    return NextResponse.json({ error: parsed.reason ?? "parse failed" }, { status: 400 });
  }

  const results: { status: string; error?: string }[] = [];

  for (const evt of parsed.events) {
    const eventType = evt.type;
    const extId = evt.external_event_id ?? null;

    // Idempotency: skip if we have already processed this external_event_id for this connection.
    if (extId) {
      const { data: dup } = await service
        .from("webhook_events")
        .select("id,status")
        .eq("connection_id", conn.id)
        .eq("external_event_id", extId)
        .maybeSingle();
      const dupRow = dup as { id: string; status: string } | null;
      if (dupRow && dupRow.status === "processed") {
        results.push({ status: "skipped_duplicate" });
        continue;
      }
    }

    const ledger = await service
      .from("webhook_events")
      .insert({
        organization_id: conn.organization_id,
        connection_id: conn.id,
        direction: "inbound",
        provider: conn.provider,
        event_type: eventType,
        external_event_id: extId,
        payload: evt as unknown as Record<string, unknown>,
        status: "received",
      })
      .select("id")
      .single();

    const ledgerId = (ledger.data as { id: string } | null)?.id ?? null;

    const outcome = await processEvent(service, conn, evt);
    if (outcome.ok) {
      if (ledgerId) {
        await service
          .from("webhook_events")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", ledgerId);
      }
      results.push({ status: "processed" });
    } else {
      if (ledgerId) {
        await service
          .from("webhook_events")
          .update({ status: "failed", error: outcome.error })
          .eq("id", ledgerId);
      }
      results.push({ status: "failed", error: outcome.error });
    }
  }

  return NextResponse.json({ received: parsed.events.length, results });
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : { raw: s };
  } catch {
    return { raw: s };
  }
}

// Allow some providers to send a GET for endpoint verification.
export async function GET() {
  return NextResponse.json({ ok: true });
}
