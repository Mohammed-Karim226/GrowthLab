import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AiUsageEventRow } from "@/types/database";

export type AiUsageEvent = Omit<AiUsageEventRow, "id" | "created_at">;

const WRITE_TIMEOUT_MS = 1_500;

/**
 * Called by the provider after the existing withAdmin route or authenticated
 * Inngest worker boundary. This narrowly scoped service-role insert cannot
 * change the AI result, even before the telemetry migration has been applied.
 * Await it so serverless runtimes do not discard normal writes on return.
 */
export async function recordAiUsage(event: AiUsageEvent): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve();
      }, WRITE_TIMEOUT_MS);
    });
    const write = createAdminClient().from("ai_usage_events").insert(event)
      .abortSignal(controller.signal);
    // Also bound transports that do not honor AbortSignal. A late rejection
    // stays handled after the race, and no raw database errors are logged.
    await Promise.race([Promise.resolve(write).then(() => undefined, () => undefined), deadline]);
  } catch {
    // Missing configuration, schema, permissions and transport failures are
    // observability failures only. Never mask success or the provider's error.
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
