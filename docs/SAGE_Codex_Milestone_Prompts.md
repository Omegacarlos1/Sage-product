# SAGE LMS — Codex Milestone Prompts (Revised)

**Version:** 13 November 2026  
**Scope:** Entire SAGE LMS backend from the original PRD, plus the individually assigned course/catalog/contact/newsletter workstream.  
**Stack:** Node.js LTS, Express, TypeScript (strict), Socket.IO, PostgreSQL (local/test/production), Prisma, Jest, Mocha + Chai + Supertest, Postman, GitHub.  
**How to use:** Open the backend repository in Codex, put `AGENTS.md` in its root, and paste **one** prompt at a time. Never tell the team a milestone is completed until repository changes and actual tests prove it.

## Your assigned responsibilities within the full plan

- **M01:** Node.js/Express setup, CORS/env baseline, health check.
- **M02:** PostgreSQL setup, table design (courses, categories, instructors, contact messages, subscribers), migrations, backup plan.
- **M05–M06:** Course models, course seed data, public course listing, search, filters, detail API, contact form and newsletter subscription with duplicate prevention.
- **M17:** Input validation, rate limiting, error logging, security and automated tests.
- **M18:** Deployment, monitoring and backup restore validation.

The rest of the milestones implement the *full PRD* and may be shared with other backend teammates. Coordinate ownership; never duplicate user/instructor tables or assume other people's work is complete.

## Mandatory instructions to append to EVERY prompt

1. Read `AGENTS.md`, the SAGE PRD, the revised milestone plan, and prior `docs/milestones/MXX-summary.md`. Inspect existing code first; preserve working code.
2. Explain the implementation in clear, beginner-friendly terms before making major changes. Distinguish PRD requirements from proposed engineering decisions.
3. Work only on this milestone in a `feature/mXX-topic` branch; never merge automatically. Ask before destructive migrations, live payments or production deployments.
4. Use PostgreSQL for integration tests; keep a separate test database. Use **Jest for unit tests** and **Mocha/Chai/Supertest for API/integration tests**; run both, plus lint, typecheck and relevant migration checks. Report actual pass/fail/skip counts and commands, not assumptions.
5. Produce Postman samples with method, URL, headers, sample JSON body, expected success and relevant 4xx error cases. Update OpenAPI/README and `.env.example` as needed.
6. Create `docs/milestones/MXX-summary.md` with implemented/not implemented checklist, files changed, API endpoints, actual test evidence, risks, blockers, PR URL or reason unavailable, beginner-friendly explanations and **a ready-to-paste next milestone prompt**.
7. Update `docs/reports/YYYY-MM-DD-backend-weekly.md` with only verified achievements, linked commits/PRs and test results. Open a draft PR if authorized. Stop and wait for my approval before continuing.

## Milestone prompts

### M01 — Backend foundation

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M01: Backend foundation** only.
>
> **Implementation:** Set up or audit Node.js LTS, Express, strict TypeScript, Socket.IO server initialization, structured folders, configuration, /api/v1/health, centralized errors, npm scripts, linting and CI. Avoid unnecessary new dependencies.
>
> **Acceptance criteria:** GET /api/v1/health returns a predictable JSON response; invalid routes return 404; server starts and stops cleanly; env validation fails safely.
>
> **Postman scenarios:** health success; unknown route 404. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M01-summary.md`, update the weekly report and prepare the next prompt for **M02**. Stop for review; do not auto-merge.

### M02 — PostgreSQL schema and migrations

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M02: PostgreSQL schema and migrations** only.
>
> **Implementation:** Configure local and test PostgreSQL, Prisma migrations and seed framework. Model user, role, learner/instructor profiles, courses, categories, curricula, enrollments, payments, quiz attempts, certificates, reviews, contact_messages and subscribers with sensible constraints and relationships. Identify decisions requiring approval before irreversible schema changes. Include database backup/restore design.
>
> **Acceptance criteria:** Fresh PostgreSQL database migrates successfully; foreign keys and unique constraints work; test database is isolated; rollback/restore strategy documented.
>
> **Postman scenarios:** database health; controlled DB failure. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M02-summary.md`, update the weekly report and prepare the next prompt for **M03**. Stop for review; do not auto-merge.

### M03 — Authentication and role permissions

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M03: Authentication and role permissions** only.
>
> **Implementation:** Implement email/password signup, login, logout, password reset request/complete, secure session or token rotation, learner/instructor/admin roles, email verification decision and authorization middleware. Confirm social sign-in provider requirements before implementing them.
>
> **Acceptance criteria:** Password hashes are secure; unauthorized requests rejected; privilege escalation blocked; reset tokens expire and cannot be reused.
>
> **Postman scenarios:** signup; login; invalid credentials; protected route; logout. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M03-summary.md`, update the weekly report and prepare the next prompt for **M04**. Stop for review; do not auto-merge.

### M04 — User and instructor profiles

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M04: User and instructor profiles** only.
>
> **Implementation:** Implement private profile editing and safe public instructor profile, profile validation, pagination of instructor listing if needed; align instructor model with authentication schema rather than duplicating records.
>
> **Acceptance criteria:** Users edit only their own profile; public endpoints never reveal private fields; instructor ownership verified.
>
> **Postman scenarios:** get/update my profile; public instructor detail; forbidden update. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M04-summary.md`, update the weekly report and prepare the next prompt for **M05**. Stop for review; do not auto-merge.

### M05 — Instructor course creation

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M05: Instructor course creation** only.
>
> **Implementation:** Create category and course CRUD for authorized instructors, pricing (free/paid/discounted), curriculum/lesson structure, draft status, submit for approval, admin approval boundary and ownership checks.
>
> **Acceptance criteria:** Drafts not visible publicly; unauthorized course edits rejected; invalid prices and duplicate slugs handled.
>
> **Postman scenarios:** create draft; update curriculum; submit course; unauthorized update. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M05-summary.md`, update the weekly report and prepare the next prompt for **M06**. Stop for review; do not auto-merge.

### M06 — Public course catalog, contact and newsletter

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M06: Public course catalog, contact and newsletter** only.
>
> **Implementation:** Implement published course list, course details, categories, public instructor details, search and filters (keyword/category/level), pagination and seed data. Implement POST /api/v1/contact with validation, abuse limits and safe retention; POST /api/v1/newsletter/subscribe with normalized email, database UNIQUE constraint and concurrency-safe duplicate handling. Coordinate API contracts with frontend.
>
> **Acceptance criteria:** Search/filter/pagination correct; unpublished courses hidden; seed reproducible; contact validation works; duplicate subscription is idempotent or documented 409 without duplicate rows.
>
> **Postman scenarios:** course list/search/filter/detail; contact valid/invalid; newsletter first/duplicate/concurrent. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M06-summary.md`, update the weekly report and prepare the next prompt for **M07**. Stop for review; do not auto-merge.

### M07 — Media uploads and lesson access

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M07: Media uploads and lesson access** only.
>
> **Implementation:** Implement secure video/resource metadata, approved storage adapter, file type/size checks, signed upload or access flow and lesson access authorization. Do not store large videos directly in PostgreSQL.
>
> **Acceptance criteria:** Unauthorized access denied; upload constraints enforced; media metadata remains consistent; no public storage secrets.
>
> **Postman scenarios:** request upload; forbidden lesson access; allowed playback metadata. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M07-summary.md`, update the weekly report and prepare the next prompt for **M08**. Stop for review; do not auto-merge.

### M08 — Enrollments and entitlements

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M08: Enrollments and entitlements** only.
>
> **Implementation:** Implement free enrollment, purchased-course access checks, duplicate enrollment prevention and learner course list; coordinate paid entitlement with payment milestone.
>
> **Acceptance criteria:** No duplicate enrollments; users cannot access others’ private lessons; paid content locked until verified payment.
>
> **Postman scenarios:** free enrollment; duplicate enrollment; paid locked; my courses. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M08-summary.md`, update the weekly report and prepare the next prompt for **M09**. Stop for review; do not auto-merge.

### M09 — Payment gateway and transactions

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M09: Payment gateway and transactions** only.
>
> **Implementation:** After team confirms payment provider, implement checkout initialization, payment intent/transaction records, signed webhook verification, idempotent settlement and enrollment after verified success. Never treat client callback as proof of payment.
>
> **Acceptance criteria:** Tampered webhook rejected; repeated webhook has no duplicate effect; unsuccessful payment grants no access.
>
> **Postman scenarios:** checkout; invalid webhook; successful webhook simulation; transaction history. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M09-summary.md`, update the weekly report and prepare the next prompt for **M10**. Stop for review; do not auto-merge.

### M10 — Learning progress

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M10: Learning progress** only.
>
> **Implementation:** Track lesson completion, bookmarks, notes and resume point; compute course completion from instructor requirements and enforce enrollment.
>
> **Acceptance criteria:** Progress cannot be edited by other users; repeat completion is idempotent; aggregate progress consistent.
>
> **Postman scenarios:** mark complete; progress; resume; unauthorized access. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M10-summary.md`, update the weekly report and prepare the next prompt for **M11**. Stop for review; do not auto-merge.

### M11 — Quizzes and assessments

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M11: Quizzes and assessments** only.
>
> **Implementation:** Create quiz/question/option models, attempt limits, time windows, scoring and pass thresholds; never return correct answers before submission.
>
> **Acceptance criteria:** Attempts enforced; scoring deterministic; unauthorized quiz access denied; edge cases tested.
>
> **Postman scenarios:** start quiz; submit answers; view result; attempt limit. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M11-summary.md`, update the weekly report and prepare the next prompt for **M12**. Stop for review; do not auto-merge.

### M12 — Certificates

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M12: Certificates** only.
>
> **Implementation:** Issue completion certificates only when criteria met; use unique certificate IDs and publicly verifiable token/QR target without exposing learner private data.
>
> **Acceptance criteria:** Premature issuance rejected; duplicate issuance prevented; verification works; revocation strategy documented.
>
> **Postman scenarios:** issue; verify; invalid certificate. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M12-summary.md`, update the weekly report and prepare the next prompt for **M13**. Stop for review; do not auto-merge.

### M13 — Reviews and ratings

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M13: Reviews and ratings** only.
>
> **Implementation:** Enable eligible enrolled learners to rate/review courses, enforce one review policy or documented edits, compute aggregates safely and implement moderation controls.
>
> **Acceptance criteria:** Ineligible reviews blocked; rating range validated; aggregate calculations correct.
>
> **Postman scenarios:** create review; edit review; invalid rating; list reviews. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M13-summary.md`, update the weekly report and prepare the next prompt for **M14**. Stop for review; do not auto-merge.

### M14 — Refunds, instructor sales and payouts

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M14: Refunds, instructor sales and payouts** only.
>
> **Implementation:** Build payment ledger views, refund workflow and instructor earnings/payout states with audit trails and idempotency. Confirm finance policy, fees and payout provider before live transfers.
>
> **Acceptance criteria:** Reconciled balances; no duplicate payouts/refunds; unauthorized financial actions rejected.
>
> **Postman scenarios:** sales dashboard; refund request; payout status; forbidden action. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M14-summary.md`, update the weekly report and prepare the next prompt for **M15**. Stop for review; do not auto-merge.

### M15 — Admin management and approvals

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M15: Admin management and approvals** only.
>
> **Implementation:** Implement admin-only user/instructor management, course approval/rejection, transaction overview, basic analytics and immutable audit trail for sensitive actions.
>
> **Acceptance criteria:** Learner cannot invoke admin endpoints; approval state transitions enforced; audit logs recorded.
>
> **Postman scenarios:** approve/reject course; user management; analytics; forbidden access. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M15-summary.md`, update the weekly report and prepare the next prompt for **M16**. Stop for review; do not auto-merge.

### M16 — Socket.IO notifications

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M16: Socket.IO notifications** only.
>
> **Implementation:** Add authenticated Socket.IO connections, room authorization, persisted notifications and events for enrollment, course approval, quiz results and certificates; ensure graceful fallback.
>
> **Acceptance criteria:** Unauthorized socket connections rejected; event recipients isolated; reconnection handled; sensitive payloads minimized.
>
> **Postman scenarios:** REST notification list/mark read; Socket.IO manual event checklist. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M16-summary.md`, update the weekly report and prepare the next prompt for **M17**. Stop for review; do not auto-merge.

### M17 — Security and end-to-end quality

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M17: Security and end-to-end quality** only.
>
> **Implementation:** Review CORS allowlist, Helmet, validation, rate limiting for contact/newsletter/auth, structured error logging, secret hygiene, access control, SQL injection resistance, backup checks, test coverage and load smoke tests.
>
> **Acceptance criteria:** No high-severity unresolved issues without documented waiver; all critical flows have passing integration tests; actual test evidence captured.
>
> **Postman scenarios:** negative security cases; rate limit 429; auth matrix. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M17-summary.md`, update the weekly report and prepare the next prompt for **M18**. Stop for review; do not auto-merge.

### M18 — Production deployment and handover

**Copy into Codex:**

> Work on the SAGE LMS backend as a junior developer, following the project requirements and existing coding standards. Execute **Milestone M18: Production deployment and handover** only.
>
> **Implementation:** Prepare production PostgreSQL, migration release process, hosting, health/readiness, logs, alerts, backups and tested restore, operational runbook and frontend handoff. Obtain approval before live deploy.
>
> **Acceptance criteria:** Deployed health verified; monitoring configured; restore drill evidenced; rollback plan and endpoint docs delivered.
>
> **Postman scenarios:** production smoke-test collection using non-destructive calls. Provide exact sample requests and expected responses; do not fabricate live results.
>
> Apply all mandatory milestone instructions above. Save the completion report at `docs/milestones/M18-summary.md`, update the weekly report and prepare the next prompt for **post-release maintenance**. Stop for review; do not auto-merge.

## Weekly meeting update prompt (use after any milestone)

> Inspect GitHub commits, pull requests, milestone summaries and test logs for the current reporting week. Produce a concise SAGE LMS backend weekly meeting report with (1) my assigned responsibilities, (2) verified completed work and evidence links, (3) work in progress, (4) Jest/Mocha test counts and Postman demonstrations, (5) blockers/decisions needed, and (6) next-week targets. Explicitly label unverified claims. Never confuse planning with implementation.

## First-time setup note

If Codex cannot access the PRD or milestone plan, add those files to the repository or paste their contents. If the repo is already partially implemented, ask Codex to audit it before deciding where to resume.
