"use client";

import { useState, useTransition } from "react";
import { scoreRegistrantAction } from "../../sales/actions";
import { Button } from "@/components/ui/button";

export function ScoreButton({ registrantId }: { registrantId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      {msg ? <span className="text-xs text-emerald-600">{msg}</span> : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await scoreRegistrantAction(registrantId);
            if (res?.error) setMsg(res.error);
            else if (res?.ok) setMsg(res.ok);
          });
        }}
      >
        {pending ? "Scoring…" : "AI score"}
      </Button>
    </div>
  );
}
