import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadNext(slug: string) {
  const service = createServiceClient();
  const { data: lp } = await service
    .from("landing_pages")
    .select("webinar_id,headline,webinar:webinars(timezone,title)")
    .eq("public_slug", slug)
    .maybeSingle();
  const landing = lp as
    | { webinar_id: string; headline: string; webinar: { timezone: string; title: string } | null }
    | null;
  if (!landing) return null;

  const { data: s } = await service
    .from("webinar_sessions")
    .select("scheduled_at,duration_minutes")
    .eq("webinar_id", landing.webinar_id)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { landing, session: s as { scheduled_at: string; duration_minutes: number } | null };
}

export default async function ThanksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadNext(slug);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">You&rsquo;re registered.</h1>
      <p className="mb-6 text-muted-foreground">
        Check your inbox for the confirmation. We&rsquo;ll send a reminder before it starts.
      </p>
      {data?.session && data.landing.webinar ? (
        <div className="mx-auto inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <span className="font-medium">
            {new Date(data.session.scheduled_at).toLocaleString(undefined, {
              timeZone: data.landing.webinar.timezone,
              dateStyle: "full",
              timeStyle: "short",
            })}
          </span>
          <span className="text-xs text-muted-foreground">· {data.landing.webinar.timezone}</span>
        </div>
      ) : null}
    </div>
  );
}
