import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listLeads, listStages } from "@/lib/crm/queries";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const TIER_VARIANT = { hot: "success", warm: "warning", cold: "secondary" } as const;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; stage?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const org = await requireActiveOrganization();
  const [leads, stages] = await Promise.all([
    listLeads(org.organizationId, {
      tier:
        sp.tier === "hot" || sp.tier === "warm" || sp.tier === "cold" ? sp.tier : undefined,
      stageId: sp.stage || undefined,
      q: sp.q,
    }),
    listStages(org.organizationId),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader
        title="Leads"
        description="AI-scored prospects. Click any lead to see the full timeline and move it along the pipeline."
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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tier</label>
          <select
            name="tier"
            defaultValue={sp.tier ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Stage</label>
          <select
            name="stage"
            defaultValue={sp.stage ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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

      {leads.length === 0 ? (
        <Placeholder
          title="No leads yet"
          note="Score a registrant from a webinar to create a lead, or use the AI score action on the Registrations page."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Score</TH>
              <TH>Tier</TH>
              <TH>Name / Email</TH>
              <TH>Company</TH>
              <TH>Stage</TH>
              <TH>Last touched</TH>
            </TR>
          </THead>
          <TBody>
            {leads.map((l) => {
              const stage = l.stage_id ? stageById.get(l.stage_id) : null;
              return (
                <TR key={l.id}>
                  <TD>
                    <span className="font-mono text-sm font-semibold">{l.score}</span>
                  </TD>
                  <TD>
                    <Badge variant={TIER_VARIANT[l.tier]}>{l.tier}</Badge>
                  </TD>
                  <TD>
                    <Link href={`/sales/leads/${l.id}`} className="font-medium hover:underline">
                      {l.full_name ?? l.email}
                    </Link>
                    <div className="text-xs text-muted-foreground">{l.email}</div>
                  </TD>
                  <TD className="text-sm">{l.company_name ?? "—"}</TD>
                  <TD>
                    {stage ? (
                      <Badge variant="outline">{stage.label}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {l.last_touched_at ? new Date(l.last_touched_at).toLocaleString() : "—"}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
