import { NextResponse, type NextRequest } from "next/server";
import { runJobs } from "@/lib/jobs/runner";

// Hit by Vercel Cron (vercel.json) every minute. Also safe to invoke manually
// with a bearer token for debugging. Must complete under Vercel's function
// timeout; we cap internal work at 25s so there's headroom.
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const worker = `web:${process.env.VERCEL_REGION ?? "local"}:${Math.random().toString(36).slice(2, 8)}`;
  const report = await runJobs({ worker, maxJobs: 50, budgetMs: 25_000 });
  return NextResponse.json({ ok: true, ...report });
}

// Vercel Cron sends GET on its scheduled hit, with a bearer token in the
// Authorization header when CRON_SECRET is configured. Support both verbs.
export async function GET(request: NextRequest) {
  return POST(request);
}

function authorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = process.env.JOBS_RUNNER_SECRET ?? process.env.CRON_SECRET ?? "";

  // Allow Vercel Cron: it sends `Authorization: Bearer <CRON_SECRET>`.
  if (expected && bearer === expected) return true;

  // In local dev with no secret set, allow unauthenticated calls.
  if (!expected && process.env.NODE_ENV !== "production") return true;

  return false;
}
