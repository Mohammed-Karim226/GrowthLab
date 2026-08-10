import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { locales } from "@/lib/i18n";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Supabase session refresh + coarse route protection.
 * (Next 16 `proxy` convention, formerly `middleware`.)
 *
 * Deliberately narrow (see plan §46):
 *   - refreshes the auth cookie so Server Components see a live session
 *   - bounces obviously-unauthenticated traffic away from /admin and /portal
 *
 * It does NOT do role checks or any database authorization — that lives in
 * requireAdmin/requireClient and in RLS. It also does NOT touch locale
 * routing: this project resolves locales through the [locale] segment and
 * next-intl's getRequestConfig, so there is no locale middleware to conflict
 * with and none is introduced here.
 */

const LOCALE_PREFIX = `(?:${locales.join("|")})`;
const ADMIN_AREA = new RegExp(`^/${LOCALE_PREFIX}/admin(?:/|$)`);
const PORTAL_AREA = new RegExp(`^/${LOCALE_PREFIX}/portal(?:/|$)`);
const LOGIN_PAGE = new RegExp(`^/${LOCALE_PREFIX}/(?:admin|portal)/login/?$`);

function localeOf(pathname: string): string {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as (typeof locales)[number]) ? segment : locales[0];
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedArea = ADMIN_AREA.test(pathname) || PORTAL_AREA.test(pathname);

  // Marketing site and API routes: leave the request completely untouched.
  if (!isProtectedArea) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the session cookie as a side effect. Must not be removed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !LOGIN_PAGE.test(pathname)) {
    const locale = localeOf(pathname);
    const area = ADMIN_AREA.test(pathname) ? "admin" : "portal";
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/${area}/login`;
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/:locale(en|ar)/admin/:path*", "/:locale(en|ar)/portal/:path*"],
};
