"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { registrantSubmitSchema } from "@/lib/webinars/schemas";

export type RegisterState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registrantSubmitSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Honeypot — silently redirect without recording.
  if (parsed.data.website) {
    redirect(`/r/${parsed.data.landing_slug}/thanks`);
  }

  const service = createServiceClient();

  const { data: landing, error: lpErr } = await service
    .from("landing_pages")
    .select("id, webinar_id, organization_id, is_published")
    .eq("public_slug", parsed.data.landing_slug)
    .maybeSingle();

  if (lpErr) return { error: `Could not load registration page: ${lpErr.message}` };
  if (!landing) return { error: "Registration page not found." };

  const page = landing as {
    id: string;
    webinar_id: string;
    organization_id: string;
    is_published: boolean;
  };
  if (!page.is_published) {
    return { error: "This registration page is not published." };
  }

  // Pick the earliest upcoming session, if any.
  const { data: sessionRow } = await service
    .from("webinar_sessions")
    .select("id")
    .eq("webinar_id", page.webinar_id)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const sessionId = (sessionRow as { id: string } | null)?.id ?? null;

  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent") || null;

  const { error: insErr } = await service.from("webinar_registrants").insert({
    organization_id: page.organization_id,
    webinar_id: page.webinar_id,
    session_id: sessionId,
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    consent_marketing: parsed.data.consent_marketing,
    source: "landing_page",
    utm_source: parsed.data.utm_source || null,
    utm_medium: parsed.data.utm_medium || null,
    utm_campaign: parsed.data.utm_campaign || null,
    utm_content: parsed.data.utm_content || null,
    utm_term: parsed.data.utm_term || null,
    ip_address: ip,
    user_agent: ua,
  });

  if (insErr) {
    // Treat duplicate as success — don't leak "already registered" to the public.
    const msg = insErr.message || "";
    if (!/duplicate|unique/i.test(msg)) {
      return { error: `Could not record registration: ${msg}` };
    }
  }

  await service.from("audit_logs").insert({
    organization_id: page.organization_id,
    actor_id: null,
    action: "registrant.created",
    entity_type: "webinar",
    entity_id: page.webinar_id,
    metadata: { email: parsed.data.email, utm_source: parsed.data.utm_source || null },
  });

  redirect(`/r/${parsed.data.landing_slug}/thanks`);
}
