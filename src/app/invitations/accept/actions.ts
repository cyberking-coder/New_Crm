"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function acceptInvitationAction(token: string): Promise<void> {
  const user = await requireUser();
  const service = createServiceClient();

  const { data } = await service
    .from("organization_invitations")
    .select("id,organization_id,email,role,expires_at,claimed_at")
    .eq("token", token)
    .maybeSingle();
  const inv = data as
    | {
        id: string;
        organization_id: string;
        email: string;
        role: "owner" | "admin" | "manager" | "member";
        expires_at: string;
        claimed_at: string | null;
      }
    | null;

  if (!inv) throw new Error("Invitation not found.");
  if (inv.claimed_at) throw new Error("Invitation already accepted.");
  if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("Invitation expired.");
  if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw new Error("This invitation is for a different email address.");
  }

  const { error: memErr } = await service
    .from("organization_members")
    .insert({
      organization_id: inv.organization_id,
      user_id: user.id,
      role: inv.role,
    });
  if (memErr && !/duplicate|unique/i.test(memErr.message)) {
    throw new Error(memErr.message);
  }

  await service
    .from("organization_invitations")
    .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
    .eq("id", inv.id);

  await service.from("audit_logs").insert({
    organization_id: inv.organization_id,
    actor_id: user.id,
    action: "invitation.accepted",
    entity_type: "invitation",
    entity_id: inv.id,
    metadata: { role: inv.role },
  });

  redirect("/dashboard");
}
