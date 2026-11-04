import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appLoader } from "./helpers/app-loader.mjs";

const reportId = "33a45d0d-366a-424d-819d-b20b5a228697";
const jobId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const collect = appLoader()("src/lib/admin/system-issues.ts").collectSystemIssues;

for (const locale of ["en", "ar"]) {
  test(`${locale} health overview renders every issue type with valid translations and report links`, () => {
    const messages = JSON.parse(readFileSync(new URL(`../src/locales/portal/${locale}.json`, import.meta.url), "utf8"));
    const snapshot = {
      checkedAt: "2026-11-04T12:00:00Z", environment: "production",
      services: ["issueInboxUnconfigured", "monitoringConnected", "browserMonitoringMissing", "sentryProjectMismatch"].map((detail, i) => ({
        id: "sentry", status: "degraded", check: "live", detail, latencyMs: i, dashboardUrl: null,
      })),
      usageStatus: "setup_required", usage: { requests: 0, failed: 2, rateLimited: 1, tokens: 0, tokenSamples: 0,
        models: [{ model: "gemini-2.5-flash", minuteRequests: 20, minuteInputTokens: 0, minuteTokenSamples: 20, dayRequests: 1 }] },
      quotas: [{ model: "gemini-2.5-flash", active: true, requestsPerMinute: 20, inputTokensPerMinute: null, requestsPerDay: null }],
      jobs: { queued: 1, running: 1, failed: 1, stalledQueued: 1, stalledRunning: 1, recent: [],
        failures: [{ id: jobId, status: "dead_letter", errorKey: "aiFailed", reportId, createdAt: "2026-11-04T12:00:00Z", completedAt: null }] },
    };
    snapshot.issues = collect(snapshot, { connection: "connected", issues: [{ id: "123" }] });
    snapshot.issues.push(...collect({ ...snapshot, services: [], usage: null, usageStatus: "unavailable", jobs: null }, { connection: "setup_required", issues: [] }));
    const load = appLoader({
      "next/link": { __esModule: true, default: ({ children, scroll: _scroll, ...props }) => React.createElement("a", props, children) },
      "next/navigation": { usePathname: () => `/${locale}/admin/system`, useSearchParams: () => new URLSearchParams() },
      "next-intl": { useLocale: () => locale, useTranslations: (namespace) => (key, values = {}) => {
        const value = `${namespace}.${key}`.split(".").reduce((node, part) => node?.[part], messages);
        assert.equal(typeof value, "string", `Missing translation: ${locale}:${namespace}.${key}`);
        return Object.entries(values).reduce((text, [name, item]) => text.replaceAll(`{${name}}`, String(item)), value);
      } },
      "@tanstack/react-query": { useQuery: () => ({ data: snapshot, isPending: false, isFetching: false, isError: false }) },
      "@/components/ui/button": { Button: ({ children, variant: _variant, ...props }) => React.createElement("button", props, children) },
      "@/components/admin/SentryWorkspace": { __esModule: true, default: () => null },
    });
    const Dashboard = load("src/components/admin/SystemHealthDashboard.tsx").default;
    const html = renderToStaticMarkup(React.createElement(Dashboard));
    assert.ok(html.includes(`href="/${locale}/admin/reports/${reportId}"`));
    assert.ok(html.includes(`href="/${locale}/admin/system?tab=sentry"`));
    assert.ok(html.includes('id="system-ai-activity"'));
    assert.ok(html.includes('id="system-jobs"'));
    assert.ok(html.includes(messages.admin.system.jobs.failuresTitle));
    assert.ok(html.includes(messages.admin.system.issues.title));
    assert.ok(!html.includes("admin.errors.aiFailed"));
  });
}
