// Provider-agnostic shapes for the webinar adapter boundary.

export type NormalizedParticipantEvent = {
  kind: "join" | "leave";
  email: string;
  display_name?: string;
  provider_participant_id?: string;
  provider_session_id?: string;
  occurred_at: string; // ISO
  device?: string;
};

export type NormalizedRecording = {
  provider_session_id?: string;
  title: string;
  external_url: string;
  duration_seconds?: number;
  size_bytes?: number;
  thumbnail_url?: string;
};

export type NormalizedWebhookEvent =
  | { type: "participant"; external_event_id?: string; event: NormalizedParticipantEvent }
  | { type: "recording"; external_event_id?: string; event: NormalizedRecording }
  | {
      type: "session_lifecycle";
      external_event_id?: string;
      status: "scheduled" | "started" | "ended";
      provider_session_id: string;
      occurred_at: string;
    }
  | { type: "unknown"; external_event_id?: string; raw: unknown };

export type ParsedWebhook = {
  provider: string;
  valid: boolean;
  reason?: string;
  events: NormalizedWebhookEvent[];
};

// A webinar provider adapter. Minimal surface for Phase 3; expands as adapters land.
export interface WebinarAdapter {
  readonly provider: string;

  // Verify the request's signature against the connection's webhook secret.
  verifySignature(args: { secret: string; rawBody: string; headers: Headers }): boolean;

  // Convert a raw inbound webhook body into normalized events.
  parseWebhook(args: { rawBody: string; headers: Headers }): ParsedWebhook;
}
