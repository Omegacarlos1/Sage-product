import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import type { AppConfig } from "../config/env";
import { authMiddleware, requireRole } from "./auth";
import { isFreeCourse } from "../services/entitlements";
import { PaystackGateway, PaystackInvalidEmailError, type PaymentGateway, validPaystackSignature } from "../services/paystack";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (res: express.Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const view = (payment: { id: string; courseId: string; amount: { toString(): string }; currency: string; status: string; providerReference: string | null; checkoutUrl: string | null; createdAt: Date; settledAt: Date | null }) => ({
  id: payment.id, courseId: payment.courseId, amount: payment.amount.toString(), currency: payment.currency, status: payment.status,
  reference: payment.providerReference, checkoutUrl: payment.checkoutUrl, createdAt: payment.createdAt, settledAt: payment.settledAt,
});

export function paymentRouter(db: PrismaClient, config: AppConfig, gateway: PaymentGateway = new PaystackGateway(config.paystackSecretKey ?? "")) {
  const router = Router();
  router.post("/payments/paystack/webhook", express.raw({ type: "application/json", limit: "100kb" }), async (req, res, next) => {
    if (!config.paystackSecretKey || !Buffer.isBuffer(req.body) || !validPaystackSignature(req.body, req.get("paystack-signature"), req.get("x-paystack-signature"), config.paystackWebhookSecret, config.paystackSecretKey)) { error(res, 401, "INVALID_SIGNATURE"); return; }
    let event: unknown;
    try { event = JSON.parse(req.body.toString("utf8")); } catch { error(res, 400, "INVALID_JSON"); return; }
    if (!event || typeof event !== "object" || !("event" in event) || !("data" in event) || typeof event.data !== "object" || !event.data || !("reference" in event.data) || typeof event.data.reference !== "string") { error(res, 400, "VALIDATION_ERROR"); return; }
    if (event.event !== "charge.success") { res.json({ received: true }); return; }
    const reference = event.data.reference;
    try {
      const payment = await db.payment.findUnique({ where: { providerReference: reference }, include: { user: { select: { email: true } } } });
      if (!payment || payment.provider !== "PAYSTACK") { res.json({ received: true }); return; }
      if (payment.status === "SUCCEEDED") { res.json({ received: true }); return; }
      const verified = await gateway.verify(reference);
      const amount = Number(payment.amount.toString()) * 100;
      if (verified.status !== "success" || verified.reference !== reference || verified.amount !== amount || verified.currency !== "NGN" || verified.customer?.email?.toLowerCase() !== payment.user.email.toLowerCase()) {
        error(res, 409, "PAYMENT_NOT_VERIFIED"); return;
      }
      await db.$transaction(async (tx) => {
        const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", settledAt: new Date() } });
        if (!claimed.count) return;
        const enrollment = await tx.enrollment.upsert({ where: { learnerId_courseId: { learnerId: payment.userId, courseId: payment.courseId } }, create: { learnerId: payment.userId, courseId: payment.courseId }, update: { status: "ACTIVE" }, include: { payment: true } });
        if (!enrollment.payment) await tx.payment.update({ where: { id: payment.id }, data: { enrollmentId: enrollment.id } });
      });
      res.json({ received: true });
    } catch (cause) { next(cause); }
  });

  router.post("/courses/:id/checkout", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    const key = req.get("idempotency-key");
    if (!uuid.test(String(req.params.id)) || !key || !/^[A-Za-z0-9_-]{8,180}$/.test(key) || (req.body && Object.keys(req.body).length)) { error(res, 400, "VALIDATION_ERROR"); return; }
    if (!config.paystackSecretKey) { error(res, 503, "PAYMENT_UNAVAILABLE"); return; }
    try {
      const existing = await db.payment.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        if (existing.userId !== req.auth!.userId || existing.courseId !== String(req.params.id)) { error(res, 409, "IDEMPOTENCY_CONFLICT"); return; }
        if (!existing.checkoutUrl) { error(res, 409, "CHECKOUT_PENDING"); return; }
        res.json({ payment: view(existing) }); return;
      }
      const course = await db.course.findUnique({ where: { id: String(req.params.id) } });
      if (!course || course.status !== "PUBLISHED") { error(res, 404, "NOT_FOUND"); return; }
      if (isFreeCourse(course) || course.currency !== "NGN") { error(res, 400, "UNSUPPORTED_COURSE_PRICE"); return; }
      const amount = Number((course.discountPrice ?? course.price).toString());
      if (!Number.isSafeInteger(amount * 100) || amount < 100) { error(res, 400, "UNSUPPORTED_COURSE_PRICE"); return; }
      const enrollment = await db.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: req.auth!.userId, courseId: course.id } }, include: { payment: true } });
      if (enrollment?.payment?.status === "SUCCEEDED") { error(res, 409, "ALREADY_ENROLLED"); return; }
      const user = await db.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: { email: true } });
      const reference = `sage-${randomUUID()}`;
      const payment = await db.payment.create({ data: { userId: req.auth!.userId, courseId: course.id, amount, currency: "NGN", provider: "PAYSTACK", providerReference: reference, idempotencyKey: key } });
      try {
        const initialized = await gateway.initialize({ email: user.email, amount: amount * 100, reference });
        const updated = await db.payment.update({ where: { id: payment.id }, data: { checkoutUrl: initialized.authorizationUrl } });
        res.status(201).json({ payment: view(updated) });
      } catch (cause) {
        await db.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED" } });
        if (cause instanceof PaystackInvalidEmailError) { error(res, 422, "PAYMENT_EMAIL_INVALID"); return; }
        error(res, 502, "PAYMENT_PROVIDER_ERROR");
      }
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "P2002") { error(res, 409, "IDEMPOTENCY_CONFLICT"); return; }
      next(cause);
    }
  });

  router.get("/learners/me/transactions", authMiddleware(db), requireRole("LEARNER"), async (req, res, next) => {
    try {
      const payments = await db.payment.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: "desc" }, take: 50 });
      res.json({ transactions: payments.map(view) });
    } catch (cause) { next(cause); }
  });
  return router;
}
