import { headers } from "next/headers";

// Resolves the public base URL in this order:
//  1. The current request's Host header (most reliable in a deployed app)
//  2. SITE_URL env var (server-only; useful outside a request, e.g. background jobs)
//  3. NEXT_PUBLIC_SITE_URL (legacy name — kept for backward compatibility)
//  4. VERCEL_URL (set automatically by Vercel on each deployment)
//  5. http://localhost:3000 (local dev fallback)
export async function getSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() isn't available (e.g. called outside a request). Fall through.
  }
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
