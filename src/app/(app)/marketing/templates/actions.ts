"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { extractVariables } from "@/lib/email/templates";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: string }
  | undefined;

function assertManager(role: string) {
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only owners, admins, and managers can manage templates.");
  }
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(80).regex(slugRe, "lowercase letters, numbers, hyphens"),
  subject: z.string().trim().min(2).max(300),
  html: z.string().trim().min(10).max(100_000),
  text: z.string().trim().max(100_000).optional().or(z.literal("")),
  from_name: z.string().trim().max(80).optional().or(z.literal("")),
  from_email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  reply_to: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export async function createTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    subject: formData.get("subject"),
    html: formData.get("html"),
    text: formData.get("text") ?? "",
    from_name: formData.get("from_name") ?? "",
    from_email: formData.get("from_email") ?? "",
    reply_to: formData.get("reply_to") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const variables = Array.from(
    new Set([
      ...extractVariables(parsed.data.subject),
      ...extractVariables(parsed.data.html),
      ...(parsed.data.text ? extractVariables(parsed.data.text) : []),
    ]),
  );

  const service = createServiceClient();
  const { data: inserted, error } = await service
    .from("email_templates")
    .insert({
      organization_id: org.organizationId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      subject: parsed.data.subject,
      html: parsed.data.html,
      text: parsed.data.text || null,
      from_name: parsed.data.from_name || null,
      from_email: parsed.data.from_email || null,
      reply_to: parsed.data.reply_to || null,
      variables,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { fieldErrors: { slug: "This slug is already in use." } };
    }
    return { error: error.message };
  }
  revalidatePath("/marketing/templates");
  redirect(`/marketing/templates/${(inserted as { id: string }).id}`);
}

export async function updateTemplateAction(
  templateId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    subject: formData.get("subject"),
    html: formData.get("html"),
    text: formData.get("text") ?? "",
    from_name: formData.get("from_name") ?? "",
    from_email: formData.get("from_email") ?? "",
    reply_to: formData.get("reply_to") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const variables = Array.from(
    new Set([
      ...extractVariables(parsed.data.subject),
      ...extractVariables(parsed.data.html),
      ...(parsed.data.text ? extractVariables(parsed.data.text) : []),
    ]),
  );

  const service = createServiceClient();
  const { error } = await service
    .from("email_templates")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      subject: parsed.data.subject,
      html: parsed.data.html,
      text: parsed.data.text || null,
      from_name: parsed.data.from_name || null,
      from_email: parsed.data.from_email || null,
      reply_to: parsed.data.reply_to || null,
      variables,
    })
    .eq("id", templateId)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };

  revalidatePath("/marketing/templates");
  revalidatePath(`/marketing/templates/${templateId}`);
  return { ok: "Saved." };
}

export async function deleteTemplateAction(templateId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);
  const service = createServiceClient();
  const { error } = await service
    .from("email_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/marketing/templates");
  redirect("/marketing/templates");
}
