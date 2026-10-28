import { PageHeader, Placeholder } from "@/components/layout/page-header";

export function PhasePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Placeholder
        title={`Scheduled for Phase ${phase}`}
        note="This route is wired into navigation and auth. Its implementation lands in the phase above — no fake data is shown until then."
      />
    </div>
  );
}
