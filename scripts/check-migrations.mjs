/** Read-only audit of all local migrations against the configured Supabase database. */
import { readFileSync } from "node:fs";
import pg from "pg";
import { checkMigrations, readMigrations, readSchema } from "./lib/migration-checks.mjs";

for (const file of [".env.local", ".env"]) {
  try {
    const raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DIRECT_URL (preferred) or DATABASE_URL in .env.local before running db:migrations:check.");
  process.exit(1);
}

let connectionUrl;
try {
  connectionUrl = new URL(connectionString);
} catch {
  console.error("DIRECT_URL / DATABASE_URL must be a valid PostgreSQL connection URL.");
  process.exit(1);
}
const appUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const appProject = appUrl ? /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i.exec(appUrl)?.[1] : null;
const databaseProject = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(connectionUrl.hostname)?.[1]
  ?? /^postgres\.([a-z0-9]+)$/i.exec(decodeURIComponent(connectionUrl.username))?.[1];
if (appProject && databaseProject && appProject !== databaseProject) {
  console.error("The database connection and app Supabase URL target different projects. Correct .env.local before checking migrations.");
  process.exit(1);
}
const localDatabase = ["localhost", "127.0.0.1", "[::1]"].includes(connectionUrl.hostname);
const client = new pg.Client({
  connectionString,
  ssl: localDatabase ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
  application_name: "check-migrations",
});

try {
  await client.connect();
  await client.query("begin isolation level repeatable read read only");
  const migrations = readMigrations(new URL("../supabase/migrations/", import.meta.url));
  const schema = await readSchema(client);
  const results = checkMigrations(migrations, schema);
  await client.query("rollback");

  for (const result of results) {
    console.log(`${result.failures.length ? "FAIL" : "OK  "} ${result.name}`);
    for (const failure of result.failures) console.log(`     ${failure}`);
  }
  const failed = results.filter((result) => result.failures.length);
  if (failed.length) {
    console.error(`\n${failed.length} migration(s) have missing or outdated schema effects. Database unchanged.`);
    console.error("Review each failed migration before applying it. Earlier migrations can overwrite later changes.");
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} migration schema checks passed. Database unchanged.`);
    console.log("This verifies deployed schema effects, not historical migration receipts.");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`Migration check failed (${error.code ?? "connection_or_query_error"}). Database unchanged.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
