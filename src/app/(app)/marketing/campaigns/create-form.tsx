"use client";

import { useActionState, useId, useState } from "react";
import { createCampaignAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function CreateCampaignForm({
  templates,
  webinars,
}: {
  templates: { id: string; name: string }[];
  webinars: { id: string; title: string }[];
}) {
  const idp = useId();
  const [kind, setKind] = useState("all_registrants");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCampaignAction,
    undefined,
  );

  const needsWebinar = kind === "webinar_registrants" || kind === "webinar_attendees";
  const needsTier = kind === "lead_tier";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`${idp}-n`}>Name</Label>
        <Input id={`${idp}-n`} name="name" required placeholder="Launch recap — Nov" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-t`}>Template</Label>
        <Select id={`${idp}-t`} name="template_id" required>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-a`}>Audience</Label>
        <Select
          id={`${idp}-a`}
          name="audience_kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all_registrants">All registrants</option>
          <option value="all_attendees">All attendees</option>
          <option value="webinar_registrants">Registrants of a webinar</option>
          <option value="webinar_attendees">Attendees of a webinar</option>
          <option value="lead_tier">Leads of a tier</option>
        </Select>
      </div>
      {needsWebinar ? (
        <div className="space-y-1">
          <Label htmlFor={`${idp}-w`}>Webinar</Label>
          <Select id={`${idp}-w`} name="webinar_id" required={needsWebinar}>
            {webinars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {needsTier ? (
        <div className="space-y-1">
          <Label htmlFor={`${idp}-tier`}>Tier</Label>
          <Select id={`${idp}-tier`} name="tier" required={needsTier}>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </Select>
        </div>
      ) : null}
      {state?.error ? (
        <p role="alert" className="md:col-span-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}
