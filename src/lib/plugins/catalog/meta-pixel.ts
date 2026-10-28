import { z } from "zod";
import type { PluginDefinition } from "../types";
import { escapeHtmlAttr, isSimpleId } from "../escape";

export const metaPixelPlugin: PluginDefinition = {
  slug: "meta-pixel",
  name: "Meta Pixel",
  version: "1.0.0",
  category: "analytics",
  author: "WebinarOS",
  summary: "Track landing page views and leads in Meta Ads Manager.",
  description:
    "Injects the Meta pixel into landing page <head> and fires a PageView. Fires a Lead event on the thank-you page.",
  icon: "circle",
  configSchema: z.object({
    pixel_id: z
      .string()
      .trim()
      .regex(/^[0-9]{10,20}$/, "Pixel IDs are 10–20 digit numbers"),
  }),
  configFields: [
    {
      key: "pixel_id",
      label: "Pixel ID",
      type: "text",
      placeholder: "1234567890123456",
      help: "Found in Meta Events Manager.",
      required: true,
    },
  ],
  hooks: {
    onLandingPageHead(_ctx, config) {
      const id = config.pixel_id;
      if (!isSimpleId(id) || !/^\d+$/.test(String(id))) return null;
      const safe = escapeHtmlAttr(String(id));
      return {
        html: `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${safe}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${safe}&ev=PageView&noscript=1"/></noscript>`,
      };
    },
  },
};
