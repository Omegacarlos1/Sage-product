# M13 — Reviews and ratings

**Status:** Implemented on `feature/M13-reviews-ratings`; awaiting review. M12 PR #15 merged into `main` after M13 implementation began; M13 targets `main`. No merge or deployment.

## Objectives and implementation

Enrolled learners with active or completed enrollment may create one review for a published course; paid courses require the enrollment's successful payment. Learners may edit their own visible review while still eligible. Ratings must be integers 1–5 and comments at most 2,000 characters. PostgreSQL unique `(userId, courseId)` and rating check constraints enforce duplicate and range rules even during concurrent writes. Public reviews are paginated and return display names without user IDs or email. PostgreSQL computes average and count for visible reviews in the same repeatable-read transaction as the list. Admins can hide a review with a reason or restore it; hidden reviews are excluded from aggregates and cannot be edited by the learner.

## Not implemented and decisions

Review reporting and appeals, moderation audit history, and review deletion are not implemented. Team confirmation is needed for eligibility after refunds, whether completion should be mandatory, whether instructors can reply, and the moderation appeal process. M13 currently treats successful linked payment as entitlement and blocks cancelled enrollment. A refunded payment no longer meets the edit/create rule. No existing review is automatically hidden when a payment is refunded or an enrollment is cancelled.

## Files and database

Added `src/routes/reviews.ts`, `tests/integration/reviews-m13.test.js`, [API contract](../api/M13-reviews.md), [Postman collection](../../postman/SAGE-M13.postman_collection.json), and migration `20261125120000_m13_review_moderation`. Updated `src/app.ts`, `prisma/schema.prisma`, milestone tracker, `AGENTS.md`, and weekly report. The migration adds `hiddenAt`, `moderationReason`, a rating range check, and a listing index. It was applied only to local `sage_lms_test`. The unrelated preexisting edit to `docs/reports/2026-11-13-backend-weekly.md` was preserved and excluded.

## Actual verification

`npm run ci` passed: ESLint 0 errors, strict TypeScript passed, Jest 3 suites and 7 tests passed/0 failed/0 skipped, Mocha 45 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`, and runtime smoke passed. `npm run db:migrate:test` found eight migrations and no pending migrations. An earlier full run had 44 Mocha passes and one timeout in the preexisting M03 password-reset test; `npm run test:integration` rerun passed 45/0/0, as did the final full CI run. Postman was not manually run; its examples are expected contract responses.

## API, security, and Postman

`POST /api/v1/courses/{courseId}/reviews`, `PATCH /api/v1/courses/{courseId}/reviews/mine`, `GET /api/v1/courses/{courseId}/reviews`, and admin `PATCH /api/v1/reviews/{reviewId}/moderation`. Exact methods, headers, bodies, success and error examples are in the [API contract](../api/M13-reviews.md). Public output omits credentials, learner IDs, emails, and moderation reasons. Errors and logs do not include review comments.

## Learning notes and PR

Database constraints protect concurrent duplicate and out-of-range writes; application validation gives clearer errors. A repeatable-read snapshot keeps the list and aggregate aligned during concurrent moderation. PR status/link: [draft PR #16](https://github.com/Omegacarlos1/Sage-product/pull/16) targets `main` and awaits review. Do not merge without human approval.

## Ready-to-paste M14 prompt

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, and `docs/milestones/M13-summary.md`; inspect branch, working tree, schema, and existing payment APIs. After M13 approval, work only on **M14: Refunds, instructor earnings and payouts** on `feature/M14-refunds-earnings-payouts`. Agree on refund eligibility, payout provider and approval policy before live money movement. Implement safe ledger records, idempotent refund and payout transitions, authorization, and PostgreSQL tests; update API docs and exact Postman cases; run lint/typecheck/Jest/Mocha; write the M14 summary and weekly report; push a reviewable draft PR; stop for approval without live transfers or merging.
