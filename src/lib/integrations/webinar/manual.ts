import type { ParsedWebhook, WebinarAdapter } from "./types";
import { z } from "zod";
import crypto from "node:crypto";

// A documented, portable webhook format callers (n8n, Zapier, custom scripts) can post.
// Signature: hex HMAC-SHA256 of the raw body, sent in `x-webinaros-signature`.
const schema = z.object({
  event_id: z.string().min(1).max(200).optional(),
  type: z.enum(["participant", "recording", "session_lifecycle"]),
  // participant
  kind: z.enum(["join", "leave"]).optional(),
  email: z.string().email().optional(),
  display_name: z.string().max(200).optional(),
  provider_participant_id: z.string().max(200).optional(),
  provider_session_id: z.string().max(200).optional(),
  occurred_at: z.string().optional(),
  device: z.string().max(80).optional(),
  // recording
  title: z.string().max(300).optional(),
  external_url: z.string().url().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  thumbnail_url: z.string().url().optional(),
  // lifecycle
  status: z.enum(["scheduled", "started", "ended"]).optional(),
});

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const manualAdapter: WebinarAdapter = {
  provider: "manual",

  verifySignature({ secret, rawBody, headers }) {
    // Empty secret = no verification (dev-only); still return true.
    if (!secret) return true;
    const sig = headers.get("x-webinaros-signature") || "";
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeEqualHex(sig, expected);
  },

  parseWebhook({ rawBody }): ParsedWebhook {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return { provider: "manual", valid: false, reason: "invalid json", events: [] };
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      return {
        provider: "manual",
        valid: false,
        reason: parsed.error.issues[0]?.message ?? "invalid shape",
        events: [],
      };
    }

    const p = parsed.data;
    const now = new Date().toISOString();

    if (p.type === "participant") {
      if (!p.kind || !p.email) {
        return {
          provider: "manual",
          valid: false,
          reason: "participant requires kind and email",
          events: [],
        };
      }
      return {
        provider: "manual",
        valid: true,
        events: [
          {
            type: "participant",
            external_event_id: p.event_id,
            event: {
              kind: p.kind,
              email: p.email,
              display_name: p.display_name,
              provider_participant_id: p.provider_participant_id,
              provider_session_id: p.provider_session_id,
              occurred_at: p.occurred_at ?? now,
              device: p.device,
            },
          },
        ],
      };
    }

    if (p.type === "recording") {
      if (!p.external_url || !p.title) {
        return {
          provider: "manual",
          valid: false,
          reason: "recording requires title and external_url",
          events: [],
        };
      }
      return {
        provider: "manual",
        valid: true,
        events: [
          {
            type: "recording",
            external_event_id: p.event_id,
            event: {
              provider_session_id: p.provider_session_id,
              title: p.title,
              external_url: p.external_url,
              duration_seconds: p.duration_seconds,
              size_bytes: p.size_bytes,
              thumbnail_url: p.thumbnail_url,
            },
          },
        ],
      };
    }

    if (p.type === "session_lifecycle") {
      if (!p.status || !p.provider_session_id) {
        return {
          provider: "manual",
          valid: false,
          reason: "session_lifecycle requires status and provider_session_id",
          events: [],
        };
      }
      return {
        provider: "manual",
        valid: true,
        events: [
          {
            type: "session_lifecycle",
            external_event_id: p.event_id,
            provider_session_id: p.provider_session_id,
            status: p.status,
            occurred_at: p.occurred_at ?? now,
          },
        ],
      };
    }

    return { provider: "manual", valid: true, events: [] };
  },
};
