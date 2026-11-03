"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: string }
  | undefined;

function assertManager(role: string) {
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only owners, admins, and managers can edit workflows.");
  }
}

const stepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send_email"), template_id: z.string().uuid(), subject_tag: z.string().max(80).optional() }),
  z.object({ type: z.literal("wait"), minutes: z.coerce.number().int().min(1).max(43200) }),
  z.object({
    type: z.literal("create_task"),
    title: z.string().min(2).max(200),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    due_in_minutes: z.coerce.number().int().min(0).max(43200).optional(),
  }),
  z.object({ type: z.literal("update_lead"), stage_key: z.string().min(2).max(40) }),
]);

const workflowSchema = z.object({
  name: z.string().trim().min(2).max(140),
  trigger: z.enum(["registrant_created", "attendance_recorded", "lead_scored", "manual"]),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
  trigger_config: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(stepSchema).min(1).max(20),
});

export async function saveWorkflowAction(
  workflowId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  let steps: unknown;
  try {
    steps = JSON.parse(String(formData.get("steps_json") ?? "[]"));
  } catch {
    return { error: "Steps JSON is invalid." };
  }

  let triggerConfig: unknown;
  try {
    const raw = String(formData.get("trigger_config_json") ?? "{}");
    triggerConfig = JSON.parse(raw);
  } catch {
    return { error: "Trigger config JSON is invalid." };
  }

  const parsed = workflowSchema.safeParse({
    name: formData.get("name"),
    trigger: formData.get("trigger"),
    status: formData.get("status") ?? "draft",
    trigger_config: triggerConfig,
    steps,
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

  if (workflowId) {
    const { error } = await service
      .from("automation_workflows")
      .update({
        name: parsed.data.name,
        trigger: parsed.data.trigger,
        status: parsed.data.status,
        trigger_config: parsed.data.trigger_config,
        steps: parsed.data.steps,
      })
      .eq("id", workflowId)
      .eq("organization_id", org.organizationId);
    if (error) return { error: error.message };
    revalidatePath("/marketing/workflows");
    revalidatePath(`/marketing/workflows/${workflowId}`);
    return { ok: "Saved." };
  }

  const { data: inserted, error } = await service
    .from("automation_workflows")
    .insert({
      organization_id: org.organizationId,
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      status: parsed.data.status,
      trigger_config: parsed.data.trigger_config,
      steps: parsed.data.steps,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/marketing/workflows");
  redirect(`/marketing/workflows/${(inserted as { id: string }).id}`);
}

export async function deleteWorkflowAction(workflowId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);
  const service = createServiceClient();
  const { error } = await service
    .from("automation_workflows")
    .delete()
    .eq("id", workflowId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/marketing/workflows");
  redirect("/marketing/workflows");
}
