import { z } from "zod";
import { apiError, apiOk, notFound, withAdmin } from "@/lib/api";
import { cleanupReportDeletion } from "@/lib/reports/deletion-cleanup";
import { errorCategory, logEvent } from "@/lib/security/logging";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ reportId: string }> };

export const DELETE = withAdmin<[Params]>("deleteReport", async (_session, _request, { params }) => {
  const { reportId } = await params;
  if (!z.string().uuid().safeParse(reportId).success) return notFound();
  const supabase = await createClient();

  // The transaction records cleanup work and audit history before cascading
  // report deletion. Nothing external is removed until that transaction commits.
  let deletion;
  for (let attempt = 0; attempt < 3; attempt++) {
    deletion = await supabase.rpc("delete_report", { p_report: reportId });
    if (deletion.error?.code !== "40P01") break;
  }
  if (deletion?.error) {
    const error = deletion.error;
    if (error.code === "55000" && error.message === "report missing") return notFound();
    if (error.code === "55000" && error.message === "published report") return apiError(409, "publishedReportDelete");
    if (error.code === "40P01" || error.code === "40001") return apiError(409, "staleReport");
    throw error;
  }
  if (deletion?.data?.report_id !== reportId) throw new Error("Report deletion returned no cleanup record");

  try {
    await cleanupReportDeletion(reportId);
    return apiOk({ deleted: reportId, cleanupPending: false });
  } catch (cause) {
    // The report is already gone. The durable cleanup record and periodic
    // worker retain failed storage removals/cancellations for another attempt.
    logEvent({ operation: "deleteReport:cleanup", outcome: "pending", entityId: reportId, category: errorCategory(cause) });
    return apiOk({ deleted: reportId, cleanupPending: true }, 202);
  }
});
