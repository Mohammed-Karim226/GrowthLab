/**
 * Reset an existing admin's password through the Supabase Admin API.
 *
 *   node scripts/reset-admin-password.mjs admin@example.com 'new-password'
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
      // Missing files are fine; environment variables remain available.
    }
  }
}

loadEnvFiles();

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/reset-admin-password.mjs <email> <password>");
  process.exit(1);
}

if (password.length < 10) {
  console.error("Refusing to set an admin password under 10 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase URL or secret/service-role key.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let user = null;

for (let page = 1; !user; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });

  if (error) {
    console.error("Could not look up the auth user:", error.message);
    process.exit(1);
  }

  user = data.users.find(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
  );

  if (data.users.length < 100) break;
}

if (!user) {
  console.error(`No auth user found for ${email}.`);
  process.exit(1);
}

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .maybeSingle();

if (profileError) {
  console.error("Could not verify the user's profile:", profileError.message);
  process.exit(1);
}

if (profile?.role !== "admin") {
  console.error(`Refusing to reset ${email}: the user is not an admin.`);
  process.exit(1);
}

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  password,
});

if (updateError) {
  console.error("Could not update the admin password:", updateError.message);
  process.exit(1);
}

console.log(`Admin password updated: ${email}`);
