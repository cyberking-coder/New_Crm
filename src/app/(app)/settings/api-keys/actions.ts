"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; createdKey?: string }
  | undefined;

function assertAdmin(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Only owners and admins can manage API keys.");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function createApiKeyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { fieldErrors: { name: parsed.error.issues[0]?.message ?? "Invalid name" } };
  }

  // Generate a 32-byte random key, encode as 'wos_' + base64url.
  const raw = crypto.randomBytes(32);
  const secret = `wos_${raw.toString("base64url")}`;
  const prefix = secret.slice(0, 12); // 'wos_' + 8 chars
  const hash = crypto.createHash("sha256").update(secret).digest("hex");

  const service = createServiceClient();
  const { error } = await service.from("api_keys").insert({
    organization_id: org.organizationId,
    name: parsed.data.name,
    key_prefix: prefix,
    key_hash: hash,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "api_key.created",
    entity_type: "api_key",
    metadata: { name: parsed.data.name, prefix },
  });

  revalidatePath("/settings/api-keys");
  return { createdKey: secret };
}

export async function revokeApiKeyAction(keyId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "api_key.revoked",
    entity_type: "api_key",
    entity_id: keyId,
    metadata: {},
  });
  revalidatePath("/settings/api-keys");
}
