"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveOrganization, requireUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { isAIConfigured, AIConfigError } from "@/lib/ai/anthropic";
import { scoreLead } from "@/lib/ai/lead-score";
import { fireTrigger } from "@/lib/automation/triggers";

export type ActionState =
  | { error?: string; ok?: string; fieldErrors?: Record<string, string> }
  | undefined;

function assertManager(role: string) {
  if (!["owner", "admin", "manager"].includes(role)) {
    throw new Error("Only owners, admins, and managers can modify leads.");
  }
}

type Registrant = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  webinar_id: string;
};

async function loadRegistrantSignals(
  service: ReturnType<typeof createServiceClient>,
  orgId: string,
  registrantId: string,
) {
  const { data: r } = await service
    .from("webinar_registrants")
    .select(
      "id,email,full_name,company,phone,utm_source,utm_medium,utm_campaign,created_at,webinar_id",
    )
    .eq("organization_id", orgId)
    .eq("id", registrantId)
    .maybeSingle();
  const registrant = r as Registrant | null;
  if (!registrant) throw new Error("Registrant not found.");

  const { data: webinar } = await service
    .from("webinars")
    .select("title,type")
    .eq("id", registrant.webinar_id)
    .maybeSingle();
  const w = webinar as { title: string; type: string } | null;

  // Attendance aggregates.
  const { data: att } = await service
    .from("attendance_sessions")
    .select("joined_at,left_at,duration_seconds")
    .eq("organization_id", orgId)
    .eq("webinar_id", registrant.webinar_id)
    .ilike("email", registrant.email);
  const attRows = (att ?? []) as { joined_at: string; left_at: string | null; duration_seconds: number | null }[];
  const totalSeconds = attRows.reduce((n, a) => n + (a.duration_seconds ?? 0), 0);
  const totalMinutes = totalSeconds ? Math.round(totalSeconds / 60) : null;

  // Engagement counts by kind.
  const { data: ev } = await service
    .from("engagement_events")
    .select("kind")
    .eq("organization_id", orgId)
    .eq("webinar_id", registrant.webinar_id)
    .eq("registrant_id", registrant.id);
  const counts = { polls: 0, questions: 0, offers: 0, chat: 0 };
  for (const row of (ev ?? []) as { kind: string }[]) {
    if (row.kind === "poll_answered") counts.polls++;
    else if (row.kind === "question_asked") counts.questions++;
    else if (row.kind === "offer_clicked") counts.offers++;
    else if (row.kind === "chat_message") counts.chat++;
  }

  // Session duration (first upcoming/past session on the webinar).
  const { data: sess } = await service
    .from("webinar_sessions")
    .select("duration_minutes")
    .eq("webinar_id", registrant.webinar_id)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const sessionMinutes = (sess as { duration_minutes: number } | null)?.duration_minutes ?? null;

  return {
    registrant,
    signals: {
      email: registrant.email,
      full_name: registrant.full_name,
      company: registrant.company,
      phone: registrant.phone,
      utm_source: registrant.utm_source,
      utm_medium: registrant.utm_medium,
      utm_campaign: registrant.utm_campaign,
      registered_at: registrant.created_at,
      attended: attRows.length > 0,
      total_minutes_attended: totalMinutes,
      session_duration_minutes: sessionMinutes,
      join_count: attRows.length,
      poll_responses: counts.polls,
      questions_asked: counts.questions,
      offers_clicked: counts.offers,
      chat_messages: counts.chat,
      webinar_title: w?.title ?? "Webinar",
      webinar_type: w?.type ?? "live",
    },
  };
}

async function defaultStageId(
  service: ReturnType<typeof createServiceClient>,
  orgId: string,
): Promise<string | null> {
  const { data } = await service
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", orgId)
    .eq("key", "new")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function scoreRegistrantAction(registrantId: string): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  if (!isAIConfigured()) {
    return { error: "ANTHROPIC_API_KEY is not set — AI scoring is unavailable." };
  }

  const service = createServiceClient();

  const { registrant, signals } = await loadRegistrantSignals(service, org.organizationId, registrantId);

  let aiResult;
  try {
    aiResult = await scoreLead(signals);
  } catch (err) {
    if (err instanceof AIConfigError) {
      return { error: err.message };
    }
    return { error: `AI scoring failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const { score } = aiResult;
  const stageId = await defaultStageId(service, org.organizationId);

  // Upsert lead by (org, email). If one exists tied to this registrant or email, update it.
  const { data: existing } = await service
    .from("leads")
    .select("id,stage_id")
    .eq("organization_id", org.organizationId)
    .ilike("email", registrant.email)
    .maybeSingle();
  const existingLead = existing as { id: string; stage_id: string | null } | null;

  let leadId: string;
  if (existingLead) {
    leadId = existingLead.id;
    const { error } = await service
      .from("leads")
      .update({
        full_name: registrant.full_name,
        company_name: registrant.company,
        source_registrant_id: registrant.id,
        source_webinar_id: registrant.webinar_id,
        score: score.score,
        tier: score.tier,
        score_rationale: score.rationale,
        suggested_action: score.suggested_action,
        last_touched_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    if (error) return { error: error.message };
  } else {
    const { data: inserted, error } = await service
      .from("leads")
      .insert({
        organization_id: org.organizationId,
        email: registrant.email,
        full_name: registrant.full_name,
        company_name: registrant.company,
        source_registrant_id: registrant.id,
        source_webinar_id: registrant.webinar_id,
        stage_id: stageId,
        score: score.score,
        tier: score.tier,
        score_rationale: score.rationale,
        suggested_action: score.suggested_action,
        last_touched_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !inserted) return { error: error?.message ?? "Could not create lead." };
    leadId = (inserted as { id: string }).id;
  }

  await service.from("lead_activities").insert({
    organization_id: org.organizationId,
    lead_id: leadId,
    actor_id: user.id,
    kind: "score_change",
    body: `AI scored ${score.score}/100 (${score.tier})`,
    metadata: {
      score: score.score,
      tier: score.tier,
      rationale: score.rationale,
      suggested_action: score.suggested_action,
      model: aiResult.model,
      input_tokens: aiResult.inputTokens,
      output_tokens: aiResult.outputTokens,
    },
  });

  await service.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "lead.scored",
    entity_type: "lead",
    entity_id: leadId,
    metadata: { score: score.score, tier: score.tier, registrant_id: registrant.id },
  });

  await fireTrigger({
    organizationId: org.organizationId,
    trigger: "lead_scored",
    entityType: "lead",
    entityId: leadId,
    context: {
      email: registrant.email,
      name: registrant.full_name ?? "",
      company: registrant.company ?? "",
      webinar_id: registrant.webinar_id,
      lead_id: leadId,
      score: score.score,
      tier: score.tier,
    },
  });

  revalidatePath("/sales/leads");
  revalidatePath(`/sales/leads/${leadId}`);
  return { ok: `Scored ${score.score} (${score.tier}).` };
}

export async function moveLeadStageAction(leadId: string, stageId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { data: stageRow } = await service
    .from("pipeline_stages")
    .select("id,key,is_won,is_lost")
    .eq("id", stageId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const stage = stageRow as { id: string; key: string; is_won: boolean; is_lost: boolean } | null;
  if (!stage) throw new Error("Stage not found.");

  const update: Record<string, unknown> = {
    stage_id: stageId,
    last_touched_at: new Date().toISOString(),
  };
  if (stage.is_won || stage.is_lost) update.closed_at = new Date().toISOString();
  else update.closed_at = null;

  const { error } = await service
    .from("leads")
    .update(update)
    .eq("id", leadId)
    .eq("organization_id", org.organizationId);
  if (error) throw new Error(error.message);

  await service.from("lead_activities").insert({
    organization_id: org.organizationId,
    lead_id: leadId,
    actor_id: user.id,
    kind: "stage_change",
    body: `Moved to ${stage.key}`,
    metadata: { stage_key: stage.key },
  });
  revalidatePath("/sales/leads");
  revalidatePath("/sales/pipeline");
  revalidatePath(`/sales/leads/${leadId}`);
}

const noteSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function addNoteAction(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const parsed = noteSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { fieldErrors: { body: "Note must not be empty." } };

  const service = createServiceClient();
  const { error } = await service.from("lead_activities").insert({
    organization_id: org.organizationId,
    lead_id: leadId,
    actor_id: user.id,
    kind: "note",
    body: parsed.data.body,
  });
  if (error) return { error: error.message };

  await service
    .from("leads")
    .update({ last_touched_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("organization_id", org.organizationId);

  revalidatePath(`/sales/leads/${leadId}`);
  return { ok: "Note added." };
}

const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_at: z.string().optional().or(z.literal("")),
  lead_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    details: formData.get("details") ?? "",
    priority: formData.get("priority") ?? "medium",
    due_at: formData.get("due_at") ?? "",
    lead_id: formData.get("lead_id") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const service = createServiceClient();
  const { data: inserted, error } = await service
    .from("sales_tasks")
    .insert({
      organization_id: org.organizationId,
      lead_id: parsed.data.lead_id || null,
      title: parsed.data.title,
      details: parsed.data.details || null,
      priority: parsed.data.priority,
      due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
      assigned_to: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Could not create task." };
  const taskId = (inserted as { id: string }).id;

  if (parsed.data.lead_id) {
    await service.from("lead_activities").insert({
      organization_id: org.organizationId,
      lead_id: parsed.data.lead_id,
      actor_id: user.id,
      kind: "task_created",
      body: parsed.data.title,
      metadata: { task_id: taskId, priority: parsed.data.priority, due_at: parsed.data.due_at },
    });
  }

  revalidatePath("/sales/follow-up");
  if (parsed.data.lead_id) revalidatePath(`/sales/leads/${parsed.data.lead_id}`);
  return { ok: "Task created." };
}

export async function completeTaskAction(taskId: string) {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const service = createServiceClient();
  const { data: taskRow } = await service
    .from("sales_tasks")
    .select("lead_id,title")
    .eq("id", taskId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  const task = taskRow as { lead_id: string | null; title: string } | null;
  if (!task) throw new Error("Task not found.");

  const { error } = await service
    .from("sales_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  if (task.lead_id) {
    await service.from("lead_activities").insert({
      organization_id: org.organizationId,
      lead_id: task.lead_id,
      actor_id: user.id,
      kind: "task_completed",
      body: task.title,
      metadata: { task_id: taskId },
    });
    revalidatePath(`/sales/leads/${task.lead_id}`);
  }
  revalidatePath("/sales/follow-up");
}

const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  full_name: z.string().trim().max(140).optional().or(z.literal("")),
  title: z.string().trim().max(140).optional().or(z.literal("")),
  company_name: z.string().trim().max(140).optional().or(z.literal("")),
});

export async function createContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const org = await requireActiveOrganization();
  assertManager(org.role);

  const parsed = contactSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name") ?? "",
    title: formData.get("title") ?? "",
    company_name: formData.get("company_name") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const service = createServiceClient();

  // Resolve or create the company by name (soft match).
  let companyId: string | null = null;
  if (parsed.data.company_name) {
    const { data: existing } = await service
      .from("companies")
      .select("id")
      .eq("organization_id", org.organizationId)
      .ilike("name", parsed.data.company_name)
      .maybeSingle();
    companyId = (existing as { id: string } | null)?.id ?? null;
    if (!companyId) {
      const { data: inserted } = await service
        .from("companies")
        .insert({
          organization_id: org.organizationId,
          name: parsed.data.company_name,
          created_by: user.id,
        })
        .select("id")
        .single();
      companyId = (inserted as { id: string } | null)?.id ?? null;
    }
  }

  const { error } = await service.from("contacts").insert({
    organization_id: org.organizationId,
    company_id: companyId,
    email: parsed.data.email,
    full_name: parsed.data.full_name || null,
    title: parsed.data.title || null,
    created_by: user.id,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { error: "A contact with this email already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/sales/contacts");
  return { ok: "Contact added." };
}
