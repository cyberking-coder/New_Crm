"use client";

import { useActionState, useId } from "react";
import { updateWebinarAction, deleteWebinarAction, type ActionState } from "../actions";
import { WEBINAR_STATUSES, WEBINAR_TYPES } from "@/lib/webinars/schemas";
import type { WebinarRow } from "@/lib/webinars/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

export function WebinarEditForm({ webinar }: { webinar: WebinarRow }) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateWebinarAction.bind(null, webinar.id),
    undefined,
  );

  const deleteAction = deleteWebinarAction.bind(null, webinar.id);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${idp}-title`}>Title</Label>
          <Input id={`${idp}-title`} name="title" defaultValue={webinar.title} required />
          {state?.fieldErrors?.title ? (
            <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${idp}-slug`}>Slug</Label>
            <Input id={`${idp}-slug`} name="slug" defaultValue={webinar.slug} required />
            {state?.fieldErrors?.slug ? (
              <p className="text-xs text-destructive">{state.fieldErrors.slug}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idp}-tz`}>Timezone</Label>
            <Input id={`${idp}-tz`} name="timezone" defaultValue={webinar.timezone} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${idp}-type`}>Type</Label>
            <Select id={`${idp}-type`} name="type" defaultValue={webinar.type}>
              {WEBINAR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0]!.toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idp}-status`}>Status</Label>
            <Select id={`${idp}-status`} name="status" defaultValue={webinar.status}>
              {WEBINAR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0]!.toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idp}-host`}>Host</Label>
          <Input id={`${idp}-host`} name="host_name" defaultValue={webinar.host_name ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idp}-desc`}>Description</Label>
          <Textarea
            id={`${idp}-desc`}
            name="description"
            rows={4}
            defaultValue={webinar.description ?? ""}
          />
        </div>

        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "Delete this webinar and all its sessions and registrants? This cannot be undone.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <Button variant="destructive" size="sm" type="submit">
          Delete webinar
        </Button>
      </form>
    </div>
  );
}
