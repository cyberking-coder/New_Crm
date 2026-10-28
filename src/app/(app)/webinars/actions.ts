"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import {
  webinarCreateSchema,
  webinarUpdateSchema,
  landingPageUpdateSchema,
} from "@/lib/webinars/schemas";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function pickFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "");
    if (k && !out[k]) out[k] = i.message;
  }
  return out;
}

export async function createWebinarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();

  const parsed = webinarCreateSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    type: formData.get("type"),
    timezone: formData.get("timezone"),
    host_name: formData.get("host_name") ?? "",
    session_scheduled_at: formData.get("session_scheduled_at") ?? "",
    session_duration_minutes: formData.get("session_duration_minutes") ?? undefined,
  });

  if (!parsed.success) {
    return {
      error: "Fix the highlighted fields.",
      fieldErrors: pickFieldErrors(parsed.error.issues),
    };
  }

  const service = createServiceClient();

  // Uniqueness check within the org.
  const { data: existing, error: slugErr } = await service
    .from("webinars")
    .select("id")
    .eq("organization_id", org.organizationId)
    .eq("slug", parsed.data.slug)
    .maybeSingle();
  if (slugErr) return { error: `Slug check failed: ${slugErr.message}` };
  if (existing) return { fieldErrors: { slug: "This slug is already used in your organization." } };

  // Membership was verified by requireActiveOrganization; use the service client
  // for the write so SSR cookie-session edge cases don't block the insert.
  const { data: webinarData, error: insErr } = await service
    .from("webinars")
    .insert({
      organization_id: org.organizationId,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      type: parsed.data.type,
      timezone: parsed.data.timezone,
      host_name: parsed.data.host_name || null,
      created_by: user.id,
      status: parsed.data.session_scheduled_at ? "scheduled" : "draft",
    })
    .select("id")
    .single();

  const webinar = webinarData as { id: string } | null;
  if (insErr || !webinar) {
    return { error: `Could not create webinar: ${insErr?.message ?? "unknown error"}` };
  }

  if (parsed.data.session_scheduled_at) {
    const { error: sessErr } = await service.from("webinar_sessions").insert({
      webinar_id: webinar.id,
      organization_id: org.organizationId,
      scheduled_at: new Date(parsed.data.session_scheduled_at).toISOString(),
      duration_minutes: parsed.data.session_duration_minutes ?? 60,
    });
    if (sessErr) return { error: `Webinar saved but session failed: ${sessErr.message}` };
  }

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "webinar.created",
    entity_type: "webinar",
    entity_id: webinar.id,
    metadata: { title: parsed.data.title, slug: parsed.data.slug },
  });

  revalidatePath("/webinars");
  redirect(`/webinars/${webinar.id}`);
}

export async function updateWebinarAction(
  webinarId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();

  const parsed = webinarUpdateSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    type: formData.get("type"),
    timezone: formData.get("timezone"),
    host_name: formData.get("host_name") ?? "",
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      error: "Fix the highlighted fields.",
      fieldErrors: pickFieldErrors(parsed.error.issues),
    };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("webinars")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      type: parsed.data.type,
      timezone: parsed.data.timezone,
      host_name: parsed.data.host_name || null,
      status: parsed.data.status,
    })
    .eq("id", webinarId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: `Could not update webinar: ${error.message}` };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "webinar.updated",
    entity_type: "webinar",
    entity_id: webinarId,
    metadata: { slug: parsed.data.slug, status: parsed.data.status },
  });

  revalidatePath(`/webinars/${webinarId}`);
  revalidatePath("/webinars");
  return undefined;
}

export async function deleteWebinarAction(webinarId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  // Only owners/admins may delete — enforce in app code since we're bypassing RLS.
  if (!["owner", "admin"].includes(org.role)) {
    throw new Error("Only owners and admins can delete webinars.");
  }

  const service = createServiceClient();
  const { error } = await service
    .from("webinars")
    .delete()
    .eq("id", webinarId)
    .eq("organization_id", org.organizationId);

  if (error) throw new Error(`Could not delete webinar: ${error.message}`);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "webinar.deleted",
    entity_type: "webinar",
    entity_id: webinarId,
    metadata: {},
  });

  revalidatePath("/webinars");
  redirect("/webinars");
}

export async function addSessionAction(
  webinarId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const org = await requireActiveOrganization();

  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  const durationRaw = formData.get("duration_minutes");
  const duration = Number(durationRaw ?? 60);

  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
    return { fieldErrors: { scheduled_at: "Enter a valid date and time." } };
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) {
    return { fieldErrors: { duration_minutes: "Between 1 and 1440 minutes." } };
  }

  const service = createServiceClient();
  const { error } = await service.from("webinar_sessions").insert({
    webinar_id: webinarId,
    organization_id: org.organizationId,
    scheduled_at: new Date(scheduledAt).toISOString(),
    duration_minutes: duration,
  });
  if (error) return { error: `Could not add session: ${error.message}` };

  revalidatePath(`/webinars/${webinarId}`);
  return undefined;
}

export async function updateLandingPageAction(
  webinarId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();

  const parsed = landingPageUpdateSchema.safeParse({
    headline: formData.get("headline"),
    subheadline: formData.get("subheadline") ?? "",
    body_md: formData.get("body_md") ?? "",
    cta_label: formData.get("cta_label"),
    is_published: formData.get("is_published") === "on",
  });

  if (!parsed.success) {
    return {
      error: "Fix the highlighted fields.",
      fieldErrors: pickFieldErrors(parsed.error.issues),
    };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("landing_pages")
    .update({
      headline: parsed.data.headline,
      subheadline: parsed.data.subheadline || null,
      body_md: parsed.data.body_md || null,
      cta_label: parsed.data.cta_label,
      is_published: parsed.data.is_published,
    })
    .eq("webinar_id", webinarId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: `Could not update landing page: ${error.message}` };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "landing_page.updated",
    entity_type: "webinar",
    entity_id: webinarId,
    metadata: { is_published: parsed.data.is_published },
  });

  revalidatePath(`/webinars/${webinarId}`);
  return undefined;
}
