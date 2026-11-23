require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M08 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
let instructor, learner, other, category, free, paid, lesson, paidLesson;
const token = {};
const auth = (name) => ({ Authorization: `Bearer ${token[name]}` });

describe("M08 enrollments and entitlements", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    for (const name of ["instructor", "learner", "other"]) {
      const user = await db.user.create({ data: { email: `${name}-${randomUUID()}@example.test`, ...(name === "instructor" ? { instructorProfile: { create: { displayName: "Teacher" } } } : { learnerProfile: { create: {} } }), roleAssignments: { create: { role: { connect: { code: name === "instructor" ? "INSTRUCTOR" : "LEARNER" } } } } } });
      if (name === "instructor") instructor = user;
      if (name === "learner") learner = user;
      if (name === "other") other = user;
      token[name] = (await issueSession(db, user.id)).accessToken;
    }
    category = await db.category.create({ data: { name: `M08 ${randomUUID()}`, slug: `m08-${randomUUID()}` } });
    free = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Free", slug: `free-${randomUUID()}`, description: "Test", status: "PUBLISHED" } });
    paid = await db.course.create({ data: { instructorId: instructor.id, categoryId: category.id, title: "Paid", slug: `paid-${randomUUID()}`, description: "Test", status: "PUBLISHED", price: 20 } });
    const section = await db.courseSection.create({ data: { courseId: free.id, title: "Section", orderIndex: 0 } });
    lesson = await db.lesson.create({ data: { sectionId: section.id, title: "Private", orderIndex: 0 } });
    const paidSection = await db.courseSection.create({ data: { courseId: paid.id, title: "Paid section", orderIndex: 0 } });
    paidLesson = await db.lesson.create({ data: { sectionId: paidSection.id, title: "Paid private", orderIndex: 0 } });
  });
  after(async function () {
    if (free && paid) await db.enrollment.deleteMany({ where: { courseId: { in: [free.id, paid.id] } } });
    for (const course of [free, paid]) if (course) await db.course.delete({ where: { id: course.id } });
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of [instructor, learner, other]) if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("requires a learner token and rejects malformed requests", async function () {
    await request(app).post(`/api/v1/courses/${free.id}/enroll`).expect(401);
    await request(app).post(`/api/v1/courses/${free.id}/enroll`).set(auth("instructor")).expect(403);
    await request(app).post("/api/v1/courses/bad/enroll").set(auth("learner")).expect(400);
    await request(app).post(`/api/v1/courses/${free.id}/enroll`).set(auth("learner")).send({ paymentStatus: "SUCCEEDED" }).expect(400);
  });
  it("enrolls once, blocks concurrent duplicates and lists only own courses", async function () {
    const results = await Promise.all([request(app).post(`/api/v1/courses/${free.id}/enroll`).set(auth("learner")), request(app).post(`/api/v1/courses/${free.id}/enroll`).set(auth("learner"))]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    assert.equal(await db.enrollment.count({ where: { learnerId: learner.id, courseId: free.id } }), 1);
    const mine = await request(app).get("/api/v1/learners/me/courses").set(auth("learner")).expect(200);
    assert.equal(mine.body.courses.length, 1);
    assert.equal(mine.body.courses[0].course.id, free.id);
    assert.equal(mine.body.courses[0].access, true);
    const theirs = await request(app).get("/api/v1/learners/me/courses").set(auth("other")).expect(200);
    assert.deepEqual(theirs.body.courses, []);
    await request(app).get(`/api/v1/lessons/${lesson.id}/access`).set(auth("other")).expect(403);
  });
  it("locks paid courses without a verified payment", async function () {
    const result = await request(app).post(`/api/v1/courses/${paid.id}/enroll`).set(auth("learner")).expect(403);
    assert.equal(result.body.error.code, "PAYMENT_REQUIRED");
    assert.equal(await db.enrollment.count({ where: { courseId: paid.id } }), 0);
    const enrollment = await db.enrollment.create({ data: { courseId: paid.id, learnerId: learner.id } });
    const payment = await db.payment.create({ data: { userId: learner.id, courseId: paid.id, enrollmentId: enrollment.id, amount: 20, currency: "USD", status: "PENDING" } });
    await request(app).get(`/api/v1/lessons/${paidLesson.id}/access`).set(auth("learner")).expect(403);
    let mine = await request(app).get("/api/v1/learners/me/courses").set(auth("learner")).expect(200);
    assert.equal(mine.body.courses.find((entry) => entry.course.id === paid.id).access, false);
    await db.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    await request(app).get(`/api/v1/lessons/${paidLesson.id}/access`).set(auth("learner")).expect(404);
    await request(app).get(`/api/v1/lessons/${paidLesson.id}/access`).set(auth("other")).expect(403);
    mine = await request(app).get("/api/v1/learners/me/courses").set(auth("learner")).expect(200);
    assert.equal(mine.body.courses.find((entry) => entry.course.id === paid.id).access, true);
    await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    await request(app).get(`/api/v1/lessons/${paidLesson.id}/access`).set(auth("learner")).expect(403);
    await db.payment.delete({ where: { id: payment.id } });
  });
});
