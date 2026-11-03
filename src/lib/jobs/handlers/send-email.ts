import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/email/templates";
import { sendEmailViaConnection, NoEmailProviderError } from "@/lib/email/send";
import type { JobRow } from "../queue";

const payloadSchema = z.object({
  template_id: z.string().uuid(),
  to: z.string().email(),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  // Where to record the outcome.
  campaign_recipient_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  tag: z.string().max(80).optional(),
});

export type SendEmailOutcome =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

export async function handleSendEmail(job: JobRow): Promise<SendEmailOutcome> {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    return { ok: false, error: `invalid payload: ${parsed.error.message}`, retryable: false };
  }
  const { template_id, to, variables = {}, campaign_recipient_id, lead_id, tag } = parsed.data;
  if (!job.organization_id) {
    return { ok: false, error: "job missing organization_id", retryable: false };
  }
  const orgId = job.organization_id;

  const service = createServiceClient();
  const { data: tpl, error: tplErr } = await service
    .from("email_templates")
    .select("subject,html,text,from_name,from_email,reply_to")
    .eq("id", template_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (tplErr || !tpl) {
    return { ok: false, error: `template not found: ${tplErr?.message ?? "missing"}`, retryable: false };
  }
  const t = tpl as {
    subject: string;
    html: string;
    text: string | null;
    from_name: string | null;
    from_email: string | null;
    reply_to: string | null;
  };

  const subject = renderTemplate(t.subject, variables, { html: false });
  const html = renderTemplate(t.html, variables, { html: true });
  const text = t.text ? renderTemplate(t.text, variables, { html: false }) : undefined;
  const from = t.from_email
    ? t.from_name
      ? `${t.from_name} <${t.from_email}>`
      : t.from_email
    : "";

  let send;
  try {
    send = await sendEmailViaConnection(orgId, {
      to,
      from,
      subject,
      html,
      text,
      replyTo: t.reply_to ?? undefined,
      tags: tag ? { kind: tag } : undefined,
    });
  } catch (err) {
    if (err instanceof NoEmailProviderError) {
      return { ok: false, error: err.message, retryable: false };
    }
    throw err;
  }

  // Record outcome.
  if (campaign_recipient_id) {
    await service
      .from("campaign_recipients")
      .update(
        send.ok
          ? {
              status: "sent",
              sent_at: new Date().toISOString(),
              provider_message_id: send.providerMessageId,
            }
          : { status: "failed", error: send.error },
      )
      .eq("id", campaign_recipient_id);
  }

  if (lead_id && send.ok) {
    await service.from("lead_activities").insert({
      organization_id: orgId,
      lead_id,
      kind: "email_sent",
      body: subject,
      metadata: { provider_message_id: send.providerMessageId, template_id, tag },
    });
  }

  return send.ok
    ? { ok: true, providerMessageId: send.providerMessageId }
    : { ok: false, error: send.error, retryable: send.retryable };
}
