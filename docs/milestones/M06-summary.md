# M06 — Public catalog, contact and newsletter

**Status:** Approved by the user on 2026-11-23; not merged. **Branch:** `feature/M06-public-catalog-contact-newsletter`. **PR:** [open, mergeable draft #6](https://github.com/Omegacarlos1/Sage-product/pull/6). M05 PR #5 merged into `main` on 2026-11-22 at 21:51 UTC.

## Objectives and implementation

Added published course search, category and level filters, stable pagination, slug or UUID detail lookup, and category and instructor summaries. Existing public category and verified instructor routes were reused. Draft courses remain hidden. Added reproducible fictional course and instructor seed data. Contact accepts validated messages with a per-IP hourly limit and a 90-day pruning command. Newsletter lowercases and trims email, relies on the existing PostgreSQL unique constraint, and returns 200 for duplicate requests including races.

## Files and database

Changed `src/routes/courses.ts`, `src/app.ts`, `prisma/seed.js`, `package.json`, `AGENTS.md`, the milestone tracker and weekly report. Added `src/routes/public-submissions.ts`, `scripts/prune-contact.js`, `tests/integration/public-m06.test.js`, `docs/api/M06-public.md`, `postman/SAGE-M06.postman_collection.json` and this summary. No migration: `subscribers.email` already has a database unique constraint and `contact_messages` already exists. No production data or migration was changed.

## API and Postman

The [M06 API contract](../api/M06-public.md) gives exact methods, URLs, headers, bodies, success and error examples. The [Postman collection](../../postman/SAGE-M06.postman_collection.json) includes list, search/filter, detail, contact valid/invalid, newsletter first/duplicate and invalid. Concurrent duplicate behavior was verified through two parallel Supertest requests. The user tested M06 in Postman and approved the milestone on 2026-11-23; individual Postman results and counts were not supplied. Frontend contract confirmation is pending.

## Actual verification

`npm run ci` passed on 2026-11-22: ESLint 0 errors; TypeScript passed; Jest 2 suites, 6 passed, 0 failed, 0 skipped; Mocha 23 passed, 0 failed, 0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. `npm run db:seed` passed twice against local `sage_lms_dev`, reporting 3 roles, 3 categories and 3 fictional courses each time. Test database had no pending migrations.

## Security, limitations and learning notes

Public list and detail require `PUBLISHED` and an active instructor account. Input validation rejects unknown filters and body fields. Public detail strips lesson resource URLs. Contact responses omit message contents, and errors do not log submitted data. Contact pruning must be scheduled by operations; it has not been run on production. Rate limits are per process and need a shared store before multiple replicas are deployed. Search currently covers title, description, category name and instructor name; dedicated skill/topic fields need product and schema decisions. No frontend team response was available, so endpoint shapes remain proposed. M05 PR #5 merged while M06 was being prepared; this PR can target `main`.

## PR description and next prompt

Draft PR description: Add public course filters and pagination, fictional seed data, validated contact submissions, idempotent newsletter subscriptions and API/Postman documentation. Tests: `npm run ci` passed with 6 Jest and 23 Mocha tests; seed run twice. Risks: per-process limits and unscheduled retention job; frontend contract unconfirmed. The user approved M06 on 2026-11-23. PR #6 remains a draft for team review and has not been merged.

> Work on the SAGE LMS backend as a junior developer, following the PRD and `SAGE_Revised_Backend_Milestones.docx`. Execute **M07: Media uploads and lesson access** only after M06 approval. Implement secure video/resource metadata, an approved storage adapter, file type and size checks, signed upload or access flow, and lesson access authorization. Do not store large videos in PostgreSQL. Verify unauthorized access denial, upload constraints and metadata consistency with lint, typecheck, Jest and PostgreSQL-backed Mocha tests. Document exact Postman requests and expected responses, update API docs and the weekly report, write `docs/milestones/M07-summary.md`, push a feature branch and prepare a draft PR. Stop for review; do not auto-merge.
