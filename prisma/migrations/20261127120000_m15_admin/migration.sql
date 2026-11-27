ALTER TYPE "CourseStatus" ADD VALUE 'REJECTED';

CREATE TABLE "admin_audit" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "action" VARCHAR(60) NOT NULL,
  "targetType" VARCHAR(30) NOT NULL,
  "targetId" UUID NOT NULL,
  "oldValue" VARCHAR(60),
  "newValue" VARCHAR(60) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_audit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "admin_audit_targetType_targetId_createdAt_idx" ON "admin_audit"("targetType", "targetId", "createdAt");
CREATE FUNCTION prevent_admin_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin audit rows are immutable';
END;
$$;
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON "admin_audit"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();
