// Plugin SDK — types and conventions every plugin follows.
//
// A plugin is a static object exported from `src/lib/plugins/catalog/<slug>.ts`.
// At runtime, enabled plugins are loaded from the DB and their hooks are
// invoked. Plugin code never runs with elevated DB access — hooks receive a
// trusted, pre-selected context and return small, pure values (HTML strings,
// JSON, etc). This keeps the surface auditable.

import type { ZodTypeAny } from "zod";

export type PluginCategory =
  | "analytics"
  | "marketing"
  | "chat"
  | "productivity"
  | "custom";

export type PluginContext = {
  organization: { id: string; name: string };
  // Public context — present on landing pages. Absent in dashboard hooks.
  landingPage?: {
    public_slug: string;
    webinar_id: string;
    webinar_title: string;
  };
};

export type HeadInjection = {
  // One or more <script>, <link>, <meta>, <noscript> fragments to insert in <head>.
  html: string;
};

export type BodyInjection = {
  // Fragments to insert at the end of <body> (chat widgets, popovers, etc.).
  html: string;
};

export interface PluginHooks {
  // Return a head injection for a landing page render, or null to skip.
  onLandingPageHead?: (
    ctx: PluginContext,
    config: Record<string, unknown>,
  ) => HeadInjection | null;

  // Return a body injection for a landing page render, or null to skip.
  onLandingPageBody?: (
    ctx: PluginContext,
    config: Record<string, unknown>,
  ) => BodyInjection | null;
}

export interface PluginDefinition {
  slug: string; // stable identifier — never changes
  name: string;
  version: string;
  category: PluginCategory;
  summary: string;
  description: string;
  author: string; // e.g. "WebinarOS" or "Community"
  icon?: string; // emoji or lucide icon name (optional)
  // Zod schema for the config form. If omitted, no config is needed.
  configSchema?: ZodTypeAny;
  // Field definitions for the auto-generated config form.
  configFields?: PluginConfigField[];
  hooks: PluginHooks;
}

export type PluginConfigField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "boolean" | "number" | "secret";
  placeholder?: string;
  help?: string;
  required?: boolean;
};

export type InstalledPluginRow = {
  id: string;
  organization_id: string;
  plugin_slug: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
};
