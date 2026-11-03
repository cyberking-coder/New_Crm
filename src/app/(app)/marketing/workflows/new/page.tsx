import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkflowEditor } from "../editor";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_templates")
    .select("id,name")
    .eq("organization_id", org.organizationId)
    .not("slug", "like", "__test__-%")
    .order("name");
  const templates = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="New workflow" description="Trigger → steps." />
      <Card>
        <CardContent className="pt-6">
          <WorkflowEditor
            templates={templates}
            initial={{
              id: null,
              name: "",
              trigger: "registrant_created",
              status: "draft",
              trigger_config: {},
              steps: [],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
