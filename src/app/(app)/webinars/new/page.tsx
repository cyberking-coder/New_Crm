"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createWebinarAction, type ActionState } from "../actions";
import { WEBINAR_TYPES } from "@/lib/webinars/schemas";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function NewWebinarPage() {
  const router = useRouter();
  const idPrefix = useId();
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createWebinarAction,
    undefined,
  );
  const [, startTransition] = useTransition();

  const derivedSlug = slugTouched ? slug : slugify(title);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Create webinar"
        description="You can edit details, add sessions, and publish the landing page afterwards."
      />
      <Card>
        <CardContent className="pt-6">
          <form
            action={(fd) => {
              fd.set("slug", derivedSlug);
              startTransition(() => formAction(fd));
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-title`}>Title</Label>
              <Input
                id={`${idPrefix}-title`}
                name="title"
                required
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {state?.fieldErrors?.title ? (
                <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
              <Input
                id={`${idPrefix}-slug`}
                name="slug"
                required
                value={derivedSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="e.g. launch-webinar-q1"
              />
              <p className="text-xs text-muted-foreground">
                Unique within your organization. Used in the registration URL.
              </p>
              {state?.fieldErrors?.slug ? (
                <p className="text-xs text-destructive">{state.fieldErrors.slug}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-type`}>Type</Label>
                <Select id={`${idPrefix}-type`} name="type" defaultValue="live">
                  {WEBINAR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t[0]!.toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-tz`}>Timezone</Label>
                <Input
                  id={`${idPrefix}-tz`}
                  name="timezone"
                  defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
                  required
                />
                {state?.fieldErrors?.timezone ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.timezone}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-host`}>Host name (optional)</Label>
              <Input id={`${idPrefix}-host`} name="host_name" maxLength={140} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-desc`}>Description (optional)</Label>
              <Textarea id={`${idPrefix}-desc`} name="description" rows={4} maxLength={4000} />
            </div>

            <fieldset className="rounded-md border bg-secondary/30 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                First session (optional)
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-start`}>Start</Label>
                  <Input
                    id={`${idPrefix}-start`}
                    type="datetime-local"
                    name="session_scheduled_at"
                  />
                  {state?.fieldErrors?.session_scheduled_at ? (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.session_scheduled_at}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-dur`}>Duration (minutes)</Label>
                  <Input
                    id={`${idPrefix}-dur`}
                    type="number"
                    min={1}
                    max={1440}
                    name="session_duration_minutes"
                    defaultValue={60}
                  />
                </div>
              </div>
            </fieldset>

            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => router.push("/webinars")}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create webinar"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              <Link href="/webinars" className="text-primary hover:underline">
                Back to all webinars
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
