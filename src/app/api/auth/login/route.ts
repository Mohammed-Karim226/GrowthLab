import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { homePathForRole } from "@/lib/auth";
import { apiError, apiOk, parseBody, serverError } from "@/lib/api";
import { defaultLocale, isLocale } from "@/lib/i18n";

const bodySchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
  /** UX hint only: decides where a valid account at the wrong door is sent. */
  expectedRole: z.enum(["admin", "client"]),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { email, password, expectedRole, locale: rawLocale } = parsed.data;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Deliberately generic — never reveal whether the address exists.
    if (error || !data.user) {
      return apiError(401, "invalidCredentials");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      return serverError("login:profile", profileError);
    }

    if (!profile) {
      await supabase.auth.signOut();
      return apiError(403, "noProfile");
    }

    if (profile.role === "client" && !profile.client_id) {
      await supabase.auth.signOut();
      return apiError(403, "noClient");
    }

    // Valid account, possibly wrong door: route to where the role belongs.
    return apiOk({
      redirectTo: homePathForRole(profile.role, locale),
      role: profile.role,
      wrongArea: profile.role !== expectedRole,
    });
  } catch (cause) {
    return serverError("login", cause);
  }
}
