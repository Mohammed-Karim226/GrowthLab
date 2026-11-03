import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, notFound, parseBody, withAdmin } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { reportExportSchema } from "@/lib/reports/export/contract";
import { exportReportPdf, ReportExportError } from "@/lib/reports/export/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ reportId: string }> };

export const POST = withAdmin<[Params]>("exportReportPdf", async (_session, request, { params }) => {
  const { reportId } = await params;
  if (!z.string().uuid().safeParse(reportId).success) return notFound();
  const parsed = await parseBody(request, reportExportSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = await createClient();
    const { buffer, contentDisposition } = await exportReportPdf(db, { reportId, ...parsed.data });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": contentDisposition,
        "content-length": String(buffer.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ReportExportError) return apiError(error.status, error.errorKey);
    throw error;
  }
});
