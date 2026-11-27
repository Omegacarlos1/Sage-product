# M17 security request contract

Base URL: `http://localhost:3000`. These are expected contract responses, not manually observed Postman results. Use a disposable local account and database.

| Scenario | Method and URL | Headers | Body | Expected response |
| --- | --- | --- | --- | --- |
| CORS allowed | `GET /api/v1/health` | `Origin: https://sage.example.test` when configured in `CORS_ORIGINS`; `Accept: application/json` | None | `200`, `Access-Control-Allow-Origin: https://sage.example.test`, `X-Content-Type-Options: nosniff` |
| CORS denied | `GET /api/v1/health` | `Origin: https://evil.example.test` | None | `200` without `Access-Control-Allow-Origin` (browser blocks reading) |
| Invalid JSON | `POST /api/v1/auth/login` | `Content-Type: application/json` | `{` | `400 {"error":{"code":"INVALID_JSON","message":"Request body must be valid JSON."}}` |
| Invalid login | `POST /api/v1/auth/login` | `Content-Type: application/json` | `{"email":"missing@example.test","password":"wrong"}` | `401 {"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password."}}` |
| Login limit | Repeat invalid login 21 times from one IP in one hour | Same | Same | First 20 receive `401`; request 21 receives `429 {"error":{"code":"RATE_LIMITED","message":"Try again later."}}` and `Retry-After` |
| Admin missing auth | `GET /api/v1/auth/admin-check` | `Accept: application/json` | None | `401 {"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}` |
| Admin learner token | `GET /api/v1/auth/admin-check` | `Authorization: Bearer {{learnerAccessToken}}` | None | `403 {"error":{"code":"FORBIDDEN","message":"Insufficient permissions."}}` |
| Admin token | `GET /api/v1/auth/admin-check` | `Authorization: Bearer {{adminAccessToken}}` | None | `200 {"status":"ok"}` |
| Contact limit | `POST /api/v1/contact`, repeat six times per IP in one hour | `Content-Type: application/json` | `{"name":"Test","email":"test@example.test","subject":"Hello","message":"Please respond"}` | Five `201 {"status":"received"}`, sixth `429` as above |
| Newsletter limit | `POST /api/v1/newsletter/subscribe`, repeat 21 times per IP in one hour | `Content-Type: application/json` | `{"email":"test@example.test"}` | First request `201`, duplicate requests through 20 `200 {"status":"subscribed"}`, request 21 `429` |

Rate limits also apply to signup (10), refresh (30), reset request (5), and reset completion (10) per IP per hour. Limits are held in each API process. A shared store and trusted proxy IP policy are required before multiple replicas or a reverse proxy are used in production. Do not send real passwords or payment keys in Postman collections.
