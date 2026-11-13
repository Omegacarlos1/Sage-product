# M02 — PostgreSQL schema, Prisma migrations and test database

**Status:** Implemented and locally verified; awaiting review.

**Branch:** `feature/M02-postgres-schema`

**Baseline:** M01 branch commit `5c4c822` (`updated commit`, including the tracked `.gitignore`). M02 commit SHA will be added after the implementation commit.

**Scope source:** `AGENTS.md`, the original PRD, revised backend milestone plan, M02 prompt, and M01 summary. Schema choices are proposals recorded in `docs/database/schema-decisions.md`.

## Objectives and outcome

- [x] Configure Prisma 7.10.1 with PostgreSQL adapter and strict typed client generation.
- [x] Add the full M02 storage schema and a versioned PostgreSQL migration.
- [x] Apply the migration to fresh local `sage_lms_dev` and isolated `sage_lms_test` databases.
- [x] Prove PostgreSQL connection, unique subscriber email constraint, and enrollment foreign keys against `sage_lms_test`.
- [x] Add an idempotent development seed for roles and categories; course sample data remains M06 scope.
- [x] Add a safe database health endpoint and controlled-unavailable response.
- [x] Document backup/restore commands and schema decisions.
- [x] Create the configured `sage_lms_shadow` database and verify `npm run db:migrate:dev` against the reviewed schema.
- [ ] Run and verify a backup/restore drill. M02 defines the local procedure; production backup scheduling and restore drills remain M18.

## Database changes

Added 24 tables: `users`, `roles`, `user_role_assignments`, `learner_profiles`, `instructor_profiles`, `categories`, `courses`, `course_sections`, `lessons`, `enrollments`, `payments`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, `assignments`, `assignment_submissions`, `certificates`, `reviews`, `lesson_progress`, `contact_messages`, `subscribers`, and `notifications`.

The schema also adds typed enums, foreign keys, indexes, unique email/slug constraints, one enrollment per learner/course, one review per user/course, one certificate per enrollment, and one subscriber row per email. Subscriber normalization and concurrency-safe API handling remain M06 behavior; authentication, payments, assessments, progress, and notifications remain later milestone behavior.

The versioned migration is `prisma/migrations/20261113130000_initial_schema/migration.sql`. It was generated from the validated schema without connecting to a database, then applied using Prisma Migrate to both local databases.

## Changed files

- `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `.github/workflows/ci.yml`, `eslint.config.mjs`
- `prisma/schema.prisma`, `prisma.config.ts`, `prisma.test.config.ts`, `prisma/migrations/migration_lock.toml`, `prisma/migrations/20261113130000_initial_schema/migration.sql`, `prisma/seed.js`
- `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/services/database.ts`
- `tests/unit/env.test.js`, `tests/integration/health.test.js`, `tests/integration/database.test.js`, `tests/runtime-smoke.js`, `scripts/check-databases.js`
- `README.md`, `docs/api/M02-database-health.md`, `docs/database/README.md`, `docs/database/schema-decisions.md`, `postman/SAGE-M02.postman_collection.json`
- `AGENTS.md`, `docs/milestones/README.md`, this summary, and the weekly report

## API and Postman scenarios

Base URL: `http://localhost:3000`. Collection: `postman/SAGE-M02.postman_collection.json`. No authentication header or request body is required.

### Database health success

- **Method / URL:** `GET http://localhost:3000/api/v1/health/database`
- **Headers:** `Accept: application/json`
- **Body:** none
- **Expected:** `200 OK`
- **Response:** `{"status":"ok","service":"sage-api","database":"connected"}`

### Database unavailable

Run a separate local API process with a syntactically valid but unreachable local `DATABASE_URL`; send the same request.

- **Expected:** `503 Service Unavailable`
- **Response:** `{"error":{"code":"DATABASE_UNAVAILABLE","message":"Database connection unavailable."}}`

The route logs only a generic warning and does not return driver errors or connection data. The Postman collection is prepared but has not been executed in Postman. Its success and safe-failure behavior were exercised through Mocha/Supertest.

## Verification evidence

All commands below ran on Node `v24.19.0`, npm `11.17.0`, and local PostgreSQL 18. The real connection strings remain only in the ignored local `.env`.

| Command | Result |
| --- | --- |
| `node_modules\\.bin\\prisma.cmd validate` | Pass; schema valid. |
| `npm ci` | Pass from the committed lockfile; 657 packages installed. npm reported 28 development dependency findings. |
| `npm run lint` | Pass; 0 errors. |
| `npm run typecheck` | Pass; Prisma Client generated and TypeScript strict check passed. |
| `npm run test:unit` | Jest: 1 suite passed, 4 tests passed, 0 failed. |
| `npm run test:integration` | Pass; migrations current on test DB; Mocha: 9 passing, 0 failing (3 real PostgreSQL checks and 6 API/server checks). |
| `npm run test:runtime` | Pass; process health, stop request, and invalid configuration checks. |
| `npm run ci` | Pass; includes lint, typecheck, Jest, PostgreSQL-backed Mocha/Supertest, and runtime checks. |
| `npm run db:migrate:dev:apply` | Pass; applied the committed initial migration to fresh `sage_lms_dev`. |
| `npm run db:migrate:test` | Pass; applied the same migration to fresh `sage_lms_test`; later run reported no pending migrations. |
| `npm run db:migrate:status` | Pass; development schema up to date. |
| `npm run db:seed` | Pass; idempotent seed added 3 roles and 3 categories to `sage_lms_dev`. |
| `npm run db:check` | Pass; development, test, and shadow databases connected. |
| `npm run db:migrate:dev` | Pass after credentials and shadow DB were corrected; Prisma reported the dev database in sync with no pending migration. Earlier attempts before the credential correction failed with a generic engine error. |
| `npm audit --omit=dev` | 0 production dependency vulnerabilities after compatible `npm audit fix` updates. |
| `npm audit` | 28 development-tool findings remain (4 low, 23 moderate, 1 high); npm offers only forceful version changes for those findings. No forced downgrade was applied. |

## Security and operational notes

- `.env` stays ignored; `.env.example` contains only placeholders. No database credential was printed or committed.
- Prisma development migration config restricts local development migration targets to `sage_lms_dev` and `sage_lms_shadow`. The test migration config and integration suite restrict tests to local `sage_lms_test`.
- `npm run db:check` reports database names and safe error codes only. The seed script refuses non-local targets and only writes to `sage_lms_dev`.
- The health check runs a fixed `SELECT 1` with a 3-second connection timeout. API errors do not expose driver messages or credentials.
- The restore procedure in `docs/database/README.md` is documented but not executed. No production database or data was used.

## Beginner notes

- `prisma/schema.prisma` describes the tables and relationships; the SQL migration is the reviewed set of database changes.
- `npm run db:migrate:dev:apply` applies already-reviewed migrations without generating new SQL. `npm run db:migrate:dev` uses the separate shadow database to detect schema changes before making a new migration.
- The application uses a pool-backed Prisma client. Integration tests connect only to `sage_lms_test`, insert disposable data, and clean it up.
- Database connection strings are private local configuration. If a password contains URL-reserved characters, encode them before placing it in `.env`.

## Blockers and PR status

- No implementation blocker. Dev, test, and shadow DB connections are verified. The local backup/restore procedure is documented but no restore drill was run.
- No external PR has been opened because separate authorization to create one was not provided. After branch publication, GitHub's PR creation page will be linked here.

### Ready-to-paste draft PR description

**Title:** `feat: add M02 PostgreSQL schema and migrations`

**Summary:** Add Prisma/PostgreSQL schema, a versioned initial migration, separate dev/test Prisma configs, safe database health endpoint, guarded role/category seed, local database check and backup/restore guidance, plus PostgreSQL CI and integration tests.

**Verification:** `npm run ci` passed locally: Jest 4 passed, Mocha 9 passed. Migration applied to fresh local dev and test databases. `npm audit --omit=dev` found 0 production vulnerabilities.

**Risks / follow-up:** Full npm audit retains development-only findings described in the M02 summary. No production migration, backup restore, payment, or business API was performed.

## Ready-to-paste next prompt: M03

> Work on the SAGE LMS backend as a junior developer. Execute **Milestone M03: Authentication and role permissions** only, after M02 review approval.
>
> Read `AGENTS.md`, the original PRD, the revised backend plan, and `docs/milestones/M02-summary.md`; inspect the current branch and schema. Work on `feature/M03-authentication` from the reviewed M02 baseline. Implement signup, login, logout, password-reset request/complete, secure password hashing, verification/session or token handling, and role authorization using the existing shared `User` and `Role` relationships. Coordinate email verification and social login requirements before adding providers. Never duplicate user/instructor records or expose password hashes, reset tokens, quiz answers, or private profile fields.
>
> Acceptance criteria: password storage is secure; invalid credentials and unauthorized role access are rejected; reset tokens expire and cannot be reused; tests use isolated PostgreSQL; error responses do not reveal account secrets.
>
> Provide Postman requests for signup, login, invalid credentials, protected route, and logout. Run lint, typecheck, Jest, Mocha/Supertest, and relevant migration checks; record real results. Update API docs, milestone tracker, `AGENTS.md`, `docs/milestones/M03-summary.md`, and weekly report. Commit and push after local verification. Prepare a draft PR description, do not merge, and stop for review.
