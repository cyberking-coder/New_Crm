import { createServiceClient } from "@/lib/supabase/server";
import { startWorkflowRun } from "@/lib/jobs/handlers/run-workflow-step";

type Trigger = "registrant_created" | "attendance_recorded" | "lead_scored";

export async function fireTrigger(args: {
  organizationId: string;
  trigger: Trigger;
  entityType: string;
  entityId: string;
  context: Record<string, unknown>;
}): Promise<void> {
  const service = createServiceClient();
  const { data } = await service
    .from("automation_workflows")
    .select("id,trigger_config")
    .eq("organization_id", args.organizationId)
    .eq("trigger", args.trigger)
    .eq("status", "active");

  const workflows = (data ?? []) as { id: string; trigger_config: Record<string, unknown> }[];
  if (workflows.length === 0) return;

  // Filter by trigger_config.webinar_id when the context carries one.
  const ctxWebinarId = typeof args.context.webinar_id === "string" ? args.context.webinar_id : null;

  for (const w of workflows) {
    const needed =
      typeof w.trigger_config?.webinar_id === "string" ? w.trigger_config.webinar_id : null;
    if (needed && needed !== ctxWebinarId) continue;

    try {
      await startWorkflowRun({
        organizationId: args.organizationId,
        workflowId: w.id,
        triggerEntityType: args.entityType,
        triggerEntityId: args.entityId,
        context: args.context,
      });
    } catch (err) {
      // Workflows must never block the originating action.
      console.error(`fireTrigger ${args.trigger} failed for workflow ${w.id}:`, err);
    }
  }
}
