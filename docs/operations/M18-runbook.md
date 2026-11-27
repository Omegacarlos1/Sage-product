# M18 production release and operations runbook

**Status: release proposal, no live deployment authorized or evidenced.** Use one Node.js instance and managed PostgreSQL. The team must select the host, region, domain, TLS terminator, alert destination, backup store, retention, recovery targets and media volume before activation. Mount `MEDIA_ROOT` on durable private storage shared with the backup plan. The current disk media store and process-local rate limits and Socket.IO rooms do not support multiple replicas. Keep Paystack live keys absent until finance and live-payment approval.

## Provisioning and secrets

Provision a private PostgreSQL database with TLS, daily managed snapshots and point-in-time recovery if supported. Use separate least-privilege app and migration roles; the app role needs only runtime table access, while the migration role owns schema changes. Restrict inbound database traffic to the application and release runner. Set `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `CORS_ORIGINS` (exact HTTPS frontend origins), `MEDIA_ROOT` and `MEDIA_SIGNING_SECRET` in host secret storage. Use a TLS PostgreSQL connection string; never place it in logs, CI artifacts or Git. Set `SHADOW_DATABASE_URL` only for development, never in the release environment. Create a private durable volume for media and include it in backup and restore drills. Container image uses Node 22 and runs as uid 10001. Terminate HTTPS at the host proxy; forward Socket.IO upgrades. Do not enable a proxy trust setting without reviewing the source IP chain and a shared rate-limit store.

## Release sequence (requires approval for live execution)

1. Confirm PR merge, CI pass, image digest, approved host configuration and a recent successful backup. Capture commit SHA, migration list and current app/DB health. Announce maintenance window and operator/rollback owner.
2. Build immutable image from reviewed commit: `docker build -t sage-api:<SHA> .`. Scan image and production dependencies. Stage it against a separate PostgreSQL database and private media volume.
3. In staging, set `NODE_ENV=production` and `DATABASE_URL` through secret storage. Run `npx prisma migrate status --config prisma.config.ts`; review every pending migration SQL. Take a fresh backup, then run `npx prisma migrate deploy --config prisma.config.ts` once as the migration role. Never run `migrate dev`, `db push`, or test commands against production.
4. Run container with secret injection, durable media mount and private network. Configure liveness `GET /api/v1/health` and readiness `GET /api/v1/ready`. Require readiness 200 before routing traffic. Run `SMOKE_BASE_URL=https://<approved-host> npm run smoke:production` or the M18 Postman collection. Staging must pass first.
5. After explicit live approval, repeat the reviewed migration and image rollout steps in production; capture timestamps, image digest, migration status, smoke output and operator name. Avoid live payment or write probes.

## Monitoring and response

Send JSON stdout/stderr to the hosting log service with access controls and retention. Existing logs record generic health/error events; do not log bodies, tokens, URLs containing credentials, or contact messages. Monitor external HTTPS liveness and readiness once per minute, 5xx rate, restart count, database connection exhaustion, disk/media capacity, backup success and age, certificate expiry and payment webhook error rate (if enabled). Proposed alerts: readiness fails twice in 5 minutes; 5xx >2% for 5 minutes with at least 100 requests; backup older than 26 hours; free media space <20%; certificate expires in 14 days. Route to the named on-call channel after the team chooses one. Record alert test evidence before launch; no monitoring integration is configured by this repository alone.

If readiness fails, check DB connectivity, migration status and pool saturation; keep the instance out of traffic. If liveness fails, inspect host events and generic application logs. If backup alert fires, verify storage and credentials, run an on-demand backup and escalate. Never paste connection strings into tickets.

## Backups and restore drill

Configure managed PostgreSQL snapshots with an off-site copy, encryption in transit and at rest, retention and a tested deletion policy. A proposed baseline is daily snapshots, 30-day retention, RPO 24 hours and RTO 4 hours; business owner must approve these values. Schedule media-volume backup at matching frequency. Logical export for a drill: `pg_dump --format=custom --no-owner --no-acl --file=<protected-path>/sage.dump "$DATABASE_URL"`. Use a separately provisioned, **empty isolated** PostgreSQL database. Restore with `pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" <protected-path>/sage.dump`. Run `SELECT count(*) FROM courses;` and `SELECT count(*) FROM _prisma_migrations;` in source and restored databases, compare counts, and verify a representative course and media file. Record backup ID, SHA-256, timestamp, source/restore database identities, row counts, duration and reviewer in a restricted operations record. Destroy only the isolated drill database after review. Never restore over production. This workspace had no `pg_dump`, `pg_restore` or `psql` on PATH at M18 preparation time, so no drill has been evidenced.

## Rollback

If the new image fails before migrations, route back to the prior image digest and verify readiness and smoke. After an additive migration, prefer rolling back the app image only if old code is compatible with the migrated schema. If it is not, stop traffic and use a reviewed forward fix. Database restore is a last resort requiring explicit incident approval and a recovery point decision because it discards newer writes; also restore the matching media snapshot. Record incident timeline and postmortem.

## Frontend handoff

Use the approved HTTPS API origin and `/api/v1` prefix. Set browser origin exactly in `CORS_ORIGINS`. REST auth uses bearer tokens; Socket.IO uses `auth: { token }` and listens for `notification:new`; reconnect and fetch REST notification history. See `docs/api/M03-authentication.md`, `M06-public.md`, `M07-media.md`, `M09-payments.md`, `M16-notifications.md`, and `M18-production.md`. Do not expose admin or payment secrets in frontend code. Frontend team must confirm origin, token storage, payment return behavior, media upload limits and error handling before launch.
