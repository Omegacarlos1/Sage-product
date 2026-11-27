# M17 — Security and end-to-end quality

**Status:** Approved by the user and [PR #23](https://github.com/Omegacarlos1/Sage-product/pull/23) merged into `main` at `df46a87` on 2026-11-27 after both Backend CI `verify` checks passed. No deployment performed.

## Objectives and implemented

Reviewed CORS, security headers, validation, rate limiting, structured logging, secrets, authorization, SQL access, backups and test coverage. Added Helmet headers; production CORS now requires explicit unique HTTPS origins. Added per-IP, per-hour limits for signup (10), login (20), refresh (30), reset request (5), reset completion (10), contact (5), and newsletter (20), with 429 and `Retry-After`. Added a safe `.env.example`. Patched transitive `effect` and `serialize-javascript` dependencies. Added security integration checks and a 100-request local health load smoke script. No API or database schema changes were required.

## Review findings and limits

Existing routes use Prisma model methods; the three raw SQL advisory locks and health query use Prisma tagged parameter binding. Existing integration tests cover learner, instructor, admin and cross-user access for the critical enrollment, payment, learning, quiz, certificate, review, finance and notification flows. Central error logging records JSON level and generic message without request body, credentials or contact message. CORS is browser access control; direct HTTP callers still receive health responses. Rate limits are process local and use `req.ip`; production needs a shared store and a reviewed trusted-proxy policy before multiple replicas or a reverse proxy. The rate limit is an abuse control, not a full credential-stuffing defense. Password reset delivery and email verification remain inactive pending team decisions. Backup/restore instructions exist in `docs/database/README.md`; `pg_dump` was not on this worktree's PATH and no restore drill was run. M18 owns production backup scheduling, encryption, retention and restore verification.

Full `npm audit` reports 26 development-tool findings (1 low, 25 moderate, 0 high, 0 critical) after the patches. `npm audit --omit=dev` reports 0. No high-severity issue remains in the reported dependency tree. Dependency advisory status can change and must be checked again before deployment.

## Changed files

Runtime: `src/app.ts`, `src/config/env.ts`, `src/routes/auth.ts`, `src/routes/public-submissions.ts`, `src/services/rate-limit.ts`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`. Verification: `tests/integration/security-m17.test.js`, `tests/load-smoke.js`. Documentation: `docs/api/M17-security.md`, `postman/SAGE-M17.postman_collection.json`, tracker, weekly report, and this summary.

## Verification

Final `npm run ci` passed on 2026-11-27: ESLint 0 errors; strict TypeScript check passed; Jest 3 suites, 7 passed/0 failed/0 skipped; Mocha 58 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:migrate:test` found 10 migrations with none pending. `npm run test:load-smoke` passed 100/100 concurrent local health requests in 367 ms, 0 failures. `npm audit --omit=dev --json` found 0 vulnerabilities; full `npm audit` found 26 development-tool findings (1 low, 25 moderate, 0 high). The Postman collection contains contract expectations; it has not been run manually. No production database, real payment, or deployment was used.

## API and Postman

Exact methods, URLs, headers, bodies and expected success/error examples for CORS, invalid JSON, invalid login, 429, contact/newsletter and the admin auth matrix are in [the M17 API contract](../api/M17-security.md) and [Postman collection](../../postman/SAGE-M17.postman_collection.json). These are expected responses, not claimed live Postman results.

## Learning notes and PR

Dependency audits can report transitive development packages even with `--omit=dev` when they are reachable through the package graph. Patch-level overrides were verified with the full gate. Rate limits must precede expensive password checks and database writes. A 429 includes a retry time so clients can back off. Implementation commit: `e89e59c`; [PR #23](https://github.com/Omegacarlos1/Sage-product/pull/23) merged at `df46a87` after user approval. Manual Postman results were not supplied.

## Ready-to-paste M18 prompt

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, `docs/milestones/M17-summary.md` and current code. After M17 is approved and merged, work only on **M18: Deployment, monitoring, PostgreSQL backups and handover** on `feature/M18-deployment-handover`. Prepare secure production deployment and health monitoring, document required team decisions, implement backup scheduling/encryption/retention and verify a restore in an isolated PostgreSQL database. Review proxy trust, shared rate-limit store and Socket.IO scale-out before multi-replica use. Run lint/typecheck/Jest/Mocha and relevant deployment smoke checks; update API docs, Postman examples, tracker, weekly report and M18 summary; push a reviewable draft PR. Do not deploy, merge, activate live payments or run destructive production operations without explicit approval.
