# SAGE LMS backend weekly update — 2026-11-22

**Reporting period:** 2026-11-18 to 2026-11-22. **Milestone:** M05 instructor course creation. **Branch:** `feature/M05-instructor-course-creation`. **PR:** [draft #5](https://github.com/Omegacarlos1/Sage-product/pull/5).

## Verified complete

Instructor-owned category CRUD, draft course CRUD, free/paid/discounted price validation, curriculum replacement, submission for review, admin approval boundary, owner checks and published-only public visibility. See [M05 summary](../milestones/M05-summary.md), [API contract](../api/M05-courses.md), migration and [Postman collection](../../postman/SAGE-M05.postman_collection.json). Implementation commit: [`24db402`](https://github.com/Omegacarlos1/Sage-product/commit/24db402bc1d5326135ef6c07044459787a24be8a).

## Actual tests

Final `npm run ci` passed: lint 0 errors, typecheck passed, Jest 6 passed/0 failed/0 skipped across 2 suites, Mocha 20 passed/0 failed/0 skipped, runtime smoke passed. M05 migration applied to local `sage_lms_test` on the first run; the final run found no pending migrations. The user reported manual Postman testing and approved M05 on 2026-11-22; individual Postman outcomes and counts were not supplied.

## Postman demonstration

Use M03 login to obtain instructor and admin bearer tokens. `POST http://localhost:3000/api/v1/categories` with instructor bearer, `Content-Type: application/json`, and `{"name":"Digital Skills","slug":"digital-skills"}`; expect 201 and save `category.id`. `POST /api/v1/courses` with the same headers and `{"categoryId":"<id>","title":"Digital Skills 101","slug":"digital-skills-101","description":"A fictional beginner course","price":50,"discountPrice":40}`; expect 201 and `DRAFT`. `PUT /api/v1/courses/<id>/curriculum` with `{"sections":[{"title":"Basics","lessons":[{"title":"Welcome","type":"ARTICLE"}]}]}`; expect 200. `POST /api/v1/courses/<id>/submit`; expect `IN_REVIEW`. Another instructor's `PATCH /api/v1/courses/<id>` returns 403. These are expected responses, not live Postman results.

## In progress, blocked and next week

M05 is approved by the user; PR #5 remains an open, mergeable draft. GitHub confirms M03 PR #3 and M04 PR #4 were merged into `main` on 2026-11-17. Confirm API shapes with frontend and decide category ownership and review queue behavior. Next week: complete M05 PR review and plan M06 public catalog filtering, fictional seed data, contact and newsletter APIs.

## M06 update — 2026-11-22

**Milestone:** M06 public catalog, contact and newsletter. **Branch:** `feature/M06-public-catalog-contact-newsletter`. **PR:** pending. The branch is based on approved M05 because PR #5 is still open. The original M05 report above records the state before M06 work; this update records later verified work.

**Verified complete:** Published course search/filter/pagination and slug detail; contact validation and per-process abuse limit; normalized newsletter duplicate handling using PostgreSQL uniqueness; three fictional seed courses. See [M06 summary](../milestones/M06-summary.md), [API contract](../api/M06-public.md), [Postman collection](../../postman/SAGE-M06.postman_collection.json), and branch commit after push.

**Actual tests:** `npm run ci` passed. Lint 0 errors; typecheck passed; Jest 6 passed/0 failed/0 skipped in 2 suites; Mocha 23 passed/0 failed/0 skipped against local PostgreSQL; runtime smoke passed. `npm run db:seed` completed twice against `sage_lms_dev`, reporting three fictional courses on both runs. Postman collection was prepared but not manually run.

**Postman demonstration:** `GET http://localhost:3000/api/v1/courses?search=web&category=technology&level=BEGINNER&page=1&limit=10` expects 200 with published matches. `POST http://localhost:3000/api/v1/contact` with `Content-Type: application/json` and `{"name":"Ada","email":"ada@example.com","subject":"Course question","message":"Please contact me."}` expects 201. `POST http://localhost:3000/api/v1/newsletter/subscribe` with `{"email":"Ada@Example.com"}` expects 201 first, 200 on duplicate. These are expected responses; parallel duplicate handling was verified through integration tests.

**In progress/blocked:** Frontend has not confirmed contract shapes. Retention pruning needs operational scheduling, and shared rate limiting is needed before multiple replicas. **Next week:** request frontend review, review M06 draft PR after M05 merge, then await approval before M07.
