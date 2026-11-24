# M10 — Learning progress

**Status:** Implemented on `feature/M10-learning-progress`; awaiting human review. M09 was approved and PR #9 merged on 2026-11-24. No production migration, deployment or merge was performed for M10.

## Objectives and implementation

Learners with active, entitled enrollment can record lesson completion, bookmarks, a private note and playback position, set a course resume lesson, and read an aggregate. Completion is permanent and repeated completion retains its timestamp. Aggregate progress counts only instructor designated required lessons; the default is required. Optional lessons are shown but excluded from the denominator. The aggregate is calculated from current lesson records and progress at read time. A course with no required lessons is not complete. Course enrollment status is not automatically changed; M12 certificates must use the aggregate and later assessment rules.

## Changed files and database

`src/routes/progress.ts` and `src/app.ts` add the three routes. `src/routes/courses.ts` lets an instructor set `isRequired` in a draft curriculum. `prisma/schema.prisma` and migration `20261124120000_m10_learning_progress` add `lessons.isRequired`, `lesson_progress.bookmarked` and `note`, and `enrollments.resumeLessonId`. `tests/integration/progress-m10.test.js`, [API contract](../api/M10-learning-progress.md), [Postman collection](../../postman/SAGE-M10.postman_collection.json), milestone tracker, weekly report, and `AGENTS.md` were updated. The preexisting unrelated change to `docs/reports/2026-11-13-backend-weekly.md` was preserved. The migration applied to local `sage_lms_test`; it has not been applied to development or production.

## API and Postman

Proposed routes: `PUT /api/v1/lessons/:id/progress`, `GET /api/v1/courses/:id/progress`, `PUT /api/v1/courses/:id/resume`. Exact methods, bearer and JSON headers, sample bodies, success and error examples are in the [API contract](../api/M10-learning-progress.md). Postman has mark complete, progress, resume and unauthorized requests. Postman was not run manually; examples are expected responses, not live results. Frontend contract confirmation remains open.

## Actual verification

Final `npm run ci` passed: ESLint 0 errors; strict TypeScript typecheck passed; Jest 3 suites, 7 passed/0 failed/0 skipped; Mocha 37 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:migrate:test` found no pending migration on the final run after applying M10 on the first run. The first CI run failed 17 Mocha cases because authentication was accidentally applied to all `/api/v1` routes. After scoping authentication, the next run had 33 passing and 4 failing M10 cases due to an extra UUID regex group. Both errors were corrected before the final passing run. The four M10 tests verify ownership, repeat completion, required lesson counts, resume membership and validation.

## Security, blockers and learning notes

Identity comes from the bearer session, and every route checks active enrollment and paid entitlement. Request bodies cannot choose a learner ID. Notes are returned only to the owner and are not logged. Position and note length are bounded. `resumeLessonId` is validated against the course in the route; the database field is not a foreign key, so direct database writers must preserve that invariant. Instructor curriculum editing is restricted to drafts by existing course routes. Concurrent updates to the same bookmark, note or position use last writer wins semantics; no merge policy has been agreed. Production storage and frontend contract decisions from prior milestones remain open.

## PR and next prompt

[Draft PR #11](https://github.com/Omegacarlos1/Sage-product/pull/11) targets `main` and remains open, unmerged. Implementation commit: [`e08aa59`](https://github.com/Omegacarlos1/Sage-product/commit/e08aa59ce6c98ed4561cd1f3153345ae4c095e53). Review is required before merge. Do not start M11 before M10 approval.

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, and `docs/milestones/M10-summary.md`; inspect branch and schema. After M10 approval, work only on **M11: Quizzes and assessments** on `feature/M11-quizzes-assessments`. Implement quiz, question and option management, attempt limits, time windows, deterministic scoring and pass thresholds. Never expose correct answers before submission. Enforce learner entitlements and instructor ownership; test attempts, timing, scoring and unauthorized access against PostgreSQL. Update API docs and exact Postman scenarios, run lint/typecheck/Jest/Mocha, write the M11 summary and weekly report, push a reviewable draft PR, and stop for approval without merging.
