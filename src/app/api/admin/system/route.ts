import { apiOk, withAdmin } from "@/lib/api";
import { getSystemSnapshot } from "@/lib/admin/system";

export const dynamic = "force-dynamic";

export const GET = withAdmin("systemHealth", async () => apiOk(await getSystemSnapshot()));
