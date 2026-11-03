import { createClient } from "@/lib/supabase/server";

export type Stage = {
  id: string;
  key: string;
  label: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
};

export type LeadRow = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  score: number;
  tier: "cold" | "warm" | "hot";
  suggested_action: string | null;
  stage_id: string | null;
  owner_id: string | null;
  value_cents: number | null;
  currency: string | null;
  last_touched_at: string | null;
  source_webinar_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  lead_id: string | null;
  title: string;
  details: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  due_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  created_at: string;
};

export async function listStages(orgId: string): Promise<Stage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id,key,label,position,is_won,is_lost")
    .eq("organization_id", orgId)
    .order("position", { ascending: true });
  if (error) throw new Error(`listStages: ${error.message}`);
  return (data ?? []) as unknown as Stage[];
}

export async function listLeads(
  orgId: string,
  filter: { stageId?: string; tier?: "cold" | "warm" | "hot"; q?: string } = {},
): Promise<LeadRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(
      "id,email,full_name,company_name,score,tier,suggested_action,stage_id,owner_id,value_cents,currency,last_touched_at,source_webinar_id,created_at,updated_at",
    )
    .eq("organization_id", orgId)
    .order("score", { ascending: false })
    .limit(500);

  if (filter.stageId) query = query.eq("stage_id", filter.stageId);
  if (filter.tier) query = query.eq("tier", filter.tier);
  if (filter.q) {
    const safe = filter.q.replace(/[,()]/g, " ");
    query = query.or(
      `email.ilike.%${safe}%,full_name.ilike.%${safe}%,company_name.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`listLeads: ${error.message}`);
  return (data ?? []) as unknown as LeadRow[];
}

export async function getLead(orgId: string, leadId: string): Promise<LeadRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,email,full_name,company_name,score,tier,suggested_action,stage_id,owner_id,value_cents,currency,last_touched_at,source_webinar_id,created_at,updated_at",
    )
    .eq("organization_id", orgId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`getLead: ${error.message}`);
  return (data as LeadRow | null) ?? null;
}

export async function listLeadActivities(orgId: string, leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activities")
    .select("id,kind,body,metadata,created_at,actor_id")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`listLeadActivities: ${error.message}`);
  return data ?? [];
}

export async function listTasks(
  orgId: string,
  filter: { status?: "open" | "in_progress" | "done" | "cancelled"; leadId?: string } = {},
): Promise<TaskRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sales_tasks")
    .select(
      "id,lead_id,title,details,priority,status,due_at,completed_at,assigned_to,created_at",
    )
    .eq("organization_id", orgId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);

  if (filter.status) query = query.eq("status", filter.status);
  else query = query.in("status", ["open", "in_progress"]);

  if (filter.leadId) query = query.eq("lead_id", filter.leadId);

  const { data, error } = await query;
  if (error) throw new Error(`listTasks: ${error.message}`);
  return (data ?? []) as unknown as TaskRow[];
}
