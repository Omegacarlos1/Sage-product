import { Router, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { createNotification, publishNotification, type NotificationPublisher, noPublisher } from "../services/notifications";
import { hasLessonEntitlement } from "../services/entitlements";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));

function validQuiz(body: unknown): body is Record<string, unknown> {
  if (!object(body) || !keys(body, ["title", "lessonId", "passingScore", "attemptLimit", "timeLimitSeconds", "opensAt", "closesAt", "questions"])) return false;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 180 || !Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 100) return false;
  if (body.lessonId !== undefined && (!uuid.test(String(body.lessonId)) || typeof body.lessonId !== "string")) return false;
  if (body.passingScore !== undefined && (typeof body.passingScore !== "number" || !Number.isFinite(body.passingScore) || body.passingScore < 0 || body.passingScore > 100 || Math.round(body.passingScore * 100) !== body.passingScore * 100)) return false;
  if (body.attemptLimit !== undefined && (!Number.isSafeInteger(body.attemptLimit) || Number(body.attemptLimit) < 1 || Number(body.attemptLimit) > 100)) return false;
  if (body.timeLimitSeconds !== undefined && (!Number.isSafeInteger(body.timeLimitSeconds) || Number(body.timeLimitSeconds) < 1 || Number(body.timeLimitSeconds) > 86400)) return false;
  if (body.opensAt !== undefined && !date(body.opensAt) || body.closesAt !== undefined && !date(body.closesAt)) return false;
  if (body.opensAt && body.closesAt && Date.parse(String(body.opensAt)) >= Date.parse(String(body.closesAt))) return false;
  return body.questions.every((q: unknown) => {
    if (!object(q) || !keys(q, ["prompt", "type", "points", "options"]) || typeof q.prompt !== "string" || !q.prompt.trim() || q.prompt.length > 2000 || !["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(String(q.type)) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 10) return false;
    if (q.points !== undefined && (!Number.isSafeInteger(q.points) || Number(q.points) < 1 || Number(q.points) > 100)) return false;
    if (!q.options.every((o: unknown) => object(o) && keys(o, ["text", "isCorrect"]) && typeof o.text === "string" && !!o.text.trim() && o.text.length <= 500 && typeof o.isCorrect === "boolean")) return false;
    const correct = q.options.filter((o: { isCorrect: boolean }) => o.isCorrect).length;
    return correct >= 1 && (q.type === "MULTIPLE_CHOICE" || correct === 1) && (q.type !== "TRUE_FALSE" || q.options.length === 2);
  });
}

const publicQuiz = (quiz: { id: string; courseId: string; title: string; passingScore: unknown; attemptLimit: number | null; timeLimitSeconds: number | null; opensAt: Date | null; closesAt: Date | null; questions: { id: string; prompt: string; type: string; points: unknown; orderIndex: number; options: { id: string; text: string; orderIndex: number }[] }[] }) => ({
  id: quiz.id, courseId: quiz.courseId, title: quiz.title, passingScore: quiz.passingScore, attemptLimit: quiz.attemptLimit, timeLimitSeconds: quiz.timeLimitSeconds, opensAt: quiz.opensAt, closesAt: quiz.closesAt,
  questions: quiz.questions.map((q) => ({ id: q.id, prompt: q.prompt, type: q.type, points: q.points, orderIndex: q.orderIndex, options: q.options.map((o) => ({ id: o.id, text: o.text, orderIndex: o.orderIndex })) })),
});

const questionInclude = { questions: { orderBy: { orderIndex: "asc" as const }, include: { options: { orderBy: { orderIndex: "asc" as const } } } }, course: true };

export function quizRouter(db: PrismaClient, publish: NotificationPublisher = noPublisher) {
  const router = Router();
  router.use("/courses/:courseId/quizzes", authMiddleware(db));
  router.use("/quizzes", authMiddleware(db));
  router.use("/quiz-attempts", authMiddleware(db));
  router.post("/courses/:courseId/quizzes", requireRole("INSTRUCTOR"), async (req, res, next) => {
    if (!uuid.test(String(req.params.courseId)) || !validQuiz(req.body)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findUnique({ where: { id: String(req.params.courseId) } });
      if (!course) { fail(res, 404, "NOT_FOUND"); return; }
      if (course.instructorId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; }
      if (course.status !== "DRAFT") { fail(res, 409, "INVALID_STATUS"); return; }
      if (req.body.lessonId && !await db.lesson.count({ where: { id: req.body.lessonId as string, section: { courseId: course.id } } })) { fail(res, 400, "INVALID_REFERENCE"); return; }
      const body = req.body;
      const quiz = await db.quiz.create({ data: { courseId: course.id, title: String(body.title).trim(), lessonId: body.lessonId as string | undefined, passingScore: body.passingScore as number | undefined, attemptLimit: body.attemptLimit as number | undefined, timeLimitSeconds: body.timeLimitSeconds as number | undefined, opensAt: body.opensAt ? new Date(String(body.opensAt)) : undefined, closesAt: body.closesAt ? new Date(String(body.closesAt)) : undefined,
        questions: { create: (body.questions as Record<string, unknown>[]).map((q, i) => ({ prompt: String(q.prompt).trim(), type: q.type as "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE", points: q.points as number | undefined, orderIndex: i, options: { create: (q.options as Record<string, unknown>[]).map((o, j) => ({ text: String(o.text).trim(), isCorrect: o.isCorrect as boolean, orderIndex: j })) } })) } }, include: questionInclude });
      res.status(201).json({ quiz: publicQuiz(quiz) });
    } catch (error) { next(error); }
  });
  router.get("/quizzes/:id", requireRole("LEARNER"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const quiz = await db.quiz.findUnique({ where: { id: String(req.params.id) }, include: questionInclude });
      if (!quiz) { fail(res, 404, "NOT_FOUND"); return; }
      if (!await hasLessonEntitlement(db, quiz.course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      res.json({ quiz: publicQuiz(quiz) });
    } catch (error) { next(error); }
  });
  router.post("/quizzes/:id/attempts", requireRole("LEARNER"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id)) || !object(req.body) || Object.keys(req.body).length) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const quiz = await db.quiz.findUnique({ where: { id: String(req.params.id) }, include: questionInclude });
      if (!quiz) { fail(res, 404, "NOT_FOUND"); return; }
      if (!await hasLessonEntitlement(db, quiz.course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${quiz.id}), hashtext(${req.auth!.userId}))`;
        const now = new Date();
        if (quiz.opensAt && now < quiz.opensAt) return { code: "QUIZ_NOT_OPEN" };
        if (quiz.closesAt && now >= quiz.closesAt) return { code: "QUIZ_CLOSED" };
        const rows = await tx.quizAttempt.findMany({ where: { quizId: quiz.id, learnerId: req.auth!.userId }, orderBy: { startedAt: "desc" } });
        const active = rows.find((row) => row.status === "IN_PROGRESS" && (!quiz.timeLimitSeconds || now.getTime() <= row.startedAt.getTime() + quiz.timeLimitSeconds * 1000));
        if (active) return { code: "ATTEMPT_IN_PROGRESS" };
        if (quiz.attemptLimit !== null && rows.length >= quiz.attemptLimit) return { code: "ATTEMPT_LIMIT_REACHED" };
        const attempt = await tx.quizAttempt.create({ data: { quizId: quiz.id, learnerId: req.auth!.userId, startedAt: now } });
        return { attempt };
      });
      if ("code" in result) { fail(res, 409, result.code!); return; }
      res.status(201).json({ attempt: result.attempt, quiz: publicQuiz(quiz) });
    } catch (error) { next(error); }
  });
  router.post("/quiz-attempts/:id/submit", requireRole("LEARNER"), async (req, res, next) => {
    const answers = req.body?.answers;
    if (!uuid.test(String(req.params.id)) || !object(req.body) || !keys(req.body, ["answers"]) || !Array.isArray(answers) || answers.length > 100 || !answers.every((a: unknown) => object(a) && keys(a, ["questionId", "optionIds"]) && typeof a.questionId === "string" && uuid.test(a.questionId) && Array.isArray(a.optionIds) && a.optionIds.length >= 1 && a.optionIds.length <= 10 && a.optionIds.every((id: unknown) => typeof id === "string" && uuid.test(id)) && new Set(a.optionIds).size === a.optionIds.length)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const attempt = await db.quizAttempt.findUnique({ where: { id: String(req.params.id) }, include: { quiz: { include: questionInclude } } });
      if (!attempt) { fail(res, 404, "NOT_FOUND"); return; }
      if (attempt.learnerId !== req.auth!.userId || !await hasLessonEntitlement(db, attempt.quiz.course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      if (attempt.status !== "IN_PROGRESS") { fail(res, 409, "ATTEMPT_CLOSED"); return; }
      const now = new Date();
      if (attempt.quiz.timeLimitSeconds && now.getTime() > attempt.startedAt.getTime() + attempt.quiz.timeLimitSeconds * 1000 || attempt.quiz.closesAt && now >= attempt.quiz.closesAt) {
        await db.quizAttempt.updateMany({ where: { id: attempt.id, status: "IN_PROGRESS" }, data: { status: "EXPIRED" } });
        fail(res, 409, "ATTEMPT_EXPIRED"); return;
      }
      const submitted = answers as { questionId: string; optionIds: string[] }[];
      const byQuestion = new Map(submitted.map((a) => [a.questionId, a.optionIds]));
      if (byQuestion.size !== submitted.length || submitted.length !== attempt.quiz.questions.length || attempt.quiz.questions.some((q) => { const ids = byQuestion.get(q.id); return !ids || (q.type !== "MULTIPLE_CHOICE" && ids.length !== 1) || ids.some((id) => !q.options.some((o) => o.id === id)); })) { fail(res, 400, "VALIDATION_ERROR"); return; }
      const earned = attempt.quiz.questions.reduce((sum, q) => { const selected = byQuestion.get(q.id)!; const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id); return sum + (selected.length === correct.length && selected.every((id) => correct.includes(id)) ? Number(q.points) : 0); }, 0);
      const possible = attempt.quiz.questions.reduce((sum, q) => sum + Number(q.points), 0);
      const score = Math.round(earned * 10000 / possible) / 100;
      const passed = score >= Number(attempt.quiz.passingScore);
      const result = await db.$transaction(async (tx) => {
        const updated = await tx.quizAttempt.updateMany({ where: { id: attempt.id, status: "IN_PROGRESS" }, data: { status: "SUBMITTED", score, passed, submittedAt: now } });
        if (!updated.count) return null;
        await tx.quizAnswer.createMany({ data: submitted.map((a) => ({ attemptId: attempt.id, questionId: a.questionId, selectedOptionIds: a.optionIds })) });
        return createNotification(tx, req.auth!.userId, "ASSESSMENT", "Quiz result available", { event: "QUIZ_RESULT", attemptId: attempt.id });
      });
      if (!result) { fail(res, 409, "ATTEMPT_CLOSED"); return; }
      publishNotification(publish, result);
      res.json({ result: { attemptId: attempt.id, score, passed, earnedPoints: earned, possiblePoints: possible, submittedAt: now, answers: attempt.quiz.questions.map((q) => ({ questionId: q.id, correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id), selectedOptionIds: byQuestion.get(q.id) })) } });
    } catch (error) { next(error); }
  });
  router.get("/quiz-attempts/:id/result", requireRole("LEARNER"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const attempt = await db.quizAttempt.findUnique({ where: { id: String(req.params.id) }, include: { answers: true, quiz: { include: questionInclude } } });
      if (!attempt) { fail(res, 404, "NOT_FOUND"); return; }
      if (attempt.learnerId !== req.auth!.userId || !await hasLessonEntitlement(db, attempt.quiz.course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      if (attempt.status !== "SUBMITTED") { fail(res, 409, "RESULT_NOT_AVAILABLE"); return; }
      res.json({ result: { attemptId: attempt.id, score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt, answers: attempt.quiz.questions.map((q) => ({ questionId: q.id, correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id), selectedOptionIds: attempt.answers.find((a) => a.questionId === q.id)?.selectedOptionIds ?? [] })) } });
    } catch (error) { next(error); }
  });
  return router;
}
