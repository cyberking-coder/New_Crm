import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteForm, MemberActions, InvitationActions } from "./team-ui";
import type { OrgRole } from "@/types/database";

export const dynamic = "force-dynamic";

type MemberRow = {
  user_id: string;
  role: OrgRole;
  created_at: string;
  profile: { email: string; full_name: string | null } | null;
};

type InvRow = {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  created_at: string;
  expires_at: string;
};

export default async function TeamPage() {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  const canManage = ["owner", "admin"].includes(org.role);

  const supabase = await createClient();
  const [membersRes, invsRes, base] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id,role,created_at,profile:user_profiles(email,full_name)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_invitations")
      .select("id,email,role,token,created_at,expires_at")
      .eq("organization_id", org.organizationId)
      .is("claimed_at", null)
      .order("created_at", { ascending: false }),
    getSiteUrl(),
  ]);

  if (membersRes.error) throw new Error(membersRes.error.message);
  if (invsRes.error) throw new Error(invsRes.error.message);

  const members = (membersRes.data ?? []) as unknown as MemberRow[];
  const invitations = (invsRes.data ?? []) as unknown as InvRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team members"
        description="Invite teammates and change what they can do."
        actions={<Badge variant="outline">{members.length} member{members.length === 1 ? "" : "s"}</Badge>}
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Joined</TH>
                {canManage ? <TH /> : null}
              </TR>
            </THead>
            <TBody>
              {members.map((m) => (
                <TR key={m.user_id}>
                  <TD className="font-medium">{m.profile?.full_name ?? "—"}</TD>
                  <TD>{m.profile?.email ?? "—"}</TD>
                  <TD>
                    <Badge variant={m.role === "owner" ? "default" : "outline"}>{m.role}</Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TD>
                  {canManage ? (
                    <TD className="text-right">
                      <MemberActions
                        userId={m.user_id}
                        role={m.role}
                        isSelf={m.user_id === user.id}
                        viewerIsOwner={org.role === "owner"}
                      />
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Invite link</TH>
                  <TH>Expires</TH>
                  {canManage ? <TH /> : null}
                </TR>
              </THead>
              <TBody>
                {invitations.map((i) => {
                  const link = `${base}/invitations/accept?token=${i.token}`;
                  return (
                    <TR key={i.id}>
                      <TD>{i.email}</TD>
                      <TD>
                        <Badge variant="outline">{i.role}</Badge>
                      </TD>
                      <TD className="max-w-sm truncate font-mono text-xs text-muted-foreground">
                        {link}
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {new Date(i.expires_at).toLocaleDateString()}
                      </TD>
                      {canManage ? (
                        <TD className="text-right">
                          <InvitationActions invitationId={i.id} link={link} />
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Email delivery lands with Phase 5. Until then, copy the invite link and send it to
              the invitee. They sign up with the same email, then open the link to join.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
