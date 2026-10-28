import { createClient } from "@/lib/supabase/server";

export type IntegrationConnectionRow = {
  id: string;
  organization_id: string;
  category: "webinar" | "email" | "crm" | "payments";
  provider: string;
  display_name: string;
  is_active: boolean;
  last_health_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function listConnections(
  orgId: string,
  category: "webinar" | "email" | "crm" | "payments",
): Promise<IntegrationConnectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id,organization_id,category,provider,display_name,is_active,last_health_at,last_error,created_at,updated_at")
    .eq("organization_id", orgId)
    .eq("category", category)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listConnections: ${error.message}`);
  return (data ?? []) as unknown as IntegrationConnectionRow[];
}
