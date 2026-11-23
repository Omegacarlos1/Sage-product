# M08 — Enrollments and entitlements

**Status:** Implemented on `feature/M08-enrollments-entitlements`; awaiting review. **PR:** [Draft #8](https://github.com/Omegacarlos1/Sage-product/pull/8), open and unmerged. Initial implementation commit: `c790780`.

## Objectives and implementation

Published free courses can be enrolled by authenticated learners. A unique PostgreSQL learner/course constraint prevents duplicate records, and the API maps concurrent unique violations to `409 ALREADY_ENROLLED`. Learners can list only their own courses. Lesson access now uses one entitlement check: an active enrollment in a published course, plus a linked succeeded payment for paid courses. The list reports the same access state. Effective price uses `discountPrice` when set.

Paid enrollment and payment verification are reserved for M09. The M08 API refuses paid enrollment with `403 PAYMENT_REQUIRED`; it accepts no client payment status. No production payment was attempted. Existing payment rows in tests represent future server verified M09 records.

## Files and database

Changed `src/app.ts`, `src/routes/media.ts`, `AGENTS.md`, milestone tracker, and weekly report. Added `src/routes/enrollments.ts`, `src/services/entitlements.ts`, `tests/integration/enrollments-m08.test.js`, `docs/api/M08-enrollments.md`, `postman/SAGE-M08.postman_collection.json`, and this summary. No schema change or new migration: the existing `enrollments` unique constraint and `payments` relationship support M08.

## API and Postman

`POST /api/v1/courses/:id/enroll` and `GET /api/v1/learners/me/courses` are proposed contracts pending frontend confirmation. Exact methods, headers, bodies, and expected `201`, `200`, `403`, and `409` examples are in the [API contract](../api/M08-enrollments.md) and [Postman collection](../../postman/SAGE-M08.postman_collection.json). Postman was prepared but not run manually. The HTTP behavior was exercised with Supertest.

## Actual tests

Final `npm run ci` on 2026-11-23 passed: lint 0 errors, TypeScript typecheck passed, Jest 2 suites with 6 passed/0 failed/0 skipped, Mocha 29 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`, and runtime smoke passed. `prisma migrate deploy --config prisma.test.config.ts` found no pending migrations. An initial run failed 13 integration tests because the new authentication middleware intercepted unrelated routes; it was scoped to the enrollment endpoints and the entire suite passed on rerun.

## Security, blockers and learning notes

Enrollment identity comes from the bearer session, never request body. The learner course list filters by caller ID and does not expose payment metadata. Paid lesson access verifies the linked payment belongs to the same learner and course. Tests cover pending, succeeded and refunded states, cross user denial, and concurrent duplicates. M09 must define provider verification, settlement, refund handling, and atomic payment/enrollment writes with the team. Existing M07 signed media URLs remain valid until their short expiry after entitlement revocation. Production media storage choice and frontend contract confirmation remain open.

## PR and next prompt

Draft PR #8 description: Add free enrollment, duplicate protection, learner course list, and shared paid lesson entitlement. Tests: `npm run ci` passed with 6 Jest and 29 Mocha tests. Risks: payment settlement is M09; signed URLs have a brief revocation delay. Do not merge without review.

> Work on the SAGE LMS backend as a junior developer, following the PRD and `SAGE_Revised_Backend_Milestones.docx`. Execute **M09: Payment gateway and transactions** only after M08 approval and team confirmation of the provider. Implement checkout initialization, payment intent and transaction records, signed webhook verification, idempotent settlement, and enrollment only after verified success. Never treat a client callback as proof of payment. Test tampered and repeated webhooks, failed payment access, checkout, and transaction history. Run lint, typecheck, Jest, PostgreSQL backed Mocha tests; update API docs, Postman cases, weekly report and `docs/milestones/M09-summary.md`. Push a feature branch and prepare a draft PR. Stop for review; do not auto merge.
