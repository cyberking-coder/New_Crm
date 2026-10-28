"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const schema = z.object({
  webinar_id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  external_url: z.string().url(),
  duration_seconds: z.coerce.number().int().nonnegative().optional(),
});

export async function addExternalRecordingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  if (!["owner", "admin", "manager"].includes(org.role)) {
    return { error: "Only owners, admins, and managers can add recordings." };
  }

  const parsed = schema.safeParse({
    webinar_id: formData.get("webinar_id"),
    title: formData.get("title"),
    external_url: formData.get("external_url"),
    duration_seconds: formData.get("duration_seconds") || undefined,
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

  // Verify the webinar belongs to this org.
  const { data: webinarCheck } = await service
    .from("webinars")
    .select("id")
    .eq("id", parsed.data.webinar_id)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!webinarCheck) return { error: "Webinar not found." };

  const { error } = await service.from("recordings").insert({
    organization_id: org.organizationId,
    webinar_id: parsed.data.webinar_id,
    title: parsed.data.title,
    source: "external",
    external_url: parsed.data.external_url,
    duration_seconds: parsed.data.duration_seconds ?? null,
  });
  if (error) return { error: error.message };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "recording.added",
    entity_type: "webinar",
    entity_id: parsed.data.webinar_id,
    metadata: { url: parsed.data.external_url },
  });

  revalidatePath("/webinars/recordings");
  return undefined;
}

export async function deleteRecordingAction(recordingId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  if (!["owner", "admin", "manager"].includes(org.role)) {
    throw new Error("Not allowed.");
  }
  const service = createServiceClient();
  const { error } = await service
    .from("recordings")
    .delete()
    .eq("id", recordingId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "recording.deleted",
    entity_type: "recording",
    entity_id: recordingId,
    metadata: {},
  });
  revalidatePath("/webinars/recordings");
}
