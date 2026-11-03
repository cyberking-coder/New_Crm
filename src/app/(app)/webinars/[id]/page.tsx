import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrganization } from "@/lib/auth/session";
import { countRegistrants, getWebinar, listSessions } from "@/lib/webinars/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebinarEditForm } from "./edit-form";
import { AddSessionForm } from "./add-session-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WebinarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await requireActiveOrganization();

  const webinar = await getWebinar(org.organizationId, id);
  if (!webinar) notFound();

  const [sessions, registrantCount, attendedCount, recordingsCount] = await Promise.all([
    listSessions(org.organizationId, id),
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

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <WebinarEditForm webinar={webinar} />
        </CardContent>
      </Card>

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
