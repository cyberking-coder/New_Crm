import type { PluginDefinition } from "./types";
import { ga4Plugin } from "./catalog/ga4";
import { metaPixelPlugin } from "./catalog/meta-pixel";
import { gtmPlugin } from "./catalog/gtm";
import { crispChatPlugin } from "./catalog/crisp-chat";
import { customScriptPlugin } from "./catalog/custom-script";

// First-party plugin catalog. New plugins are added here; they ship with the
// app. A future phase can add remote plugins fetched by manifest URL.
const PLUGIN_LIST: PluginDefinition[] = [
  ga4Plugin,
  metaPixelPlugin,
  gtmPlugin,
  crispChatPlugin,
  customScriptPlugin,
];

const BY_SLUG = new Map(PLUGIN_LIST.map((p) => [p.slug, p]));

export function listCatalog(): PluginDefinition[] {
  return PLUGIN_LIST.slice();
}

export function getPlugin(slug: string): PluginDefinition | null {
  return BY_SLUG.get(slug) ?? null;
}
