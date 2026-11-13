# Local PostgreSQL setup and operations

M02 uses PostgreSQL 18 locally, in CI, and for integration tests. The development and test databases must be different; do not point test commands at `sage_lms_dev`.

## Local databases

Create these empty databases in local PostgreSQL, owned by `sage_app`:

- `sage_lms_dev` — local application data
- `sage_lms_test` — disposable integration-test data; migrations are applied here by `npm run test:integration`
- `sage_lms_shadow` — dedicated empty Prisma Migrate shadow database; Prisma may clear its schema while calculating migrations

The test database must remain separate from the shadow database. Do not store application data in the shadow database.

## Environment variables

Copy `.env.example` to `.env` and replace the local password placeholders. Keep `.env` out of Git and do not put the password in Postman. URL-encode reserved characters in the password (for example, `@` becomes `%40`). Keep the database names as shown:

- `DATABASE_URL` ends in `/sage_lms_dev?schema=public`
- `TEST_DATABASE_URL` ends in `/sage_lms_test?schema=public`
- `SHADOW_DATABASE_URL` ends in `/sage_lms_shadow?schema=public`

The Prisma CLI reads `DATABASE_URL` and `SHADOW_DATABASE_URL` from `prisma.config.ts`. Integration migration and tests use `TEST_DATABASE_URL` through `prisma.test.config.ts`.

## Migration and seed commands

- `npm run db:check` — verify the three local connection URLs; prints database names and safe error codes only, never passwords or full URLs.
- `npm run db:generate` — generate the typed Prisma Client from `prisma/schema.prisma`.
- `npm run db:migrate:dev` — create and apply a development migration. This command uses the development database and its dedicated shadow database; review generated SQL and prompts before accepting a reset.
- `npm run db:migrate:dev:apply` — apply committed migrations to `sage_lms_dev` without generating a new migration.
- `npm run db:migrate:test` — apply committed migrations to the isolated test database without resetting it.
- `npm run db:migrate:status` — show migration status for the development database.
- `npm run db:seed` — idempotently seed the development database with the role names and course categories. Fictional courses are reserved for M06.
- `npm run test:integration` — build, apply migrations to `sage_lms_test`, then run Mocha/Supertest database and API checks.

Migrations are additive and versioned in `prisma/migrations`. Do not use `prisma db push`, drop databases, or reset a database as a substitute for reviewing migrations.

## Backup and restore plan

For a local logical backup, run these commands in PowerShell from a folder outside the repository, using the local PostgreSQL tools. `pg_dump` will prompt for the `sage_app` password:

```powershell
pg_dump --host localhost --port 5432 --username sage_app --format custom --file sage_lms_dev.dump sage_lms_dev
```

Restore into a **new empty database** after creating it. The restore command will prompt for the password:

```powershell
pg_restore --host localhost --port 5432 --username sage_app --dbname sage_lms_restore --no-owner --no-acl sage_lms_dev.dump
```

Then verify the restored tables and row counts in pgAdmin or with `psql`. Keep backup files outside Git, protect them like the source data, and never test restore against a database containing data you want to keep. This is a local backup/restore procedure; production scheduling, encryption, retention, off-site copies, and a restore drill belong to M18.
