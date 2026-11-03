import { notFound } from "next/navigation";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CampaignActions } from "./actions-ui";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  audience_kind: string;
  audience_config: Record<string, unknown>;
  totals: { queued?: number; sent?: number; failed?: number };
  sent_at: string | null;
  template: { name: string; subject: string } | null;
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id,name,status,audience_kind,audience_config,totals,sent_at,template:email_templates(name,subject)",
    )
    .eq("organization_id", org.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const c = data as Row | null;
  if (!c) notFound();

  const { data: recipientsData } = await supabase
    .from("campaign_recipients")
    .select("id,email,status,sent_at,error")
    .eq("campaign_id", c.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const recipients = (recipientsData ?? []) as {
    id: string;
    email: string;
    status: "queued" | "sent" | "failed" | "skipped";
    sent_at: string | null;
    error: string | null;
  }[];

  const sent = recipients.filter((r) => r.status === "sent").length;
  const failed = recipients.filter((r) => r.status === "failed").length;
  const queued = recipients.filter((r) => r.status === "queued").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={c.name}
        description={`Template: ${c.template?.name ?? "—"} · Subject: ${c.template?.subject ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{c.status}</Badge>
            <CampaignActions campaignId={c.id} status={c.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Audience</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div>{c.audience_kind}</div>
            {Object.keys(c.audience_config).length > 0 ? (
              <pre className="mt-1 font-mono text-xs">{JSON.stringify(c.audience_config)}</pre>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Queued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{queued}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{failed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipients (latest 200)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Status</TH>
                <TH>Sent at</TH>
                <TH>Error</TH>
              </TR>
            </THead>
            <TBody>
              {recipients.map((r) => (
                <TR key={r.id}>
                  <TD>{r.email}</TD>
                  <TD>
                    <Badge variant={r.status === "sent" ? "success" : r.status === "failed" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}
                  </TD>
                  <TD className="max-w-md truncate text-xs text-destructive">{r.error ?? ""}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
