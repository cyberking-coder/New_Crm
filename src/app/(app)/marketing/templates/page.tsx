import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  variables: string[];
  updated_at: string;
};

export default async function TemplatesPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("id,name,slug,subject,variables,updated_at")
    .eq("organization_id", org.organizationId)
    .not("slug", "like", "__test__-%")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="Email templates"
        description="Reusable transactional / campaign emails with {{variable}} interpolation."
        actions={
          <Link
            href="/marketing/templates/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New template
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Placeholder title="No templates yet" note="Create one to start sending transactional or campaign emails." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Slug</TH>
              <TH>Subject</TH>
              <TH>Variables</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link href={`/marketing/templates/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">{t.slug}</TD>
                <TD className="max-w-md truncate">{t.subject}</TD>
                <TD className="text-xs text-muted-foreground">
                  {(t.variables ?? []).map((v) => `{{${v}}}`).join(" ")}
                </TD>
                <TD className="text-xs text-muted-foreground">
                  {new Date(t.updated_at).toLocaleDateString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
