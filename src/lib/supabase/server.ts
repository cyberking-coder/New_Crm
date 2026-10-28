import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// Server Components / Route Handlers / Server Actions — honors the user's session.
// Phase 2 will swap in `Database` generics once `supabase gen types typescript` is wired.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseEnv.url(), supabaseEnv.anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — cookies are read-only there. Middleware refreshes them.
        }
      },
    },
  });
}

// Service role — server only, bypasses RLS. Never import from client code.
export function createServiceClient() {
  return createSupabaseJsClient(supabaseEnv.url(), supabaseEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
