import { claimNextJob, completeJob, failJob, type JobRow } from "./queue";
import { handleSendEmail } from "./handlers/send-email";
import { handleSendCampaignBatch } from "./handlers/send-campaign-batch";
import { handleRunWorkflowStep } from "./handlers/run-workflow-step";

export type RunReport = {
  processed: number;
  succeeded: number;
  failed: number;
  retrying: number;
  idle: boolean;
};

// Drains the queue for up to `maxJobs` or `budgetMs`, whichever first. Returns
// a summary so the cron endpoint can log it. Any single job that throws is
// caught and marked failed — never let one bad job stop the drain.
export async function runJobs(args: {
  worker: string;
  maxJobs?: number;
  budgetMs?: number;
}): Promise<RunReport> {
  const maxJobs = args.maxJobs ?? 50;
  const budgetMs = args.budgetMs ?? 25_000;
  const start = Date.now();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let retrying = 0;

  while (processed < maxJobs && Date.now() - start < budgetMs) {
    const job = await claimNextJob(args.worker);
    if (!job) return { processed, succeeded, failed, retrying, idle: true };

    processed++;
    try {
      const outcome = await dispatch(job);
      if (outcome.ok) {
        await completeJob(job.id);
        succeeded++;
      } else {
        await failJob(job.id, outcome.error, outcome.retryable);
        if (outcome.retryable) retrying++;
        else failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await failJob(job.id, msg, true);
      retrying++;
    }
  }

  return { processed, succeeded, failed, retrying, idle: false };
}

type Dispatched =
  | { ok: true }
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

async function dispatch(job: JobRow): Promise<Dispatched> {
  switch (job.kind) {
    case "send_email":
      return handleSendEmail(job);
    case "send_campaign_batch":
      return handleSendCampaignBatch(job);
    case "run_workflow_step":
      return handleRunWorkflowStep(job);
    default:
      return { ok: false, error: `unknown job kind: ${job.kind as string}`, retryable: false };
  }
}
