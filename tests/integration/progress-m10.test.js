require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M10 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
let instructor, learner, other, category, course, section, first, second;
const token = {};
const auth = (name) => ({ Authorization: `Bearer ${token[name]}` });

describe("M10 learning progress", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    for (const name of ["instructor", "learner", "other"]) {
      const user = await db.user.create({ data: { email: `${name}-${randomUUID()}@example.test`, ...(name === "instructor" ? { instructorProfile: { create: { displayName: "Teacher" } } } : { learnerProfile: { create: {} } }), roleAssignments: { create: { role: { connect: { code: name === "instructor" ? "INSTRUCTOR" : "LEARNER" } } } } } });
      if (name === "instructor") instructor = user;
      if (name === "learner") learner = user;
      if (name === "other") other = user;
      token[name] = (await issueSession(db, user.id)).accessToken;
    }
    category = await db.category.create({ data: { name: `M10 ${randomUUID()}`, slug: `m10-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Progress", slug: `progress-${randomUUID()}`, description: "Test", status: "PUBLISHED" } });
    section = await db.courseSection.create({ data: { courseId: course.id, title: "Section", orderIndex: 0 } });
    first = await db.lesson.create({ data: { sectionId: section.id, title: "First", orderIndex: 0, durationSeconds: 100 } });
    second = await db.lesson.create({ data: { sectionId: section.id, title: "Optional", orderIndex: 1, isRequired: false } });
    await db.enrollment.create({ data: { courseId: course.id, learnerId: learner.id } });
  });
  after(async function () {
    if (course) await db.enrollment.deleteMany({ where: { courseId: course.id } });
    if (course) await db.course.delete({ where: { id: course.id } });
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, other]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("denies missing, wrong role and unenrolled tokens", async function () {
    await request(app).put(`/api/v1/lessons/${first.id}/progress`).send({ completed: true }).expect(401);
    await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("instructor")).send({ completed: true }).expect(403);
    await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("other")).send({ completed: true }).expect(403);
    await request(app).get(`/api/v1/courses/${course.id}/progress`).set(auth("other")).expect(403);
    await request(app).put(`/api/v1/courses/${course.id}/resume`).set(auth("other")).send({ lessonId: first.id }).expect(403);
  });
  it("stores own note, bookmark and position and validates input", async function () {
    await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("learner")).send({ lastPositionSeconds: 101 }).expect(400);
    await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("learner")).send({ learnerId: other.id, completed: true }).expect(400);
    const result = await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("learner")).send({ bookmarked: true, note: "Review this", lastPositionSeconds: 30 }).expect(200);
    assert.equal(result.body.progress.bookmarked, true);
    assert.equal(result.body.progress.note, "Review this");
    assert.equal(result.body.progress.lastPositionSeconds, 30);
    assert.equal(await db.lessonProgress.count({ where: { learnerId: other.id } }), 0);
  });
  it("keeps completion timestamp and computes required lesson aggregate", async function () {
    const one = await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("learner")).send({ completed: true }).expect(200);
    const two = await request(app).put(`/api/v1/lessons/${first.id}/progress`).set(auth("learner")).send({ completed: true }).expect(200);
    assert.equal(two.body.progress.completedAt, one.body.progress.completedAt);
    assert.equal(await db.lessonProgress.count({ where: { learnerId: learner.id, lessonId: first.id } }), 1);
    const aggregate = await request(app).get(`/api/v1/courses/${course.id}/progress`).set(auth("learner")).expect(200);
    assert.equal(aggregate.body.requiredLessons, 1);
    assert.equal(aggregate.body.completedRequiredLessons, 1);
    assert.equal(aggregate.body.completionPercent, 100);
    assert.equal(aggregate.body.complete, true);
    assert.equal(aggregate.body.lessons.find((lesson) => lesson.id === second.id).completedAt, null);
  });
  it("sets resume only to a lesson in the enrolled course", async function () {
    await request(app).put(`/api/v1/courses/${course.id}/resume`).set(auth("learner")).send({ lessonId: randomUUID() }).expect(400);
    const result = await request(app).put(`/api/v1/courses/${course.id}/resume`).set(auth("learner")).send({ lessonId: second.id }).expect(200);
    assert.equal(result.body.resumeLessonId, second.id);
    const aggregate = await request(app).get(`/api/v1/courses/${course.id}/progress`).set(auth("learner")).expect(200);
    assert.equal(aggregate.body.resumeLessonId, second.id);
  });
});
