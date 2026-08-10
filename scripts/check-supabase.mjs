/**
 * Connectivity + migration check.
 *
 * Answers two questions before anything else runs: can we reach the project with
 * the keys provided, and has migration 0001 been applied? Prints nothing that
 * could reveal a key.
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

console.log("Configuration");
console.log(`  URL              ${url ? "set" : "MISSING"}`);
console.log(`  publishable/anon ${anonKey ? "set" : "MISSING"}`);
console.log(`  secret/service   ${secretKey ? "set" : "MISSING"}`);
console.log(`  GEMINI_API_KEY   ${process.env.GEMINI_API_KEY ? "set" : "MISSING"}`);

if (!url || !anonKey || !secretKey) process.exit(1);

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, secretKey, options);

console.log("\nReachability");
const { error: authError } = await service.auth.admin.listUsers({ page: 1, perPage: 1 });
console.log(`  auth admin API   ${authError ? `FAILED — ${authError.message}` : "ok"}`);

console.log("\nMigration 0001");
const TABLES = [
  "clients",
  "profiles",
  "reports",
  "report_versions",
  "insight_batches",
  "insight_images",
  "ai_analyses",
  "metrics",
  "audit_logs",
];

let present = 0;
const missing = [];

for (const table of TABLES) {
  const { count, error } = await service.from(table).select("*", { head: true, count: "exact" });
  // A missing table can come back either as an error (PGRST205, "not found in
  // the schema cache") or, on a HEAD request, as a quiet null count. Treating
  // "no error" as "table exists" reported 9/9 against an empty database.
  if (error || count === null) missing.push(table);
  else present += 1;
}

console.log(`  tables           ${present}/${TABLES.length} present`);
if (missing.length > 0) console.log(`  missing          ${missing.join(", ")}`);

const { data: buckets, error: bucketError } = await service.storage.listBuckets();
const insights = (buckets ?? []).find((bucket) => bucket.id === "insights");
console.log(
  `  storage bucket   ${
    bucketError
      ? `could not list — ${bucketError.message}`
      : insights
        ? `"insights" present (public: ${insights.public})`
        : "MISSING"
  }`
);

const applied = missing.length === 0 && Boolean(insights);
console.log(`\n${applied ? "Migration 0001 is applied." : "Migration 0001 has NOT been applied."}`);
process.exit(applied ? 0 : 2);
