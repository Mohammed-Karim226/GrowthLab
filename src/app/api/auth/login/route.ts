import { z } from "zod";
import { createLoginClient } from "@/lib/supabase/login";
import { homePathForRole } from "@/lib/auth";
import { apiError, apiOk, parseBody, serverError } from "@/lib/api";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { errorCategory, logEvent } from "@/lib/security/logging";

const bodySchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
  /** Requested login area; authorization always uses the stored profile role. */
  expectedRole: z.enum(["admin", "client"]),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { email, password, expectedRole, locale: rawLocale } = parsed.data;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  let login: Awaited<ReturnType<typeof createLoginClient>> | undefined;
  let accepted = false;

  try {
    login = await createLoginClient();
    const { supabase } = login;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Deliberately generic — never reveal whether the address exists.
    if (error || !data.user || !data.session) {
      return apiError(401, "invalidCredentials");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      return serverError("login:profile", profileError);
    }

    if (!profile) {
      return apiError(403, "noProfile");
    }

    // A valid password for the other area must not create a browser session
    // or reveal the account's role or dashboard location.
    if (profile.role !== expectedRole) {
      return apiError(401, "invalidCredentials");
    }

    if (profile.role === "client" && !profile.client_id) {
      return apiError(403, "noClient");
    }

    const response = apiOk({
      redirectTo: homePathForRole(profile.role, locale),
    });
    response.headers.set("cache-control", "no-store");
    login.commitCookies(response);
    accepted = true;
    return response;
  } catch (cause) {
    return serverError("login", cause);
  } finally {
    if (login && !accepted) {
      // Only revoke this attempt, never the user's sessions on other devices.
      // Cookie isolation above remains effective if the provider is unavailable.
      try {
        const { error } = await login.supabase.auth.signOut({ scope: "local" });
        if (error) logEvent({ operation: "login:cleanup", outcome: "error", category: errorCategory(error) });
      } catch (cause) {
        logEvent({ operation: "login:cleanup", outcome: "error", category: errorCategory(cause) });
      }
    }
  }
}
