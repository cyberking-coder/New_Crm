import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob } from "../queue";
import type { JobRow } from "../queue";

const payloadSchema = z.object({
  run_id: z.string().uuid(),
});

type Step =
  | { type: "send_email"; template_id: string; subject_tag?: string }
  | { type: "wait"; minutes: number }
  | { type: "create_task"; title: string; priority?: "low" | "medium" | "high" | "urgent"; due_in_minutes?: number }
  | { type: "update_lead"; stage_key?: string };

type RunRow = {
  id: string;
  organization_id: string;
  workflow_id: string;
  current_step: number;
  context: Record<string, unknown>;
  log: unknown[];
};

type WorkflowRow = {
  id: string;
  organization_id: string;
  status: "draft" | "active" | "paused";
  steps: unknown;
};

export type Outcome = { ok: true } | { ok: false; error: string; retryable: boolean };

export async function handleRunWorkflowStep(job: JobRow): Promise<Outcome> {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    return { ok: false, error: `invalid payload: ${parsed.error.message}`, retryable: false };
  }
  const service = createServiceClient();

  const { data: runRow } = await service
    .from("automation_runs")
    .select("id,organization_id,workflow_id,current_step,context,log")
    .eq("id", parsed.data.run_id)
    .maybeSingle();
  const run = runRow as RunRow | null;
  if (!run) return { ok: false, error: "run missing", retryable: false };

  const { data: workflowRow } = await service
    .from("automation_workflows")
    .select("id,organization_id,status,steps")
    .eq("id", run.workflow_id)
    .maybeSingle();
  const workflow = workflowRow as WorkflowRow | null;
  if (!workflow) return { ok: false, error: "workflow missing", retryable: false };
  if (workflow.status === "paused") {
    await service
      .from("automation_runs")
      .update({ status: "skipped", completed_at: new Date().toISOString() })
      .eq("id", run.id);
    return { ok: true };
  }

  const steps = (Array.isArray(workflow.steps) ? workflow.steps : []) as Step[];
  const idx = run.current_step;
  if (idx >= steps.length) {
    await service
      .from("automation_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", run.id);
    return { ok: true };
  }

  const step = steps[idx];
  if (!step) {
    return { ok: false, error: `step ${idx} missing`, retryable: false };
  }
  const logEntry = {
    step_index: idx,
    type: step.type,
    at: new Date().toISOString(),
  };

  try {
    if (step.type === "send_email") {
      const to = String((run.context as { email?: string }).email ?? "");
      if (!to) throw new Error("workflow context missing `email`");
      await enqueueJob({
        organizationId: run.organization_id,
        kind: "send_email",
        payload: {
          template_id: step.template_id,
          to,
          variables: run.context,
          lead_id: (run.context as { lead_id?: string }).lead_id,
          tag: step.subject_tag ?? `workflow:${run.workflow_id}`,
        },
        idempotencyKey: `workflow-send:${run.id}:${idx}`,
      });
    } else if (step.type === "wait") {
      const nextAt = new Date(Date.now() + Math.max(1, step.minutes) * 60_000);
      await service
        .from("automation_runs")
        .update({
          current_step: idx + 1,
          log: [...(run.log ?? []), { ...logEntry, waited_minutes: step.minutes }],
        })
        .eq("id", run.id);
      await enqueueJob({
        organizationId: run.organization_id,
        kind: "run_workflow_step",
        payload: { run_id: run.id },
        runAt: nextAt,
        idempotencyKey: `workflow-step:${run.id}:${idx + 1}`,
      });
      return { ok: true };
    } else if (step.type === "create_task") {
      const dueAt = step.due_in_minutes
        ? new Date(Date.now() + step.due_in_minutes * 60_000).toISOString()
        : null;
      await service.from("sales_tasks").insert({
        organization_id: run.organization_id,
        lead_id: (run.context as { lead_id?: string }).lead_id ?? null,
        title: step.title,
        priority: step.priority ?? "medium",
        due_at: dueAt,
      });
    } else if (step.type === "update_lead") {
      const leadId = (run.context as { lead_id?: string }).lead_id;
      if (leadId && step.stage_key) {
        const { data: stage } = await service
          .from("pipeline_stages")
          .select("id")
          .eq("organization_id", run.organization_id)
          .eq("key", step.stage_key)
          .maybeSingle();
        const stageId = (stage as { id: string } | null)?.id;
        if (stageId) {
          await service.from("leads").update({ stage_id: stageId }).eq("id", leadId);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await service
      .from("automation_runs")
      .update({
        status: "failed",
        error: msg,
        completed_at: new Date().toISOString(),
        log: [...(run.log ?? []), { ...logEntry, error: msg }],
      })
      .eq("id", run.id);
    return { ok: false, error: msg, retryable: false };
  }

  // Advance and immediately queue the next step. (The `wait` branch returned
  // above after enqueuing a delayed step; we only get here for other types.)
  await service
    .from("automation_runs")
    .update({ current_step: idx + 1, log: [...(run.log ?? []), logEntry] })
    .eq("id", run.id);
  await enqueueJob({
    organizationId: run.organization_id,
    kind: "run_workflow_step",
    payload: { run_id: run.id },
    idempotencyKey: `workflow-step:${run.id}:${idx + 1}`,
  });

  return { ok: true };
}

// Public helper: start a workflow run from a trigger event.
export async function startWorkflowRun(args: {
  organizationId: string;
  workflowId: string;
  triggerEntityType: string;
  triggerEntityId: string;
  context: Record<string, unknown>;
}): Promise<void> {
  const service = createServiceClient();
  const { data: inserted, error } = await service
    .from("automation_runs")
    .insert({
      organization_id: args.organizationId,
      workflow_id: args.workflowId,
      trigger_entity_type: args.triggerEntityType,
      trigger_entity_id: args.triggerEntityId,
      status: "running",
      started_at: new Date().toISOString(),
      context: args.context,
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "could not start run");
  const runId = (inserted as { id: string }).id;
  await enqueueJob({
    organizationId: args.organizationId,
    kind: "run_workflow_step",
    payload: { run_id: runId },
    idempotencyKey: `workflow-step:${runId}:0`,
  });
}
