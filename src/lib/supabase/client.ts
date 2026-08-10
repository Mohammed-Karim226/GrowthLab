"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Browser Supabase client. Uses the anon key, so every query is still subject
 * to RLS. Memoised because @supabase/ssr expects a single instance per tab.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  }
  return client;
}
