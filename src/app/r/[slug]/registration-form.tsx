"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { registerAction, type RegisterState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function RegistrationForm({ slug, ctaLabel }: { slug: string; ctaLabel: string }) {
  const idp = useId();
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    undefined,
  );

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const picked: Record<string, string> = {};
      for (const k of UTM_KEYS) {
        const v = sp.get(k);
        if (v) picked[k] = v.slice(0, 120);
      }
      setUtm(picked);
    } catch {
      // ignore
    }
  }, []);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="landing_slug" value={slug} />
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      {UTM_KEYS.map((k) => (
        <input key={k} type="hidden" name={k} value={utm[k] ?? ""} />
      ))}

      <div className="space-y-1">
        <Label htmlFor={`${idp}-name`}>Full name</Label>
        <Input id={`${idp}-name`} name="full_name" required maxLength={140} autoComplete="name" />
        {state?.fieldErrors?.full_name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.full_name}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idp}-email`}>Work email</Label>
        <Input
          id={`${idp}-email`}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
        />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idp}-company`}>Company</Label>
          <Input id={`${idp}-company`} name="company" maxLength={140} autoComplete="organization" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-phone`}>Phone</Label>
          <Input id={`${idp}-phone`} name="phone" maxLength={40} autoComplete="tel" />
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="consent_marketing"
          className="mt-0.5 h-4 w-4 rounded border-input"
        />
        I agree to receive emails about this webinar and related updates.
      </label>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Registering…" : ctaLabel}
      </Button>
    </form>
  );
}
