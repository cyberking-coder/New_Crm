import { z } from "zod";

export const WEBINAR_TYPES = ["live", "automated", "hybrid", "recurring"] as const;
export const WEBINAR_STATUSES = ["draft", "scheduled", "live", "ended", "archived"] as const;
export const REGISTRANT_STATUSES = ["registered", "attended", "no_show", "cancelled"] as const;

export type WebinarType = (typeof WEBINAR_TYPES)[number];
export type WebinarStatus = (typeof WEBINAR_STATUSES)[number];
export type RegistrantStatus = (typeof REGISTRANT_STATUSES)[number];

// Loose IANA timezone shape check — full validation happens via Intl.supportedValuesOf in the server action.
const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .max(64)
  .regex(/^[A-Za-z0-9_+\-/]+$/, "Invalid timezone");

const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .max(64, "Slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

export const webinarCreateSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  slug: slugSchema,
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  type: z.enum(WEBINAR_TYPES),
  timezone: timezoneSchema,
  host_name: z.string().trim().max(140).optional().or(z.literal("")),
  // Primary session is optional at creation.
  session_scheduled_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid date/time"),
  session_duration_minutes: z
    .coerce.number()
    .int()
    .min(1, "At least 1 minute")
    .max(1440, "Max 24 hours")
    .optional(),
});

export type WebinarCreateInput = z.infer<typeof webinarCreateSchema>;

export const webinarUpdateSchema = webinarCreateSchema
  .omit({ session_scheduled_at: true, session_duration_minutes: true })
  .extend({
    status: z.enum(WEBINAR_STATUSES),
  });

export type WebinarUpdateInput = z.infer<typeof webinarUpdateSchema>;

export const landingPageUpdateSchema = z.object({
  headline: z.string().trim().min(2).max(200),
  subheadline: z.string().trim().max(300).optional().or(z.literal("")),
  body_md: z.string().trim().max(8000).optional().or(z.literal("")),
  cta_label: z.string().trim().min(1).max(60),
  is_published: z.coerce.boolean(),
});

export type LandingPageUpdateInput = z.infer<typeof landingPageUpdateSchema>;

// Public registration — comes from the landing page form; validate strictly.
export const registrantSubmitSchema = z.object({
  landing_slug: z.string().trim().min(1).max(64),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  full_name: z.string().trim().min(1, "Name is required").max(140),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(140).optional().or(z.literal("")),
  consent_marketing: z
    .union([z.literal("on"), z.literal("true"), z.literal("1"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true" || v === "1"),
  // Optional UTM capture.
  utm_source: z.string().trim().max(120).optional().or(z.literal("")),
  utm_medium: z.string().trim().max(120).optional().or(z.literal("")),
  utm_campaign: z.string().trim().max(120).optional().or(z.literal("")),
  utm_content: z.string().trim().max(120).optional().or(z.literal("")),
  utm_term: z.string().trim().max(120).optional().or(z.literal("")),
  // Anti-bot honeypot — must be empty.
  website: z.string().max(0, "bot").optional().or(z.literal("")),
});

export type RegistrantSubmitInput = z.infer<typeof registrantSubmitSchema>;
