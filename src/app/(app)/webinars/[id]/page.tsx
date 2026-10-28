import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrganization } from "@/lib/auth/session";
import {
  countRegistrants,
  getLandingPage,
  getWebinar,
  listSessions,
} from "@/lib/webinars/queries";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebinarEditForm } from "./edit-form";
import { AddSessionForm } from "./add-session-form";
import { LandingPageForm } from "./landing-form";
import { supabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function WebinarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await requireActiveOrganization();

  const webinar = await getWebinar(org.organizationId, id);
  if (!webinar) notFound();

  const [sessions, landing, registrantCount, attendedCount, recordingsCount] = await Promise.all([
    listSessions(org.organizationId, id),
    getLandingPage(org.organizationId, id),
    countRegistrants(org.organizationId, id),
    (async () => {
      const s = await createClient();
      const { count } = await s
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.organizationId)
        .eq("webinar_id", id);
      return count ?? 0;
    })(),
    (async () => {
      const s = await createClient();
      const { count } = await s
        .from("recordings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.organizationId)
        .eq("webinar_id", id);
      return count ?? 0;
    })(),
  ]);

  const publicUrl = landing ? `${supabaseEnv.siteUrl()}/r/${landing.public_slug}` : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={webinar.title}
        description={`/${webinar.slug} · ${webinar.timezone}`}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/audience/registrations?webinar=${webinar.id}`}
              className="inline-flex h-9 items-center rounded-md border bg-card px-3 hover:bg-secondary"
            >
              {registrantCount} registrant{registrantCount === 1 ? "" : "s"}
            </Link>
            <span className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-muted-foreground">
              {attendedCount} attended
            </span>
            <span className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-muted-foreground">
              {recordingsCount} recording{recordingsCount === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <WebinarEditForm webinar={webinar} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Landing page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {landing ? (
              <>
                <div className="rounded-md border bg-secondary/40 p-3 text-xs">
                  <div className="text-muted-foreground">Public URL</div>
                  <div className="truncate font-mono">{publicUrl}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={landing.is_published ? "success" : "secondary"}>
                      {landing.is_published ? "Published" : "Draft"}
                    </Badge>
                    {landing.is_published && publicUrl ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Open ↗
                      </a>
                    ) : null}
                  </div>
                </div>
                <LandingPageForm webinarId={webinar.id} landing={landing} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                The landing page row was not auto-created. Re-run the Phase 2 migration.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions scheduled. Add one below.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sessions.map((s) => {
                const d = new Date(s.scheduled_at);
                return (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>
                      {d.toLocaleString(undefined, {
                        timeZone: webinar.timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({webinar.timezone})
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.duration_minutes} min · {s.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <AddSessionForm webinarId={webinar.id} />
        </CardContent>
      </Card>
    </div>
  );
}
