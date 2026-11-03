import { parseBody, withAdmin } from "@/lib/api";
import { transitionReport } from "@/lib/reports/transition";
import { createClient } from "@/lib/supabase/server";
import { publishSchema, unpublishSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ reportId: string }> };

export const POST = withAdmin<[Params]>("publishVersion", async (_session, request, { params }) => {
  const { reportId } = await params;
  const parsed = await parseBody(request, publishSchema);
  if (!parsed.ok) return parsed.response;
  return transitionReport(await createClient(), reportId, parsed.data, "publish");
});

export const DELETE = withAdmin<[Params]>("unpublishVersion", async (_session, request, { params }) => {
  const { reportId } = await params;
  const parsed = await parseBody(request, unpublishSchema);
  if (!parsed.ok) return parsed.response;
  return transitionReport(await createClient(), reportId, parsed.data, "unpublish");
});
