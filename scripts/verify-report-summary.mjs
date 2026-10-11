/**
 * Exercise the summary RPC with PostgreSQL's real permissions and triggers.
 * Requires migrations 0001-0009 and an owner connection in DIRECT_URL (preferred)
 * or DATABASE_URL. Run: node scripts/verify-report-summary.mjs
 *
 * Migration 0010 and random, isolated fixtures run inside one transaction that
 * always rolls back. No existing business rows are changed and nothing commits.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  try {
    const raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DIRECT_URL (preferred) or DATABASE_URL in .env.local or .env.");
  process.exit(1);
}

const migration = readFileSync(
  new URL("../supabase/migrations/0010_report_summary.sql", import.meta.url), "utf8"
);
const client = new pg.Client({
  connectionString,
  // Match the project's direct Supabase connection configuration.
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  query_timeout: 15_000,
  statement_timeout: 10_000,
  lock_timeout: 2_000,
  idle_in_transaction_session_timeout: 30_000,
  application_name: "verify-report-summary",
});

const ids = Object.fromEntries(
  ["admin", "clientUser", "client", "report", "otherReport", "draft", "approved", "published", "archived"]
    .map((name) => [name, randomUUID()])
);
const versionNames = ["draft", "approved", "published", "archived"];
const versionIds = versionNames.map((name) => ids[name]);
const batches = Object.fromEntries(versionNames.map((name) => [name, randomUUID()]));
const generated = {
  summary: "Verified summary", went_well: ["Growth"], what_changed: [],
  needs_attention: [], recommendations: [], generated_at: "2026-10-11T00:00:00.000Z",
};
const original = { ...generated, summary: "Original summary" };
const revisions = {};
let stage = "connect";
let connected = false;
let transactionOpen = false;
let passed = 0;

async function identity(userId) {
  await client.query("reset role");
  await client.query(
    "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [userId ?? "", JSON.stringify({ sub: userId, role: "authenticated" })]
  );
  await client.query("set local role authenticated");
}

async function save(name, action, options = {}) {
  const result = await client.query(
    "select * from public.save_report_summary($1::uuid,$2::uuid,$3::integer,$4::jsonb,$5::text,$6::jsonb)",
    [options.report ?? ids.report, ids[name],
      Object.hasOwn(options, "revision") ? options.revision : revisions[name],
      Object.hasOwn(options, "summary") ? options.summary : JSON.stringify(generated),
      action, Object.hasOwn(options, "metadata") ? options.metadata : "{}"]
  );
  assert.equal(result.rows.length, 1, "RPC must return the saved version");
  return result.rows[0];
}

async function expectSqlState(code, work) {
  await client.query("savepoint expected_error");
  let received;
  try {
    await work();
  } catch (error) {
    received = error.code;
  } finally {
    await client.query("rollback to savepoint expected_error");
    await client.query("release savepoint expected_error");
  }
  assert.equal(received, code, `Expected SQLSTATE ${code}`);
}

async function snapshot() {
  const { rows } = await client.query(`
    select
      (select jsonb_agg(to_jsonb(v) order by v.id) from public.report_versions v
        where v.id=any($1::uuid[])) as versions,
      (select jsonb_agg(to_jsonb(b) order by b.id) from public.insight_batches b
        where b.report_version_id=any($1::uuid[])) as batches,
      (select jsonb_agg(to_jsonb(r) order by r.id) from public.reports r
        where r.id=any($2::uuid[])) as reports,
      (select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_logs a
        where a.entity_id=any($1::uuid[])) as audits
  `, [versionIds, [ids.report, ids.otherReport]]);
  return rows[0];
}

async function check(name, work) {
  stage = name;
  await client.query("savepoint verification_case");
  try {
    await work();
    passed++;
    console.log(`PASS ${name}`);
  } finally {
    await client.query("rollback to savepoint verification_case");
    await client.query("release savepoint verification_case");
  }
}

async function denied(name, code, work) {
  await check(name, async () => {
    const before = await snapshot();
    await expectSqlState(code, work);
    await identity(ids.admin);
    assert.deepEqual(await snapshot(), before, "Denied save must not change versions, batches, reports or audit");
  });
}

async function functionState() {
  const { rows } = await client.query(`
    select pg_get_functiondef(p.oid) as definition, p.proacl::text as privileges
    from pg_proc p
    where p.oid=to_regprocedure('public.save_report_summary(uuid,uuid,integer,jsonb,text,jsonb)')
  `);
  return rows;
}

try {
  await client.connect();
  connected = true;
  const originalFunction = await functionState();
  await client.query("begin");
  transactionOpen = true;
  stage = "check schema prerequisites";
  const prerequisite = await client.query(`
    select
      to_regprocedure('public.transition_report(uuid,uuid,integer,uuid,text)') is not null as transitions,
      to_regprocedure('public.lock_editable_version(uuid)') is not null as fact_guard,
      exists(select 1 from pg_attribute where attrelid='public.report_versions'::regclass
        and attname='revision' and not attisdropped) as revisions,
      exists(select 1 from pg_trigger where tgrelid='public.report_versions'::regclass
        and tgname='guard_version' and tgenabled <> 'D') as version_guard,
      (select bool_and(relrowsecurity) from pg_class where oid in
        ('public.report_versions'::regclass,'public.profiles'::regclass)) as rls
  `);
  assert.ok(Object.values(prerequisite.rows[0]).every((value) => value === true),
    "Apply prerequisite report migrations before running verification");
  stage = "load migration 0010 inside rollback-only transaction";
  await client.query(migration);
  stage = "create isolated fixtures";
  await client.query(`
    insert into auth.users(id,aud,role,email,created_at,updated_at)
    values ($1,'authenticated','authenticated',$3,now(),now()),
           ($2,'authenticated','authenticated',$4,now(),now())
  `, [ids.admin, ids.clientUser, `${ids.admin}@summary-verification.invalid`, `${ids.clientUser}@summary-verification.invalid`]);
  await client.query("insert into public.clients(id,name) values($1,'Summary verification fixture')", [ids.client]);
  await client.query(`
    insert into public.profiles(id,role,client_id)
    values($1,'admin',null),($2,'client',$3)
  `, [ids.admin, ids.clientUser, ids.client]);
  await client.query(`
    insert into public.reports(id,client_id,title,period_start,period_end,created_by)
    values($1,$3,'Summary verification','2026-10-01','2026-10-31',$4),
          ($2,$3,'Other summary verification','2026-10-01','2026-10-31',$4)
  `, [ids.report, ids.otherReport, ids.client, ids.admin]);
  for (const [index, name] of versionNames.entries()) {
    await client.query(`
      insert into public.report_versions(id,report_id,version_number,summary,ai_summary,created_by)
      values($1,$2,$3,'Original plain-text summary',$4::jsonb,$5)
    `, [ids[name], ids.report, index + 1, name === "draft" ? null : JSON.stringify(original), ids.admin]);
    await client.query(`
      insert into public.insight_batches(id,report_version_id,platform)
      values($1,$2,'facebook')
    `, [batches[name], ids[name]]);
    if (name !== "draft") {
      await client.query("update public.insight_batches set status='approved' where id=$1", [batches[name]]);
      await client.query("update public.report_versions set status=$2::public.report_status where id=$1", [ids[name], name]);
    }
  }
  await client.query("update public.reports set current_published_version_id=$2 where id=$1", [ids.report, ids.published]);
  // Validate publication/FK invariants even though the fixture transaction rolls back.
  await client.query("set constraints all immediate");
  const { rows } = await client.query("select id,revision from public.report_versions where id=any($1::uuid[])", [versionIds]);
  for (const name of versionNames) revisions[name] = rows.find((row) => row.id === ids[name]).revision;
  await identity(ids.admin);
  assert.equal((await client.query("select public.is_admin() as allowed")).rows[0].allowed, true);

  await denied("authenticated admin cannot update status directly", "42501", () =>
    client.query("update public.report_versions set status='needs_review' where id=$1", [ids.draft]));

  await check("generation saves summary and audit with authenticated privileges", async () => {
    const saved = await save("draft", "generate", { metadata: JSON.stringify({
      locale: "ar", report_id: ids.otherReport, version_number: -1,
      required_reapproval: true, regenerated: true,
    }) });
    assert.equal(saved.status, "needs_review");
    assert.equal(saved.revision, revisions.draft + 1);
    assert.deepEqual(saved.ai_summary, generated);
    assert.equal(saved.summary, "Original plain-text summary");
    const { rows: audits } = await client.query("select actor_id,action,entity_type,metadata from public.audit_logs where entity_id=$1", [ids.draft]);
    assert.deepEqual(audits, [{ actor_id: ids.admin, action: "SUMMARY_GENERATED", entity_type: "report_version",
      metadata: { locale: "ar", report_id: ids.report, version_number: 1, required_reapproval: false, regenerated: false } }]);
  });

  await check("editing an editable version preserves its status", async () => {
    const saved = await save("draft", "edit", { metadata: null });
    assert.equal(saved.status, "draft");
    assert.deepEqual(saved.ai_summary, generated);
  });

  for (const action of ["generate", "edit"]) {
    await check(`${action} reopens approved version and batches atomically`, async () => {
      const saved = await save("approved", action);
      assert.equal(saved.status, "needs_review");
      assert.equal(saved.revision, revisions.approved + 2);
      assert.deepEqual(saved.ai_summary, generated);
      assert.equal((await client.query("select status from public.insight_batches where id=$1", [batches.approved])).rows[0].status, "needs_review");
      const { rows: audits } = await client.query("select action,metadata from public.audit_logs where entity_id=$1 order by action", [ids.approved]);
      assert.deepEqual(audits.map((row) => row.action), ["REPORT_REOPEN", action === "generate" ? "SUMMARY_GENERATED" : "SUMMARY_EDITED"]);
      assert.equal(audits[1].metadata.required_reapproval, true);
      assert.equal(audits[1].metadata.regenerated, action === "generate" ? true : undefined);
      assert.equal((await client.query("select current_published_version_id from public.reports where id=$1", [ids.report])).rows[0].current_published_version_id, ids.published);
    });
  }

  await check("rollback restores approval, summary, batches and audit together", async () => {
    const before = await snapshot();
    await client.query("savepoint summary_unit");
    await save("approved", "edit");
    assert.notDeepEqual(await snapshot(), before);
    await client.query("rollback to savepoint summary_unit");
    await client.query("release savepoint summary_unit");
    assert.deepEqual(await snapshot(), before);
  });

  await denied("stale revision cannot overwrite a summary", "40001", () => save("draft", "generate", { revision: revisions.draft - 1 }));
  await denied("NULL revision cannot bypass the concurrency guard", "40001", () => save("approved", "edit", { revision: null }));
  await denied("version from another report is rejected", "55000", () => save("draft", "generate", { report: ids.otherReport }));
  for (const name of ["published", "archived"]) {
    for (const action of ["generate", "edit"]) {
      await denied(`${action} preserves ${name} version`, "55000", () => save(name, action));
    }
  }
  for (const status of ["queued", "processing"]) {
    await check(`${status} AI job prevents reopening and saving`, async () => {
      await client.query("reset role");
      await client.query("insert into public.ai_jobs(insight_batch_id,status,requested_by) values($1,$2::public.ai_job_status,$3)", [batches.approved, status, ids.admin]);
      await identity(ids.admin);
      const before = await snapshot();
      await expectSqlState("55000", () => save("approved", "edit"));
      assert.deepEqual(await snapshot(), before);
    });
  }
  for (const [name, user] of [["client", ids.clientUser], ["missing profile", randomUUID()]]) {
    await denied(`${name} cannot invoke the summary RPC`, "42501", async () => {
      await identity(user);
      await save("draft", "generate");
    });
  }
  await denied("anonymous role has no execute privilege", "42501", async () => {
    await client.query("reset role");
    await client.query("set local role anon");
    await save("draft", "generate");
  });
  for (const action of [null, "publish"]) {
    await denied(`invalid action ${String(action)} cannot change an approved version`, "22023", () => save("approved", action));
  }
  for (const summary of [null, "null", "[]", '"text"']) {
    await denied(`invalid summary ${String(summary)} cannot withdraw approval`, "22023", () => save("approved", "edit", { summary }));
  }
  await denied("invalid metadata cannot withdraw approval", "22023", () => save("approved", "edit", { metadata: "[]" }));

  stage = "rollback and confirm cleanup";
  await client.query("rollback");
  transactionOpen = false;
  assert.deepEqual(await functionState(), originalFunction, "Migration definition and grants must be rolled back");
  const cleanup = await client.query(`
    select exists(select 1 from auth.users where id=any($1::uuid[]))
      or exists(select 1 from public.clients where id=$2::uuid)
      or exists(select 1 from public.reports where id=any($3::uuid[]))
      or exists(select 1 from public.report_versions where id=any($4::uuid[]))
      or exists(select 1 from public.audit_logs where entity_id=any($4::uuid[])) as leaked
  `, [[ids.admin, ids.clientUser], ids.client, [ids.report, ids.otherReport], versionIds]);
  assert.equal(cleanup.rows[0].leaked, false, "All synthetic fixtures must be rolled back");
  console.log(`\n${passed} PostgreSQL checks passed. Migration and fixtures rolled back.`);
} catch (error) {
  // Never log connection strings, credentials or raw database error details.
  const code = /^[A-Z0-9_]+$/.test(error.code ?? "") ? error.code : "ERROR";
  console.error(`FAIL ${stage} (${code})`);
  process.exitCode = 1;
} finally {
  if (connected) {
    if (transactionOpen) {
      await client.query("rollback").catch(() => {});
      console.log("Verification transaction rolled back; no changes committed.");
    }
    await client.end().catch(() => {});
  }
}
