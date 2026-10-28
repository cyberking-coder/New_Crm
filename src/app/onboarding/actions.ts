"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const createOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name is too long."),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export type OnboardingFormState = { error?: string } | undefined;

export async function createFirstOrganizationAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = createOrgSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Build a unique slug. Service client is used so the uniqueness check and insert
  // bypass RLS on reads of other orgs' slugs.
  const service = createServiceClient();
  const base = slugify(parsed.data.name) || "org";
  let slug = base;
  for (let i = 1; i < 25; i++) {
    const { data: existing, error } = await service
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { error: `Slug check failed: ${error.message}` };
    if (!existing) break;
    slug = `${base}-${i + 1}`;
  }

  // Insert through the user's RLS-scoped client so created_by = auth.uid() check passes.
  const { data: orgData, error: insertErr } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, slug, created_by: user.id })
    .select("id")
    .single();
  const org = orgData as { id: string } | null;
  if (insertErr || !org) {
    return { error: `Could not create organization: ${insertErr?.message ?? "unknown error"}` };
  }

  const orgId = org.id;

  const { error: memberErr } = await supabase.from("organization_members").insert({
    organization_id: orgId,
    user_id: user.id,
    role: "owner",
  });
  if (memberErr) {
    return { error: `Could not add owner membership: ${memberErr.message}` };
  }

  // Audit the creation via service client (RLS blocks client-side inserts).
  await service.from("audit_logs").insert({
    organization_id: orgId,
    actor_id: user.id,
    action: "organization.created",
    entity_type: "organization",
    entity_id: orgId,
    metadata: { name: parsed.data.name, slug },
  });

  redirect("/dashboard");
}
