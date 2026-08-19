import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only for operations RLS cannot express and the signed-in user genuinely may
 * perform — creating auth users for a new client, minting signed URLs for
 * admin-only screenshots. Every call site must have already established that
 * the caller is an admin (see requireAdmin in @/lib/auth).
 *
 * The `server-only` import makes bundling this into client code a build error.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
