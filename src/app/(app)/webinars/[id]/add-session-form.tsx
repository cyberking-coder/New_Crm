"use client";

import { useActionState, useId } from "react";
import { addSessionAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddSessionForm({ webinarId }: { webinarId: string }) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addSessionAction.bind(null, webinarId),
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 border-t pt-4">
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor={`${idp}-when`}>Start</Label>
        <Input id={`${idp}-when`} type="datetime-local" name="scheduled_at" required />
        {state?.fieldErrors?.scheduled_at ? (
          <p className="text-xs text-destructive">{state.fieldErrors.scheduled_at}</p>
        ) : null}
      </div>
      <div className="w-32 space-y-1">
        <Label htmlFor={`${idp}-dur`}>Duration</Label>
        <Input
          id={`${idp}-dur`}
          type="number"
          name="duration_minutes"
          defaultValue={60}
          min={1}
          max={1440}
          required
        />
        {state?.fieldErrors?.duration_minutes ? (
          <p className="text-xs text-destructive">{state.fieldErrors.duration_minutes}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add session"}
      </Button>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
