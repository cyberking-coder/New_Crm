import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type Row = {
  webinar_id: string;
  public_slug: string;
  headline: string;
  is_published: boolean;
  webinar: { title: string; slug: string } | null;
};

export default async function LandingPagesPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select("webinar_id,public_slug,headline,is_published,webinar:webinars(title,slug)")
    .eq("organization_id", org.organizationId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const base = await getSiteUrl();

  return (
    <div>
      <PageHeader
        title="Landing pages"
        description="One per webinar. Edit copy, publish, and copy the public URL."
      />
      {rows.length === 0 ? (
        <Placeholder
          title="No landing pages yet"
          note="A landing page is created automatically with each webinar."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Headline</TH>
              <TH>Webinar</TH>
              <TH>Public URL</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.webinar_id}>
                <TD className="font-medium">{r.headline}</TD>
                <TD className="text-sm">{r.webinar?.title ?? "—"}</TD>
                <TD className="font-mono text-xs text-muted-foreground">
                  {base}/r/{r.public_slug}
                </TD>
                <TD>
                  <Badge variant={r.is_published ? "success" : "secondary"}>
                    {r.is_published ? "Published" : "Draft"}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/webinars/${r.webinar_id}/landing/builder`}
                      className="text-xs text-primary hover:underline"
                    >
                      Builder
                    </Link>
                    <Link
                      href={`/webinars/${r.webinar_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
