"use client";

import { useActionState, useId, useRef, useEffect } from "react";
import { createContactAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddContactForm() {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createContactAction,
    undefined,
  );
  const ref = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={ref} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-e`}>Email</Label>
        <Input id={`${idp}-e`} name="email" type="email" required />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-n`}>Name</Label>
        <Input id={`${idp}-n`} name="full_name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-t`}>Title</Label>
        <Input id={`${idp}-t`} name="title" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-c`}>Company</Label>
        <Input id={`${idp}-c`} name="company_name" placeholder="Acme Co" />
      </div>
      <div className="md:col-span-4 flex items-center justify-between">
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : state?.ok ? (
          <p className="text-sm text-emerald-600">{state.ok}</p>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add contact"}
        </Button>
      </div>
    </form>
  );
}
