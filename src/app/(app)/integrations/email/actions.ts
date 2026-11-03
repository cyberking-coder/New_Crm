"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { SUPPORTED_EMAIL_PROVIDERS } from "@/lib/integrations/email/registry";
import { enqueueJob } from "@/lib/jobs/queue";
import { renderTemplate } from "@/lib/email/templates";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: string }
  | undefined;

function assertAdmin(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Only owners and admins can manage integrations.");
  }
}

const connectSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  provider: z.enum(SUPPORTED_EMAIL_PROVIDERS as unknown as [string, ...string[]]),
  api_key: z.string().trim().min(10).max(400),
  from_name: z.string().trim().max(80),
  from_email: z.string().trim().toLowerCase().email().max(254),
});

export async function createEmailConnectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const parsed = connectSchema.safeParse({
    display_name: formData.get("display_name"),
    provider: formData.get("provider"),
    api_key: formData.get("api_key"),
    from_name: formData.get("from_name"),
    from_email: formData.get("from_email"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const service = createServiceClient();
  const { error } = await service.from("integration_connections").insert({
    organization_id: org.organizationId,
    category: "email",
    provider: parsed.data.provider,
    display_name: parsed.data.display_name,
    config: { from_name: parsed.data.from_name, from_email: parsed.data.from_email },
    secrets: { api_key: parsed.data.api_key },
    created_by: user.id,
    is_active: true,
  });
  if (error) return { error: error.message };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "integration.email.created",
    entity_type: "integration_connection",
    metadata: { provider: parsed.data.provider },
  });

  revalidatePath("/integrations/email");
  return { ok: "Connected." };
}

export async function toggleEmailConnectionAction(connectionId: string, isActive: boolean) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("integration_connections")
    .update({ is_active: isActive })
    .eq("id", connectionId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/email");
}

export async function deleteEmailConnectionAction(connectionId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("integration_connections")
    .delete()
    .eq("id", connectionId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/email");
}

// Fire a test email synchronously — the queue is nice but the user wants
// immediate feedback on whether the credentials and sender actually work.
const testSchema = z.object({
  to: z.string().trim().toLowerCase().email(),
});

export async function sendTestEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const parsed = testSchema.safeParse({ to: formData.get("to") });
  if (!parsed.success) return { fieldErrors: { to: "Enter a valid email." } };

  // Insert a one-off throwaway template, then enqueue a send.
  const service = createServiceClient();
  const { data: tplRow, error: tplErr } = await service
    .from("email_templates")
    .insert({
      organization_id: org.organizationId,
      name: "Connection test",
      slug: `__test__-${Date.now()}`,
      subject: "WebinarOS connection test",
      html: `<p>Hi {{name}},</p><p>This is a test email sent from your WebinarOS workspace <strong>${renderTemplate(
        "{{org}}",
        { org: org.organizationName },
        { html: true },
      )}</strong>.</p>`,
      text: "This is a test email sent from your WebinarOS workspace.",
    })
    .select("id")
    .single();
  if (tplErr || !tplRow) return { error: tplErr?.message ?? "could not create test template" };
  const templateId = (tplRow as { id: string }).id;

  await enqueueJob({
    organizationId: org.organizationId,
    kind: "send_email",
    payload: {
      template_id: templateId,
      to: parsed.data.to,
      variables: { name: "there" },
      tag: "test",
    },
  });

  return { ok: "Queued — the next cron tick (within 60s) will send it." };
}
