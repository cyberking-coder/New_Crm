import { requireActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Placeholder } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Q = {
  id: string;
  body: string;
  status: "open" | "answered" | "dismissed";
  asker_name: string | null;
  asker_email: string | null;
  asked_at: string;
  webinar: { title: string } | null;
};

type P = {
  id: string;
  question: string;
  is_active: boolean;
  created_at: string;
  webinar: { title: string } | null;
  responses: { count: number }[] | null;
};

export default async function QuestionsPage() {
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const [qa, polls] = await Promise.all([
    supabase
      .from("questions")
      .select("id,body,status,asker_name,asker_email,asked_at,webinar:webinars(title)")
      .eq("organization_id", org.organizationId)
      .order("asked_at", { ascending: false })
      .limit(100),
    supabase
      .from("polls")
      .select("id,question,is_active,created_at,webinar:webinars(title),responses:poll_responses(count)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (qa.error) throw new Error(qa.error.message);
  if (polls.error) throw new Error(polls.error.message);

  const questions = (qa.data ?? []) as unknown as Q[];
  const pollRows = (polls.data ?? []) as unknown as P[];

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Questions"
          description="Q&A asked during webinars. Mark answered or dismiss."
        />
        {questions.length === 0 ? (
          <Placeholder
            title="No questions yet"
            note="Questions arrive from the provider webhook or in-session Q&A."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Asked</TH>
                <TH>From</TH>
                <TH>Webinar</TH>
                <TH>Question</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {questions.map((q) => (
                <TR key={q.id}>
                  <TD className="text-xs text-muted-foreground">
                    {new Date(q.asked_at).toLocaleString()}
                  </TD>
                  <TD className="text-sm">
                    {q.asker_name ?? q.asker_email ?? "—"}
                  </TD>
                  <TD className="text-sm">{q.webinar?.title ?? "—"}</TD>
                  <TD className="max-w-lg">{q.body}</TD>
                  <TD>
                    <Badge
                      variant={
                        q.status === "answered"
                          ? "success"
                          : q.status === "dismissed"
                            ? "secondary"
                            : "warning"
                      }
                    >
                      {q.status}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Polls</h2>
        {pollRows.length === 0 ? (
          <Placeholder title="No polls yet" note="Polls created for a webinar appear here." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Poll</TH>
                <TH>Webinar</TH>
                <TH>Responses</TH>
                <TH>Status</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {pollRows.map((p) => (
                <TR key={p.id}>
                  <TD className="max-w-lg">{p.question}</TD>
                  <TD className="text-sm">{p.webinar?.title ?? "—"}</TD>
                  <TD>{p.responses?.[0]?.count ?? 0}</TD>
                  <TD>
                    <Badge variant={p.is_active ? "success" : "secondary"}>
                      {p.is_active ? "Active" : "Closed"}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
