CREATE TYPE "FinanceRequestStatus" AS ENUM ('PENDING_REVIEW', 'REJECTED');

CREATE TABLE "refund_requests" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "requesterId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "status" "FinanceRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refund_requests_paymentId_key" UNIQUE ("paymentId"),
  CONSTRAINT "refund_requests_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "refund_requests_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refund_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "refund_requests_requesterId_createdAt_idx" ON "refund_requests"("requesterId", "createdAt");

CREATE TABLE "payout_requests" (
  "id" UUID NOT NULL,
  "instructorId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
  "status" "FinanceRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_requests_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "payout_requests_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payout_requests_positive_amount" CHECK ("amount" > 0)
);
CREATE INDEX "payout_requests_instructorId_createdAt_idx" ON "payout_requests"("instructorId", "createdAt");

CREATE TABLE "finance_audit" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "action" VARCHAR(60) NOT NULL,
  "refundRequestId" UUID,
  "payoutRequestId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_audit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_audit_one_subject" CHECK (("refundRequestId" IS NULL) <> ("payoutRequestId" IS NULL)),
  CONSTRAINT "finance_audit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_audit_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "refund_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_audit_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "payout_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "finance_audit_refundRequestId_createdAt_idx" ON "finance_audit"("refundRequestId", "createdAt");
CREATE INDEX "finance_audit_payoutRequestId_createdAt_idx" ON "finance_audit"("payoutRequestId", "createdAt");
