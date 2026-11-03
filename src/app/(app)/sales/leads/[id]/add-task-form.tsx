"use client";

import { useActionState, useId, useRef, useEffect } from "react";
import { createTaskAction, type ActionState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function AddTaskForm({ leadId }: { leadId: string }) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTaskAction,
    undefined,
  );
  const ref = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={ref} action={formAction} className="space-y-2 border-t pt-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="space-y-1">
        <Label htmlFor={`${idp}-t`}>New task</Label>
        <Input id={`${idp}-t`} name="title" placeholder="Follow up by email" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idp}-d`} className="text-xs text-muted-foreground">
            Due
          </Label>
          <Input id={`${idp}-d`} type="datetime-local" name="due_at" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-p`} className="text-xs text-muted-foreground">
            Priority
          </Label>
          <Select id={`${idp}-p`} name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
      </div>
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="sm" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </Button>
    </form>
  );
}
