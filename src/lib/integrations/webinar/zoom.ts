import type { ParsedWebhook, WebinarAdapter } from "./types";
import crypto from "node:crypto";

// Zoom webhook adapter — minimal, verified scope:
// - validates `x-zm-signature` against the configured webhook secret
// - normalizes `webinar.participant_joined` / `webinar.participant_left`
// - normalizes `recording.completed` to a recording event
// Lifecycle, polls, Q&A are intentionally NOT implemented until end-to-end tested
// against a real Zoom tenant. The adapter marks everything else as `unknown`.
export const zoomAdapter: WebinarAdapter = {
  provider: "zoom",

  verifySignature({ secret, rawBody, headers }) {
    if (!secret) return false;
    const timestamp = headers.get("x-zm-request-timestamp") || "";
    const sig = headers.get("x-zm-signature") || "";
    if (!timestamp || !sig) return false;

    const message = `v0:${timestamp}:${rawBody}`;
    const hash = crypto.createHmac("sha256", secret).update(message).digest("hex");
    const expected = `v0=${hash}`;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  parseWebhook({ rawBody }): ParsedWebhook {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { provider: "zoom", valid: false, reason: "invalid json", events: [] };
    }

    const b = body as {
      event?: string;
      event_ts?: number;
      payload?: {
        object?: {
          id?: string;
          uuid?: string;
          participant?: {
            email?: string;
            user_name?: string;
            id?: string;
            participant_user_id?: string;
            join_time?: string;
            leave_time?: string;
            device?: string;
          };
          recording_files?: {
            id?: string;
            file_type?: string;
            play_url?: string;
            download_url?: string;
            file_size?: number;
          }[];
          topic?: string;
          duration?: number;
        };
      };
    };

    if (!b.event) return { provider: "zoom", valid: true, events: [] };

    if (b.event === "webinar.participant_joined" || b.event === "webinar.participant_left") {
      const kind = b.event.endsWith("joined") ? "join" : "leave";
      const p = b.payload?.object?.participant;
      const email = p?.email;
      if (!email) {
        return { provider: "zoom", valid: true, events: [{ type: "unknown", raw: body }] };
      }
      const occurred = (kind === "join" ? p?.join_time : p?.leave_time) ?? new Date().toISOString();
      return {
        provider: "zoom",
        valid: true,
        events: [
          {
            type: "participant",
            external_event_id: `${b.event}:${p?.id ?? ""}:${occurred}`,
            event: {
              kind,
              email,
              display_name: p?.user_name,
              provider_participant_id: p?.id ?? p?.participant_user_id,
              provider_session_id: b.payload?.object?.uuid ?? b.payload?.object?.id,
              occurred_at: occurred,
              device: p?.device,
            },
          },
        ],
      };
    }

    if (b.event === "recording.completed") {
      const files = b.payload?.object?.recording_files ?? [];
      const first = files.find((f) => f.file_type === "MP4") ?? files[0];
      const url = first?.play_url ?? first?.download_url;
      if (!url) return { provider: "zoom", valid: true, events: [{ type: "unknown", raw: body }] };
      return {
        provider: "zoom",
        valid: true,
        events: [
          {
            type: "recording",
            external_event_id: `recording:${b.payload?.object?.uuid ?? b.payload?.object?.id}`,
            event: {
              provider_session_id: b.payload?.object?.uuid ?? b.payload?.object?.id,
              title: b.payload?.object?.topic ?? "Recording",
              external_url: url,
              duration_seconds: b.payload?.object?.duration
                ? b.payload.object.duration * 60
                : undefined,
              size_bytes: first?.file_size,
            },
          },
        ],
      };
    }

    return { provider: "zoom", valid: true, events: [{ type: "unknown", raw: body }] };
  },
};
