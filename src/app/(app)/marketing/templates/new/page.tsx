import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateEditor } from "../editor";

export const dynamic = "force-dynamic";

export default function NewTemplatePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="New template" description="Compose a reusable email." />
      <Card>
        <CardContent className="pt-6">
          <TemplateEditor
            mode="create"
            initial={{
              name: "",
              slug: "",
              subject: "",
              html: "",
              text: "",
              from_name: "",
              from_email: "",
              reply_to: "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
