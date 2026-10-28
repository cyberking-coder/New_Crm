"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { SUPPORTED_WEBINAR_PROVIDERS } from "@/lib/integrations/webinar/registry";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const schema = z.object({
  provider: z.enum(SUPPORTED_WEBINAR_PROVIDERS as unknown as [string, ...string[]]),
  display_name: z.string().trim().min(2).max(80),
});

export async function createWebinarConnectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  if (!["owner", "admin"].includes(org.role)) {
    return { error: "Only owners and admins can add integrations." };
  }

  const parsed = schema.safeParse({
    provider: formData.get("provider"),
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const webhookSecret = crypto.randomBytes(32).toString("hex");

  const service = createServiceClient();
  const { error } = await service.from("integration_connections").insert({
    organization_id: org.organizationId,
    category: "webinar",
    provider: parsed.data.provider,
    display_name: parsed.data.display_name,
    webhook_secret: webhookSecret,
    created_by: user.id,
    is_active: true,
  });
  if (error) {
    return { error: `Could not create connection: ${error.message}` };
  }

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "integration.created",
    entity_type: "integration_connection",
    metadata: { category: "webinar", provider: parsed.data.provider },
  });

  revalidatePath("/integrations/webinar");
  return undefined;
}

export async function toggleWebinarConnectionAction(connectionId: string, isActive: boolean) {
  await requireUser();
  const org = await requireActiveOrganization();
  if (!["owner", "admin"].includes(org.role)) {
    throw new Error("Only owners and admins can change integrations.");
  }

  const service = createServiceClient();
  const { error } = await service
    .from("integration_connections")
    .update({ is_active: isActive })
    .eq("id", connectionId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/webinar");
}

export async function deleteWebinarConnectionAction(connectionId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  if (!["owner", "admin"].includes(org.role)) {
    throw new Error("Only owners and admins can delete integrations.");
  }
  const service = createServiceClient();
  const { error } = await service
    .from("integration_connections")
    .delete()
    .eq("id", connectionId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/webinar");
}
