"use client";

import { completeTaskAction } from "../../actions";
import type { TaskRow as TaskRowType } from "@/lib/crm/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PRIORITY_VARIANT = {
  low: "secondary",
  medium: "outline",
  high: "warning",
  urgent: "destructive",
} as const;

export function TaskRow({ task }: { task: TaskRowType }) {
  const complete = completeTaskAction.bind(null, task.id);
  const overdue =
    task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "done";

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{task.title}</span>
          <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
          {overdue ? <Badge variant="destructive">overdue</Badge> : null}
        </div>
        <div className="text-xs text-muted-foreground">
          {task.due_at ? new Date(task.due_at).toLocaleString() : "no due date"}
        </div>
      </div>
      <form action={complete}>
        <Button type="submit" size="sm" variant="outline">
          Done
        </Button>
      </form>
    </li>
  );
}
