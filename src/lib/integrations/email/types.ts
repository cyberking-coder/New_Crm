export type EmailMessage = {
  to: string;
  from: string;         // "Name <email@domain>" or "email@domain"
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Record<string, string>;
};

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

export interface EmailAdapter {
  readonly provider: string;
  send(message: EmailMessage, config: EmailAdapterConfig): Promise<SendResult>;
}

export type EmailAdapterConfig = {
  // Opaque, provider-specific config pulled from integration_connections.secrets
  // and integration_connections.config.
  apiKey?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
};
