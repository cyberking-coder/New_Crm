"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/jobs/queue";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: string }
  | undefined;

function assertManager(role: string) {
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only owners, admins, and managers can manage campaigns.");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(140),
  template_id: z.string().uuid(),
  audience_kind: z.enum([
    "all_registrants",
    "all_attendees",
    "webinar_registrants",
    "webinar_attendees",
    "lead_tier",
  ]),
  webinar_id: z.string().uuid().optional().or(z.literal("")),
  tier: z.enum(["cold", "warm", "hot"]).optional().or(z.literal("")),
});

export async function createCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    template_id: formData.get("template_id"),
    audience_kind: formData.get("audience_kind"),
    webinar_id: formData.get("webinar_id") ?? "",
    tier: formData.get("tier") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const audience_config: Record<string, unknown> = {};
  if (parsed.data.webinar_id) audience_config.webinar_id = parsed.data.webinar_id;
  if (parsed.data.tier) audience_config.tier = parsed.data.tier;

  const service = createServiceClient();
  const { data: inserted, error } = await service
    .from("campaigns")
    .insert({
      organization_id: org.organizationId,
      name: parsed.data.name,
      template_id: parsed.data.template_id,
      audience_kind: parsed.data.audience_kind,
      audience_config,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/marketing/campaigns");
  redirect(`/marketing/campaigns/${(inserted as { id: string }).id}`);
}

// Resolves the audience into campaign_recipients, then queues the first batch.
export async function sendCampaignAction(campaignId: string): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { data: campRow } = await service
    .from("campaigns")
    .select("id,organization_id,template_id,audience_kind,audience_config,status")
    .eq("id", campaignId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const campaign = campRow as
    | {
        id: string;
        organization_id: string;
        template_id: string | null;
        audience_kind: string;
        audience_config: Record<string, unknown>;
        status: string;
      }
    | null;
  if (!campaign) return { error: "Campaign not found." };
  if (!campaign.template_id) return { error: "Attach a template first." };
  if (campaign.status === "sending" || campaign.status === "sent") {
    return { error: "Campaign is already being sent." };
  }

  const audience = await resolveAudience(service, org.organizationId, campaign.audience_kind, campaign.audience_config);
  if (audience.length === 0) return { error: "No recipients matched the audience." };

  // Insert recipients (dedup by email per campaign).
  const toInsert = audience.map((r) => ({
    organization_id: org.organizationId,
    campaign_id: campaign.id,
    email: r.email.toLowerCase(),
    variables: r.variables,
  }));
  // Chunk large inserts to stay well under Supabase limits.
  const chunk = 500;
  for (let i = 0; i < toInsert.length; i += chunk) {
    const { error } = await service
      .from("campaign_recipients")
      .upsert(toInsert.slice(i, i + chunk), {
        onConflict: "campaign_id,email",
        ignoreDuplicates: true,
      });
    if (error) return { error: `Failed to queue recipients: ${error.message}` };
  }

  await service
    .from("campaigns")
    .update({ status: "scheduled", totals: { queued: toInsert.length } })
    .eq("id", campaign.id);

  await enqueueJob({
    organizationId: org.organizationId,
    kind: "send_campaign_batch",
    payload: { campaign_id: campaign.id, batch_size: 50 },
  });

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "campaign.scheduled",
    entity_type: "campaign",
    entity_id: campaign.id,
    metadata: { recipients: toInsert.length },
  });

  revalidatePath(`/marketing/campaigns/${campaign.id}`);
  revalidatePath("/marketing/campaigns");
  return { ok: `Queued ${toInsert.length} recipient${toInsert.length === 1 ? "" : "s"}.` };
}

export async function pauseCampaignAction(campaignId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);
  const service = createServiceClient();
  await service
    .from("campaigns")
    .update({ status: "paused" })
    .eq("id", campaignId)
    .eq("organization_id", org.organizationId);
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

type Recipient = { email: string; variables: Record<string, unknown> };

async function resolveAudience(
  service: ReturnType<typeof createServiceClient>,
  orgId: string,
  kind: string,
  config: Record<string, unknown>,
): Promise<Recipient[]> {
  const webinarId = typeof config.webinar_id === "string" ? config.webinar_id : null;
  const tier = typeof config.tier === "string" ? config.tier : null;

  if (kind === "all_registrants" || kind === "webinar_registrants") {
    let q = service
      .from("webinar_registrants")
      .select("email,full_name,company,webinar_id")
      .eq("organization_id", orgId);
    if (kind === "webinar_registrants" && webinarId) q = q.eq("webinar_id", webinarId);
    const { data } = await q;
    return (data ?? []).map((r) => {
      const row = r as { email: string; full_name: string | null; company: string | null };
      return {
        email: row.email,
        variables: { name: row.full_name ?? "", email: row.email, company: row.company ?? "" },
      };
    });
  }

  if (kind === "all_attendees" || kind === "webinar_attendees") {
    let q = service
      .from("webinar_registrants")
      .select("email,full_name,company,webinar_id")
      .eq("organization_id", orgId)
      .eq("status", "attended");
    if (kind === "webinar_attendees" && webinarId) q = q.eq("webinar_id", webinarId);
    const { data } = await q;
    return (data ?? []).map((r) => {
      const row = r as { email: string; full_name: string | null; company: string | null };
      return {
        email: row.email,
        variables: { name: row.full_name ?? "", email: row.email, company: row.company ?? "" },
      };
    });
  }

  if (kind === "lead_tier") {
    let q = service
      .from("leads")
      .select("email,full_name,company_name")
      .eq("organization_id", orgId);
    if (tier) q = q.eq("tier", tier);
    const { data } = await q;
    return (data ?? []).map((r) => {
      const row = r as { email: string; full_name: string | null; company_name: string | null };
      return {
        email: row.email,
        variables: { name: row.full_name ?? "", email: row.email, company: row.company_name ?? "" },
      };
    });
  }

  return [];
}
