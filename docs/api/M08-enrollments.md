# M08 enrollment API

Base URL: `http://localhost:3000/api/v1`. Proposed contract pending frontend confirmation. Replace sample UUIDs and bearer tokens with actual values. These are expected examples, not live Postman results.

## Free enrollment

`POST /courses/{courseId}/enroll` with `Authorization: Bearer <learner-token>` and `Content-Type: application/json`. Body: `{}`. The course must be published and free (effective price of zero).

Expected `201`:

```json
{"enrollment":{"id":"11111111-1111-4111-8111-111111111111","courseId":"22222222-2222-4222-8222-222222222222","status":"ACTIVE","enrolledAt":"2026-11-23T12:00:00.000Z"}}
```

Repeat request, including a concurrent repeat, returns `409`:

```json
{"error":{"code":"ALREADY_ENROLLED","message":"already enrolled."}}
```

For a paid course, expected `403`:

```json
{"error":{"code":"PAYMENT_REQUIRED","message":"payment required."}}
```

Paid enrollment is reserved for M09 server verified settlement. Client submitted payment claims are rejected with `400 VALIDATION_ERROR`. Unknown or unpublished course returns `404 NOT_FOUND`; missing auth returns `401 UNAUTHORIZED`; non learner returns `403 FORBIDDEN`.

## My courses

`GET /learners/me/courses` with `Authorization: Bearer <learner-token>` and `Accept: application/json`. No body. Expected `200`:

```json
{"courses":[{"enrollmentId":"11111111-1111-4111-8111-111111111111","status":"ACTIVE","enrolledAt":"2026-11-23T12:00:00.000Z","course":{"id":"22222222-2222-4222-8222-222222222222","title":"Introduction","slug":"introduction","status":"PUBLISHED","price":"0","discountPrice":null,"currency":"USD"},"access":true}]}
```

Only the authenticated learner's enrollments are listed. `access` is false for cancelled enrollments, unpublished courses, and paid courses without a linked succeeded payment. The existing `GET /lessons/{lessonId}/access` uses the same entitlement rule; someone else's enrollment does not unlock it. Payment settlement and refund revocation remain M09 work.
