import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { rateLimit } from "../services/rate-limit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: import("express").Response, status: number, code: string) =>
  res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const linkView = (link: { id: string; status: string; createdAt: Date; expiresAt: Date; confirmedAt: Date | null }) =>
  ({ id: link.id, status: link.status, createdAt: link.createdAt, expiresAt: link.expiresAt, confirmedAt: link.confirmedAt });

export function accountLinkRouter(db: PrismaClient) {
  const router = Router();
  router.use(authMiddleware(db));

  // The learner explicitly requests a link. A generic response avoids revealing whether an email exists.
  router.post("/requests", requireRole("LEARNER"), rateLimit("account-link-request", 5), async (req, res, next) => {
    const email = req.body?.instructorEmail;
    if (!req.body || Object.keys(req.body).length !== 1 || typeof email !== "string" ||
      email.length > 320 || !emailPattern.test(email)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const learnerId = req.auth!.userId;
      const learner = await db.user.findUnique({ where: { id: learnerId }, select: { learnerProfile: { select: { userId: true } }, instructorProfile: { select: { userId: true } } } });
      if (!learner?.learnerProfile || learner.instructorProfile) { fail(res, 409, "SEPARATE_ACCOUNT_REQUIRED"); return; }
      const instructor = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, status: true, learnerProfile: { select: { userId: true } }, instructorProfile: { select: { userId: true } } } });
      if (instructor && instructor.status === "ACTIVE" && instructor.instructorProfile && !instructor.learnerProfile && instructor.id !== learnerId) {
        const existing = await db.accountLink.findFirst({ where: { OR: [{ learnerId }, { instructorId: instructor.id }] } });
        if (!existing) {
          try { await db.accountLink.create({ data: { learnerId, instructorId: instructor.id, expiresAt: new Date(Date.now() + 15 * 60_000) } }); }
          catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error; }
        } else if (existing.learnerId === learnerId && existing.instructorId === instructor.id && existing.status === "PENDING") {
          await db.accountLink.updateMany({ where: { id: existing.id, status: "PENDING" }, data: { expiresAt: new Date(Date.now() + 15 * 60_000) } });
        }
      }
      res.status(202).json({ status: "pending_if_eligible" });
    } catch (error) { next(error); }
  });

  router.get("/", async (req, res, next) => {
    try {
      const links = await db.accountLink.findMany({ where: { OR: [{ learnerId: req.auth!.userId }, { instructorId: req.auth!.userId }] }, orderBy: { createdAt: "desc" }, take: 50 });
      res.json({ links: links.map((link) => ({ ...linkView(link), accountId: link.learnerId === req.auth!.userId ? link.instructorId : link.learnerId, accountType: link.learnerId === req.auth!.userId ? "INSTRUCTOR" : "LEARNER" })) });
    } catch (error) { next(error); }
  });

  // The instructor confirms from their own authenticated session. Neither side shares a token.
  router.post("/:id/confirm", async (req, res, next) => {
    const id = String(req.params.id);
    if (!uuid.test(id) || (req.body && Object.keys(req.body).length)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const link = await db.accountLink.findUnique({ where: { id }, include: { learner: { select: { status: true, learnerProfile: { select: { userId: true } }, instructorProfile: { select: { userId: true } } } }, instructor: { select: { status: true, learnerProfile: { select: { userId: true } }, instructorProfile: { select: { userId: true } } } } } });
      if (!link || link.instructorId !== req.auth!.userId) { fail(res, 404, "NOT_FOUND"); return; }
      if (link.status !== "PENDING" || link.expiresAt <= new Date() || link.learner.status !== "ACTIVE" || link.instructor.status !== "ACTIVE" ||
        !link.learner.learnerProfile || link.learner.instructorProfile || !link.instructor.instructorProfile || link.instructor.learnerProfile) { fail(res, 409, "LINK_NOT_ELIGIBLE"); return; }
      const result = await db.accountLink.updateMany({ where: { id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "ACTIVE", confirmedAt: new Date() } });
      if (result.count !== 1) { fail(res, 409, "LINK_NOT_ELIGIBLE"); return; }
      res.json({ link: { id, status: "ACTIVE" } });
    } catch (error) { next(error); }
  });

  router.delete("/:id", async (req, res, next) => {
    const id = String(req.params.id);
    if (!uuid.test(id)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const result = await db.accountLink.deleteMany({ where: { id, OR: [{ learnerId: req.auth!.userId }, { instructorId: req.auth!.userId }] } });
      if (!result.count) { fail(res, 404, "NOT_FOUND"); return; }
      res.status(204).send();
    } catch (error) { next(error); }
  });
  return router;
}
