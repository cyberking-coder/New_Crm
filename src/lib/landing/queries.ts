import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import type { AnyBlock } from "./blocks";

export async function listBlocksForLandingPage(
  landingPageId: string,
  { publicOnly = false }: { publicOnly?: boolean } = {},
): Promise<AnyBlock[]> {
  const supabase = publicOnly ? createServiceClient() : await createClient();
  let query = supabase
    .from("landing_page_blocks")
    .select("id,landing_page_id,kind,position,data,is_hidden")
    .eq("landing_page_id", landingPageId)
    .order("position", { ascending: true });
  if (publicOnly) query = query.eq("is_hidden", false);

  const { data, error } = await query;
  if (error) throw new Error(`listBlocksForLandingPage: ${error.message}`);
  return (data ?? []) as unknown as AnyBlock[];
}
