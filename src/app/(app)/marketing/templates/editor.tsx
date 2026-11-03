"use client";

import { useActionState, useId, useState } from "react";
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
  type ActionState,
} from "./actions";
import { extractVariables } from "@/lib/email/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Initial = {
  name: string;
  slug: string;
  subject: string;
  html: string;
  text: string;
  from_name: string;
  from_email: string;
  reply_to: string;
};

export function TemplateEditor(
  props:
    | { mode: "create"; initial: Initial }
    | { mode: "edit"; templateId: string; initial: Initial },
) {
  const idp = useId();
  const [draft, setDraft] = useState<Initial>(props.initial);

  const action =
    props.mode === "edit" ? updateTemplateAction.bind(null, props.templateId) : createTemplateAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  const vars = Array.from(
    new Set([
      ...extractVariables(draft.subject),
      ...extractVariables(draft.html),
      ...extractVariables(draft.text),
    ]),
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idp}-n`}>Name</Label>
          <Input id={`${idp}-n`} name="name" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-s`}>Slug</Label>
          <Input id={`${idp}-s`} name="slug" value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })} required />
          {state?.fieldErrors?.slug ? (
            <p className="text-xs text-destructive">{state.fieldErrors.slug}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idp}-sub`}>Subject</Label>
        <Input id={`${idp}-sub`} name="subject" value={draft.subject}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })} required />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idp}-fn`}>From name</Label>
          <Input id={`${idp}-fn`} name="from_name" value={draft.from_name}
            onChange={(e) => setDraft({ ...draft, from_name: e.target.value })} placeholder="(use connection default)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-fe`}>From email</Label>
          <Input id={`${idp}-fe`} name="from_email" type="email" value={draft.from_email}
            onChange={(e) => setDraft({ ...draft, from_email: e.target.value })} placeholder="(use connection default)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-rt`}>Reply-to</Label>
          <Input id={`${idp}-rt`} name="reply_to" type="email" value={draft.reply_to}
            onChange={(e) => setDraft({ ...draft, reply_to: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idp}-h`}>HTML body</Label>
        <Textarea
          id={`${idp}-h`}
          name="html"
          rows={12}
          value={draft.html}
          onChange={(e) => setDraft({ ...draft, html: e.target.value })}
          placeholder="<p>Hi {{name}},</p><p>Thanks for registering for {{webinar_title}}.</p>"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idp}-t`}>Plain-text body (optional)</Label>
        <Textarea
          id={`${idp}-t`}
          name="text"
          rows={5}
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        />
      </div>

      <div className="rounded-md border bg-secondary/40 p-3 text-xs">
        <div className="mb-1 font-semibold text-muted-foreground">Variables detected</div>
        {vars.length === 0 ? (
          <span className="text-muted-foreground">none yet — use {`{{name}}`} or similar</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {vars.map((v) => (
              <Badge key={v} variant="outline">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="text-sm text-emerald-600">{state.ok}</p>
      ) : null}

      <div className="flex items-center justify-between">
        {props.mode === "edit" ? (
          <form
            action={deleteTemplateAction.bind(null, props.templateId)}
            onSubmit={(e) => {
              if (!confirm("Delete this template? Any workflow or campaign using it will fail.")) {
                e.preventDefault();
              }
            }}
          >
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              Delete
            </Button>
          </form>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : props.mode === "edit" ? "Save changes" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
