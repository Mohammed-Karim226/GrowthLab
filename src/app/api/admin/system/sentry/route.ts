import { apiError, apiOk, withAdmin } from "@/lib/api";
import { getSentryWorkspace, sentryFiltersSchema } from "@/lib/admin/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdmin("sentryWorkspace", async (_session, request) => {
  const search = new URL(request.url).searchParams;
  // Reject duplicates as well as unknown fields, rather than silently choosing
  // one interpretation of a user-supplied search expression.
  if ([...search.keys()].some((key) => search.getAll(key).length !== 1)) {
    return apiError(400, "validationFailed");
  }
  const parsed = sentryFiltersSchema.safeParse(Object.fromEntries(search));
  if (!parsed.success) return apiError(400, "validationFailed");
  return apiOk(await getSentryWorkspace(parsed.data));
});
