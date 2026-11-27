import { Router } from "express";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { rateLimit } from "../services/rate-limit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmail = (value: unknown): value is string => typeof value === "string" && value.length <= 320 && emailPattern.test(value);
const validText = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const error = (code: string, message: string) => ({ error: { code, message } });

export function publicSubmissionsRouter(db: PrismaClient) {
  const router = Router();
  router.post("/contact", rateLimit("contact", 5), async (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["name", "email", "subject", "message"].includes(key)) ||
      !validText(body.name, 120) || !validEmail(body.email) || !validText(body.subject, 180) || !validText(body.message, 5000)) { res.status(400).json(error("VALIDATION_ERROR", "Invalid contact fields.")); return; }
    try {
      await db.contactMessage.create({ data: { name: body.name.trim(), email: body.email.trim().toLowerCase(), subject: body.subject.trim(), message: body.message.trim() } });
      res.status(201).json({ status: "received" });
    } catch (caught) { next(caught); }
  });
  router.post("/newsletter/subscribe", rateLimit("newsletter", 20), async (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !validEmail(body.email?.trim?.())) { res.status(400).json(error("VALIDATION_ERROR", "Invalid email.")); return; }
    const email = body.email.trim().toLowerCase();
    try {
      await db.subscriber.create({ data: { email } });
      res.status(201).json({ status: "subscribed" });
    } catch (caught) {
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") { res.status(200).json({ status: "subscribed" }); return; }
      next(caught);
    }
  });
  return router;
}
