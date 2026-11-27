# M16 — Socket.IO notifications

**Status:** Implemented on `feature/M16-socket-notifications` from merged M15 `main` (`5ed9ab9`). User approved M16; [PR #21](https://github.com/Omegacarlos1/Sage-product/pull/21) merged into `main` at `68933ba` on 2026-11-27. No deployment performed.

## Objectives and implemented work

Socket.IO handshake validates the same opaque access token and active session as REST. The server alone assigns a `user:<id>` room. Missing, malformed, expired, revoked and suspended credentials are rejected. An expiration timer closes active sockets, and emission rechecks session state. Connections and reconnects use a fresh token; the REST list recovers offline notifications. Socket delivery is best effort and carries only ID, type, title and creation time. The persisted REST payload carries only event and resource IDs.

Free and paid enrollment, course approval and rejection, quiz result and certificate issuance create notifications in the same transaction as the successful state change. They publish after commit. REST endpoints list only the caller's records and idempotently mark an owned notification read. The existing notifications table supports this milestone; no database schema or migration change was required.

## Not implemented and decisions

No push notification, email delivery, replay queue, shared Socket.IO adapter or multi replica delivery is included. A production scale out decision is required before running multiple API replicas. Manual Socket.IO and Postman walkthroughs remain for the reviewer. No live payment, deployment or production database operation was performed.

## Changed files

Runtime: `src/server.ts`, `src/app.ts`, `src/services/notifications.ts`, and enrollment, payment, admin, course, quiz and certificate routes. Verification: `tests/integration/notifications-m16.test.js`, `package.json`, `package-lock.json` (Socket.IO test client). Documentation: [API and socket contract](../api/M16-notifications.md), [Postman collection](../../postman/SAGE-M16.postman_collection.json), milestone tracker, weekly report and `AGENTS.md`.

## Verification

The final `npm run ci` passed after the enrollment test improvement: lint 0 errors; TypeScript strict check passed; Jest 3 suites, 7 passed/0 failed/0 skipped; Mocha 53 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:migrate:test` reported 10 migrations and none pending. Before the final run, `npx mocha tests/integration/notifications-m16.test.js` reported 2 passing and 1 failing cleanup hook due to an enrollment foreign key. The test cleanup now removes the enrollment first; a focused rerun passed 2/2. Postman examples are contract expectations, not manual run results.

## Postman and security

Exact REST methods, URLs, headers, sample bodies, success and error examples, plus the Socket.IO manual event checklist are in the [M16 contract](../api/M16-notifications.md). The [collection](../../postman/SAGE-M16.postman_collection.json) has list, mark read and unauthorized cases. Socket tokens are supplied in handshake auth, not URL query strings. The API does not allow client room joining, and another user's notification ID returns 404. The emitted event excludes quiz answers, scores, user contact data, payment data, certificate codes and persisted payload.

## Learning notes and PR

Persisting within the business transaction avoids an event for a rolled back operation. Emitting after commit avoids telling a client about uncommitted data. REST history is the reliable recovery path when a socket disconnects. Implementation commit: `b42865c`. [PR #21](https://github.com/Omegacarlos1/Sage-product/pull/21) merged after user approval and both GitHub `verify` checks passed. M17 has not started.

## Ready-to-paste M17 prompt

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, `docs/milestones/M16-summary.md` and current code. After M16 is approved and merged, work only on **M17: Security and end-to-end quality** on `feature/M17-security-quality`. Review CORS allowlist, Helmet, validation, rate limiting for contact/newsletter/auth, structured error logging, secret hygiene, access control, SQL injection resistance, backup checks, test coverage and load smoke tests. Document any high severity issue and waiver; verify critical flows with integration tests. Supply negative security, 429 and auth matrix Postman cases with exact examples and actual results. Run lint, typecheck, Jest and Mocha; update API docs, tracker, weekly report and M17 summary; push a reviewable draft PR. Stop for approval without merging or deploying.
