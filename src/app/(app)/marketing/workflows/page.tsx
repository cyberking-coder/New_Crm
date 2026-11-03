import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  trigger: "registrant_created" | "attendance_recorded" | "lead_scored" | "manual";
  status: "draft" | "active" | "paused";
  steps: unknown[];
  updated_at: string;
};

export default async function WorkflowsPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_workflows")
    .select("id,name,trigger,status,steps,updated_at")
    .eq("organization_id", org.organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="Automation workflows"
        description="Trigger → steps. Each run drains through the durable job queue."
        actions={
          <Link
            href="/marketing/workflows/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New workflow
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Placeholder
          title="No workflows yet"
          note="Create one to send automatic follow-ups when a registrant signs up or a lead is scored."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Trigger</TH>
              <TH>Steps</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((w) => (
              <TR key={w.id}>
                <TD>
                  <Link href={`/marketing/workflows/${w.id}`} className="font-medium hover:underline">
                    {w.name}
                  </Link>
                </TD>
                <TD className="font-mono text-xs">{w.trigger}</TD>
                <TD>{Array.isArray(w.steps) ? w.steps.length : 0}</TD>
                <TD>
                  <Badge variant={w.status === "active" ? "success" : "secondary"}>
                    {w.status}
                  </Badge>
                </TD>
                <TD className="text-xs text-muted-foreground">
                  {new Date(w.updated_at).toLocaleDateString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
