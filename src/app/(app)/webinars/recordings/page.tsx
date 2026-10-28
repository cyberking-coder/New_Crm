import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listWebinars } from "@/lib/webinars/queries";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddRecordingForm } from "./add-form";
import { DeleteRecordingButton } from "./delete-button";

export const dynamic = "force-dynamic";

type Rec = {
  id: string;
  title: string;
  source: "provider" | "upload" | "external";
  external_url: string | null;
  duration_seconds: number | null;
  is_public: boolean;
  created_at: string;
  webinar: { title: string } | null;
};

function fmt(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return `${m}m`;
}

export default async function RecordingsPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const [recRes, webinars] = await Promise.all([
    supabase
      .from("recordings")
      .select("id,title,source,external_url,duration_seconds,is_public,created_at,webinar:webinars(title)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false }),
    listWebinars(org.organizationId),
  ]);
  if (recRes.error) throw new Error(recRes.error.message);
  const rows = (recRes.data ?? []) as unknown as Rec[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recordings & replays"
        description="Links to recordings — from the provider webhook, or added manually."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Add external recording</CardTitle>
          </CardHeader>
          <CardContent>
            {webinars.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create a webinar first to attach recordings.
              </p>
            ) : (
              <AddRecordingForm webinars={webinars.map((w) => ({ id: w.id, title: w.title }))} />
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <Placeholder
              title="No recordings yet"
              note="They arrive from the provider webhook, or add one manually from a URL."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Webinar</TH>
                  <TH>Source</TH>
                  <TH>Length</TH>
                  <TH>Added</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">
                      {r.external_url ? (
                        <a
                          href={r.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                    </TD>
                    <TD className="text-sm">{r.webinar?.title ?? "—"}</TD>
                    <TD>
                      <Badge variant="outline">{r.source}</Badge>
                    </TD>
                    <TD>{fmt(r.duration_seconds)}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TD>
                    <TD className="text-right">
                      <DeleteRecordingButton recordingId={r.id} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
