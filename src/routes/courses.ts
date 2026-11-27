import { Router, type Response } from "express";
import { Prisma } from "../generated/prisma/client";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware, requireRole } from "./auth";
import { createNotification, publishNotification, type NotificationPublisher, noPublisher } from "../services/notifications";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail = (res: Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const money = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 99999999.99 && Math.round(value * 100) === value * 100;
const keys = (body: Record<string, unknown>, allowed: string[]) => Object.keys(body).every((key) => allowed.includes(key));
const courseFields = ["categoryId", "title", "slug", "description", "level", "price", "discountPrice", "currency", "learningObjectives", "requirements"];
const categoryFields = ["name", "slug", "description", "parentId"];
const courseInclude = { sections: { orderBy: { orderIndex: "asc" as const }, include: { lessons: { orderBy: { orderIndex: "asc" as const } } } } };

function validCourse(body: unknown, create: boolean): body is Record<string, unknown> {
  if (!object(body) || !keys(body, courseFields) || !Object.keys(body).length) return false;
  if (create && !["categoryId", "title", "slug", "description"].every((key) => key in body)) return false;
  for (const [key, value] of Object.entries(body)) {
    if (key === "categoryId" && (typeof value !== "string" || !uuid.test(value))) return false;
    if (key === "title" && !text(value, 180)) return false;
    if (key === "slug" && (typeof value !== "string" || value.length > 200 || !slug.test(value))) return false;
    if (key === "description" && !text(value, 10000)) return false;
    if (key === "level" && !["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"].includes(String(value))) return false;
    if (key === "price" && !money(value)) return false;
    if (key === "discountPrice" && value !== null && !money(value)) return false;
    if (key === "currency" && (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))) return false;
    if (["learningObjectives", "requirements"].includes(key) && (!Array.isArray(value) || value.length > 30 || !value.every((item) => text(item, 500)))) return false;
  }
  return true;
}

function validCategory(body: unknown, create: boolean): body is Record<string, unknown> {
  if (!object(body) || !keys(body, categoryFields) || !Object.keys(body).length) return false;
  if (create && !("name" in body && "slug" in body)) return false;
  return Object.entries(body).every(([key, value]) => key === "name" ? text(value, 100) : key === "slug" ? typeof value === "string" && value.length <= 120 && slug.test(value) : key === "description" ? value === null || text(value, 2000) : value === null || typeof value === "string" && uuid.test(value));
}

function knownError(error: unknown, res: Response): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") { fail(res, 409, "DUPLICATE_VALUE"); return true; }
    if (error.code === "P2003") { fail(res, 400, "INVALID_REFERENCE"); return true; }
    if (error.code === "P2014") { fail(res, 409, "RESOURCE_IN_USE"); return true; }
  }
  return false;
}

export function categoryRouter(db: PrismaClient) {
  const router = Router();
  router.get("/", async (_req, res, next) => { try { res.json({ categories: await db.category.findMany({ orderBy: { name: "asc" } }) }); } catch (e) { next(e); } });
  router.use(authMiddleware(db), requireRole("INSTRUCTOR", "ADMIN"));
  router.post("/", async (req, res, next) => {
    if (!validCategory(req.body, true)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const { name, slug: value, description, parentId } = req.body;
      if (parentId && !await db.category.findUnique({ where: { id: parentId as string } })) { fail(res, 400, "INVALID_REFERENCE"); return; }
      const category = await db.category.create({ data: { name: (name as string).trim(), slug: value as string, description: description as string | null | undefined, parentId: parentId as string | null | undefined, ownerId: req.auth!.roles.includes("ADMIN") ? null : req.auth!.userId } });
      res.status(201).json({ category });
    } catch (e) { if (!knownError(e, res)) next(e); }
  });
  router.patch("/:id", async (req, res, next) => {
    if (!uuid.test(String(req.params.id)) || !validCategory(req.body, false)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const category = await db.category.findUnique({ where: { id: String(req.params.id) } });
      if (!category) { fail(res, 404, "NOT_FOUND"); return; }
      if (!req.auth!.roles.includes("ADMIN") && category.ownerId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; }
      if (req.body.parentId === category.id) { fail(res, 400, "VALIDATION_ERROR"); return; }
      const updated = await db.category.update({ where: { id: category.id }, data: { ...req.body, name: typeof req.body.name === "string" ? req.body.name.trim() : undefined } });
      res.json({ category: updated });
    } catch (e) { if (!knownError(e, res)) next(e); }
  });
  router.delete("/:id", async (req, res, next) => {
    if (!uuid.test(String(req.params.id))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const category = await db.category.findUnique({ where: { id: String(req.params.id) } });
      if (!category) { fail(res, 404, "NOT_FOUND"); return; }
      if (!req.auth!.roles.includes("ADMIN") && category.ownerId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; }
      if (await db.course.count({ where: { categoryId: category.id } })) { fail(res, 409, "RESOURCE_IN_USE"); return; }
      await db.category.delete({ where: { id: category.id } }); res.status(204).end();
    } catch (e) { if (!knownError(e, res)) next(e); }
  });
  return router;
}

export function courseRouter(db: PrismaClient, publish: NotificationPublisher = noPublisher) {
  const router = Router();
  router.get("/", async (req, res, next) => {
    const { search, category, level } = req.query;
    const page = Number(req.query.page ?? 1), limit = Number(req.query.limit ?? 20);
    if (Object.keys(req.query).some((key) => !["search", "category", "level", "page", "limit"].includes(key)) ||
      !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || (page - 1) * limit > 100000 ||
      (search !== undefined && (typeof search !== "string" || !search.trim() || search.length > 100)) ||
      (category !== undefined && (typeof category !== "string" || !slug.test(category))) ||
      (level !== undefined && (typeof level !== "string" || !["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"].includes(level)))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const where: Prisma.CourseWhereInput = { status: "PUBLISHED", instructor: { user: { status: "ACTIVE" } } };
      if (category) where.category = { slug: category as string };
      if (level) where.level = level as Prisma.EnumCourseLevelFilter["equals"];
      if (search) where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
        { instructor: { displayName: { contains: search.trim(), mode: "insensitive" } } },
        { category: { name: { contains: search.trim(), mode: "insensitive" } } },
      ];
      const [courses, total] = await db.$transaction([
        db.course.findMany({ where, select: { id: true, title: true, slug: true, description: true, level: true, price: true, discountPrice: true, currency: true, durationMinutes: true, publishedAt: true, category: { select: { id: true, name: true, slug: true } }, instructor: { select: { userId: true, displayName: true, headline: true } } }, orderBy: [{ publishedAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit }),
        db.course.count({ where }),
      ]);
      res.json({ courses, page, limit, total });
    } catch (e) { next(e); }
  });
  router.get("/:id", async (req, res, next) => { try { const id = String(req.params.id); const course = await db.course.findFirst({ where: { status: "PUBLISHED", instructor: { user: { status: "ACTIVE" } }, OR: [{ id: uuid.test(id) ? id : undefined }, { slug: id }] }, include: { ...courseInclude, category: { select: { id: true, name: true, slug: true } }, instructor: { select: { userId: true, displayName: true, headline: true, biography: true, websiteUrl: true } } } }); if (!course) { fail(res, 404, "NOT_FOUND"); return; } res.json({ course: { ...course, sections: course.sections.map((section) => ({ ...section, lessons: section.lessons.map(({ resourceUrl: _resourceUrl, ...lesson }) => lesson) })) } }); } catch (e) { next(e); } });
  router.use(authMiddleware(db));
  router.get("/mine/list", requireRole("INSTRUCTOR"), async (req, res, next) => { try { res.json({ courses: await db.course.findMany({ where: { instructorId: req.auth!.userId }, orderBy: { createdAt: "desc" } }) }); } catch (e) { next(e); } });
  router.get("/:id/manage", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => { try { const course = await db.course.findUnique({ where: { id: String(req.params.id) }, include: courseInclude }); if (!course) { fail(res, 404, "NOT_FOUND"); return; } if (course.instructorId !== req.auth!.userId && !req.auth!.roles.includes("ADMIN")) { fail(res, 403, "FORBIDDEN"); return; } res.json({ course }); } catch (e) { next(e); } });
  router.post("/", requireRole("INSTRUCTOR"), async (req, res, next) => {
    if (!validCourse(req.body, true)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    if (req.body.discountPrice !== undefined && req.body.discountPrice !== null && (Number(req.body.price ?? 0) === 0 || Number(req.body.discountPrice) >= Number(req.body.price))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const profile = await db.instructorProfile.findUnique({ where: { userId: req.auth!.userId } });
      if (!profile || profile.verificationStatus !== "VERIFIED") { fail(res, 403, "FORBIDDEN"); return; }
      const category = await db.category.findUnique({ where: { id: req.body.categoryId as string } });
      if (!category) { fail(res, 400, "INVALID_REFERENCE"); return; }
      const course = await db.course.create({ data: { categoryId: req.body.categoryId as string, title: (req.body.title as string).trim(), slug: req.body.slug as string, description: (req.body.description as string).trim(), level: req.body.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS" | undefined, price: req.body.price as number | undefined, discountPrice: req.body.discountPrice as number | null | undefined, currency: req.body.currency as string | undefined, learningObjectives: req.body.learningObjectives as string[] | undefined, requirements: req.body.requirements as string[] | undefined, instructorId: req.auth!.userId, status: "DRAFT" } });
      res.status(201).json({ course });
    } catch (e) { if (!knownError(e, res)) next(e); }
  });
  router.patch("/:id", requireRole("INSTRUCTOR"), async (req, res, next) => {
    if (!uuid.test(String(req.params.id)) || !validCourse(req.body, false)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const current = await db.course.findUnique({ where: { id: String(req.params.id) } });
      if (!current) { fail(res, 404, "NOT_FOUND"); return; }
      if (current.instructorId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; }
      if (current.status !== "DRAFT") { fail(res, 409, "INVALID_STATUS"); return; }
      const price = req.body.price ?? Number(current.price), discount = "discountPrice" in req.body ? req.body.discountPrice : current.discountPrice === null ? null : Number(current.discountPrice);
      if (discount !== null && (Number(price) === 0 || Number(discount) >= Number(price))) { fail(res, 400, "VALIDATION_ERROR"); return; }
      const course = await db.course.update({ where: { id: current.id }, data: req.body }); res.json({ course });
    } catch (e) { if (!knownError(e, res)) next(e); }
  });
  router.delete("/:id", requireRole("INSTRUCTOR"), async (req, res, next) => {
    try { const course = await db.course.findUnique({ where: { id: String(req.params.id) } }); if (!course) { fail(res, 404, "NOT_FOUND"); return; } if (course.instructorId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; } if (course.status !== "DRAFT") { fail(res, 409, "INVALID_STATUS"); return; } await db.course.delete({ where: { id: course.id } }); res.status(204).end(); } catch (e) { if (!knownError(e, res)) next(e); }
  });
  router.put("/:id/curriculum", requireRole("INSTRUCTOR"), async (req, res, next) => {
    const sections = req.body?.sections;
    if (!Array.isArray(sections) || sections.length > 30 || !sections.every((s: unknown) => object(s) && keys(s, ["title", "summary", "lessons"]) && text(s.title, 180) && (s.summary === undefined || s.summary === null || text(s.summary, 2000)) && Array.isArray(s.lessons) && s.lessons.length <= 50 && s.lessons.every((l: unknown) => object(l) && keys(l, ["title", "description", "type", "durationSeconds", "isPreview", "isRequired"]) && text(l.title, 180) && (l.description === undefined || l.description === null || text(l.description, 5000)) && (l.type === undefined || ["VIDEO", "AUDIO", "ARTICLE", "RESOURCE"].includes(String(l.type))) && (l.durationSeconds === undefined || typeof l.durationSeconds === "number" && Number.isSafeInteger(l.durationSeconds) && l.durationSeconds >= 0) && (l.isPreview === undefined || typeof l.isPreview === "boolean") && (l.isRequired === undefined || typeof l.isRequired === "boolean")))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const course = await db.course.findUnique({ where: { id: String(req.params.id) } });
      if (!course) { fail(res, 404, "NOT_FOUND"); return; }
      if (course.instructorId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; }
      if (course.status !== "DRAFT") { fail(res, 409, "INVALID_STATUS"); return; }
      if (await db.lessonMedia.count({ where: { lesson: { section: { courseId: course.id } } } })) { fail(res, 409, "MEDIA_EXISTS"); return; }
      await db.$transaction(async (tx) => { await tx.courseSection.deleteMany({ where: { courseId: course.id } }); for (const [i, s] of sections.entries()) { await tx.courseSection.create({ data: { courseId: course.id, title: s.title.trim(), summary: s.summary, orderIndex: i, lessons: { create: s.lessons.map((l: Record<string, unknown>, j: number) => ({ ...l, title: String(l.title).trim(), orderIndex: j })) } } }); } });
      res.json({ course: await db.course.findUnique({ where: { id: course.id }, include: courseInclude }) });
    } catch (e) { if (!knownError(e, res)) next(e); }
  });
  router.post("/:id/submit", requireRole("INSTRUCTOR"), async (req, res, next) => {
    try { const course = await db.course.findUnique({ where: { id: String(req.params.id) }, include: { sections: { include: { lessons: true } } } }); if (!course) { fail(res, 404, "NOT_FOUND"); return; } if (course.instructorId !== req.auth!.userId) { fail(res, 403, "FORBIDDEN"); return; } if (course.status !== "DRAFT" || !course.sections.some((s) => s.lessons.length)) { fail(res, 409, "INVALID_STATUS"); return; } res.json({ course: await db.course.update({ where: { id: course.id }, data: { status: "IN_REVIEW" } }) }); } catch (e) { next(e); }
  });
  router.post("/:id/approve", requireRole("ADMIN"), async (req, res, next) => {
    const id = String(req.params.id);
    if (!uuid.test(id)) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const result = await db.$transaction(async (tx) => {
        const changed = await tx.course.updateMany({ where: { id, status: "IN_REVIEW" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
        if (!changed.count) return false;
        await tx.adminAudit.create({ data: { actorId: req.auth!.userId, action: "COURSE_APPROVED", targetType: "COURSE", targetId: id, oldValue: "IN_REVIEW", newValue: "PUBLISHED" } });
        const course = await tx.course.findUniqueOrThrow({ where: { id }, select: { instructorId: true } });
        return createNotification(tx, course.instructorId, "COURSE", "Course approved", { event: "COURSE_APPROVED", courseId: id });
      });
      if (!result) { fail(res, 409, "INVALID_STATUS"); return; }
      publishNotification(publish, result);
      res.json({ course: await db.course.findUnique({ where: { id } }) });
    } catch (e) { next(e); }
  });
  return router;
}
