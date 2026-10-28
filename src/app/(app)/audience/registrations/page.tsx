import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listRegistrants, listWebinars } from "@/lib/webinars/queries";
import { REGISTRANT_STATUSES } from "@/lib/webinars/schemas";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type SP = {
  webinar?: string;
  status?: string;
  q?: string;
  page?: string;
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const org = await requireActiveOrganization();
  const sp = await searchParams;

  const [webinars, data] = await Promise.all([
    listWebinars(org.organizationId),
    listRegistrants(org.organizationId, {
      webinarId: sp.webinar || undefined,
      status:
        sp.status && REGISTRANT_STATUSES.includes(sp.status as (typeof REGISTRANT_STATUSES)[number])
          ? (sp.status as (typeof REGISTRANT_STATUSES)[number])
          : undefined,
      q: sp.q,
      page: sp.page ? Number(sp.page) : 1,
    }),
  ]);

  const webinarMap = new Map(webinars.map((w) => [w.id, w.title]));

  const buildHref = (patch: Partial<SP>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) {
      if (v) params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/audience/registrations?${s}` : "/audience/registrations";
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const csvParams = new URLSearchParams();
  if (sp.webinar) csvParams.set("webinar", sp.webinar);
  if (sp.status) csvParams.set("status", sp.status);
  if (sp.q) csvParams.set("q", sp.q);

  return (
    <div>
      <PageHeader
        title="Registrations"
        description={`${data.total} registrant${data.total === 1 ? "" : "s"} across your webinars.`}
        actions={
          <Link
            href={`/api/registrations/export?${csvParams.toString()}`}
            className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-sm hover:bg-secondary"
          >
            Export CSV
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Email, name, or company"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Webinar</label>
          <select
            name="webinar"
            defaultValue={sp.webinar ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {webinars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {REGISTRANT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </form>

      {data.rows.length === 0 ? (
        <Placeholder
          title="No registrations yet"
          note="Share a published landing page to collect registrations. They'll show up here instantly."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Name</TH>
                <TH>Company</TH>
                <TH>Webinar</TH>
                <TH>Source</TH>
                <TH>Status</TH>
                <TH>Registered</TH>
              </TR>
            </THead>
            <TBody>
              {data.rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.email}</TD>
                  <TD>{r.full_name ?? "—"}</TD>
                  <TD>{r.company ?? "—"}</TD>
                  <TD className="text-xs text-muted-foreground">
                    {webinarMap.get(r.webinar_id) ?? r.webinar_id}
                  </TD>
                  <TD className="text-xs text-muted-foreground">{r.utm_source ?? "—"}</TD>
                  <TD>
                    <Badge
                      variant={
                        r.status === "attended"
                          ? "success"
                          : r.status === "no_show"
                            ? "warning"
                            : r.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {data.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link
                  href={buildHref({ page: String(data.page - 1) })}
                  className="rounded-md border px-3 py-1 hover:bg-secondary"
                >
                  Previous
                </Link>
              ) : null}
              {data.page < totalPages ? (
                <Link
                  href={buildHref({ page: String(data.page + 1) })}
                  className="rounded-md border px-3 py-1 hover:bg-secondary"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
