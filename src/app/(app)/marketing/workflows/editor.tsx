"use client";

import { useActionState, useId, useState } from "react";
import { saveWorkflowAction, deleteWorkflowAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Step =
  | { type: "send_email"; template_id: string; subject_tag?: string }
  | { type: "wait"; minutes: number }
  | { type: "create_task"; title: string; priority?: "low" | "medium" | "high" | "urgent"; due_in_minutes?: number }
  | { type: "update_lead"; stage_key: string };

type Initial = {
  id: string | null;
  name: string;
  trigger: "registrant_created" | "attendance_recorded" | "lead_scored" | "manual";
  status: "draft" | "active" | "paused";
  trigger_config: Record<string, unknown>;
  steps: Step[];
};

export function WorkflowEditor({
  initial,
  templates,
}: {
  initial: Initial;
  templates: { id: string; name: string }[];
}) {
  const idp = useId();
  const [draft, setDraft] = useState<Initial>(initial);

  const action = saveWorkflowAction.bind(null, initial.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  const addStep = (s: Step) => setDraft({ ...draft, steps: [...draft.steps, s] });
  const updateStep = (i: number, s: Step) => {
    const copy = draft.steps.slice();
    copy[i] = s;
    setDraft({ ...draft, steps: copy });
  };
  const removeStep = (i: number) =>
    setDraft({ ...draft, steps: draft.steps.filter((_, idx) => idx !== i) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.steps.length) return;
    const copy = draft.steps.slice();
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
    setDraft({ ...draft, steps: copy });
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="steps_json" value={JSON.stringify(draft.steps)} />
      <input type="hidden" name="trigger_config_json" value={JSON.stringify(draft.trigger_config)} />

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`${idp}-n`}>Name</Label>
          <Input id={`${idp}-n`} name="name" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idp}-s`}>Status</Label>
          <Select id={`${idp}-s`} name="status" value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as Initial["status"] })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idp}-t`}>Trigger</Label>
        <Select id={`${idp}-t`} name="trigger" value={draft.trigger}
          onChange={(e) => setDraft({ ...draft, trigger: e.target.value as Initial["trigger"] })}>
          <option value="registrant_created">A registrant signs up</option>
          <option value="attendance_recorded">Attendance is recorded</option>
          <option value="lead_scored">A lead gets scored</option>
          <option value="manual">Manual only</option>
        </Select>
        <p className="text-xs text-muted-foreground">
          Context passed to steps: {`{{email}}`}, {`{{name}}`}, {`{{company}}`}, {`{{webinar_title}}`}, {`{{lead_id}}`}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Steps</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                addStep({
                  type: "send_email",
                  template_id: templates[0]?.id ?? "",
                })
              }
            >
              + Send email
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addStep({ type: "wait", minutes: 60 })}>
              + Wait
            </Button>
            <Button type="button" size="sm" variant="outline"
              onClick={() => addStep({ type: "create_task", title: "Follow up", priority: "medium" })}>
              + Create task
            </Button>
            <Button type="button" size="sm" variant="outline"
              onClick={() => addStep({ type: "update_lead", stage_key: "qualified" })}>
              + Update lead
            </Button>
          </div>
        </div>

        {draft.steps.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Add a step above.
          </p>
        ) : (
          <ol className="space-y-2">
            {draft.steps.map((s, i) => (
              <li key={i} className="rounded-md border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded border px-2 py-0.5 font-mono text-xs">{i + 1}. {s.type}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)}>↑</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)}>↓</Button>
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeStep(i)}>Remove</Button>
                  </div>
                </div>
                <StepFields step={s} onChange={(next) => updateStep(i, next)} templates={templates} />
              </li>
            ))}
          </ol>
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
        {initial.id ? (
          <form
            action={deleteWorkflowAction.bind(null, initial.id)}
            onSubmit={(e) => {
              if (!confirm("Delete this workflow? Pending runs will not continue.")) e.preventDefault();
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
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create workflow"}
        </Button>
      </div>
    </form>
  );
}

function StepFields({
  step,
  onChange,
  templates,
}: {
  step: Step;
  onChange: (next: Step) => void;
  templates: { id: string; name: string }[];
}) {
  if (step.type === "send_email") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Template</Label>
          <Select value={step.template_id} onChange={(e) => onChange({ ...step, template_id: e.target.value })}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tag (optional)</Label>
          <Input value={step.subject_tag ?? ""} onChange={(e) => onChange({ ...step, subject_tag: e.target.value })} />
        </div>
      </div>
    );
  }
  if (step.type === "wait") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Minutes</Label>
        <Input type="number" min={1} max={43200} value={step.minutes}
          onChange={(e) => onChange({ ...step, minutes: Number(e.target.value) })} />
      </div>
    );
  }
  if (step.type === "create_task") {
    return (
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <Select
            value={step.priority ?? "medium"}
            onChange={(e) =>
              onChange({
                ...step,
                priority: e.target.value as "low" | "medium" | "high" | "urgent",
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
      </div>
    );
  }
  if (step.type === "update_lead") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Stage key</Label>
        <Input value={step.stage_key} placeholder="qualified | meeting | proposal | won | lost"
          onChange={(e) => onChange({ ...step, stage_key: e.target.value })} />
      </div>
    );
  }
  return null;
}
