"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/types/database";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: string }
  | undefined;

const ROLES: OrgRole[] = ["owner", "admin", "manager", "member"];

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "manager", "member"]),
});

function assertAdmin(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Only owners and admins can manage team members.");
  }
}

export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const service = createServiceClient();

  // If this email already has a user profile, add membership immediately.
  const { data: profile } = await service
    .from("user_profiles")
    .select("id")
    .ilike("email", parsed.data.email)
    .maybeSingle();
  const existingUserId = (profile as { id: string } | null)?.id;

  if (existingUserId) {
    const { error: addErr } = await service
      .from("organization_members")
      .insert({
        organization_id: org.organizationId,
        user_id: existingUserId,
        role: parsed.data.role,
      });
    if (addErr && !/duplicate|unique/i.test(addErr.message)) {
      return { error: addErr.message };
    }

    await service.from("audit_logs").insert({
      organization_id: org.organizationId,
      actor_id: user.id,
      action: "member.added",
      entity_type: "user",
      entity_id: existingUserId,
      metadata: { role: parsed.data.role, email: parsed.data.email },
    });

    revalidatePath("/settings/team");
    return { ok: `${parsed.data.email} added as ${parsed.data.role}.` };
  }

  // Otherwise store a pending invitation.
  const token = crypto.randomBytes(24).toString("hex");
  const { error: invErr } = await service.from("organization_invitations").insert({
    organization_id: org.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    invited_by: user.id,
  });
  if (invErr) {
    if (/duplicate|unique/i.test(invErr.message)) {
      return { error: "There is already an open invitation for this email." };
    }
    return { error: invErr.message };
  }

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "member.invited",
    entity_type: "invitation",
    metadata: { role: parsed.data.role, email: parsed.data.email },
  });

  revalidatePath("/settings/team");
  return {
    ok: `Invitation created for ${parsed.data.email}. Share the invite link from the pending list.`,
  };
}

export async function changeMemberRoleAction(userId: string, roleRaw: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  if (!ROLES.includes(roleRaw as OrgRole)) throw new Error("Invalid role.");
  const role = roleRaw as OrgRole;

  // Only an owner can grant another owner.
  if (role === "owner" && org.role !== "owner") {
    throw new Error("Only an owner can grant the owner role.");
  }

  const service = createServiceClient();
  const { error } = await service
    .from("organization_members")
    .update({ role })
    .eq("organization_id", org.organizationId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "member.role_changed",
    entity_type: "user",
    entity_id: userId,
    metadata: { role },
  });
  revalidatePath("/settings/team");
}

export async function removeMemberAction(userId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  if (userId === user.id) {
    throw new Error("You cannot remove yourself. Leave from your profile instead.");
  }

  // Prevent removing the last owner.
  const service = createServiceClient();
  const { data: owners } = await service
    .from("organization_members")
    .select("user_id,role")
    .eq("organization_id", org.organizationId)
    .eq("role", "owner");
  const ownerIds = (owners as { user_id: string }[] | null)?.map((o) => o.user_id) ?? [];
  if (ownerIds.length === 1 && ownerIds[0] === userId) {
    throw new Error("The last owner cannot be removed. Transfer ownership first.");
  }

  const { error } = await service
    .from("organization_members")
    .delete()
    .eq("organization_id", org.organizationId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "member.removed",
    entity_type: "user",
    entity_id: userId,
    metadata: {},
  });
  revalidatePath("/settings/team");
}

export async function revokeInvitationAction(invitationId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertAdmin(org.role);

  const service = createServiceClient();
  const { error } = await service
    .from("organization_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("organization_id", org.organizationId)
    .is("claimed_at", null);
  if (error) throw new Error(error.message);

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "invitation.revoked",
    entity_type: "invitation",
    entity_id: invitationId,
    metadata: {},
  });

  revalidatePath("/settings/team");
}
