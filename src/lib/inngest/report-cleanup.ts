import "server-only";

import { inngest } from "@/lib/inngest/client";
import { cleanupReportDeletion } from "@/lib/reports/deletion-cleanup";
import { errorCategory, logEvent } from "@/lib/security/logging";
import { createAdminClient } from "@/lib/supabase/admin";

/** Also recovers a request that died after deleting the report but before cleanup. */
export const cleanupDeletedReports = inngest.createFunction(
  {
    id: "cleanup-deleted-reports",
    name: "Clean up deleted reports",
    concurrency: 1,
    retries: 2,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const tasks = await step.run("load-cleanup-tasks", async () => {
      const db = createAdminClient();
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Completed records stay for a day so repeated prefix sweeps also catch
      // uploads that were in flight when deletion committed.
      const { error: retireError } = await db.from("report_deletion_cleanup")
        .delete().not("completed_at", "is", null).lt("created_at", cutoff);
      if (retireError) throw retireError;
      const { data, error } = await db.from("report_deletion_cleanup")
        .select("report_id")
        .order("last_attempt_at", { ascending: true, nullsFirst: true })
        .order("report_id", { ascending: true })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    });

    let pending = 0;
    for (const task of tasks) {
      const complete = await step.run(`cleanup-${task.report_id}`, async () => {
        try {
          await cleanupReportDeletion(task.report_id);
          return true;
        } catch (cause) {
          logEvent({ operation: "reportCleanup", outcome: "pending", entityId: task.report_id, category: errorCategory(cause) });
          return false;
        }
      });
      if (!complete) pending++;
    }
    return { checked: tasks.length, pending };
  }
);
