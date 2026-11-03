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

