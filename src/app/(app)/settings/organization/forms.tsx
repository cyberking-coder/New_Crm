"use client";

import { useActionState, useId, useState } from "react";
import {
  updateOrganizationAction,
  deleteOrganizationAction,
  type ActionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrgSettingsForm({
  name,
  slug,
  canEdit,
}: {
  name: string;
  slug: string;
  canEdit: boolean;
}) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateOrganizationAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-name`}>Name</Label>
        <Input id={`${idp}-name`} name="name" defaultValue={name} disabled={!canEdit} required />
        {state?.fieldErrors?.name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-slug`}>Slug</Label>
        <Input id={`${idp}-slug`} name="slug" defaultValue={slug} disabled={!canEdit} required />
        {state?.fieldErrors?.slug ? (
          <p className="text-xs text-destructive">{state.fieldErrors.slug}</p>
        ) : null}
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="text-sm text-emerald-600">Saved.</p>
      ) : null}
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function DeleteOrgForm({ slug }: { slug: string }) {
  const idp = useId();
  const [value, setValue] = useState("");
  const action = async () => {
    await deleteOrganizationAction(value);
  };
  const disabled = value !== slug;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete "${slug}" permanently? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
      className="space-y-3"
    >
      <Label htmlFor={`${idp}-c`}>
        Type <span className="font-mono">{slug}</span> to confirm
      </Label>
      <Input
        id={`${idp}-c`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={slug}
      />
      <Button type="submit" variant="destructive" disabled={disabled}>
        Delete organization
      </Button>
    </form>
  );
}
