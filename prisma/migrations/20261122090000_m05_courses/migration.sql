ALTER TABLE "categories" ADD COLUMN "ownerId" UUID;
ALTER TABLE "courses" ADD COLUMN "discountPrice" DECIMAL(10,2);
ALTER TABLE "categories" ADD CONSTRAINT "categories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "instructor_profiles"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "categories_ownerId_idx" ON "categories"("ownerId");
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_check" CHECK ("price" >= 0 AND "discountPrice" >= 0 AND ("discountPrice" IS NULL OR "discountPrice" < "price"));
