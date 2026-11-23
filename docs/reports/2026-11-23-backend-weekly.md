# SAGE LMS backend weekly update — 2026-11-23

**Reporting period:** 2026-11-22 to 2026-11-23. **Milestone:** M06 public catalog, contact and newsletter. **Branch:** `feature/M06-public-catalog-contact-newsletter`. **PR:** [open, mergeable draft #6](https://github.com/Omegacarlos1/Sage-product/pull/6).

## Verified complete

M06 implementation was committed as `b88c21f`, with documentation follow-ups `9089e2e` and `5183091`. Published catalog search/filter/pagination, contact validation and per-process limits, newsletter duplicate handling, and fictional seed data are documented in the [M06 summary](../milestones/M06-summary.md) and [API contract](../api/M06-public.md). The user approved M06 on 2026-11-23 after manual Postman work; individual Postman results and counts were not supplied. PR #6 is still a draft and has not been merged.

## Actual tests and Postman demonstration

The last `npm run ci` passed: lint 0 errors, typecheck passed, Jest 6 passed/0 failed/0 skipped in 2 suites, Mocha 23 passed/0 failed/0 skipped against local PostgreSQL, runtime smoke passed. `npm run db:seed` passed twice against `sage_lms_dev`. No new automated test run was performed solely for the approval record.

The [Postman collection](../../postman/SAGE-M06.postman_collection.json) defines course list/search/filter/detail, contact valid/invalid, and newsletter first/duplicate cases. In this conversation, the user reported a contact validation response caused by Postman raw body being set to Text, and the JSON setting was explained. No complete manual Postman result log was supplied.

## In progress, blockers, risks and next week

Frontend contract confirmation remains open. The contact retention command needs an operations schedule, and the per-process rate limiter needs a shared store before multiple replicas. Next week: team review of PR #6 and the proposed API contract. Begin M07 only after the milestone workflow permits it; do not merge or deploy without separate approval.

## M07 update on 2026-11-23

**Branch:** `feature/M07-media-lesson-access`, based on approved M06. **PR:** [Draft #7](https://github.com/Omegacarlos1/Sage-product/pull/7) targets `main`; M06 PR #6 merged before draft creation. M07 added private media storage, signed upload/download URLs, metadata and a PostgreSQL migration, validation, and lesson access authorization. Evidence: commit [`15df980`](https://github.com/Omegacarlos1/Sage-product/commit/15df980), [M07 summary](../milestones/M07-summary.md), [API contract](../api/M07-media.md), and [Postman collection](../../postman/SAGE-M07.postman_collection.json). The local M07 migration was applied to `sage_lms_test`; no production migration or deployment occurred.

The final `npm run ci` passed lint with 0 errors, typecheck, Jest 6 passed/0 failed/0 skipped, Mocha 26 passed/0 failed/0 skipped against local PostgreSQL, and runtime smoke. Postman itself was not run for M07. Demonstration requests: instructor `POST /api/v1/lessons/{id}/media/upload-request` with JSON `{"fileName":"intro.mp4","contentType":"video/mp4","sizeBytes":12}` expects `201`; unenrolled learner `GET /api/v1/lessons/{id}/access` expects `403`; eligible enrolled learner after upload and publication expects `200` playback metadata.

Production storage adapter selection and frontend contract confirmation remain open. Local files require durable storage and backup; uploads currently buffer in memory. Next week: review M07, choose production storage, then start M08 only after M07 approval.

**Approval update:** The user approved M07 on 2026-11-23. PR #7 remains an open draft and has not been merged. During manual testing, `npm run db:migrate:dev:apply` applied the M07 migration to local `sage_lms_dev`, and `npm run db:migrate:status` confirmed it was up to date. Shared Postman screenshots showed a pre-migration `500`, a `409` on a non-draft lesson, and a `403` from an expired download URL; no complete manual success log was supplied. M08 is now eligible to start on a separate branch when requested.

## M08 update on 2026-11-23

**Reporting period:** 2026-11-23. **Milestone:** M08 enrollments and entitlements. **Branch:** `feature/M08-enrollments-entitlements`. **PR:** [Draft #8](https://github.com/Omegacarlos1/Sage-product/pull/8), open and unmerged. Verified complete: free enrollment, duplicate prevention under concurrent requests, own course list, and paid lesson access tied to a linked succeeded payment. Evidence: commit [`c790780`](https://github.com/Omegacarlos1/Sage-product/commit/c790780), [M08 summary](../milestones/M08-summary.md), [API contract](../api/M08-enrollments.md), [Postman collection](../../postman/SAGE-M08.postman_collection.json), and PostgreSQL backed integration tests. No database migration was required.

Final `npm run ci` passed lint with 0 errors, typecheck, Jest 6 passed/0 failed/0 skipped in 2 suites, Mocha 29 passed/0 failed/0 skipped against local `sage_lms_test`, and runtime smoke. The first integration run failed 13 tests because authentication middleware intercepted unrelated routes; that routing error was fixed before the passing run. Postman was prepared but not run. Demonstration: `POST /api/v1/courses/{freeCourseId}/enroll` with bearer learner token and `{}` expects `201`, repeat expects `409`; paid course expects `403`; `GET /api/v1/learners/me/courses` expects `200` with only the caller's courses.

In progress/blocked: human M08 review, M07 production storage choice, frontend contract confirmation, and M09 payment provider confirmation. Next week: review the M08 PR and contracts; begin M09 only after approval and provider decision. No production migration, payment, deployment, or merge occurred in M08.

**M08 approval update:** The user approved M08 on 2026-11-23. Draft PR #8 remains open and unmerged. Manual Postman results were not supplied, so the recorded verification remains the passing automated suite. M09 has not started; its payment provider decision remains open.
