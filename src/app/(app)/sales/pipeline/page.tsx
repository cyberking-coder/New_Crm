import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listLeads, listStages } from "@/lib/crm/queries";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const TIER_VARIANT = { hot: "success", warm: "warning", cold: "secondary" } as const;

export default async function PipelinePage() {
  const org = await requireActiveOrganization();
  const [leads, stages] = await Promise.all([
    listLeads(org.organizationId, {}),
    listStages(org.organizationId),
  ]);

  const byStage = new Map<string, typeof leads>();
  for (const s of stages) byStage.set(s.id, []);
  const unstaged: typeof leads = [];
  for (const l of leads) {
    if (l.stage_id && byStage.has(l.stage_id)) byStage.get(l.stage_id)!.push(l);
    else unstaged.push(l);
  }

  if (leads.length === 0) {
    return (
      <div>
        <PageHeader title="Sales pipeline" description="Leads grouped by stage." />
        <Placeholder
          title="Nothing in the pipeline"
          note="Score a webinar registrant to drop them into the New stage."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Sales pipeline" description="Leads grouped by stage." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((s) => {
          const items = byStage.get(s.id) ?? [];
          return (
            <div key={s.id} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
                <span>{s.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <ul className="divide-y">
                {items.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">Empty</li>
                ) : (
                  items.map((l) => (
                    <li key={l.id} className="px-3 py-2">
                      <Link
                        href={`/sales/leads/${l.id}`}
                        className="flex items-center justify-between text-sm hover:underline"
                      >
                        <span className="truncate">
                          <span className="font-medium">{l.full_name ?? l.email}</span>
                          {l.company_name ? (
                            <span className="ml-1 text-muted-foreground">· {l.company_name}</span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant={TIER_VARIANT[l.tier]}>{l.score}</Badge>
                        </span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
        {unstaged.length > 0 ? (
          <div className="rounded-lg border border-dashed bg-card">
            <div className="border-b px-3 py-2 text-sm font-semibold">Unassigned</div>
            <ul className="divide-y">
              {unstaged.map((l) => (
                <li key={l.id} className="px-3 py-2 text-sm">
                  <Link href={`/sales/leads/${l.id}`} className="hover:underline">
                    {l.full_name ?? l.email}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
