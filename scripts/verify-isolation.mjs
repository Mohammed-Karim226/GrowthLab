/**
 * Tenant-isolation test suite (plan §72, §77).
 *
 * Proves that isolation is enforced by the *database* and by the *API*, not by
 * the UI. It signs in as two real client accounts and, as client A, attempts
 * every read and write that must fail: client B's reports, versions, metrics
 * and profile; unpublished versions of A's own reports; raw screenshots, upload
 * batches, AI responses and audit logs; and writes to analytics tables. It then
 * repeats the exercise over HTTP against the admin API routes.
 *
 * Every attempt must fail. A single unexpected success exits non-zero.
 *
 * Usage — needs two client logins that belong to DIFFERENT clients:
 *
 *   node scripts/verify-isolation.mjs \
 *     --a a@acme.com:passwordA \
 *     --b b@globex.com:passwordB \
 *     [--base-url http://localhost:3000]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY from .env.local. The service-role key is used only
 * to look up the ids the test then tries (and must fail) to reach as a client.
 *
 * --base-url is optional: without it the HTTP half is skipped and reported as
 * skipped rather than passed. Point it at a running dev server to include it.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

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
        if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    } catch {
      // Missing file is fine; fall through to the real environment.
    }
  }
}

loadEnvFiles();

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function credentials(name) {
  const raw = flag(name);
  if (!raw) return null;
  const separator = raw.indexOf(":");
  if (separator === -1) return null;
  return { email: raw.slice(0, separator), password: raw.slice(separator + 1) };
}

const clientA = credentials("a");
const clientB = credentials("b");
const baseUrl = flag("base-url")?.replace(/\/$/, "");

if (!clientA || !clientB) {
  console.error(
    "Usage: node scripts/verify-isolation.mjs --a email:password --b email:password [--base-url http://localhost:3000]"
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error(
    "Missing Supabase configuration. Need a URL, a publishable/anon key and a secret/service-role key\n" +
      "in .env.local or .env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL,\n" +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY,\n" +
      "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY)."
  );
  process.exit(1);
}

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, serviceRoleKey, options);

/** Stand-in id for attempts where no real row exists to aim at. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  ${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name, why) {
  results.push({ name, ok: true, skipped: true, detail: why });
  console.log(`  SKIP  ${name} — ${why}`);
}

/** A read is isolated when it errors or returns nothing. */
async function expectNoRows(name, query) {
  const { data, error } = await query;
  if (error) return record(name, true, `denied: ${error.code ?? "error"}`);
  const count = Array.isArray(data) ? data.length : data ? 1 : 0;
  record(name, count === 0, count === 0 ? "0 rows" : `LEAKED ${count} row(s)`);
}

/**
 * A write is isolated when the database refuses it *or* silently changes
 * nothing.
 *
 * Both outcomes are real denials and RLS picks between them: a row that fails
 * WITH CHECK raises 42501, while a row filtered out by USING simply never
 * matches, so the statement succeeds having touched nothing. PostgREST reports
 * that second case as a plain success, so asking only "was there an error?"
 * would read a blocked update as an accepted one. Chaining `.select()` makes
 * the statement return the rows it actually affected, which distinguishes them.
 */
async function expectDenied(name, query) {
  const builder = typeof query.select === "function" ? query.select("id") : query;
  const { data, error } = await builder;

  if (error) return record(name, true, `denied: ${error.code ?? "error"}`);

  const affected = Array.isArray(data) ? data.length : data ? 1 : 0;
  record(
    name,
    affected === 0,
    affected === 0 ? "0 rows affected" : `WRITE ACCEPTED — ${affected} row(s) changed`
  );
}

async function signIn(label, creds) {
  const supabase = createClient(url, anonKey, options);
  const { data, error } = await supabase.auth.signInWithPassword(creds);
  if (error || !data.user) {
    console.error(`Could not sign in ${label} (${creds.email}): ${error?.message}`);
    process.exit(1);
  }

  const { data: profile } = await service
    .from("profiles")
    .select("role, client_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.role !== "client" || !profile.client_id) {
    console.error(`${label} (${creds.email}) is not a client account with a client_id.`);
    process.exit(1);
  }

  return { supabase, userId: data.user.id, clientId: profile.client_id };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const a = await signIn("client A", clientA);
const b = await signIn("client B", clientB);

if (a.clientId === b.clientId) {
  console.error("Both accounts belong to the same client. The test needs two different tenants.");
  process.exit(1);
}

console.log(`\nClient A -> ${a.clientId}\nClient B -> ${b.clientId}\n`);

// Ids looked up with the service role, so the test targets rows that really
// exist. Anything the client is then able to read is a genuine leak, not a
// query that happened to match nothing.
const [{ data: bReports }, { data: aReports }] = await Promise.all([
  service.from("reports").select("id, current_published_version_id").eq("client_id", b.clientId),
  service.from("reports").select("id, current_published_version_id").eq("client_id", a.clientId),
]);

const bReport = (bReports ?? [])[0] ?? null;
const aReport = (aReports ?? [])[0] ?? null;

const { data: bVersions } = bReport
  ? await service.from("report_versions").select("id, status").eq("report_id", bReport.id)
  : { data: [] };

const bVersion = (bVersions ?? [])[0] ?? null;

// An unpublished version of client A's OWN report: ownership alone must not be
// enough, the version has to be published too (plan §33).
const { data: aDrafts } = aReport
  ? await service
      .from("report_versions")
      .select("id, status")
      .eq("report_id", aReport.id)
      .neq("status", "published")
  : { data: [] };

const aDraft = (aDrafts ?? [])[0] ?? null;

const { data: bMetrics } = bVersion
  ? await service.from("metrics").select("id").eq("report_version_id", bVersion.id).limit(1)
  : { data: [] };

const bMetric = (bMetrics ?? [])[0] ?? null;

const { data: aMetrics } = await service
  .from("metrics")
  .select("id, report_version_id")
  .in(
    "report_version_id",
    ((await service.from("report_versions").select("id, report_id")).data ?? [])
      .filter((version) => (aReports ?? []).some((report) => report.id === version.report_id))
      .map((version) => version.id)
      .concat(NIL_UUID)
  )
  .limit(1);

const aMetric = (aMetrics ?? [])[0] ?? null;

const { data: anyImage } = await service.from("insight_images").select("id, storage_path").limit(1);
const image = (anyImage ?? [])[0] ?? null;

// --- Database level (plan §72) ---------------------------------------------

console.log("Database isolation — client A acting against client B's data");

if (bReport) {
  await expectNoRows(
    "cannot read another client's report by id",
    a.supabase.from("reports").select("id").eq("id", bReport.id)
  );
} else {
  skip("cannot read another client's report by id", "client B has no reports");
}

await expectNoRows(
  "cannot list another client's reports",
  a.supabase.from("reports").select("id").eq("client_id", b.clientId)
);

await expectNoRows(
  "unfiltered report list returns only own reports",
  a.supabase.from("reports").select("id, client_id").neq("client_id", a.clientId)
);

if (bVersion) {
  await expectNoRows(
    "cannot read another client's report version",
    a.supabase.from("report_versions").select("id").eq("id", bVersion.id)
  );
} else {
  skip("cannot read another client's report version", "client B has no versions");
}

if (aDraft) {
  await expectNoRows(
    "cannot read an unpublished version of own report",
    a.supabase.from("report_versions").select("id").eq("id", aDraft.id)
  );
} else {
  skip("cannot read an unpublished version of own report", "client A has no unpublished version");
}

if (bMetric) {
  await expectNoRows(
    "cannot read another client's metrics",
    a.supabase.from("metrics").select("id").eq("id", bMetric.id)
  );
} else {
  skip("cannot read another client's metrics", "client B has no metrics");
}

await expectNoRows(
  "cannot read another client's profile",
  a.supabase.from("profiles").select("id").eq("id", b.userId)
);

await expectNoRows(
  "cannot list other clients",
  a.supabase.from("clients").select("id").neq("id", a.clientId)
);

await expectNoRows(
  "cannot read upload batches",
  a.supabase.from("insight_batches").select("id").limit(1)
);

await expectNoRows(
  "cannot read raw screenshot rows",
  a.supabase.from("insight_images").select("id").limit(1)
);

await expectNoRows(
  "cannot read raw AI responses",
  a.supabase.from("ai_analyses").select("id").limit(1)
);

await expectNoRows("cannot read audit logs", a.supabase.from("audit_logs").select("id").limit(1));

console.log("\nDatabase isolation — client A attempting writes");

await expectDenied(
  "cannot insert a metric",
  a.supabase.from("metrics").insert({
    report_version_id: bVersion?.id ?? NIL_UUID,
    platform: "facebook",
    metric_name: "views",
    metric_value: 999999,
    metric_unit: "count",
    source: "manual",
    needs_review: false,
  })
);

if (aMetric) {
  await expectDenied(
    "cannot update own published metric",
    a.supabase.from("metrics").update({ metric_value: 1 }).eq("id", aMetric.id)
  );
  await expectDenied(
    "cannot delete own published metric",
    a.supabase.from("metrics").delete().eq("id", aMetric.id)
  );
} else {
  skip("cannot update own published metric", "client A has no metrics");
  skip("cannot delete own published metric", "client A has no metrics");
}

await expectDenied(
  "cannot escalate own role to admin",
  a.supabase.from("profiles").update({ role: "admin" }).eq("id", a.userId)
);

await expectDenied(
  "cannot repoint own profile at another client",
  a.supabase.from("profiles").update({ client_id: b.clientId }).eq("id", a.userId)
);

if (aReport) {
  await expectDenied(
    "cannot publish a version of own report",
    a.supabase
      .from("reports")
      .update({ current_published_version_id: aDraft?.id ?? null })
      .eq("id", aReport.id)
  );
} else {
  skip("cannot publish a version of own report", "client A has no reports");
}

console.log("\nStorage isolation — private bucket");

if (image) {
  const download = await a.supabase.storage.from("insights").download(image.storage_path);
  record(
    "cannot download a screenshot from the private bucket",
    Boolean(download.error),
    download.error ? "denied" : "FILE RETURNED"
  );

  const signed = await a.supabase.storage.from("insights").createSignedUrl(image.storage_path, 60);
  record(
    "cannot mint a signed URL for a screenshot",
    Boolean(signed.error),
    signed.error ? "denied" : "SIGNED URL ISSUED"
  );
} else {
  skip("cannot download a screenshot from the private bucket", "no screenshots uploaded yet");
  skip("cannot mint a signed URL for a screenshot", "no screenshots uploaded yet");
}

const listed = await a.supabase.storage.from("insights").list();
record(
  "cannot list the private bucket",
  Boolean(listed.error) || (listed.data ?? []).length === 0,
  listed.error ? "denied" : `${(listed.data ?? []).length} entries`
);

console.log("\nAnonymous access — no session at all");

const anon = createClient(url, anonKey, options);

for (const table of [
  "clients",
  "reports",
  "report_versions",
  "metrics",
  "profiles",
  "insight_batches",
  "insight_images",
  "ai_analyses",
  "audit_logs",
]) {
  await expectNoRows(`anonymous cannot read ${table}`, anon.from(table).select("id").limit(1));
}

// --- API level (plan §77) ---------------------------------------------------

console.log("\nAPI isolation — admin routes over HTTP");

if (!baseUrl) {
  skip("admin API routes reject a client session", "no --base-url given");
  skip("admin API routes reject an anonymous caller", "no --base-url given");
} else {
  /** The app sets its session in cookies, so log in through its own route. */
  async function loginCookies(creds) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...creds, expectedRole: "client", locale: "en" }),
    });

    const raw = response.headers.getSetCookie?.() ?? [];
    return raw.map((cookie) => cookie.split(";")[0]).join("; ");
  }

  const cookie = await loginCookies(clientA);

  if (!cookie) {
    record("client session cookie obtained over HTTP", false, "no Set-Cookie returned");
  } else {
    record("client session cookie obtained over HTTP", true);
  }

  // Every admin route the app exposes, with a plausible body. Ids fall back to a
  // syntactically valid UUID so the route still matches: the guard runs before
  // any id is looked at, so a 404 here would mean the URL was simply wrong.
  const reportId = bReport?.id ?? NIL_UUID;
  const versionId = bVersion?.id ?? NIL_UUID;

  const targets = [
    ["GET", "/api/admin/clients"],
    [
      "POST",
      "/api/admin/clients",
      { name: "Injected", email: "injected@example.com", password: "0123456789" },
    ],
    ["PATCH", `/api/admin/clients/${b.clientId}`, { name: "Renamed" }],
    [
      "POST",
      "/api/admin/reports",
      {
        clientId: b.clientId,
        title: "Injected",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
      },
    ],
    ["POST", `/api/admin/reports/${reportId}/versions`, {}],
    ["POST", `/api/admin/reports/${reportId}/summary`, { reportVersionId: versionId }],
    ["POST", `/api/admin/reports/${reportId}/approve`, { reportVersionId: versionId }],
    ["POST", `/api/admin/reports/${reportId}/publish`, { reportVersionId: versionId }],
    ["DELETE", `/api/admin/reports/${reportId}/publish`],
    ["PATCH", `/api/admin/metrics/${bMetric?.id ?? NIL_UUID}`, { metricValue: 1 }],
    ["DELETE", `/api/admin/metrics/${bMetric?.id ?? NIL_UUID}`],
    ["POST", "/api/admin/insights/upload"],
    ["POST", "/api/admin/insights/preview", { imageIds: [image?.id ?? NIL_UUID] }],
    ["POST", "/api/admin/insights/analyze", { batchId: NIL_UUID }],
    ["DELETE", `/api/admin/insights/images/${image?.id ?? NIL_UUID}`],
  ];

  /**
   * Admin routes must refuse both callers with 401/403 — never 2xx.
   *
   * Every route is tried even after the first offender, so the report names all
   * of them rather than stopping at one.
   */
  async function expectRefused(label, headers) {
    const offenders = [];

    for (const [method, path, body] of targets) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });

      if (response.status !== 401 && response.status !== 403) {
        offenders.push(`${method} ${path} -> ${response.status}`);
      }
    }

    record(
      label,
      offenders.length === 0,
      offenders.length === 0
        ? `${targets.length} routes refused with 401/403`
        : offenders.join(", ")
    );
  }

  await expectRefused("admin API routes reject a client session", cookie ? { cookie } : {});
  await expectRefused("admin API routes reject an anonymous caller", {});

  /**
   * Admin *pages* too (plan §43): neither caller may be served the dashboard.
   *
   * Where they land differs — an anonymous visitor goes to the admin login page,
   * a signed-in client is sent to their own portal — so each caller passes the
   * destination it should be allowed to reach. A 200 fails either way: it means
   * the guard rendered admin markup.
   */
  async function expectRedirectedAway(label, headers, allowed) {
    const offenders = [];

    for (const path of ["/en/admin", "/ar/admin", "/en/admin/clients", "/ar/admin/clients"]) {
      const response = await fetch(`${baseUrl}${path}`, { headers, redirect: "manual" });
      const location = response.headers.get("location");
      const isRedirect = response.status >= 300 && response.status < 400;
      const destination = location ? new URL(location, baseUrl).pathname : "";

      if (!isRedirect || !allowed.test(destination)) {
        offenders.push(`GET ${path} -> ${response.status} ${destination}`.trim());
      }
    }

    record(
      label,
      offenders.length === 0,
      offenders.length === 0 ? "redirected away from every admin page" : offenders.join(", ")
    );
  }

  await expectRedirectedAway(
    "admin pages reject a client session",
    cookie ? { cookie } : {},
    // Their own portal — never anything under /admin.
    /^\/(en|ar)\/portal(\/|$)/
  );

  await expectRedirectedAway(
    "admin pages reject an anonymous visitor",
    {},
    // The admin login page is the one /admin path an anonymous visitor may see.
    /^\/(en|ar)\/admin\/login\/?$/
  );
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

const failed = results.filter((result) => !result.ok);
const skipped = results.filter((result) => result.skipped);

console.log(
  `\n${results.length - failed.length - skipped.length} passed, ${skipped.length} skipped, ${failed.length} failed`
);

if (failed.length > 0) {
  console.error("\nIsolation is NOT intact. Fix these before going anywhere near production:");
  for (const result of failed) console.error(`  - ${result.name}: ${result.detail}`);
  process.exit(1);
}

if (skipped.length > 0) {
  console.log(
    "\nSome checks were skipped for lack of data. Re-run with two clients that each have a\npublished report, uploaded screenshots and metrics, plus --base-url, for full coverage."
  );
}

console.log("\nIsolation intact.");
