import type { PluginDefinition, PluginConfigField, PluginCategory } from "./types";

// A PluginSummary is the subset of a PluginDefinition that is safe to send from
// a Server Component to a Client Component. It drops the Zod schema and hook
// functions, keeping only the metadata the UI needs.
export type PluginSummary = {
  slug: string;
  name: string;
  version: string;
  category: PluginCategory;
  summary: string;
  description: string;
  author: string;
  icon?: string;
  configFields?: PluginConfigField[];
  // Whether the plugin requires any configuration at install time.
  hasConfigSchema: boolean;
};

export function toPluginSummary(p: PluginDefinition): PluginSummary {
  return {
    slug: p.slug,
    name: p.name,
    version: p.version,
    category: p.category,
    summary: p.summary,
    description: p.description,
    author: p.author,
    icon: p.icon,
    configFields: p.configFields,
    hasConfigSchema: Boolean(p.configSchema),
  };
}
