import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/types/database";

type MembershipRow = {
  role: OrgRole;
  organization: { id: string; name: string; slug: string } | null;
};

export type AuthedUser = {
  id: string;
  email: string;
};

export type ActiveMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrgRole;
};

export async function getAuthedUser(): Promise<AuthedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await getAuthedUser();
  if (!user) redirect("/sign-in");
  return user;
}

// Returns every org the current user is a member of, newest first.
export async function listUserOrganizations(): Promise<ActiveMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, slug, created_at)")
    .order("created_at", { foreignTable: "organizations", ascending: false });

  if (error) throw new Error(`listUserOrganizations: ${error.message}`);

  const rows = (data ?? []) as unknown as MembershipRow[];

  return rows
    .map((row): ActiveMembership | null => {
      if (!row.organization) return null;
      return {
        organizationId: row.organization.id,
        organizationName: row.organization.name,
        organizationSlug: row.organization.slug,
        role: row.role,
      };
    })
    .filter((m): m is ActiveMembership => m !== null);
}

// Enforce that the signed-in user belongs to at least one org, else send to onboarding.
export async function requireActiveOrganization(): Promise<ActiveMembership> {
  await requireUser();
  const memberships = await listUserOrganizations();
  if (memberships.length === 0) redirect("/onboarding");
  // Phase 1: no org switcher yet — pick the newest. Phase 2 adds a cookie-persisted active org.
  return memberships[0]!;
}
