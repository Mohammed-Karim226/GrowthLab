# Production hardening implementation

Baseline: 2026-09-13, `224f4510cce11e87d498528b320a315e4bc41ac0`.
Initial working tree: untracked `.claude/`, `docs/PRODUCTION_ARCHITECTURE_REVIEW.md`,
and `docs/PRODUCT_ROADMAP.md`; preserve these files.

Scope: controlled **single-agency** deployment. Global staff administrators remain
trusted across clients; customer roles must never receive staff/CRM permissions.
No live migrations, destructive isolation tests, or remote configuration changes.

Baseline checks: typecheck and production build passed with installed Next 16.2.6.
Lockfile resolves 16.3.3. Offline clean install in a new temporary directory and lint
were blocked by Windows EPERM. Elevated lint was rejected by automatic review
(review service HTTP 403). No existing automated test script was found.

## Implementation sequence

1. Remove secret projections; encrypted server-only writes; controlled legacy repair.
2. Transactional report transitions, immutable approved facts, revision checks and RLS.
3. Transactional AI outbox, leased dispatch, reconciliation and manual recovery.
4. Persistent provider attempts, explicit ambiguous outcomes, atomic fact replacement.
5. Safe attribution, tenant checks, inactive-client denial and comparison semantics.
6. Durable storage cleanup, bounded uploads, session and input hardening.
7. Structured safe telemetry, operational endpoints, tests, CI and deployment runbook.
8. Measure performance only in an authorized representative disposable deployment.

## Migration and rollback considerations

New numbered migrations follow the existing 0006 migration; old duplicate prefixes
must retain their full lexicographic filenames. Apply in maintenance mode after a
verified backup. Never roll back to application code that returns secrets or performs
nontransactional publication. Prefer forward repairs. Existing duplicate facts,
inconsistent publication pointers and duplicate billing months require an operator
decision; constraints must fail rather than silently discard business data.

Credential repair requires an independently provisioned 32-byte key and a controlled
server-side procedure, followed by upstream password rotation and backup retention
review. A migration alone cannot encrypt plaintext without the external key.

## Verification strategy

Use Node's test runner with the existing TypeScript tooling for encryption, safe
projections, comparisons, validation and retry rules. Database/integration tests must
require an explicitly disposable local database and fail closed without it. Test real
transaction races and RLS, not SQL string matching as a substitute. CI performs clean
install, typecheck, lint, build, unit/security checks and disposable database checks.
Record unavailable service verification as outstanding, never as a pass.

Gemini has no demonstrated idempotency contract. An attempt committed before a call
can have an unknown outcome after a crash. Do not automatically call again in that
state; expose manual recovery and its possible additional charge. Persisted results
can be finalized repeatedly without another provider call.
