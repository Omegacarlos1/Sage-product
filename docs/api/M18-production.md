# M18 production smoke contract

Use `https://<approved-api-host>` as `baseUrl`. These calls have no body and no Authorization header; they are safe to repeat. The host is a placeholder until deployment is approved. Expected examples are contract examples, not live results.

| Method | URL | Expected success | Expected failure |
| --- | --- | --- | --- |
| GET | `{{baseUrl}}/api/v1/health` | 200 `{"status":"ok","service":"sage-api","version":"v1"}` | 503/timeout if process or proxy unavailable |
| GET | `{{baseUrl}}/api/v1/ready` | 200 `{"status":"ready","service":"sage-api"}` | 503 `{"error":{"code":"NOT_READY","message":"Service is not ready."}}` when DB check fails |
| GET | `{{baseUrl}}/api/v1/health/database` | 200 `{"status":"ok","service":"sage-api","database":"connected"}` | 503 `{"error":{"code":"DATABASE_UNAVAILABLE","message":"Database connection unavailable."}}` |
| GET | `{{baseUrl}}/api/v1/categories` | 200 JSON category list per M06 contract | 503/timeout if dependent service unavailable |

Headers: `Accept: application/json`. No sample body for GET. A monitor may call health and readiness; the public category request checks the routing path and database. See [M06 public API](M06-public.md) for category shape and pagination. Avoid authenticated or mutating endpoints in production smoke checks.
