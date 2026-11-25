require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");
const { issueSession } = require("../../dist/services/auth");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M13 requires local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
const users = {};
const tokens = {};
let category, course;
const auth = (name) => ({ Authorization: `Bearer ${tokens[name]}` });

describe("M13 reviews", function () {
  before(async function () {
    for (const code of ["INSTRUCTOR", "LEARNER", "ADMIN"]) await db.role.upsert({ where: { code }, create: { code, name: code }, update: {} });
    for (const [name, role] of [["instructor", "INSTRUCTOR"], ["learner", "LEARNER"], ["other", "LEARNER"], ["admin", "ADMIN"]]) {
      users[name] = await db.user.create({ data: { email: `${name}-${randomUUID()}@example.test`, ...(role === "INSTRUCTOR" ? { instructorProfile: { create: { displayName: "Teacher" } } } : role === "LEARNER" ? { learnerProfile: { create: { displayName: name } } } : {}), roleAssignments: { create: { role: { connect: { code: role } } } } } });
      tokens[name] = (await issueSession(db, users[name].id)).accessToken;
    }
    category = await db.category.create({ data: { name: `M13 ${randomUUID()}`, slug: `m13-${randomUUID()}` } });
    course = await db.course.create({ data: { instructorId: users.instructor.id, categoryId: category.id, title: "Review Course", slug: `review-${randomUUID()}`, description: "Test", status: "PUBLISHED" } });
    await db.enrollment.create({ data: { learnerId: users.learner.id, courseId: course.id } });
  });
  after(async function () {
    if (course) { await db.review.deleteMany({ where: { courseId: course.id } }); await db.enrollment.deleteMany({ where: { courseId: course.id } }); await db.course.delete({ where: { id: course.id } }); }
    if (category) await db.category.delete({ where: { id: category.id } });
    for (const user of Object.values(users)) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  });
  it("blocks ineligible users and invalid ratings", async function () {
    const path = `/api/v1/courses/${course.id}/reviews`;
    await request(app).post(path).send({ rating: 4 }).expect(401);
    await request(app).post(path).set(auth("instructor")).send({ rating: 4 }).expect(403);
    await request(app).post(path).set(auth("other")).send({ rating: 4 }).expect(403);
    for (const rating of [0, 6, 2.5, "5"]) await request(app).post(path).set(auth("learner")).send({ rating }).expect(400);
  });
  it("creates once, edits, lists safely, and excludes hidden reviews from aggregates", async function () {
    const path = `/api/v1/courses/${course.id}/reviews`;
    const created = await request(app).post(path).set(auth("learner")).send({ rating: 4, comment: "Good course" }).expect(201);
    await request(app).post(path).set(auth("learner")).send({ rating: 5 }).expect(409);
    await request(app).patch(`${path}/mine`).set(auth("other")).send({ rating: 1 }).expect(404);
    await request(app).patch(`${path}/mine`).set(auth("learner")).send({ rating: 5 }).expect(200);
    const listed = await request(app).get(path).expect(200);
    assert.equal(listed.body.rating.count, 1);
    assert.equal(listed.body.rating.average, 5);
    assert.equal(listed.body.reviews[0].reviewerName, "learner");
    assert.equal(JSON.stringify(listed.body).includes(users.learner.email), false);
    await request(app).patch(`/api/v1/reviews/${created.body.review.id}/moderation`).set(auth("learner")).send({ hidden: true, reason: "Spam" }).expect(403);
    await request(app).patch(`/api/v1/reviews/${created.body.review.id}/moderation`).set(auth("admin")).send({ hidden: true, reason: "Spam" }).expect(200);
    await request(app).patch(`${path}/mine`).set(auth("learner")).send({ rating: 1 }).expect(403);
    const hidden = await request(app).get(path).expect(200);
    assert.equal(hidden.body.rating.count, 0);
    assert.equal(hidden.body.rating.average, null);
    await request(app).patch(`/api/v1/reviews/${created.body.review.id}/moderation`).set(auth("admin")).send({ hidden: false }).expect(200);
    assert.equal((await request(app).get(path).expect(200)).body.rating.average, 5);
  });
});

