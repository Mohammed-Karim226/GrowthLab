import { apiError, apiOk, notFound, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ reportId: string }> };

export const DELETE = withAdmin<[Params]>("deleteReport", async (session, _request, { params }) => {
  const { reportId } = await params;
  const supabase = await createClient();
  const { data: report, error } = await supabase.from("reports").select("id, current_published_version_id").eq("id", reportId).maybeSingle<{ id: string; current_published_version_id: string | null }>();
  if (error) throw error;
  if (!report) return notFound();
  if (report.current_published_version_id) return apiError(409, "publishedReportDelete");

  const { data: images, error: imageError } = await supabase.from("insight_images").select("storage_path, insight_batches!inner(report_version_id, report_versions!inner(report_id))").eq("insight_batches.report_versions.report_id", reportId);
  if (imageError) throw imageError;
  const paths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("insights").remove(paths);
    if (storageError) throw storageError;
  }
  const { data: deleted, error: deleteError } = await supabase.from("reports").delete().eq("id", reportId).is("current_published_version_id", null).select("id").maybeSingle<{ id: string }>();
  if (deleteError) throw deleteError;
  if (!deleted) return notFound();
  await writeAuditLog(supabase, { actor_id: session.userId, action: "REPORT_DELETED", entity_type: "report", entity_id: reportId, metadata: { removedImages: paths.length } });
  return apiOk({ deleted: reportId });
});
