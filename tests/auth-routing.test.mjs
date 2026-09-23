import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const userId = "33a45d0d-366a-424d-819d-b20b5a228697";
const clientId = "976e0219-3647-460a-8418-fbc305fc86aa";
function LoginForm() {}
function LoginShell() {}
class Redirect extends Error {
  constructor(destination) {
    super(`Redirect to ${destination}`);
    this.destination = destination;
  }
}

function scenario({ role = "admin", boundClientId = null, authenticated = true, hasProfile = true, metadata = {} } = {}) {
  const state = {
    user: authenticated ? { id: userId, email: "login@example.invalid", user_metadata: metadata } : null,
    profile: hasProfile ? { id: userId, role, client_id: boundClientId } : null,
    userChecks: 0,
    reads: [],
    translations: [],
  };
  const supabase = {
    auth: {
      async getUser() {
        state.userChecks += 1;
        return { data: { user: state.user }, error: null };
      },
      getSession() { assert.fail("Authorization must revalidate the user, not trust a cookie session"); },
    },
    from(table) {
      assert.equal(table, "profiles");
      const read = { table, filters: {} };
      const query = {
        select(columns) { read.columns = columns; return query; },
        eq(column, value) { read.filters[column] = value; return query; },
        async maybeSingle() {
          state.reads.push(read);
          assert.deepEqual(read.filters, { id: userId });
          return { data: state.profile, error: null };
        },
      };
      return query;
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => supabase },
    "next/navigation": { redirect: (destination) => { throw new Redirect(destination); } },
    "next-intl/server": {
      async getTranslations(options) {
        state.translations.push(options);
        return (key) => `${options.namespace}.${key}`;
      },
    },
    "@/components/auth/LoginForm": { __esModule: true, default: LoginForm, LoginShell },
  });
  return {
    state,
    auth: load("src/lib/auth.ts"),
    page: (area, locale) => load(`src/app/[locale]/${area}/login/page.tsx`).default({ params: Promise.resolve({ locale }) }),
  };
}

async function assertRedirect(run, destination) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof Redirect);
    assert.equal(error.destination, destination);
    return true;
  });
}

function assertLoginForm(element, expectedRole, initialErrorKey) {
  assert.equal(element.type, LoginShell);
  const form = element.props.children;
  assert.equal(form.type, LoginForm);
  assert.equal(form.props.expectedRole, expectedRole);
  assert.equal(form.props.initialErrorKey ?? null, initialErrorKey ?? null);
}

for (const locale of ["en", "ar"]) {
  test(`${locale}: admin pages admit the authenticated admin`, async () => {
    const { auth, state } = scenario();
    const context = await auth.requireAdmin(locale);
    assert.equal(context.userId, userId);
    assert.deepEqual(context.profile, state.profile);
    assert.equal(state.userChecks, 1);
  });

  test(`${locale}: portal pages admit only the client's assigned tenant`, async () => {
    const { auth } = scenario({ role: "client", boundClientId: clientId });
    const context = await auth.requireClient(locale);
    assert.equal(context.userId, userId);
    assert.equal(context.clientId, clientId);
  });

  for (const [label, options] of [
    ["anonymous", { authenticated: false }],
    ["client", { role: "client", boundClientId: clientId }],
    ["unknown role", { role: "superadmin" }],
    ["missing profile", { hasProfile: false }],
  ]) {
    test(`${locale}: ${label} cannot enter admin pages or be sent to the portal`, async () => {
      const { auth } = scenario(options);
      await assertRedirect(() => auth.requireAdmin(locale), `/${locale}/admin/login`);
    });
  }

  for (const [label, options] of [
    ["anonymous", { authenticated: false }],
    ["admin", { role: "admin", boundClientId: clientId }],
    ["unknown role", { role: "superadmin", boundClientId: clientId }],
    ["missing profile", { hasProfile: false }],
  ]) {
    test(`${locale}: ${label} cannot enter portal pages or be sent to admin`, async () => {
      const { auth } = scenario(options);
      await assertRedirect(() => auth.requireClient(locale), `/${locale}/portal/login`);
    });
  }

  test(`${locale}: a client without a tenant reaches a usable login form without a redirect loop`, async () => {
    const { auth, page } = scenario({ role: "client" });
    await assertRedirect(() => auth.requireClient(locale), `/${locale}/portal/login?error=no_client`);
    assertLoginForm(await page("portal", locale), "client", "noClient");
  });

  test(`${locale}: admin login skips the form only for an admin session`, async () => {
    const { page } = scenario();
    await assertRedirect(() => page("admin", locale), `/${locale}/admin`);
  });

  test(`${locale}: portal login skips the form for a client with an assigned tenant`, async () => {
    const { page } = scenario({ role: "client", boundClientId: clientId });
    await assertRedirect(() => page("portal", locale), `/${locale}/portal`);
  });

  for (const [area, role, expectedRole] of [["portal", "admin", "client"], ["admin", "client", "admin"]]) {
    test(`${locale}: an existing ${role} session stays at ${area} login`, async () => {
      const { page, state } = scenario({ role, boundClientId: clientId });
      assertLoginForm(await page(area, locale), expectedRole);
      assert.deepEqual(state.translations, [{ locale, namespace: "auth" }]);
    });
  }

  for (const [area, expectedRole] of [["admin", "admin"], ["portal", "client"]]) {
    test(`${locale}: ${area} login remains available to anonymous users`, async () => {
      const { page, state } = scenario({ authenticated: false });
      assertLoginForm(await page(area, locale), expectedRole);
      assert.equal(state.userChecks, 1);
      assert.deepEqual(state.reads, []);
    });

    test(`${locale}: ${area} login does not redirect an unsupported profile role`, async () => {
      const { page } = scenario({ role: "superadmin", boundClientId: clientId });
      assertLoginForm(await page(area, locale), expectedRole);
    });
  }
}

test("API admin authorization admits an admin using the authenticated user's stored profile", async () => {
  const { auth, state } = scenario({ metadata: { role: "client" } });
  const context = await auth.requireAdminApi();
  assert.equal(context.userId, userId);
  assert.equal(context.profile.role, "admin");
  assert.equal(state.userChecks, 1);
  assert.equal(state.reads.length, 1);
});

for (const [label, options] of [
  ["anonymous", { authenticated: false }],
  ["client", { role: "client", boundClientId: clientId }],
  ["unsupported profile role", { role: "superadmin" }],
  ["missing profile", { hasProfile: false }],
]) {
  test(`API admin authorization denies ${label} without redirecting`, async () => {
    const { auth } = scenario(options);
    assert.equal(await auth.requireAdminApi(), null);
  });
}

test("editable user metadata cannot grant an admin role or change a client's tenant", async () => {
  const { auth, state } = scenario({
    role: "client",
    boundClientId: clientId,
    metadata: { role: "admin", client_id: "another-client", id: "another-user" },
  });
  assert.equal(await auth.requireAdminApi(), null);
  await assertRedirect(() => auth.requireAdmin("en"), "/en/admin/login");
  const context = await auth.requireClient("en");
  assert.equal(context.clientId, clientId);
  assert.equal(context.profile.role, "client");
  assert.equal(context.userId, userId);
  assert.ok(state.reads.length > 0);
  assert.ok(state.reads.every((read) => read.filters.id === userId));
});

test("anonymous sessions cannot trigger a profile lookup", async () => {
  const { auth, state } = scenario({ authenticated: false, metadata: { role: "admin" } });
  assert.equal(await auth.getSessionContext(), null);
  assert.deepEqual(state.reads, []);
});

test("invalid locales cannot become external or cross-area guard destinations", async () => {
  const { auth, page } = scenario({ authenticated: false });
  for (const locale of ["https://example.invalid", "../admin", "unknown"]) {
    await assertRedirect(() => auth.requireAdmin(locale), "/en/admin/login");
    await assertRedirect(() => auth.requireClient(locale), "/en/portal/login");
    assertLoginForm(await page("admin", locale), "admin");
    assertLoginForm(await page("portal", locale), "client");
  }
});
