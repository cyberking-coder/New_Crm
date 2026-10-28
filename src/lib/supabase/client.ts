"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function createClient() {
  // Phase 2 will swap in `Database` generics from `supabase gen types typescript`.
  return createBrowserClient(supabaseEnv.url(), supabaseEnv.anonKey());
}
