import { requireActiveOrganization } from "@/lib/auth/session";
import { listConnections } from "@/lib/integrations/connections";
import { SUPPORTED_WEBINAR_PROVIDERS } from "@/lib/integrations/webinar/registry";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSiteUrl } from "@/lib/site-url";
import { ConnectForm } from "./connect-form";
import { ConnectionActions } from "./connection-actions";

export const dynamic = "force-dynamic";

export default async function WebinarIntegrationsPage() {
  const org = await requireActiveOrganization();
  const connections = await listConnections(org.organizationId, "webinar");
  const base = await getSiteUrl();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webinar provider"
        description="Connect a webinar platform. Attendance, engagement, and recordings will flow in through its webhook."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Add a connection</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectForm providers={SUPPORTED_WEBINAR_PROVIDERS as unknown as string[]} />
            <p className="mt-3 text-xs text-muted-foreground">
              A webhook secret is generated for you. The <strong>manual</strong> provider accepts a
              documented portable JSON format signed with HMAC-SHA256; use it with n8n, Zapier, or
              custom scripts while native adapters are being added.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <Placeholder
                title="No webinar providers connected"
                note="Add one above. You'll get a webhook URL to paste into the provider's console."
              />
            ) : (
              <ul className="divide-y rounded-md border">
                {connections.map((c) => (
                  <li key={c.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.display_name}</span>
                          <Badge variant="outline" className="uppercase">
                            {c.provider}
                          </Badge>
                          <Badge variant={c.is_active ? "success" : "secondary"}>
                            {c.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Created {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <ConnectionActions connection={c} />
                    </div>
                    <div className="rounded-md border bg-secondary/40 p-2 text-xs">
                      <div className="text-muted-foreground">Webhook URL</div>
                      <div className="truncate font-mono">
                        {base}/api/webhooks/webinar/{c.id}
                      </div>
                    </div>
                    {c.last_error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        Last error: {c.last_error}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manual provider webhook format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            POST a JSON body to the connection&rsquo;s webhook URL with a header{" "}
            <code className="rounded bg-secondary px-1">x-webinaros-signature</code> set to{" "}
            <code>hex(hmac_sha256(secret, body))</code>.
          </p>
          <pre className="overflow-x-auto rounded-md border bg-secondary/40 p-3 text-xs">{`// participant join
{
  "event_id": "unique-id-123",
  "type": "participant",
  "kind": "join",
  "email": "attendee@example.com",
  "display_name": "Ada Lovelace",
  "provider_session_id": "webinar-session-abc",
  "occurred_at": "2026-10-28T15:00:00Z"
}

// recording ready
{
  "event_id": "rec-456",
  "type": "recording",
  "provider_session_id": "webinar-session-abc",
  "title": "Launch — Q1 2026",
  "external_url": "https://cdn.example.com/rec/abc.mp4",
  "duration_seconds": 3600
}`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
