import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateKeyForm, RevokeKeyButton } from "./key-ui";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default async function ApiKeysPage() {
  const org = await requireActiveOrganization();
  const canManage = ["owner", "admin"].includes(org.role);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id,name,key_prefix,scopes,created_at,last_used_at,revoked_at")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const keys = (data ?? []) as unknown as Row[];
  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Programmatic access to this workspace. The full key is shown once at creation."
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Create a key</CardTitle>
            <CardDescription>
              The secret is displayed once. Save it to your password manager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateKeyForm />
          </CardContent>
        </Card>
      ) : (
        <Placeholder
          title="Read-only"
          note="Only owners and admins can create or revoke API keys."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active keys</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <Placeholder title="No active keys" note="Create one above to get started." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Prefix</TH>
                  <TH>Scopes</TH>
                  <TH>Created</TH>
                  <TH>Last used</TH>
                  {canManage ? <TH /> : null}
                </TR>
              </THead>
              <TBody>
                {active.map((k) => (
                  <TR key={k.id}>
                    <TD className="font-medium">{k.name}</TD>
                    <TD className="font-mono text-xs">{k.key_prefix}…</TD>
                    <TD className="text-xs">
                      {(k.scopes ?? []).map((s) => (
                        <Badge key={s} variant="outline" className="mr-1">
                          {s}
                        </Badge>
                      ))}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                    </TD>
                    {canManage ? (
                      <TD className="text-right">
                        <RevokeKeyButton keyId={k.id} />
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {revoked.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Revoked</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Prefix</TH>
                  <TH>Revoked</TH>
                </TR>
              </THead>
              <TBody>
                {revoked.map((k) => (
                  <TR key={k.id}>
                    <TD>{k.name}</TD>
                    <TD className="font-mono text-xs">{k.key_prefix}…</TD>
                    <TD className="text-xs text-muted-foreground">
                      {k.revoked_at ? new Date(k.revoked_at).toLocaleString() : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        The authenticated API that consumes these keys lands with Phase 6. Keys you create now
        will be accepted by that API — no need to recreate them later.
      </p>
    </div>
  );
}
