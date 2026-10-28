import { z } from "zod";

// =============================================================================
// Block schemas — each block has a strict Zod schema for its data payload.
// The DB stores (kind, data: jsonb); the renderer picks the right schema.
// =============================================================================

export const heroSchema = z.object({
  eyebrow: z.string().max(80).optional().or(z.literal("")),
  heading: z.string().min(2).max(200),
  subheading: z.string().max(400).optional().or(z.literal("")),
  background: z.enum(["light", "dark", "accent"]).default("light"),
});

export const richTextSchema = z.object({
  heading: z.string().max(200).optional().or(z.literal("")),
  body: z.string().min(1).max(8000),
});

export const bulletsSchema = z.object({
  heading: z.string().max(200).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(400).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(12),
});

export const videoSchema = z.object({
  heading: z.string().max(200).optional().or(z.literal("")),
  url: z
    .string()
    .url()
    .refine(
      (u) => /youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|wistia\.com\//i.test(u) || /\.(mp4|webm)$/i.test(u),
      "Supports YouTube, Vimeo, Wistia, or direct .mp4/.webm links.",
    ),
});

export const countdownSchema = z.object({
  heading: z.string().max(200).optional().or(z.literal("")),
  // Use the next upcoming session automatically when `target_iso` is omitted.
  target_iso: z.string().optional().or(z.literal("")),
});

export const logosSchema = z.object({
  heading: z.string().max(200).optional().or(z.literal("")),
  logos: z
    .array(z.object({ alt: z.string().max(120), url: z.string().url() }))
    .min(1)
    .max(12),
});

export const testimonialSchema = z.object({
  quote: z.string().min(2).max(600),
  author: z.string().max(140),
  role: z.string().max(140).optional().or(z.literal("")),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export const faqSchema = z.object({
  heading: z.string().max(200).optional().or(z.literal("")),
  items: z
    .array(z.object({ q: z.string().min(1).max(300), a: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
});

export const ctaSchema = z.object({
  heading: z.string().min(2).max(200),
  subheading: z.string().max(400).optional().or(z.literal("")),
  // The CTA always scrolls to #register — the form anchor on the page.
});

export const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200),
  caption: z.string().max(300).optional().or(z.literal("")),
});

// The form anchor is a positional marker — the registration form renders here.
export const formAnchorSchema = z.object({});

export const BLOCK_SCHEMAS = {
  hero: heroSchema,
  rich_text: richTextSchema,
  bullets: bulletsSchema,
  video: videoSchema,
  countdown: countdownSchema,
  logos: logosSchema,
  testimonial: testimonialSchema,
  faq: faqSchema,
  cta: ctaSchema,
  image: imageSchema,
  form_anchor: formAnchorSchema,
} as const;

export type BlockKind = keyof typeof BLOCK_SCHEMAS;
export const BLOCK_KINDS = Object.keys(BLOCK_SCHEMAS) as BlockKind[];

export type BlockDataFor<K extends BlockKind> = z.infer<(typeof BLOCK_SCHEMAS)[K]>;

export type AnyBlock = {
  id: string;
  landing_page_id: string;
  kind: BlockKind;
  position: number;
  data: Record<string, unknown>;
  is_hidden: boolean;
};

// Default payload for a newly-added block of each kind.
export const DEFAULT_DATA: Record<BlockKind, Record<string, unknown>> = {
  hero: {
    eyebrow: "",
    heading: "Join the webinar",
    subheading: "A short line that sets expectations for who should attend.",
    background: "light",
  },
  rich_text: { heading: "", body: "Describe what attendees will learn." },
  bullets: {
    heading: "What you'll learn",
    items: [
      { title: "Point one", description: "" },
      { title: "Point two", description: "" },
      { title: "Point three", description: "" },
    ],
  },
  video: { heading: "", url: "" },
  countdown: { heading: "Starts in" },
  logos: { heading: "Trusted by", logos: [] },
  testimonial: { quote: "", author: "", role: "", avatar_url: "" },
  faq: {
    heading: "Questions",
    items: [{ q: "Will there be a replay?", a: "Yes, everyone who registers gets the replay." }],
  },
  cta: { heading: "Save your seat", subheading: "" },
  image: { url: "", alt: "", caption: "" },
  form_anchor: {},
};

export const BLOCK_LABELS: Record<BlockKind, string> = {
  hero: "Hero",
  rich_text: "Rich text",
  bullets: "Bullet list",
  video: "Video",
  countdown: "Countdown",
  logos: "Logo row",
  testimonial: "Testimonial",
  faq: "FAQ",
  cta: "Call to action",
  image: "Image",
  form_anchor: "Registration form (anchor)",
};
