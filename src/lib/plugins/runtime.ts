import { createServiceClient } from "@/lib/supabase/server";
import { getPlugin } from "./registry";
import type { InstalledPluginRow, PluginContext } from "./types";

// Load enabled plugins for an organization. Uses the service client because
// landing page rendering is anonymous — RLS would hide the installed rows.
export async function loadEnabledPlugins(orgId: string): Promise<InstalledPluginRow[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("plugins_installed")
    .select("id,organization_id,plugin_slug,version,enabled,config,installed_at,updated_at")
    .eq("organization_id", orgId)
    .eq("enabled", true);
  if (error) {
    // Fail soft — never let a plugin lookup break the landing page.
    console.error("loadEnabledPlugins:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InstalledPluginRow[];
}

export type RenderedInjections = {
  head: string;
  body: string;
};

export function renderLandingInjections(
  installed: InstalledPluginRow[],
  ctx: PluginContext,
): RenderedInjections {
  const head: string[] = [];
  const body: string[] = [];

  for (const row of installed) {
    const def = getPlugin(row.plugin_slug);
    if (!def) continue;

    try {
      const h = def.hooks.onLandingPageHead?.(ctx, row.config);
      if (h?.html) head.push(`<!-- plugin:${def.slug} -->\n${h.html}`);
    } catch (err) {
      console.error(`plugin head hook failed (${def.slug}):`, err);
    }

    try {
      const b = def.hooks.onLandingPageBody?.(ctx, row.config);
      if (b?.html) body.push(`<!-- plugin:${def.slug} -->\n${b.html}`);
    } catch (err) {
      console.error(`plugin body hook failed (${def.slug}):`, err);
    }
  }

  return { head: head.join("\n"), body: body.join("\n") };
}
