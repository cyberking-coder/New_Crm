import type { EmailAdapter } from "./types";
import { resendAdapter } from "./resend";

const adapters = new Map<string, EmailAdapter>([[resendAdapter.provider, resendAdapter]]);

export function getEmailAdapter(provider: string): EmailAdapter | null {
  return adapters.get(provider) ?? null;
}

export const SUPPORTED_EMAIL_PROVIDERS = [...adapters.keys()] as const;
