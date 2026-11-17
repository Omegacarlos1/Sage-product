# M04 — User and instructor profiles

**Status:** Implemented locally; awaiting review. **Branch:** `feature/M04-profiles`. **PR:** pending.

## Objectives and implementation

Added authenticated learner profile read/edit and instructor profile edit, plus public verified instructor detail and paginated listing. Private writes derive ownership from the M03 bearer session. The existing one-to-one `User`/`InstructorProfile` relationship is reused. Public queries select only `userId`, display name, headline, biography and website URL. Only verified profiles linked to active users appear publicly. Validation rejects unknown fields, blank or overlong strings, and non-HTTP(S) URLs.

## Scope and files

Changed `src/app.ts`; added `src/routes/profiles.ts`, `tests/integration/profiles.test.js`, `docs/api/M04-profiles.md`, and `postman/SAGE-M04.postman_collection.json`; updated milestone tracker, weekly report and AGENTS.md. No migration was needed. Skills/interests editing, instructor self-enrollment, verification decisions, and user account settings remain outside M04. Instructor role and profile are currently provisioned by a trusted operator.

## Endpoints and Postman

`GET /api/v1/profile/me`, `PATCH /api/v1/profile/me`, `GET /api/v1/instructors`, `GET /api/v1/instructors/:id`, and `PATCH /api/v1/instructors/me`. Exact method, URL, headers, bodies, expected success and error examples are in [the API contract](../api/M04-profiles.md) and [Postman collection](../../postman/SAGE-M04.postman_collection.json). The collection was prepared, not run in Postman. A LEARNER instructor update returns 403. A client supplied owner ID returns 400.

## Actual verification

`npm run typecheck` passed before final changes. First `npm run ci` failed in the new test fixture because a Prisma role assignment lacked the required user relation; fixed it. Final `npm run ci` passed: lint 0 errors, typecheck passed, Jest 2 suites/6 passed/0 failed/0 skipped, Mocha 17 passed/0 failed/0 skipped (including 3 M04 cases), and runtime smoke passed. Local PostgreSQL test migration check found no pending migrations. No live Postman requests were made.

## Security, blockers and learning notes

Private profile responses exclude password hashes and token data. Public instructor responses exclude email, phone, roles, verification status and account status. The role guard and owner scoped database update prevent cross-user edits. Public profiles need a trusted verification workflow before normal onboarding. Pagination is capped at 50 items and 100,000 offset. Validation is local to this module; it can be shared when more routes need it.

## Review and next prompt

PR description: Add authenticated learner and instructor profile editing, safe verified instructor detail/listing, field validation, owner checks, PostgreSQL integration tests, and API/Postman examples. Verification: `npm run ci` passed. Risk: instructor provisioning and verification remain trusted manual operations. Do not merge without review.

> Work on SAGE LMS backend as a junior developer. Execute **M05: Instructor course creation** only after M04 approval. Reuse the existing `Course`, `Category`, `CourseSection`, `Lesson` and `InstructorProfile` schema. Add category and course CRUD for authorized instructors, pricing (free/paid/discounted), curriculum and lesson structure, draft status, submit for approval, admin approval boundary, and ownership checks. Keep drafts private; reject unauthorized edits, invalid prices and duplicate slugs. Run lint, typecheck, Jest and Mocha; document exact Postman requests and expected responses; update API docs, weekly report and `docs/milestones/M05-summary.md`. Push a feature branch and prepare a draft PR. Stop for review without merging.
