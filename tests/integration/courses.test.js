require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("M05 integration tests require local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
const password = "correct horse battery staple";
const ids = [];
const tokens = {};
const suffix = randomUUID().slice(0, 8);
let categoryId, courseId;

describe("M05 course creation integration", function () {
  before(async function () {
    for (const code of ["LEARNER", "INSTRUCTOR", "ADMIN"])
      await db.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
    for (const role of ["INSTRUCTOR", "LEARNER", "ADMIN", "OTHER"]) {
      const email = `m05-${role.toLowerCase()}-${randomUUID()}@example.test`;
      const user = await request(app).post("/api/v1/auth/signup").send({ email, password }).expect(201);
      ids.push(user.body.user.id);
      tokens[role] = (await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200)).body.tokens.accessToken;
      if (["INSTRUCTOR", "ADMIN", "OTHER"].includes(role)) {
        await db.userRoleAssignment.create({ data: { user: { connect: { id: user.body.user.id } }, role: { connect: { code: role === "OTHER" ? "INSTRUCTOR" : role } } } });
      }
      if (["INSTRUCTOR", "OTHER"].includes(role)) await db.instructorProfile.create({ data: { userId: user.body.user.id, displayName: role, verificationStatus: "VERIFIED" } });
    }
  });
  after(async function () {
    await db.$executeRawUnsafe('TRUNCATE TABLE "admin_audit"');
    if (courseId) await db.course.deleteMany({ where: { id: courseId } });
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    for (const id of ids) await db.user.delete({ where: { id } });
    await db.$disconnect();
  });

  it("creates an owned category and rejects learner writes", async function () {
    await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokens.LEARNER}`).send({ name: "Wrong", slug: `wrong-${suffix}` }).expect(403);
    const created = await request(app).post("/api/v1/categories").set("Authorization", `Bearer ${tokens.INSTRUCTOR}`).send({ name: "M05 Skills", slug: `m05-skills-${suffix}` }).expect(201);
    categoryId = created.body.category.id;
    await request(app).patch(`/api/v1/categories/${categoryId}`).set("Authorization", `Bearer ${tokens.OTHER}`).send({ name: "Hijack" }).expect(403);
  });

  it("creates private draft and rejects bad prices and duplicate slug", async function () {
    const body = { categoryId, title: "Introduction to Skills", slug: `intro-skills-${suffix}`, description: "A fictional course", price: 50, discountPrice: 40 };
    await request(app).post("/api/v1/courses").set("Authorization", `Bearer ${tokens.LEARNER}`).send(body).expect(403);
    await request(app).post("/api/v1/courses").set("Authorization", `Bearer ${tokens.INSTRUCTOR}`).send({ ...body, discountPrice: 60 }).expect(400);
    const created = await request(app).post("/api/v1/courses").set("Authorization", `Bearer ${tokens.INSTRUCTOR}`).send(body).expect(201);
    courseId = created.body.course.id;
    assert.equal(created.body.course.status, "DRAFT");
    await request(app).post("/api/v1/courses").set("Authorization", `Bearer ${tokens.INSTRUCTOR}`).send(body).expect(409);
    await request(app).get(`/api/v1/courses/${courseId}`).expect(404);
    const list = await request(app).get("/api/v1/courses").expect(200);
    assert.ok(!list.body.courses.some((course) => course.id === courseId));
  });

  it("updates curriculum, enforces owner and submits for admin approval", async function () {
    const own = `Bearer ${tokens.INSTRUCTOR}`;
    await request(app).patch(`/api/v1/courses/${courseId}`).set("Authorization", `Bearer ${tokens.OTHER}`).send({ title: "Hijack" }).expect(403);
    await request(app).put(`/api/v1/courses/${courseId}/curriculum`).set("Authorization", own).send({ sections: [{ title: "Basics", lessons: [{ title: "Welcome", type: "ARTICLE" }] }] }).expect(200);
    await request(app).post(`/api/v1/courses/${courseId}/submit`).set("Authorization", own).expect(200);
    await request(app).patch(`/api/v1/courses/${courseId}`).set("Authorization", own).send({ title: "Late edit" }).expect(409);
    await request(app).get(`/api/v1/courses/${courseId}`).expect(404);
    await request(app).post(`/api/v1/courses/${courseId}/approve`).set("Authorization", own).expect(403);
    await request(app).post(`/api/v1/courses/${courseId}/approve`).set("Authorization", `Bearer ${tokens.ADMIN}`).expect(200);
    const publicCourse = await request(app).get(`/api/v1/courses/${courseId}`).expect(200);
    assert.equal(publicCourse.body.course.sections[0].lessons[0].title, "Welcome");
  });
});
