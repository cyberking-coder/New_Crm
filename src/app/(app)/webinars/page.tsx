import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listWebinars } from "@/lib/webinars/queries";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const statusVariant = {
  draft: "secondary",
  scheduled: "default",
  live: "success",
  ended: "secondary",
  archived: "outline",
} as const;

export default async function WebinarsPage() {
  const org = await requireActiveOrganization();
  const rows = await listWebinars(org.organizationId);

  return (
    <div>
      <PageHeader
        title="Webinars"
        description="Create, schedule, and manage every webinar in your workspace."
        actions={
          <Link
            href="/webinars/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New webinar
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Placeholder
          title="No webinars yet"
          note="Create your first webinar to get a registration page, sessions, and attendee tracking."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Timezone</TH>
              <TH>Updated</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((w) => (
              <TR key={w.id}>
                <TD>
                  <Link href={`/webinars/${w.id}`} className="font-medium hover:underline">
                    {w.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">/{w.slug}</div>
                </TD>
                <TD className="capitalize">{w.type}</TD>
                <TD>
                  <Badge variant={statusVariant[w.status]}>{w.status}</Badge>
                </TD>
                <TD className="text-xs text-muted-foreground">{w.timezone}</TD>
                <TD className="text-xs text-muted-foreground">
                  {new Date(w.updated_at).toLocaleString()}
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/webinars/${w.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Open
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
