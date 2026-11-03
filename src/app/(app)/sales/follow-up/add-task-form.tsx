"use client";

import { useActionState, useId, useRef, useEffect } from "react";
import { createTaskAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function AddStandaloneTaskForm() {
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
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor={`${idp}-t`}>Title</Label>
        <Input id={`${idp}-t`} name="title" placeholder="e.g. Send recap to warm leads" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-d`}>Due</Label>
        <Input id={`${idp}-d`} type="datetime-local" name="due_at" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-p`}>Priority</Label>
        <Select id={`${idp}-p`} name="priority" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </Button>
      {state?.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="w-full text-sm text-emerald-600">{state.ok}</p>
      ) : null}
    </form>
  );
}
