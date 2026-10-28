"use client";

import { useTransition } from "react";
import { addBlockAction } from "./actions";
import type { BlockKind } from "@/lib/landing/blocks";
import { Button } from "@/components/ui/button";

export function AddBlockMenu({
  webinarId,
  kinds,
  labels,
}: {
  webinarId: string;
  kinds: readonly BlockKind[];
  labels: Record<BlockKind, string>;
}) {
  const [pending, start] = useTransition();

  const add = (kind: BlockKind) => {
    start(async () => {
      await addBlockAction(webinarId, kind);
    });
  };

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Add a block
      </div>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Button
            key={k}
            variant="outline"
            size="sm"
            type="button"
            disabled={pending}
            onClick={() => add(k)}
          >
            + {labels[k]}
          </Button>
        ))}
      </div>
    </div>
  );
}
