# Sentry operations

Open **System health > Sentry** at `/en/admin/system?tab=sentry` or
`/ar/admin/system?tab=sentry`.
Administrators can inspect live issue summaries, filter by status, period and
environment, search the current page, and copy an investigation brief. Open an
issue in Sentry for its full stack trace, related events, ownership and status
actions. Shortcuts also open traces, replays, releases, alerts and project settings.

The workspace reads Sentry through an authenticated server endpoint. It does not
create test events, resolve issues, change Sentry settings or fix source code.
Signing in to this app does not sign you in to Sentry: your Sentry account also
needs access to the configured organization and project.

## Connect the project

1. In Sentry, select the Next.js project that receives this app's events. Copy its
   public DSN from **Settings > Projects > Client Keys (DSN)**. Note the organization
   and project **slugs** from the URL, and the organization's data region.
2. Configure `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` using the
   placeholders in `.env.example`. Set the two slugs in both the build and deployed
   server. There is no built-in DSN or fallback project.
3. Create a dedicated runtime read credential with `event:read` and `project:read`
   access to that project. Store it as `SENTRY_READ_AUTH_TOKEN` in the server's
   secret environment. Use `SENTRY_REGION=eu` for an EU organization or `us` for US.
   Keep the read token separate from the source-map upload token.
4. Set an explicit environment, such as `production`, `staging` or `preview`, with
   `NEXT_PUBLIC_SENTRY_ENVIRONMENT`. Configure build credentials separately if you
   need source maps, then rebuild and deploy.
5. Open the Sentry workspace as an app administrator. A connected inbox confirms
   that its current read request succeeded. It does not confirm error ingestion,
   replay recording, source-map uploads or alert delivery.

Never commit tokens, prefix them with `NEXT_PUBLIC_`, or paste them into the
workspace. Public `NEXT_PUBLIC_*` settings are embedded during `next build`;
changing them requires a new build and deployment.

## Configuration reference

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Public DSN for browser, server and Edge monitoring. A missing DSN disables capture for that runtime. |
| `NEXT_PUBLIC_SENTRY_ENABLED` | `false` disables capture; `true` allows local capture. Otherwise monitoring requires production mode and a DSN. Preview Next.js production builds also count as production mode. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Environment label shared across runtimes. Defaults to `NODE_ENV`. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Performance sampling from `0` to `1`: defaults to `0.1` in production and `1` in development. Independent of error reporting. |
| `NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE` | Normal-session replay sampling from `0` to `1`; default `0.05`. |
| `NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE` | Error-session replay sampling from `0` to `1`; default `1`. Set both replay rates to `0` to disable recording. |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Preferred immutable release ID for SDK events and build uploads. Use a commit SHA or unique version; this takes precedence over `SENTRY_RELEASE`. |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Organization and project slugs, available to both the build and runtime. Use the project matching the DSN. |
| `SENTRY_READ_AUTH_TOKEN` | Server-only runtime token with `event:read` and `project:read`. Used only to read the admin inbox. |
| `SENTRY_REGION` | Sentry cloud data region, `us` (default) or `eu`. Self-hosted Sentry endpoints are not supported by this inbox. |
| `SENTRY_AUTH_TOKEN` | Build-only source-map/release upload credential with the required upload permissions. Never reused for runtime reads. |
| `SENTRY_RELEASE` | Fallback release ID when `NEXT_PUBLIC_SENTRY_RELEASE` is absent. Build configuration and SDK settings also support Vercel commit detection. Keep both release variables consistent if both are set. |
| `SENTRY_UPLOAD_SOURCE_MAPS` | `false` disables source-map uploads and release creation for verification builds. Leave empty for configured release builds. |

Legacy unprefixed `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`,
`SENTRY_REPLAY_SESSION_SAMPLE_RATE` and `SENTRY_REPLAY_ERROR_SAMPLE_RATE` remain
server-side fallbacks. Prefer the public settings above so browser and server
behavior agree. A server-only DSN cannot enable the browser SDK.

## Access and connection troubleshooting

| Workspace result | What to check |
| --- | --- |
| Setup required | Add the runtime read token and organization/project slugs to the deployed server, then restart or redeploy. |
| Invalid configuration | Use URL slugs without slashes, valid DSNs and a supported `us` or `eu` region. |
| Unauthorized | The read token may be invalid, expired or revoked. Replace the runtime read token and redeploy. |
| Access denied | Grant the credential `event:read` and `project:read` and access to the configured project. Check organization restrictions. |
| Project mismatch | Compare the configured project and the DSN's project. Both must point to this app's Sentry project. |
| Rate limited | Wait before refreshing and review Sentry API limits. Repeated refreshes do not bypass the limit. |
| Unavailable | Check the Sentry service status, selected region, project slug and server network access, then retry. |
| No issues | Widen the period, choose all environments, clear local search and check issue status. An empty inbox does not prove capture is working. |

If the app requests admin sign-in, restore your administrator session first. If a
Sentry link denies access, sign in to the correct Sentry organization and ask its
owner for project access. Runtime API access and human Sentry membership are
separate permissions.

## Investigate and fix an issue

1. **Triage:** choose the affected environment and period. Review severity, event
   and affected-user counts, last seen time and the issue's location. Counts shown
   for an issue are provider-reported; they are not app billing or Sentry quota
   consumption. Copy the investigation brief for a ticket without adding customer
   data or credentials.
2. **Inspect:** open the issue in Sentry, select a relevant event and confirm its
   environment and release. Start with the first application stack frame. Use
   breadcrumbs, traces and masked replay where available to understand the steps
   that led to the failure. Sampling means traces and replays may be absent.
3. **Reproduce:** check out the event's release and recreate the failing flow with
   test data. Use the operation name and opaque request/job ID to correlate logs.
   If stack frames are minified, verify the matching release and source-map
   artifact upload before guessing at the source location.
4. **Repair:** fix the underlying code or configuration. Add a regression test
   that reproduces the failure and verify the affected browser, API or job flow.
   Run the relevant tests, TypeScript and lint before deploying.
5. **Release:** deploy an identifiable release with matching source maps. Confirm
   the original flow works and inspect subsequent events in that environment.
   Resolve the issue in Sentry, or use **resolved in a release** where available,
   after verifying the fix. Marking an issue resolved does not fix the source code.
6. **Watch:** monitor new/regressed issues and production alert delivery after the
   release. Reopen and investigate if the failure recurs; avoid muting a recurring
   production failure merely to clear the inbox.

## Capture, privacy and sampling

Browser, Node.js server and Edge runtime use shared SDK settings. Unhandled
errors, unexpected failures in the instrumented admin API helpers, active failed
background jobs and application error boundaries are captured. Expected
validation/authentication responses are not deliberately reported as failures.
Handled errors use stable operation labels and allowlisted categories instead of
raw provider text. Reporting is best effort and must not replace the app result.

The shared scrubber removes user details, extra data, request bodies, headers,
raw request URLs and unapproved contexts. It retains source locations, approved
operation/category tags, opaque application IDs and trace context. Exception
messages are generalized. Performance descriptions and query details are removed;
route templates may remain. Replay masks text and inputs, blocks media and
excludes raw custom breadcrumbs and network details. Review privacy behavior when
adding integrations; do not assume scrubbing makes arbitrary data safe to capture.
Review replay page metadata and masked DOM recordings in staging as well. SDK
masking does not guarantee complete anonymity; URLs must never contain credentials.

Configure Sentry server-side data scrubbing as an additional layer. Keep raw
request bodies, passwords, access tokens, customer emails and provider responses
out of telemetry. Replays can consume Sentry quota; tune both replay rates and
trace sampling for your traffic. The workspace reports configuration and selected
issues, not authoritative Sentry plan usage or remaining quota.

## Source maps, releases and alerts

`withSentryConfig` wraps the existing Next Intl configuration. Uploads and Sentry
release creation/finalization are enabled only when `SENTRY_ORG`, `SENTRY_PROJECT`
and build-only `SENTRY_AUTH_TOKEN` are present and uploads are not explicitly
disabled. Uploaded source maps are configured for deletion from build output.
The plugin's telemetry is disabled. Local builds can run without upload credentials.

The workspace can identify configured or disabled upload settings; a runtime
without the build token correctly reports uploads as **unverified**. Configuration
does not prove an upload succeeded. Check CI output and the matching artifact
bundle/release in Sentry, inspect an event's original source file and line, and
confirm published browser assets do not expose `.map` files. Do not add the build
token to runtime merely to change this readiness indicator.

In Sentry, configure ownership and production alerts for new/regressed issues and
sustained failures. Scope alerts to the intended environment and choose recipients
and thresholds appropriate to the team. Sentry controls assignment, resolution,
alert rules and notification delivery; the admin workspace provides direct links.
No alerts are created automatically by opening this page.

## Verification

Run `npm run test:sentry`, `npm run test:system`, `npm run typecheck` and lint for
changed files. Local regression tests use synthetic fixtures, mocked SDKs and
provider transports; they must not send telemetry to a real Sentry project. Check both
locales at desktop/mobile widths, setup and unavailable states, filters and
pagination, issue links, and administrator-only access.

For an offline verification build, set `NEXT_PUBLIC_SENTRY_ENABLED=false`,
`SENTRY_UPLOAD_SOURCE_MAPS=false` and `NEXT_TELEMETRY_DISABLED=1` in that command's
environment before `npm run build`. Deploy a fresh build with the intended
production settings afterward.

Live event ingestion, source-map uploads, replay behavior and alert delivery need
verification in the configured deployment. Coordinate a controlled staging check
before sending a synthetic event, use a non-sensitive marker and remove any
temporary trigger afterward. There is no public crash route or workspace test
event action. Confirm the event's environment/release, source frame and scrubbed
payload, then separately confirm the intended alert recipient receives it.
