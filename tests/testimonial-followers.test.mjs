import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const { followerTotals } = appLoader()("src/lib/testimonials/followers.ts");

function metric(overrides = {}) {
  return {
    id: "metric-1", platform: "instagram", metric_name: "followers",
    metric_value: 1200, metric_date: "2026-10-31",
    updated_at: "2026-11-01T10:00:00Z", needs_review: false,
    accountId: "account-1", ...overrides,
  };
}

test("counts the latest snapshot once per account and sums distinct accounts", () => {
  const totals = followerTotals([
    metric({ id: "older", metric_date: "2026-10-01", metric_value: 1000 }),
    metric(),
    metric({ id: "correction", updated_at: "2026-11-02T10:00:00Z", metric_value: 1250 }),
    metric({ id: "other", accountId: "account-2", metric_value: 500 }),
  ]);
  assert.deepEqual(totals, { instagram: 1750, facebook: null, tiktok: null, youtube: null });
});

test("keeps missing distinct from zero and rejects unreviewed or invalid readings", () => {
  const totals = followerTotals([
    metric({ platform: "facebook", metric_value: 0 }),
    metric({ metric_value: null }), metric({ metric_value: NaN }),
    metric({ metric_value: Infinity }), metric({ metric_value: -1 }),
    metric({ needs_review: true }),
    metric({ platform: "tiktok", metric_name: "follower_growth", metric_value: 30 }),
  ]);
  assert.deepEqual(totals, { instagram: null, facebook: 0, tiktok: null, youtube: null });
});

test("uses YouTube subscribers without double-counting the follower alias", () => {
  const totals = followerTotals([
    metric({ platform: "youtube", metric_name: "subscribers", metric_value: 573000 }),
    metric({ platform: "youtube", metric_value: 573000 }),
    metric({ platform: "youtube", accountId: "another-channel", metric_value: 1000 }),
    metric({ metric_name: "subscribers", metric_value: 1000 }),
  ]);
  assert.equal(totals.youtube, 574000);
  assert.equal(totals.instagram, null);
});

test("deduplicates legacy batches without an account and never mutates the input", () => {
  const metrics = [
    metric({ id: "first", accountId: null }),
    metric({ id: "latest", accountId: null, updated_at: "2026-11-02T10:00:00Z", metric_value: 1300 }),
  ];
  const before = structuredClone(metrics);
  assert.equal(followerTotals(metrics).instagram, 1300);
  assert.deepEqual(metrics, before);
});

function scenario({ clients = [{ id: "client-1", name: "Omar Jehad", company_name: null }], fail = false } = {}) {
  const reads = [];
  const db = {
    from(table) {
      const filters = [];
      const query = {
        select(...args) { filters.push(["select", ...args]); return query; },
        eq(...args) { filters.push(["eq", ...args]); return query; },
        not(...args) { filters.push(["not", ...args]); return query; },
        or(...args) { filters.push(["or", ...args]); return query; },
        in(...args) { filters.push(["in", ...args]); return query; },
        order(...args) { filters.push(["order", ...args]); return query; },
        limit(...args) { filters.push(["limit", ...args]); return query; },
        range(...args) { filters.push(["range", ...args]); return query; },
        returns() { return finish(); }, maybeSingle() { return finish(); },
      };
      function finish() {
        reads.push({ table, filters });
        if (fail) return Promise.resolve({ data: null, error: new Error("offline") });
        if (table === "clients") return Promise.resolve({ data: clients, error: null });
        if (table === "reports") return Promise.resolve({ data: { id: "report-1", current_published_version_id: "version-1" }, error: null });
        // Emulate a deployment capping each page at one row despite a larger request.
        const offset = filters.find(([method]) => method === "range")[1];
        return Promise.resolve({ data: [
          { ...metric({ id: `row-${offset}`, platform: "youtube", metric_name: "subscribers", accountId: undefined, metric_value: 1000, insight_batches: { account_id: `channel-${offset}` } }) },
        ], count: 2, error: null });
      }
      return query;
    },
  };
  const load = appLoader({
    "@supabase/supabase-js": { createClient: () => db },
    "next/cache": { unstable_cache: (fn) => fn },
    "@/lib/env": { supabaseUrl: () => "http://example.invalid", supabaseServiceRoleKey: () => "test-key" },
  });
  return { reads, loadTestimonialFollowers: load("src/lib/testimonials/server.ts").loadTestimonialFollowers };
}

async function configured(fn) {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = keys.map((key) => process.env[key]);
  process.env[keys[0]] = "http://example.invalid";
  process.env[keys[1]] = "test-key";
  try { return await fn(); }
  finally { keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  }); }
}

test("loads only the matched creator's published upload metrics, including capped pages", async () => configured(async () => {
  const state = scenario();
  const result = await state.loadTestimonialFollowers();
  assert.deepEqual(result, { "omar-jehad": { instagram: null, facebook: null, tiktok: null, youtube: 2000 } });
  assert.ok(!JSON.stringify(result).includes("client-1"));
  const reportRead = state.reads.find(({ table }) => table === "reports");
  assert.ok(reportRead.filters.some((filter) => JSON.stringify(filter) === JSON.stringify(["eq", "client_id", "client-1"])));
  const metricReads = state.reads.filter(({ table }) => table === "metrics");
  assert.equal(metricReads.length, 2);
  for (const read of metricReads) {
    for (const expected of [
      ["eq", "report_version_id", "version-1"], ["eq", "report_versions.status", "published"],
      ["eq", "report_versions.report_id", "report-1"], ["eq", "needs_review", false],
    ]) assert.ok(read.filters.some((filter) => JSON.stringify(filter) === JSON.stringify(expected)));
    assert.ok(read.filters[0][1].includes("insight_images!inner(id)"));
  }
}));

test("leaves unmatched and ambiguous client identities unavailable", async () => configured(async () => {
  const state = scenario({ clients: [
    { id: "first", name: "Omar Jehad", company_name: null },
    { id: "second", name: "OMAR JEHAD", company_name: null },
    { id: "private-client", name: "Someone Else", company_name: null },
  ] });
  assert.deepEqual(await state.loadTestimonialFollowers(), {});
  assert.deepEqual(state.reads.map(({ table }) => table), ["clients"]);
}));

test("a database failure leaves the landing page usable without invented numbers", async () => configured(async () => {
  const state = scenario({ fail: true });
  const original = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try { assert.deepEqual(await state.loadTestimonialFollowers(), {}); }
  finally { console.warn = original; }
  assert.deepEqual(warnings, ["Testimonial follower analytics are unavailable."]);
}));
