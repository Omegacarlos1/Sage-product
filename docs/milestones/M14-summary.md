# M14 — Refunds, instructor sales and payouts

**Status:** Implemented on `feature/M14-refunds-earnings-payouts`; [draft PR #18](https://github.com/Omegacarlos1/Sage-product/pull/18) awaits human review. Based on `origin/main` at `1e1e69f`, which merged approved M13 PR #16. No deployment, live refund, transfer, or merge.

## Objectives and implemented work

Added instructor only NGN sales rows and aggregate gross provisional balance, learner refund requests for their own successful payment, instructor payout requests bounded by provisional available, owner only request status lists, and admin rejection of pending requests. Requests create actor and timestamp audit rows in the same PostgreSQL transaction. A payment accepts one refund request; request idempotency keys are unique. Payout keys are unique and a PostgreSQL advisory transaction lock serializes requests for one instructor, preventing concurrent over reservation. Role checks deny unauthorized financial actions. All API routes are under `/api/v1`.

## Not implemented and decisions required

No refund execution, payout approval, completed payout, provider call, bank detail storage, fee deduction, or actual cash reconciliation is implemented. The team must define refund eligibility and deadlines, platform and provider fees, taxes, instructor share, dispute reserve, payout approval authority, provider, webhook verification, and reconciliation process before enabling live money movement. `provisionalAvailable` is gross successful NGN course payments less pending refund and payout request holds; it is **not** an amount owed to instructors or proof of provider settlement. A rejected refund or payout releases its provisional hold. Refund requests do not change enrollment access or payment status. The one refund request per payment policy blocks a replacement after rejection; the team must confirm appeal or retry policy. No production migration was run.

## Files and database

Added `src/routes/finance.ts`, `tests/integration/finance-m14.test.js`, [API contract](../api/M14-finance.md), [Postman collection](../../postman/SAGE-M14.postman_collection.json), and migration `20261125180000_m14_finance_requests`. Updated `src/app.ts`, `prisma/schema.prisma`, `AGENTS.md`, milestone tracker, M13 status, and weekly report. The migration adds `refund_requests`, `payout_requests`, and `finance_audit` with foreign keys, unique payment/refund and idempotency constraints, indexes, and a positive payout amount check. It was applied only to local `sage_lms_test`.

## Actual verification

`npm ci --offline` installed 657 packages with 0 reported vulnerabilities. `npm run lint` passed with 0 errors. `npm run typecheck` passed. `npm run db:migrate:test` applied the ninth migration locally and the full rerun found no pending migration. `npx mocha tests/integration/finance-m14.test.js` passed 3/0/0. Full `npm run ci` passed: ESLint 0 errors, TypeScript passed, Jest 3 suites and 7 tests passed/0 failed/0 skipped, Mocha 48 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`, and runtime smoke passed. Postman was not manually run; its responses are contract examples. The initial typecheck was blocked by Prisma cache permissions under AppData and passed when rerun with the required permission. An initial lint run found a syntax error in the new test, which was fixed before the successful checks.

## API, security, and Postman

`GET /instructors/me/sales`; `POST /payments/{paymentId}/refund-requests`; `GET /learners/me/refund-requests`; `POST` and `GET /instructors/me/payout-requests`; admin `POST /admin/refund-requests/{id}/reject` and `POST /admin/payout-requests/{id}/reject`. Exact method, URL, headers, sample body, success and error examples are in the [API contract](../api/M14-finance.md). The [Postman collection](../../postman/SAGE-M14.postman_collection.json) includes sales dashboard, refund request, payout request/status, and forbidden action. Responses omit refund reasons, learner identity, bank details, and credentials. Audit rows capture each accepted transition once; rejected attempts do not create audit rows.

## Learning notes and PR

The database unique constraint protects duplicate refund requests, including concurrent calls. A per instructor transaction lock makes the payout hold check atomic against other payout requests. Gross sales alone cannot establish an instructor entitlement without a finance policy or settlement records. Implementation commit: `9d920ff`. PR status/link: [draft PR #18](https://github.com/Omegacarlos1/Sage-product/pull/18); do not merge before human approval.

## Ready-to-paste M15 prompt

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, and `docs/milestones/M14-summary.md`; inspect branch, tree, schema and finance decisions. After M14 approval, work only on **M15: Admin management and approvals** on `feature/M15-admin-management`. Implement admin only user and instructor management, course approval/rejection, transaction overview, basic analytics and immutable audit trail for sensitive actions. Do not activate refund or payout transfers until finance policy and provider are agreed. Test unauthorized access and approval state transitions against PostgreSQL; update exact Postman cases and API docs; run lint/typecheck/Jest/Mocha; write M15 summary and weekly report; push a reviewable draft PR; stop for approval without merging or deploying.
