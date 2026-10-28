import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function countAll(orgId: string, table: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

export default async function DashboardPage() {
  const org = await requireActiveOrganization();

  const [webinars, registrants, upcoming] = await Promise.all([
    countAll(org.organizationId, "webinars"),
    countAll(org.organizationId, "webinar_registrants"),
    (async () => {
      const supabase = await createClient();
      const { count } = await supabase
        .from("webinar_sessions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.organizationId)
        .gte("scheduled_at", new Date().toISOString());
      return count ?? 0;
    })(),
  ]);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${org.organizationName}`}
        description="A single-pane view of your webinars, registrants, and pipeline."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Webinars</CardTitle>
            <CardDescription>Total in your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{webinars}</div>
            <Link href="/webinars" className="text-xs text-primary hover:underline">
              Manage →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>Across all webinars</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{registrants}</div>
            <Link
              href="/audience/registrations"
              className="text-xs text-primary hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming sessions</CardTitle>
            <CardDescription>Scheduled from today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{upcoming}</div>
            <Link href="/webinars" className="text-xs text-primary hover:underline">
              See schedule →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
