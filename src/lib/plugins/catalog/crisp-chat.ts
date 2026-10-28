import { z } from "zod";
import type { PluginDefinition } from "../types";
import { escapeHtmlAttr, isSimpleId } from "../escape";

export const crispChatPlugin: PluginDefinition = {
  slug: "crisp-chat",
  name: "Crisp Live Chat",
  version: "1.0.0",
  category: "chat",
  author: "WebinarOS",
  summary: "Add Crisp chat widget to landing pages.",
  description:
    "Loads the Crisp widget. Visitors can message you from any landing page; conversations go to your Crisp inbox.",
  icon: "message-circle",
  configSchema: z.object({
    website_id: z
      .string()
      .trim()
      .regex(/^[a-f0-9-]{20,64}$/i, "Crisp website IDs are hex-dashed UUIDs"),
  }),
  configFields: [
    {
      key: "website_id",
      label: "Website ID",
      type: "text",
      placeholder: "a1b2c3d4-...",
      help: "Crisp dashboard → Settings → Website Settings → Setup Instructions.",
      required: true,
    },
  ],
  hooks: {
    onLandingPageBody(_ctx, config) {
      const id = config.website_id;
      if (!isSimpleId(id)) return null;
      const safe = escapeHtmlAttr(String(id));
      return {
        html: `<script>window.$crisp=[];window.CRISP_WEBSITE_ID='${safe}';(function(){var d=document;var s=d.createElement('script');s.src='https://client.crisp.chat/l.js';s.async=1;d.getElementsByTagName('head')[0].appendChild(s);})();</script>`,
      };
    },
  },
};
