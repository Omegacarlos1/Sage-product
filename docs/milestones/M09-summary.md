# M09 — Paystack payment gateway and transactions

**Status:** Implemented for review on `feature/M09-paystack-payments` on 2026-11-24. The user confirmed Paystack and NGN. [Draft PR #9](https://github.com/Omegacarlos1/Sage-product/pull/9) targets `main`; no live charge, production migration or deployment occurred. GitHub confirms M08 PR #8 merged on 2026-11-23.

## Objectives and implementation

Learners can initialize a Paystack checkout for a published paid NGN course with a server calculated price and an idempotency key. A `PENDING` payment intent is stored before the gateway call; its unique reference, status, checkout URL and settlement time form the transaction record. A signed `charge.success` webhook is accepted only after raw body HMAC verification and a server to server Paystack transaction verification that matches reference, status, amount, currency and payer email. Payment settlement and enrollment are written in one PostgreSQL transaction. Duplicate deliveries have no duplicate effect. Learners can see only their own latest 50 transactions.

The webhook handles both current timestamped `Paystack-Signature` and the legacy `x-paystack-signature` described in [Paystack webhook documentation](https://paystack.com/docs/payments/webhooks/). Server verification uses Paystack's [transaction verification endpoint](https://paystack.com/docs/api/transaction/). Checkout returns `503` until a secret key is configured privately. Existing USD courses are rejected for checkout; the default for new courses is now NGN. A provider checkout failure leaves a `FAILED` record; a new idempotency key is needed to retry.

## Changed files and database

Added `src/services/paystack.ts`, `src/routes/payments.ts`, `tests/integration/payments-m09.test.js`, `docs/api/M09-payments.md`, `postman/SAGE-M09.postman_collection.json`, and migration `20261124090000_m09_paystack`. Changed `src/app.ts`, `src/config/env.ts`, `prisma/schema.prisma`, `.env.example`, `AGENTS.md`, the milestone tracker, weekly report and this summary. The preexisting unrelated edit to `docs/reports/2026-11-13-backend-weekly.md` was left untouched.

The migration adds nullable `checkoutUrl` and `settledAt` to `payments` and changes the default new course currency to NGN. It was applied to local `sage_lms_test` and `sage_lms_dev`; no production database was touched. Existing USD values were preserved.

## API and Postman

Proposed endpoints: `POST /api/v1/courses/:id/checkout`, `POST /api/v1/payments/paystack/webhook`, and `GET /api/v1/learners/me/transactions`. The [API contract](../api/M09-payments.md) gives exact methods, headers, bodies, success and error responses. The [Postman collection](../../postman/SAGE-M09.postman_collection.json) contains checkout, invalid webhook, local signed webhook simulation and transaction history. The Postman application was not run; the signed simulation requires private sandbox secrets and Paystack verification to return a real successful transaction. Automated tests used an injected fake gateway and did not contact Paystack.

## Actual tests

Final `npm run ci` passed: lint 0 errors; TypeScript typecheck passed; Jest 2 suites with 6 passed/0 failed/0 skipped; Mocha 32 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:migrate:test` found no pending migrations on the final run, after the first run applied M09. `npm run db:migrate:dev:apply` applied the migration to `sage_lms_dev`. `node -e "JSON.parse(...)"` confirmed the Postman collection is valid JSON; `git diff --check` reported no whitespace errors. Tests cover checkout idempotency, cross user key conflict, bad signature, failed status, wrong amount, replay, own transaction history and denied access before settlement.

## Security, blockers and learning notes

The checkout amount comes from the stored course; the bearer session supplies identity. The client never supplies a payment result. The webhook validates raw signed bytes, then independently verifies with Paystack before one atomic settlement. Secrets are configuration values and `.env.example` placeholders only; neither raw webhook bodies nor credentials are logged. Local signed requests cannot establish a real payment because the server also calls Paystack verification.

Sandbox keys, a dashboard webhook signing secret, public webhook registration, a real Paystack test mode delivery, and frontend endpoint confirmation remain for team review. Concurrent independent paid checkouts for the same learner/course can both charge; only one payment can attach to the existing one to one enrollment. Operations must reconcile or refund any duplicate charge. Refund handling and payout policy remain later finance work. Webhook processing currently waits for the database commit before responding; a durable queue would improve resilience under load.

## PR and next prompt

Commit [`5b24543`](https://github.com/Omegacarlos1/Sage-product/commit/5b24543) was pushed to `origin/feature/M09-paystack-payments`. [Draft PR #9](https://github.com/Omegacarlos1/Sage-product/pull/9) targets `main` and is open for review. Its description records changes, tests, risks and remaining issues. No merge or M10 implementation is authorized here.

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, and `docs/milestones/M09-summary.md`; inspect the branch and schema. After M09 approval, work only on **M10: Learning progress** on `feature/M10-learning-progress`. Track lesson completion, bookmarks, notes and resume point; compute course completion from instructor requirements and enforce active enrollment and paid entitlement. Ensure other users cannot edit progress, repeated completion is idempotent, and aggregate progress is consistent. Add exact Postman requests and responses, API documentation, PostgreSQL backed Mocha tests, Jest as appropriate, and run lint, typecheck and the full CI suite. Update `docs/milestones/M10-summary.md`, the weekly report, tracker and AGENTS.md; push and prepare a draft PR. Stop for review; do not auto merge.
