import { manualAdapter } from "./manual";
import { zoomAdapter } from "./zoom";
import type { WebinarAdapter } from "./types";

const adapters = new Map<string, WebinarAdapter>([
  [manualAdapter.provider, manualAdapter],
  [zoomAdapter.provider, zoomAdapter],
]);

export function getWebinarAdapter(provider: string): WebinarAdapter | null {
  return adapters.get(provider) ?? null;
}

export function listWebinarAdapters(): WebinarAdapter[] {
  return [...adapters.values()];
}

export const SUPPORTED_WEBINAR_PROVIDERS = [...adapters.keys()] as const;
