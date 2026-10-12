/**
 * Exercise report deletion using real PostgreSQL permissions, cascades and
 * triggers. Requires migrations 0001-0009 and an owner DIRECT_URL (preferred)
 * or DATABASE_URL. Run: node scripts/verify-report-deletion.mjs
 *
 * Migration 0011 and random isolated fixtures run in one transaction that always
 * rolls back. No existing business rows change. No Storage or Inngest calls run.
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
  new URL("../supabase/migrations/0011_report_deletion_cleanup.sql", import.meta.url), "utf8"
);
const client = new pg.Client({
  connectionString,
  // Match the project's existing direct Supabase connection configuration.
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  query_timeout: 15_000,
  statement_timeout: 10_000,
  lock_timeout: 2_000,
  idle_in_transaction_session_timeout: 30_000,
  application_name: "verify-report-deletion",
});

const ids = Object.fromEntries([
  "admin", "clientUser", "client", "cascadeClient", "report", "otherReport",
  "publishedReport", "cascadeReport", "emptyReport",
].map((name) => [name, randomUUID()]));
const reportIds = [ids.report, ids.otherReport, ids.publishedReport, ids.cascadeReport, ids.emptyReport];
const versions = [
  { report: ids.report, status: "draft", jobStatuses: ["queued", "failed", "dead_letter"] },
  { report: ids.report, status: "approved", jobStatuses: ["processing"] },
  { report: ids.report, status: "archived", jobStatuses: ["completed"] },
  { report: ids.otherReport, status: "draft", jobStatuses: ["completed"] },
  { report: ids.publishedReport, status: "published", jobStatuses: ["completed"] },
  { report: ids.cascadeReport, status: "approved", jobStatuses: ["queued"] },
].map((fixture, index) => ({
  ...fixture,
  id: randomUUID(), batch: randomUUID(), number: index + 1,
  client: fixture.report === ids.cascadeReport ? ids.cascadeClient : ids.client,
  imageIds: [randomUUID(), randomUUID()],
  jobIds: fixture.jobStatuses.map(() => randomUUID()),
}));
const versionIds = versions.map((fixture) => fixture.id);
const batchIds = versions.map((fixture) => fixture.batch);
const pathsFor = (fixture) => fixture.imageIds.map((id) =>
  `clients/${fixture.client}/reports/${fixture.report}/versions/${fixture.id}/facebook/${id}.png`);
let stage = "connect";
let connected = false;
let transactionOpen = false;
let passed = 0;

async function identity(userId) {
  await client.query("reset role");
  await client.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
    [userId ?? "", JSON.stringify({ sub: userId, role: "authenticated" })]
  );
  await client.query("set local role authenticated");
}

async function remove(reportId = ids.report) {
  const { rows } = await client.query("select * from public.delete_report($1::uuid)", [reportId]);
  assert.equal(rows.length, 1, "Delete RPC must return a cleanup manifest");
  return rows[0];
}

async function graph(selectedReports = reportIds) {
  const selectedVersions = versions.filter((fixture) => selectedReports.includes(fixture.report));
  const { rows } = await client.query(`
    select
      (select jsonb_agg(to_jsonb(r) order by r.id) from public.reports r
        where r.id=any($1::uuid[])) as reports,
      (select jsonb_agg(to_jsonb(v) order by v.id) from public.report_versions v
        where v.id=any($2::uuid[])) as versions,
      (select jsonb_agg(to_jsonb(b) order by b.id) from public.insight_batches b
        where b.id=any($3::uuid[])) as batches,
      (select jsonb_agg(to_jsonb(i) order by i.id) from public.insight_images i
        where i.insight_batch_id=any($3::uuid[])) as images,
      (select jsonb_agg(to_jsonb(a) order by a.id) from public.ai_analyses a
        where a.insight_batch_id=any($3::uuid[])) as analyses,
      (select jsonb_agg(to_jsonb(m) order by m.id) from public.metrics m
        where m.report_version_id=any($2::uuid[])) as metrics,
      (select jsonb_agg(to_jsonb(j) order by j.id) from public.ai_jobs j
        where j.insight_batch_id=any($3::uuid[])) as jobs
  `, [selectedReports, selectedVersions.map((fixture) => fixture.id), selectedVersions.map((fixture) => fixture.batch)]);
  return rows[0];
}

async function snapshot() {
  const data = await graph();
  const { rows } = await client.query(`
    select
      (select jsonb_agg(to_jsonb(c) order by c.id) from public.clients c
        where c.id=any($1::uuid[])) as clients,
      (select jsonb_agg(to_jsonb(c) order by c.report_id) from public.report_deletion_cleanup c
        where c.report_id=any($2::uuid[])) as cleanup,
      (select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_logs a
        where a.entity_id=any($2::uuid[])) as audits
  `, [[ids.client, ids.cascadeClient], reportIds]);
  return { ...data, ...rows[0] };
}

async function expectSqlState(code, message, work) {
  await client.query("savepoint expected_error");
  let received;
  try {
    await work();
  } catch (error) {
    received = error;
  } finally {
    await client.query("rollback to savepoint expected_error");
    await client.query("release savepoint expected_error");
  }
  assert.equal(received?.code, code, `Expected SQLSTATE ${code}`);
  if (message) assert.equal(received.message, message);
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

async function denied(name, code, message, work) {
  await check(name, async () => {
    const before = await snapshot();
    await expectSqlState(code, message, work);
    await identity(ids.admin);
    assert.deepEqual(await snapshot(), before, "Denied deletion must leave the graph, cleanup and audit unchanged");
  });
}

async function verifyRemoved(reportId, cleanup) {
  assert.ok(Object.values(await graph([reportId])).every((value) => value === null),
    "The report, versions, batches, image rows, analyses, metrics and jobs must all be gone");
  const selected = versions.filter((fixture) => fixture.report === reportId);
  const clientId = reportId === ids.cascadeReport ? ids.cascadeClient : ids.client;
  assert.equal(cleanup.report_id, reportId);
  assert.equal(cleanup.storage_prefix, `clients/${clientId}/reports/${reportId}`);
  assert.deepEqual(cleanup.storage_paths, selected.flatMap(pathsFor).sort());
  assert.deepEqual(cleanup.job_ids, selected.flatMap((fixture) => fixture.jobIds).sort());
  for (const field of ["last_attempt_at", "storage_cleaned_at", "jobs_cancelled_at", "completed_at"]) {
    assert.equal(cleanup[field], null, `${field} must be unset until external cleanup runs`);
  }
  assert.ok(cleanup.created_at);
  const { rows } = await client.query(
    "select actor_id,action,entity_type,metadata from public.audit_logs where entity_id=$1", [reportId]
  );
  assert.deepEqual(rows, [{
    actor_id: ids.admin, action: "REPORT_DELETED", entity_type: "report",
    metadata: { image_count: cleanup.storage_paths.length, job_count: cleanup.job_ids.length, cleanup_pending: true },
  }]);
}

async function schemaState() {
  const { rows } = await client.query(`
    select
      (select jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by p.oid)
        from pg_proc p where p.oid in (to_regprocedure('public.delete_report(uuid)'),
          to_regprocedure('public.capture_report_deletion()'))) as functions,
      (select jsonb_build_object('rls',c.relrowsecurity,'acl',c.relacl::text)
        from pg_class c where c.oid=to_regclass('public.report_deletion_cleanup')) as cleanup_table,
      (select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t
        where t.tgrelid='public.reports'::regclass and t.tgname='capture_report_deletion') as triggers,
      (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p
        where p.schemaname='public' and p.tablename='report_deletion_cleanup') as policies
  `);
  return rows[0];
}

try {
  await client.connect();
  connected = true;
  const originalSchema = await schemaState();
  await client.query("begin");
  transactionOpen = true;
  stage = "check schema prerequisites";
  const prerequisite = await client.query(`
    select
      to_regprocedure('public.lock_editable_version(uuid)') is not null as fact_guard,
      to_regclass('public.ai_jobs') is not null as jobs,
      exists(select 1 from pg_trigger where tgrelid='public.metrics'::regclass
        and tgname='guard_metrics' and tgenabled <> 'D') as metric_guard,
      exists(select 1 from pg_trigger where tgrelid='public.report_versions'::regclass
        and tgname='guard_version' and tgenabled <> 'D') as version_guard,
      (select bool_and(relrowsecurity) from pg_class where oid in
        ('public.reports'::regclass,'public.profiles'::regclass)) as rls
  `);
  assert.ok(Object.values(prerequisite.rows[0]).every((value) => value === true),
    "Apply prerequisite report migrations before running verification");
  stage = "load migration 0011 inside rollback-only transaction";
  await client.query(migration);
  stage = "create isolated fixtures";
  await client.query(`
    insert into auth.users(id,aud,role,email,created_at,updated_at)
    values($1,'authenticated','authenticated',$3,now(),now()),
          ($2,'authenticated','authenticated',$4,now(),now())
  `, [ids.admin, ids.clientUser, `${ids.admin}@deletion-verification.invalid`, `${ids.clientUser}@deletion-verification.invalid`]);
  await client.query("insert into public.clients(id,name) values($1,'Deletion verification'),($2,'Cascade verification')",
    [ids.client, ids.cascadeClient]);
  await client.query("insert into public.profiles(id,role,client_id) values($1,'admin',null),($2,'client',$3)",
    [ids.admin, ids.clientUser, ids.client]);
  for (const reportId of reportIds) {
    await client.query(`
      insert into public.reports(id,client_id,title,period_start,period_end,created_by)
      values($1,$2,'Deletion verification','2026-10-01','2026-10-31',$3)
    `, [reportId, reportId === ids.cascadeReport ? ids.cascadeClient : ids.client, ids.admin]);
  }
  for (const fixture of versions) {
    await client.query(`
      insert into public.report_versions(id,report_id,version_number,summary,ai_summary,created_by)
      values($1,$2,$3,'Fixture narrative','{"summary":"Fixture AI copy"}'::jsonb,$4)
    `, [fixture.id, fixture.report, fixture.number, ids.admin]);
    await client.query("insert into public.insight_batches(id,report_version_id,platform) values($1,$2,'facebook')",
      [fixture.batch, fixture.id]);
    for (const [index, path] of pathsFor(fixture).entries()) {
      await client.query(`
        insert into public.insight_images(id,insight_batch_id,storage_path,mime_type,file_size,uploaded_by)
        values($1,$2,$3,'image/png',12,$4)
      `, [fixture.imageIds[index], fixture.batch, path, ids.admin]);
    }
    await client.query(`
      insert into public.ai_analyses(insight_batch_id,provider,model,status,raw_response,structured_response,created_by)
      values($1,'fixture','fixture','completed','fixture response','{}'::jsonb,$2)
    `, [fixture.batch, ids.admin]);
    await client.query(`
      insert into public.metrics(report_version_id,insight_batch_id,platform,metric_name,metric_value,source,needs_review)
      values($1,$2,'facebook','views',42,'ai',false),($1,null,'facebook','followers',12,'manual',false)
    `, [fixture.id, fixture.batch]);
    // Create jobs after images: the fact trigger intentionally rejects image
    // writes once an active job exists. Deletion must still remove those jobs.
    for (const [index, status] of fixture.jobStatuses.entries()) {
      await client.query(`
        insert into public.ai_jobs(id,insight_batch_id,status,requested_by)
        values($1,$2,$3::public.ai_job_status,$4)
      `, [fixture.jobIds[index], fixture.batch, status, ids.admin]);
    }
    if (fixture.status !== "draft") {
      await client.query("update public.insight_batches set status='approved' where id=$1", [fixture.batch]);
      await client.query("update public.report_versions set status=$2::public.report_status where id=$1", [fixture.id, fixture.status]);
    }
  }
  const published = versions.find((fixture) => fixture.status === "published");
  await client.query("update public.reports set current_published_version_id=$2 where id=$1", [ids.publishedReport, published.id]);
  await client.query("set constraints all immediate");
  await identity(ids.admin);
  assert.equal((await client.query("select public.is_admin() as allowed")).rows[0].allowed, true);

  await check("admin deletion removes all versions, analyses, metrics and every job status", async () => {
    const unrelatedIds = reportIds.filter((id) => id !== ids.report);
    const unrelated = await graph(unrelatedIds);
    await verifyRemoved(ids.report, await remove());
    assert.deepEqual(await graph(unrelatedIds), unrelated, "Other reports must remain unchanged");
  });

  await check("retry after deletion returns the same manifest without duplicate audit", async () => {
    const first = await remove();
    assert.deepEqual(await remove(), first);
    await verifyRemoved(ids.report, first);
  });

  await check("empty reports still create a durable cleanup manifest", async () => {
    await verifyRemoved(ids.emptyReport, await remove(ids.emptyReport));
  });

  await check("direct authenticated delete also captures cleanup and audit", async () => {
    await client.query("delete from public.reports where id=$1", [ids.report]);
    const { rows } = await client.query("select * from public.report_deletion_cleanup where report_id=$1", [ids.report]);
    assert.equal(rows.length, 1);
    await verifyRemoved(ids.report, rows[0]);
  });

  await check("client cascade captures cleanup before removing approved report graph", async () => {
    await client.query("delete from public.clients where id=$1", [ids.cascadeClient]);
    const { rows } = await client.query("select * from public.report_deletion_cleanup where report_id=$1", [ids.cascadeReport]);
    assert.equal(rows.length, 1, "Cleanup must survive client deletion");
    await verifyRemoved(ids.cascadeReport, rows[0]);
  });

  await check("rollback restores complete graph and removes cleanup and audit together", async () => {
    const before = await snapshot();
    await client.query("savepoint delete_unit");
    await verifyRemoved(ids.report, await remove());
    await client.query("rollback to savepoint delete_unit");
    await client.query("release savepoint delete_unit");
    assert.deepEqual(await snapshot(), before);
  });

  await denied("published report cannot be deleted through RPC", "55000", "published report", () => remove(ids.publishedReport));
  await denied("published report cannot bypass protection with direct DELETE", "55000", "published report", () =>
    client.query("delete from public.reports where id=$1", [ids.publishedReport]));
  await denied("missing report without a cleanup manifest returns not found", "55000", "report missing", () => remove(randomUUID()));
  for (const [name, user] of [["client", ids.clientUser], ["missing profile", randomUUID()]]) {
    await denied(`${name} cannot invoke the delete RPC`, "42501", "unauthorized", async () => {
      await identity(user);
      await remove();
    });
  }
  await denied("anonymous role has no delete RPC execute privilege", "42501", null, async () => {
    await client.query("reset role");
    await client.query("set local role anon");
    await remove();
  });

  await check("clients cannot inspect manifests or bypass deletion RLS", async () => {
    await remove();
    await identity(ids.clientUser);
    const cleanup = await client.query("select * from public.report_deletion_cleanup where report_id=$1", [ids.report]);
    assert.equal(cleanup.rows.length, 0);
    const deleted = await client.query("delete from public.reports where id=$1 returning id", [ids.otherReport]);
    assert.equal(deleted.rows.length, 0);
    await identity(ids.admin);
    assert.equal((await client.query("select id from public.reports where id=$1", [ids.otherReport])).rows.length, 1);
  });

  for (const [name, sql] of [
    ["insert", "insert into public.report_deletion_cleanup(report_id,storage_prefix) values($1,'forged')"],
    ["update", "update public.report_deletion_cleanup set completed_at=now() where report_id=$1"],
    ["delete", "delete from public.report_deletion_cleanup where report_id=$1"],
  ]) {
    await denied(`authenticated admins cannot ${name} cleanup manifests directly`, "42501", null, () => client.query(sql, [ids.report]));
  }

  await check("service worker can read and complete cleanup but cannot forge a manifest", async () => {
    await remove();
    await client.query("reset role");
    await client.query("set local role service_role");
    const { rows } = await client.query(`
      update public.report_deletion_cleanup
      set last_attempt_at=now(),storage_cleaned_at=now(),jobs_cancelled_at=now(),completed_at=now()
      where report_id=$1 returning *
    `, [ids.report]);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].last_attempt_at && rows[0].storage_cleaned_at && rows[0].jobs_cancelled_at && rows[0].completed_at);
    await expectSqlState("42501", null, () => client.query(
      "insert into public.report_deletion_cleanup(report_id,storage_prefix) values($1,'forged')", [randomUUID()]));
    assert.equal((await client.query("delete from public.report_deletion_cleanup where report_id=$1 returning report_id", [ids.report])).rows.length, 1);
  });

  stage = "rollback and confirm cleanup";
  await client.query("rollback");
  transactionOpen = false;
  assert.deepEqual(await schemaState(), originalSchema, "Migration definitions, grants and trigger must be rolled back");
  const cleanup = await client.query(`
    select exists(select 1 from auth.users where id=any($1::uuid[]))
      or exists(select 1 from public.clients where id=any($2::uuid[]))
      or exists(select 1 from public.reports where id=any($3::uuid[]))
      or exists(select 1 from public.report_versions where id=any($4::uuid[]))
      or exists(select 1 from public.insight_batches where id=any($5::uuid[]))
      or exists(select 1 from public.audit_logs where entity_id=any($3::uuid[])) as leaked
  `, [[ids.admin, ids.clientUser], [ids.client, ids.cascadeClient], reportIds, versionIds, batchIds]);
  assert.equal(cleanup.rows[0].leaked, false, "All synthetic fixtures must be rolled back");
  if (originalSchema.cleanup_table) {
    assert.equal((await client.query("select report_id from public.report_deletion_cleanup where report_id=any($1::uuid[])", [reportIds])).rows.length, 0);
  }
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
