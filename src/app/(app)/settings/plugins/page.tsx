import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCatalog } from "@/lib/plugins/registry";
import { toPluginSummary } from "@/lib/plugins/summary";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PluginCard } from "./plugin-card";

export const dynamic = "force-dynamic";

type InstalledRow = {
  plugin_slug: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installed_at: string;
};

export default async function PluginsPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { data: installedData, error } = await supabase
    .from("plugins_installed")
    .select("plugin_slug,enabled,config,installed_at")
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);
  const installed = (installedData ?? []) as unknown as InstalledRow[];
  const installedBySlug = new Map(installed.map((i) => [i.plugin_slug, i]));

  const catalog = listCatalog();
  const categories = Array.from(new Set(catalog.map((p) => p.category)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plugins"
        description="Install add-ons that extend your workspace. First-party plugins are built and maintained by WebinarOS."
        actions={
          <Badge variant="outline">
            {installed.filter((i) => i.enabled).length} of {installed.length} enabled
          </Badge>
        }
      />

      {installed.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Installed
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {installed.map((row) => {
                const def = catalog.find((p) => p.slug === row.plugin_slug);
                if (!def) return null;
                return (
                  <PluginCard
                    key={def.slug}
                    plugin={toPluginSummary(def)}
                    installed={{
                      enabled: row.enabled,
                      config: row.config,
                      installed_at: row.installed_at,
                    }}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {categories.map((cat) => {
          const items = catalog.filter((p) => p.category === cat && !installedBySlug.has(p.slug));
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {items.map((p) => (
                  <PluginCard key={p.slug} plugin={toPluginSummary(p)} installed={null} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
