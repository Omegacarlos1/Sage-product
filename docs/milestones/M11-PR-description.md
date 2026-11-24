## Changes

- Add draft-only quiz authoring with ordered questions, options, attempt limits, time limits, open/close windows and pass thresholds.
- Add entitled learner read, start, submit and result routes. Keep answer keys private until submission.
- Save exact-set scoring and selected options in PostgreSQL. Serialize concurrent starts per learner and quiz.
- Document the API and Postman scenarios; update the weekly report and milestone tracker.

## Verification

`npm run ci` passed locally: lint 0 errors, strict typecheck, Jest 7 passed/0 failed/0 skipped, Mocha 40 passed/0 failed/0 skipped against local `sage_lms_test`, and runtime smoke passed. The M11 test migration applied successfully. Postman examples are documented but were not manually run.

## Risks and remaining decisions

Direct database edits to a published quiz could change scoring content during an attempt; the API has no quiz editing route. Short-answer grading is deferred pending deterministic rules. Development and production databases have not been migrated. Frontend contract confirmation remains open.

Review [M11 summary](M11-summary.md) and [API contract](../api/M11-quizzes.md). Please keep this PR as a draft until human review and milestone approval.
