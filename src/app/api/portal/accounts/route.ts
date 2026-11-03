import type { NextResponse } from "next/server";
import { apiOk, forbidden, serverError, unauthorized } from "@/lib/api";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AccountRow } from "@/types/database";

export const dynamic = "force-dynamic";

function uncached(response: NextResponse) {
  response.headers.set("cache-control", "private, no-store");
  return response;
}

/** Refresh only the signed-in client's account details, without reloading reports. */
export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) return uncached(unauthorized());
    if (session.profile.role !== "client" || !session.profile.client_id) return uncached(forbidden());

    const supabase = await createClient();
    const { data, error } = await supabase.from("accounts")
      .select("*")
      .eq("client_id", session.profile.client_id)
      .order("platform")
      .order("page_name")
      .returns<AccountRow[]>();
    if (error) throw error;
    return uncached(apiOk({ accounts: data ?? [] }));
  } catch (error) {
    return uncached(serverError("portalAccounts", error));
  }
}
