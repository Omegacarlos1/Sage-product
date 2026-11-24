ALTER TABLE "lessons" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lesson_progress" ADD COLUMN "bookmarked" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "note" VARCHAR(5000);
ALTER TABLE "enrollments" ADD COLUMN "resumeLessonId" UUID;
