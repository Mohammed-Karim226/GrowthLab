/**
 * Apply a SQL migration over a direct Postgres connection.
 *
 * The REST API cannot run DDL, and this project has neither psql nor the
 * Supabase CLI available, so the migration is sent over the wire from Node.
 *
 * Two connection strings exist and only one of them is correct here:
 *   DATABASE_URL  port 6543, pgbouncer=true — transaction pooler. Rewrites and
 *                 multiplexes statements; unsuitable for DDL batches.
 *   DIRECT_URL    port 5432 — session mode. The right endpoint for migrations.
 *
 * The whole file runs inside one transaction, so a failure half-way leaves the
 * database exactly as it was rather than in a partly-migrated state.
 *
 *   node scripts/apply-migration.mjs supabase/migrations/0001_init.sql
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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

const file = process.argv[2];

if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to-.sql>");
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Set DIRECT_URL (preferred) or DATABASE_URL in .env.local or .env first.");
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.warn(
    "Warning: falling back to DATABASE_URL. If that is the pgbouncer pooler on 6543,\n" +
      "DDL may fail. Prefer DIRECT_URL (port 5432, session mode)."
  );
}

const sql = readFileSync(resolve(process.cwd(), file), "utf8");

// Supabase requires TLS; its pooler presents a certificate this client cannot
// chain to a local root store, so verification is relaxed for this one-off
// admin connection. The transport is still encrypted.
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300_000,
});

console.log(`Applying ${file}`);
console.log(`  bytes            ${sql.length}`);

try {
  await client.connect();
} catch (error) {
  console.error(`Could not connect: ${error.message}`);
  process.exit(1);
}

const { rows: whoami } = await client.query(
  "select current_database() as db, current_user as usr, version() as version"
);
console.log(`  database         ${whoami[0].db}`);
console.log(`  role             ${whoami[0].usr}`);
console.log(`  server           ${whoami[0].version.split(" ").slice(0, 2).join(" ")}`);

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("\nMigration applied and committed.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("\nMigration FAILED — rolled back, database unchanged.");
  console.error(`  ${error.message}`);
  if (error.position) {
    const upto = sql.slice(0, Number(error.position));
    const line = upto.split(/\n/).length;
    console.error(`  at line ${line}: ${sql.split(/\n/)[line - 1]?.trim()}`);
  }
  await client.end();
  process.exit(1);
}

await client.end();
