"use client";

import { useState, useTransition } from "react";
import { pauseCampaignAction, sendCampaignAction } from "../actions";
import { Button } from "@/components/ui/button";

export function CampaignActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const canSend = status === "draft" || status === "paused" || status === "failed";

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-emerald-600">{msg}</span> : null}
      {canSend ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("Queue this campaign for sending?")) return;
            setMsg(null);
            start(async () => {
              const res = await sendCampaignAction(campaignId);
              if (res?.error) setMsg(res.error);
              else if (res?.ok) setMsg(res.ok);
            });
          }}
        >
          {pending ? "Queuing…" : "Send"}
        </Button>
      ) : null}
      {status === "sending" || status === "scheduled" ? (
        <form action={pauseCampaignAction.bind(null, campaignId)}>
          <Button size="sm" variant="outline" type="submit">
            Pause
          </Button>
        </form>
      ) : null}
    </div>
  );
}
