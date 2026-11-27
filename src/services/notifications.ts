import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { Router } from "express";
import { authMiddleware } from "../routes/auth";

export type NotificationEvent = { id: string; type: string; title: string; createdAt: Date };
export type NotificationPublisher = (userId: string, event: NotificationEvent) => void;
export const noPublisher: NotificationPublisher = () => {};

export async function createNotification(db: Prisma.TransactionClient, userId: string, type: "COURSE" | "ASSESSMENT" | "CERTIFICATE" | "GENERAL", title: string, payload: Prisma.InputJsonObject) {
  return db.notification.create({ data: { userId, type, title, payload } });
}

export function publishNotification(publish: NotificationPublisher, notification: { id: string; userId: string; type: string; title: string; createdAt: Date }) {
  try { publish(notification.userId, { id: notification.id, type: notification.type, title: notification.title, createdAt: notification.createdAt }); }
  catch { console.warn(JSON.stringify({ level: "warn", message: "Notification delivery failed; REST history remains available." })); }
}

export function notificationRouter(db: PrismaClient) {
  const router = Router();
  router.use(authMiddleware(db));
  router.get("/", async (req, res, next) => {
    const page = Number(req.query.page ?? 1), limit = Number(req.query.limit ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || Object.keys(req.query).some((key) => !["page", "limit"].includes(key))) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid pagination." } }); return; }
    try {
      const where = { userId: req.auth!.userId };
      const [notifications, total] = await db.$transaction([db.notification.findMany({ where, select: { id: true, type: true, title: true, payload: true, readAt: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), db.notification.count({ where })]);
      res.json({ notifications, total, page, limit });
    } catch (error) { next(error); }
  });
  router.patch("/:id/read", async (req, res, next) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request." } }); return; }
    try {
      await db.notification.updateMany({ where: { id, userId: req.auth!.userId, readAt: null }, data: { readAt: new Date() } });
      const notification = await db.notification.findFirst({ where: { id, userId: req.auth!.userId }, select: { id: true, type: true, title: true, payload: true, readAt: true, createdAt: true } });
      if (!notification) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found." } }); return; }
      res.json({ notification });
    } catch (error) { next(error); }
  });
  return router;
}
