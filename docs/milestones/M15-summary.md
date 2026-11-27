# M15 — Admin management and approvals

**Status:** Implemented on `feature/M15-admin-management`; awaiting human review and approval. M14 PR #18 was verified merged before M15 began. No merge or deployment was performed.

## Objectives and implemented work

Added admin only paginated user and instructor lists, user suspension/reactivation, pending instructor verification/rejection, a course review queue and approval/rejection transitions, transaction overview, basic aggregate analytics, and an admin audit read endpoint. The existing course approval route remains compatible and now writes an audit event. PostgreSQL transactions couple state changes with audit inserts. Conditional updates prevent a second course decision. Suspending a user revokes existing sessions. Admins cannot suspend themselves or another admin.

## Not implemented and decisions

No deletion, role assignment, bulk moderation, appeal/revision workflow for rejected instructors or courses, finance transfers, settlement accounting or advanced analytics was added. Rejected courses remain private. Team should agree on rejection reasons, appeals, whether instructor verification may be retried, transaction retention, and admin reporting needs. Finance fees, refund eligibility, payout share and provider remain open from M14.

## Files and database

Added `src/routes/admin.ts`, `tests/integration/admin-m15.test.js`, [API contract](../api/M15-admin.md), [Postman collection](../../postman/SAGE-M15.postman_collection.json), and migration `20261127120000_m15_admin`. Updated `src/app.ts`, `src/routes/courses.ts`, `prisma/schema.prisma`, an existing integration cleanup, milestone tracker, `AGENTS.md`, and the weekly report. The migration adds `REJECTED` course status and `admin_audit`, indexed by target and timestamp. A PostgreSQL trigger rejects audit update and delete. Only the local `sage_lms_test` database received this migration during verification.

## Actual verification

`npm run ci` passed on 2026-11-27: ESLint 0 errors; TypeScript strict check passed; Jest 3 suites, 7 passed/0 failed/0 skipped; Mocha 51 passed/0 failed/0 skipped against PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:migrate:test` applied the tenth migration. M15 tests cover learner forbidden access, valid and invalid course transitions, one audit event per accepted action, database rejection of audit deletion, suspension, self protection, instructor verification and overview access. Postman was not manually executed; examples are contract expectations.

## API, security and Postman

Exact methods, URLs, headers, request bodies, success and error examples are in the [M15 API contract](../api/M15-admin.md). The [Postman collection](../../postman/SAGE-M15.postman_collection.json) covers approve/reject course, user and instructor management, transaction/analytics/audit lists, and forbidden learner access. Lists are paginated to at most 50 rows. Payment overview excludes checkout and provider references, user IDs and keys. Audit captures actor, target, action, prior and new status, and time; it contains no message body or credentials. Test fixture cleanup truncates the audit table only in the isolated local test database.

## Learning notes and PR

An application transaction ensures an audit insert fails or succeeds with the state transition; the database trigger enforces append only behavior even if another code path attempts mutation. Basic payment totals are gross successful NGN records, not settled revenue. Draft PR status/link: pending creation. Human approval remains required before merge.

## Ready-to-paste M16 prompt

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, `docs/milestones/M15-summary.md`, and current code. After M15 is approved and merged, work only on **M16: Socket.IO notifications** on `feature/M16-socket-notifications`. Authenticate socket connections, authorize user rooms, deliver only the caller's notifications, handle reconnects safely, and preserve REST notification history. Add PostgreSQL backed tests for unauthorized connections and cross-user isolation. Update API and Socket.IO contract, Postman examples where applicable, weekly report and M16 summary; run lint/typecheck/Jest/Mocha; push a reviewable draft PR; stop for approval without merging or deploying.
