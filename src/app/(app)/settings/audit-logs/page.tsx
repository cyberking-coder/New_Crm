import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { email: string; full_name: string | null } | null;
};

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const org = await requireActiveOrganization();
  if (!["owner", "admin"].includes(org.role)) {
    return (
      <div>
        <PageHeader title="Audit logs" description="Owners and admins only." />
        <Placeholder title="Not permitted" note="Audit logs are visible to owners and admins." />
      </div>
    );
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id,action,entity_type,entity_id,metadata,created_at,actor:user_profiles!audit_logs_actor_id_fkey(email,full_name)",
      { count: "exact" },
    )
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (sp.action) query = query.eq("action", sp.action);

  const { data, error, count } = await query;
  if (error) {
    // Foreign-key alias may not exist in older schemas; fall back to a simpler query.
    const basic = await supabase
      .from("audit_logs")
      .select("id,action,entity_type,entity_id,metadata,created_at", { count: "exact" })
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (basic.error) throw new Error(basic.error.message);
    return render(
      (basic.data ?? []).map((r) => ({ ...r, actor: null })) as unknown as Row[],
      basic.count ?? 0,
      page,
      sp.action,
    );
  }

  return render((data ?? []) as unknown as Row[], count ?? 0, page, sp.action);
}

function render(rows: Row[], total: number, page: number, action: string | undefined) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const uniqueActions = Array.from(new Set(rows.map((r) => r.action))).sort();

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description={`${total} event${total === 1 ? "" : "s"} recorded.`}
      />
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Action</label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
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

      {rows.length === 0 ? (
        <Placeholder
          title="No events"
          note="Actions across your workspace will appear here as they happen."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Metadata</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TD>
                  <TD className="text-sm">
                    {r.actor?.full_name || r.actor?.email || "system"}
                  </TD>
                  <TD>
                    <Badge variant="outline">{r.action}</Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {r.entity_type ? `${r.entity_type}:${r.entity_id ?? ""}` : "—"}
                  </TD>
                  <TD className="max-w-md truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(r.metadata)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/settings/audit-logs?page=${page - 1}${action ? `&action=${action}` : ""}`}
                  className="rounded-md border px-3 py-1 hover:bg-secondary"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/settings/audit-logs?page=${page + 1}${action ? `&action=${action}` : ""}`}
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
