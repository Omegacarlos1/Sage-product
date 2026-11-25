# AGENTS.md — SAGE LMS backend

## Source of truth

Build the FULL SAGE LMS described in the original PRD, following `SAGE_Revised_Backend_Milestones.docx`. The assigned backend workstream does not replace authentication, enrollment, payments, quizzes, certificates, reviews, administration or other PRD features. Contact and newsletter modules are additional assigned scope; confirm API contracts with the team.

## Stack

Node.js LTS, Express, TypeScript strict, Socket.IO, PostgreSQL locally and in production, Prisma Migrate, Jest unit tests, Mocha/Chai/Supertest integration tests, Postman, GitHub PRs. Do not use XAMPP, MySQL or SQLite for PostgreSQL integration tests.

## Assigned responsibilities

Set up server and database; design courses, categories, instructors, contact_messages and subscribers, coordinating shared user/instructor relationships with other developers. Seed fictional courses. Build course listing, search, filtering, details, contact submission and newsletter subscribe APIs. Normalize newsletter emails and enforce a unique constraint to prevent concurrent duplicates. Implement validation, rate limiting, CORS, secure environment variables, logging, backups, API documentation, deployment and monitoring.

## Engineering rules

Inspect repository first. Use modular routes/controllers/services, `/api/v1`, Prisma migrations, centralized errors and structured logging. Keep secrets out of Git; commit `.env.example` placeholders. Validate inputs and authorization; never log sensitive messages or credentials. Do not run destructive production operations, live payments, deploy or merge without approval. Treat unspecified architecture and endpoint shapes as proposals.

## Every milestone

1. Read PRD, plan, previous summary and current code. Keep implementations appropriate for a junior developer: simple, readable, well-structured code with clear explanations, while maintaining security, testing and production standards.
2. Work only on approved milestone on `feature/mXX-topic`.
3. Run actual lint/typecheck, Jest and Mocha tests; record pass/fail/skip counts and commands, never invent results.
4. Supply Postman method, URL, headers, sample body, success and error examples; update API docs.
5. Write `docs/milestones/MXX-summary.md`: objectives, implemented/not implemented, changed files, endpoints, database changes, real tests, blockers, security, learning notes, PR status/link and ready-to-paste next milestone Codex prompt.
6. Open draft PR if authorized, otherwise explain why; do not auto-merge. Stop for approval.

## Weekly meeting update

Write `docs/reports/YYYY-MM-DD-backend-weekly.md` with reporting period, milestone, branch, PR, verified completed/in-progress/blocked tasks, evidence links/commit SHAs, actual test results, Postman demonstration, risks and next week's plan. Planning is not implementation; never invent progress.

## Definition of done

Reviewed implementation, verified tests, documented APIs and Postman cases, milestone summary and reviewable PR (or documented blocker), plus human approval.

## Current status

M01 and M02 are implemented. M03 authentication and role permissions and M04 profiles were merged into `main` on 2026-11-17 (PRs #3 and #4). Production password reset delivery and email verification need a team decision before activation. M05 instructor course creation passed PostgreSQL-backed CI, was approved after manual testing, and PR #5 merged into `main` on 2026-11-22. M06 was approved by the user on 2026-11-23 and PR #6 merged into `main` that day. Frontend contract confirmation and scheduling contact retention remain open.

M07 was approved by the user on 2026-11-23. It is implemented on `feature/M07-media-lesson-access`; draft PR #7 targets `main` and remains open, unmerged. Local PostgreSQL verification and the unresolved production storage decision are tracked in `docs/milestones/M07-summary.md`. The user approved M08 on 2026-11-23, and GitHub confirms PR #8 merged into `main` that day. M09 uses Paystack and NGN, was approved by the user on 2026-11-24, and [PR #9](https://github.com/Omegacarlos1/Sage-product/pull/9) merged into `main` that day after Backend CI passed. See `docs/milestones/M09-summary.md`. The local `origin/main` ref contains M10's merge commit `898ccdf`; M11 was requested by the user on 2026-11-24 and is implemented on `feature/M11-quizzes-assessments` for review. See `docs/milestones/M11-summary.md`. Do not start M12 before M11 approval.

## Git and GitHub Development Workflow

All backend development must follow a milestone-based Git workflow.

### Branch Management

- The main branch represents reviewed and accepted work.
- Each milestone must be developed on a separate feature branch.
- Branch naming convention: feature/B01-backend-foundation, feature/B02-authentication, etc.
- Never push unfinished milestone changes directly to main.

### Commit Standards

Use clear, descriptive conventional commits.

Examples:

- chore: configure Express and TypeScript
- feat: implement database connection
- test: add health endpoint integration tests
- docs: update B01 milestone summary
- fix: resolve database migration error

### GitHub Push Requirements

- Make small commits after completing meaningful tasks.
- Push the current feature branch to GitHub after successful local verification.
- Never commit .env, API keys, database passwords or other secrets.
- Never force-push or overwrite remote changes without explicit approval.
- Do not automatically merge a feature branch into main.

### Milestone Completion

At the end of each milestone:

1. Run lint, type checking and relevant automated tests.
2. Generate the milestone summary and actual test results.
3. Update the Postman collection and API documentation.
4. Update the milestone tracker and AGENTS.md.
5. Commit the completed milestone work.
6. Push the feature branch to GitHub.
7. Provide a pull request description with changes, tests, risks and remaining issues.
8. Wait for explicit milestone approval before merging or starting the next milestone.

### Safety Rules

Before performing Git operations, inspect the current branch, working tree and remote configuration. Preserve unrelated changes. Never automatically delete branches, discard uncommitted work or force-push.
