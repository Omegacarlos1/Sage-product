# M02 database health API

The endpoint is for local readiness checks and does not expose schema, credentials, or driver error text.

## Database available

- **Method:** `GET`
- **URL:** `http://localhost:3000/api/v1/health/database`
- **Headers:** `Accept: application/json`
- **Body:** none
- **Expected:** `200 OK`

```json
{"status":"ok","service":"sage-api","database":"connected"}
```

## Database unavailable

Run a separate local API process with a syntactically valid but unreachable `DATABASE_URL`, then send the same request. Do not alter a shared or production database.

- **Expected:** `503 Service Unavailable`

```json
{"error":{"code":"DATABASE_UNAVAILABLE","message":"Database connection unavailable."}}
```

Collection: `postman/SAGE-M02.postman_collection.json`. M02 implements storage models and migrations only; business APIs remain in their later milestones.
