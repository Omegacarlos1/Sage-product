# M13: Reviews and ratings

## Changes

- Permit eligible enrolled learners to create one review per course and edit their visible review.
- Validate integer ratings from 1 to 5 in the API and PostgreSQL.
- List visible reviews with a consistent average/count and limited reviewer identity.
- Add admin hide/restore controls and moderation reason storage.
- Add PostgreSQL integration tests, API contract, Postman scenarios, milestone summary, tracker, and weekly update.

## Verification

`npm run ci` passed: ESLint, TypeScript, Jest 7/0/0, Mocha 45/0/0 on local `sage_lms_test`, runtime smoke. Eight migrations present; M13 migration applied to test database. Postman cases are prepared, not manually run. An earlier run hit a timeout in an existing M03 test; the integration rerun and final CI run passed.

## Risks and decisions

M12 PR #15 has merged into `main`. Confirm whether refunds should hide existing reviews, whether course completion is required, and the moderation appeal process. No production migration, deployment, or merge performed.
