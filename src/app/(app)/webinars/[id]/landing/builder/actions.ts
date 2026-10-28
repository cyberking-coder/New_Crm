"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { BLOCK_KINDS, BLOCK_SCHEMAS, DEFAULT_DATA, type BlockKind } from "@/lib/landing/blocks";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function assertManager(role: string) {
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only owners, admins, and managers can edit landing pages.");
  }
}

async function getLandingPageIdForWebinar(
  webinarId: string,
  orgId: string,
): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("landing_pages")
    .select("id")
    .eq("webinar_id", webinarId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function addBlockAction(webinarId: string, kindRaw: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  if (!BLOCK_KINDS.includes(kindRaw as BlockKind)) {
    throw new Error("Unknown block type.");
  }
  const kind = kindRaw as BlockKind;

  const landingPageId = await getLandingPageIdForWebinar(webinarId, org.organizationId);
  if (!landingPageId) throw new Error("Landing page not found.");

  const service = createServiceClient();
  // Append at the end: pick max(position)+1.
  const { data: maxRow } = await service
    .from("landing_page_blocks")
    .select("position")
    .eq("landing_page_id", landingPageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = ((maxRow as { position: number } | null)?.position ?? -1) + 1;

  const { error } = await service.from("landing_page_blocks").insert({
    landing_page_id: landingPageId,
    organization_id: org.organizationId,
    kind,
    position: next,
    data: DEFAULT_DATA[kind],
  });
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "landing_block.added",
    entity_type: "webinar",
    entity_id: webinarId,
    metadata: { kind },
  });

  revalidatePath(`/webinars/${webinarId}/landing/builder`);
}

export async function updateBlockAction(
  webinarId: string,
  blockId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { data: blockRow } = await service
    .from("landing_page_blocks")
    .select("kind,landing_page_id,organization_id")
    .eq("id", blockId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const block = blockRow as { kind: BlockKind; landing_page_id: string } | null;
  if (!block) return { error: "Block not found." };

  // Form values arrive as a JSON string in `data_json` so complex (nested) data
  // is preserved — simple scalars go via normal form fields too.
  const dataJson = String(formData.get("data_json") ?? "{}");
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataJson);
  } catch {
    return { error: "Invalid data payload." };
  }

  const schema = BLOCK_SCHEMAS[block.kind];
  const check = schema.safeParse(parsed);
  if (!check.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of check.error.issues) {
      const k = (i.path[0] as string | undefined) ?? "_";
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const { error } = await service
    .from("landing_page_blocks")
    .update({ data: check.data as Record<string, unknown> })
    .eq("id", blockId);
  if (error) return { error: error.message };

  revalidatePath(`/webinars/${webinarId}/landing/builder`);
  return undefined;
}

export async function moveBlockAction(
  webinarId: string,
  blockId: string,
  direction: "up" | "down",
) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { data: here } = await service
    .from("landing_page_blocks")
    .select("id,landing_page_id,position")
    .eq("id", blockId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const current = here as { id: string; landing_page_id: string; position: number } | null;
  if (!current) throw new Error("Block not found.");

  const op = direction === "up" ? ("lt" as const) : ("gt" as const);
  const orderAsc = direction === "down";

  const { data: neighbour } = await service
    .from("landing_page_blocks")
    .select("id,position")
    [op]("position", current.position)
    .eq("landing_page_id", current.landing_page_id)
    .order("position", { ascending: orderAsc })
    .limit(1)
    .maybeSingle();
  const other = neighbour as { id: string; position: number } | null;
  if (!other) return; // already at edge

  // Swap positions using a temporary sentinel to avoid the unique constraint.
  const sentinel = -1 * (Math.floor(Math.random() * 1_000_000) + 1);
  await service.from("landing_page_blocks").update({ position: sentinel }).eq("id", current.id);
  await service.from("landing_page_blocks").update({ position: current.position }).eq("id", other.id);
  await service.from("landing_page_blocks").update({ position: other.position }).eq("id", current.id);

  revalidatePath(`/webinars/${webinarId}/landing/builder`);
}

export async function toggleBlockVisibilityAction(webinarId: string, blockId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { data: row } = await service
    .from("landing_page_blocks")
    .select("is_hidden")
    .eq("id", blockId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const current = row as { is_hidden: boolean } | null;
  if (!current) throw new Error("Block not found.");

  await service
    .from("landing_page_blocks")
    .update({ is_hidden: !current.is_hidden })
    .eq("id", blockId);

  revalidatePath(`/webinars/${webinarId}/landing/builder`);
}

export async function deleteBlockAction(webinarId: string, blockId: string) {
  await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("landing_page_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);

  revalidatePath(`/webinars/${webinarId}/landing/builder`);
}
