import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { isFreeCourse } from "../services/entitlements";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: import("express").Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });

export function enrollmentRouter(db: PrismaClient) {
  const router = Router();
  router.post("/courses/:id/enroll", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id)) || (req.body && Object.keys(req.body).length)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findUnique({ where: { id: String(req.params.id) } });
      if (!course || course.status !== "PUBLISHED") { fail(res, 404, "NOT_FOUND"); return; }
      if (!isFreeCourse(course)) { fail(res, 403, "PAYMENT_REQUIRED"); return; }
      const existing = await db.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId: course.id } } });
      if (existing) { fail(res, 409, "ALREADY_ENROLLED"); return; }
      const enrollment = await db.enrollment.create({ data: { learnerId: req.auth!.userId, courseId: course.id } });
      res.status(201).json({ enrollment: { id: enrollment.id, courseId: enrollment.courseId, status: enrollment.status, enrolledAt: enrollment.enrolledAt } });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") { fail(res, 409, "ALREADY_ENROLLED"); return; }
      next(error);
    }
  });
  router.get("/learners/me/courses", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    try {
      const enrollments = await db.enrollment.findMany({ where: { learnerId: req.auth!.userId }, orderBy: { enrolledAt: "desc" }, include: { course: { select: { id: true, title: true, slug: true, status: true, price: true, discountPrice: true, currency: true } }, payment: { select: { status: true, userId: true, courseId: true } } } });
      res.json({ courses: enrollments.map(({ course, payment, id, status, enrolledAt }) => ({ enrollmentId: id, status, enrolledAt, course, access: status === "ACTIVE" && course.status === "PUBLISHED" && (isFreeCourse(course) || payment?.status === "SUCCEEDED" && payment.userId === req.auth!.userId && payment.courseId === course.id) })) });
    } catch (error) { next(error); }
  });
  return router;
}
