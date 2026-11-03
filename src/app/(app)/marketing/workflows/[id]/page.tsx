import { notFound } from "next/navigation";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowEditor } from "../editor";

export const dynamic = "force-dynamic";

type WorkflowRow = {
  id: string;
  name: string;
  trigger: "registrant_created" | "attendance_recorded" | "lead_scored" | "manual";
  status: "draft" | "active" | "paused";
  trigger_config: Record<string, unknown>;
  steps: unknown[];
};

type Run = {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  trigger_entity_type: string | null;
  trigger_entity_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
};

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const [wfRes, templatesRes, runsRes] = await Promise.all([
    supabase
      .from("automation_workflows")
      .select("id,name,trigger,status,trigger_config,steps")
      .eq("organization_id", org.organizationId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("email_templates")
      .select("id,name")
      .eq("organization_id", org.organizationId)
      .not("slug", "like", "__test__-%")
      .order("name"),
    supabase
      .from("automation_runs")
      .select("id,status,trigger_entity_type,trigger_entity_id,started_at,completed_at,error")
      .eq("workflow_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (wfRes.error) throw new Error(wfRes.error.message);
  const w = wfRes.data as WorkflowRow | null;
  if (!w) notFound();
  const templates = (templatesRes.data ?? []) as { id: string; name: string }[];
  const runs = (runsRes.data ?? []) as unknown as Run[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={w.name} description={`Trigger: ${w.trigger}`}
        actions={<Badge variant={w.status === "active" ? "success" : "secondary"}>{w.status}</Badge>}
      />
      <Card>
        <CardContent className="pt-6">
          <WorkflowEditor
            templates={templates}
            initial={{
              id: w.id,
              name: w.name,
              trigger: w.trigger,
              status: w.status,
              trigger_config: w.trigger_config ?? {},
              steps: (Array.isArray(w.steps) ? w.steps : []) as never,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="truncate">
                    <Badge variant={
                      r.status === "completed" ? "success" :
                      r.status === "failed" ? "destructive" :
                      r.status === "running" ? "warning" : "secondary"
                    }>
                      {r.status}
                    </Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.trigger_entity_type ?? "manual"}:{r.trigger_entity_id ?? ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {r.completed_at
                      ? new Date(r.completed_at).toLocaleString()
                      : r.started_at
                      ? new Date(r.started_at).toLocaleString()
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
