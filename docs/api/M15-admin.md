# M15 admin API contract

Base URL: `http://localhost:3000/api/v1`. All routes require `Authorization: Bearer <admin-access-token>`. JSON writes require `Content-Type: application/json`. A learner receives `403 {"error":{"code":"FORBIDDEN","message":"forbidden."}}`; an absent or expired token receives 401. IDs below are placeholders for UUIDs created in the environment. The responses below are **expected examples**, not Postman run results.

| Method | Path | Sample body | Expected success | Main errors |
| --- | --- | --- | --- | --- |
| GET | `/admin/users?page=1&limit=20` | none | `200 {"users":[],"total":0,"page":1,"limit":20}` | 400, 401, 403 |
| PATCH | `/admin/users/{userId}/status` | `{"status":"SUSPENDED"}` | `200 {"user":{"id":"{userId}","status":"SUSPENDED"}}` | 400, 404, 409 |
| GET | `/admin/instructors?page=1&limit=20` | none | `200 {"instructors":[],"total":0,"page":1,"limit":20}` | 400, 401, 403 |
| PATCH | `/admin/instructors/{userId}/verification` | `{"status":"VERIFIED"}` | `200 {"instructor":{"userId":"{userId}","verificationStatus":"VERIFIED"}}` | 400, 404, 409 |
| GET | `/admin/courses/review?page=1&limit=20` | none | `200 {"courses":[],"total":0,"page":1,"limit":20}` | 400, 401, 403 |
| POST | `/admin/courses/{courseId}/approve` | `{}` | `200 {"course":{"id":"{courseId}","status":"PUBLISHED"}}` | 400, 404, 409 |
| POST | `/admin/courses/{courseId}/reject` | `{}` | `200 {"course":{"id":"{courseId}","status":"REJECTED"}}` | 400, 404, 409 |
| GET | `/admin/transactions?page=1&limit=20` | none | `200 {"transactions":[],"total":0,"page":1,"limit":20}` | 400, 401, 403 |
| GET | `/admin/analytics` | none | `200 {"users":0,"instructors":0,"publishedCourses":0,"enrollments":0,"succeededPayments":0,"grossNgn":"0.00"}` | 401, 403 |
| GET | `/admin/audit?page=1&limit=20` | none | `200 {"events":[],"page":1,"limit":20}` | 400, 401, 403 |

The existing `POST /courses/{courseId}/approve` remains available for compatibility and now writes the same audit event. Only `IN_REVIEW` courses can be approved or rejected. Rejected courses remain private; resubmission is not yet supported. User status changes allow `ACTIVE` and `SUSPENDED`; self changes and changes to other admins are blocked. Instructor verification permits a single `PENDING` to `VERIFIED` or `REJECTED` transition. Transaction overview excludes user identity, checkout URLs, provider references and idempotency keys. Gross NGN is the sum of successful NGN payment records, not settled revenue or payout entitlement. Audit rows contain actor ID, action, target type/ID, old/new status and timestamp; PostgreSQL rejects update and delete.

Example transition error: `409 {"error":{"code":"INVALID_STATUS","message":"invalid status."}}`. Validation error: `400 {"error":{"code":"VALIDATION_ERROR","message":"validation error."}}`.
