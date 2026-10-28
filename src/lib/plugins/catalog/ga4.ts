import { z } from "zod";
import type { PluginDefinition } from "../types";
import { escapeHtmlAttr, isSimpleId } from "../escape";

export const ga4Plugin: PluginDefinition = {
  slug: "ga4",
  name: "Google Analytics 4",
  version: "1.0.0",
  category: "analytics",
  author: "WebinarOS",
  summary: "Track landing page visits in GA4.",
  description:
    "Injects the gtag.js snippet into landing page <head>. Configure with your GA4 Measurement ID (G-XXXXXXX).",
  icon: "bar-chart",
  configSchema: z.object({
    measurement_id: z
      .string()
      .trim()
      .regex(/^G-[A-Z0-9]{4,20}$/, "Must look like G-XXXXXXX"),
  }),
  configFields: [
    {
      key: "measurement_id",
      label: "Measurement ID",
      type: "text",
      placeholder: "G-XXXXXXXX",
      help: "Found in GA4 → Admin → Data Streams.",
      required: true,
    },
  ],
  hooks: {
    onLandingPageHead(_ctx, config) {
      const id = config.measurement_id;
      if (!isSimpleId(id) || typeof id !== "string" || !id.startsWith("G-")) return null;
      const safeId = escapeHtmlAttr(id);
      // id is restricted to [A-Za-z0-9_\-.] by isSimpleId so it's safe inline.
      return {
        html: `<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safeId}');</script>`,
      };
    },
  },
};
