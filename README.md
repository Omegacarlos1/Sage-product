# SAGE LMS backend

This repository contains the SAGE LMS backend foundation. The product scope follows the original PRD; implementation is delivered one reviewed milestone at a time.

## Requirements

- Node.js 22 or 24 LTS
- npm

## Local setup

1. Copy `.env.example` to `.env` and adjust local settings if needed.
2. Run `npm ci`.
3. Run `npm run dev` for the development server, or `npm run build` followed by `npm start`.

The server validates its configuration before listening. An invalid configuration prints a concise error without echoing environment values and exits with a failure code.

## M01 API

### Health check

`GET /api/v1/health`

Success (`200`):

```json
{"status":"ok","service":"sage-api","version":"v1"}
```

### Database health check

`GET /api/v1/health/database` runs a lightweight query against the configured PostgreSQL database.

Success (`200`):

```json
{"status":"ok","service":"sage-api","database":"connected"}
```

Unavailable (`503`):

```json
{"error":{"code":"DATABASE_UNAVAILABLE","message":"Database connection unavailable."}}
```

The database route never returns connection strings or database error details. See `docs/database/README.md` for local database setup, migration, and backup commands.

Unknown paths return `404` with a stable JSON error. Malformed JSON returns `400`. Unexpected errors return a generic `500`; logs do not include request bodies.

## Development checks

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit` (Jest)
- `npm run test:integration` (applies migrations to `sage_lms_test`, then runs Mocha/Supertest)
- `npm run ci` runs all checks above.

API requests and expected responses are in `postman/SAGE-M01.postman_collection.json`. See `docs/milestones/M01-summary.md` for scope and verified results.

For M02 local PostgreSQL setup, migrations, backups, and schema decisions, see `docs/database/README.md` and `docs/database/schema-decisions.md`.
