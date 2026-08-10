import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, UserRole } from "@/types/database";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n";

export type SessionContext = {
  userId: string;
  email: string | null;
  profile: ProfileRow;
};

function safeLocale(locale: string): Locale {
  return isLocale(locale) ? locale : defaultLocale;
}

/**
 * Resolve the signed-in user and their profile.
 *
 * Uses getUser() rather than getSession() — getUser() revalidates the JWT with
 * the auth server, so a forged or stale cookie cannot fabricate a session.
 * Returns null when there is no valid user or no profile row.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
}

/** Where a given role belongs, used for both guards and post-login routing. */
export function homePathForRole(role: UserRole, locale: string): string {
  return role === "admin" ? `/${safeLocale(locale)}/admin` : `/${safeLocale(locale)}/portal`;
}

/**
 * Server-side admin guard. Every admin page and mutation calls this — route
 * guards alone are not a security boundary, and RLS is the second layer.
 */
export async function requireAdmin(locale: string): Promise<SessionContext> {
  const context = await getSessionContext();
  const safe = safeLocale(locale);

  if (!context) {
    redirect(`/${safe}/admin/login`);
  }

  if (context.profile.role !== "admin") {
    // Wrong role -> send them to their own dashboard rather than leaking that
    // the admin area exists.
    redirect(homePathForRole(context.profile.role, safe));
  }

  return context;
}

/** Server-side client-portal guard. Also asserts the tenant binding exists. */
export async function requireClient(
  locale: string
): Promise<SessionContext & { clientId: string }> {
  const context = await getSessionContext();
  const safe = safeLocale(locale);

  if (!context) {
    redirect(`/${safe}/portal/login`);
  }

  if (context.profile.role !== "client") {
    redirect(homePathForRole(context.profile.role, safe));
  }

  if (!context.profile.client_id) {
    // Should be impossible (DB check constraint), but never guess a tenant.
    redirect(`/${safe}/portal/login?error=no_client`);
  }

  return { ...context, clientId: context.profile.client_id };
}

/**
 * Admin guard for route handlers, which must return a response rather than
 * redirect. Returns the context, or null when the caller is not an admin.
 */
export async function requireAdminApi(): Promise<SessionContext | null> {
  const context = await getSessionContext();
  if (!context || context.profile.role !== "admin") return null;
  return context;
}
