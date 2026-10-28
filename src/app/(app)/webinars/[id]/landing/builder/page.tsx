import { notFound } from "next/navigation";
import Link from "next/link";
import { requireActiveOrganization } from "@/lib/auth/session";
import { getLandingPage, getWebinar } from "@/lib/webinars/queries";
import { listBlocksForLandingPage } from "@/lib/landing/queries";
import { BLOCK_KINDS, BLOCK_LABELS } from "@/lib/landing/blocks";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BlockRow } from "./block-row";
import { AddBlockMenu } from "./add-block-menu";

export const dynamic = "force-dynamic";

export default async function LandingBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await requireActiveOrganization();

  const [webinar, landing] = await Promise.all([
    getWebinar(org.organizationId, id),
    getLandingPage(org.organizationId, id),
  ]);
  if (!webinar || !landing) notFound();

  const blocks = await listBlocksForLandingPage(landing.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`${webinar.title} — landing builder`}
        description="Add, reorder, and edit blocks. The public page renders them top to bottom."
        actions={
          <div className="flex gap-2">
            <Link
              href={`/webinars/${webinar.id}`}
              className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-sm hover:bg-secondary"
            >
              Back to webinar
            </Link>
            <Link
              href={`/r/${landing.public_slug}`}
              target="_blank"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Preview ↗
            </Link>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <AddBlockMenu
            webinarId={webinar.id}
            kinds={BLOCK_KINDS}
            labels={BLOCK_LABELS}
          />
        </CardContent>
      </Card>

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No blocks yet. Pick a block type above to start building the page.
        </div>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b, i) => (
            <BlockRow
              key={b.id}
              webinarId={webinar.id}
              block={b}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
            />
          ))}
        </ul>
      )}

      {!landing.is_published ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This landing page is a draft — publish it from the webinar page to make it public.
        </div>
      ) : null}
    </div>
  );
}
