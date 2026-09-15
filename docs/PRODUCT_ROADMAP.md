# GrowthLab commercial product roadmap

Prepared September 12, 2026, from a source-code review. This is a proposal, not an implementation or production security assessment. Deployment settings and live behavior were not verified.

## Product direction

Working assumption: the first buyers are marketing agencies managing several clients. Validate this with buyer interviews before committing to the full roadmap.

Suggested promise: **Turn social analytics into reviewed, branded client reports and accountable next steps, with less monthly reporting work.**

Arabic/English support, screenshot-based ingestion, human review, and client-facing reports are useful differentiators to validate. Avoid promising that reporting software itself guarantees marketing growth.

If the buyer is a company's internal marketing team, emphasize departments, campaigns, goals, and executive summaries. If clients are buying GrowthLab's marketing services, prioritize service delivery and client collaboration; a shared platform for independent agencies can wait.

## Existing foundation

- Admin client/account management and payment-plan tracking.
- Screenshot uploads, AI metric extraction, confidence flags, manual metric review, and AI summaries.
- Report approval, publishing, and version history.
- Client analytics, filters, comparisons, monthly image folders, and an intelligence view.
- Arabic/English interfaces and RTL support.
- Database access policies, administrative audit events, background AI processing with retries, and an isolation-verification script.

Extend these capabilities instead of rebuilding them. The existing payment records are distinct from a SaaS subscription and payment-collection system.

## Phase 0: requirements before real customer data

| Work | Why it matters | Acceptance criteria |
| --- | --- | --- |
| Replace direct third-party password storage | The Gmail feature inserts supplied passwords directly into text/JSON fields and returns account records through the admin API. | Prefer OAuth or references to an external secrets vault; routine account responses contain no passwords. If retrievable secrets remain necessary, use a managed vault with restricted, audited retrieval. Review existing stored credentials and rotation needs. |
| Company workspaces and scoped roles | Current admin policies grant global administrative access; separate client logins do not isolate administrators of different agencies. | Agency A's owner, staff, jobs, files, exports, and searches cannot access Agency B. Separate platform operations from customer administration. |
| Invitations and account recovery | Buyers need individual accounts and control when staff leave. | Expiring invitations, password recovery, admin MFA, revocation, and permissions enforced by both API and database. Verify abuse protection for login, uploads, and costly AI requests. |
| Reliable publishing and edits | Approval/publishing currently spans several database writes, with manual rollback paths. | A transaction and concurrency checks keep approval, publication pointer, archive state, and required audit events consistent. Concurrent edits cannot silently overwrite newer work. |
| Monitoring and recovery | Existing background retries need operational visibility and recovery evidence. | Alerts for failed/stuck jobs and publication errors; backup coverage includes database and uploaded files; a restore drill succeeds. Set explicit recovery objectives. |
| Verify isolation and core workflows | The repository includes a verification script, but this review did not run it. | A staging run covers two agencies and multiple clients, including jobs, storage, payments, new roles, and exports. Upload → review → publish → client access passes, including failure cases. |
| Clear data quality | Users must understand where numbers and intelligence scores come from. | Show source, period, review status, and freshness. Treat missing values separately from zero. Label heuristic confidence/risk scores and scenario assumptions clearly; do not present them as validated accuracy probabilities. |

For workspaces, a starting model is `organizations`, `organization_members`, and client access assignments. Scope related tables directly or through enforced ownership relationships. Update storage policies, service-role jobs, and audit records as well as page queries. Backfill the current data into GrowthLab's organization before adding other agencies.

Start with owner, manager, analyst, and client viewer permissions. Add finance access only when needed. Optional client approvers should have an explicit permission; viewing a report should not imply permission to approve it.

## Phase 1: a focused paid pilot

These are the highest-value additions after the launch requirements above.

| Feature | Admin experience | Client experience | Measure of success |
| --- | --- | --- | --- |
| Branded report templates and PDF export | Save a logo, colors, sections, KPIs, and language preference; reuse next month. | Download a clear management-ready report with sources and next steps. | Less report preparation time and fewer manual presentation edits. |
| Reporting calendar and work queue | See reports due, missing inputs, review owners, and overdue work across clients. Generate recurring drafts without copying old results. | See the next report date and requests that need their input. | More reports delivered on time. |
| Report comments and approval requests | Request feedback on a specific version, assign follow-ups, and resolve threads. Keep internal notes explicitly separate. | Comment on a chart or report and accept it or request changes. | Shorter review cycles and fewer follow-up messages. |
| Notifications and delivery history | Send a report-ready notification after successful publication, track delivery failures, and retry safely. | Receive useful email/in-app updates with preferences and digest options. | Fewer missed reports, without duplicate messages. |
| Guided onboarding | Invite a client, add accounts, set reporting cadence and KPIs, and preview their portal. | Accept an invitation, understand the next step, and access their first report. | More invited users reach their first report. |

Keep the pilot small: one organization workspace per buyer, a few report templates, one notification channel, PDF export, and simple version-linked feedback. Track actual client report opens separately from email delivery.

PDFs must render Arabic/RTL, fonts, charts, dates, and page breaks correctly. Export only authorized published content for clients. Downloads and future share links must preserve access restrictions; an unguessable URL alone is insufficient.

## Phase 2: daily productivity and retention

| Feature | Minimum useful scope | Dependency |
| --- | --- | --- |
| Recommendations become tasks | Turn a recommendation into an action with owner, due date, status, and report link; client visibility is explicit. | Membership and collaboration permissions. |
| KPI goals | Target, baseline, period, owner, and actual progress by account/campaign. Begin with available metrics; revenue/ROI requires reliable revenue and spend inputs. | Consistent metric definitions and comparable periods. |
| Operations dashboard | Reports due, blocked reviews, failed jobs, outstanding client feedback, and overdue payments with direct actions. | Reporting schedules and task state. |
| CSV import and bulk workflows | Validated import preview, duplicate detection, batch assignment, saved filters, and bounded bulk actions. | Stable metric schema and access enforcement. |
| Invoices and payment follow-up | Invoice references, receipts, due reminders, and a payment link where supported. Preserve manual reconciliation. | Chosen payment provider, customer market, currency, and accounting requirements. |
| Client team access | Multiple named client users, viewer/approver permissions, and controlled access to brands. | Membership model. |
| Evidence and report discovery | Search months/reports; filter accounts/platforms; show unread reports, last update, and approved evidence. | Client-safe image/export projection and publication rules. |

For `AnalysisMonthFolders.tsx`, useful additions are search/year filters, an unread-report badge, latest publication date, and a month-level download action. Completion or overdue badges require an expected reporting schedule; image count alone cannot establish completeness.

## Phase 3: expand when customers justify it

- Start with one official analytics integration selected by pilot demand. Add connection status, token refresh, sync history, last successful sync, retry handling, and CSV/screenshot fallback. Platform permissions, approval requirements, and API quotas must be checked before promising delivery dates.
- Add agency branding throughout the portal; consider custom domains after tenant resolution and domain ownership verification are designed.
- Introduce SaaS subscriptions, plan entitlements, usage metering, and quotas. Agency subscription billing is separate from invoices agencies issue to their clients. Use verified, idempotent payment webhooks and explicit cancellation/grace-period behavior.
- Add campaign comparisons, scheduled executive digests, and configurable alerts after metric quality is proven. Suppress alerts when data is missing or periods are not comparable.
- Add SSO, advanced retention controls, audit exports, and a public API when a qualified buyer needs them.

Defer a full CRM, native mobile app, general-purpose AI chatbot, and every social integration at once. Keep outreach tooling secondary until buyer evidence makes it part of the core reporting workflow.

## Commercial launch plan

1. Interview about five agencies. Ask them to show their last report, how long it took, how revisions were handled, and what software they already pay for.
2. Recruit two or three design partners with a written pilot scope. Record baseline reporting effort before onboarding.
3. Build a demo using synthetic or authorized data. Demonstrate upload → review → branded report → client feedback in one short flow.
4. Offer a paid pilot covering a complete reporting cycle. Quote a clear setup/support scope and limits on clients, seats, storage, and AI processing.
5. Measure results and secure permission for a case study. Publish only supportable customer claims and approved testimonials.
6. Prepare product-focused landing copy, a sample report, transparent plan limits, support contact, privacy/terms, data export/deletion procedures, and relevant information about hosting and AI data processing.

Suggested packaging to validate: Starter for basic reporting and a small client portfolio; Agency for collaboration, recurring workflows, branding, and more usage; Enterprise for requirements such as SSO and contracted support. Core access security and data isolation belong in every plan. Determine prices from buyer interviews and actual hosting, AI, storage, and support costs.

## Delivery sequence and release gates

This is an order of work, not a fixed calendar estimate. A workspace migration or external integration can be a substantial project; estimate after designing it.

1. **Foundation gate:** credential handling, workspace isolation if selling shared SaaS, account lifecycle, publishing consistency, monitoring, and restore/isolation evidence.
2. **Pilot gate:** a buyer can onboard, prepare a branded report, publish it, notify a client, and receive version-specific feedback.
3. **Retention gate:** recurring drafts, accountable tasks, goals, and operational visibility address problems observed during a full reporting cycle.
4. **Expansion gate:** add the single most requested integration and scalable subscription controls after pilots show willingness to pay.

Suggested pilot targets, to calibrate against the starting baseline:

- At least 30% less active preparation time per comparable report, including AI corrections.
- At least 95% of scheduled reports published by their agreed deadline.
- At least 80% of invited pilot clients open their first report within seven days.
- No unauthorized cross-client or cross-agency access in the required verification suite.
- Track job failure/recovery rate, material report corrections, support time, and infrastructure/AI cost per active customer.
- Secure paid renewals after a complete reporting cycle; feature usage alone does not prove willingness to buy.

## Source references

- `src/types/database.ts`: current roles, client/report models, payment records, job state, and audit records.
- `supabase/migrations/0001_init.sql`: global admin and client access policies.
- `supabase/migrations/0004_client_gmail_accounts.sql` and `src/app/api/admin/clients/[clientId]/gmail-accounts/route.ts`: credential storage and account API.
- `src/app/api/admin/reports/[reportId]/publish/route.ts`: publication writes and rollback logic.
- `src/lib/api.ts`: best-effort audit writes.
- `src/lib/inngest/functions.ts`: background processing and retries.
- `src/components/portal/IntelligenceCenter.tsx`: heuristic scores and scenario calculations.
- `src/components/portal/AnalysisMonthFolders.tsx`: existing monthly report discovery.
- `docs/PORTAL.md` and `docs/WORKFLOW_ARCHITECTURE.md`: architecture and verification guidance; some scope descriptions may lag current code.
