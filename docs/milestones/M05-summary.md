# M05 — Instructor course creation

**Status:** Approved by the user on 2026-11-22; not merged. **Branch:** `feature/M05-instructor-course-creation`. **PR:** [draft #5](https://github.com/Omegacarlos1/Sage-product/pull/5). Implementation commit: `24db402`.

## Objectives and implementation

Added instructor-owned category CRUD and draft course CRUD, full curriculum replacement, free/paid/discounted pricing, submission for review and an admin-only approval endpoint. Public course list/detail return only published courses; public detail omits lesson resource URLs. Authoring requires M03 bearer auth. Course creation requires an `INSTRUCTOR` role and verified instructor profile. Draft edits and deletion are limited to the owning instructor. In-review courses are locked until an admin publishes them. Category edits/deletes are limited to their creator or an admin; categories in use cannot be deleted.

## Files and database

Changed `prisma/schema.prisma`, `src/app.ts`, this tracker and `AGENTS.md`; added `prisma/migrations/20261122090000_m05_courses/migration.sql`, `src/routes/courses.ts`, `tests/integration/courses.test.js`, `docs/api/M05-courses.md`, `postman/SAGE-M05.postman_collection.json` and `docs/reports/2026-11-22-backend-weekly.md`. Migration adds nullable category owner and nullable course discount price, an owner index, foreign key, and a price check constraint. Nullable owner keeps existing shared categories compatible. No production migration was run.

## API and Postman

Endpoints and exact method, URL, headers, body and expected responses are in [M05 API contract](../api/M05-courses.md). Postman scenarios for category creation, draft creation, curriculum replacement, submission, unauthorized update and admin approval are in [the collection](../../postman/SAGE-M05.postman_collection.json). The user reported testing M05 in Postman and approved the milestone on 2026-11-22; individual Postman results and counts were not supplied. HTTP integration tests exercised the flows.

## Actual verification

Final `npm run ci` passed against local `sage_lms_test`: ESLint 0 errors; TypeScript passed; Jest 2 suites, 6 passed, 0 failed, 0 skipped; Mocha 20 passed, 0 failed, 0 skipped, including 3 M05 cases; runtime smoke passed. The M05 migration was applied on the first run; the final run found no pending migrations.

## Security, blockers and learning notes

Input validation rejects unknown fields, invalid prices, duplicate slugs and invalid curriculum structure. Unique indexes enforce slug uniqueness under concurrent requests. The database check constraint enforces price relationships. Ownership and status are checked on writes. Category hierarchy cycle checks and a full admin review queue are future work; M05 provides the approval boundary only. Replacing curriculum deletes old sections and lessons, so this operation is restricted to drafts. M07 must implement media access before accepting real lesson resource URLs. Frontend and backend teams should confirm these proposed endpoint and pricing contracts.

## PR description and next prompt

Draft PR description: Add category and draft course authoring, discounted pricing, curriculum management and admin approval boundary. Test: `npm run ci` passed against local PostgreSQL; user reported manual Postman testing. Risks: category hierarchy cycles and concurrent status changes need review; public catalog is minimal until M06. PR #5 targets `main` and includes unmerged M03/M04 work; it must await those reviews before merge.

> Work on SAGE LMS backend as a junior developer. Execute **M06: Public course catalog, contact and newsletter** only after M05 approval. Implement published course list and detail, keyword/category/level filters and pagination, reproducible fictional seed data, validated and rate-limited contact submission, and normalized newsletter subscriptions with a database unique constraint and concurrency-safe duplicate handling. Confirm API contracts with frontend. Run lint, typecheck, Jest and Mocha against local PostgreSQL. Document exact Postman requests and expected responses, update API docs, weekly report and `docs/milestones/M06-summary.md`, push a feature branch and prepare a draft PR. Stop for review without merging.
