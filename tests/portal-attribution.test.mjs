import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appLoader } from "./helpers/app-loader.mjs";

function metric(id, version, batch, value) {
  return {
    id,
    report_version_id: version,
    insight_batch_id: batch,
    platform: "facebook",
    metric_name: "views",
    metric_unit: "count",
    metric_date: null,
    metric_value: value,
  };
}

function attribution(version, batch, account, name) {
  return { version_id: version, batch_id: batch, account_id: account, account_name: name, account_stage: "Active" };
}

function scenario({ metrics = [], accounts = [], metricsError = null, attributionError = null } = {}) {
  const calls = [];
  const db = {
    from(table) {
      // A client session cannot read upload batches, including embedded joins.
      assert.equal(table, "metrics");
      let versions;
      return {
        select(columns) { assert.equal(columns, "*"); return this; },
        in(column, ids) { assert.equal(column, "report_version_id"); versions = ids; return this; },
        order() { return this; },
        returns() { return Promise.resolve({ data: metrics.filter((row) => versions.includes(row.report_version_id)), error: metricsError }); },
      };
    },
    rpc(name, { p_versions }) {
      assert.equal(name, "portal_attribution");
      assert.ok(p_versions.length > 0 && p_versions.length <= 100);
      calls.push(p_versions);
      return Promise.resolve({ data: accounts, error: attributionError });
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/supabase/admin": { createAdminClient: () => assert.fail("Portal attribution must use the signed-in client session") },
  });
  return { loadPortalMetrics: load("src/lib/portal/data.ts").loadPortalMetrics, comparePeriods: load("src/lib/analytics/comparisons.ts").comparePeriods, calls };
}

test("client-visible account names reach comparisons without reading private batches", async () => {
  const app = scenario({
    metrics: [
      metric("a-now", "now", "a-now-batch", 120),
      metric("b-now", "now", "b-now-batch", 340),
      metric("a-before", "before", "a-before-batch", 100),
      metric("b-before", "before", "b-before-batch", 400),
    ],
    accounts: [
      attribution("now", "a-now-batch", "a", "Shared name"),
      attribution("now", "b-now-batch", "b", "Shared name"),
      attribution("before", "a-before-batch", "a", "Shared name"),
      attribution("before", "b-before-batch", "b", "Shared name"),
    ],
  });
  const periods = await app.loadPortalMetrics(["now", "before"]);
  const comparison = app.comparePeriods(periods.get("now"), periods.get("before"));
  assert.deepEqual(comparison.metrics.map((row) => ({ account: row.accountId, name: row.accountName, stage: row.accountStage, current: row.current, previous: row.previous, direction: row.growth.direction })), [
    { account: "a", name: "Shared name", stage: "Active", current: 120, previous: 100, direction: "up" },
    { account: "b", name: "Shared name", stage: "Active", current: 340, previous: 400, direction: "down" },
  ]);
});

test("attribution must match both the batch and report version", async () => {
  const app = scenario({
    metrics: [metric("scoped", "now", "batch", 10), metric("manual", "now", null, 20)],
    accounts: [attribution("another-version", "batch", "wrong-account", "Wrong account")],
  });
  const rows = (await app.loadPortalMetrics(["now"])).get("now");
  assert.deepEqual(rows.map((row) => [row.accountId, row.accountName, row.accountStage, row.metric_value]), [
    [null, null, null, 10], [null, null, null, 20],
  ]);
});

test("an attribution failure is reported instead of silently losing account names", async () => {
  const error = { code: "PGRST202", message: "Attribution RPC unavailable" };
  const app = scenario({ attributionError: error });
  await assert.rejects(app.loadPortalMetrics(["now"]), (received) => received === error);
});

test("a metric query failure is reported", async () => {
  const error = { code: "08006", message: "Database unavailable" };
  const app = scenario({ metricsError: error });
  await assert.rejects(app.loadPortalMetrics(["now"]), (received) => received === error);
});

test("large histories respect the attribution RPC's 100-version limit without dropping names", async () => {
  const versions = Array.from({ length: 101 }, (_, index) => `version-${index}`);
  const app = scenario({
    metrics: versions.map((version) => metric(version, version, `batch-${version}`, 1)),
    accounts: versions.map((version) => attribution(version, `batch-${version}`, `account-${version}`, `Name ${version}`)),
  });
  const periods = await app.loadPortalMetrics([...versions, versions[0]]);
  assert.deepEqual(app.calls.map((ids) => ids.length), [100, 1]);
  assert.equal(periods.size, 101);
  for (const version of versions) {
    assert.equal(periods.get(version).length, 1);
    assert.equal(periods.get(version)[0].accountName, `Name ${version}`);
  }
});

test("no report versions require no database access", async () => {
  const app = scenario();
  assert.equal((await app.loadPortalMetrics([])).size, 0);
  assert.equal(app.calls.length, 0);
});

test("the collapsed platform list shows loaded account names in both languages", async () => {
  const app = scenario({
    metrics: [metric("a", "now", "batch-a", 120), metric("b", "now", "batch-b", 340)],
    accounts: [attribution("now", "batch-a", "account-a", "Alpha account"), attribution("now", "batch-b", "account-b", "Beta account")],
  });
  const periods = await app.loadPortalMetrics(["now"]);
  const comparison = app.comparePeriods(periods.get("now"), null);
  const element = (tag) => function MotionElement({ children, initial, animate, exit, whileInView, viewport, transition, ...props }) { return React.createElement(tag, props, children); };

  for (const locale of ["en", "ar"]) {
    const messages = JSON.parse(readFileSync(new URL(`../src/locales/portal/${locale}.json`, import.meta.url), "utf8"));
    const load = appLoader({
      react: { ...React, useState: () => [false, () => {}] },
      "next-intl": { useTranslations: (namespace) => {
        const dictionary = namespace.split(".").reduce((value, key) => value[key], messages);
        const translate = (key, values = {}) => Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), dictionary[key]);
        translate.has = (key) => Object.hasOwn(dictionary, key);
        return translate;
      } },
      "framer-motion": { motion: { article: element("article"), div: element("div") }, AnimatePresence: ({ children }) => children, useReducedMotion: () => true },
      "@/components/ui/button": { Button: ({ variant, ...props }) => React.createElement("button", props) },
      "@/components/portal/GrowthBadge": { __esModule: true, default: (props) => React.createElement(load("src/components/portal/GrowthBadge.tsx").default, props) },
    });
    const PlatformBreakdown = load("src/components/portal/PlatformBreakdown.tsx").default;
    const html = renderToStaticMarkup(React.createElement(PlatformBreakdown, { locale, platforms: comparison.platforms, metrics: comparison.metrics }));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(!html.includes("<h4"));
    assert.ok(html.includes("Alpha account"));
    assert.ok(html.includes("Beta account"));
  }
});
