"use client";

import { useActionState, useId, useRef, useEffect } from "react";
import {
  createEmailConnectionAction,
  deleteEmailConnectionAction,
  sendTestEmailAction,
  toggleEmailConnectionAction,
  type ActionState,
} from "./actions";
import type { IntegrationConnectionRow } from "@/lib/integrations/connections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ConnectEmailForm({ providers }: { providers: string[] }) {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEmailConnectionAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-dn`}>Display name</Label>
        <Input id={`${idp}-dn`} name="display_name" placeholder="Resend — primary" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-pv`}>Provider</Label>
        <Select id={`${idp}-pv`} name="provider" defaultValue={providers[0]}>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-ak`}>API key</Label>
        <Input id={`${idp}-ak`} name="api_key" type="password" placeholder="re_..." required />
        {state?.fieldErrors?.api_key ? (
          <p className="text-xs text-destructive">{state.fieldErrors.api_key}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idp}-fn`}>From name</Label>
          <Input id={`${idp}-fn`} name="from_name" placeholder="Acme Webinars" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-fe`}>From email</Label>
          <Input id={`${idp}-fe`} name="from_email" type="email" placeholder="hello@acme.com" required />
          {state?.fieldErrors?.from_email ? (
            <p className="text-xs text-destructive">{state.fieldErrors.from_email}</p>
          ) : null}
        </div>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="text-sm text-emerald-600">{state.ok}</p>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect"}
      </Button>
      <p className="text-xs text-muted-foreground">
        The API key is stored server-side only. Verify the domain in Resend first for best deliverability.
      </p>
    </form>
  );
}

export function ConnectionActions({ connection }: { connection: IntegrationConnectionRow }) {
  const toggle = toggleEmailConnectionAction.bind(null, connection.id, !connection.is_active);
  const remove = deleteEmailConnectionAction.bind(null, connection.id);
  return (
    <div className="flex items-center gap-2">
      <form action={toggle}>
        <Button type="submit" variant="outline" size="sm">
          {connection.is_active ? "Pause" : "Resume"}
        </Button>
      </form>
      <form
        action={remove}
        onSubmit={(e) => {
          if (!confirm("Delete this connection? Pending sends will fail.")) e.preventDefault();
        }}
      >
        <Button type="submit" variant="destructive" size="sm">
          Delete
        </Button>
      </form>
    </div>
  );
}

export function TestSendForm() {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sendTestEmailAction,
    undefined,
  );
  const ref = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor={`${idp}-to`}>To</Label>
        <Input id={`${idp}-to`} name="to" type="email" required placeholder="you@example.com" />
        {state?.fieldErrors?.to ? (
          <p className="text-xs text-destructive">{state.fieldErrors.to}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Queuing…" : "Send test"}
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
