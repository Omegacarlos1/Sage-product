CREATE TABLE "lesson_media" (
  "id" UUID NOT NULL,
  "lessonId" UUID NOT NULL,
  "storageKey" VARCHAR(160) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "lesson_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_media_size_check" CHECK ("sizeBytes" > 0),
  CONSTRAINT "lesson_media_status_check" CHECK ("status" IN ('PENDING', 'READY'))
);
CREATE UNIQUE INDEX "lesson_media_lessonId_key" ON "lesson_media"("lessonId");
CREATE UNIQUE INDEX "lesson_media_storageKey_key" ON "lesson_media"("storageKey");
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
