import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrganization } from "@/lib/auth/session";
import { getLead, listLeadActivities, listStages, listTasks } from "@/lib/crm/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StagePicker } from "./stage-picker";
import { AddNoteForm } from "./add-note-form";
import { AddTaskForm } from "./add-task-form";
import { TaskRow } from "./task-row";

export const dynamic = "force-dynamic";

const TIER_VARIANT = { hot: "success", warm: "warning", cold: "secondary" } as const;

const KIND_LABEL: Record<string, string> = {
  note: "Note",
  email_sent: "Email sent",
  email_received: "Email received",
  call: "Call",
  meeting: "Meeting",
  ai_summary: "AI summary",
  stage_change: "Stage change",
  score_change: "Score change",
  task_created: "Task created",
  task_completed: "Task completed",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await requireActiveOrganization();

  const [lead, stages] = await Promise.all([
    getLead(org.organizationId, id),
    listStages(org.organizationId),
  ]);
  if (!lead) notFound();

  const [activities, tasks] = await Promise.all([
    listLeadActivities(org.organizationId, lead.id),
    listTasks(org.organizationId, { leadId: lead.id }),
  ]);

  // Rationale is stored on the latest score_change activity.
  const scoreActivity = activities.find((a) => a.kind === "score_change");
  const rationale = (scoreActivity?.metadata as { rationale?: string[] } | undefined)?.rationale ?? [];
  const suggested =
    (scoreActivity?.metadata as { suggested_action?: string } | undefined)?.suggested_action ??
    lead.suggested_action ??
    null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={lead.full_name ?? lead.email}
        description={lead.email}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/sales/leads"
              className="inline-flex h-9 items-center rounded-md border bg-card px-3 hover:bg-secondary"
            >
              All leads
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-semibold tabular-nums">{lead.score}</div>
              <Badge variant={TIER_VARIANT[lead.tier]}>{lead.tier}</Badge>
            </div>
            {rationale.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {rationale.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No AI rationale yet. Score from the Registrations page.
              </p>
            )}
            {suggested ? (
              <div className="rounded-md border bg-secondary/40 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggested next
                </div>
                <div>{suggested}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StagePicker leadId={lead.id} stageId={lead.stage_id} stages={stages} />
            <div className="mt-3 text-xs text-muted-foreground">
              Company: {lead.company_name ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            )}
            <AddTaskForm leadId={lead.id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a note</CardTitle>
        </CardHeader>
        <CardContent>
          <AddNoteForm leadId={lead.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ol className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="rounded-md border bg-card p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.body ? <div className="whitespace-pre-wrap text-sm">{a.body}</div> : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
