import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Keep a password login private until the route has authorized the profile. */
export async function createLoginClient() {
  const cookieStore = await cookies();
  // Retain names for Supabase's stale-cookie/chunk cleanup, but never load or
  // refresh an existing browser session during a new login attempt.
  const cookieJar = new Map(cookieStore.getAll().map(({ name }) => [name, ""]));
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieJar.set(cookie.name, cookie.value);
          pending.set(cookie.name, cookie);
        }
      },
    },
  });

  return {
    supabase,
    commitCookies(response: NextResponse) {
      // Write only to the approved response. An error response must never
      // inherit a session, even when Supabase signOut fails.
      for (const { name, value, options } of pending.values()) {
        response.cookies.set(name, value, options);
      }
    },
  };
}
