"use client";

import { useActionState, useId } from "react";
import { addExternalRecordingAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function AddRecordingForm({
  webinars,
}: {
  webinars: { id: string; title: string }[];
}) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addExternalRecordingAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-w`}>Webinar</Label>
        <Select id={`${idp}-w`} name="webinar_id" required>
          {webinars.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-t`}>Title</Label>
        <Input id={`${idp}-t`} name="title" required maxLength={200} />
        {state?.fieldErrors?.title ? (
          <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-u`}>URL</Label>
        <Input id={`${idp}-u`} name="external_url" type="url" required placeholder="https://…" />
        {state?.fieldErrors?.external_url ? (
          <p className="text-xs text-destructive">{state.fieldErrors.external_url}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-d`}>Duration (seconds, optional)</Label>
        <Input id={`${idp}-d`} name="duration_seconds" type="number" min={0} />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add recording"}
      </Button>
    </form>
  );
}
