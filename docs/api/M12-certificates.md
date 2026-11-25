# M12 certificate API

Base URL: `http://localhost:3000/api/v1`. Examples below are expected contract examples, not live Postman results. Use a real course UUID and bearer token obtained from login. The course must be published, certificate enabled, and the learner must be enrolled with payment entitlement when required. At least one required lesson must exist; all required lessons must have `completedAt`, and each course quiz must have a submitted passing attempt. Optional lessons and assignments are not issuance gates in M12 because assignment grading and instructor-defined completion rules are not yet implemented.

## Issue

`POST /courses/{courseId}/certificate` with headers `Authorization: Bearer <learnerToken>` and `Content-Type: application/json`, body `{}`.

Expected `201`:

```json
{"certificate":{"id":"11111111-1111-4111-8111-111111111111","courseId":"22222222-2222-4222-8222-222222222222","courseTitle":"Foundations of Design","verificationCode":"33333333-3333-4333-8333-333333333333","issuedAt":"2026-11-25T12:00:00.000Z","verificationPath":"/api/v1/certificates/verify/33333333-3333-4333-8333-333333333333"}}
```

Premature issuance returns `409` `{"error":{"code":"COMPLETION_NOT_MET","message":"completion not met."}}`; repeat issuance returns `409` with `CERTIFICATE_ALREADY_ISSUED`. Missing or invalid entitlement returns `403 FORBIDDEN`; disabled certificates return `409 CERTIFICATE_UNAVAILABLE`. Concurrent issue requests serialize per learner/course and the database's unique `enrollmentId` prevents duplicates.

## Verify

`GET /certificates/verify/{verificationCode}`; no authorization or request body. The `verificationPath` can be encoded as a QR target using the deployed public HTTPS origin. The API supplies the target; clients may render the QR image.

Expected `200`:

```json
{"certificate":{"id":"11111111-1111-4111-8111-111111111111","courseId":"22222222-2222-4222-8222-222222222222","courseTitle":"Foundations of Design","issuedAt":"2026-11-25T12:00:00.000Z","valid":true}}
```

Unknown or malformed codes return `404` `{"error":{"code":"NOT_FOUND","message":"not found."}}`. Verification omits learner name, email, user ID, enrollment ID, and payment data. A revoked certificate remains findable but returns `valid:false`. Code possession is required; codes are random UUIDs and should not appear in logs or analytics query strings.

## Retrieve own certificate

`GET /certificates/{certificateId}` with `Authorization: Bearer <learnerToken>`. Returns `200` with certificate ID, course ID/title, verification code/path, issued time and `valid`. Another learner receives `403 FORBIDDEN`.

This endpoint provides a digital certificate record for client display or download. Server generated PDF and QR image files are not included in M12.

## Revocation strategy

The preexisting `revokedAt` column is the authority. A future restricted admin workflow should record a reason and audit event, set `revokedAt` in a transaction, and notify the learner. Never delete an issued certificate or reuse its verification code. Reissue policy requires a team decision; the unique enrollment constraint currently blocks reissue after revocation. Public verification checks `revokedAt` on every request.
