import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kind: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  webinar: { title: string } | null;
  registrant: { email: string } | null;
};

export default async function EngagementPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagement_events")
    .select("id,kind,occurred_at,payload,webinar:webinars(title),registrant:webinar_registrants(email)")
    .eq("organization_id", org.organizationId)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="Engagement"
        description="Live events across your webinars — joins, poll answers, offer clicks, chat, reactions."
      />
      {rows.length === 0 ? (
        <Placeholder
          title="No events yet"
          note="Engagement events arrive via the provider webhook or in-session actions."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Kind</TH>
              <TH>Who</TH>
              <TH>Webinar</TH>
              <TH>Payload</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="text-xs text-muted-foreground">
                  {new Date(r.occurred_at).toLocaleString()}
                </TD>
                <TD>
                  <Badge variant="outline">{r.kind}</Badge>
                </TD>
                <TD className="text-sm">
                  {r.registrant?.email ?? (r.payload.email as string | undefined) ?? "—"}
                </TD>
                <TD className="text-sm">{r.webinar?.title ?? "—"}</TD>
                <TD className="max-w-md truncate font-mono text-xs text-muted-foreground">
                  {JSON.stringify(r.payload)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
