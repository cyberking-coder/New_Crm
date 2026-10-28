import { NextResponse, type NextRequest } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/session";
import { listRegistrants } from "@/lib/webinars/queries";
import { REGISTRANT_STATUSES, type RegistrantStatus } from "@/lib/webinars/schemas";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  const org = await requireActiveOrganization();
  const url = new URL(request.url);
  const webinarId = url.searchParams.get("webinar") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && REGISTRANT_STATUSES.includes(statusParam as RegistrantStatus)
      ? (statusParam as RegistrantStatus)
      : undefined;

  // Export up to 10,000 rows; paginate internally.
  const header = [
    "email",
    "full_name",
    "company",
    "phone",
    "status",
    "webinar_id",
    "session_id",
    "utm_source",
    "utm_campaign",
    "consent_marketing",
    "created_at",
  ];
  const lines: string[] = [header.join(",")];

  let page = 1;
  const pageSize = 500;
  const hardLimit = 10000;
  while (lines.length - 1 < hardLimit) {
    const batch = await listRegistrants(org.organizationId, {
      webinarId,
      status,
      q,
      page,
      pageSize,
    });
    for (const r of batch.rows) {
      lines.push(
        [
          r.email,
          r.full_name ?? "",
          r.company ?? "",
          r.phone ?? "",
          r.status,
          r.webinar_id,
          r.session_id ?? "",
          r.utm_source ?? "",
          r.utm_campaign ?? "",
          r.consent_marketing ? "true" : "false",
          r.created_at,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    if (batch.rows.length < pageSize) break;
    page += 1;
  }

  const body = lines.join("\n");
  const filename = `registrants-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
