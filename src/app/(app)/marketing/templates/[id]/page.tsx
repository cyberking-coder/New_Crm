import { notFound } from "next/navigation";
import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateEditor } from "../editor";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  html: string;
  text: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("id,name,slug,subject,html,text,from_name,from_email,reply_to")
    .eq("organization_id", org.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const t = data as TemplateRow | null;
  if (!t) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t.name} description={`/${t.slug}`} />
      <Card>
        <CardContent className="pt-6">
          <TemplateEditor
            mode="edit"
            templateId={t.id}
            initial={{
              name: t.name,
              slug: t.slug,
              subject: t.subject,
              html: t.html,
              text: t.text ?? "",
              from_name: t.from_name ?? "",
              from_email: t.from_email ?? "",
              reply_to: t.reply_to ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
