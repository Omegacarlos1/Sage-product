# M14 finance API contract

Base URL: `http://localhost:3000/api/v1`. Authenticated calls use `Authorization: Bearer <access-token>`. POST calls use `Content-Type: application/json`. Examples are expected contract responses, not live Postman results. Money is NGN; all amounts are decimal strings. Financial requests record intent only: no refund or transfer provider call exists.

## Instructor sales dashboard

`GET /instructors/me/sales` (INSTRUCTOR)

Example: `GET http://localhost:3000/api/v1/instructors/me/sales`, header `Authorization: Bearer <instructor-token>`, no body.

Expected `200`:

```json
{"summary":{"currency":"NGN","saleCount":1,"grossSales":"2500.00","refundHolds":"0.00","payoutHolds":"0.00","provisionalAvailable":"2500.00","feePolicy":"UNCONFIRMED"},"sales":[{"paymentId":"11111111-1111-4111-8111-111111111111","courseId":"22222222-2222-4222-8222-222222222222","amount":"2500.00","currency":"NGN","settledAt":"2026-11-25T12:00:00.000Z"}]}
```

Only the most recent 50 successful NGN sales appear in `sales`; the summary aggregates all successful NGN sales. `provisionalAvailable = grossSales - pending refund amounts - pending payout amounts`; it can be negative if a refund request arrives after a payout hold. This is a gross provisional figure, not settled provider cash or an approved instructor entitlement. Platform fees, taxes, provider fees, reserve, and payout share have not been agreed. Do not use this number to trigger a transfer.

## Refund request

`POST /payments/{paymentId}/refund-requests` (paying LEARNER)

Headers: `Authorization: Bearer <learner-token>`, `Content-Type: application/json`, `Idempotency-Key: refund-20261125-001`.

Body: `{"reason":"I cannot take this course"}` (10 to 500 characters after trimming).

Expected `201`:

```json
{"refundRequest":{"id":"33333333-3333-4333-8333-333333333333","paymentId":"11111111-1111-4111-8111-111111111111","status":"PENDING_REVIEW","createdAt":"2026-11-25T12:05:00.000Z"}}
```

The same key, payment, user, and reason return `200` with the same record. A second key for the same payment returns `409 REFUND_ALREADY_REQUESTED`. A changed request using the same key returns `409 IDEMPOTENCY_CONFLICT`. Unknown or another learner's payment returns `404 NOT_FOUND`. Non successful or non NGN payment returns `409 REFUND_NOT_AVAILABLE`. The request does not change payment status or enrollment access.

`GET /learners/me/refund-requests` (LEARNER) returns `{"refundRequests":[{"id":"...","paymentId":"...","status":"PENDING_REVIEW","createdAt":"..."}]}` for the current learner, most recent 50.

## Payout request and status

`POST /instructors/me/payout-requests` (INSTRUCTOR)

Headers: `Authorization: Bearer <instructor-token>`, `Content-Type: application/json`, `Idempotency-Key: payout-20261125-001`.

Body: `{"amount":"500.00"}` (positive NGN amount, exactly two decimal places).

Expected `201`:

```json
{"payoutRequest":{"id":"44444444-4444-4444-8444-444444444444","amount":"500.00","currency":"NGN","status":"PENDING_REVIEW","createdAt":"2026-11-25T12:10:00.000Z"}}
```

The same key and amount return `200` with the same record. A changed amount or another instructor using the key returns `409 IDEMPOTENCY_CONFLICT`. An amount above provisional available returns `409 INSUFFICIENT_PROVISIONAL_BALANCE`. Pending requests reserve the provisional amount. A PostgreSQL transaction lock serializes concurrent payout requests for one instructor.

`GET /instructors/me/payout-requests` (INSTRUCTOR) returns `{"payoutRequests":[{"id":"...","amount":"500.00","currency":"NGN","status":"PENDING_REVIEW","createdAt":"..."}]}` for the current instructor, most recent 50. No bank details or payout provider credentials are stored.

## Admin rejection and forbidden action

`POST /admin/refund-requests/{id}/reject` and `POST /admin/payout-requests/{id}/reject` (ADMIN), with `{}` as body, change a pending request to `REJECTED` and create an audit row in the same transaction. A second rejection returns `409 INVALID_STATE`. There is no approval or completed state until the team defines policy and provider reconciliation.

Example forbidden call: `POST http://localhost:3000/api/v1/admin/payout-requests/44444444-4444-4444-8444-444444444444/reject` with learner bearer token, `Content-Type: application/json`, body `{}`. Expected `403`:

```json
{"error":{"code":"FORBIDDEN","message":"Insufficient permissions."}}
```

Unauthenticated calls return `401 UNAUTHORIZED`. Invalid UUID, idempotency key, body fields or amount return `400 VALIDATION_ERROR`. Audit rows record actor ID, subject ID, action, and time; refund reasons are never returned by the API or logged.
