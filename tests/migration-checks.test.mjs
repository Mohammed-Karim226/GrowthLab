import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMigrations, contracts, functionContracts, readMigrations, readSchema } from "../scripts/lib/migration-checks.mjs";

const migrations = readMigrations(new URL("../supabase/migrations/", import.meta.url));

function deployedSchema() {
  const schema = Object.fromEntries(["relations", "columns", "policies", "triggers", "constraints", "enums", "functions", "buckets"].map((key) => [key, new Map()]));
  for (const migration of migrations) {
    for (const item of contracts[migration.name]) {
      const maps = { column: "columns", policy: "policies", trigger: "triggers", constraint: "constraints", enum: "enums", bucket: "buckets", execute: "functions", columnPrivilege: "columns", table: "relations", index: "relations" };
      const rows = schema[maps[item.kind]];
      const row = rows.get(item.name) ?? { name: item.name };
      if (item.kind === "table") Object.assign(row, { relkind: "r", relrowsecurity: true });
      if (item.kind === "index") Object.assign(row, { relkind: "i", valid: true });
      if (item.kind === "trigger") row.enabled = true;
      if (item.kind === "constraint") row.valid = true;
      if (item.kind === "bucket") row.public = false;
      if (item.kind === "execute") row[item.role] = item.allowed;
      if (item.kind === "columnPrivilege") row[`${item.role}_${item.privilege.toLowerCase()}`] = item.allowed;
      rows.set(item.name, row);
    }
  }
  for (const item of functionContracts(migrations)) {
    schema.functions.set(item.name, { ...schema.functions.get(item.name), name: item.name, args: item.args, body: item.body, language: item.language, security_definer: item.securityDefiner });
  }
  return schema;
}

test("all SQL files are checked, including migrations sharing numeric prefixes", () => {
  assert.equal(migrations.length, 18);
  assert.ok(migrations.some((item) => item.name === "0003_ai_jobs.sql"));
  assert.ok(migrations.some((item) => item.name === "0003_client_payment_plans.sql"));
  assert.ok(checkMigrations(migrations, deployedSchema()).every((item) => item.failures.length === 0));
});

test("replacement functions are verified against their newest definition", () => {
  const functions = functionContracts(migrations);
  const claim = functions.find((item) => item.name === "claim_ai_job(text,integer)");
  assert.equal(claim.migration, "0004_ai_job_lease_recovery.sql");
  assert.ok(claim.body.includes("Worker lease expired after the final attempt"));
  const transition = functions.find((item) => item.name === "transition_report(uuid,uuid,integer,uuid,text)");
  assert.equal(transition.migration, "0013_restore_report_functions.sql");
  assert.ok(transition.body.includes("v.revision is distinct from p_revision"));
  assert.equal(functions.find((item) => item.name === "auth_client_id()").migration, "0013_restore_report_functions.sql");
  const attribution = functions.find((item) => item.name === "portal_attribution(uuid[])");
  assert.equal(attribution.args, "p_versions uuid[]");
});

test("missing deletion RPC identifies the migration required by PGRST202", () => {
  const schema = deployedSchema();
  schema.functions.delete("delete_report(uuid)");
  const failures = checkMigrations(migrations, schema).filter((item) => item.failures.length);
  assert.deepEqual(failures.map((item) => item.name), ["0011_report_deletion_cleanup.sql"]);
  assert.ok(failures[0].failures.includes("function: delete_report(uuid)"));
});

test("account audience migration checks its column and count constraint", () => {
  const schema = deployedSchema();
  schema.columns.delete("public.accounts.audience_count");
  schema.constraints.get("public.accounts.accounts_audience_count_check").valid = false;
  const result = checkMigrations(migrations, schema).find((item) => item.name === "0014_account_audience.sql");
  assert.deepEqual(result.failures, ["column: public.accounts.audience_count", "constraint: public.accounts.accounts_audience_count_check"]);
});

test("changed function bodies, RPC arguments, language and security mode fail verification", () => {
  for (const patch of [{ body: "begin return null; end" }, { args: "report_id uuid" }, { language: "sql" }, { security_definer: false }]) {
    const schema = deployedSchema();
    Object.assign(schema.functions.get("delete_report(uuid)"), patch);
    assert.ok(checkMigrations(migrations, schema).find((item) => item.name === "0011_report_deletion_cleanup.sql").failures.length);
  }
});

test("SQL formatting, keyword casing and comments do not cause function failures", () => {
  const schema = deployedSchema();
  schema.functions.get("auth_client_id()").body = `
    SELECT p.client_id FROM public.profiles p
    /* tenant lookup /* nested comment */ */ JOIN public.clients c ON c.id = p.client_id
    WHERE p.id = auth.uid() -- the signed-in client
      AND p.role = 'client' AND c.is_active ;
  `;
  assert.ok(checkMigrations(migrations, schema).every((item) => item.failures.length === 0));
});

function bodyFailures(expected, actual) {
  const files = [{
    name: "0009_report_publication_fixes.sql",
    sql: `create function public.check_body() returns text language sql as $$${expected}$$;`,
  }];
  const schema = deployedSchema();
  schema.functions.set("check_body()", { args: "", body: actual, language: "sql", security_definer: false });
  return checkMigrations(files, schema)[0].failures;
}

test("quoted SQL values retain casing, whitespace and comment-like text", () => {
  const quoted = `select 'Client -- /* note */', 'it''s private', "Account Name", E'it\\'s -- private', $body$a /* note */$body$;`;
  assert.equal(bodyFailures(quoted, quoted.replace("select", "SELECT\n")).length, 0);
  for (const [before, after] of [
    ["Client", "client"], ["Account Name", "account name"],
    ["it''s private", "it''s  private"], ["a /* note */", "a"],
  ]) {
    assert.equal(bodyFailures(quoted, quoted.replace(before, after)).length, 1);
  }
});

test("operator and word boundaries are preserved", () => {
  assert.equal(bodyFailures("select 1 <= 2;", "SELECT 1<=2 ;").length, 0);
  assert.equal(bodyFailures("select 1 <= 2;", "select 1 < = 2;").length, 1);
  assert.equal(bodyFailures("select a || b;", "select a | | b;").length, 1);
  assert.equal(bodyFailures("select a @> b;", "select a @ > b;").length, 1);
  assert.equal(bodyFailures("select a && b;", "select a & & b;").length, 1);
  assert.equal(bodyFailures("select a=-1;", "select a = - 1;").length, 0);
  assert.equal(bodyFailures("select a+/* explanation */1;", "SELECT a + 1;").length, 0);
  assert.equal(bodyFailures("select ab;", "select a b;").length, 1);
});

test("repair migration preserves the latest intended report function definitions", () => {
  const beforeRepair = functionContracts(migrations.filter((item) => item.name !== "0013_restore_report_functions.sql"));
  const repaired = functionContracts(migrations).filter((item) => item.migration === "0013_restore_report_functions.sql");
  assert.equal(repaired.length, 2);
  for (const item of repaired) {
    const original = beforeRepair.find((old) => old.name === item.name);
    assert.deepEqual({ ...item, body: item.body.replace(/\r\n/g, "\n"), migration: original.migration },
      { ...original, body: original.body.replace(/\r\n/g, "\n") });
  }
});

test("broken access protections cannot pass a schema check", () => {
  const schema = deployedSchema();
  schema.relations.get("public.reports").relrowsecurity = false;
  schema.columns.get("public.client_gmail_accounts.password").authenticated_select = true;
  schema.triggers.get("public.reports.capture_report_deletion").enabled = false;
  schema.buckets.get("insights").public = true;
  const failedNames = checkMigrations(migrations, schema).filter((item) => item.failures.length).map((item) => item.name);
  assert.deepEqual(failedNames, ["0001_init.sql", "0007_credential_boundary.sql", "0011_report_deletion_cleanup.sql"]);
});

test("new migrations without checks fail instead of being silently skipped", () => {
  const result = checkMigrations([...migrations, { name: "0014_future.sql", sql: "" }], deployedSchema());
  assert.equal(result.at(-1).failures.length, 1);
});

test("schema inspection sends only read queries", async () => {
  const queries = [];
  const schema = await readSchema({ async query(sql) {
    assert.match(sql.trim(), /^select\s/i);
    queries.push(sql);
    return { rows: [] };
  } });
  assert.equal(queries.length, 8);
  assert.equal(schema.functions.size, 0);
});
