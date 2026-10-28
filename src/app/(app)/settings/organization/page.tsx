import { requireActiveOrganization } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgSettingsForm, DeleteOrgForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const org = await requireActiveOrganization();
  const canEdit = ["owner", "admin"].includes(org.role);
  const canDelete = org.role === "owner";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Organization"
        description="Your workspace identity. The slug is used in internal URLs."
        actions={<Badge variant="outline">You are {org.role}</Badge>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            {canEdit ? "Change the name or slug." : "Read-only — only owners and admins can edit."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgSettingsForm
            name={org.organizationName}
            slug={org.organizationSlug}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      {canDelete ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting the organization permanently removes every webinar, registrant, and
              integration in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteOrgForm slug={org.organizationSlug} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
