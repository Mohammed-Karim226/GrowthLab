import { parseBody, withAdmin } from "@/lib/api";
import { transitionReport } from "@/lib/reports/transition";
import { createClient } from "@/lib/supabase/server";
import { approveVersionSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ reportId: string }> };

export const POST = withAdmin<[Params]>("approveVersion", async (_session, request, { params }) => {
  const { reportId } = await params;
  const parsed = await parseBody(request, approveVersionSchema);
  if (!parsed.ok) return parsed.response;
  return transitionReport(await createClient(), reportId, parsed.data, "approve");
});
