CREATE TABLE "account_links" (
  "id" UUID NOT NULL,
  "learnerId" UUID NOT NULL,
  "instructorId" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMPTZ(3),
  CONSTRAINT "account_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_links_learnerId_instructorId_key" UNIQUE ("learnerId", "instructorId"),
  CONSTRAINT "account_links_learnerId_key" UNIQUE ("learnerId"),
  CONSTRAINT "account_links_instructorId_key" UNIQUE ("instructorId"),
  CONSTRAINT "account_links_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "account_links_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "account_links_distinct_accounts" CHECK ("learnerId" <> "instructorId"),
  CONSTRAINT "account_links_valid_status" CHECK ("status" IN ('PENDING', 'ACTIVE'))
);
CREATE INDEX "account_links_instructorId_status_expiresAt_idx" ON "account_links"("instructorId", "status", "expiresAt");
