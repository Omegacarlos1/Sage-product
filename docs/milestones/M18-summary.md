# M18 — Production deployment and handover

**Status:** Prepared on `feature/M18-deployment-handover` on 2026-11-27; [draft PR #26](https://github.com/Omegacarlos1/Sage-product/pull/26) awaits review. No production deployment, monitoring integration or restore drill has been performed. Human review and live deployment approval are pending.

## Objectives and implemented

Prepared a non-root Node 22 container, dependency-aware `GET /api/v1/ready`, a read-only production smoke script and Postman collection, and a [release and operations runbook](../operations/M18-runbook.md) covering PostgreSQL TLS and role separation, migration sequence, immutable image rollout, monitoring thresholds, backups, isolated restore, rollback and frontend handoff. The existing database-health route remains supported. Readiness errors do not expose connection details.

## Not implemented and blockers

No host, production PostgreSQL, TLS domain, alert destination, backup store, durable media volume or frontend origin has been chosen or provisioned. There is no live deployment, deployed health result, configured alert or evidenced restore. The backup procedure is written but **has not been executed** in an isolated database. Local PostgreSQL binaries exist under `C:\Program Files\PostgreSQL\18\bin`, but were not on PATH; a separate empty restore database and approved storage are needed for a valid drill. Multi-replica deployment is blocked by process-local rate limiting, Socket.IO rooms and local media storage. Finance policy and live Paystack activation remain separate open decisions. The M18 acceptance criteria for deployed health, monitoring and tested restore remain unmet.

## Files, endpoints and database

Changed `src/app.ts`, `tests/integration/health.test.js`, `package.json`, `Dockerfile`, `.dockerignore`, `scripts/production-smoke.js`, `docs/operations/M18-runbook.md`, `docs/api/M18-production.md`, `postman/SAGE-M18.postman_collection.json`, `docs/milestones/README.md`, `AGENTS.md`, the weekly report and this summary. Added `GET /api/v1/ready`: 200 `{"status":"ready","service":"sage-api"}` when PostgreSQL responds; 503 `{"error":{"code":"NOT_READY","message":"Service is not ready."}}` otherwise. No request body or auth header. No database schema or migration changes. Full method, URL, headers, success and error examples appear in the [M18 API contract](../api/M18-production.md). Postman contains only GET calls and has not been run against production.

## Actual verification

`npm run ci` passed after installing dependencies in the isolated worktree and using the existing ignored local `.env`: ESLint 0 errors; TypeScript strict check passed; Jest 3 suites, 7 passed/0 failed/0 skipped; Mocha 59 passed/0 failed/0 skipped against `sage_lms_test`; runtime smoke passed. `prisma migrate deploy` found 10 migrations and none pending in the test database. An initial CI attempt failed because the worktree lacked `DATABASE_URL`; another failed because Prisma engine cache writes under AppData were denied by the sandbox. The final run used the approved elevated execution path. The Docker image has not been built or run here; no Docker CLI was found on PATH. The read-only production smoke script and Postman collection were not executed against a live host.

## Security and learning notes

Container runs as uid 10001 and excludes local secrets from build context. Production config requires explicit HTTPS CORS origins and media signing secret. Migration credentials must be injected by the release runner and kept separate from runtime credentials. Readiness should depend on a real database query; liveness should remain independent of dependencies to avoid restart loops. A backup plan cannot count as a restore test, so recovery evidence remains a launch gate.

## PR and decisions

PR status: [draft #26](https://github.com/Omegacarlos1/Sage-product/pull/26), implementation commit `7dfcfdc`; no merge. Team must choose host/region, production DB, TLS/domain, frontend origins, persistent media, backup frequency/retention/RPO/RTO, alert destination/on-call and restore-drill environment. Obtain explicit approval for live deploy and for any production migration or restore. The runbook proposes a single instance until shared state is available.

## Ready-to-paste post-release maintenance prompt

> Read `AGENTS.md`, the PRD, milestone plan, `docs/milestones/M18-summary.md` and the operational runbook. After M18 review, approved live deployment, monitored health verification and an evidenced isolated restore drill, work only on post-release maintenance on a separate feature branch. Reconcile real incident and alert data, verify backup age and periodic restore results, review dependency/security updates, fix confirmed defects with regression tests, update API docs and weekly report, and open a reviewable PR. Do not perform live payment operations, destructive production changes, deploy or merge without explicit approval. Report actual results and unresolved risks.
