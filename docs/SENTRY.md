# Sentry operations

The browser, Node.js server and Edge runtime share the app's privacy policy and
runtime settings. Monitoring defaults to production only. Errors handled by API
helpers, failed background jobs and dashboard error boundaries are reported as
well as unhandled errors. Expected validation and authentication responses should
not create Sentry issues.

## Environment configuration

Copy the placeholders in `.env.example` into the deployment's environment
configuration. Never commit real secrets.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Public project DSN. When omitted, the app retains its existing project DSN. Set explicitly for each deployment environment. |
| `NEXT_PUBLIC_SENTRY_ENABLED` | `false` disables monitoring; `true` enables it even locally. Otherwise monitoring is enabled only in production. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Environment label, such as `production`, `staging` or `preview`. Set explicitly for preview deployments, which also use a production Next.js build. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | A number from `0` to `1`; default `0.1`. Controls performance traces, independently of error reporting. |
| `SENTRY_ORG` | Build-only Sentry organization slug. |
| `SENTRY_PROJECT` | Build-only Sentry project slug, matching the DSN's project. |
| `SENTRY_AUTH_TOKEN` | Build-only source-map/release upload credential. Store as a masked CI secret with the minimum Sentry upload permissions. Never prefix with `NEXT_PUBLIC_`, commit it, log it, or put it in application code. |
| `SENTRY_RELEASE` | Optional immutable identifier shared by the browser/server build and uploaded artifacts; use a commit SHA or a unique release version. Otherwise Sentry detects the commit in configured release builds. |
| `SENTRY_UPLOAD_SOURCE_MAPS` | Set `false` to disable source-map uploads and release creation during local/verification builds, even if upload credentials exist. |

Public runtime settings are embedded in browser bundles during `next build`.
Changing them requires rebuilding and redeploying. Use one environment label for
both the build and deployed server. Browser code never needs the upload token;
provide that credential only to the build step.

`withSentryConfig` wraps the existing Next Intl configuration. A build uploads
source maps and creates/finalizes its Sentry release only when `SENTRY_ORG`,
`SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` are all present and uploads have not been
explicitly disabled. Source maps are deleted after upload. Local builds work
without these credentials; those builds cannot provide uploaded source maps for
production debugging. The plugin's own telemetry is disabled. Upload errors fail
a configured release build instead of silently deploying unreadable stack traces.

## Privacy and signal quality

Keep request-body, cookie, authorization-header and personal-data collection
disabled. The app also scrubs events before transmission. Do not add raw request
bodies, credentials, access tokens, emails or provider responses to Sentry tags,
contexts, exception messages or logs. Use stable operation names and opaque
request/job identifiers for diagnosis. Sentry server-side data scrubbing provides
an additional layer; it does not replace scrubbing before transmission.

Performance sampling defaults to 10%. Adjust it after observing traffic, quota
and useful diagnostic coverage. Error sampling remains independent. Scope alerts
by deployment environment so preview activity does not page the production team.

## Local verification without telemetry

Run the automated tests, TypeScript and lint checks before making a release.
For a verification build, set `NEXT_PUBLIC_SENTRY_ENABLED=false`,
`SENTRY_UPLOAD_SOURCE_MAPS=false` and `NEXT_TELEMETRY_DISABLED=1` in that command's
environment before running `npm run build`. Use a fresh build with the intended
production settings when deploying; a verification build has monitoring disabled.
No source-map upload or live Sentry smoke test is needed for local regression
tests, which must use synthetic data and an in-memory transport.

## Release and alert verification

1. Configure the deployment variables and build-only credentials, then run the
   normal release build. Check the build's source-map upload result and confirm
   the release/artifact bundle appears in the matching Sentry project. Ensure
   generated browser `.map` files are absent from the published static assets.
2. In a controlled staging environment, temporarily instrument one authenticated
   test-only flow to emit a synthetic error with a unique, non-sensitive marker.
   Exercise browser, server and background-job reporting separately. Remove the
   temporary trigger after testing. The previous public sample crash page and API
   route have been removed and must not be restored for production testing.
3. Inspect the resulting issues: original source file/line, expected environment
   and release, useful operation/request/job identifiers, and no password,
   authorization header, cookie, request body or personal data in event JSON.
   Check that a handled failure produces one useful issue instead of duplicates.
4. Configure an issue alert for new/regressed production errors and an alert for
   sustained API/job failures. Choose owners, volume thresholds and notification
   destinations appropriate to the team's on-call policy. Verify delivery with
   a coordinated synthetic smoke test; confirm the intended recipient receives
   it and can open the correctly grouped issue.
5. Recheck trace volume and alert noise after release. Tune sampling and alert
   thresholds based on observed traffic. Keep a small, documented error budget
   for controlled monitoring checks.

Live uploads, deployment, issue ingestion and alert delivery require the
configured Sentry/deployment environment and cannot be proven by local tests.
