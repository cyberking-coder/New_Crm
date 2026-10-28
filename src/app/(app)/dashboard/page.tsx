import { requireActiveOrganization } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const org = await requireActiveOrganization();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${org.organizationName}`}
        description="Phase 1 shell is live. Metrics appear here once Phase 2 lands webinar data."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Webinars</CardTitle>
            <CardDescription>No webinars yet. Phase 2 enables creation.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Nothing to show until the webinar schema is in place.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>Live after public landing pages ship.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Lead scoring arrives in Phase 4.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">—</CardContent>
        </Card>
      </div>
    </div>
  );
}
