# Admin system health

Open **System health** in the admin navigation, or visit `/en/admin/system`
(English) or `/ar/admin/system` (Arabic). The page brings integration checks, AI
usage and configured monitoring thresholds into the existing admin console.

## Access and data collection

The page calls `requireAdmin(locale)` and its snapshot endpoint,
`GET /api/admin/system`, uses `withAdmin`. Both require a signed-in administrator.
The browser receives a sanitized snapshot, never service keys, credentials,
connection strings or raw provider errors. Health checks are read-only: refreshing
the dashboard does not generate AI content, submit background jobs, write to
storage or send a Sentry test event.

Automatic refresh runs every 60 seconds while the page is active and can be
paused. Concurrent checks share a snapshot, cached on the server for up to 30
seconds. Manual refresh can therefore return the same recent check time. Each
external check has a four-second deadline; a slow dependency cannot hold the
whole dashboard open indefinitely.

Each check describes what it can verify. A successful connectivity check reflects
that request only; it is not an uptime history. Inngest and Sentry are explicitly
configuration-only checks. Their status does not prove event delivery, worker
execution, error ingestion or alert delivery. Investigate delivery and
provider-wide incidents in the corresponding service console.

## AI usage ledger

The AI provider records request outcomes and token metadata in the durable
`ai_usage_events` ledger. Apply the new migration to the intended database before
expecting usage totals:

```sh
npm run db:apply -- supabase/migrations/0012_ai_usage.sql
```

The implementation does not automatically run this migration. Until it is
applied, the dashboard reports unavailable usage data and AI features continue to
work. Writes are best effort and have a short timeout, so a telemetry failure
cannot replace an AI result or provider error. No historical requests are
backfilled. Only calls made through the instrumented app provider are tracked;
other applications, direct API calls and failed ledger writes are absent.

Each completed provider attempt counts separately, including retries and errors.
In-flight requests do not appear until their attempt finishes and is recorded.
Windows use the recorded attempt's start time. The main request/token metrics
cover the rolling last 24 hours; queue counts are current and the failed-job
count covers failures completed in the last 24 hours.

The ledger stores operational metadata, not prompts, generated content or API
keys. Counts and token totals are observations from this app, not billing records
or authoritative provider quota consumption. A token value can be unavailable
when the provider does not supply usage metadata.

## Optional Gemini monitoring thresholds

Set these server-side environment variables only when you want an app usage
comparison. Each accepts a positive integer; leave it empty when unknown.

| Variable | Window and meaning |
| --- | --- |
| `GEMINI_QUOTA_RPM` | Recorded requests in the rolling last minute. |
| `GEMINI_QUOTA_TPM` | Recorded input tokens in the rolling last minute. |
| `GEMINI_QUOTA_RPD` | Recorded requests since 00:00 UTC. |

Thresholds apply to the configured `GEMINI_MODEL` (default
`gemini-2.5-flash`). They are monitoring settings only: they do not change Google
limits, enforce throttling or represent verified project quotas. UTC day totals
are intentionally independent of the viewer's local date and Google's quota
reset rules. Output tokens are not included in the TPM comparison.

Use [Google AI Studio](https://aistudio.google.com/usage?tab=rate-limit) to confirm
your actual project/model limits and usage. Provider quotas may be shared with
other applications, vary by model and tier, and use different reset boundaries.
The dashboard cannot infer remaining Google quota from its partial app ledger.

## Verification

Run `npm run test:system`, `npm run typecheck` and `npm run lint`. Check the page
in both locales at desktop and mobile widths. Verify that signing out prevents
page/API access and a client account cannot read the snapshot. Review loading,
refresh and unavailable-service states without exposing secrets or triggering
AI generation.
