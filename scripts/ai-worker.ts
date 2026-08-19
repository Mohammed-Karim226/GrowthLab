import { randomUUID } from "node:crypto";
import { createAdminClient } from "../src/lib/supabase/admin";
import { processAiJob } from "../src/lib/ai/process-job";
import { AiProviderError, errorKeyFor } from "../src/lib/ai/provider";
import type { AiJobRow } from "../src/types/database";

const workerId = `ai-${process.pid}-${randomUUID().slice(0, 8)}`;
const pollMs = Number(process.env.AI_WORKER_POLL_MS ?? 1500);
const leaseSeconds = Number(process.env.AI_WORKER_LEASE_SECONDS ?? 600);
const concurrency = Math.max(1, Number(process.env.AI_WORKER_CONCURRENCY ?? 2));
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function runOne() {
  const { data, error } = await createAdminClient().rpc("claim_ai_job", { worker_name: workerId, lease_seconds: leaseSeconds });
  if (error) throw error;
  const job = data as AiJobRow | null;
  if (!job) return false;
  try {
    await processAiJob(job);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const errorKey = error instanceof AiProviderError ? errorKeyFor(error.kind) : "aiFailed";
    const { error: failError } = await createAdminClient().rpc("fail_ai_job", {
      job_id: job.id, failure_key: errorKey, failure_detail: detail,
    });
    if (failError) console.error(`[${workerId}] could not release job ${job.id}`, failError);
    console.error(`[${workerId}] job ${job.id} failed`, error);
  }
  return true;
}

console.log(`[${workerId}] started with concurrency=${concurrency}`);
while (!stopping) {
  const results = await Promise.all(Array.from({ length: concurrency }, runOne));
  if (!results.some(Boolean)) await new Promise((resolve) => setTimeout(resolve, pollMs));
}
console.log(`[${workerId}] stopping`);
