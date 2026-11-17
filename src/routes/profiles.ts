import { Router, type Response } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";

declare module "express-serve-static-core" {
  interface Request { auth?: { userId: string; roles: string[]; accessTokenHash: string } }
}

const fail = (response: Response, status: number, code: string, message: string) =>
  response.status(status).json({ error: { code, message } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = {
  learner: { displayName: 120, avatarUrl: 2048, biography: 5000, location: 160, occupation: 160, education: 5000 },
  instructor: { displayName: 120, headline: 180, biography: 5000, websiteUrl: 2048 },
} as const;

function validate(body: unknown, kind: keyof typeof fields): Record<string, string | null> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const allowed: Record<string, number> = fields[kind];
  if (!Object.keys(input).length || Object.keys(input).some((key) => !(key in allowed))) return null;
  const data: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null && key !== "displayName") { data[key] = null; continue; }
    if (typeof value !== "string" || !value.trim() || value.trim().length > allowed[key]) return null;
    const trimmed = value.trim();
    if (key.endsWith("Url")) {
      try {
        const parsed = new URL(trimmed);
        if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname) return null;
      } catch { return null; }
    }
    data[key] = trimmed;
  }
  return data;
}

const learnerSelect = { userId: true, displayName: true, avatarUrl: true, biography: true,
  location: true, occupation: true, education: true, skills: true, interests: true } as const;
const instructorSelect = { userId: true, displayName: true, headline: true, biography: true,
  websiteUrl: true } as const;

export function profileRouter(database: PrismaClient) {
  const router = Router();
  router.use(authMiddleware(database));
  router.get("/me", async (request, response, next) => {
    try {
      const userId = request.auth!.userId;
      const user = await database.user.findUnique({ where: { id: userId }, select: {
        id: true, email: true, phoneNumber: true,
        learnerProfile: { select: learnerSelect }, instructorProfile: { select: instructorSelect },
      } });
      if (!user) { fail(response, 404, "NOT_FOUND", "Profile not found."); return; }
      response.json({ user });
    } catch (caught) { next(caught); }
  });
  router.patch("/me", async (request, response, next) => {
    try {
      const data = validate(request.body, "learner");
      if (!data) { fail(response, 400, "VALIDATION_ERROR", "Invalid profile fields."); return; }
      const profile = await database.learnerProfile.upsert({ where: { userId: request.auth!.userId },
        create: { userId: request.auth!.userId, ...data }, update: data, select: learnerSelect });
      response.json({ profile });
    } catch (caught) { next(caught); }
  });
  return router;
}

export function instructorRouter(database: PrismaClient) {
  const router = Router();
  router.get("/", async (request, response, next) => {
    try {
      const page = Number(request.query.page ?? 1);
      const limit = Number(request.query.limit ?? 20);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || (page - 1) * limit > 100000)
        { fail(response, 400, "VALIDATION_ERROR", "Use page >= 1 and limit from 1 to 50."); return; }
      const where = { verificationStatus: "VERIFIED" as const, user: { status: "ACTIVE" as const } };
      const [items, total] = await database.$transaction([
        database.instructorProfile.findMany({ where, select: instructorSelect, orderBy: { userId: "asc" }, skip: (page - 1) * limit, take: limit }),
        database.instructorProfile.count({ where }),
      ]);
      response.json({ instructors: items, page, limit, total });
    } catch (caught) { next(caught); }
  });
  router.get("/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id);
      if (!uuid.test(id)) { fail(response, 400, "VALIDATION_ERROR", "Invalid instructor id."); return; }
      const instructor = await database.instructorProfile.findFirst({ where: { userId: id, verificationStatus: "VERIFIED", user: { status: "ACTIVE" } }, select: instructorSelect });
      if (!instructor) { fail(response, 404, "NOT_FOUND", "Instructor not found."); return; }
      response.json({ instructor });
    } catch (caught) { next(caught); }
  });
  router.patch("/me", authMiddleware(database), requireRole("INSTRUCTOR"), async (request, response, next) => {
    try {
      const data = validate(request.body, "instructor");
      if (!data) { fail(response, 400, "VALIDATION_ERROR", "Invalid instructor profile fields."); return; }
      const result = await database.instructorProfile.updateMany({ where: { userId: request.auth!.userId }, data });
      if (!result.count) { fail(response, 404, "NOT_FOUND", "Instructor profile not found."); return; }
      const instructor = await database.instructorProfile.findUniqueOrThrow({ where: { userId: request.auth!.userId }, select: instructorSelect });
      response.json({ instructor });
    } catch (caught) { next(caught); }
  });
  return router;
}
