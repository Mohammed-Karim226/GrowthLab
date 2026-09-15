import assert from "node:assert/strict";
import test from "node:test";
import { comparePeriods } from "./comparisons";
import type { MetricRow } from "@/types/database";

type ScopedMetric = MetricRow & { accountId?: string | null };

function metric(overrides: Partial<ScopedMetric>): ScopedMetric {
  return {
    id: "metric",
    report_version_id: "version",
    insight_batch_id: null,
    platform: "facebook",
    metric_name: "views",
    metric_value: 10,
    metric_unit: "count",
    metric_date: null,
    source: "ai",
    confidence: null,
    needs_review: false,
    note: null,
    created_at: "",
    updated_at: "",
    accountId: null,
    ...overrides,
  };
}

test("keeps metrics from unknown accounts distinct and does not compare unrelated batches", () => {
  const current = [
    metric({ id: "a", insight_batch_id: "batch-a", metric_value: 10 }),
    metric({ id: "b", insight_batch_id: "batch-b", metric_value: 20 }),
  ];
  const previous = [metric({ id: "previous", insight_batch_id: "previous-batch", metric_value: 100 })];
  const rows = comparePeriods(current, previous).metrics;

  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.key)).size, 2);
  assert.deepEqual(rows.map((row) => row.current), [10, 20]);
  assert.deepEqual(rows.map((row) => row.previous), [null, null]);
  assert.ok(rows.every((row) => row.growth.direction === "unknown"));
});

test("matches the same account across periods even when batch IDs change", () => {
  const rows = comparePeriods(
    [metric({ accountId: "account", insight_batch_id: "current-batch", metric_value: 150 })],
    [metric({ accountId: "account", insight_batch_id: "previous-batch", metric_value: 100 })],
  ).metrics;

  assert.equal(rows[0].previous, 100);
  assert.equal(rows[0].growth.percent, 50);
});

test("keeps row keys distinct across units, dates, and scopes", () => {
  const rows = comparePeriods([
    metric({ id: "count" }),
    metric({ id: "percent", metric_unit: "percent" }),
    metric({ id: "day-1", metric_date: "2026-09-01" }),
    metric({ id: "day-2", metric_date: "2026-09-02" }),
    metric({ id: "account", accountId: "account" }),
    metric({ id: "batch", insight_batch_id: "batch" }),
  ], null).metrics;

  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map((row) => row.key)).size, 6);
});

test("aggregates matching rows with keys that remain stable when input is reordered", () => {
  const input = [
    metric({ id: "a", accountId: "account", metric_value: 10 }),
    metric({ id: "b", accountId: "account", metric_value: 20 }),
  ];
  const forward = comparePeriods(input, null).metrics;
  const reverse = comparePeriods([...input].reverse(), null).metrics;

  assert.equal(forward.length, 1);
  assert.equal(forward[0].current, 30);
  assert.equal(forward[0].key, reverse[0].key);
});

test("does not compare values measured in different units", () => {
  const rows = comparePeriods(
    [metric({ accountId: "account", metric_unit: "count" })],
    [metric({ accountId: "account", metric_unit: "percent" })],
  ).metrics;

  assert.equal(rows[0].previous, null);
});

test("preserves comparisons for metrics with no account or batch", () => {
  const rows = comparePeriods(
    [metric({ metric_value: 25 })],
    [metric({ metric_value: 20 })],
  ).metrics;

  assert.equal(rows[0].previous, 20);
  assert.equal(rows[0].growth.percent, 25);
});
