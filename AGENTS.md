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
Scope and responsibility plan prepared; actual repository implementation has not been verified.
