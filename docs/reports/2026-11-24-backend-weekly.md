# SAGE LMS backend weekly update — 2026-11-24

**Reporting period:** 2026-11-23 to 2026-11-24. **Milestone:** M09 Paystack payments. **Branch:** `feature/M09-paystack-payments`. **PR:** [#9](https://github.com/Omegacarlos1/Sage-product/pull/9) merged into `main` on 2026-11-24; merge commit `6234d20`.

**Approval update:** The user approved M09 on 2026-11-24. PR #9 passed both final Backend CI jobs and merged into `main` that day. M10 has not started. A manual signed webhook success result was not supplied, so the recorded payment settlement evidence remains automated tests and read-only verification of one Paystack test-mode transaction.

## Verified complete and in progress

The user confirmed Paystack and NGN. M09 implementation is ready for review: NGN checkout initialization, local payment records, signed webhook validation, server verification, atomic idempotent settlement/enrollment and own transaction history. Evidence: commit [`5b24543`](https://github.com/Omegacarlos1/Sage-product/commit/5b24543), [draft PR #9](https://github.com/Omegacarlos1/Sage-product/pull/9), [M09 summary](../milestones/M09-summary.md), [API contract](../api/M09-payments.md), [Postman collection](../../postman/SAGE-M09.postman_collection.json), and `tests/integration/payments-m09.test.js`. The migration applied to local development and test PostgreSQL. GitHub confirms M08 PR #8 merged on 2026-11-23.

## Actual tests and Postman demonstration

Final `npm run ci` passed: lint 0 errors; typecheck passed; Jest 6 passed, 0 failed, 0 skipped in 2 suites; Mocha 32 passed, 0 failed, 0 skipped against `sage_lms_test`; runtime smoke passed. `npm run db:migrate:dev:apply` applied M09 migration locally; the final test migration check found no pending migrations. No live or Paystack sandbox requests were sent and Postman was not run manually.

GitHub Backend CI `verify` passed on the [push run](https://github.com/Omegacarlos1/Sage-product/actions/runs/45369535886/job/138359903611) and [PR run](https://github.com/Omegacarlos1/Sage-product/actions/runs/45369543600/job/138359933960).

Postman demonstration: `POST /api/v1/courses/{paidNgnCourseId}/checkout` with a learner bearer token, `Idempotency-Key`, and `{}` expects `201` with a Paystack checkout URL when configured; without a key it expects `503`. An invalid `POST /api/v1/payments/paystack/webhook` signature expects `401`. A properly signed local simulation requires private signing credentials and a Paystack verified transaction; it cannot itself prove payment. `GET /api/v1/learners/me/transactions` expects `200` with only the caller's records. Exact examples are in the API contract.

## Blockers, risks and next week

Manual checkout follow-up: a local test returned `502` because Paystack rejected the learner's `example.test` email with HTTP 400. A read-only verification request authenticated the test key; one test-mode checkout initialization reproduced the validation response without charging a card. The API now gives `422 PAYMENT_EMAIL_INVALID` for this known error. Final tests for this follow-up are recorded in the M09 summary.

Follow-up `npm run ci` passed lint and typecheck, Jest 7 passed/0 failed/0 skipped, Mocha 33 passed/0 failed/0 skipped, and runtime smoke. The first follow-up run had one integration assertion failure caused by a new failed payment in the second learner's own history; the assertion was corrected before the passing rerun.

Manual webhook follow-up: Paystack verified the latest test payment as successful, but SAGE still marked it `PENDING` because the webhook had not settled it. A harmless locally signed legacy `ping` returned `200`. Added `payments:sign-test-webhook` to produce an exact body and legacy signature for manual Postman entry; it does not send a request or print the key. The visible test key needs rotation before further testing.

After the helper addition, `npm run ci` passed lint and typecheck, Jest 7 passed, Mocha 33 passed, and runtime smoke. A dummy-key helper run produced the body and 128-character signature as expected.

## M10 update — 2026-11-24

**Reporting period:** 2026-11-24. **Milestone:** M10 learning progress. **Branch:** `feature/M10-learning-progress`. **PR:** [draft #11](https://github.com/Omegacarlos1/Sage-product/pull/11), open and unmerged. M09 was approved and [PR #9](https://github.com/Omegacarlos1/Sage-product/pull/9) merged; M10 is implemented and awaits review. Evidence: [commit `e08aa59`](https://github.com/Omegacarlos1/Sage-product/commit/e08aa59ce6c98ed4561cd1f3153345ae4c095e53), [M10 summary](../milestones/M10-summary.md), [API contract](../api/M10-learning-progress.md), [Postman collection](../../postman/SAGE-M10.postman_collection.json), `tests/integration/progress-m10.test.js`.

Verified completed: learner owned completion, bookmarks, notes, position and resume endpoints; instructor required lesson flag; dynamic required lesson aggregate; local test PostgreSQL migration. No production migration or deployment. `npm run ci` passed lint (0 errors), typecheck, Jest 7 passed/0 failed/0 skipped, Mocha 37 passed/0 failed/0 skipped against `sage_lms_test`, and runtime smoke. Two earlier failing runs found route scope and UUID validation errors, both fixed before the passing run. Postman requests are supplied but were not run manually; expected responses are documented, not live results.

In progress: draft PR review and human approval. Risks and decisions: confirm frontend contract; `resumeLessonId` is route validated but has no database foreign key; concurrent note and position edits use last writer wins. Next week: review M10, then begin M11 only after approval. Prior Paystack, media storage and contact retention decisions remain open.

Sandbox credentials and dashboard webhook registration remain for a real Paystack test mode delivery. Frontend contract confirmation, M07 production media storage and contact retention scheduling remain open. Concurrent independent checkouts for one course can result in a duplicate charge, which needs operational reconciliation; refund handling belongs to later finance scope. Next: human review of M09 and its draft PR, then M10 only after approval. No live payments, production migration, deployment or merge occurred.
