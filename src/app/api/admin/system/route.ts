import { apiError, apiOk, withAdmin } from "@/lib/api";
import { getSystemSnapshot } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export const GET = withAdmin("systemHealth", async (_session, request) => {
  const search = new URL(request.url).searchParams;
  if ([...search.keys()].some((key) => key !== "refresh") || search.getAll("refresh").length > 1
    || (search.has("refresh") && search.get("refresh") !== "1")) return apiError(400, "validationFailed");
  return apiOk(await getSystemSnapshot({ refresh: search.get("refresh") === "1" }));
});
