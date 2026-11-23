import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { authMiddleware } from "./auth";
import { ALLOWED_TYPES, LocalMediaStorage } from "../services/media-storage";
import { hasLessonEntitlement } from "../services/entitlements";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: import("express").Response, status: number, code: string) => res.status(status).json({ error: { code, message: code.replaceAll("_", " ").toLowerCase() + "." } });

export function mediaRouter(db: PrismaClient, storage: LocalMediaStorage) {
  const router = Router();
  router.post("/lessons/:id/media/upload-request", authMiddleware(db), async (req, res, next) => {
    const { fileName, contentType, sizeBytes } = req.body ?? {};
    if (!uuid.test(String(req.params.id)) || typeof fileName !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,254}$/.test(fileName) || typeof contentType !== "string" || !Object.hasOwn(ALLOWED_TYPES, contentType) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > ALLOWED_TYPES[contentType] || Object.keys(req.body).some((key) => !["fileName", "contentType", "sizeBytes"].includes(key))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const lesson = await db.lesson.findUnique({ where: { id: String(req.params.id) }, include: { media: true, section: { include: { course: true } } } });
      if (!lesson) { fail(res, 404, "NOT_FOUND"); return; }
      if (lesson.section.course.instructorId !== req.auth!.userId && !req.auth!.roles.includes("ADMIN")) { fail(res, 403, "FORBIDDEN"); return; }
      if (lesson.section.course.status !== "DRAFT") { fail(res, 409, "INVALID_STATUS"); return; }
      if (lesson.media || await db.lessonMedia.count({ where: { lessonId: lesson.id } })) { fail(res, 409, "MEDIA_EXISTS"); return; }
      const key = storage.createKey();
      const media = await db.lessonMedia.create({ data: { lessonId: lesson.id, storageKey: key, fileName, contentType, sizeBytes } });
      const expires = Date.now() + 5 * 60_000;
      res.status(201).json({ media: { id: media.id, status: media.status, contentType, sizeBytes }, upload: { method: "PUT", url: `/api/v1/media/${key}/upload?expires=${expires}&signature=${storage.sign(key, "upload", expires)}`, expiresAt: new Date(expires).toISOString() } });
    } catch (error) { next(error); }
  });
  router.put("/media/:key/upload", async (req, res, next) => {
    const key = String(req.params.key), expires = Number(req.query.expires), signature = String(req.query.signature ?? "");
    if (!storage.valid(key, "upload", expires, signature)) { fail(res, 403, "FORBIDDEN"); return; }
    try {
      const media = await db.lessonMedia.findUnique({ where: { storageKey: key } });
      if (!media || media.status !== "PENDING") { fail(res, 409, "INVALID_STATUS"); return; }
      if (req.header("content-type") !== media.contentType || !Buffer.isBuffer(req.body) || req.body.length !== media.sizeBytes) { fail(res, 400, "VALIDATION_ERROR"); return; }
      const bytes: Buffer = req.body;
      const matches = media.contentType === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : media.contentType === "video/mp4" ? bytes.subarray(4, 8).toString() === "ftyp" : bytes.subarray(0, 3).toString() === "ID3" || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
      if (!matches) { fail(res, 400, "INVALID_FILE_TYPE"); return; }
      await storage.put(key, req.body);
      await db.lessonMedia.update({ where: { id: media.id }, data: { status: "READY" } });
      res.status(204).end();
    } catch (error) { next(error); }
  });
  router.get("/lessons/:id/access", authMiddleware(db), async (req, res, next) => {
    if (!uuid.test(String(req.params.id))) { fail(res, 400, "VALIDATION_ERROR"); return; }
    try {
      const lesson = await db.lesson.findUnique({ where: { id: String(req.params.id) }, include: { media: true, section: { include: { course: true } } } });
      if (!lesson) { fail(res, 404, "NOT_FOUND"); return; }
      const course = lesson.section.course;
      const owner = course.instructorId === req.auth!.userId || req.auth!.roles.includes("ADMIN");
      const enrolled = !owner && await hasLessonEntitlement(db, course, req.auth!.userId);
      if (!owner && !enrolled) { fail(res, 403, "FORBIDDEN"); return; }
      if (!lesson.media || lesson.media.status !== "READY") { fail(res, 404, "MEDIA_NOT_READY"); return; }
      const expires = Date.now() + 60_000;
      res.json({ lesson: { id: lesson.id, title: lesson.title }, media: { id: lesson.media.id, fileName: lesson.media.fileName, contentType: lesson.media.contentType, sizeBytes: lesson.media.sizeBytes, url: `/api/v1/media/${lesson.media.storageKey}/download?expires=${expires}&signature=${storage.sign(lesson.media.storageKey, "download", expires)}`, expiresAt: new Date(expires).toISOString() } });
    } catch (error) { next(error); }
  });
  router.get("/media/:key/download", async (req, res, next) => {
    const key = String(req.params.key), expires = Number(req.query.expires), signature = String(req.query.signature ?? "");
    if (!storage.valid(key, "download", expires, signature)) { fail(res, 403, "FORBIDDEN"); return; }
    try {
      const media = await db.lessonMedia.findUnique({ where: { storageKey: key } });
      if (!media || media.status !== "READY") { fail(res, 404, "MEDIA_NOT_READY"); return; }
      res.set("Content-Type", media.contentType).set("Cache-Control", "private, no-store").send(await storage.get(key));
    } catch (error) { next(error); }
  });
  return router;
}
