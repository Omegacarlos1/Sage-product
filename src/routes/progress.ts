import { Router, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { hasLessonEntitlement } from "../services/entitlements";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });

export function progressRouter(db: PrismaClient) {
  const router = Router();
  router.put("/lessons/:id/progress", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const id = String(req.params.id);
    const body = req.body;
    if (!uuid.test(id) || !body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some((key) => !["completed", "bookmarked", "note", "lastPositionSeconds"].includes(key)) ||
      (body.completed !== undefined && body.completed !== true) || (body.bookmarked !== undefined && typeof body.bookmarked !== "boolean") ||
      (body.note !== undefined && body.note !== null && (typeof body.note !== "string" || body.note.length > 5000)) ||
      (body.lastPositionSeconds !== undefined && (!Number.isSafeInteger(body.lastPositionSeconds) || body.lastPositionSeconds < 0))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const lesson = await db.lesson.findUnique({ where: { id }, include: { section: { include: { course: true } } } });
      if (!lesson) { fail(res, 404, "NOT_FOUND"); return; }
      const course = lesson.section.course;
      if (!await hasLessonEntitlement(db, course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      if (body.lastPositionSeconds !== undefined && lesson.durationSeconds !== null && body.lastPositionSeconds > lesson.durationSeconds) { fail(res, 400, "VALIDATION_ERROR"); return; }
      const progress = await db.$transaction(async (tx) => {
        const row = await tx.lessonProgress.upsert({
          where: { learnerId_lessonId: { learnerId: req.auth!.userId, lessonId: id } },
          create: { learnerId: req.auth!.userId, lessonId: id, completedAt: body.completed ? new Date() : null, bookmarked: body.bookmarked ?? false, note: body.note ?? null, lastPositionSeconds: body.lastPositionSeconds ?? 0 },
          update: { ...(body.bookmarked !== undefined ? { bookmarked: body.bookmarked } : {}), ...(body.note !== undefined ? { note: body.note } : {}), ...(body.lastPositionSeconds !== undefined ? { lastPositionSeconds: body.lastPositionSeconds } : {}) },
        });
        if (body.completed && !row.completedAt) return tx.lessonProgress.update({ where: { id: row.id }, data: { completedAt: new Date() } });
        return row;
      });
      res.json({ progress });
    } catch (error) { next(error); }
  });

  router.get("/courses/:id/progress", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const id = String(req.params.id);
    if (!uuid.test(id)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findUnique({ where: { id }, include: { sections: { orderBy: { orderIndex: "asc" }, include: { lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, isRequired: true } } } } } });
      if (!course) { fail(res, 404, "NOT_FOUND"); return; }
      if (!await hasLessonEntitlement(db, course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      const enrollment = await db.enrollment.findUniqueOrThrow({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId: id } } });
      const lessons = course.sections.flatMap((section) => section.lessons);
      const rows = await db.lessonProgress.findMany({ where: { learnerId: req.auth!.userId, lessonId: { in: lessons.map((lesson) => lesson.id) } } });
      const byLesson = new Map(rows.map((row) => [row.lessonId, row]));
      const required = lessons.filter((lesson) => lesson.isRequired);
      const completed = required.filter((lesson) => byLesson.get(lesson.id)?.completedAt);
      res.json({ courseId: id, requiredLessons: required.length, completedRequiredLessons: completed.length, completionPercent: required.length ? Math.round(completed.length * 100 / required.length) : 0, complete: required.length > 0 && completed.length === required.length, resumeLessonId: enrollment.resumeLessonId, lessons: lessons.map((lesson) => ({ ...lesson, completedAt: byLesson.get(lesson.id)?.completedAt ?? null, bookmarked: byLesson.get(lesson.id)?.bookmarked ?? false, note: byLesson.get(lesson.id)?.note ?? null, lastPositionSeconds: byLesson.get(lesson.id)?.lastPositionSeconds ?? 0 })) });
    } catch (error) { next(error); }
  });

  router.put("/courses/:id/resume", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const id = String(req.params.id), lessonId = req.body?.lessonId;
    if (!uuid.test(id) || !uuid.test(String(lessonId)) || Object.keys(req.body ?? {}).some((key) => key !== "lessonId")) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findUnique({ where: { id } });
      if (!course) { fail(res, 404, "NOT_FOUND"); return; }
      if (!await hasLessonEntitlement(db, course, req.auth!.userId)) { fail(res, 403, "FORBIDDEN"); return; }
      if (!await db.lesson.count({ where: { id: lessonId, section: { courseId: id } } })) { fail(res, 400, "VALIDATION_ERROR"); return; }
      const enrollment = await db.enrollment.update({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId: id } }, data: { resumeLessonId: lessonId } });
      res.json({ courseId: id, resumeLessonId: enrollment.resumeLessonId });
    } catch (error) { next(error); }
  });
  return router;
}
