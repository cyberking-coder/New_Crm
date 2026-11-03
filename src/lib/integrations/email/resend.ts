import { Resend } from "resend";
import type { EmailAdapter, EmailAdapterConfig, EmailMessage, SendResult } from "./types";

// Keep one client per API key for connection reuse.
const clients = new Map<string, Resend>();
function getClient(apiKey: string): Resend {
  let c = clients.get(apiKey);
  if (!c) {
    c = new Resend(apiKey);
    clients.set(apiKey, c);
  }
  return c;
}

function retryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Retry on 5xx and rate limits.
  return /rate|timeout|ECONN|5\d{2}/i.test(msg);
}

export const resendAdapter: EmailAdapter = {
  provider: "resend",

  async send(message: EmailMessage, config: EmailAdapterConfig): Promise<SendResult> {
    if (!config.apiKey) return { ok: false, error: "resend api key missing", retryable: false };

    const client = getClient(config.apiKey);
    try {
      const result = await client.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        tags: message.tags
          ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
          : undefined,
      });

      if (result.error) {
        return {
          ok: false,
          error: result.error.message ?? "resend error",
          retryable: false,
        };
      }
      if (!result.data?.id) {
        return { ok: false, error: "resend returned no message id", retryable: false };
      }
      return { ok: true, providerMessageId: result.data.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        retryable: retryable(err),
      };
    }
  },
};
