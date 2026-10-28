import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number | null;
  device: string | null;
  webinar: { title: string } | null;
};

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export default async function AttendeesPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("id,email,joined_at,left_at,duration_seconds,device,webinar:webinars(title)")
    .eq("organization_id", org.organizationId)
    .order("joined_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="Attendees"
        description="Everyone who actually joined a session, newest first."
      />
      {rows.length === 0 ? (
        <Placeholder
          title="No attendance yet"
          note="Connect a webinar provider and send a 'participant' event, or wait for your next live session."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Webinar</TH>
              <TH>Joined</TH>
              <TH>Left</TH>
              <TH>Duration</TH>
              <TH>Device</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.email}</TD>
                <TD className="text-sm">{r.webinar?.title ?? "—"}</TD>
                <TD className="text-xs text-muted-foreground">
                  {new Date(r.joined_at).toLocaleString()}
                </TD>
                <TD className="text-xs text-muted-foreground">
                  {r.left_at ? new Date(r.left_at).toLocaleString() : "—"}
                </TD>
                <TD>{fmtDuration(r.duration_seconds)}</TD>
                <TD className="text-xs text-muted-foreground">{r.device ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
