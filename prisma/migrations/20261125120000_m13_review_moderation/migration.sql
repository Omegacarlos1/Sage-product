ALTER TABLE "reviews" ADD COLUMN "hiddenAt" TIMESTAMPTZ(3), ADD COLUMN "moderationReason" VARCHAR(500);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK (rating BETWEEN 1 AND 5);
CREATE INDEX "reviews_courseId_hiddenAt_createdAt_idx" ON "reviews"("courseId", "hiddenAt", "createdAt");
