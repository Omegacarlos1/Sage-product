ALTER TABLE "quizzes" ADD COLUMN "opensAt" TIMESTAMPTZ(3), ADD COLUMN "closesAt" TIMESTAMPTZ(3);
ALTER TABLE "quiz_answers" ADD COLUMN "selectedOptionIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_window_order" CHECK ("opensAt" IS NULL OR "closesAt" IS NULL OR "opensAt" < "closesAt");
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_passing_score" CHECK ("passingScore" >= 0 AND "passingScore" <= 100);
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_attempt_limit" CHECK ("attemptLimit" IS NULL OR "attemptLimit" > 0);
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_time_limit" CHECK ("timeLimitSeconds" IS NULL OR "timeLimitSeconds" > 0);
