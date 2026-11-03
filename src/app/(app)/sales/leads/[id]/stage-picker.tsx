"use client";

import { useTransition } from "react";
import { moveLeadStageAction } from "../../actions";
import type { Stage } from "@/lib/crm/queries";
import { Select } from "@/components/ui/select";

export function StagePicker({
  leadId,
  stageId,
  stages,
}: {
  leadId: string;
  stageId: string | null;
  stages: Stage[];
}) {
  const [pending, start] = useTransition();

  return (
    <Select
      value={stageId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        if (!next || next === stageId) return;
        start(async () => {
          await moveLeadStageAction(leadId, next);
        });
      }}
    >
      <option value="" disabled>
        Select stage
      </option>
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </Select>
  );
}
