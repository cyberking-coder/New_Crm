"use client";

import { useActionState, useState } from "react";
import { updateBlockAction, type ActionState } from "./actions";
import type { AnyBlock, BlockKind } from "@/lib/landing/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

// A per-kind form that mutates a local `data` object. On submit we serialize the
// whole object to a hidden `data_json` field — the server re-validates with Zod.
export function BlockEditor({
  webinarId,
  block,
  onDone,
}: {
  webinarId: string;
  block: AnyBlock;
  onDone: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>({ ...block.data });
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateBlockAction.bind(null, webinarId, block.id),
    undefined,
  );

  const kind = block.kind as BlockKind;

  return (
    <form
      action={(fd) => {
        fd.set("data_json", JSON.stringify(data));
        formAction(fd);
        onDone();
      }}
      className="space-y-3"
    >
      <KindFields kind={kind} data={data} setData={setData} />
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save block"}
        </Button>
      </div>
    </form>
  );
}

function KindFields({
  kind,
  data,
  setData,
}: {
  kind: BlockKind;
  data: Record<string, unknown>;
  setData: (next: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: unknown) => setData({ ...data, [k]: v });

  if (kind === "hero") {
    return (
      <>
        <TextField label="Eyebrow" value={str(data.eyebrow)} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} required />
        <TextareaField
          label="Subheading"
          value={str(data.subheading)}
          onChange={(v) => set("subheading", v)}
        />
        <SelectField
          label="Background"
          value={str(data.background) || "light"}
          onChange={(v) => set("background", v)}
          options={["light", "dark", "accent"]}
        />
      </>
    );
  }

  if (kind === "rich_text") {
    return (
      <>
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} />
        <TextareaField
          label="Body"
          value={str(data.body)}
          onChange={(v) => set("body", v)}
          rows={6}
          required
        />
      </>
    );
  }

  if (kind === "bullets") {
    const items = (data.items as { title: string; description?: string }[] | undefined) ?? [];
    return (
      <>
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} />
        <RepeaterField
          label="Items"
          items={items}
          empty={{ title: "", description: "" }}
          onChange={(next) => set("items", next)}
          render={(it, i, update) => (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={it.title}
                placeholder={`Title ${i + 1}`}
                onChange={(e) => update({ ...it, title: e.target.value })}
              />
              <Input
                value={it.description ?? ""}
                placeholder="Description (optional)"
                onChange={(e) => update({ ...it, description: e.target.value })}
              />
            </div>
          )}
        />
      </>
    );
  }

  if (kind === "video") {
    return (
      <>
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} />
        <TextField
          label="Video URL (YouTube, Vimeo, Wistia, or .mp4)"
          value={str(data.url)}
          onChange={(v) => set("url", v)}
          required
        />
      </>
    );
  }

  if (kind === "countdown") {
    return (
      <>
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} />
        <TextField
          label="Target (ISO datetime — leave empty to use the next session)"
          value={str(data.target_iso)}
          onChange={(v) => set("target_iso", v)}
          placeholder="2026-11-01T15:00:00Z"
        />
      </>
    );
  }

  if (kind === "logos") {
    const logos = (data.logos as { url: string; alt: string }[] | undefined) ?? [];
    return (
      <>
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} />
        <RepeaterField
          label="Logos"
          items={logos}
          empty={{ url: "", alt: "" }}
          onChange={(next) => set("logos", next)}
          render={(it, i, update) => (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={it.url}
                placeholder={`Logo URL ${i + 1}`}
                onChange={(e) => update({ ...it, url: e.target.value })}
              />
              <Input
                value={it.alt}
                placeholder="Alt text"
                onChange={(e) => update({ ...it, alt: e.target.value })}
              />
            </div>
          )}
        />
      </>
    );
  }

  if (kind === "testimonial") {
    return (
      <>
        <TextareaField
          label="Quote"
          value={str(data.quote)}
          onChange={(v) => set("quote", v)}
          required
        />
        <TextField label="Author" value={str(data.author)} onChange={(v) => set("author", v)} required />
        <TextField label="Role" value={str(data.role)} onChange={(v) => set("role", v)} />
        <TextField
          label="Avatar URL"
          value={str(data.avatar_url)}
          onChange={(v) => set("avatar_url", v)}
        />
      </>
    );
  }

  if (kind === "faq") {
    const items = (data.items as { q: string; a: string }[] | undefined) ?? [];
    return (
      <>
        <TextField label="Heading" value={str(data.heading)} onChange={(v) => set("heading", v)} />
        <RepeaterField
          label="Questions"
          items={items}
          empty={{ q: "", a: "" }}
          onChange={(next) => set("items", next)}
          render={(it, i, update) => (
            <div className="space-y-2">
              <Input
                value={it.q}
                placeholder={`Question ${i + 1}`}
                onChange={(e) => update({ ...it, q: e.target.value })}
              />
              <Textarea
                value={it.a}
                placeholder="Answer"
                rows={3}
                onChange={(e) => update({ ...it, a: e.target.value })}
              />
            </div>
          )}
        />
      </>
    );
  }

  if (kind === "cta") {
    return (
      <>
        <TextField
          label="Heading"
          value={str(data.heading)}
          onChange={(v) => set("heading", v)}
          required
        />
        <TextareaField
          label="Subheading"
          value={str(data.subheading)}
          onChange={(v) => set("subheading", v)}
        />
        <p className="text-xs text-muted-foreground">
          The button scrolls to <code>#register</code> — add a <strong>Registration form (anchor)</strong>{" "}
          block for the form to appear on the page.
        </p>
      </>
    );
  }

  if (kind === "image") {
    return (
      <>
        <TextField label="Image URL" value={str(data.url)} onChange={(v) => set("url", v)} required />
        <TextField label="Alt text" value={str(data.alt)} onChange={(v) => set("alt", v)} required />
        <TextField label="Caption" value={str(data.caption)} onChange={(v) => set("caption", v)} />
      </>
    );
  }

  if (kind === "form_anchor") {
    return (
      <p className="text-sm text-muted-foreground">
        No fields. The registration form renders at this position on the public page.
      </p>
    );
  }

  return null;
}

// -----------------------------------------------------------------------------
// Small field primitives
// -----------------------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  required,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    </div>
  );
}

function RepeaterField<T>({
  label,
  items,
  empty,
  onChange,
  render,
}: {
  label: string;
  items: T[];
  empty: T;
  onChange: (next: T[]) => void;
  render: (item: T, index: number, update: (next: T) => void) => React.ReactNode;
}) {
  const update = (i: number, next: T) => {
    const copy = items.slice();
    copy[i] = next;
    onChange(copy);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-md border bg-background p-2">
            {render(it, i, (next) => update(i, next))}
            <div className="mt-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => remove(i)}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { ...(empty as object) } as T])}
      >
        + Add
      </Button>
    </div>
  );
}
