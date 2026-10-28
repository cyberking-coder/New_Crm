import { requireActiveOrganization } from "@/lib/auth/session";
import { PERMISSIONS, type Permission } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { OrgRole } from "@/types/database";

export const dynamic = "force-dynamic";

const ROLE_ORDER: OrgRole[] = ["owner", "admin", "manager", "member"];

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Full control. Can delete the organization and change billing.",
  admin: "Everything except delete / billing. Can manage members and integrations.",
  manager: "Create and edit webinars, campaigns, workflows. Cannot change membership.",
  member: "Read-only access to the workspace.",
};

export default async function RolesPage() {
  const org = await requireActiveOrganization();
  const permissionKeys = Object.keys(PERMISSIONS) as Permission[];

  // Group by domain prefix for readable layout.
  const groups = new Map<string, Permission[]>();
  for (const p of permissionKeys) {
    const key = p.split(".")[0]!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        description="What each role can do in your workspace."
        actions={<Badge variant="outline">You are {org.role}</Badge>}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {ROLE_ORDER.map((r) => (
          <Card key={r}>
            <CardHeader>
              <CardTitle className="capitalize">{r}</CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS[r]}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {[...groups.entries()].map(([group, perms]) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle className="capitalize">{group}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Permission</TH>
                  {ROLE_ORDER.map((r) => (
                    <TH key={r} className="text-center capitalize">
                      {r}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {perms.map((p) => (
                  <TR key={p}>
                    <TD className="font-mono text-xs">{p}</TD>
                    {ROLE_ORDER.map((r) => (
                      <TD key={r} className="text-center">
                        {(PERMISSIONS[p] as readonly OrgRole[]).includes(r) ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        Custom roles land with Phase 7. For now, assign one of the four built-in roles to each
        teammate on the Team members page.
      </p>
    </div>
  );
}
