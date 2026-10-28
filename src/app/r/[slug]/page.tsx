import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { listBlocksForLandingPage } from "@/lib/landing/queries";
import { renderBlock } from "@/components/landing/render";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

type LandingData = {
  id: string;
  public_slug: string;
  headline: string;
  subheadline: string | null;
  body_md: string | null;
  cta_label: string;
  is_published: boolean;
  webinar: { webinar_id: string; title: string; timezone: string } | null;
};

async function loadLanding(slug: string): Promise<LandingData | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("landing_pages")
    .select(
      "id,public_slug,headline,subheadline,body_md,cta_label,is_published,webinar_id,webinar:webinars(title,timezone)",
    )
    .eq("public_slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as unknown as {
    id: string;
    public_slug: string;
    headline: string;
    subheadline: string | null;
    body_md: string | null;
    cta_label: string;
    is_published: boolean;
    webinar_id: string;
    webinar: { title: string; timezone: string } | null;
  };
  return {
    ...d,
    webinar: d.webinar ? { webinar_id: d.webinar_id, title: d.webinar.title, timezone: d.webinar.timezone } : null,
  };
}

type NextSession = { scheduled_at: string; duration_minutes: number };

async function loadNextSession(webinarId: string): Promise<NextSession | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("webinar_sessions")
    .select("scheduled_at,duration_minutes")
    .eq("webinar_id", webinarId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as NextSession | null) ?? null;
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landing = await loadLanding(slug);
  if (!landing || !landing.webinar) notFound();

  const [blocks, next] = await Promise.all([
    listBlocksForLandingPage(landing.id, { publicOnly: true }),
    loadNextSession(landing.webinar.webinar_id),
  ]);

  const regForm = <RegistrationForm slug={landing.public_slug} ctaLabel={landing.cta_label} />;

  // Block-based rendering — once a page has blocks, they take over the layout.
  if (blocks.length > 0) {
    const hasFormAnchor = blocks.some((b) => b.kind === "form_anchor");
    return (
      <main className="min-h-screen bg-background">
        {blocks.map((b) => (
          <div key={b.id}>
            {renderBlock(b, {
              formSlot: regForm,
              defaultCountdownIso: next?.scheduled_at,
            })}
          </div>
        ))}
        {!hasFormAnchor ? (
          <section id="register" className="w-full px-6 py-12">
            <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Save your seat</h2>
              {regForm}
            </div>
          </section>
        ) : null}
      </main>
    );
  }

  // Legacy / default simple layout — used until the owner adds any block.
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-5">
        <section className="md:col-span-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
            {landing.webinar.title}
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight">{landing.headline}</h1>
          {landing.subheadline ? (
            <p className="mb-6 text-lg text-muted-foreground">{landing.subheadline}</p>
          ) : null}
          {next ? (
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <span className="font-medium">
                {new Date(next.scheduled_at).toLocaleString(undefined, {
                  timeZone: landing.webinar.timezone,
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                · {next.duration_minutes} min · {landing.webinar.timezone}
              </span>
            </div>
          ) : null}
          {landing.body_md ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
              {landing.body_md}
            </div>
          ) : null}
        </section>

        <section id="register" className="md:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Save your seat</h2>
            {regForm}
          </div>
        </section>
      </div>
    </div>
  );
}
