"use client";

import { useActionState, useState } from "react";
import {
  installPluginAction,
  uninstallPluginAction,
  togglePluginAction,
  savePluginConfigAction,
  type ActionState,
} from "./actions";
import type { PluginDefinition } from "@/lib/plugins/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Installed = { enabled: boolean; config: Record<string, unknown>; installed_at: string };

export function PluginCard({
  plugin,
  installed,
}: {
  plugin: PluginDefinition;
  installed: Installed | null;
}) {
  const [open, setOpen] = useState(false);

  const install = installPluginAction.bind(null, plugin.slug);
  const uninstall = uninstallPluginAction.bind(null, plugin.slug);
  const toggle = togglePluginAction.bind(null, plugin.slug, !(installed?.enabled ?? true));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{plugin.name}</span>
              <Badge variant="outline" className="uppercase">
                {plugin.category}
              </Badge>
              {installed ? (
                <Badge variant={installed.enabled ? "success" : "secondary"}>
                  {installed.enabled ? "Enabled" : "Paused"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plugin.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plugin.author} · v{plugin.version}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!installed ? (
              <form action={install}>
                <Button type="submit" size="sm">
                  Install
                </Button>
              </form>
            ) : (
              <>
                {plugin.configFields && plugin.configFields.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setOpen((v) => !v)}
                  >
                    {open ? "Close" : "Configure"}
                  </Button>
                ) : null}
                <form action={toggle}>
                  <Button type="submit" size="sm" variant="ghost">
                    {installed.enabled ? "Pause" : "Enable"}
                  </Button>
                </form>
                <form
                  action={uninstall}
                  onSubmit={(e) => {
                    if (!confirm(`Uninstall ${plugin.name}? Its config will be deleted.`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                    Remove
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {installed && open ? (
          <div className="mt-4 border-t pt-4">
            <ConfigForm plugin={plugin} initial={installed.config} onDone={() => setOpen(false)} />
          </div>
        ) : null}

        {!installed ? (
          <p className="mt-3 text-xs text-muted-foreground">{plugin.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ConfigForm({
  plugin,
  initial,
  onDone,
}: {
  plugin: PluginDefinition;
  initial: Record<string, unknown>;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePluginConfigAction.bind(null, plugin.slug),
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      {plugin.configFields?.map((f) => {
        const v = initial[f.key];
        const str = typeof v === "string" ? v : v == null ? "" : String(v);
        const err = state?.fieldErrors?.[f.key];
        return (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`cfg-${plugin.slug}-${f.key}`}>{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                id={`cfg-${plugin.slug}-${f.key}`}
                name={f.key}
                defaultValue={str}
                placeholder={f.placeholder}
                rows={5}
                required={f.required}
              />
            ) : f.type === "boolean" ? (
              <input
                id={`cfg-${plugin.slug}-${f.key}`}
                type="checkbox"
                name={f.key}
                defaultChecked={Boolean(v)}
                className="h-4 w-4 rounded border-input"
              />
            ) : (
              <Input
                id={`cfg-${plugin.slug}-${f.key}`}
                type={f.type === "secret" ? "password" : f.type === "number" ? "number" : "text"}
                name={f.key}
                defaultValue={str}
                placeholder={f.placeholder}
                required={f.required}
              />
            )}
            {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
            {err ? <p className="text-xs text-destructive">{err}</p> : null}
          </div>
        );
      })}
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="text-sm text-emerald-600">Saved.</p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Close
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
