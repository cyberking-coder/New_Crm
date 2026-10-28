"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlugin } from "@/lib/plugins/registry";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

function assertAdmin(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Only owners and admins can manage plugins.");
  }
}

export async function installPluginAction(slug: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const def = getPlugin(slug);
  if (!def) throw new Error(`Unknown plugin: ${slug}`);

  const service = createServiceClient();
  const { error } = await service.from("plugins_installed").insert({
    organization_id: org.organizationId,
    plugin_slug: def.slug,
    version: def.version,
    enabled: !def.configSchema, // enable immediately if no config is required
    config: {},
    installed_by: user.id,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "plugin.installed",
    entity_type: "plugin",
    entity_id: def.slug,
    metadata: { version: def.version },
  });

  revalidatePath("/settings/plugins");
}

export async function uninstallPluginAction(slug: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("plugins_installed")
    .delete()
    .eq("organization_id", org.organizationId)
    .eq("plugin_slug", slug);
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "plugin.uninstalled",
    entity_type: "plugin",
    entity_id: slug,
    metadata: {},
  });

  revalidatePath("/settings/plugins");
}

export async function togglePluginAction(slug: string, enabled: boolean) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("plugins_installed")
    .update({ enabled })
    .eq("organization_id", org.organizationId)
    .eq("plugin_slug", slug);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/plugins");
}

export async function savePluginConfigAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const def = getPlugin(slug);
  if (!def) return { error: "Unknown plugin." };

  // Build the raw object from form fields, honoring each field's declared type.
  const raw: Record<string, unknown> = {};
  for (const field of def.configFields ?? []) {
    const v = formData.get(field.key);
    if (field.type === "boolean") {
      raw[field.key] = v === "on" || v === "true";
    } else if (field.type === "number") {
      raw[field.key] = v !== null && v !== "" ? Number(v) : undefined;
    } else {
      raw[field.key] = typeof v === "string" ? v : "";
    }
  }

  if (def.configSchema) {
    const check = def.configSchema.safeParse(raw);
    if (!check.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of check.error.issues) {
        const k = String(i.path[0] ?? "_");
        if (!fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return { error: "Fix the highlighted fields.", fieldErrors };
    }
    raw.$ = undefined;
    Object.assign(raw, check.data as Record<string, unknown>);
  }

  const service = createServiceClient();
  const { error } = await service
    .from("plugins_installed")
    .update({ config: raw, enabled: true })
    .eq("organization_id", org.organizationId)
    .eq("plugin_slug", slug);
  if (error) return { error: error.message };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "plugin.configured",
    entity_type: "plugin",
    entity_id: slug,
    metadata: {},
  });

  revalidatePath("/settings/plugins");
  return { ok: true };
}
