import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { publishSchema, unpublishSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ reportId: string }> };

/**
 * Publish an approved version to the client portal.
 *
 * `reports.current_published_version_id` is the single switch a client's queries
 * read. Nothing else makes a report visible, so publishing and unpublishing are
 * both one pointer write (plan §34, §43).
 */
export const POST = withAdmin<[Params]>("publishVersion", async (session, request, { params }) => {
  const { reportId } = await params;

  const parsed = await parseBody(request, publishSchema);
  if (!parsed.ok) return parsed.response;

  const { reportVersionId, summary } = parsed.data;
  const supabase = await createClient();

  const { data: version, error } = await supabase
    .from("report_versions")
    .select("id, report_id, status, version_number, ai_summary")
    .eq("id", reportVersionId)
    .maybeSingle<{
      id: string;
      report_id: string;
      status: string;
      version_number: number;
      ai_summary: unknown;
    }>();

  if (error) throw error;
  if (!version) return notFound();
  if (version.report_id !== reportId) return notFound();

  if (version.status === "published") return apiError(409, "alreadyPublished");

  // Approval is a prerequisite, not a formality: it is where the needs_review
  // check lives, and skipping it would publish unverified numbers.
  if (version.status !== "approved") return apiError(409, "notApproved");

  const publishedAt = new Date().toISOString();

  const { error: versionError } = await supabase
    .from("report_versions")
    .update({
      status: "published",
      published_at: publishedAt,
      ...(summary !== undefined ? { summary } : {}),
    })
    .eq("id", version.id);

  if (versionError) throw versionError;

  const { data: report, error: pointerError } = await supabase
    .from("reports")
    .update({ current_published_version_id: version.id })
    .eq("id", reportId)
    .select("id, current_published_version_id")
    .maybeSingle<{ id: string; current_published_version_id: string | null }>();

  if (pointerError || !report) {
    // The version says published but no client can see it. Roll the version
    // back rather than leave the two records disagreeing.
    await supabase
      .from("report_versions")
      .update({ status: "approved", published_at: null })
      .eq("id", version.id);

    throw pointerError ?? new Error("publish pointer update returned no row");
  }

  // Older versions of this report become history, not competing published rows.
  await supabase
    .from("report_versions")
    .update({ status: "archived" })
    .eq("report_id", reportId)
    .eq("status", "published")
    .neq("id", version.id);

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "VERSION_PUBLISHED",
    entity_type: "report_version",
    entity_id: version.id,
    metadata: {
      report_id: reportId,
      version_number: version.version_number,
      had_ai_summary: Boolean(version.ai_summary),
    },
  });

  return apiOk({ versionId: version.id, status: "published" as const, publishedAt });
});

/**
 * Withdraw a published report.
 *
 * The version keeps its history and returns to `approved`; only the pointer is
 * cleared, which is what removes it from every client query.
 */
export const DELETE = withAdmin<[Params]>(
  "unpublishVersion",
  async (session, request, { params }) => {
    const { reportId } = await params;

    const parsed = await parseBody(request, unpublishSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = await createClient();

    const { data: report, error } = await supabase
      .from("reports")
      .select("id, current_published_version_id")
      .eq("id", reportId)
      .maybeSingle<{ id: string; current_published_version_id: string | null }>();

    if (error) throw error;
    if (!report) return notFound();

    if (report.current_published_version_id !== parsed.data.reportVersionId) {
      return apiError(409, "notPublished");
    }

    const { error: pointerError } = await supabase
      .from("reports")
      .update({ current_published_version_id: null })
      .eq("id", reportId);

    if (pointerError) throw pointerError;

    const { error: versionError } = await supabase
      .from("report_versions")
      .update({ status: "approved", published_at: null })
      .eq("id", parsed.data.reportVersionId);

    if (versionError) throw versionError;

    await writeAuditLog(supabase, {
      actor_id: session.userId,
      action: "VERSION_UNPUBLISHED",
      entity_type: "report_version",
      entity_id: parsed.data.reportVersionId,
      metadata: { report_id: reportId },
    });

    return apiOk({ versionId: parsed.data.reportVersionId, status: "approved" as const });
  }
);
