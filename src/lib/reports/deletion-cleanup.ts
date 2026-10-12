import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSIGHTS_BUCKET } from "@/lib/uploads";
import type { ReportDeletionCleanupRow } from "@/types/database";

const BATCH_SIZE = 100;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const REPORT_PREFIX = new RegExp(`^clients/(${UUID})/reports/(${UUID})$`, "i");

type Progress = Partial<Pick<ReportDeletionCleanupRow,
  "last_attempt_at" | "storage_cleaned_at" | "jobs_cancelled_at" | "completed_at"
>>;

/** Only call after the transaction deleting the report and recording this task commits. */
export async function cleanupReportDeletion(reportId: string): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db.from("report_deletion_cleanup")
    .select("report_id, storage_prefix, storage_paths, job_ids, created_at, last_attempt_at, storage_cleaned_at, jobs_cancelled_at, completed_at")
    .eq("report_id", reportId).maybeSingle<ReportDeletionCleanupRow>();
  if (error) throw error;
  if (!data) return;
  const task = data;

  async function record(progress: Progress, onlyIncomplete = false): Promise<void> {
    let query = db.from("report_deletion_cleanup").update(progress).eq("report_id", reportId);
    if (onlyIncomplete) query = query.is("completed_at", null);
    const { error: updateError } = await query;
    if (updateError) throw updateError;
    // A concurrent worker may already have retired the task; zero rows is fine.
  }

  await record({ last_attempt_at: new Date().toISOString() });

  async function cancelJobs(): Promise<void> {
    if (task.jobs_cancelled_at) return;
    const jobIds = [...new Set(task.job_ids)];
    for (let offset = 0; offset < jobIds.length; offset += BATCH_SIZE) {
      await inngest.send(jobIds.slice(offset, offset + BATCH_SIZE).map((jobId) => ({
        name: "ai/insights.cancelled",
        id: `report-deletion:${reportId}:${jobId}`,
        data: { jobId },
      })));
    }
    await record({ jobs_cancelled_at: new Date().toISOString() });
  }

  async function cleanStorage(): Promise<void> {
    const prefix = task.storage_prefix;
    const match = REPORT_PREFIX.exec(prefix);
    if (!match || match[2].toLowerCase() !== reportId.toLowerCase() ||
        task.report_id.toLowerCase() !== reportId.toLowerCase()) {
      throw new Error("Invalid report cleanup storage prefix");
    }
    if (task.storage_paths.some((path) => typeof path !== "string" || !path.trim())) {
      throw new Error("Invalid report cleanup storage path");
    }
    const storage = db.storage.from(INSIGHTS_BUCKET);

    async function remove(paths: string[]): Promise<void> {
      for (let offset = 0; offset < paths.length; offset += BATCH_SIZE) {
        const { error: removeError } = await storage.remove(paths.slice(offset, offset + BATCH_SIZE));
        if (removeError) throw removeError;
      }
    }

    async function sweep(directory: string): Promise<void> {
      let previousPage: string | undefined;
      while (true) {
        // Deletions move later objects toward the beginning. Increasing offset
        // here would skip them, including virtual folders with remaining objects.
        const { data, error: listError } = await storage.list(directory, {
          limit: BATCH_SIZE, offset: 0, sortBy: { column: "name", order: "asc" },
        });
        if (listError) throw listError;
        if (!data) throw new Error("Storage cleanup listing returned no result");
        if (data.length === 0) return;

        const page = JSON.stringify(data.map((entry) => [entry.name, entry.id]));
        if (page === previousPage) throw new Error("Storage cleanup made no progress");
        previousPage = page;
        const files: string[] = [];
        for (const entry of data) {
          // Storage list names must be immediate children, never paths that can
          // escape this report's anchored prefix.
          if (!entry.name || entry.name === "." || entry.name === ".." || /[/\\\0]/.test(entry.name)) {
            throw new Error("Invalid report cleanup storage entry");
          }
          const path = `${directory}/${entry.name}`;
          if (!path.startsWith(`${prefix}/`)) throw new Error("Invalid report cleanup storage entry");
          if (entry.id === null) await sweep(path);
          else files.push(path);
        }
        await remove(files);
      }
    }

    await remove([...new Set(task.storage_paths)]);
    // Revisit completed tasks too: an upload started before deletion can finish
    // after its transaction, leaving an object absent from the captured paths.
    await sweep(prefix);
    await record({ storage_cleaned_at: new Date().toISOString() });
  }

  const [cancellation, storage] = await Promise.allSettled([cancelJobs(), cleanStorage()]);
  const failure = [cancellation, storage].find((result) => result.status === "rejected");
  if (failure) {
    await record({
      completed_at: null,
      ...(storage.status === "rejected" ? { storage_cleaned_at: null } : {}),
    });
    throw failure.reason;
  }
  // Preserve the first completion time so repeated sweeps do not extend the
  // retention window indefinitely. The filter also protects concurrent workers.
  await record({ completed_at: new Date().toISOString() }, true);
}
