"use client";

import { useActionState, useId } from "react";
import { createWebinarConnectionAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ConnectForm({ providers }: { providers: string[] }) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createWebinarConnectionAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-provider`}>Provider</Label>
        <Select id={`${idp}-provider`} name="provider" defaultValue={providers[0]}>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p[0]!.toUpperCase() + p.slice(1)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-name`}>Display name</Label>
        <Input
          id={`${idp}-name`}
          name="display_name"
          placeholder="e.g. Zoom — primary"
          required
          minLength={2}
          maxLength={80}
        />
        {state?.fieldErrors?.display_name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.display_name}</p>
        ) : null}
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add connection"}
      </Button>
    </form>
  );
}
