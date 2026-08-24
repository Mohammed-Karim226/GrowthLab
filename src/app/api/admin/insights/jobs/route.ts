import { z } from "zod";

import { apiOk, parseBody, withAdmin } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(100),
});

export const POST = withAdmin("getAiJobs", async (_session, request) => {
  const parsed = await parseBody(request, statusSchema);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await (await createClient())
    .from("ai_jobs")
    .select("id, status, result, error_key")
    .in("id", parsed.data.jobIds);
  if (error) throw error;

  return apiOk({ jobs: data ?? [] });
});
