# M12 — Certificates and verification

**Status:** Implemented on `feature/M12-certificates-verification`; awaiting review. No merge or deployment.

## Objectives and implemented work

An enrolled learner can issue one certificate after a published, certificate enabled course has all required lessons completed and a submitted passing attempt for every course quiz. At least one required lesson is necessary. Paid courses require a successful linked payment. Issuance is serialized by learner and course with a PostgreSQL advisory transaction lock; the existing unique enrollment and verification code constraints provide database enforcement. Issuance marks the enrollment completed, and completed learners retain course access. Owner retrieval and public code verification are available. Public verification reveals certificate ID, course ID/title, issue time, and validity, without learner identity or payment data. The verification path is the QR target.

## Not implemented and decisions

PDF generation and QR image rendering are client concerns for this milestone. Assignments are not an issuance gate because grading rules are not yet implemented. The PRD's instructor-defined custom completion rules are not yet modeled; M12 uses the available required lesson and quiz data. Administrative revocation and reissue need a team decision. The existing `revokedAt` field is checked by verification; future admin revocation should record reason and audit event, notify the learner, and retain the certificate row and code. A revoked certificate cannot currently be reissued due to the unique enrollment constraint. Course edits after issue do not automatically revoke a certificate.

## Files and database

Added `src/routes/certificates.ts`, `tests/integration/certificates-m12.test.js`, [API contract](../api/M12-certificates.md), and [Postman collection](../../postman/SAGE-M12.postman_collection.json). Updated `src/app.ts`, `src/services/entitlements.ts`, tracker, `AGENTS.md`, and weekly report. No schema change or migration: M02 already created the certificate table and unique constraints. The unrelated preexisting edit to `docs/reports/2026-11-13-backend-weekly.md` was preserved and excluded.

## Actual verification

`npm run ci` passed: ESLint 0 errors, strict TypeScript typecheck passed, Jest 3 suites and 7 tests passed/0 failed/0 skipped, Mocha 43 passed/0 failed/0 skipped against local PostgreSQL `sage_lms_test`, runtime smoke passed. `npm run db:migrate:test` found seven migrations and no pending migrations. M12 tests covered premature and unauthorized issue, duplicate issue, public privacy, invalid code, own access, completed enrollment access, and revoked validity. Postman was not manually run; the examples are expected contract responses.

## API and security

`POST /api/v1/courses/{courseId}/certificate` requires a learner token and `{}`. `GET /api/v1/certificates/{certificateId}` requires the owner. `GET /api/v1/certificates/verify/{verificationCode}` is public. The [API contract](../api/M12-certificates.md) contains exact methods, headers, bodies, success and error examples. No credentials or learner details are logged. The random UUID verification code should be shared only as a certificate URL over HTTPS. Frontend contract confirmation remains open.

## PR and next prompt

[Draft PR #15](https://github.com/Omegacarlos1/Sage-product/pull/15) targets `main`. Implementation commit `aa51409`; PR description commit `8cdfc92`. Await human review; do not merge.

> Read `AGENTS.md`, the original PRD, `SAGE_Revised_Backend_Milestones.docx`, and `docs/milestones/M12-summary.md`; inspect branch, working tree, schema, and existing APIs. After M12 approval, work only on **M13: Reviews and ratings** on `feature/M13-reviews-ratings`. Define eligible reviewer and moderation rules with the team, implement one review per learner/course with rating validation and safe public listing, test authorization and duplicates against PostgreSQL, update API docs and exact Postman cases, run lint/typecheck/Jest/Mocha, write the M13 summary and weekly report, push a reviewable draft PR, and stop for approval without merging.
