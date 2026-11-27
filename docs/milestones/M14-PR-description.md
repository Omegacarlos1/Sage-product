# M14: Refunds, instructor sales and payouts

## Changes

- Add instructor sales dashboard and gross provisional balance with refund and payout request holds.
- Add one refund request per successful learner payment and idempotent instructor payout requests.
- Add admin rejection and transactional actor audit rows for accepted state changes.
- Add Prisma migration, integration tests, API documentation, Postman collection, milestone summary and weekly report.

## Verification

`npm run ci` passed: lint 0 errors, TypeScript pass, Jest 7/0/0, Mocha 48/0/0 against local PostgreSQL `sage_lms_test`, runtime smoke pass. The ninth migration was applied locally and had no pending migrations on rerun. Targeted M14 Mocha: 3/0/0. Postman collection prepared, not manually run.

## Risks and decisions

The dashboard shows gross provisional NGN amounts, not provider reconciled cash or an agreed instructor entitlement. Refund eligibility, fees, taxes, payout share, reserve, approval process and payout provider remain unconfirmed. No live refund or transfer, bank details, approval or completion endpoint is enabled. A late refund request can make provisional available negative after a payout hold; this is visible in the dashboard and cannot trigger a transfer. Refund requests do not revoke enrollment access. The team must decide retry and appeal policy after rejection.

## Review request

Please review authorization, idempotency and locking, audit records, provisional balance semantics, and the missing finance policies. Keep this PR as draft and do not merge or deploy until approved.
