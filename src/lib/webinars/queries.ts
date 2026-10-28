import { createClient } from "@/lib/supabase/server";
import type { RegistrantStatus, WebinarStatus, WebinarType } from "./schemas";

export type WebinarRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: WebinarType;
  status: WebinarStatus;
  timezone: string;
  host_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  webinar_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
};

export type LandingPageRow = {
  id: string;
  webinar_id: string;
  public_slug: string;
  headline: string;
  subheadline: string | null;
  body_md: string | null;
  cta_label: string;
  is_published: boolean;
};

export type RegistrantRow = {
  id: string;
  webinar_id: string;
  session_id: string | null;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  status: RegistrantStatus;
  utm_source: string | null;
  utm_campaign: string | null;
  consent_marketing: boolean;
  created_at: string;
};

export async function listWebinars(orgId: string): Promise<WebinarRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars")
    .select("id,title,slug,description,type,status,timezone,host_name,created_at,updated_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listWebinars: ${error.message}`);
  return (data ?? []) as unknown as WebinarRow[];
}

export async function getWebinar(orgId: string, webinarId: string): Promise<WebinarRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars")
    .select("id,title,slug,description,type,status,timezone,host_name,created_at,updated_at")
    .eq("organization_id", orgId)
    .eq("id", webinarId)
    .maybeSingle();
  if (error) throw new Error(`getWebinar: ${error.message}`);
  return (data as unknown as WebinarRow) ?? null;
}

export async function listSessions(orgId: string, webinarId: string): Promise<SessionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinar_sessions")
    .select("id,webinar_id,scheduled_at,duration_minutes,status")
    .eq("organization_id", orgId)
    .eq("webinar_id", webinarId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(`listSessions: ${error.message}`);
  return (data ?? []) as unknown as SessionRow[];
}

export async function getLandingPage(
  orgId: string,
  webinarId: string,
): Promise<LandingPageRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id,webinar_id,public_slug,headline,subheadline,body_md,cta_label,is_published")
    .eq("organization_id", orgId)
    .eq("webinar_id", webinarId)
    .maybeSingle();
  if (error) throw new Error(`getLandingPage: ${error.message}`);
  return (data as unknown as LandingPageRow) ?? null;
}

export type RegistrantFilter = {
  webinarId?: string;
  status?: RegistrantStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type RegistrantPage = {
  rows: RegistrantRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listRegistrants(
  orgId: string,
  filter: RegistrantFilter = {},
): Promise<RegistrantPage> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("webinar_registrants")
    .select(
      "id,webinar_id,session_id,email,full_name,company,phone,status,utm_source,utm_campaign,consent_marketing,created_at",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filter.webinarId) query = query.eq("webinar_id", filter.webinarId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.q) {
    const term = filter.q.trim();
    if (term) {
      // Escape commas/parens for PostgREST .or()
      const safe = term.replace(/[,()]/g, " ");
      query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%,company.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`listRegistrants: ${error.message}`);

  return {
    rows: (data ?? []) as unknown as RegistrantRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function countRegistrants(orgId: string, webinarId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("webinar_registrants")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("webinar_id", webinarId);
  if (error) throw new Error(`countRegistrants: ${error.message}`);
  return count ?? 0;
}
