import { apiOk, notFound, withAdmin } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ jobId: string }> };
export const GET = withAdmin<[Params]>("getAiJob", async (_session, _request, { params }) => {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_jobs")
    .select("id, status, result, error_key, created_at, started_at, completed_at")
    .eq("id", jobId).maybeSingle();
  if (error) throw error;
  if (!data) return notFound();
  return apiOk(data);
});
