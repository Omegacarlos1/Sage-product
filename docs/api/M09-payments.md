# M09 Paystack payments API

Base URL: `http://localhost:3000/api/v1`. These contracts are proposed pending frontend confirmation. All prices are server sourced. Paystack checkout supports published paid courses priced in NGN; the minimum is ₦100. Existing USD course rows must be repriced by their owners before checkout. NGN amounts are converted to kobo for Paystack. [Paystack transaction API](https://paystack.com/docs/api/transaction/) documents initialization and verification; [Paystack webhooks](https://paystack.com/docs/payments/webhooks/) document the signed raw body.

Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` privately. Configure `POST https://<your-domain>/api/v1/payments/paystack/webhook` on the Paystack dashboard. A missing secret key makes checkout return `503`; a valid signed webhook is required for settlement. Do not put these secrets in Postman collections, source control, or browser code. No client callback settles payment.

## Checkout

`POST /courses/{courseId}/checkout` requires a learner bearer token, an `Idempotency-Key` header of 8 to 180 letters, digits, `_` or `-`, and JSON `{}`. Example:

```http
POST http://localhost:3000/api/v1/courses/11111111-1111-4111-8111-111111111111/checkout
Authorization: Bearer <learner-access-token>
Idempotency-Key: course-11111111-attempt-1
Content-Type: application/json

{}
```

Expected `201` with a real course, configured sandbox gateway and a successful Paystack initialization:

```json
{"payment":{"id":"22222222-2222-4222-8222-222222222222","courseId":"11111111-1111-4111-8111-111111111111","amount":"2500","currency":"NGN","status":"PENDING","reference":"sage-33333333-3333-4333-8333-333333333333","checkoutUrl":"https://checkout.paystack.com/example","createdAt":"2026-11-24T10:00:00.000Z","settledAt":null}}
```

Repeating the same key, learner and course returns `200` with the same payment. Another learner or course using the key gets `409 IDEMPOTENCY_CONFLICT`. A pending initialization with no URL gets `409 CHECKOUT_PENDING`; use a new key if initialization failed. Missing or invalid input gets `400 VALIDATION_ERROR`; free, non NGN or under ₦100 courses get `400 UNSUPPORTED_COURSE_PRICE`; unpublished or unknown course gets `404 NOT_FOUND`; already purchased gets `409 ALREADY_ENROLLED`; unconfigured provider gets `503 PAYMENT_UNAVAILABLE`; provider initialization failure gets `502 PAYMENT_PROVIDER_ERROR`. Example:

```json
{"error":{"code":"PAYMENT_UNAVAILABLE","message":"payment unavailable."}}
```

## Signed webhook

`POST /payments/paystack/webhook` uses `Content-Type: application/json` and either `Paystack-Signature` (timestamped signing secret) or legacy `x-paystack-signature` (secret key). The signature must cover the **exact raw JSON bytes**. A tampered or unsigned body returns `401`:

```json
{"error":{"code":"INVALID_SIGNATURE","message":"invalid signature."}}
```

A signed `charge.success` with a known reference triggers a server to server Paystack verification. Only `success` with the stored reference, amount in kobo, NGN and payer email can settle. The payment status and active enrollment are committed together. Replays return `200 {"received":true}` without another enrollment. A signed event whose verification is unsuccessful or mismatched returns `409 PAYMENT_NOT_VERIFIED`; no access is granted. Unknown references and unrelated signed events are acknowledged without granting access. Provider errors return `500` so Paystack can retry. The response is sent after the database commit, which may take longer than an ideal webhook acknowledgment; a durable queue is a later scaling option.

The Postman collection contains an **invalid signature** request that can run without credentials and an optional **local signed simulation** that requires the signing secret in a private Postman environment and a seeded pending payment. It does not claim a live Paystack delivery.

## Transaction history

`GET /learners/me/transactions` with `Authorization: Bearer <learner-access-token>` returns the caller's 50 latest payment records, newest first:

```json
{"transactions":[{"id":"22222222-2222-4222-8222-222222222222","courseId":"11111111-1111-4111-8111-111111111111","amount":"2500","currency":"NGN","status":"SUCCEEDED","reference":"sage-33333333-3333-4333-8333-333333333333","checkoutUrl":"https://checkout.paystack.com/example","createdAt":"2026-11-24T10:00:00.000Z","settledAt":"2026-11-24T10:02:00.000Z"}]}
```

Missing token returns `401 UNAUTHORIZED`; a non learner returns `403 FORBIDDEN`. No other learner's transactions are returned.
