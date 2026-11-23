require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M07 requires local sage_lms_test.");
const db = createDatabaseClient(url);
let root, app, course, lesson, instructor, learner, other, category, media;
const token = {};

describe("M07 media and lesson access", function () {
  before(async function () {
    root = await mkdtemp(path.join(os.tmpdir(), "sage-media-"));
    app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url, mediaRoot: root, mediaSigningSecret: "test-secret-which-is-at-least-32-characters" }, async () => {}, db);
    for (const code of ["INSTRUCTOR", "LEARNER"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    for (const role of ["instructor", "learner", "other"]) {
      const user = await db.user.create({ data: { email: `${role}-${randomUUID()}@example.test` } });
      if (role === "instructor") instructor = user;
      if (role === "learner") learner = user;
      if (role === "other") other = user;
      token[role] = (await issueSession(db, user.id)).accessToken;
    }
    await db.userRoleAssignment.create({ data: { userId: instructor.id, roleId: (await db.role.findUniqueOrThrow({ where: { code: "INSTRUCTOR" } })).id } });
    await db.instructorProfile.create({ data: { userId: instructor.id, displayName: "Test instructor", verificationStatus: "VERIFIED" } });
    await db.learnerProfile.create({ data: { userId: learner.id } });
    category = await db.category.create({ data: { name: `Media ${randomUUID()}`, slug: `media-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Media test", slug: `media-${randomUUID()}`, description: "Test" } });
    const section = await db.courseSection.create({ data: { courseId: course.id, title: "First", orderIndex: 0 } });
    lesson = await db.lesson.create({ data: { sectionId: section.id, title: "Video", orderIndex: 0 } });
  });
  after(async function () {
    if (course && learner) await db.enrollment.deleteMany({ where: { courseId: course.id, learnerId: learner.id } });
    if (course) await db.course.delete({ where: { id: course.id } });
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, other]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
    if (root) await rm(root, { recursive: true, force: true });
  });
  it("rejects unauthenticated and unauthorized upload requests and invalid sizes", async function () {
    const endpoint = `/api/v1/lessons/${lesson.id}/media/upload-request`;
    const body = { fileName: "intro.mp4", contentType: "video/mp4", sizeBytes: 12 };
    await request(app).post(endpoint).send(body).expect(401);
    await request(app).post(endpoint).set("Authorization", `Bearer ${token.other}`).send(body).expect(403);
    await request(app).post(endpoint).set("Authorization", `Bearer ${token.instructor}`).send({ ...body, sizeBytes: 200 * 1024 * 1024 }).expect(400);
    await request(app).post(endpoint).set("Authorization", `Bearer ${token.instructor}`).send({ ...body, contentType: "application/x-msdownload" }).expect(400);
    assert.equal(await db.lessonMedia.count({ where: { lessonId: lesson.id } }), 0);
  });
  it("uploads a validated file and denies unenrolled playback", async function () {
    const bytes = Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from("ftyp"), Buffer.from("test")]);
    const response = await request(app).post(`/api/v1/lessons/${lesson.id}/media/upload-request`).set("Authorization", `Bearer ${token.instructor}`).send({ fileName: "intro.mp4", contentType: "video/mp4", sizeBytes: bytes.length }).expect(201);
    media = response.body.media;
    await request(app).put(response.body.upload.url).set("Content-Type", "video/mp4").send(Buffer.alloc(bytes.length)).expect(400);
    await request(app).put(response.body.upload.url.replace(/signature=[^&]+/, "signature=bad")).set("Content-Type", "video/mp4").send(bytes).expect(403);
    await request(app).put(response.body.upload.url).set("Content-Type", "video/mp4").send(bytes).expect(204);
    assert.equal((await db.lessonMedia.findUniqueOrThrow({ where: { id: media.id } })).status, "READY");
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token.other}`).expect(403);
    const owner = await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token.instructor}`).expect(200);
    const downloaded = await request(app).get(owner.body.media.url).expect(200);
    assert.deepEqual(downloaded.body, bytes);
  });
  it("allows enrolled learners only after publication", async function () {
    await db.enrollment.create({ data: { learnerId: learner.id, courseId: course.id } });
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token.learner}`).expect(403);
    await db.course.update({ where: { id: course.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token.learner}`).expect(200);
    await db.course.update({ where: { id: course.id }, data: { price: 10 } });
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token.learner}`).expect(403);
    await db.enrollment.update({ where: { learnerId_courseId: { learnerId: learner.id, courseId: course.id } }, data: { status: "CANCELLED" } });
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set("Authorization", `Bearer ${token.learner}`).expect(403);
  });
});
