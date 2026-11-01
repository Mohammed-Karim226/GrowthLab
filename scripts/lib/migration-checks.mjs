import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const requirement = (kind, name, extra = {}) => ({ kind, name, ...extra });
const table = (name) => requirement("table", `public.${name}`);
const column = (name) => requirement("column", `public.${name}`);
const index = (name) => requirement("index", `public.${name}`);
const policy = (name) => requirement("policy", name);
const trigger = (name) => requirement("trigger", `public.${name}`);
const constraint = (name) => requirement("constraint", `public.${name}`);
const execute = (name, role, allowed = true) => requirement("execute", name, { role, allowed });
const columnPrivilege = (name, privilege, allowed) => requirement("columnPrivilege", `public.${name}`, { role: "authenticated", privilege, allowed });

// Existing migrations were applied manually, without a durable migration ledger.
// Verify their surviving schema effects rather than guessing history or replaying SQL.
export const contracts = {
  "0001_init.sql": [
    ...["clients", "accounts", "profiles", "reports", "report_versions", "insight_batches", "insight_images", "ai_analyses", "metrics", "audit_logs"].map(table),
    ...["platform_type", "user_role", "report_status", "batch_status", "metric_source", "analysis_status"].map((name) => requirement("enum", `public.${name}`)),
    ...["clients_admin_all", "clients_select_own"].map((name) => policy(`public.clients.${name}`)),
    ...["profiles_admin_all", "profiles_select_self"].map((name) => policy(`public.profiles.${name}`)),
    ...["accounts_admin_all", "accounts_select_own"].map((name) => policy(`public.accounts.${name}`)),
    ...["reports_admin_all", "reports_select_published"].map((name) => policy(`public.reports.${name}`)),
    ...["report_versions_admin_all", "report_versions_select_published"].map((name) => policy(`public.report_versions.${name}`)),
    ...["metrics_admin_all", "metrics_select_published"].map((name) => policy(`public.metrics.${name}`)),
    policy("public.insight_batches.insight_batches_admin_all"),
    policy("public.insight_images.insight_images_admin_all"),
    policy("public.ai_analyses.ai_analyses_admin_all"),
    ...["audit_logs_admin_select", "audit_logs_admin_insert"].map((name) => policy(`public.audit_logs.${name}`)),
    ...["insights_admin_select", "insights_admin_insert", "insights_admin_update", "insights_admin_delete"].map((name) => policy(`storage.objects.${name}`)),
    requirement("bucket", "insights"),
  ],
  "0002_accounts.sql": [table("accounts"), column("insight_batches.account_id"), index("accounts_client_platform_page_idx"), constraint("insight_batches.insight_batches_account_id_fkey"), trigger("insight_batches.insight_batches_validate_account")],
  "0003_ai_jobs.sql": [table("ai_jobs"), requirement("enum", "public.ai_job_status"), index("ai_jobs_claim_idx"), index("ai_jobs_one_active_per_batch_idx"), policy("public.ai_jobs.ai_jobs_admin_select")],
  "0003_client_payment_plans.sql": [table("client_payment_plans"), index("client_payment_plans_client_month_idx"), trigger("client_payment_plans.client_payment_plans_set_updated_at"), policy("public.client_payment_plans.client_payment_plans_admin_all"), policy("public.client_payment_plans.client_payment_plans_select_own")],
  "0004_ai_job_lease_recovery.sql": [], // Verified against the latest function body below.
  "0004_client_gmail_accounts.sql": [table("client_gmail_accounts"), index("client_gmail_accounts_client_email_idx"), trigger("client_gmail_accounts.client_gmail_accounts_set_updated_at"), policy("public.client_gmail_accounts.client_gmail_accounts_admin_all")],
  "0004_payment_plan_total_price.sql": [column("client_payment_plans.total_plan_price")],
  "0005_client_details.sql": [...["project_name", "service_description", "followup_priority"].map((name) => column(`clients.${name}`)), constraint("clients.clients_followup_priority_check")],
  "0005_outreach.sql": [...["outreach_senders", "outreach_contacts", "outreach_messages"].map(table), ...["senders", "contacts", "messages"].map((name) => policy(`public.outreach_${name}.outreach_${name}_admin`)), index("outreach_messages_status_idx"), index("outreach_messages_contact_idx")],
  "0006_grant_admin_auth_helper.sql": [execute("is_admin()", "authenticated")],
  "0007_credential_boundary.sql": [
    ...["secret_ciphertext", "has_secret", "services"].map((name) => column(`client_gmail_accounts.${name}`)),
    ...["id", "email", "has_secret", "services"].map((name) => columnPrivilege(`client_gmail_accounts.${name}`, "SELECT", true)),
    ...["password", "related_accounts", "notes", "secret_ciphertext"].map((name) => columnPrivilege(`client_gmail_accounts.${name}`, "SELECT", false)),
    execute("save_credential(uuid,uuid,text,text,jsonb,uuid)", "service_role"),
    execute("save_credential(uuid,uuid,text,text,jsonb,uuid)", "authenticated", false),
    execute("delete_credential(uuid,uuid)", "service_role"),
    execute("delete_credential(uuid,uuid)", "authenticated", false),
  ],
  "0008_report_transactions.sql": [
    column("report_versions.revision"),
    constraint("report_versions.versions_report_identity"), constraint("reports.reports_same_version_fk"),
    constraint("insight_batches.batches_version_identity"), constraint("metrics.metrics_same_batch_version_fk"),
    ...["report_versions.guard_version", "metrics.guard_metrics", "insight_images.guard_images", "insight_batches.guard_batches", "reports.check_report_publication", "report_versions.check_version_publication"].map(trigger),
    columnPrivilege("reports.current_published_version_id", "UPDATE", false),
    columnPrivilege("report_versions.status", "UPDATE", false),
    execute("portal_attribution(uuid[])", "authenticated"), execute("portal_attribution(uuid[])", "anon", false),
  ],
  "0009_report_publication_fixes.sql": [],
  "0010_report_summary.sql": [execute("save_report_summary(uuid,uuid,integer,jsonb,text,jsonb)", "authenticated"), execute("save_report_summary(uuid,uuid,integer,jsonb,text,jsonb)", "anon", false)],
  "0011_report_deletion_cleanup.sql": [table("report_deletion_cleanup"), index("report_deletion_cleanup_pending_idx"), trigger("reports.capture_report_deletion"), policy("public.report_deletion_cleanup.report_deletion_cleanup_admin_select"), execute("delete_report(uuid)", "authenticated"), execute("delete_report(uuid)", "anon", false)],
  "0012_ai_usage.sql": [table("ai_usage_events"), index("ai_usage_events_started_at_idx"), constraint("ai_usage_events.ai_usage_events_outcome"), policy("public.ai_usage_events.ai_usage_events_admin_read"), execute("admin_ai_usage_summary()", "authenticated"), execute("admin_ai_usage_summary()", "anon", false)],
  "0013_restore_report_functions.sql": [execute("auth_client_id()", "authenticated"), execute("auth_client_id()", "anon", false), execute("transition_report(uuid,uuid,integer,uuid,text)", "authenticated"), execute("transition_report(uuid,uuid,integer,uuid,text)", "anon", false)],
};

function normalizedBody(body) {
  // Ignore SQL formatting and comments, while preserving quoted values and
  // operator boundaries. Removing all whitespace would change string literals.
  const tokens = [];
  let offset = 0;
  while (offset < body.length) {
    const remaining = body.slice(offset);
    if (/^\s/.test(remaining)) { offset++; continue; }
    if (remaining.startsWith("--")) {
      const end = body.indexOf("\n", offset + 2);
      offset = end < 0 ? body.length : end + 1;
      continue;
    }
    if (remaining.startsWith("/*")) {
      let depth = 1;
      offset += 2;
      while (offset < body.length && depth) {
        if (body.startsWith("/*", offset)) { depth++; offset += 2; }
        else if (body.startsWith("*/", offset)) { depth--; offset += 2; }
        else offset++;
      }
      continue;
    }
    const dollar = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(remaining)?.[0];
    if (dollar) {
      const end = body.indexOf(dollar, offset + dollar.length);
      const next = end < 0 ? body.length : end + dollar.length;
      tokens.push(body.slice(offset, next));
      offset = next;
      continue;
    }
    if (remaining[0] === "'" || remaining[0] === '"') {
      const quote = remaining[0];
      const start = offset++;
      const escaped = quote === "'" && /^e$/i.test(tokens.at(-1) ?? "");
      while (offset < body.length) {
        if (escaped && body[offset] === "\\") { offset += 2; continue; }
        if (body[offset] === quote) {
          if (body[offset + 1] === quote) { offset += 2; continue; }
          offset++;
          break;
        }
        offset++;
      }
      tokens.push(body.slice(start, offset));
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(remaining)?.[0];
    const number = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(remaining)?.[0];
    const punctuation = /^(?:::|:=|\.\.)/.exec(remaining)?.[0];
    let operator = /^[+\-*/<>=~!@#%^&|`?]+/.exec(remaining)?.[0];
    if (operator) {
      // PostgreSQL ends an operator before a comment and treats trailing +/-
      // as separate tokens unless the operator contains a special character.
      const comment = operator.search(/--|\/\*/);
      if (comment >= 0) operator = operator.slice(0, comment);
      if (operator.length > 1 && !/[~!@#%^&|`?]/.test(operator)) {
        operator = operator.replace(/[+-]+$/, "") || operator[0];
      }
    }
    const token = word ?? number ?? punctuation ?? operator ?? remaining[0];
    tokens.push(word ? token.toLowerCase() : token);
    offset += token.length;
  }
  return JSON.stringify(tokens);
}

export function readMigrations(directory) {
  const path = directory instanceof URL ? fileURLToPath(directory) : directory;
  const files = readdirSync(path).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
  if (!files.length) throw new Error("No SQL migration files found");
  return files.map((name) => ({ name, sql: readFileSync(join(path, name), "utf8") }));
}

export function functionContracts(migrations) {
  const latest = new Map();
  for (const migration of migrations) {
    const pattern = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*returns\s+([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$/gi;
    for (const match of migration.sql.matchAll(pattern)) {
      const args = match[2].split(",").map((arg) => arg.trim().replace(/\s+default\s+[\s\S]*$/i, "").replace(/\s+/g, " ")).filter(Boolean).join(", ");
      const types = args ? args.split(", ").map((arg) => arg.split(" ").slice(1).join(" ")).join(",") : "";
      const signature = `${match[1]}(${types})`;
      latest.set(signature, {
        kind: "function", name: signature, args, body: match[4],
        language: /language\s+(\w+)/i.exec(match[3])?.[1].toLowerCase(),
        securityDefiner: /security\s+definer/i.test(match[3]), migration: migration.name,
      });
    }
  }
  return [...latest.values()];
}

export async function readSchema(client) {
  const [relations, columns, policies, triggers, constraints, enums, functions, buckets] = await Promise.all([
    client.query(`select n.nspname||'.'||c.relname as name, c.relkind, c.relrowsecurity,
      coalesce(i.indisvalid,true) as valid from pg_class c join pg_namespace n on n.oid=c.relnamespace
      left join pg_index i on i.indexrelid=c.oid where n.nspname in ('public','storage')`),
    client.query(`select n.nspname||'.'||c.relname||'.'||a.attname as name,
      has_column_privilege('authenticated',c.oid,a.attnum,'SELECT') as authenticated_select,
      has_column_privilege('authenticated',c.oid,a.attnum,'UPDATE') as authenticated_update
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped`),
    client.query("select schemaname||'.'||tablename||'.'||policyname as name from pg_policies where schemaname in ('public','storage')"),
    client.query(`select n.nspname||'.'||c.relname||'.'||t.tgname as name, t.tgenabled<>'D' as enabled
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal`),
    client.query(`select n.nspname||'.'||c.relname||'.'||con.conname as name, con.convalidated as valid
      from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`),
    client.query("select n.nspname||'.'||t.typname as name from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'"),
    client.query(`select p.proname||'('||replace(oidvectortypes(p.proargtypes),', ',',')||')' as name,
      pg_get_function_identity_arguments(p.oid) as args, p.prosrc as body, l.lanname as language,
      p.prosecdef as security_definer, has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon, has_function_privilege('service_role',p.oid,'EXECUTE') as service_role
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where n.nspname='public' and p.prokind='f'`),
    client.query("select id as name, public from storage.buckets where id='insights'"),
  ]);
  return Object.fromEntries(Object.entries({ relations, columns, policies, triggers, constraints, enums, functions, buckets })
    .map(([key, result]) => [key, new Map(result.rows.map((row) => [row.name, row]))]));
}

function check(schema, item) {
  if (item.kind === "table") {
    const row = schema.relations.get(item.name);
    return row && ["r", "p"].includes(row.relkind) && row.relrowsecurity;
  }
  if (item.kind === "column") return schema.columns.has(item.name);
  if (item.kind === "index") {
    const row = schema.relations.get(item.name);
    return row?.relkind === "i" && row.valid;
  }
  if (item.kind === "policy") return schema.policies.has(item.name);
  if (item.kind === "trigger") return schema.triggers.get(item.name)?.enabled;
  if (item.kind === "constraint") return schema.constraints.get(item.name)?.valid;
  if (item.kind === "enum") return schema.enums.has(item.name);
  if (item.kind === "bucket") return schema.buckets.get(item.name)?.public === false;
  if (item.kind === "execute") return schema.functions.get(item.name)?.[item.role] === item.allowed;
  if (item.kind === "columnPrivilege") return schema.columns.get(item.name)?.[`${item.role}_${item.privilege.toLowerCase()}`] === item.allowed;
  if (item.kind === "function") {
    const row = schema.functions.get(item.name);
    return row && row.args === item.args && normalizedBody(row.body) === normalizedBody(item.body)
      && row.language === item.language && row.security_definer === item.securityDefiner;
  }
  throw new Error(`Unknown migration check: ${item.kind}`);
}

export function checkMigrations(migrations, schema) {
  const functions = functionContracts(migrations);
  return migrations.map((migration) => {
    if (!Object.hasOwn(contracts, migration.name)) {
      return { name: migration.name, failures: ["No schema checks registered for this migration"] };
    }
    const requirements = [...contracts[migration.name], ...functions.filter((item) => item.migration === migration.name)];
    return { name: migration.name, failures: requirements.filter((item) => !check(schema, item)).map((item) => `${item.kind}: ${item.name}`) };
  });
}
