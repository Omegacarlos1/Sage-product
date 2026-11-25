# M11 — Quizzes and assessments

**Status:** Implemented on `feature/M11-quizzes-assessments` for human review. M10's merge commit `898ccdf` is present in the local `origin/main` ref; this M11 branch was created from that ref. No production migration, deployment, live payments, or merge occurred.

## Objectives and implementation

An owning instructor can create a quiz with ordered questions and options on a draft course. Learners with active enrollment and payment entitlement can read its safe content, start an attempt, submit one answer set per question, and read their saved result. Supported question types are single choice, multiple choice, and true/false. Short answer is present in the preexisting schema but is not enabled because deterministic text grading rules are not agreed. Quiz content and answer keys cannot be edited through this API after creation. The API never sends correct flags or answer IDs before submission.

`attemptLimit` counts all started attempts, including expired ones. A learner cannot start another attempt while one is active. PostgreSQL advisory transaction locking serializes concurrent starts for the same learner and quiz. Optional `opensAt` and `closesAt` constrain starts; `closesAt` and optional per-attempt `timeLimitSeconds` constrain submissions. A correct question requires the exact complete set of correct option IDs; there is no partial credit. Points are summed, percentage is rounded to two decimals, and the pass threshold is applied to that percentage. Results are saved and available only to the owning, still entitled learner.

## Files and database

`src/routes/quizzes.ts` and `src/app.ts` implement routes. `prisma/schema.prisma` and migration `20261124150000_m11_quizzes` add optional quiz opening/closing instants, UUID array answer selections, and database checks for threshold, limits and window order. Existing quiz, question, option and attempt tables are reused. `tests/integration/quizzes-m11.test.js` exercises access, answer secrecy, start and attempt limit, exact-set scoring, malformed answers, duplicate submission, and availability windows. [API contract](../api/M11-quizzes.md), [Postman collection](../../postman/SAGE-M11.postman_collection.json), tracker, this summary, weekly report, and `AGENTS.md` were updated. The preexisting edit to `docs/reports/2026-11-13-backend-weekly.md` was preserved and excluded from M11.

## Actual verification

Final `npm run ci` passed: ESLint 0 errors; strict TypeScript typecheck passed; Jest 3 suites, 7 passed/0 failed/0 skipped; Mocha 40 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:migrate:test` applied the M11 migration on the first run and had no pending migrations on the final run. The first full run had 21 passing and 13 failing Mocha cases because quiz authentication was applied to unrelated routes and the M11 UUID regex had an extra group. The next full run had 39 passing and two failures caused by incorrect test expectations and cleanup order. Those were fixed; the focused M11 run passed 3 tests and the final full CI run passed. Postman was not manually run; its responses are expected examples.

## API, security, and limitations

The [API contract](../api/M11-quizzes.md) provides method, URL, headers, exact bodies, success and error examples for authoring, reading, starting, submitting, viewing results, and reaching the attempt limit. All learner routes use bearer identity and active course entitlement. Authoring checks instructor ownership and draft course state. Input lengths, counts, IDs, options, points, thresholds and dates are bounded and validated. No credentials or learner answers are logged.

The quiz configuration is frozen through the public API, but direct database writes could change it during an attempt; a future administrative edit workflow would need versioning or snapshotting. The current API requires all questions to be answered on submission. A timed-out attempt is marked `EXPIRED` when submitted late; an abandoned attempt remains stored as `IN_PROGRESS` but is treated as expired when checking a new start. The course publishing flow does not yet require a quiz. Frontend contract confirmation remains open. Test PostgreSQL was migrated during implementation. Local development PostgreSQL was migrated on 2026-11-25 after a manual Postman quiz-create request returned `500`; production was not migrated.

## Manual testing follow-up — 2026-11-25

The user's `POST /api/v1/courses/{courseId}/quizzes` body was valid, but the local development database lacked migration `20261124150000_m11_quizzes`. `npm run db:migrate:status` showed it pending for `sage_lms_dev`. `npm run db:migrate:dev:apply` applied it successfully, and a second `npm run db:migrate:status` reported “Database schema is up to date!” No application code changed. The exact Postman request has not been rerun by the agent; the user should retry it against the local server. This follows the earlier test-database migration and corrects the prior report that development had not been migrated.

## PR and next prompt

[Draft PR #13](https://github.com/Omegacarlos1/Sage-product/pull/13) targets `main` and remains open, unmerged. Implementation commit: `26a874e`; PR description commit: `4f010f4`. M11 needs review and human approval before merge. No M12 work has started.

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, and `docs/milestones/M11-summary.md`; inspect branch, working tree, and schema. After M11 approval, work only on **M12: Certificates and verification** on `feature/M12-certificates-verification`. Define issuance eligibility using required lesson progress and assessment results, generate verifiable certificates with unique identifiers, provide learner download and public verification without leaking private data, and test authorization, repeat issuance, and eligibility edge cases against PostgreSQL. Update API docs and exact Postman scenarios, run lint/typecheck/Jest/Mocha, write the M12 summary and weekly report, push a reviewable draft PR, and stop for approval without merging.
