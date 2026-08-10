import { createClient } from "@/lib/supabase/server";
import { apiOk, serverError } from "@/lib/api";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return apiOk({ ok: true });
  } catch (cause) {
    return serverError("logout", cause);
  }
}
