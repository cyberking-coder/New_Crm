"use client";

import { useState } from "react";
import {
  deleteBlockAction,
  moveBlockAction,
  toggleBlockVisibilityAction,
} from "./actions";
import type { AnyBlock, BlockKind } from "@/lib/landing/blocks";
import { BLOCK_LABELS } from "@/lib/landing/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "./block-editor";

export function BlockRow({
  webinarId,
  block,
  isFirst,
  isLast,
}: {
  webinarId: string;
  block: AnyBlock;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);

  const moveUp = moveBlockAction.bind(null, webinarId, block.id, "up");
  const moveDown = moveBlockAction.bind(null, webinarId, block.id, "down");
  const toggle = toggleBlockVisibilityAction.bind(null, webinarId, block.id);
  const remove = deleteBlockAction.bind(null, webinarId, block.id);

  return (
    <li className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {block.position + 1}
          </span>
          <span className="font-medium">{BLOCK_LABELS[block.kind as BlockKind]}</span>
          {block.is_hidden ? <Badge variant="secondary">Hidden</Badge> : null}
          <span className="truncate text-xs text-muted-foreground">
            {summarize(block.kind as BlockKind, block.data)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <form action={moveUp}>
            <Button type="submit" size="sm" variant="ghost" disabled={isFirst}>
              ↑
            </Button>
          </form>
          <form action={moveDown}>
            <Button type="submit" size="sm" variant="ghost" disabled={isLast}>
              ↓
            </Button>
          </form>
          <form action={toggle}>
            <Button type="submit" size="sm" variant="ghost">
              {block.is_hidden ? "Show" : "Hide"}
            </Button>
          </form>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Edit"}
          </Button>
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm("Delete this block?")) e.preventDefault();
            }}
          >
            <Button type="submit" size="sm" variant="ghost" className="text-destructive">
              Delete
            </Button>
          </form>
        </div>
      </div>
      {open ? (
        <div className="border-t p-4">
          <BlockEditor
            webinarId={webinarId}
            block={block}
            onDone={() => setOpen(false)}
          />
        </div>
      ) : null}
    </li>
  );
}

function summarize(kind: BlockKind, data: Record<string, unknown>): string {
  switch (kind) {
    case "hero":
    case "cta":
      return String(data.heading ?? "");
    case "rich_text":
      return String(data.body ?? "").slice(0, 80);
    case "bullets":
      return `${(data.items as unknown[] | undefined)?.length ?? 0} items`;
    case "video":
      return String(data.url ?? "");
    case "logos":
      return `${(data.logos as unknown[] | undefined)?.length ?? 0} logos`;
    case "testimonial":
      return String(data.author ?? "");
    case "faq":
      return `${(data.items as unknown[] | undefined)?.length ?? 0} questions`;
    case "image":
      return String(data.alt ?? "");
    case "countdown":
      return String(data.target_iso ?? "uses next session");
    case "form_anchor":
      return "Registration form renders here";
    default:
      return "";
  }
}
