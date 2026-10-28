"use client";

import { useActionState, useId, useState } from "react";
import { createApiKeyAction, revokeApiKeyAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateKeyForm() {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createApiKeyAction,
    undefined,
  );
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // ignore
    }
  };

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1">
          <Label htmlFor={`${idp}-name`}>Key name</Label>
          <Input
            id={`${idp}-name`}
            name="name"
            required
            placeholder="e.g. Zapier integration"
          />
          {state?.fieldErrors?.name ? (
            <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create key"}
        </Button>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.createdKey ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="mb-1 font-semibold text-emerald-900">
            Save this key now — it will not be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs">
              {state.createdKey}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy(state.createdKey!)}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function RevokeKeyButton({ keyId }: { keyId: string }) {
  const action = revokeApiKeyAction.bind(null, keyId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Revoke this key? Any client using it will immediately lose access.")) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" size="sm" variant="ghost" className="text-destructive">
        Revoke
      </Button>
    </form>
  );
}
