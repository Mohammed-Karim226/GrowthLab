# GrowthLab Workflow, System Design, and Architecture

This document describes the implemented system in this repository. It is a
technical reference for developers, operators, and reviewers. It describes the
actual workflow boundaries, data ownership, security model, and failure paths;
it is not a proposal for an unimplemented feature set.

## 1. Product Scope

GrowthLab is a two-sided client analytics portal alongside the public marketing
site.

- GrowthLab staff use the admin console to manage clients, social accounts,
  reports, screenshots, payments, outreach records, and review workflows.
- Clients use a restricted portal to view only their own published reports.
- Admins upload social-media screenshots. Gemini extracts literal metrics from
  those screenshots. The application performs calculations and comparisons.
- A separate AI interpretation step turns calculated values into explanatory
  prose. AI does not perform business arithmetic.
- Reports are versioned. Only an approved and published version is exposed to a
  client.

The primary invariant is: **unpublished or unapproved internal work must never
be visible to a client, and one client must never be able to access another
client's data.**

## 2. Technology and Runtime Boundaries

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Web framework | Next.js App Router 16 | Pages, layouts, route handlers, server rendering |
| UI | React 18, Tailwind, Radix/Base UI, next-intl | Admin and client workflows, loading/error states, RTL |
| Authentication | Supabase Auth + `profiles` | Login, JWT/session cookies, role and tenant binding |
| Database | Supabase Postgres | Relational data, constraints, RLS, transactional RPCs |
| File storage | Supabase Storage, private `insights` bucket | Original screenshots and signed preview URLs |
| AI provider | Gemini server-side provider | Vision extraction and text interpretation |
| Durable execution | Inngest | Event delivery, retries, concurrency, resumable AI jobs |
| Hosting | Vercel | Next.js production and preview deployments |

Important client boundaries:

- Browser code uses the publishable Supabase key and remains subject to RLS.
- Server route handlers normally use the cookie-bound Supabase client, which
  acts as the signed-in user.
- The service-role Supabase client is limited to trusted server operations that
  RLS cannot express, chiefly Auth user management and selected admin-only
  storage operations.
- Gemini keys, Inngest keys, database URLs, and service-role keys are server-only.

## 3. Repository Map

```text
src/app/[locale]/admin/**       Admin pages and layouts
src/app/[locale]/portal/**      Client pages and layouts
src/app/api/admin/**             Admin mutations and admin reads
src/app/api/auth/**              Login and logout endpoints
src/app/api/inngest/route.ts    Inngest registration/execution webhook
src/components/admin/**         Admin interactive workflows
src/components/portal/**         Client-facing report views
src/lib/auth.ts                  Session, role, and tenant guards
src/lib/api.ts                   Route-handler wrapper and safe API errors
src/lib/supabase/**              Browser, server, and service-role clients
src/lib/ai/**                    Extraction, calculation input, interpretation
src/lib/analytics/**             Normalization, calculations, comparisons
src/lib/inngest/**               Inngest client and durable function
src/lib/portal/**                Tenant-scoped portal read model
supabase/migrations/**           Schema, RLS, queue functions, extensions
```

## 4. Request and Authorization Flow

### 4.1 Browser request

```text
User action
   |
   v
React client component
   |
   | fetch() through api-client.ts
   v
Next.js route handler
   |
   | withAdmin() for admin APIs
   | requireClient() for client pages
   v
Cookie-bound Supabase client
   |
   v
Postgres RLS + database constraints
   |
   v
Translated JSON response or server-rendered page
```

`api-client.ts` expects failures in the form `{ errorKey, details? }`. Internal
SQL, stack traces, and provider payloads are logged server-side and are not sent
to the browser.

### 4.2 Session resolution

`getSessionContext()` calls `supabase.auth.getUser()`, rather than trusting a
locally decoded session. It then loads the matching `profiles` row and returns:

```text
userId, email, profile.role, profile.client_id
```

`requireAdmin(locale)` redirects unauthenticated users to the admin login and
redirects clients to their own portal. `requireClient(locale)` performs the
opposite role check and requires a non-null tenant binding. API routes use
`requireAdminApi()`, which returns `401` instead of redirecting.

### 4.3 RLS defense in depth

The application checks roles before queries, but database RLS remains the final
authorization boundary. Admins have full access to operational tables. Clients
have read-only access only to their own published report graph:

```text
auth.uid()
  -> profiles.client_id
  -> reports.client_id
  -> published report_versions
  -> published metrics and portal projections
```

Clients cannot read raw screenshot tables, AI audit output, queue jobs, audit
logs, or unpublished versions. There are no client INSERT/UPDATE/DELETE policies
for metrics or report data.

## 5. Core Data Model

```text
clients
  |-- profiles (client login binding)
  |-- accounts (social account metadata)
  |-- reports
  |     |-- report_versions
  |           |-- insight_batches
  |                 |-- insight_images -> Storage object
  |                 |-- ai_jobs
  |                 |-- ai_analyses
  |           |-- metrics
  |-- client_payment_plans
  |-- outreach_contacts / outreach_messages (where configured)

auth.users
  |-- profiles

audit_logs records administrative actions independently of the operational rows.
```

Key foreign-key behavior:

- Deleting a client cascades to accounts, reports, payment plans, and dependent
  report data. Auth user deletion is handled explicitly by the server route.
- Deleting a report cascades through versions, batches, images, analyses, jobs,
  and metrics at the database level.
- Screenshot files are not database rows: the report delete route explicitly
  removes their Storage objects before deleting the report row.
- `profiles.client_id` uses `on delete restrict` to prevent deleting a client
  while an attached profile still exists. The client-delete route removes the
  Auth user first, allowing the profile cascade to complete.

## 6. Client Creation Workflow

Entry point: `POST /api/admin/clients`, initiated by
`CreateClientDialog.tsx`.

```text
Admin fills form
  -> browser Zod validation
  -> withAdmin authorization
  -> insert clients row
  -> create Supabase Auth user (service role)
  -> insert client profile bound to client_id
  -> write audit log
  -> return credentials once
```

The Auth API and Postgres insert are separate services and cannot share one
transaction. The route therefore uses compensating actions:

- If Auth creation fails, the newly inserted client row is deleted.
- If profile creation fails, the Auth user and client row are both deleted.
- Duplicate email errors become the translated `emailTaken` response.

The generated password is held in memory and returned once to the admin. It is
not stored in `clients`, `profiles`, or any application table.

## 7. Client and Account Management

### Clients list

`GET /api/admin/clients` and the server-rendered clients page support cursor
pagination, stable ordering by `created_at` and `id`, and bounded search over
name, company, and email.

### Client updates

`PATCH /api/admin/clients/:clientId` constructs a whitelist patch from the
validated fields. It never forwards arbitrary request properties to Postgres.
The update is filtered by the client ID and produces a `CLIENT_UPDATED` audit
entry.

### Social accounts

Accounts are scoped under a client and store platform metadata such as page name,
page ID, and stage. Database uniqueness prevents duplicate page identities for
the same client/platform. Account routes use the same admin wrapper, validation,
ownership filtering, and audit pattern.

## 8. Payment Plan Workflow

Entry point: `PaymentPlanManager.tsx` and
`/api/admin/clients/:clientId/payments`.

| Operation | Request | Behavior |
| --- | --- | --- |
| List | `GET` | Returns rows for the specified client, newest billing month first |
| Create | `POST` | Validates input, normalizes currency, creates payment row |
| Update | `PATCH?paymentId=` | Applies only provided fields and verifies client ownership |
| Delete | `DELETE?paymentId=` | Deletes only a payment belonging to the URL client |

The database enforces one payment per client and billing month. A Postgres
`23505` conflict is translated to `paymentMonthExists`. When status becomes
`paid`, `paid_at` is set automatically; when status changes away from `paid`, it
is cleared unless explicitly supplied. Every mutation writes an audit event.

## 9. Report and Version Workflow

### 9.1 Create report

`POST /api/admin/reports` inserts a report container and eagerly creates version
1 in `draft` status. If version creation fails, the empty report container is
removed as compensation.

### 9.2 Create a new version

Creating a version preserves historical data. The route can optionally carry
over metrics, but the new version starts its own review/publish lifecycle.
Publishing never mutates an older version into a new report; it changes which
version is current.

### 9.3 Review lifecycle

The intended lifecycle is:

```text
draft -> processing -> needs_review -> approved -> published
  |          |              |             |
  +-------> failed <--------+-------------+

published -> archived or unpublished
```

The exact transition is enforced by the approve, publish, and unpublish route
handlers, including stale-version checks where a client sends a version ID.
Clients can only see a report when its current version is published.

### 9.4 Delete report

Published reports cannot be deleted. For an unpublished report:

1. The route queries all screenshot storage paths through the report relation.
2. It removes those paths from the private `insights` bucket.
3. It deletes the report row.
4. Foreign-key cascades remove all dependent database rows.
5. It writes `REPORT_DELETED` with the number of removed images.

This is a hard delete; there is no restore operation.

## 10. Screenshot Upload Workflow

Entry point: `UploadWorkspace.tsx` and
`POST /api/admin/insights/upload`.

```text
Select/drop image files
  -> client-side type and size check
  -> multipart request
  -> admin authorization and server revalidation
  -> ensure report version/batch is editable
  -> upload to private insights bucket
  -> insert insight_images metadata rows
  -> batch status becomes uploaded
```

Files use unique storage paths and are never exposed directly. Preview requests
are authorized admin requests that return short-lived signed URLs. The browser
does not receive a permanent bucket URL or a service key.

If metadata insertion fails after an object upload, the route attempts cleanup
of the uploaded object so Storage and database state do not drift. The server
also enforces the maximum upload size regardless of the browser check.

## 11. AI Analysis Workflow

### 11.1 Enqueue

`POST /api/admin/insights/analyze` does not call Gemini. It:

1. Authorizes the admin.
2. Verifies that the batch exists and has images.
3. Rejects locked or already-completed work unless forced.
4. Calls the `enqueue_ai_job` database function.
5. Sends `ai/insights.requested` to Inngest with the job ID.
6. Returns `202 Accepted` immediately.

The database function makes enqueueing idempotent and permits only one active
job per batch.

### 11.2 Inngest execution

The webhook at `/api/inngest` registers `process-ai-insights`.

```text
Inngest event
  -> load ai_jobs row
  -> mark job processing and increment attempts
  -> download/read screenshot buffers through server code
  -> Gemini vision extraction
  -> normalize and validate extracted values
  -> persist analyses and metrics
  -> mark job completed and batch needs_review
```

The function uses durable `step.run()` boundaries. Inngest can retry failed
steps without repeating successful durable steps. Concurrency is limited to 2
and the function has 2 retries. A terminal failure runs `onFailure`, marking the
job `dead_letter`, the batch `failed`, and recording a bounded error detail.

Production must not set `INNGEST_DEV=1`. The client selects development mode only
for non-production `NODE_ENV`; Vercel deployments use Inngest Cloud with
`INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.

### 11.3 Progress feedback

The admin UI stores active job IDs and polls `POST /api/admin/insights/jobs`
every five seconds. While jobs are active it displays a spinner, completed/total
count, processing count, and progress bar. When all jobs reach a terminal state,
the UI clears the active state, shows translated errors if needed, and refreshes
the server-rendered workspace.

## 12. AI and Analytics Separation

The pipeline intentionally separates extraction from reasoning:

```text
Screenshot
  -> Gemini vision: literal values, confidence, unreadable fields
  -> Zod schemas + normalization
  -> TypeScript calculations: totals, rates, deltas, comparisons
  -> Gemini interpretation: prose about supplied calculated values only
```

`src/lib/analytics/*` is deterministic application logic. A missing metric is
represented as null/Not reported rather than fabricated as zero. AI output is
stored as an internal audit artifact and reviewed by an admin before publishing.

## 13. Client Portal Read Workflow

```text
Client login
  -> requireClient() validates role and client_id
  -> portal/data.ts queries published report graph
  -> analytics/series builds chart-ready series
  -> portal components render metrics, comparisons, payments, and interpretation
```

Portal queries are tenant-scoped in both application filters and RLS. A client
opening another client's report URL receives the same not-found behavior as a
genuinely missing report, avoiding tenant enumeration.

Raw screenshot images, queue state, and model audit responses remain admin-only.

## 14. Error and Recovery Model

| Failure | Response/behavior |
| --- | --- |
| Anonymous admin API request | `401 unauthorized` |
| Authenticated non-admin admin API request | `401/403` equivalent safe response |
| Invalid JSON or schema | `400 invalidJson` or `422 validationFailed` |
| Missing row after scoped mutation | `404 notFound` |
| Duplicate payment month | `409 paymentMonthExists` |
| Gemini/Inngest job failure | Retry, then `dead_letter` job and failed batch |
| Report deletion of published version | `409 publishedReportDelete` |
| Audit insert failure | Logged, but does not fail the primary action |
| Stale publish/unpublish request | Rejected by route/version checks |

AI jobs also have lease-recovery migration support so an abandoned processing
job can become claimable again after its lease expires.

## 15. Deployment and Environment Workflow

### Local development

```bash
npm install
cp .env.example .env.local
npm run dev
npm run inngest:dev
```

Apply migrations to Supabase and create the first admin with
`npm run bootstrap:admin ...`.

### Vercel production

Configure server-side variables in the Vercel Production environment:

- Supabase URL and publishable key
- Supabase secret/service-role key
- Database URLs where scripts require them
- `GEMINI_API_KEY` and optional `GEMINI_MODEL`
- `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`
- `APP_URL` and email provider variables where used

Register the Inngest endpoint as:

```text
https://<production-domain>/api/inngest
```

Do not put secrets under `NEXT_PUBLIC_*`, commit `.env` files, or leave
`INNGEST_DEV=1` in Vercel. Redeploy after changing environment variables.

## 16. Verification Checklist

Before handling real client data:

- `npm run typecheck`
- `npm run build`
- Run `npm run verify:isolation` with two real client tenants and no meaningful
  `SKIP` results.
- Confirm an unpublished version is invisible to a client.
- Confirm a client cannot read another client's report, metrics, payments,
  images, or profile.
- Confirm admin routes reject client cookies and anonymous requests.
- Upload, preview, analyze, retry, fail, approve, publish, unpublish, and delete
  a test report.
- Confirm report deletion removes both database rows and Storage objects.
- Confirm Arabic pages use RTL and contain no untranslated English strings.
- Inspect browser network traffic for absence of Gemini, service-role, database,
  and raw Storage credentials.
- Confirm Inngest Cloud shows the registered function and receives a test event.

## 17. Deliberate Non-Goals

The current system does not implement PDF export, scheduled jobs, client comments,
public API access, multi-admin roles, or client-side report editing. The schema
and version model leave room for these features, but they should not be assumed
to exist when extending the workflow.
