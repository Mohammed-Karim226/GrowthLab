/**
 * Create the first admin account.
 *
 * There is no public sign-up anywhere in this system, so the very first admin
 * has to be created out of band. Run once after applying migration 0001:
 *
 *   node scripts/bootstrap-admin.mjs admin@growthlab.com 'a-strong-password' 'Full Name'
 *
 * Reads the Supabase URL and secret/service-role key from .env.local or .env.
 * The password is taken from argv and never written to the database.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Load .env.local then .env, first definition winning — the same precedence
 * Next.js applies, so a script and the app never disagree about a value.
 */
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (!match) continue;
        const [, key, value] = match;
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Missing file is fine; fall through to real environment variables.
    }
  }
}

loadEnvFiles();

const [email, password, fullName] = process.argv.slice(2);

if (!email || !password) {
  console.error(
    "Usage: node scripts/bootstrap-admin.mjs <email> <password> [full name]"
  );
  process.exit(1);
}

if (password.length < 10) {
  console.error("Refusing to create an admin with a password under 10 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing Supabase URL or secret key. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and\n" +
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local or .env first."
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName ?? null },
});

if (createError || !created.user) {
  console.error("Could not create the auth user:", createError?.message);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: created.user.id,
    role: "admin",
    client_id: null,
    full_name: fullName ?? null,
  },
  { onConflict: "id" }
);

if (profileError) {
  // Don't leave an auth user with no profile behind.
  await admin.auth.admin.deleteUser(created.user.id);
  console.error("Could not create the admin profile:", profileError.message);
  process.exit(1);
}

console.log(`Admin created: ${email}`);
console.log("Sign in at /en/admin/login and change the password.");
