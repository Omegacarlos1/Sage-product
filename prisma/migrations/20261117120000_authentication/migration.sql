CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "accessTokenHash" CHAR(64) NOT NULL,
  "refreshTokenHash" CHAR(64) NOT NULL, "accessExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "refreshExpiresAt" TIMESTAMPTZ(3) NOT NULL, "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "usedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_sessions_accessTokenHash_key" ON "auth_sessions"("accessTokenHash");
CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON "auth_sessions"("refreshTokenHash");
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
