"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens only"),
});

export async function updateOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  if (!["owner", "admin"].includes(org.role)) {
    return { error: "Only owners and admins can edit organization settings." };
  }

  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
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

  // Guard slug uniqueness.
  if (parsed.data.slug !== org.organizationSlug) {
    const { data: taken } = await service
      .from("organizations")
      .select("id")
      .eq("slug", parsed.data.slug)
      .maybeSingle();
    if (taken) {
      return { fieldErrors: { slug: "This slug is already in use." } };
    }
  }

  const { error } = await service
    .from("organizations")
    .update({ name: parsed.data.name, slug: parsed.data.slug })
    .eq("id", org.organizationId);
  if (error) return { error: error.message };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "organization.updated",
    entity_type: "organization",
    entity_id: org.organizationId,
    metadata: { name: parsed.data.name, slug: parsed.data.slug },
  });

  revalidatePath("/settings/organization");
  return { ok: true };
}

export async function deleteOrganizationAction(confirmSlug: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  if (org.role !== "owner") {
    throw new Error("Only the organization owner can delete the organization.");
  }
  if (confirmSlug !== org.organizationSlug) {
    throw new Error("Confirmation does not match the organization slug.");
  }

  const service = createServiceClient();
  const { error } = await service
    .from("organizations")
    .delete()
    .eq("id", org.organizationId);
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: null,
    actor_id: user.id,
    action: "organization.deleted",
    entity_type: "organization",
    entity_id: org.organizationId,
    metadata: { slug: org.organizationSlug },
  });

  redirect("/onboarding");
}
