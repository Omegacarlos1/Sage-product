import { Router, type Response } from "express";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { isFreeCourse } from "../services/entitlements";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function validReview(body: unknown) {
  return object(body) && Object.keys(body).length > 0 && Object.keys(body).every((key) => ["rating", "comment"].includes(key)) &&
    (body.rating === undefined || Number.isInteger(body.rating) && Number(body.rating) >= 1 && Number(body.rating) <= 5) &&
    (body.comment === undefined || body.comment === null || typeof body.comment === "string" && body.comment.trim().length <= 2000);
}
const publicReview = (review: { id: string; rating: number; comment: string | null; createdAt: Date; updatedAt: Date; user: { learnerProfile: { displayName: string | null } | null } }) => ({
  id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt,
  reviewerName: review.user.learnerProfile?.displayName ?? "Learner",
});

export function reviewRouter(db: PrismaClient) {
  const router = Router();
  router.get("/courses/:courseId/reviews", async (req, res, next) => {
    const courseId = String(req.params.courseId);
    const page = Number(req.query.page ?? 1), limit = Number(req.query.limit ?? 20);
    if (!uuid.test(courseId) || Object.keys(req.query).some((key) => !["page", "limit"].includes(key)) || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || (page - 1) * limit > 100000) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findFirst({ where: { id: courseId, status: "PUBLISHED" }, select: { id: true } });
      if (!course) { fail(res, 404, "NOT_FOUND"); return; }
      const where = { courseId, hiddenAt: null };
      const [reviews, aggregate] = await db.$transaction([
        db.review.findMany({ where, select: { id: true, rating: true, comment: true, createdAt: true, updatedAt: true, user: { select: { learnerProfile: { select: { displayName: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }),
        db.review.aggregate({ where, _avg: { rating: true }, _count: { rating: true } }),
      ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      res.json({ reviews: reviews.map(publicReview), rating: { average: aggregate._avg.rating, count: aggregate._count.rating }, page, limit });
    } catch (error) { next(error); }
  });

  router.post("/courses/:courseId/reviews", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const courseId = String(req.params.courseId);
    if (!uuid.test(courseId) || !validReview(req.body) || req.body.rating === undefined) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findUnique({ where: { id: courseId }, select: { status: true, price: true, discountPrice: true } });
      if (!course) { fail(res, 404, "NOT_FOUND"); return; }
      const enrollment = await db.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId } }, include: { payment: true } });
      if (course.status !== "PUBLISHED" || !enrollment || enrollment.status === "CANCELLED" || !isFreeCourse(course) && (enrollment.payment?.status !== "SUCCEEDED" || enrollment.payment.userId !== req.auth!.userId || enrollment.payment.courseId !== courseId)) { fail(res, 403, "FORBIDDEN"); return; }
      const review = await db.review.create({ data: { userId: req.auth!.userId, courseId, rating: req.body.rating as number, comment: typeof req.body.comment === "string" ? req.body.comment.trim() || null : null } });
      res.status(201).json({ review: { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { fail(res, 409, "REVIEW_EXISTS"); return; }
      next(error);
    }
  });

  router.patch("/courses/:courseId/reviews/mine", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const courseId = String(req.params.courseId);
    if (!uuid.test(courseId) || !validReview(req.body)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const existing = await db.review.findUnique({ where: { userId_courseId: { userId: req.auth!.userId, courseId } } });
      if (!existing) { fail(res, 404, "NOT_FOUND"); return; }
      if (existing.hiddenAt) { fail(res, 403, "REVIEW_HIDDEN"); return; }
      const enrollment = await db.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId } }, include: { payment: true, course: true } });
      if (!enrollment || enrollment.status === "CANCELLED" || enrollment.course.status !== "PUBLISHED" || !isFreeCourse(enrollment.course) && (enrollment.payment?.status !== "SUCCEEDED" || enrollment.payment.userId !== req.auth!.userId || enrollment.payment.courseId !== courseId)) { fail(res, 403, "FORBIDDEN"); return; }
      const review = await db.review.update({ where: { id: existing.id }, data: { rating: req.body.rating as number | undefined, comment: req.body.comment === undefined ? undefined : typeof req.body.comment === "string" ? req.body.comment.trim() || null : null } });
      res.json({ review: { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt } });
    } catch (error) { next(error); }
  });

  router.patch("/reviews/:reviewId/moderation", authMiddleware(db), requireRole("ADMIN"), async (req, res, next) => {
    const reviewId = String(req.params.reviewId);
    if (!uuid.test(reviewId) || !object(req.body) || typeof req.body.hidden !== "boolean" || Object.keys(req.body).some((key) => !["hidden", "reason"].includes(key)) || (req.body.hidden && (typeof req.body.reason !== "string" || !req.body.reason.trim() || req.body.reason.length > 500)) || (!req.body.hidden && req.body.reason !== undefined)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const result = await db.review.updateMany({ where: { id: reviewId }, data: { hiddenAt: req.body.hidden ? new Date() : null, moderationReason: req.body.hidden ? (req.body.reason as string).trim() : null } });
      if (!result.count) { fail(res, 404, "NOT_FOUND"); return; }
      res.json({ reviewId, hidden: req.body.hidden });
    } catch (error) { next(error); }
  });
  return router;
}
