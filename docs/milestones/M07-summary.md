# M07 — Media uploads and lesson access

**Status:** Implemented, awaiting review and storage provider decision. **Branch:** `feature/M07-media-lesson-access`, based on approved M06 branch. **PR:** [Draft #7](https://github.com/Omegacarlos1/Sage-product/pull/7) targeting `main`. M06 PR #6 merged before draft creation.

## Objectives and implementation

Added private local media storage, HMAC signed upload and download URLs, metadata, size and file signature checks, and lesson access rules. Instructor owners and admins can request upload for draft lessons. Published lesson access requires active enrollment, with succeeded payment for paid courses. Videos remain outside PostgreSQL. Curriculum writes no longer accept arbitrary resource URLs and refuse replacement when media already exists.

## Files and database

Changed `prisma/schema.prisma`, `src/app.ts`, `src/config/env.ts`, `src/routes/courses.ts`, `.env.example`, `.gitignore`, `AGENTS.md`, and the tracker. Added migration `20261123120000_m07_media`, media route and storage service, PostgreSQL integration tests, M07 API docs, Postman collection, weekly report and this summary. Migration creates `lesson_media` with unique lesson and storage keys, a positive size check and status check. Local test migration applied; no production migration was run.

## API and Postman

See [M07 API contract](../api/M07-media.md) and [M07 Postman collection](../../postman/SAGE-M07.postman_collection.json) for exact requests and expected success/error examples. Postman itself was not run. Equivalent HTTP behavior was tested with Supertest. Endpoint shapes are proposed pending frontend confirmation.

## Actual verification

`npm run ci` on 2026-11-23: lint passed with 0 errors; typecheck passed; Jest 2 suites, 6 passed, 0 failed, 0 skipped; Mocha 26 passed, 0 failed, 0 skipped against local PostgreSQL `sage_lms_test`; runtime smoke passed. The M07 migration applied to the local test database. Postman collection JSON parsed successfully.

## Not implemented, risks and learning notes

No production storage adapter was selected by the team, so this milestone cannot be deployed yet. Local filesystem media requires a durable shared volume and backups. Direct object store transfers, antivirus scanning, transcoding, range streaming and orphan file cleanup remain future work. Signed URLs are bearer credentials and remain usable until their short expiry even if access is revoked. Metadata is `PENDING` until upload completion. PostgreSQL keeps it consistent with the lesson; the file write and DB update are not one atomic operation. Keeping files outside PostgreSQL avoids large binary rows while preserving searchable metadata.

## PR and next prompt

Draft PR description: Add private media metadata, signed local upload/download flow, lesson authorization and M07 API/Postman coverage. Tests: `npm run ci` with 6 Jest and 26 Mocha passes. Risks: local adapter is not production storage and no scanning/transcoding. PR #7 targets `main` and is awaiting review. Do not merge before approval.

> Work on SAGE LMS backend as a junior developer, following the PRD and `SAGE_Revised_Backend_Milestones.docx`. Execute **M08: Enrollments and entitlements** only after M07 approval. Implement free enrollment, purchased course access checks, duplicate enrollment prevention and a learner course list. Coordinate paid entitlement with the payment milestone; never grant access on an unverified client payment. Verify with lint, typecheck, Jest, PostgreSQL backed Mocha tests and exact Postman requests and responses. Update API docs, weekly report and `docs/milestones/M08-summary.md`, push a feature branch and prepare a draft PR. Stop for review; do not auto merge.
