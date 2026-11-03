import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob } from "../queue";
import type { JobRow } from "../queue";

const payloadSchema = z.object({
  campaign_id: z.string().uuid(),
  batch_size: z.number().int().min(1).max(500).default(50),
});

export type Outcome = { ok: true } | { ok: false; error: string; retryable: boolean };

// Dequeues a batch of 'queued' recipients, enqueues a send_email job for each,
// then re-schedules itself if more remain. Keeps the drain progressive so a
// single campaign of 10,000 recipients doesn't block the tick.
export async function handleSendCampaignBatch(job: JobRow): Promise<Outcome> {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    return { ok: false, error: `invalid payload: ${parsed.error.message}`, retryable: false };
  }
  const { campaign_id, batch_size } = parsed.data;

  const service = createServiceClient();
  const { data: campaignRow } = await service
    .from("campaigns")
    .select("organization_id,template_id,status,totals")
    .eq("id", campaign_id)
    .maybeSingle();
  const campaign = campaignRow as
    | {
        organization_id: string;
        template_id: string | null;
        status: string;
        totals: Record<string, unknown>;
      }
    | null;
  if (!campaign) return { ok: false, error: "campaign missing", retryable: false };
  if (campaign.status === "paused" || campaign.status === "sent") return { ok: true };
  if (!campaign.template_id) {
    await service.from("campaigns").update({ status: "failed" }).eq("id", campaign_id);
    return { ok: false, error: "campaign has no template", retryable: false };
  }

  // Grab a batch of still-queued recipients.
  const { data: recipients } = await service
    .from("campaign_recipients")
    .select("id,email,variables")
    .eq("campaign_id", campaign_id)
    .eq("status", "queued")
    .limit(batch_size);
  const rows = (recipients ?? []) as { id: string; email: string; variables: Record<string, unknown> }[];

  if (rows.length === 0) {
    // Nothing left to queue — mark sent.
    await service
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaign_id);
    return { ok: true };
  }

  // Mark the current status 'sending' once.
  if (campaign.status !== "sending") {
    await service.from("campaigns").update({ status: "sending" }).eq("id", campaign_id);
  }

  for (const r of rows) {
    await enqueueJob({
      organizationId: campaign.organization_id,
      kind: "send_email",
      payload: {
        template_id: campaign.template_id,
        to: r.email,
        variables: r.variables,
        campaign_recipient_id: r.id,
        tag: `campaign:${campaign_id}`,
      },
      idempotencyKey: `campaign-send:${r.id}`,
    });
  }

  // Re-schedule myself for the next batch.
  await enqueueJob({
    organizationId: campaign.organization_id,
    kind: "send_campaign_batch",
    payload: { campaign_id, batch_size },
    runAt: new Date(Date.now() + 5_000),
  });

  return { ok: true };
}
