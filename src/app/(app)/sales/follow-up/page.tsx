import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listTasks } from "@/lib/crm/queries";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskRow } from "../leads/[id]/task-row";
import { AddStandaloneTaskForm } from "./add-task-form";

export const dynamic = "force-dynamic";

function bucket(d: string | null): "overdue" | "today" | "upcoming" | "later" | "someday" {
  if (!d) return "someday";
  const due = new Date(d).getTime();
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (due < now) return "overdue";
  if (due <= endOfToday.getTime()) return "today";
  if (due <= endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000) return "upcoming";
  return "later";
}

export default async function FollowUpPage() {
  const org = await requireActiveOrganization();
  const tasks = await listTasks(org.organizationId, {});

  const groups: Record<string, typeof tasks> = {
    overdue: [],
    today: [],
    upcoming: [],
    later: [],
    someday: [],
  };
  for (const t of tasks) {
    const b = bucket(t.due_at);
    groups[b]!.push(t);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-up queue"
        description="Everything open across your workspace, oldest due first."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create a task</CardTitle>
        </CardHeader>
        <CardContent>
          <AddStandaloneTaskForm />
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <Placeholder
          title="No open tasks"
          note="Tasks appear here as they're added from the lead detail or above."
        />
      ) : (
        (["overdue", "today", "upcoming", "later", "someday"] as const).map((key) => {
          const items = groups[key] ?? [];
          if (items.length === 0) return null;
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 capitalize">
                  {key}
                  <Badge variant={key === "overdue" ? "destructive" : "secondary"}>
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li key={t.id} className="group">
                      <TaskRow task={t} />
                      {t.lead_id ? (
                        <Link
                          href={`/sales/leads/${t.lead_id}`}
                          className="ml-2 text-xs text-primary hover:underline"
                        >
                          view lead
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
