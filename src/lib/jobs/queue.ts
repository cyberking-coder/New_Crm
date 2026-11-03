import { createServiceClient } from "@/lib/supabase/server";

export type JobKind = "send_email" | "run_workflow_step" | "send_campaign_batch";

export type JobRow = {
  id: string;
  organization_id: string | null;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  run_at: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  idempotency_key: string | null;
};

export async function enqueueJob(args: {
  organizationId: string | null;
  kind: JobKind;
  payload: Record<string, unknown>;
  runAt?: Date;
  priority?: number;
  idempotencyKey?: string;
}): Promise<{ id: string | null }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("jobs")
    .insert({
      organization_id: args.organizationId,
      kind: args.kind,
      payload: args.payload,
      priority: args.priority ?? 100,
      run_at: (args.runAt ?? new Date()).toISOString(),
      idempotency_key: args.idempotencyKey ?? null,
    })
    .select("id")
    .single();

  // Idempotency clash is fine — treat as "already enqueued".
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { id: null };
    throw new Error(`enqueueJob: ${error.message}`);
  }
  return { id: (data as { id: string }).id };
}

export async function claimNextJob(worker: string): Promise<JobRow | null> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("claim_next_job", { worker });
  if (error) throw new Error(`claimNextJob: ${error.message}`);
  if (!data) return null;
  // The RPC returns a row even when nothing was claimed; detect that by missing id.
  const row = data as JobRow | null;
  if (!row || !row.id) return null;
  return row;
}

export async function completeJob(id: string): Promise<void> {
  const service = createServiceClient();
  await service
    .from("jobs")
    .update({ status: "completed", locked_at: null, locked_by: null })
    .eq("id", id);
}

export async function failJob(id: string, error: string, retryable: boolean): Promise<void> {
  const service = createServiceClient();
  const { data } = await service
    .from("jobs")
    .select("attempts,max_attempts")
    .eq("id", id)
    .maybeSingle();
  const info = data as { attempts: number; max_attempts: number } | null;
  const done = !info || !retryable || info.attempts >= info.max_attempts;

  if (done) {
    await service
      .from("jobs")
      .update({
        status: "failed",
        last_error: error,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", id);
    return;
  }
  // Exponential backoff with jitter: 30s * 2^attempts, capped at 1 hour.
  const base = Math.min(3600, 30 * 2 ** Math.max(0, info.attempts - 1));
  const jitter = Math.floor(Math.random() * 15);
  const nextRun = new Date(Date.now() + (base + jitter) * 1000);
  await service
    .from("jobs")
    .update({
      status: "pending",
      last_error: error,
      run_at: nextRun.toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", id);
}
