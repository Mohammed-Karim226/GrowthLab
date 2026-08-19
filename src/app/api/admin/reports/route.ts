import { createClient } from "@/lib/supabase/server";
import { apiOk, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createReportSchema } from "@/lib/validation/schemas";

/**
 * Create a report and its first draft version.
 *
 * A report is only ever a container; all content hangs off a version, so v1 is
 * created eagerly and the workspace always has something to write into.
 */
export const POST = withAdmin("createReport", async (session, request) => {
  const parsed = await parseBody(request, createReportSchema);
  if (!parsed.ok) return parsed.response;

  const { clientId, title, periodStart, periodEnd } = parsed.data;
  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      client_id: clientId,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      created_by: session.userId,
    })
    .select("*")
    .single();

  if (reportError || !report) throw reportError ?? new Error("report insert returned no row");

  const { data: version, error: versionError } = await supabase
    .from("report_versions")
    .insert({
      report_id: report.id,
      version_number: 1,
      status: "draft",
      created_by: session.userId,
    })
    .select("*")
    .single();

  if (versionError || !version) {
    // No version means an unusable report; remove the container too.
    await supabase.from("reports").delete().eq("id", report.id);
    throw versionError ?? new Error("version insert returned no row");
  }

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "REPORT_CREATED",
    entity_type: "report",
    entity_id: report.id,
    metadata: { clientId, title, periodStart, periodEnd },
  });

  return apiOk({ report, version }, 201);
});
