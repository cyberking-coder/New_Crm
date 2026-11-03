import { createServiceClient } from "@/lib/supabase/server";
import { getEmailAdapter } from "@/lib/integrations/email/registry";
import type { EmailMessage, SendResult } from "@/lib/integrations/email/types";

type Connection = {
  id: string;
  organization_id: string;
  provider: string;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
  is_active: boolean;
};

export async function loadActiveEmailConnection(orgId: string): Promise<Connection | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("integration_connections")
    .select("id,organization_id,provider,config,secrets,is_active")
    .eq("organization_id", orgId)
    .eq("category", "email")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Connection | null) ?? null;
}

export class NoEmailProviderError extends Error {
  constructor() {
    super("No active email provider connected for this organization.");
    this.name = "NoEmailProviderError";
  }
}

export async function sendEmailViaConnection(
  orgId: string,
  message: EmailMessage,
): Promise<SendResult> {
  const conn = await loadActiveEmailConnection(orgId);
  if (!conn) throw new NoEmailProviderError();

  const adapter = getEmailAdapter(conn.provider);
  if (!adapter) {
    return { ok: false, error: `No adapter for provider ${conn.provider}`, retryable: false };
  }

  const apiKey = typeof conn.secrets?.api_key === "string" ? conn.secrets.api_key : undefined;
  const defaultFromEmail =
    typeof conn.config?.from_email === "string" ? conn.config.from_email : undefined;
  const defaultFromName =
    typeof conn.config?.from_name === "string" ? conn.config.from_name : undefined;

  const fromFallback = defaultFromName
    ? `${defaultFromName} <${defaultFromEmail}>`
    : defaultFromEmail ?? "no-reply@example.com";

  return adapter.send(
    { ...message, from: message.from || fromFallback },
    { apiKey, defaultFromEmail, defaultFromName },
  );
}
