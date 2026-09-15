# GrowthLab: production architecture review

Repository investigation dated **2026-09-13**, baseline commit **224f451**, including the working tree. This is a source-based assessment, not a production load test or a certification of deployed configuration. No application behavior, database, credentials, or remote infrastructure was changed for this review.

**Evidence convention:** `[E01]` refers to the source register in section 2. Function names and implementation details accompany conclusions. “Current” means implemented in the inspected source. “Recommended” means future work. **UNKNOWN — NOT DETERMINABLE FROM REPOSITORY** identifies operational facts that require deployment access or measurements. Findings describe reachable failure sequences; they do not imply those incidents have already occurred.

## 1. Executive Summary

GrowthLab combines a public English/Arabic marketing site, a staff administration console, a client analytics portal, and an internal outreach CRM. Staff create client logins and social accounts, upload screenshots, run Gemini extraction, review metrics, generate report narratives, and publish report versions. Clients see published analytics, manual payment records, and a gallery of source screenshots. Outreach drafts can be generated and copied; the application does not send email or collect payments. [E01–E04, E12–E21]

The implementation is a **modular Next.js application using managed backend services**, with database access directly in route handlers, Server Components, and a portal read module. It is not a service/repository layered backend. Supabase provides authentication, a PostgREST interface to Postgres, and private object storage. Inngest invokes an application endpoint to execute screenshot analysis. Gemini is called through a small REST adapter. [E05–E11, E17–E19]

Strong foundations include cookie-bound database clients, explicit API authorization, tenant-scoped portal reads, database row-level security (RLS), schema validation, private storage, bounded top-level report lists, a provider abstraction, and separation of AI extraction from deterministic arithmetic. These are useful production building blocks. [E05–E10, E14, E19, E22]

The largest risks are correctness and recovery, before database scale:

| Risk | Source-based conclusion |
| --- | --- |
| Credential exposure | Gmail and related-service passwords are stored as ordinary text/JSON and delivered wholesale to admin browser state. Hiding their display is not encryption or access minimization. [E20] |
| Publication integrity | Approve, publish, unpublish, and edits span independent statements. Approval can survive subsequent metric changes; races can expose unreviewed content or make publication state disagree. [E12–E14] |
| Lost work dispatch | `enqueue_ai_job` commits before `inngest.send`. A send failure leaves a job queued and its batch processing, while a retry is rejected as `batchProcessing`. No dispatcher/reconciler is implemented. [E17–E18] |
| Retry correctness | One durable Inngest step includes the provider call and several nontransactional writes. A replay can repeat paid work. Keeping manual metrics while inserting new AI metrics can double-count the same fact. [E18–E19, E22] |
| Portal account attribution | `loadPortalMetrics` embeds `insight_batches`, but clients have no SELECT policy for that table. With the supplied policies, the nested data is unavailable; account filters and comparisons cannot rely on it. [E09–E10] |
| Operational confidence | No CI configuration, production metrics/tracing, automated recovery loop, or restore evidence was found. Local installed Next.js differs from the lockfile. [E01, E23–E25] |

**Assessment:** a credible foundation for a controlled single-agency reporting product, with launch blockers for sensitive credential handling and report/job integrity. It is not demonstrated ready for a large SaaS deployment. A single global `admin` role can access all clients; separate customer agencies must not share this backend under the current permissions. [E06, E09, E21]

Do not start with microservices, Redis, replicas, or sharding. First make state transitions atomic, work dispatch recoverable, metrics unambiguous, and failures observable. Then measure query pressure and introduce only the infrastructure that addresses it.

## 2. Repository Architecture

### Actual repository map

```text
project0/
|-- package.json / package-lock.json     npm scripts and dependency graph
|-- next.config.mjs                     next-intl plugin; remote image patterns
|-- tsconfig.json / eslint.config.mjs    strict TS; Next ESLint configuration
|-- tailwind.config.js / postcss.config.js / components.json
|-- .env.example                        documented configuration names
|-- README.md
|-- docs/
|   |-- PORTAL.md                       setup and older verification guidance
|   |-- WORKFLOW_ARCHITECTURE.md         earlier architecture narrative
|   |-- PRODUCT_ROADMAP.md              product evolution proposals
|   `-- PRODUCTION_ARCHITECTURE_REVIEW.md
|-- public/                             marketing images and testimonials
|-- scripts/
|   |-- apply-migration.mjs             direct Postgres DDL runner
|   |-- bootstrap-admin.mjs             first administrator provisioning
|   |-- reset-admin-password.mjs        privileged account repair
|   |-- check-supabase.mjs / probe-schema.mjs
|   `-- verify-isolation.mjs            live two-client access checks
|-- supabase/migrations/                10 SQL files, 16 application tables
`-- src/
    |-- proxy.ts                       session refresh for protected page paths
    |-- app/
    |   |-- layout.tsx / page.tsx       providers, metadata, root redirect
    |   |-- [locale]/
    |   |   |-- layout.tsx / page.tsx   localization and marketing
    |   |   |-- admin/login/
    |   |   |-- admin/(dashboard)/     overview, clients, reports, outreach
    |   |   |-- portal/login/
    |   |   `-- portal/(dashboard)/    overview, reports, payments, gallery
    |   |-- (template-creation)/[locale]/template-creation/  legacy redirect
    |   `-- api/
    |       |-- auth/{login,logout}/
    |       |-- admin/{clients,accounts,gmail-accounts,reports,metrics}/
    |       |-- admin/insights/{upload,preview,analyze,images,jobs}/
    |       |-- admin/outreach/        CRUD plus generate/
    |       `-- inngest/               durable execution HTTP adapter
    |-- components/
    |   |-- home/                     public presentation
    |   |-- auth/                     login and sign-out UI
    |   |-- admin/                    interactive administration
    |   |-- portal/                   reports, gallery, payments, charts/
    |   |-- templateCreation/Home.tsx outreach workspace
    |   `-- ui/                       shared primitives
    |-- lib/
    |   |-- supabase/{server,admin,client}.ts
    |   |-- auth.ts / api.ts / api-client.ts
    |   |-- ai/                       provider, prompts, extraction, job logic
    |   |-- analytics/                normalization, calculations, comparisons
    |   |-- inngest/                  client and function registration
    |   |-- portal/{data,series}.ts    portal reads and chart projections
    |   |-- validation/schemas.ts
    |   `-- env.ts / uploads.ts / pagination.ts / i18n.ts / format.ts / utils.ts
    |-- providers/Providers.tsx        React Query, theme, toast providers
    |-- hooks/use-mobile.tsx           viewport hook
    |-- i18n/request.ts                locale resolution
    |-- locales/                      en/ar marketing and portal dictionaries
    `-- types/database.ts              hand-maintained Supabase schema types
```

There are **25 `route.ts` files**: 22 admin, 2 auth, and 1 Inngest. The ordinary handlers export 38 method handlers; Inngest additionally exports GET/POST/PUT. No `services/`, `repositories/`, server action implementation (`"use server"`), standalone worker executable, scheduled job, Dockerfile, CI workflow, or deployment manifest was found in the inspected source tree. The existing SQL lease functions are not a running worker. A browser Supabase factory exists but has no application import/call site. [E05, E18, E23]

### Source evidence register

Links point to repository files; function names remain useful if line numbers move. SQL migrations describe intended schema, not proof of what is applied remotely.

| ID | Files / symbols | What the evidence establishes |
| --- | --- | --- |
| E01 | [package.json](../package.json), [lockfile](../package-lock.json), [README](../README.md) | npm, framework, dependencies, commands, stated product scope |
| E02 | [Next config](../next.config.mjs), [TS config](../tsconfig.json), [ESLint config](../eslint.config.mjs) | image allowlist, locale plugin, strict typing, lint settings |
| E03 | [root layout](../src/app/layout.tsx), [locale layout](../src/app/[locale]/layout.tsx), [locale resolver](../src/i18n/request.ts), [dictionary loader](../src/lib/i18n.ts) | rendering, locale dictionaries, root providers |
| E04 | [Providers](../src/providers/Providers.tsx), [api-client](../src/lib/api-client.ts), [AnalyticsWorkspace](../src/components/portal/AnalyticsWorkspace.tsx) | mutation state, fetch errors, browser filtering |
| E05 | [server client](../src/lib/supabase/server.ts), [admin client](../src/lib/supabase/admin.ts), [browser client](../src/lib/supabase/client.ts) | cookie-bound HTTP client, service-role bypass, unused browser singleton |
| E06 | [proxy](../src/proxy.ts), [auth](../src/lib/auth.ts): `getSessionContext`, `requireAdmin`, `requireClient`, `requireAdminApi` | authentication and role/tenant guards |
| E07 | [login](../src/app/api/auth/login/route.ts), [logout](../src/app/api/auth/logout/route.ts), [LoginForm](../src/components/auth/LoginForm.tsx), [SignOutButton](../src/components/auth/SignOutButton.tsx) | password login and session navigation |
| E08 | [API plumbing](../src/lib/api.ts): `withAdmin`, `parseBody`, `writeAuditLog`; [schemas](../src/lib/validation/schemas.ts), [pagination](../src/lib/pagination.ts) | request validation, error contract, best-effort auditing, cursors |
| E09 | [base migration](../supabase/migrations/0001_init.sql), [accounts upgrade](../supabase/migrations/0002_accounts.sql), [types](../src/types/database.ts) | entities, indexes, RLS, Storage policy, database constraints |
| E10 | [portal reads](../src/lib/portal/data.ts): `hydrate`, `listPublishedPeriodsPage`, `loadPortalMetrics`, gallery loaders | tenant reads, publication selection, signed client images |
| E11 | [admin overview](<../src/app/[locale]/admin/(dashboard)/page.tsx>), [client list](<../src/app/[locale]/admin/(dashboard)/clients/page.tsx>), [client detail](<../src/app/[locale]/admin/(dashboard)/clients/[clientId]/page.tsx>), [report workspace](<../src/app/[locale]/admin/(dashboard)/reports/[reportId]/page.tsx>) | server-rendered admin query workloads |
| E12 | [report create](../src/app/api/admin/reports/route.ts), [versions](../src/app/api/admin/reports/[reportId]/versions/route.ts), [report delete](../src/app/api/admin/reports/[reportId]/route.ts) | creation, carry-over, deletion compensation |
| E13 | [approval](../src/app/api/admin/reports/[reportId]/approve/route.ts), [publication](../src/app/api/admin/reports/[reportId]/publish/route.ts) | review gate and nontransactional publication |
| E14 | [metric mutations](../src/app/api/admin/metrics/[metricId]/route.ts), [summary](../src/app/api/admin/reports/[reportId]/summary/route.ts) | manual correction, summary generation/editing, status checks |
| E15 | [clients API](../src/app/api/admin/clients/route.ts), [client mutations](../src/app/api/admin/clients/[clientId]/route.ts), [account create](../src/app/api/admin/clients/[clientId]/accounts/route.ts), [account mutations](../src/app/api/admin/accounts/[accountId]/route.ts) | provisioning, search, deletion, account binding |
| E16 | [upload](../src/app/api/admin/insights/upload/route.ts), [preview](../src/app/api/admin/insights/preview/route.ts), [image delete](../src/app/api/admin/insights/images/[imageId]/route.ts), [limits](../src/lib/uploads.ts) | file checks, paths, storage lifecycle |
| E17 | [enqueue](../src/app/api/admin/insights/analyze/route.ts), [jobs status](../src/app/api/admin/insights/jobs/route.ts), [single status](../src/app/api/admin/insights/jobs/[jobId]/route.ts), [UploadWorkspace](../src/components/admin/UploadWorkspace.tsx) | event dispatch and in-tab polling |
| E18 | [Inngest client](../src/lib/inngest/client.ts), [function](../src/lib/inngest/functions.ts), [endpoint](../src/app/api/inngest/route.ts), [job SQL](../supabase/migrations/0003_ai_jobs.sql), [lease SQL](../supabase/migrations/0004_ai_job_lease_recovery.sql) | active durable execution versus unused claim/finalization RPCs |
| E19 | [job processor](../src/lib/ai/process-job.ts), [image loader](../src/lib/ai/analyze-batch.ts), [Gemini](../src/lib/ai/gemini.ts), [retry/provider](../src/lib/ai/provider.ts), [extraction](../src/lib/ai/extraction.ts), [AI schemas](../src/lib/ai/schemas.ts), [prompts](../src/lib/ai/prompts.ts) | external calls, retries, bounded output, persistence |
| E20 | [credential schema](../supabase/migrations/0004_client_gmail_accounts.sql), [credential list/create](../src/app/api/admin/clients/[clientId]/gmail-accounts/route.ts), [credential edits](../src/app/api/admin/gmail-accounts/[accountId]/route.ts), [GmailCredentialManager](../src/components/admin/GmailCredentialManager.tsx) | plaintext credentials in database and client props/responses |
| E21 | [outreach SQL](../supabase/migrations/0005_outreach.sql), [outreach API](../src/app/api/admin/outreach/route.ts), [generation](../src/app/api/admin/outreach/generate/route.ts), [workspace](../src/components/templateCreation/Home.tsx), [payment API](../src/app/api/admin/clients/[clientId]/payments/route.ts), [payment SQL](../supabase/migrations/0003_client_payment_plans.sql), [price upgrade](../supabase/migrations/0004_payment_plan_total_price.sql) | global CRM, manual status records, synchronous drafting, payment constraints |
| E22 | [calculations](../src/lib/analytics/calculations.ts), [comparisons](../src/lib/analytics/comparisons.ts), [normalization](../src/lib/analytics/normalization.ts), [series](../src/lib/portal/series.ts) | arithmetic and aggregation semantics |
| E23 | [migration runner](../scripts/apply-migration.mjs), [schema check](../scripts/check-supabase.mjs), [probe](../scripts/probe-schema.mjs), [isolation suite](../scripts/verify-isolation.mjs), [bootstrap](../scripts/bootstrap-admin.mjs), [reset](../scripts/reset-admin-password.mjs) | operational scripts, DDL transaction, test scope |
| E24 | [env example](../.env.example), [env accessor](../src/lib/env.ts), [.gitignore](../.gitignore) | configuration and secret boundaries |
| E25 | [portal guide](PORTAL.md), [workflow guide](WORKFLOW_ARCHITECTURE.md), [product roadmap](PRODUCT_ROADMAP.md) | previous claims and future plans; not proof of deployment |
| E26 | [portal overview](<../src/app/[locale]/portal/(dashboard)/page.tsx>), [portal layout](<../src/app/[locale]/portal/(dashboard)/layout.tsx>), [payments page](<../src/app/[locale]/portal/(dashboard)/payments/page.tsx>), [report detail](<../src/app/[locale]/portal/(dashboard)/reports/[reportId]/page.tsx>), [gallery month](<../src/app/[locale]/portal/(dashboard)/gallery/[month]/page.tsx>) | full portal workloads and repeated guards |

### Investigation and verification limits

Inspected package/configuration files, every API handler, all migrations, authentication and database factories, page query entry points, AI/provider functions, portal projections, mutation/polling components, analytics, operational scripts, and existing documentation. Searched source for server actions, caches, globals, collections, filesystem use, connection constructors, external calls, timers, logging, security checks, deployment and test files. Supporting visual components use the shared presentation/state patterns; installed libraries are not treated as proof of active integration.

`npm run typecheck` passed against the existing dependency installation. Lint and build attempts were blocked by Windows sandbox `EPERM` during parent-path resolution. An elevated lint attempt was rejected because automatic approval review itself returned a service authorization 403. **Neither lint nor a production build is claimed to have passed.**

Live isolation, migration, auth, AI, Storage, and performance tests were not executed. The isolation script performs attempted writes/deletes that would actually mutate data if policies were broken, so it belongs on seeded disposable test tenants. No private `.env` values were printed. No live database size, execution plans, latency, pool limits, service quotas, hosting limits, DNS/CDN topology, or backup settings were available as repository evidence.

## 3. Technology Stack

| Layer | Current implementation | Important qualification |
| --- | --- | --- |
| Framework | Next.js App Router; declaration `^16.2.6` | Lockfile resolves **16.3.3**, inspected installed package is **16.2.6**. Clean-install behavior is not validated by the current typecheck. |
| Runtime | Node-oriented Next server; local Node **22.13.0** | Uploads use `node:crypto` and `Buffer`; no explicit Edge runtime or Node version pin. Installed Next declares Node `>=20.9.0`. Deployed version unknown. |
| Package manager | npm; `package-lock.json` | No `packageManager` pin; recommend `npm ci` in a controlled build. |
| UI | React/React DOM 18.3.1; Tailwind 4; Base UI/Radix; Framer Motion | Recharts is used for portal charts. Plotly being installed does not establish a live Plotly integration. |
| Internationalization | next-intl; `en` and `ar`; RTL container | Both marketing and portal dictionaries are merged for locale rendering. |
| Data/state | Server Components + fetch route mutations + TanStack React Query | Query provider exists; source uses mutation hooks, not a populated `useQuery` server-data cache. |
| Database interface | `@supabase/supabase-js` 2.58.0; SSR 0.7.0 | HTTP PostgREST query builder, **not Prisma/Drizzle or a Node SQL ORM**. |
| Relational database | Supabase Postgres; SQL migrations and RLS | Deployed Postgres version and applied migration state unknown. |
| Direct SQL | `pg` 8.13.1 dev dependency | Used by migration script, not request handlers. |
| Auth | Supabase password auth and SSR cookies | Profile role and `client_id` live in database. |
| Object storage | Supabase private `insights` bucket | Original screenshots; signed URLs for authorized viewers. |
| AI | Gemini REST `v1beta/models/...:generateContent` | Default model string `gemini-2.5-flash`, optional environment override; availability/quota unverified. |
| Background execution | Inngest 4.18.1 and `ai_jobs` status table | Execution occurs through `/api/inngest`; no separate worker process in repo. |
| Observability | `console.error`, audit rows, AI attempt/job rows, error digests | No instrumented metrics, distributed tracing, or error tracking integration found. |
| Hosting | Vercel described in docs and linked from outreach defaults | **UNKNOWN — NOT DETERMINABLE FROM REPOSITORY:** actual deployment, regions, CDN, load balancer, limits, SLA. |

### Environment contract

`supabaseUrl()` accepts `NEXT_PUBLIC_SUPABASE_URL` then `SUPABASE_URL`. `supabaseAnonKey()` accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then `SUPABASE_PUBLISHABLE_KEY`. Service credentials accept `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`. Gemini uses `GEMINI_API_KEY` / `GEMINI_MODEL`. The Inngest SDK uses its event/signing configuration; the app sets `isDev` from `NODE_ENV !== "production"`. `DIRECT_URL` and fallback `DATABASE_URL` are for migrations. Upload limits read `NEXT_PUBLIC_MAX_UPLOAD_BYTES`. [E18, E23–E24]

Validation is lazy: missing required values throw when accessed. No boot-time complete configuration validation is implemented. `.env.example` does not create a deployment configuration. Existing docs mention `APP_URL` and email provider values “where used”; no active email delivery implementation or matching application dependency was found. `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, but not every conceivable filename such as `.env.production`.

## 4. Current System Architecture

### Implemented components only

```text
                         Browser
                marketing / admin / portal
                   |                 ^
             page requests      HTML/RSC/JSON
                   v                 |
             Next.js application server
             +------------------------------+
             | proxy: protected pages only  |
             | Server Components / layouts  |
             | auth guards / admin APIs     |
             | analytics / AI provider      |
             | /api/inngest execution        |<----- Inngest
             +------------------------------+          ^
                |          |          |                 |
                |          |          +--- event send --+
                |          +-----------------------> Gemini REST
                v
       Supabase HTTP services
       +------------------------+
       | Auth                   |  JWT identity / refresh
       | PostgREST -> Postgres   |  RLS, records, ai_jobs, audit
       | Storage                |  private insights objects
       +------------------------+
                ^
                +--- Browser fetch of authorized signed image URLs

       Operator -> apply-migration.mjs -> pg.Client -> Postgres DDL
```

There is no evidence for a separate internal backend service, application Redis, local session store, replica router, message broker other than Inngest, email delivery provider, payment gateway, analytics collector, or monitoring backend. Provider-internal routing and connection pools are not user-managed components in this repository. DNS/TLS/CDN/load-balancer arrangements remain unknown rather than being added to this current diagram.

### Boundaries and rendering

Marketing renders from source content and locale dictionaries; root `/` redirects to `/en`. Locale parameters are generated for `en`/`ar`, and invalid locales are rejected. Protected layouts and many pages explicitly use `dynamic = "force-dynamic"`; they read cookies and fetch live data. Static generation of the public pages is plausible from their source but not confirmed by a successful build here. [E02–E03, E26]

Server Components fetch directly through Supabase. They pass serializable props to client components for chart filtering, forms, dialogs, and local optimistic state. Mutations typically call `apiPost`/`apiPatch`/`apiDelete`, then `router.refresh()` to reload Server Component data. The outreach workspace fetches its own API with `cache: "no-store"`. No server actions, GraphQL layer, realtime subscriptions, or public integration API are implemented. [E04, E08, E21]

The route handlers combine transport, validation, business transitions, queries, external calls, and auditing. A small monolith is reasonable here; the problem is that critical invariants are distributed among handlers rather than enforced in transactional database commands. Extracting classes called “services” would not itself fix that.

## 5. Request Lifecycle

### Endpoint inventory

Paths below are real routes. `:id` denotes an App Router dynamic segment. Every `/api/admin` method uses `withAdmin`; APIs are outside the proxy matcher. [E06–E21]

| Endpoint | Methods | Work |
| --- | --- | --- |
| `/api/auth/login` | POST | Password login; profile lookup; cookie and destination |
| `/api/auth/logout` | POST | Supabase sign-out |
| `/api/admin/clients` | GET, POST | Cursor search/list; tenant + Auth user + profile |
| `/api/admin/clients/:clientId` | PATCH, DELETE | Business fields; Auth user deletion and DB cascade |
| `/api/admin/clients/:clientId/accounts` | POST | Social account creation |
| `/api/admin/accounts/:accountId` | PATCH, DELETE | Account metadata; in-use checks |
| `/api/admin/clients/:clientId/gmail-accounts` | GET, POST | Credential list/create |
| `/api/admin/gmail-accounts/:accountId` | PATCH, DELETE | Credential edit/delete |
| `/api/admin/clients/:clientId/payments` | GET, POST, PATCH, DELETE | Manual payment records; query `paymentId` for edit/delete |
| `/api/admin/reports` | POST | Report plus first draft |
| `/api/admin/reports/:reportId` | DELETE | Unpublished report and screenshot cleanup |
| `/api/admin/reports/:reportId/versions` | POST | Next draft; optional metric carry-over |
| `/api/admin/reports/:reportId/approve` | POST | Review gate |
| `/api/admin/reports/:reportId/publish` | POST, DELETE | Publish / withdraw |
| `/api/admin/reports/:reportId/summary` | POST, PATCH | Synchronous AI narrative / reviewed narrative save |
| `/api/admin/metrics/:metricId` | PATCH, DELETE | Correct/remove metric |
| `/api/admin/insights/upload` | POST | Multipart upload |
| `/api/admin/insights/preview` | POST | Sign up to 48 image IDs |
| `/api/admin/insights/analyze` | POST | Persist and dispatch AI job |
| `/api/admin/insights/images/:imageId` | DELETE | Remove pre-analysis image |
| `/api/admin/insights/jobs` | POST | Status lookup for 1–100 job IDs |
| `/api/admin/insights/jobs/:jobId` | GET | One job's safe status/result |
| `/api/admin/outreach` | GET, POST, PATCH, DELETE | Contacts, senders, drafts and status; bulk message clear |
| `/api/admin/outreach/generate` | POST | Synchronous Gemini draft with local fallback |
| `/api/inngest` | GET, POST, PUT | SDK registration/execution; not a browser admin API |

### A. Login

```text
LoginForm -> POST /api/auth/login -> parseBody(bodySchema)
          -> cookie-bound createClient -> Auth.signInWithPassword
          -> profiles SELECT role, client_id -> role-based redirect JSON
          -> SSR cookie writes -> router.replace + router.refresh
```

The proxy does not intercept this API. The route validates email/password/expected role; `expectedRole` is only a UI hint. Invalid credentials return a generic 401. A missing/invalid profile signs out and returns an error. Profile lookup failure is logged. Successful login returns the role's home path, not a user-supplied redirect. The next page request enters the protected proxy and server guard. No application session is inserted into a local Map or table. [E06–E07]

### B. Portal dashboard load and report detail

```text
GET /en/portal -> proxy getUser/refresh
  -> PortalLayout requireClient -> Auth getUser + profiles lookup
  -> accounts SELECT + latest 12 payments SELECT
  -> PortalOverviewPage requireClient -> Auth/profile again
  -> listPublishedPeriods(clientId): reports limit 25, use 24
  -> hydrate: versions IN (...) AND status='published'
  -> loadPortalMetrics: metrics IN (...) with account embed
  -> comparePeriods -> HTML/RSC props -> AnalyticsWorkspace browser filters
```

Layout and page work can be scheduled independently by Next; this diagram shows logical dependencies, not a guaranteed serialization order. No explicit request-scoped auth memoization exists. A full initial render has about nine application PostgREST reads and three explicit `getUser` call sites including proxy; SDK refresh behavior and framework deduplication can alter network counts. Avoid claiming each client factory creates a database connection. [E05–E06, E10, E26]

Report detail obtains the session's tenant, loads `reports` by both `reportId` and `clientId`, hydrates the pointed version, finds the preceding period, batches metric retrieval for the two versions, calculates comparisons, and renders. Another tenant's report resolves to the same 404 path as a missing report. The account embed issue in section 10 affects the metrics returned, even though tenant filtering is present.

### C. Admin list and search

`AdminClientsPage` uses the admin layout guard and cookie-bound RLS queries. It normalizes `q`, decodes a cursor, requests 11 rows to display 10, and executes an exact total count in parallel. Ordering is `(created_at, id)` with direction reversed for backward navigation. It embeds each client's report count. The JSON list route performs the same style of search with a default 25 and maximum 100 page size, without the extra global total. [E08, E11, E15]

This is database search, not a browser search index. `%term%` filters span name, company, and email. Existing B-tree indexes do not accelerate arbitrary substring matching. Invalid cursor structure returns null, but cursor date/UUID syntax is not validated; embedded PostgREST filter strings deserve stricter validation.

### D. Create a client and login

```text
CreateClientDialog -> POST /api/admin/clients
 -> withAdmin (Auth + profile) -> createClientSchema
 -> clients INSERT as current admin
 -> service-role Auth.admin.createUser(email_confirm=true)
 -> service-role profiles INSERT(role=client, client_id)
 -> best-effort audit INSERT -> 201 client + supplied credentials
```

The password is supplied by the form and echoed to the admin once; it is not stored in the application's client/profile tables. Supabase Auth manages its credential storage. This differs from the separate Gmail password feature. Auth failure attempts client deletion; profile failure attempts Auth-user and client deletion. These cleanup errors are not checked, and a process crash can bypass cleanup. “Half-created client never survives” in the comment is stronger than the implementation guarantees. [E15]

### E. Create, update, approve, and publish a report

Report creation inserts `reports`, then `report_versions(version_number=1, status=draft)`; version failure attempts report deletion. Version creation reads all version metadata, checks the latest status, inserts the next version number, and optionally reads/copies old metrics. The unique `(report_id, version_number)` prevents duplicate numbers, but concurrent draft attempts can surface as a generic error. A failed copy leaves a created draft. [E12]

Metric PATCH looks up the metric/version, rejects published/archived versions, validates a whitelist, and updates by metric ID. A changed value sets `source=manual`, clears confidence, and clears review unless explicitly reflagged. Approval loads all metric IDs/review flags, rejects an empty set or any review flag, updates version status, then updates batch badges. It does not lock the version, wait for active jobs, or invalidate an approval when a metric is subsequently edited. [E13–E14]

Publishing first reads version status, writes `published`, writes the report pointer, then archives other published versions. Pointer failure attempts to restore `approved`. Unpublishing reads the expected pointer, clears it, then changes the version to `approved`. Each is a separate HTTP/database transaction. This matters even at one user: network failure between writes can create disagreement. With concurrent users, preflight checks are stale unless the write itself checks/locks state. See sections 8, 18 and 23.

### F. File upload and preview

```text
UploadWorkspace -> multipart POST -> withAdmin -> request.formData()
 -> version/report/client lookup -> optional account ownership/platform check
 -> batch lookup/create -> existing image count
 -> for each file: size/type/magic check -> private Storage upload(UUID path)
 -> bulk insight_images INSERT -> batch status update -> audit -> 201
```

The server accepts at most 12 files/request, normally at most 10 MiB/file. It checks PNG/JPEG/WebP signatures against declared MIME and creates paths from verified database relationships, with random UUID filenames and `upsert:false`. If row insertion fails it attempts object cleanup. Mixed success returns accepted images and rejection reasons. Buffering the multipart body happens **before** per-file enforcement; 12 × 10 MiB is 120 MiB raw content per valid request, plus buffering overhead. There is no batch lifetime size/count cap. [E16]

Admin preview authorizes 1–48 image IDs and returns 300-second signed URLs using the user's storage policies. Portal gallery first resolves up to 100 tenant-owned published periods, then uses service-role queries and signs their screenshots for 900 seconds. Browser image requests go to Storage using that bearer URL. Publication does not produce a redacted screenshot copy. [E10, E16]

### G. Screenshot AI processing

```text
Analyze all -> parallel POSTs /insights/analyze
 -> withAdmin + Zod -> batch/images/prior analysis check
 -> enqueue_ai_job RPC [atomic job INSERT + batch status]
 -> inngest.send(id=job.id) -> 202
 -> Inngest calls /api/inngest
 -> load-job -> mark-processing -> analyze-batch -> mark-completed
 -> browser polls job IDs every 5s -> router.refresh on all-terminal
```

`processAiJob` loads the batch/version/images, rejects published/archived versions, creates an analysis row, sequentially downloads screenshots, sends base64 images to Gemini, validates JSON, normalizes names/confidence, deletes old AI metrics, bulk inserts extracted rows, and records raw/structured output. Inngest subsequently marks the job completed and batch `needs_review`. Extraction has no separate narrative generation stage inside this job. [E17–E19]

IDs for active polling live only in React state. Refreshing the browser loses tracking, not the durable job. A `Promise.all` rejection in “analyze all” can discard successful siblings' IDs from UI tracking. The workspace does not query existing active jobs on mount. A missing job or repeatedly failing status endpoint can keep polling indefinitely.

### H. Narrative and outreach AI

Summary POST is synchronous. It reads a version/report/client, loads settled current metrics, loads the previous nonoverlapping published period's metrics, runs TypeScript comparisons, builds an interpretation prompt, calls Gemini with retry, validates the narrative, and writes `ai_summary` with `needs_review`. Previous-period lookup errors are treated as absence. Summary PATCH saves reviewed prose and demotes an approved version, unlike metric edits. [E14, E19]

Outreach generation POST receives validated contact/sender/context, calls Gemini once, validates the result, and returns an editable draft. On provider failure or invalid schema it returns a deterministic starter with `source=fallback`. Saving is a separate outreach POST. Status “sent” is manually assigned; it is not evidence of email delivery. Copy helpers escape HTML in the active workspace. [E21]

### I. Payments and deletion

Payment POST/PATCH writes manual amount/currency/status records, automatically stamps `paid_at` on paid status, and audits. Duplicate `(client_id,billing_month)` returns 409. No money moves and no payment webhook exists. The schema's uniqueness is per **date**, while the column is named month: neither route nor SQL requires the first day, so two dates within one calendar month can bypass the intended monthly uniqueness. [E21]

Image deletion removes its database row first and logs Storage deletion failure. Report deletion checks unpublished status, removes objects first, then conditionally deletes the report; DB failure can leave rows referencing removed objects. Client deletion deletes one matching Auth user first, then the client graph; it never explicitly removes screenshot objects. It assumes at most one matching profile although SQL does not enforce that cardinality. These are three different cleanup semantics, not one reliable deletion workflow. [E12, E15–E16]

## 6. Authentication & Session Architecture

### Identity is separate from business authorization

Supabase Auth establishes the user identity. SSR cookies carry the Auth session/access and refresh material. `getSessionContext()` calls `auth.getUser()` and queries `profiles` by authenticated user ID; the role and tenant binding are database state. `requireClient()` asserts role `client` and non-null `client_id`. `requireAdminApi()` returns null for both anonymous and wrong-role users, which `withAdmin` turns into 401. [E05–E08]

`getUser()` verifies identity with Auth; it should not be described as immediate revocation of every issued JWT. Access-token expiry, refresh-token reuse/revocation behavior, session limits and Auth provider configuration are not specified here. Application roles are read from `profiles`, so a successful current profile read avoids relying solely on stale role claims in a JWT.

```text
password login -> Auth session -> SSR cookies
                                  |
next protected page -> proxy getUser/refresh -> updated request/response cookies
                                  |
                      server guard -> profile -> role + client_id
                                  |
                      PostgREST JWT -> RLS auth.uid() helpers

logout -> Auth signOut -> SDK cookie removal -> browser navigation/refresh
```

The proxy matches only `/en|ar/admin/**` and `/en|ar/portal/**`, including login pages. It refreshes cookies and redirects anonymous protected-page requests, but does not query roles. API handlers establish their own guards. Server Component cookie writes are swallowed when disallowed; the proxy is intended to handle refresh for page rendering. A redirect returned by the proxy does not explicitly copy any accumulated refresh cookies, an edge case to include in expired-session tests.

### Current mechanisms and guarantees

| Mechanism | Purpose/storage | Lifetime/invalidation | Security, consistency, scaling/failure |
| --- | --- | --- | --- |
| Auth JWT + refresh session | Who is signed in; Supabase Auth and browser cookies | Token lifetimes unknown; SDK refresh and sign-out | Any instance can use the same cookies. Auth unavailability affects guards. No app-local session store. |
| SSR cookie options | Session transport | Inspected SSR 0.7.0 default: path `/`, SameSite=Lax, maxAge 400 days; token expiry is separate | Default `httpOnly:false`; no `secure` option supplied by app/default constant. Verify actual Set-Cookie in deployment. Do not claim HttpOnly protection. |
| `profiles` | Role/client binding | Until admin/database mutation; reread by guard | RLS blocks client self-promotion/rebinding. DB errors can look like absent profile because `getSessionContext` ignores query error. |
| `clients.is_active` | Business/display flag | Admin PATCH | **Not checked by login, guards or RLS.** Inactive does not revoke access. |
| Service-role key | Privileged server operations | Environment/credential rotation | Bypasses RLS. `server-only` protects imports, not authorization logic inside a caller. |
| Signed Storage URL | Temporary bearer access to one object | 300s admin / 900s portal | Not a login session. Can remain usable after logout/unpublish until expiry; fetched bytes cannot be recalled. |

SSR cookie defaults were verified in `node_modules/@supabase/ssr/src/utils/constants.ts` and match the 0.7.0 dependency. Server creation uses persistence with server auto-refresh disabled; explicit auth calls handle refresh. The unused browser factory must not be taken as evidence of active browser token refresh. [E05, E24]

No app MFA flow, invitations/password recovery flow, named agency memberships, per-admin scopes, or enforced tenant deactivation exists. Supabase project settings might enable some provider capabilities, but that is **UNKNOWN — NOT DETERMINABLE FROM REPOSITORY**. The logout handler ignores the returned `signOut` error and the UI navigates away even on failure, so a successful-looking exit is not proof of invalidation. [E06–E07]

## 7. Statelessness Analysis

The web tier has **no discovered process-local durable business state**. Requests use cookies and shared Supabase records/objects. Inngest client configuration is a module singleton, not a local queue. `Map`/`Set` usage in portal hydration, extraction, comparisons and rendering is request/computation-local; static sets of supported values are configuration. The browser Supabase singleton is unused, and even if used would be per browser context. [E04–E06, E10, E18–E22]

| State | Location | Request on A, next on B |
| --- | --- | --- |
| Identity | Cookies + Auth | Works if instances share compatible settings and keys |
| Role/tenant/data | Postgres | Shared; RLS applies |
| Uploaded objects | Supabase Storage | Shared; no required local disk file |
| AI work status | Postgres and Inngest | Shared, but dispatch/race gaps remain |
| File buffers and provider timeout | Executing request memory | Lost on process death; durable retry may replay effects |
| Active job IDs / form drafts | Browser React state | Server changes do not erase them; browser reload does |
| Outreach website/WhatsApp preferences | Browser localStorage | Survive reload; not shared across devices or cleared on logout |
| Framework build/cache artifacts | Next runtime/hosting | Deployment consistency and sharing policy unknown |

**1 → 2 → 10 servers:** no sticky session is required by the application code. Additional instances do not provide atomic publication, work idempotency, or distributed admission control. They increase concurrent Supabase/Auth traffic and the probability of existing check-then-write races. DB uniqueness protects only specific conflicts, such as active job per batch and version number. [E09, E13, E18]

No runtime filesystem write/read is used as a business persistence mechanism. Operational scripts read local files. `request.formData()`, base64 images and React state are temporary state with an explicit loss boundary. Self-hosting still requires the same application build and proper Next routing/cache configuration across nodes; those deployment details are not committed here.

## 8. Database Architecture

### Entities and relationships

```text
auth.users --1:1--> profiles --N:1--> clients
    |                                  |-- accounts
    |                                  |-- client_payment_plans
    |                                  |-- client_gmail_accounts
    |                                  `-- reports
    |                                       |-- report_versions
    |                                       |     |-- metrics
    |                                       |     `-- insight_batches --N:1--> accounts
    |                                       |           |-- insight_images -> Storage path
    |                                       |           |-- ai_analyses
    |                                       |           `-- ai_jobs
    |                                       `-- current_published_version_id -> report_versions
    `-- created_by / requested_by / actor_id references

outreach_contacts --1:N--> outreach_messages <--N:1-- outreach_senders
audit_logs: actor + action + entity UUID + JSON metadata (no entity FK)
```

Outreach records are global internal CRM data: they have **no `client_id` or agency relationship**. This corrects the earlier workflow diagram. `profiles.client_id` is many-to-one; only `profiles.id` is unique. Deleting an Auth user cascades its profile; deleting a client is restricted while profiles reference it. [E09, E21]

| Entity | Constraints and useful indexes | Scale/consistency role |
| --- | --- | --- |
| `clients` | UUID PK; active flag and created-at indexes | Global admin portfolio; client tenant root |
| `profiles` | Auth-user PK/FK; required client binding for client role; client/role indexes | Strongly consistent authorization data |
| `accounts` | Client FK; `(client_id)`; partial unique `(client_id,platform,page_id)` | Social account identity; nullable page IDs can duplicate |
| `reports` | Client FK; period order check; `(client_id,period_end DESC)`; partial published-client index | Publication pointer and report period |
| `report_versions` | Report FK; unique `(report_id,version_number)`; report/version sort and status indexes | Version history and approval state |
| `insight_batches` | Version FK, account FK RESTRICT; partial uniqueness for null/non-null account; version/platform index | Account/platform batch; trigger verifies platform and report tenant |
| `insight_images` | Unique storage path; `(insight_batch_id,sort_order)` | Object metadata; object bytes outside SQL transaction |
| `metrics` | Version/batch FKs; nullable numeric; confidence range; version/platform/date, batch and partial review indexes | Flexible fact store; no natural-key uniqueness |
| `ai_analyses` | Batch FK; batch/created-at and status indexes | Raw/structured attempt evidence; no retention policy |
| `ai_jobs` | Batch FK; active-batch unique partial index; claim scheduling and batch/history indexes | Durable status; unused lease-related fields in active worker |
| `audit_logs` | Actor FK SET NULL; created-at and entity indexes | Best-effort audit; no transactional coupling or retention |
| `client_payment_plans` | Nonnegative numeric amount/price; allowed status; unique client/date; client/month index | Manual financial tracking; calendar-month normalization missing |
| `client_gmail_accounts` | Client FK; client index; unique client/lower(email) | Secret-bearing rows; plaintext password and JSON credentials |
| `outreach_contacts` | Unique email (case-sensitive ordinary text uniqueness) | Global contact list; no search index |
| `outreach_senders` | PK; default flag has no one-default uniqueness | Global sender metadata, not email-service integration |
| `outreach_messages` | Contact cascade/sender SET NULL; status/update and contact/create indexes | Manual message lifecycle, paginated list |

### Transactions and integrity gaps

Each PostgREST statement/RPC executes within its own database transaction. Several awaited calls in JavaScript do **not** become a single transaction. `enqueue_ai_job` is an actual multi-statement SQL transaction, with duplicate-active-job handling; the migration runner wraps each supplied SQL file in BEGIN/COMMIT. No transactional publication/report-copy/metric-replacement RPC is implemented. [E12–E14, E18, E23]

The published pointer FK proves that a version exists, **not that it belongs to the same report**. Likewise `metrics.report_version_id` and `metrics.insight_batch_id` are independent FKs; no constraint proves the batch belongs to that version. Admin route checks establish some of these relationships on ordinary paths, but global-admin direct PostgREST writes and concurrent operations are not constrained by those checks. Use same-report composite references or transactional commands plus constraints. [E09]

RLS version/metric policies require published status and an owning report visible to the tenant. They do **not** require `rv.id = reports.current_published_version_id`. If a new version is marked published before replacing an existing non-null pointer, it can become readable through direct authenticated PostgREST before the UI selects it. If archiving fails, old published versions remain readable. Application hydration checks the pointer, but UI selection and database authorization are different boundaries. [E09–E10, E13]

Recommended publication transaction: authorize admin; lock the report/version; validate all review flags and absence of active jobs; verify expected revision and same-report relationship; archive old version; publish target and move pointer; record required audit/outbox rows; commit. Make metric/summary/upload writers acquire the same version lock or reject immutable states in SQL. Row locking only works when **all conflicting writers follow the protocol**.

## 9. Connection Pooling Analysis

### Current connection path

```text
HTTP request on app instance
  -> createServerClient / createSupabaseClient (HTTP client object)
  -> HTTPS PostgREST request with JWT
  -> managed PostgREST database pool
  -> acquire PostgreSQL connection -> transaction/query + RLS
  -> commit/rollback -> release to managed pool -> HTTP JSON
```

There is no `new PrismaClient()`, `new Pool()`, or SQL `connect()` in runtime request code. Recreating Supabase clients per request does not mean opening one PostgreSQL socket per request. Transport connection reuse is delegated to fetch/runtime; there is no application HTTP-agent tuning. PostgREST's managed connection reuse is the underlying pooling layer. Its actual pool size/acquisition timeout and aggregate connection limits are **UNKNOWN — NOT DETERMINABLE FROM REPOSITORY**. [E05]

`scripts/apply-migration.mjs:66` creates one `pg.Client`, calls `connect()`, applies one file, and calls `end()` on the main success/error paths. It sets `statement_timeout:300000` and `ssl.rejectUnauthorized:false`; it does not create a pool. The initial diagnostic SELECT lies outside the migration try/finally, so not every exceptional path explicitly closes the connection before process termination. [E23]

The example's `DIRECT_URL`/`DATABASE_URL` distinction applies to migrations, not live application queries. A port number or environment-variable name alone cannot establish direct connection versus session-pooler topology. The file's statement that transaction pooling is categorically unsuitable for DDL is overbroad: compatibility depends on statements and session features. Use a verified migration endpoint and role.

### Capacity model, without invented pool values

Let `C` be concurrent HTTP requests, `q` average DB statements/request, `t` average seconds a statement occupies a connection, and `lambda` requests/second. Approximate busy DB connections are `lambda × q × t`, plus Auth, Storage, jobs and maintenance use. This is a workload approximation, not a connection limit. Query concurrency within a request changes bursts; many HTTP requests can wait without owning a database connection.

| Concurrent application requests | What can be concluded |
| --- | --- |
| 100 | They do not imply 100 SQL connections. Repeated dashboard queries/Auth checks create shared-service traffic; observe pool wait and query duration. |
| 1,000 | If the managed pool is full, requests queue or time out; slow exact counts and large metric responses lengthen occupancy. More app servers cannot fix a saturated DB. |
| 10,000 | Without admission limits, queued HTTP work, memory, Auth quotas or provider limits can fail before PostgreSQL's hard connection limit. No measured support for this concurrency exists. |

For any future direct SQL pools, connection budget becomes roughly `instances × maxPoolSize + other consumers <= DB usable connections`, reserving administration/failover headroom. That formula does **not** describe current Supabase factory counts. Adding an external pooler in front of an application that only speaks PostgREST is not an immediate fix. First measure managed pool utilization/waits, tune query work and limits, and review Supabase service configuration. A pooler becomes relevant if introducing direct SQL/serverless connections or reaching verified managed-service connection constraints.

## 10. Query Analysis

All indexes listed here are **available schema indexes**, not confirmed planner choices. There are no live EXPLAIN plans, table cardinalities, query statistics or measured endpoint frequencies. Frequencies below describe source invocation patterns. `SELECT *` means a Supabase `.select("*")` row projection; exact HEAD counts do not transfer all columns but still require database counting work.

| Query family / caller | Frequency and returned volume | Available indexes / concern / next action |
| --- | --- | --- |
| `getSessionContext` profile by ID [E06] | Each explicit guard; one full profile | PK lookup; duplicate calls across layout/page. Request-scoped memoization after auth correctness tests. |
| Admin overview clients [E11] | Each initial overview render; all client IDs/active flags/dates, no app limit | Global scan plus six JS filters. PostgREST configured row cap may silently truncate totals. Aggregate counts/months in SQL. |
| Overview recent reports [E11] | 8 parent reports, all nested version metadata | No reports `updated_at` index; sort may scan global table. Add matching index if plan supports it; bound nested versions. |
| Overview total report count [E11] | Exact global HEAD count per render | No transferred rows, but grows with relation visibility/count cost. Independent of previous queries; can parallelize or cache after defining freshness. |
| Overview awaiting-review value [E11] | Counts only the 8 fetched reports | A sampled count displayed as an overview statistic can undercount independently of load. Use targeted aggregate. |
| Clients page/list [E11,E15] | 10/25 default parents + one lookahead; embedded report counts | Created-at index helps order partly; no `(created_at,id)` composite. Report client-prefix index supports count. Wildcard OR search scans without trigram/full-text indexes. |
| Client-page filtered exact count [E11] | Once per page/search | Repeats matching work beyond the page. Keep only if UX requires a precise total. |
| Client-detail report list [E11] | 20 parents + lookahead; all child versions | `(client_id,period_end)` helps; `id` tie-break absent in index. Nested history grows independently of page size. |
| Client detail accounts/credentials/payments [E11] | Three full lists, sequential after reports | Client-prefix indexes exist; no pagination. Credentials select includes secrets. Independent reads can run bounded parallel; minimize projection. |
| Report workspace graph [E11] | One report with all versions and their AI summaries | Report FK index helps; only newest version is used. Query newest directly to avoid historical JSON transfer. |
| Workspace batches/images [E11] | All batches/images for one version | Version/platform and batch/sort indexes; no nested limit. Add product bounds and image pagination. |
| Workspace accounts and metrics [E11] | All client accounts; all version metrics ordered platform/name | Client/version indexes help. Repeated `.find` joins in JS cost O(metrics × (batches + accounts)); build lookup Maps. Reads can parallelize after report/version lookup. |
| Portal `listPublishedPeriodsPage` [E10] | 20 default; dashboard 24; gallery 100 + lookahead | Client/period and partial published-client indexes; use `(client_id,period_end,id)` and publication predicate if plans justify. `total` is page length, not a global count. |
| Portal `hydrate` [E10] | One bulk version lookup, <=100 IDs | PK/status filter; good batching, no per-report N+1. Returns narratives even for some list/gallery callers that do not need them. |
| Portal `loadPortalMetrics` [E10] | All metrics for up to 24 dashboard periods, two detail periods | Version-prefix index; no explicit total limit/page loop. Parent bounds do not bound metrics sufficiently. Account embed denied by batch RLS. |
| `loadMetrics` [E10] | Helper present; no active application caller found | Same unbounded version IN pattern; distinguish available helper from active traffic. |
| Prior period [E10,E14] | Detail/summary requests: one prior report then metrics | Client/period index. Portal uses previous end-date/id; summary uses `period_end < current.period_start`. These can select different baselines. |
| Gallery month/folder loaders [E10] | Latest <=100 periods, all nested batch image metadata; then sign paths | Version/batch indexes; month filter happens in JS after limit. Older months outside first 100 disappear. Folder view fetches all image metadata just to count/choose covers. |
| Payment and account portal layout [E26] | Accounts unbounded; payments latest12; repeated by full payment page | Client indexes. Duplicate layout/page reads; account and payment reads are independent. |
| Full portal/admin payment lists [E21,E26] | Every page/load, no app limit | Client/month index helps order; paginate years/history; compute currency-specific aggregates. |
| Outreach list [E21] | Per mount, filter/page and 300ms debounced search | Loads all contacts, all senders; paged messages with exact total; six separate status counts. About nine data queries + guard profile lookup/request. |
| Outreach contact search [E21] | JS filter over all fetched contacts, then contact IDs in PostgREST OR | Can miss contacts past managed row cap; large IN URL; no bounded search length and no finite integer check for page/pageSize. Move search server-side and use strict paging. |
| Outreach message search/order [E21] | Offset 25–50 rows, subject/body wildcard search | Status/update index helps filtered path; not an ideal leading index for global updated order. Deep OFFSET discards increasingly many rows; add stable ID and keyset cursor. |
| Outreach six status counts [E21] | Six parallel exact counts every list | Status index may help; still six statements. Group once by status; cache aggregate if eventual consistency acceptable. |
| Account-in-use checks [E15] | Count on account edit/delete | No index with `insight_batches.account_id` as first key. Current `(version,platform,account)` does not efficiently answer account-only count. Consider account_id index and EXISTS. |
| Upload batch/image checks [E16] | Version + optional account + batch + exact image count, then writes | Useful unique batch/batch-image indexes. Count is used as next sort order; deletion/concurrency can produce duplicate orders. |
| Enqueue previous analyses [E17] | Batch/images plus completed-analysis existence | Batch/time index; candidate `(batch_id,status)` if hot. Select all image IDs only to test nonempty. |
| Job status batch [E17] | Every 5s per active tab, <=100 IDs | PK IN bounded; guard Auth/profile cost remains. No batch-to-current-job discovery endpoint used on reload. |
| Job previous attempt [E19] | One query before every pipeline execution | Batch/created-at index, but sorts `attempt`; aggregate/max or indexed counter if material. No uniqueness prevents equal attempt numbers under races. |
| Job metric replacement [E19] | Delete AI rows for batch then insert <=80 extracted metrics | Batch index; separate transactions expose deletion window. Requires atomic replacement and natural-key/manual-override semantics. |
| Approval [E13] | Reads every metric's ID/value/review flag | Partial review index exists but query loads all. Transactional EXISTS/COUNT checks avoid row transfer and race. |
| Version carry-over [E12] | All prior metrics, one bulk insert | Version index, no row limit loop. A managed row cap could silently copy an incomplete report. Transaction and explicit completeness checks needed. |
| Publish/archive/unpublish [E13] | PK/FK/status filtered writes | Indexed access likely; correctness is the issue, not demonstrated query latency. Lock/CAS transaction needed. |
| Report cleanup [E12] | Nested image→batch→version joins; all paths | FK-prefix indexes mostly help; unbounded path list and cross-service deletion. Use durable paged cleanup. |
| Audit insert [E08] | Awaited after many admin mutations | Adds one statement/round trip. Best-effort, can be lost. Store critical audit atomically; async secondary export later. |

### N+1, joins and parallelism

No dominant application `for each report -> await metrics query` pattern was found: portal hydration and metric reads use bulk `IN`, and Supabase embeds relationships in one HTTP query. That does not mean those joins/counts are free in SQL. Inspect their actual plans under the real user's RLS, not only service-role plans.

The real sequential loop is screenshot download/upload, which does network I/O per file. Bounded concurrency (for example a small configurable number) can reduce latency, but unbounded `Promise.all` amplifies buffer memory and provider/storage pressure. Enforce aggregate bytes first. Client detail and report workspace independent reads can be parallelized after tenant/version resolution. Approval → publication checks, provision → bind profile, and delete → insert replacement are dependent work; parallelizing those destroys ordering and does not create a transaction.

For browser multi-enqueue, use bounded `Promise.allSettled` and retain each successful job ID. `Promise.all` fails as a group even though sibling requests continue and may commit. The current polling interval can overlap slow status calls because its `refreshing` flag is set only at terminal completion, not while a request is in flight. [E17]

### Concrete metric correctness examples

1. An AI `views=100` row is edited to `90`, becoming `source=manual`. Forced reanalysis deletes only `source=ai`, then inserts a new `views=100`. `headlineKpis` sums both to **190**. There is no unique fact key or override precedence. This follows directly from `updateMetric`, `processAiJob`, and `sumAcrossPlatforms`. [E14,E19,E22]
2. For a client, the account embed is null under the supplied RLS. `comparePeriods` initially groups by batch ID when account ID is unavailable, then clears `insight_batch_id` in aggregate rows. `previousIndex` can therefore collapse multiple account groups onto the same platform/name/unscoped key. A current account can compare with another account's previous value. Supply a safe stable account projection and use a complete comparison key including unit/date semantics. [E09,E10,E22]
3. Carry-over sets `insight_batch_id=null` and has no independent account column, losing attribution. Weighted averages group by platform and batch-or-`manual`, so unrelated unscoped values can overwrite each other in the in-memory index. Define canonical metric identity and aggregation rules before performance optimization. [E12,E22]
4. Querying one million metrics would not be made safe by TypeScript types. A managed API cap may truncate first; if it permits the response, JSON/RSC serialization, Node memory, browser hydration and JS reductions all grow. Bound, page or aggregate the data and expose an explicit completeness contract. The actual PostgREST row cap is unknown.

TypeScript numeric types are not runtime database-output validation. Supabase JSON numbers become JavaScript numbers, so arbitrary PostgreSQL `numeric` precision cannot be assumed preserved. Metric counts beyond safe integer range and money calculations require explicit numeric representation/rounding rules. AI input validation uses finite numbers but does not universally impose a safe-integer range. [E09,E19,E22]
