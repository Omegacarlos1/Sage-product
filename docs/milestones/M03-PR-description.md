## Changes

- Add PostgreSQL tables for hashed opaque sessions and single-use password reset tokens.
- Implement learner signup, login, token rotation, logout, protected identity and admin permission check.
- Add local password reset flow, API contract, Postman collection, and Jest/Mocha coverage.

## Verification

- `npm run ci`: lint and strict typecheck passed; Jest 6 passed; Mocha 14 passed; runtime smoke passed.
- `npm run db:migrate:dev:apply`: passed on local development PostgreSQL.
- Postman collection prepared but not executed in Postman.

## Risks and decisions

- Production reset requests return 503 until an email sender and delivery policy are approved.
- Email verification and social providers need team decisions.
- Auth rate limiting remains a deployment risk and is scheduled for M17.
- M03 awaits human review; do not merge automatically.
