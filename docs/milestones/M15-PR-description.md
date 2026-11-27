## Summary

Implements M15 admin only management of users and instructors, course approval/rejection, transaction overview, basic analytics and a PostgreSQL backed append only admin audit. Keeps the existing course approval route and adds audit coverage to it.

## Verification

`npm run ci`: lint and typecheck passed; Jest 3 suites/7 tests passed; Mocha 51 passed against local PostgreSQL `sage_lms_test`; runtime smoke passed. The M15 test migration applied locally. Postman cases are documented but were not manually run.

## Risks and open decisions

Audit fixture cleanup uses `TRUNCATE` only on the isolated test database. Production database migration has not run. Rejected course and instructor retry/appeal policy, rejection reasons, transaction retention, and finance policy require team decisions. Gross NGN analytics are payment record totals, not provider settlement or payable instructor balance. No live refund or payout execution was added.

## Review focus

Verify admin role enforcement, conditional approval transitions, transaction and audit output, and migration behavior. Do not merge until human approval.
