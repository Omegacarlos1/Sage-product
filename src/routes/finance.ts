import { Router, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern = /^[A-Za-z0-9_-]{8,180}$/;
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const cents = (value: { toString(): string } | null | undefined) => Math.round(Number(value?.toString() ?? "0") * 100);
const money = (value: number) => (value / 100).toFixed(2);
const refundView = (item: { id: string; paymentId: string; status: string; createdAt: Date }) => ({ id: item.id, paymentId: item.paymentId, status: item.status, createdAt: item.createdAt });
const payoutView = (item: { id: string; amount: { toString(): string }; currency: string; status: string; createdAt: Date }) => ({ id: item.id, amount: money(cents(item.amount)), currency: item.currency, status: item.status, createdAt: item.createdAt });

async function balance(db: PrismaClient, instructorId: string) {
  const [sales, refunds, payouts] = await Promise.all([
    db.payment.aggregate({ where: { course: { instructorId }, status: "SUCCEEDED", currency: "NGN" }, _sum: { amount: true }, _count: true }),
    db.refundRequest.findMany({ where: { status: "PENDING_REVIEW", payment: { course: { instructorId }, status: "SUCCEEDED", currency: "NGN" } }, select: { payment: { select: { amount: true } } } }),
    db.payoutRequest.aggregate({ where: { instructorId, status: "PENDING_REVIEW" }, _sum: { amount: true } }),
  ]);
  const gross = cents(sales._sum.amount);
  const refundHolds = refunds.reduce((total, item) => total + cents(item.payment.amount), 0);
  const payoutHolds = cents(payouts._sum.amount);
  return { currency: "NGN", saleCount: sales._count, grossSales: money(gross), refundHolds: money(refundHolds), payoutHolds: money(payoutHolds), provisionalAvailable: money(gross - refundHolds - payoutHolds), feePolicy: "UNCONFIRMED" };
}

export function financeRouter(db: PrismaClient) {
  const router = Router();
  const auth = authMiddleware(db);

  router.get("/instructors/me/sales", auth, requireRole("INSTRUCTOR"), async (req, res, next) => {
    try {
      const instructorId = req.auth!.userId;
      const [summary, payments] = await Promise.all([
        balance(db, instructorId),
        db.payment.findMany({ where: { course: { instructorId }, status: "SUCCEEDED", currency: "NGN" }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, courseId: true, amount: true, currency: true, settledAt: true } }),
      ]);
      res.json({ summary, sales: payments.map((payment) => ({ paymentId: payment.id, courseId: payment.courseId, amount: money(cents(payment.amount)), currency: payment.currency, settledAt: payment.settledAt })) });
    } catch (cause) { next(cause); }
  });

  router.post("/payments/:paymentId/refund-requests", auth, requireRole("LEARNER"), async (req, res, next) => {
    const paymentId = String(req.params.paymentId);
    const key = req.get("idempotency-key");
    const reason = req.body?.reason;
    if (!uuid.test(paymentId) || !key || !keyPattern.test(key) || typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 500 || Object.keys(req.body ?? {}).some((field) => field !== "reason")) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const existing = await db.refundRequest.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        if (existing.paymentId !== paymentId || existing.requesterId !== req.auth!.userId || existing.reason !== reason.trim()) { fail(res, 409, "IDEMPOTENCY_CONFLICT"); return; }
        res.json({ refundRequest: refundView(existing) }); return;
      }
      const payment = await db.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.userId !== req.auth!.userId) { fail(res, 404, "NOT_FOUND"); return; }
      if (payment.status !== "SUCCEEDED" || payment.currency !== "NGN") { fail(res, 409, "REFUND_NOT_AVAILABLE"); return; }
      const item = await db.$transaction(async (tx) => {
        const created = await tx.refundRequest.create({ data: { paymentId, requesterId: req.auth!.userId, idempotencyKey: key, reason: reason.trim() } });
        await tx.financeAudit.create({ data: { actorId: req.auth!.userId, action: "REFUND_REQUESTED", refundRequestId: created.id } });
        return created;
      });
      res.status(201).json({ refundRequest: refundView(item) });
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "P2002") { fail(res, 409, "REFUND_ALREADY_REQUESTED"); return; }
      next(cause);
    }
  });

  router.get("/learners/me/refund-requests", auth, requireRole("LEARNER"), async (req, res, next) => {
    try { res.json({ refundRequests: (await db.refundRequest.findMany({ where: { requesterId: req.auth!.userId }, orderBy: { createdAt: "desc" }, take: 50 })).map(refundView) }); }
    catch (cause) { next(cause); }
  });

  router.post("/instructors/me/payout-requests", auth, requireRole("INSTRUCTOR"), async (req, res, next) => {
    const key = req.get("idempotency-key");
    const amount = req.body?.amount;
    if (!key || !keyPattern.test(key) || typeof amount !== "string" || !/^[1-9]\d{0,7}(\.\d{2})$/.test(amount) || Object.keys(req.body ?? {}).some((field) => field !== "amount")) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const instructorId = req.auth!.userId;
      const existing = await db.payoutRequest.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        if (existing.instructorId !== instructorId || money(cents(existing.amount)) !== amount) { fail(res, 409, "IDEMPOTENCY_CONFLICT"); return; }
        res.json({ payoutRequest: payoutView(existing) }); return;
      }
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`m14-payout-${instructorId}`}))`;
        const current = await tx.payoutRequest.findUnique({ where: { idempotencyKey: key } });
        if (current) return { item: current, repeated: true };
        const summary = await balance(tx as PrismaClient, instructorId);
        if (cents({ toString: () => summary.provisionalAvailable }) < cents({ toString: () => amount })) return null;
        const item = await tx.payoutRequest.create({ data: { instructorId, idempotencyKey: key, amount, currency: "NGN" } });
        await tx.financeAudit.create({ data: { actorId: instructorId, action: "PAYOUT_REQUESTED", payoutRequestId: item.id } });
        return { item, repeated: false };
      });
      if (!result) { fail(res, 409, "INSUFFICIENT_PROVISIONAL_BALANCE"); return; }
      res.status(result.repeated ? 200 : 201).json({ payoutRequest: payoutView(result.item) });
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "P2002") { fail(res, 409, "IDEMPOTENCY_CONFLICT"); return; }
      next(cause);
    }
  });

  router.get("/instructors/me/payout-requests", auth, requireRole("INSTRUCTOR"), async (req, res, next) => {
    try { res.json({ payoutRequests: (await db.payoutRequest.findMany({ where: { instructorId: req.auth!.userId }, orderBy: { createdAt: "desc" }, take: 50 })).map(payoutView) }); }
    catch (cause) { next(cause); }
  });

  router.post("/admin/refund-requests/:id/reject", auth, requireRole("ADMIN"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id)) || Object.keys(req.body ?? {}).length) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const item = await db.$transaction(async (tx) => {
        const changed = await tx.refundRequest.updateMany({ where: { id: String(req.params.id), status: "PENDING_REVIEW" }, data: { status: "REJECTED" } });
        if (!changed.count) return null;
        const updated = await tx.refundRequest.findUniqueOrThrow({ where: { id: String(req.params.id) } });
        await tx.financeAudit.create({ data: { actorId: req.auth!.userId, action: "REFUND_REJECTED", refundRequestId: updated.id } });
        return updated;
      });
      if (!item) { fail(res, 409, "INVALID_STATE"); return; }
      res.json({ refundRequest: refundView(item) });
    } catch (cause) { next(cause); }
  });

  router.post("/admin/payout-requests/:id/reject", auth, requireRole("ADMIN"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id)) || Object.keys(req.body ?? {}).length) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const item = await db.$transaction(async (tx) => {
        const changed = await tx.payoutRequest.updateMany({ where: { id: String(req.params.id), status: "PENDING_REVIEW" }, data: { status: "REJECTED" } });
        if (!changed.count) return null;
        const updated = await tx.payoutRequest.findUniqueOrThrow({ where: { id: String(req.params.id) } });
        await tx.financeAudit.create({ data: { actorId: req.auth!.userId, action: "PAYOUT_REJECTED", payoutRequestId: updated.id } });
        return updated;
      });
      if (!item) { fail(res, 409, "INVALID_STATE"); return; }
      res.json({ payoutRequest: payoutView(item) });
    } catch (cause) { next(cause); }
  });

  return router;
}
