# M01 — Backend foundation

**Status:** Implemented; awaiting review

**Branch:** `feature/M01-backend-foundation`

**Implementation commit:** `3d8b6a2` (`feat: add M01 backend foundation`)

**Scope source:** M01 prompt, `AGENTS.md`, revised backend milestone plan, and original PRD. The PRD describes the full LMS; M01 establishes only the shared backend foundation.

## Objectives and outcome

- [x] Set up Node.js/npm, Express, strict TypeScript, Socket.IO, structured folders, configuration, centralized errors, npm scripts, linting, and CI.
- [x] `GET /api/v1/health` returns stable JSON; unknown paths return a structured 404.
- [x] Configuration rejects invalid environment or port values without echoing them.
- [x] HTTP and Socket.IO server can be started and closed cleanly; SIGINT/SIGTERM initiate shutdown.
- [x] Add Postman examples and API documentation.
- [ ] PostgreSQL, Prisma, authentication, course and other LMS features: not in M01; no database or business routes are implemented yet.

## Changed files

- `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `.env.example`, `.github/workflows/ci.yml`
- `src/app.ts`, `src/server.ts`, `src/config/env.ts`
- `tests/unit/env.test.js`, `tests/integration/health.test.js`, `tests/runtime-smoke.js`
- `README.md`, `postman/SAGE-M01.postman_collection.json`
- `AGENTS.md`, `docs/milestones/README.md`, this summary, and the weekly report

## API and Postman scenarios

Base URL: `http://localhost:3000`. Collection: `postman/SAGE-M01.postman_collection.json`.

### Health success

- **Method / URL:** `GET http://localhost:3000/api/v1/health`
- **Headers:** `Accept: application/json`
- **Body:** none
- **Expected status:** `200 OK`
- **Expected response:** `{"status":"ok","service":"sage-api","version":"v1"}`

### Unknown route

- **Method / URL:** `GET http://localhost:3000/api/v1/not-a-route`
- **Headers:** `Accept: application/json`
- **Body:** none
- **Expected status:** `404 Not Found`
- **Expected response:** `{"error":{"code":"NOT_FOUND","message":"Route not found."}}`

The Postman collection is prepared but has not been run in the Postman application. Equivalent HTTP scenarios were exercised by the Mocha/Supertest integration suite; no live Postman results are claimed.

## Verification evidence

All checks were run locally with Node `v24.19.0` and npm `11.17.0`:

| Command | Result |
| --- | --- |
| `npm run lint` | Pass; 0 errors |
| `npm run typecheck` | Pass; strict TypeScript, 0 errors |
| `npm run test:unit` | Jest: 1 suite passed, 3 tests passed, 0 failed |
| `npm run test:integration` | Mocha: 4 passing, 0 failing (health, 404, malformed JSON, server startup/shutdown) |
| `npm run test:runtime` | Pass; process health, stop request, invalid-config exit and no value leakage |
| `npm run ci` | Pass; includes lint, typecheck, Jest, Mocha/Supertest, and runtime smoke checks |
| `npm audit --omit=dev` | 0 production dependency vulnerabilities |
| `npm audit` | Reports 28 development dependency findings (4 low, 23 moderate, 1 high); npm says remediation requires forceful version changes. No forced downgrade was applied. |

## Security and implementation notes

- `.env` is ignored by Git; `.env.example` contains placeholders only.
- `PORT` and `NODE_ENV` are validated before listening. Error messages do not print supplied environment values.
- CORS defaults to the local frontend origin and can be configured with a comma-separated allowlist.
- JSON request bodies are capped at 100 KB. Malformed JSON returns a generic `400`; unexpected errors return a generic `500` and a structured log without request data.
- The production dependency audit is clean. The development-only audit findings are recorded above for review; all current M01 checks pass.

## Beginner notes

- `src/config/env.ts` is the single place that checks server settings before startup.
- `src/app.ts` defines HTTP routes and shared error responses. `src/server.ts` attaches Socket.IO to the same HTTP server and closes both during shutdown.
- Jest checks configuration parsing; Mocha/Supertest checks HTTP behavior and server lifecycle. This separation makes the tests easy to run independently.
- The local verification ran on Windows. Its child-process SIGTERM smoke check confirms process termination; the Mocha lifecycle test verifies that the HTTP and Socket.IO close function finishes cleanly. CI is configured to repeat the runtime check on Ubuntu.

## Blockers and PR status

- No implementation blocker. No PR has been opened because the supplied instructions say to open a draft PR only when authorized; no separate authorization to create the external PR was provided.
- The verified implementation is committed as `3d8b6a2` and the verification report as `b5a5321`. The branch was pushed to `origin` after local verification.
- GitHub provided the [create-PR page](https://github.com/Omegacarlos1/Sage-product/pull/new/feature/M01-backend-foundation). No PR has been opened.

### Ready-to-paste draft PR description

**Title:** `feat: add M01 backend foundation`

**Summary:** Add the Express and strict TypeScript server foundation, shared Socket.IO server, validated runtime configuration, CORS baseline, stable health endpoint, structured errors, npm scripts, linting, and GitHub Actions CI. Add Jest and Mocha/Supertest coverage, Postman examples, and M01/weekly documentation.

**Verification:** `npm run ci` passed locally on Node 24.19.0. Jest: 3 passed. Mocha: 4 passing. Production dependency audit: 0 findings. The full audit reports development-only findings documented in the M01 summary.

**Risks / follow-up:** No database/business APIs are included; they remain in later milestones. Review the reported development-tool advisories and coordinate schema decisions in M02. No live services or production systems were used.

## Ready-to-paste next prompt: M02

> Work on the SAGE LMS backend as a junior developer. Execute **Milestone M02: PostgreSQL schema, Prisma migrations and test database** only, after M01 review approval.
>
> Read `AGENTS.md`, the original PRD, the revised milestone plan, and `docs/milestones/M01-summary.md`; inspect the current branch and code. Work on `feature/M02-postgres-schema` from the reviewed M01 baseline. Configure PostgreSQL for local development and a separate test database. Add Prisma and migrations for the full PRD data model, including users, roles, learner/instructor profiles, courses, categories, curriculum, enrollments, payments, quiz attempts, certificates, reviews, contact messages, and subscribers. Coordinate shared user/instructor relationships and treat unspecified schema choices as proposals. Include reproducible seed setup and a backup/restore plan. Do not connect to production or run destructive migrations.
>
> Acceptance criteria: a fresh local PostgreSQL database migrates successfully; constraints and relationships are verified; tests use an isolated PostgreSQL test database; backup and restore steps are documented.
>
> Run lint, typecheck, Jest, Mocha/Supertest, and migration checks; record real results. Update the Postman examples, API documentation, milestone tracker, `AGENTS.md`, `docs/milestones/M02-summary.md`, and weekly report. Commit and push only after successful local verification. Prepare a draft PR description, do not merge, and stop for review.
