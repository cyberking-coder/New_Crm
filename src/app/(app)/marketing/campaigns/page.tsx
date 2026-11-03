import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listWebinars } from "@/lib/webinars/queries";
import { CreateCampaignForm } from "./create-form";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  draft: "secondary",
  scheduled: "default",
  sending: "warning",
  sent: "success",
  paused: "secondary",
  failed: "destructive",
} as const;

type Row = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  audience_kind: string;
  totals: { queued?: number; sent?: number; failed?: number };
  sent_at: string | null;
  created_at: string;
  template: { name: string } | null;
};

export default async function CampaignsPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const [campaignsRes, templatesRes, webinars] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,status,audience_kind,totals,sent_at,created_at,template:email_templates(name)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_templates")
      .select("id,name")
      .eq("organization_id", org.organizationId)
      .not("slug", "like", "__test__-%")
      .order("name"),
    listWebinars(org.organizationId),
  ]);
  if (campaignsRes.error) throw new Error(campaignsRes.error.message);
  if (templatesRes.error) throw new Error(templatesRes.error.message);

  const campaigns = (campaignsRes.data ?? []) as unknown as Row[];
  const templates = (templatesRes.data ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6">
      <PageHeader title="Email campaigns" description="One-shot bulk sends to a selected audience." />

      <Card>
        <CardHeader>
          <CardTitle>New campaign</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a template first in Templates.
            </p>
          ) : (
            <CreateCampaignForm
              templates={templates}
              webinars={webinars.map((w) => ({ id: w.id, title: w.title }))}
            />
          )}
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <Placeholder title="No campaigns yet" note="Create one above." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Template</TH>
              <TH>Audience</TH>
              <TH>Status</TH>
              <TH>Totals</TH>
              <TH>Sent</TH>
            </TR>
          </THead>
          <TBody>
            {campaigns.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/marketing/campaigns/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-sm">{c.template?.name ?? "—"}</TD>
                <TD className="text-xs text-muted-foreground">{c.audience_kind}</TD>
                <TD>
                  <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                </TD>
                <TD className="text-xs text-muted-foreground">
                  {(c.totals.sent ?? 0)} / {(c.totals.queued ?? 0)}
                </TD>
                <TD className="text-xs text-muted-foreground">
                  {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
