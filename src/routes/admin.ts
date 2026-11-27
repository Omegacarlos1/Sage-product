import { Router, type Response } from "express";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const pageArgs = (query: Record<string, unknown>) => {
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 20);
  return Object.keys(query).every((key) => ["page", "limit"].includes(key)) && Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 50 && (page - 1) * limit <= 100000 ? { page, limit } : null;
};
const bodyStatus = (body: unknown, allowed: string[]) => body !== null && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 && "status" in body && typeof body.status === "string" && allowed.includes(body.status) ? body.status : null;

export function adminRouter(db: PrismaClient) {
  const router = Router();
  router.use(authMiddleware(db), requireRole("ADMIN"));

  router.get("/users", async (req, res, next) => {
    const paging = pageArgs(req.query);
    if (!paging) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const [users, total] = await db.$transaction([
        db.user.findMany({ select: { id: true, email: true, status: true, createdAt: true, roleAssignments: { select: { role: { select: { code: true } } } }, instructorProfile: { select: { displayName: true, verificationStatus: true } } }, orderBy: { createdAt: "desc" }, skip: (paging.page - 1) * paging.limit, take: paging.limit }),
        db.user.count(),
      ]);
      res.json({ users, total, ...paging });
    } catch (error) { next(error); }
  });

  router.patch("/users/:id/status", async (req, res, next) => {
    const id = String(req.params.id), status = bodyStatus(req.body, ["ACTIVE", "SUSPENDED"]);
    if (!uuid.test(id) || !status) { fail(res, 400, "VALIDATION_ERROR"); return; }
    if (id === req.auth!.userId) { fail(res, 409, "SELF_STATUS_CHANGE"); return; }
    try {
      const result = await db.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id }, select: { status: true, roleAssignments: { select: { role: { select: { code: true } } } } } });
        if (!current) return "NOT_FOUND";
        if (current.status === "DELETED" || current.status === status) return "INVALID_STATUS";
        if (current.roleAssignments.some((item) => item.role.code === "ADMIN")) return "ADMIN_PROTECTED";
        const changed = await tx.user.updateMany({ where: { id, status: current.status }, data: { status: status as "ACTIVE" | "SUSPENDED" } });
        if (!changed.count) return "INVALID_STATUS";
        if (status === "SUSPENDED") await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.adminAudit.create({ data: { actorId: req.auth!.userId, action: "USER_STATUS_CHANGED", targetType: "USER", targetId: id, oldValue: current.status, newValue: status } });
        return null;
      });
      if (result) { fail(res, result === "NOT_FOUND" ? 404 : 409, result); return; }
      res.json({ user: { id, status } });
    } catch (error) { next(error); }
  });

  router.get("/instructors", async (req, res, next) => {
    const paging = pageArgs(req.query);
    if (!paging) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const [instructors, total] = await db.$transaction([
        db.instructorProfile.findMany({ select: { userId: true, displayName: true, verificationStatus: true, createdAt: true, user: { select: { status: true } } }, orderBy: { createdAt: "desc" }, skip: (paging.page - 1) * paging.limit, take: paging.limit }),
        db.instructorProfile.count(),
      ]);
      res.json({ instructors, total, ...paging });
    } catch (error) { next(error); }
  });

  router.patch("/instructors/:id/verification", async (req, res, next) => {
    const id = String(req.params.id), status = bodyStatus(req.body, ["VERIFIED", "REJECTED"]);
    if (!uuid.test(id) || !status) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const result = await db.$transaction(async (tx) => {
        const current = await tx.instructorProfile.findUnique({ where: { userId: id }, select: { verificationStatus: true, user: { select: { status: true } } } });
        if (!current) return "NOT_FOUND";
        if (current.verificationStatus !== "PENDING" || current.user.status !== "ACTIVE") return "INVALID_STATUS";
        const changed = await tx.instructorProfile.updateMany({ where: { userId: id, verificationStatus: "PENDING" }, data: { verificationStatus: status as "VERIFIED" | "REJECTED" } });
        if (!changed.count) return "INVALID_STATUS";
        await tx.adminAudit.create({ data: { actorId: req.auth!.userId, action: "INSTRUCTOR_VERIFICATION", targetType: "INSTRUCTOR", targetId: id, oldValue: "PENDING", newValue: status } });
        return null;
      });
      if (result) { fail(res, result === "NOT_FOUND" ? 404 : 409, result); return; }
      res.json({ instructor: { userId: id, verificationStatus: status } });
    } catch (error) { next(error); }
  });

  router.get("/courses/review", async (req, res, next) => {
    const paging = pageArgs(req.query);
    if (!paging) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const where = { status: "IN_REVIEW" as const };
      const [courses, total] = await db.$transaction([db.course.findMany({ where, select: { id: true, title: true, status: true, instructorId: true, createdAt: true }, orderBy: { createdAt: "asc" }, skip: (paging.page - 1) * paging.limit, take: paging.limit }), db.course.count({ where })]);
      res.json({ courses, total, ...paging });
    } catch (error) { next(error); }
  });

  async function decideCourse(id: string, actorId: string, decision: "approve" | "reject") {
    return db.$transaction(async (tx) => {
      const current = await tx.course.findUnique({ where: { id }, select: { status: true } });
      if (!current) return "NOT_FOUND" as const;
      if (current.status !== "IN_REVIEW") return "INVALID_STATUS" as const;
      const status = decision === "approve" ? "PUBLISHED" : "REJECTED";
      const changed = await tx.course.updateMany({ where: { id, status: "IN_REVIEW" }, data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) } });
      if (!changed.count) return "INVALID_STATUS" as const;
      await tx.adminAudit.create({ data: { actorId, action: decision === "approve" ? "COURSE_APPROVED" : "COURSE_REJECTED", targetType: "COURSE", targetId: id, oldValue: "IN_REVIEW", newValue: status } });
      return { id, status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
  for (const decision of ["approve", "reject"] as const) router.post(`/courses/:id/${decision}`, async (req, res, next) => {
    const id = String(req.params.id);
    if (!uuid.test(id) || req.body && Object.keys(req.body).length) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const result = await decideCourse(id, req.auth!.userId, decision);
      if (typeof result === "string") { fail(res, result === "NOT_FOUND" ? 404 : 409, result); return; }
      res.json({ course: result });
    } catch (error) { next(error); }
  });

  router.get("/transactions", async (req, res, next) => {
    const paging = pageArgs(req.query);
    if (!paging) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const [transactions, total] = await db.$transaction([db.payment.findMany({ select: { id: true, courseId: true, amount: true, currency: true, status: true, provider: true, createdAt: true, settledAt: true }, orderBy: { createdAt: "desc" }, skip: (paging.page - 1) * paging.limit, take: paging.limit }), db.payment.count()]);
      res.json({ transactions, total, ...paging });
    } catch (error) { next(error); }
  });

  router.get("/analytics", async (_req, res, next) => {
    try {
      const [users, instructors, publishedCourses, enrollments, succeededPayments, revenue] = await db.$transaction([db.user.count({ where: { status: "ACTIVE" } }), db.instructorProfile.count({ where: { verificationStatus: "VERIFIED" } }), db.course.count({ where: { status: "PUBLISHED" } }), db.enrollment.count({ where: { status: "ACTIVE" } }), db.payment.count({ where: { status: "SUCCEEDED", currency: "NGN" } }), db.payment.aggregate({ where: { status: "SUCCEEDED", currency: "NGN" }, _sum: { amount: true } })]);
      res.json({ users, instructors, publishedCourses, enrollments, succeededPayments, grossNgn: revenue._sum.amount?.toFixed(2) ?? "0.00" });
    } catch (error) { next(error); }
  });

  router.get("/audit", async (req, res, next) => {
    const paging = pageArgs(req.query);
    if (!paging) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try { res.json({ events: await db.adminAudit.findMany({ orderBy: { createdAt: "desc" }, skip: (paging.page - 1) * paging.limit, take: paging.limit }), ...paging }); } catch (error) { next(error); }
  });
  return router;
}
