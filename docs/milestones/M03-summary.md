# M03 — Authentication and role permissions

**Status:** Implemented locally; awaiting review. **Branch:** `feature/M03-authentication`. **PR:** pending.

## Objectives and implementation

- Added email/password signup and login, logout, refresh rotation, protected identity route, role guard, and password reset request/complete.
- Public signup always creates a LEARNER and rejects extra fields, including requested roles. Admin check requires a database-assigned ADMIN role.
- Chose salted scrypt password hashes, opaque random tokens, and database-stored SHA-256 token hashes. Access lasts 15 minutes; refresh lasts 7 days; reset lasts 30 minutes. Rotation replaces both credentials. Reset revokes all sessions and other outstanding reset tokens.
- Email verification is deferred pending a verified sender and product policy. Social sign-in is deferred pending provider requirements. Production reset request returns `503` until email delivery is approved and configured.

## Files and database

Changed `prisma/schema.prisma`, added `prisma/migrations/20261117120000_authentication/migration.sql`, `src/services/auth.ts`, `src/routes/auth.ts`, wired `src/app.ts` and `src/server.ts`, added `tests/unit/auth.test.js` and `tests/integration/auth.test.js`, `docs/api/M03-authentication.md`, `postman/SAGE-M03.postman_collection.json`, this summary, tracker, AGENTS.md and the weekly report. Migration adds `auth_sessions` and `password_reset_tokens` with unique token hashes, foreign keys, and expiry/revocation fields. Applied to local test PostgreSQL by `npm run ci` and local development PostgreSQL by `npm run db:migrate:dev:apply`.

## Endpoints and Postman

See [authentication API contract](../api/M03-authentication.md) and [Postman collection](../../postman/SAGE-M03.postman_collection.json). Required scenarios: signup (`201`), login (`200`), invalid credentials (`401`), protected `/me` (`200` with Bearer or `401` without), logout (`204`, then `401` for old token). Exact method, URL, headers, bodies, success and error examples are in the API contract. Postman collection prepared; not run in the Postman application.

## Actual verification

`npm run typecheck` passed. `npm run ci` passed: ESLint 0 errors; strict TypeScript passed; Jest 2 suites, 6 passed, 0 failed/skipped; Mocha/Supertest 14 passed, 0 failed/skipped, including 5 M03 flows against isolated local `sage_lms_test`; runtime smoke passed. `npm run db:migrate:dev:apply` passed. Tests cover secure hash behavior, role escalation attempt, missing/forbidden credentials, rotation replay, logout revocation, reset replay and expiry.

## Risks, security and decisions

Development/test reset tokens are returned in the response for local testing because email delivery is not yet available. This reveals account existence in those environments; do not expose them publicly. Production reset request fails closed with `503`. This is a blocker to production password recovery, not a completed email delivery feature. No social provider or email verification policy has been approved. Roles currently require manual database assignment by a trusted operator; admin management belongs to M15. The current Socket.IO connection remains unauthenticated until M16; it does not expose protected data yet. Auth-specific distributed rate limiting is deferred to M17 and is a deployment risk if exposed before then. No secrets were committed.

## Learning notes

A password hash stores a random salt with the derived hash. A session stores only token hashes, so a database reader cannot directly reuse a bearer token. `updateMany` with the old refresh hash makes rotation and reset consumption conditional, blocking replay even if requests race.

## Review and next prompt

PR description: Add M03 PostgreSQL auth tables, signup/login/logout/refresh/reset routes, role middleware, unit/integration coverage and API/Postman documentation. Local `npm run ci` passed. Risks: reset delivery and email verification need team decisions; no auth rate limiter yet. Do not merge before review.

> Work on SAGE LMS backend as a junior developer. Execute **M04: User and instructor profiles** only after M03 approval. Implement private profile editing, safe public instructor profile, validation and pagination if needed. Reuse the M03 user/role model, verify ownership, and never expose private fields. Run lint, typecheck, Jest and Mocha; update Postman/API docs, weekly report and `docs/milestones/M04-summary.md`; push a feature branch and prepare a reviewable PR. Stop for review without merging.
