"use client";

import { useActionState, useId } from "react";
import { updateLandingPageAction, type ActionState } from "../actions";
import type { LandingPageRow } from "@/lib/webinars/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LandingPageForm({
  webinarId,
  landing,
}: {
  webinarId: string;
  landing: LandingPageRow;
}) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateLandingPageAction.bind(null, webinarId),
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-head`}>Headline</Label>
        <Input id={`${idp}-head`} name="headline" defaultValue={landing.headline} required />
        {state?.fieldErrors?.headline ? (
          <p className="text-xs text-destructive">{state.fieldErrors.headline}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-sub`}>Subheadline</Label>
        <Input id={`${idp}-sub`} name="subheadline" defaultValue={landing.subheadline ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-body`}>Body</Label>
        <Textarea
          id={`${idp}-body`}
          name="body_md"
          rows={4}
          defaultValue={landing.body_md ?? ""}
          placeholder="Describe what attendees will learn."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idp}-cta`}>CTA label</Label>
          <Input id={`${idp}-cta`} name="cta_label" defaultValue={landing.cta_label} required />
        </div>
        <label className="flex items-end gap-2 pb-1 text-sm">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={landing.is_published}
            className="h-4 w-4 rounded border-input"
          />
          Publish
        </label>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save landing page"}
        </Button>
      </div>
    </form>
  );
}
