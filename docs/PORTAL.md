# Client Analytics Portal — setup and verification

The marketing site is unchanged. Everything below lives beside it under
`/[locale]/admin` (GrowthLab staff) and `/[locale]/portal` (clients), sharing the
same design tokens, locales and RTL handling.

---

## 1. Architecture in one screen

```
screenshots ──► Supabase Storage (private bucket `insights`)
                      │
                      ▼
              AI EXTRACTION  (Gemini vision, server-only)
                      │  raw values + confidence, stored verbatim
                      ▼
              APPLICATION CALCULATIONS  (src/lib/analytics/*)
                      │  totals, rates, deltas — computed in TypeScript
                      ▼
              AI INTERPRETATION  (Gemini text, reads the computed numbers)
                      │  prose only: what went well / changed / needs attention
                      ▼
              ADMIN REVIEW ──► approve ──► publish a version
                      │
                      ▼
              CLIENT PORTAL  (published versions only)
```

The four stages are deliberately separate. The AI never supplies a calculated
figure: it extracts what a screenshot literally shows, the application does the
arithmetic, and the second AI pass only writes prose about numbers it was given.

## 2. Layout

| Path | What it holds |
| --- | --- |
| `supabase/migrations/0001_init.sql` | Schema, RLS policies, storage bucket and policies |
| `src/lib/supabase/` | Browser, cookie-bound server, and service-role clients |
| `src/lib/auth.ts` | `requireAdmin`, `requireClient`, `requireAdminApi` |
| `src/lib/analytics/` | Normalisation, calculations, period comparisons |
| `src/lib/ai/` | Gemini provider, prompts, queue processor, Zod schemas |
| `src/lib/inngest/` | Inngest client and durable AI analysis function |
| `src/app/api/inngest/route.ts` | Inngest function webhook endpoint |
| `src/lib/portal/` | The portal's entire read surface (tenant-scoped queries) |
| `src/app/api/admin/**` | Admin mutations, all wrapped in `withAdmin` |
| `src/app/[locale]/admin/**` | Admin UI |
| `src/app/[locale]/portal/**` | Client UI |
| `src/locales/portal/{en,ar}.json` | Portal + admin copy, merged with the marketing dictionary |
| `scripts/bootstrap-admin.mjs` | Creates the first admin (no public sign-up exists) |
| `scripts/verify-isolation.mjs` | The mandatory tenant-isolation suite |

## 3. First-time setup

1. **Environment** — copy `.env.example` to `.env.local` and fill it in.
   `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only; neither has
   a `NEXT_PUBLIC_` twin anywhere in the codebase.
2. **Database** — apply `supabase/migrations/0001_init.sql` in the Supabase SQL
   editor (or `supabase db push`). It creates the tables, the `SECURITY DEFINER`
   helpers `auth_role()` / `auth_client_id()` / `is_admin()`, every RLS policy,
   and the private `insights` bucket with its storage policies.
3. **First admin** — `npm run bootstrap:admin -- admin@growthlab.com 'a-strong-password' 'Full Name'`.
   The password is passed on the command line and never written to a table.
4. **Run web** — `npm run dev`, then sign in at `/en/admin/login`.
5. **Configure Inngest** — set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`,
   point the Inngest app endpoint at `/api/inngest`, and apply `0003_ai_jobs.sql`
   first. The web tier only enqueues events; Gemini requests and image buffers
   run inside the Inngest function. For local development, run
   `npm run inngest:dev` alongside the Next.js dev server.

Client accounts are created from the admin UI. The generated password is shown
once, on screen, immediately after creation; it is never persisted in `clients`
or anywhere else, so if it is lost the account needs a new one.

### Summary persistence upgrade

After migrations `0008_report_transactions.sql` and
`0009_report_publication_fixes.sql`, apply the summary RPC before deploying the
updated summary routes:

```bash
npm run db:apply -- supabase/migrations/0010_report_summary.sql
npm run test:reports
npm run verify:report-summary
```

Generation and manual edits use `save_report_summary` to save the copy, its
review status and audit history in one transaction. Editing an approved version
reopens it for review. Published and archived versions remain locked, and a
revision check rejects saves if the version changes during generation or editing.
The authenticated role still cannot update status columns directly.

The database verification script uses the configured Postgres connection, creates
isolated fixtures, and rolls back its entire transaction, including the migration.

### Report deletion cleanup

Apply migration `0011_report_deletion_cleanup.sql` before deploying the updated
report deletion route and Inngest functions:

```bash
npm run test:reports
npm run verify:report-deletion
npm run db:apply -- supabase/migrations/0011_report_deletion_cleanup.sql
```

The admin-only `delete_report` transaction removes all report versions, batches,
image records, metrics, AI analyses and jobs through their foreign keys. Published
reports must first be withdrawn. A database trigger also captures direct report
deletions and client cascades, recording the screenshot paths and job IDs in
`report_deletion_cleanup` together with the deletion audit entry.

After commit, the route removes screenshots from the private `insights` bucket
and sends `ai/insights.cancelled` events for the deleted jobs. Failed cleanup
returns HTTP 202 with `cleanupPending: true`; the admin sees that cleanup is still
pending. The `cleanup-deleted-reports` Inngest function retries durable tasks
every five minutes, including deletions whose HTTP request stopped after commit.
Keep the Inngest app synced with `/api/inngest` so both the cancellation rule and
cleanup function are registered. Local development requires `npm run inngest:dev`.

Completed tasks are swept again for 24 hours to catch screenshots uploaded by a
request already in flight at deletion time, then their cleanup records are
removed. Pending tasks remain until cleanup succeeds. The sweep is restricted to
the deleted report's storage prefix, in addition to its captured image paths.
The audit entry remains as deletion history.

Workers treat deleted jobs as cancelled and recheck database state before
provider retries and result writes. An AI HTTP request already in flight may
finish, but its result cannot recreate the deleted report's data. Inngest can
retain cancelled run history; cancellation stops execution rather than deleting
that platform history.

`verify:report-deletion` exercises real PostgreSQL privileges, triggers and
cascades with temporary fixtures, then rolls back the entire transaction. It
does not call Storage or Inngest or delete existing reports.

## 4. The isolation suite (plan §72, §77)

```bash
# database + storage only
npm run verify:isolation -- --a a@acme.com:passwordA --b b@globex.com:passwordB

# add the HTTP half against a running server
npm run dev            # in another terminal
npm run verify:isolation -- --a a@acme.com:passwordA --b b@globex.com:passwordB \
  --base-url http://localhost:3000
```

It signs in as two real client accounts belonging to **different** tenants and,
as client A, attempts everything that must fail. Ids are looked up first with the
service role, so each attempt targets a row that genuinely exists — a pass means
"denied", not "matched nothing".

**Reads that must return zero rows:** B's report by id · B's report list · every
report where `client_id <> A` · B's version · **an unpublished version of A's own
report** · B's metrics · B's profile · other rows in `clients` ·
`insight_batches` · `insight_images` · `ai_analyses` · `audit_logs`.

**Writes the database must refuse:** inserting a metric · updating or deleting
A's own published metric · `profiles.role = 'admin'` · repointing
`profiles.client_id` at B · setting `reports.current_published_version_id`.

**Storage:** downloading a screenshot, minting a signed URL for one, and listing
the private bucket.

**Anonymous:** the same nine tables read with the anon key and no session.

**Over HTTP:** all fifteen admin route handlers, called first with client A's
real session cookie and then with none — every one must answer 401 or 403 — plus
the admin pages, which must redirect both callers away rather than render.

Any unexpected success prints `FAIL`, lists the offenders, and exits non-zero.
Checks with no data to aim at report `SKIP` rather than `PASS`, so an empty
database cannot produce a green run.

> Not yet executed in this repository. It needs live Supabase credentials and two
> seeded client accounts, neither of which exists in this environment. Run it
> against your project before the portal handles real client data.

## 5. Manual checklist before going live

- [ ] `npx tsc --noEmit` and `npm run build` both clean.
- [ ] `npm run verify:isolation … --base-url …` exits 0 with no `SKIP` lines you
      care about.
- [ ] Sign in as a client, copy a report URL, sign in as a different client, open
      it: a 404 page, worded identically to a genuinely missing report.
- [ ] Sign in as a client and request `/en/admin`: redirected to `/en/portal`.
- [ ] A version that is approved but **not** published is invisible in the portal.
- [ ] Unpublishing a report removes it from the portal on the next load.
- [ ] Switch to `/ar/...`: the page flips to RTL, charts mirror (category axis
      reversed, value axis on the right), numbers and dates read in Arabic, and
      no English string survives.
- [ ] A metric no platform reported shows "Not reported" — never `0`, and never a
      growth badge.
- [ ] Browser devtools → Network: no request carries a Gemini key, a service-role
      key, or a storage URL for a raw screenshot.
- [ ] Force an API error and confirm the response body is an `errorKey` only —
      no SQL text, no stack, no provider payload.
- [ ] The marketing pages (`/`, `/en`, `/ar`, `/en/template-creation`) still
      render exactly as before.

## 6. Things that are deliberately not built

Per the plan's scope rules: no PDF export, no email delivery, no client-side
comments, no multi-admin roles, no scheduled jobs, no public API. The schema
leaves room for them (`report_versions` is already versioned, `audit_logs`
already records every admin action) but nothing is stubbed in.
