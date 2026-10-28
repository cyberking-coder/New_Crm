import { z } from "zod";
import type { PluginDefinition } from "../types";

// Admin escape hatch: paste arbitrary HTML into head/body of landing pages.
// Only installable by owners/admins (enforced at write time), and the field is
// labeled explicitly as untrusted. We do NOT escape — this is intentionally raw
// so power users can paste script snippets. Users who paste malicious content
// into their own tenant harm themselves only; RLS blocks cross-tenant reads.
export const customScriptPlugin: PluginDefinition = {
  slug: "custom-script",
  name: "Custom script",
  version: "1.0.0",
  category: "custom",
  author: "WebinarOS",
  summary: "Paste arbitrary HTML into landing page <head> or <body>.",
  description:
    "Power-user escape hatch. Anything you paste here is injected verbatim into every landing page. Only use for scripts from vendors you trust (Hotjar, Clarity, Segment, etc).",
  icon: "code",
  configSchema: z.object({
    head_html: z.string().max(8000).optional().or(z.literal("")),
    body_html: z.string().max(8000).optional().or(z.literal("")),
  }),
  configFields: [
    {
      key: "head_html",
      label: "<head> HTML",
      type: "textarea",
      placeholder: "<script>…</script>",
      help: "Rendered at the top of every landing page. Max 8KB.",
    },
    {
      key: "body_html",
      label: "end of <body> HTML",
      type: "textarea",
      placeholder: "<script>…</script>",
      help: "Rendered just before </body>. Max 8KB.",
    },
  ],
  hooks: {
    onLandingPageHead(_ctx, config) {
      const html = typeof config.head_html === "string" ? config.head_html.trim() : "";
      if (!html) return null;
      return { html };
    },
    onLandingPageBody(_ctx, config) {
      const html = typeof config.body_html === "string" ? config.body_html.trim() : "";
      if (!html) return null;
      return { html };
    },
  },
};
