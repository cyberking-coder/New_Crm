"use client";

import { useActionState, useId, useRef, useEffect } from "react";
import { addNoteAction, type ActionState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addNoteAction.bind(null, leadId),
    undefined,
  );
  const ref = useRef<HTMLFormElement | null>(null);

  // Clear the textarea after a successful add.
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-body`}>Note</Label>
        <Textarea
          id={`${idp}-body`}
          name="body"
          rows={4}
          placeholder="Call summary, context, meeting notes…"
          required
        />
        {state?.fieldErrors?.body ? (
          <p className="text-xs text-destructive">{state.fieldErrors.body}</p>
        ) : null}
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {state?.ok ? <span className="text-xs text-emerald-600">{state.ok}</span> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
