import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function countAll(orgId: string, table: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
}

export default async function BillingPage() {
  const org = await requireActiveOrganization();
  const [webinars, registrants, members] = await Promise.all([
    countAll(org.organizationId, "webinars"),
    countAll(org.organizationId, "webinar_registrants"),
    countAll(org.organizationId, "organization_members"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Usage snapshot. Paid plans and Stripe integration arrive in Phase 6."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Webinars</CardTitle>
            <CardDescription>In this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{webinars}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Registrants</CardTitle>
            <CardDescription>Across all webinars</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{registrants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
            <CardDescription>Billed per seat on paid plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{members}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            All workspaces are on the free self-hosted plan today. Stripe billing, invoices, and
            usage limits land in Phase 6.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
