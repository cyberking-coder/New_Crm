import { z } from "zod";
import type { PluginDefinition } from "../types";
import { escapeHtmlAttr, isSimpleId } from "../escape";

export const gtmPlugin: PluginDefinition = {
  slug: "gtm",
  name: "Google Tag Manager",
  version: "1.0.0",
  category: "analytics",
  author: "WebinarOS",
  summary: "Load any tag through a single GTM container.",
  description:
    "Injects GTM into landing page <head> and the matching <noscript> at the top of <body>. Everything else is managed inside GTM.",
  icon: "tag",
  configSchema: z.object({
    container_id: z
      .string()
      .trim()
      .regex(/^GTM-[A-Z0-9]{4,15}$/, "Container IDs look like GTM-XXXXXXX"),
  }),
  configFields: [
    {
      key: "container_id",
      label: "Container ID",
      type: "text",
      placeholder: "GTM-XXXXXXX",
      required: true,
    },
  ],
  hooks: {
    onLandingPageHead(_ctx, config) {
      const id = config.container_id;
      if (!isSimpleId(id) || typeof id !== "string" || !id.startsWith("GTM-")) return null;
      const safe = escapeHtmlAttr(id);
      return {
        html: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${safe}');</script>`,
      };
    },
    onLandingPageBody(_ctx, config) {
      const id = config.container_id;
      if (!isSimpleId(id) || typeof id !== "string" || !id.startsWith("GTM-")) return null;
      const safe = escapeHtmlAttr(id);
      return {
        html: `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${safe}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
      };
    },
  },
};
