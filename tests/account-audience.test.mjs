import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createTranslator } from "use-intl/core";
import { appLoader } from "./helpers/app-loader.mjs";

const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const clientId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const accountId = "e61a14eb-3669-4615-a601-f33c1d0495ee";
const otherClientId = "626d0a49-fae0-46bd-8b12-0536e6c7d48d";
const logging = appLoader()("src/lib/security/logging.ts");
const { accountAudienceCountSchema } = appLoader()("src/lib/validation/schemas.ts");

function account(overrides = {}) {
  return {
    id: accountId, client_id: clientId, platform: "instagram", page_name: "Main account",
    page_id: "main-account", stage: "active", audience_count: 1200,
    created_at: "2026-11-03T12:00:00Z", updated_at: "2026-11-03T12:00:00Z", ...overrides,
  };
}

function scenario(options = {}) {
  const state = { role: "admin", clientId, accounts: [account(), account({ id: "other-account", client_id: otherClientId })], ...options, reads: [], writes: [] };
  const db = {
    auth: { getUser: async () => ({ data: { user: state.role ? { id: actorId } : null } }) },
    from(table) {
      const operation = { table, filters: {}, values: null, kind: "select" };
      let pending;
      function execute(single = false) {
        if (pending) return pending;
        pending = Promise.resolve().then(() => {
          if (operation.kind !== "select") {
            state.writes.push(operation);
            if (table === "audit_logs") return { data: null, error: null };
            assert.equal(table, "accounts");
            if (operation.kind === "insert") {
              const saved = account({ id: "new-account", audience_count: null, ...operation.values });
              state.accounts.push(saved);
              return { data: saved, error: null };
            }
            const saved = state.accounts.find((row) => row.id === operation.filters.id);
            if (saved) Object.assign(saved, operation.values);
            return { data: saved ? { ...saved } : null, error: null };
          }
          state.reads.push(operation);
          if (table === "profiles") return { data: { id: actorId, role: state.role, client_id: state.clientId }, error: null };
          if (table === "clients") return { data: operation.filters.id === clientId ? { id: clientId } : null, error: null };
          if (table === "insight_batches") return { data: null, count: 0, error: null };
          assert.equal(table, "accounts");
          const rows = state.accounts.filter((row) => Object.entries(operation.filters).every(([key, value]) => row[key] === value));
          return { data: single ? rows[0] ?? null : rows.map((row) => ({ ...row })), error: null };
        });
        return pending;
      }
      const query = {
        select(columns) { operation.columns = columns; return query; },
        eq(key, value) { operation.filters[key] = value; return query; },
        order() { return query; },
        returns() { return query; },
        insert(values) { operation.values = values; operation.kind = "insert"; return query; },
        update(values) { operation.values = values; operation.kind = "update"; return query; },
        maybeSingle() { return execute(true); }, single() { return execute(true); },
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/security/logging": { ...logging, logEvent: () => {} },
    "@/lib/observability/report-error": { reportError: () => {} },
  });
  function request(path, method, body) {
    return new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }
  return {
    state,
    create(body) { return load("src/app/api/admin/clients/[clientId]/accounts/route.ts").POST(request(`/api/admin/clients/${clientId}/accounts`, "POST", body), { params: Promise.resolve({ clientId }) }); },
    update(body) { return load("src/app/api/admin/accounts/[accountId]/route.ts").PATCH(request(`/api/admin/accounts/${accountId}`, "PATCH", body), { params: Promise.resolve({ accountId }) }); },
    list() { return load("src/app/api/portal/accounts/route.ts").GET(new Request(`http://localhost/api/portal/accounts?clientId=${otherClientId}`)); },
  };
}

test("audience count accepts unknown and safe whole numbers, rejecting invalid readings", () => {
  for (const value of [null, 0, 5000, Number.MAX_SAFE_INTEGER]) assert.ok(accountAudienceCountSchema.safeParse(value).success);
  for (const value of [-1, 1.5, NaN, Infinity, "5000", Number.MAX_SAFE_INTEGER + 1]) assert.ok(!accountAudienceCountSchema.safeParse(value).success);
});

test("an admin can create a count and the owning client receives the saved value", async () => {
  const app = scenario();
  const created = await app.create({ platform: "youtube", pageName: "Channel", audienceCount: 5000 });
  assert.equal(created.status, 201);
  const saved = (await created.json()).account;
  assert.equal(saved.audience_count, 5000);
  app.state.role = "client";
  const response = await app.list();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { accounts } = await response.json();
  assert.equal(accounts.find((row) => row.id === saved.id).audience_count, 5000);
  assert.ok(accounts.every((row) => row.client_id === clientId));
  assert.ok(app.state.reads.filter((read) => read.table === "accounts").every((read) => read.filters.client_id === clientId));
});

test("editing a count updates the portal; zero, clearing, and omitted fields remain distinct", async () => {
  const app = scenario();
  for (const count of [45000, 0, null]) {
    app.state.role = "admin";
    const response = await app.update({ audienceCount: count });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).account.audience_count, count);
    app.state.role = "client";
    assert.equal((await (await app.list()).json()).accounts.find((row) => row.id === accountId).audience_count, count);
  }
  app.state.role = "admin";
  await app.update({ audienceCount: 11000 });
  const renamed = await app.update({ pageName: "Renamed" });
  assert.equal((await renamed.json()).account.audience_count, 11000);
});

test("legacy requests without a count do not require the new database column", async () => {
  const app = scenario();
  const response = await app.create({ platform: "instagram", pageName: "New account" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).account.audience_count, null);
  assert.equal(Object.hasOwn(app.state.writes.find((write) => write.table === "accounts").values, "audience_count"), false);
  const renamed = await app.update({ pageName: "Renamed" });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).account.audience_count, 1200);
});

test("invalid audience counts never reach an account write", async () => {
  for (const value of [-1, 0.25, "5000", Number.MAX_SAFE_INTEGER + 1]) {
    const app = scenario();
    assert.equal((await app.update({ audienceCount: value })).status, 422);
    assert.equal((await app.create({ platform: "facebook", pageName: "Page", audienceCount: value })).status, 422);
    assert.equal(app.state.writes.length, 0);
  }
});

test("clients and anonymous visitors cannot edit counts or read another client's accounts", async () => {
  for (const role of ["client", null]) {
    const app = scenario({ role });
    assert.equal((await app.update({ audienceCount: 1000 })).status, 401);
    assert.equal((await app.create({ platform: "facebook", pageName: "Page", audienceCount: 1000 })).status, 401);
    assert.equal(app.state.writes.length, 0);
  }
  assert.equal((await scenario({ role: null }).list()).status, 401);
  assert.equal((await scenario({ role: "admin" }).list()).status, 403);
  assert.equal((await scenario({ role: "client", clientId: null }).list()).status, 403);
});

test("portal sidebar renders localized followers/subscribers, zero and missing counts", () => {
  for (const locale of ["en", "ar"]) {
    const messages = JSON.parse(readFileSync(`src/locales/portal/${locale}.json`, "utf8"));
    const t = createTranslator({ locale, messages, namespace: "portal" });
    const link = ({ children, ...props }) => React.createElement("a", props, children);
    const load = appLoader({
      "next-intl": { useLocale: () => locale, useTranslations: () => t },
      "next/navigation": { usePathname: () => `/${locale}/portal`, useRouter: () => ({}) },
      "next/link": link,
      "@tanstack/react-query": { useQuery: (options) => ({ data: options.initialData }) },
      "@/components/auth/SignOutButton": () => null,
      "@/components/portal/PaymentPlanCard": () => null,
      "@/components/ui/button": { Button: ({ children }) => React.createElement("button", null, children) },
    });
    const Shell = load("src/components/portal/PortalShell.tsx").default;
    const html = renderToStaticMarkup(React.createElement(Shell, {
      clientId, clientName: "Client", clientEmail: null, payments: [],
      accounts: [account({ audience_count: 0 }), account({ id: "youtube", platform: "youtube", audience_count: 5000 }), account({ id: "unknown", platform: "tiktok", audience_count: null })],
    }));
    assert.ok(html.includes(t("nav.followers")));
    assert.ok(html.includes(t("nav.subscribers")));
    assert.ok(html.includes(new Intl.NumberFormat(locale).format(5000)));
    assert.match(html, new RegExp(`<bdi[^>]*>${new Intl.NumberFormat(locale).format(0)}<\/bdi>`, "u"));
    assert.match(html, /<bdi[^>]*>—<\/bdi>/u);
  }
});
