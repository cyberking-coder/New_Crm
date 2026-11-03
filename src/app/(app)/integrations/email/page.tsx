import { requireActiveOrganization } from "@/lib/auth/session";
import { listConnections } from "@/lib/integrations/connections";
import { SUPPORTED_EMAIL_PROVIDERS } from "@/lib/integrations/email/registry";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectEmailForm, ConnectionActions, TestSendForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function EmailIntegrationsPage() {
  const org = await requireActiveOrganization();
  const connections = await listConnections(org.organizationId, "email");
  const canManage = ["owner", "admin"].includes(org.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email provider"
        description="Connect your transactional / marketing email sender. All sends go through this adapter."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Connect {SUPPORTED_EMAIL_PROVIDERS[0]}</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <ConnectEmailForm providers={SUPPORTED_EMAIL_PROVIDERS as unknown as string[]} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Owners and admins can add connections.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <Placeholder
                title="No email provider connected"
                note="Add a Resend API key above. Templates, campaigns, and workflows need an active connection to send."
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
                          Added {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {canManage ? <ConnectionActions connection={c} /> : null}
                    </div>
                    {c.last_error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        {c.last_error}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && connections.some((c) => c.is_active) ? (
        <Card>
          <CardHeader>
            <CardTitle>Send a test email</CardTitle>
          </CardHeader>
          <CardContent>
            <TestSendForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
