import { Router, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { isFreeCourse } from "../services/entitlements";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });

export function certificateRouter(db: PrismaClient) {
  const router = Router();

  router.post("/courses/:id/certificate", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const courseId = String(req.params.id);
    if (!uuid.test(courseId) || !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}), hashtext(${req.auth!.userId}))`;
        const course = await tx.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, status: true, certificateAvailable: true, price: true, discountPrice: true } });
        if (!course) return { code: "NOT_FOUND", status: 404 };
        const enrollment = await tx.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId } }, include: { payment: true, certificate: true } });
        if (!enrollment || enrollment.status === "CANCELLED" || course.status !== "PUBLISHED" || !isFreeCourse(course) && (enrollment.payment?.status !== "SUCCEEDED" || enrollment.payment.userId !== req.auth!.userId || enrollment.payment.courseId !== courseId)) return { code: "FORBIDDEN", status: 403 };
        if (!course.certificateAvailable) return { code: "CERTIFICATE_UNAVAILABLE", status: 409 };
        if (enrollment.certificate) return { code: "CERTIFICATE_ALREADY_ISSUED", status: 409 };
        const required = await tx.lesson.findMany({ where: { section: { courseId }, isRequired: true }, select: { id: true } });
        if (!required.length) return { code: "COMPLETION_NOT_MET", status: 409 };
        const completed = await tx.lessonProgress.count({ where: { learnerId: req.auth!.userId, lessonId: { in: required.map((lesson) => lesson.id) }, completedAt: { not: null } } });
        if (completed !== required.length) return { code: "COMPLETION_NOT_MET", status: 409 };
        const quizzes = await tx.quiz.findMany({ where: { courseId }, select: { id: true } });
        for (const quiz of quizzes) {
          if (!await tx.quizAttempt.count({ where: { quizId: quiz.id, learnerId: req.auth!.userId, status: "SUBMITTED", passed: true } })) return { code: "COMPLETION_NOT_MET", status: 409 };
        }
        const certificate = await tx.certificate.create({ data: { enrollmentId: enrollment.id } });
        await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
        return { certificate, courseTitle: course.title };
      });
      if ("code" in result) { fail(res, result.status!, result.code!); return; }
      res.status(201).json({ certificate: { id: result.certificate.id, courseId, courseTitle: result.courseTitle, verificationCode: result.certificate.verificationCode, issuedAt: result.certificate.issuedAt, verificationPath: `/api/v1/certificates/verify/${result.certificate.verificationCode}` } });
    } catch (error) { next(error); }
  });

  router.get("/certificates/verify/:code", async (req, res, next) => {
    const code = String(req.params.code);
    if (!uuid.test(code)) { fail(res, 404, "NOT_FOUND"); return; }
    try {
      const certificate = await db.certificate.findUnique({ where: { verificationCode: code }, include: { enrollment: { include: { course: { select: { id: true, title: true } } } } } });
      if (!certificate) { fail(res, 404, "NOT_FOUND"); return; }
      res.json({ certificate: { id: certificate.id, courseId: certificate.enrollment.course.id, courseTitle: certificate.enrollment.course.title, issuedAt: certificate.issuedAt, valid: certificate.revokedAt === null } });
    } catch (error) { next(error); }
  });

  router.get("/certificates/:id", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const id = String(req.params.id);
    if (!uuid.test(id)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const certificate = await db.certificate.findUnique({ where: { id }, include: { enrollment: { include: { course: { select: { id: true, title: true } } } } } });
      if (!certificate) { fail(res, 404, "NOT_FOUND"); return; }
      if (certificate.enrollment.learnerId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; }
      res.json({ certificate: { id, courseId: certificate.enrollment.course.id, courseTitle: certificate.enrollment.course.title, verificationCode: certificate.verificationCode, issuedAt: certificate.issuedAt, valid: certificate.revokedAt === null, verificationPath: `/api/v1/certificates/verify/${certificate.verificationCode}` } });
    } catch (error) { next(error); }
  });
  return router;
}
