# M16 notification API and socket contract

Base URL: `http://localhost:3000`. Use an access token from `POST /api/v1/auth/login`; never put tokens in a URL. All examples below are expected contract responses, not a record of a manual Postman run.

## REST

`GET /api/v1/notifications?page=1&limit=20` with `Authorization: Bearer <accessToken>` returns only the caller's notifications (newest first, maximum limit 50). Example `200`:

```json
{"notifications":[{"id":"11111111-1111-4111-8111-111111111111","type":"COURSE","title":"Enrollment confirmed","payload":{"event":"ENROLLMENT_CREATED","courseId":"22222222-2222-4222-8222-222222222222"},"readAt":null,"createdAt":"2026-11-27T12:00:00.000Z"}],"total":1,"page":1,"limit":20}
```

`PATCH /api/v1/notifications/11111111-1111-4111-8111-111111111111/read` with `Authorization: Bearer <accessToken>` and `Content-Type: application/json`, body `{}` returns `200` with `{"notification":{...}}`, including a non-null `readAt`. Repeating the request returns the same read state. Another user's notification returns `404` with `{"error":{"code":"NOT_FOUND","message":"Notification not found."}}`. Missing/invalid bearer token returns `401` with `{"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`. Invalid pagination or ID returns `400 VALIDATION_ERROR`.

## Socket.IO

Connect to `http://localhost:3000` using Socket.IO v4 and `auth: { token: "<accessToken>" }`. Missing, expired, revoked or suspended credentials receive `connect_error` with `UNAUTHORIZED`; a database authentication failure gives `AUTH_UNAVAILABLE`. The server assigns only `user:<authenticated user ID>`; clients cannot request another room. On access token expiry the socket disconnects. Refresh the token through REST and reconnect with the new access token. Each successful connection joins the same user room. Fetch `GET /api/v1/notifications` after every connection and reconnect to recover anything missed while offline.

The server emits `notification:new` with `{ "id": "...", "type": "COURSE", "title": "Enrollment confirmed", "createdAt": "..." }`. It omits body, payload, email, quiz score, answers, certificate verification code and payment details. REST history contains small event identifiers. Events are generated for free and paid enrollment, course approval/rejection, quiz submission result, and certificate issuance. Persistence is transactional with the underlying state change. Socket delivery is best effort; REST history is the fallback. Multiple server replicas require a shared Socket.IO adapter before relying on cross-replica delivery.

## Manual checklist

1. Log in as two users and connect both with separate access tokens. Expect two successful connections.
2. Connect with no token, invalid token and an expired token. Expect `connect_error: UNAUTHORIZED` and no events.
3. Create a free enrollment, approve a course, submit a quiz, and issue a certificate with eligible test accounts. Expect only the intended user to receive `notification:new` for each action. Paid enrollment additionally requires a verified Paystack test webhook; do not use a live payment.
4. Disconnect the recipient, trigger an event, reconnect with a fresh token, then list notifications through REST. Expect stored history including the missed item, with no assumed socket replay.
5. Read one notification. Expect a timestamp in `readAt`; another user gets `404` for that ID.

No manual Socket.IO or Postman result is claimed here.
