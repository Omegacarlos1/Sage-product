# V2 account model: separate learner and instructor accounts

**Status:** Implemented on `feature/V2-separate-accounts` for review on 2026-11-27. No production migration or deployment. This follows the linked business document's later decision for separate accounts with optional, consent-based linking.

## Objectives and implementation

Added `POST /api/v1/auth/instructor/signup` to create a distinct instructor account with its own unique email, password and session. The account starts with a pending instructor profile and no instructor privileges. Admin verification grants the instructor role in the same PostgreSQL transaction as the verification status change. Pending applicants can edit their own instructor profile. Added `account_links`, a one-to-one association between a learner account and an instructor account. A learner requests a link; the instructor confirms from their own authenticated session within 15 minutes. Either party may revoke it. Linking does not grant permissions or expose the other account's private data. Unknown email addresses receive the same generic request response.

## Existing users and unresolved conversion

The migration only adds a table; it does **not** split existing multi-role users, change user IDs, move enrollments/courses/payments, or revoke their sessions. Legacy combined accounts remain functional. Those users cannot request a link to themselves; they need a separate, approved conversion process that specifies a second email, password setup, ownership transfer, and user consent. The team must decide whether and when to convert them. This feature does not add instructor identity/qualification evidence, a subject reviewer, email verification, or production password reset delivery. There is no live account linking or single sign-on between the two sessions.

## Files, migration and API

Added `src/routes/account-links.ts`, `tests/integration/account-model-v2.test.js`, `docs/api/V2-account-model.md`, `postman/SAGE-V2-account-model.postman_collection.json`, and `prisma/migrations/20261128090000_v2_separate_accounts/migration.sql`. Updated `prisma/schema.prisma`, `src/app.ts`, `src/routes/auth.ts`, `src/routes/profiles.ts`, `src/routes/admin.ts`, M03 API docs, tracker, weekly report, `AGENTS.md`, and this summary. The migration creates `account_links` with distinct-account, valid-status, one-to-one uniqueness and foreign-key constraints. It has no destructive statements. Exact methods, URLs, headers, bodies and response examples are in the [V2 API contract](../api/V2-account-model.md). The Postman collection contains request examples but was not manually run.

## Actual verification

`npm run ci` passed on 2026-11-27: lint 0 errors, strict TypeScript passed, Jest 3 suites and 7 passed/0 failed/0 skipped, Mocha 62 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`, runtime smoke passed. `db:migrate:test` applied the eleventh migration on its first run and found no pending migrations on the final run. New integration tests cover separate credentials, pre-approval denial, admin grant, dual-session consent, cross-user confirmation denial, role isolation, revocation and expired requests. An initial run found three failures from a malformed UUID validator and pending-profile authorization; both were corrected before the passing run. No development or production database migration was run. Docker and live Postman were not run.

## Security and learning notes

Both sessions authenticate independently; no access token is passed between accounts. The link table stores IDs and timestamps only, never credentials. A generic 202 response limits email enumeration. One-to-one database constraints prevent linking one account to several others. Keeping the legacy combined-account path avoids an unreviewed irreversible data migration, but it means the account model is transitional until the business approves conversion.

## PR and next prompt

PR status: reviewable draft PR to be created after commit and push. Human approval required before merge. Next prompt: review the V2 account model contract and existing combined-account inventory. Decide the migration policy for legacy users, including verified second email, password setup, explicit consent, ownership transfer of courses and enrollments, session revocation and rollback. Implement only the approved conversion on a separate branch with PostgreSQL migration rehearsal and tests. Do not run a production migration, deploy or merge without explicit approval.


