/**
 * Deep probe of migration 0001.
 *
 * The table check alone is not enough: tables can exist while the helper
 * functions, RLS policies or the storage bucket are missing, which is the
 * dangerous half-applied state. This reports each part separately.
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
        if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    } catch {
      // Missing file is fine.
    }
  }
}

loadEnvFiles();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, secretKey, options);
const anon = createClient(url, anonKey, options);

console.log("Row counts (service role, bypasses RLS)");
for (const table of ["clients", "accounts", "profiles", "reports", "report_versions", "insight_batches", "metrics"]) {
  const { count, error } = await service.from(table).select("*", { head: true, count: "exact" });
  console.log(`  ${table.padEnd(16)} ${error ? `error: ${error.message}` : `${count} row(s)`}`);
}

console.log("\nRLS enforcement (anon key — every one of these must be denied or empty)");
for (const table of ["clients", "accounts", "profiles", "reports", "report_versions", "insight_batches", "metrics"]) {
  const { data, error } = await anon.from(table).select("id").limit(1);
  const rows = data?.length ?? 0;
  console.log(
    `  ${table.padEnd(16)} ${
      error ? `denied (${error.code ?? "error"})` : rows === 0 ? "0 rows" : `LEAKED ${rows}`
    }`
  );
}

console.log("\nSECURITY DEFINER helpers");
for (const fn of ["auth_role", "auth_client_id", "is_admin"]) {
  const { error } = await service.rpc(fn);
  // PGRST202 = function not found in the schema cache.
  console.log(`  ${fn.padEnd(16)} ${error?.code === "PGRST202" ? "MISSING" : "present"}`);
}

console.log("\nStorage");
const { data: buckets } = await service.storage.listBuckets();
console.log(`  buckets          ${(buckets ?? []).map((b) => b.id).join(", ") || "(none)"}`);
