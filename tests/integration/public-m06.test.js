require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("M06 tests require local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
const suffix = randomUUID().slice(0, 8);
let user, category, published, draft;

describe("M06 public catalog and submissions", function () {
  before(async function () {
    user = await db.user.create({ data: { email: `m06-${suffix}@example.test`, instructorProfile: { create: { displayName: "Fictional Teacher", verificationStatus: "VERIFIED" } } } });
    category = await db.category.create({ data: { name: `M06 ${suffix}`, slug: `m06-${suffix}` } });
    published = await db.course.create({ data: { instructorId: user.id, categoryId: category.id, title: "Public TypeScript", slug: `public-${suffix}`, description: "Learn practical skills", level: "BEGINNER", status: "PUBLISHED", publishedAt: new Date() } });
    draft = await db.course.create({ data: { instructorId: user.id, categoryId: category.id, title: "Private TypeScript", slug: `private-${suffix}`, description: "Hidden", status: "DRAFT" } });
  });
  after(async function () {
    await db.course.deleteMany({ where: { id: { in: [published?.id, draft?.id].filter(Boolean) } } });
    if (category) await db.category.delete({ where: { id: category.id } });
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.contactMessage.deleteMany({ where: { email: `m06-${suffix}@example.test` } });
    await db.subscriber.deleteMany({ where: { email: `m06-${suffix}@example.test` } });
    await db.$disconnect();
  });
  it("filters and paginates published courses", async function () {
    const response = await request(app).get(`/api/v1/courses?search=typescript&category=${category.slug}&level=BEGINNER&page=1&limit=1`).expect(200);
    assert.equal(response.body.courses.length, 1);
    assert.equal(response.body.courses[0].id, published.id);
    assert.equal(response.body.total, 1);
    assert.equal((await request(app).get(`/api/v1/courses?search=typescript&category=${category.slug}&level=BEGINNER&page=2&limit=1`).expect(200)).body.courses.length, 0);
    await request(app).get("/api/v1/courses?page=0").expect(400);
    await request(app).get(`/api/v1/courses/${draft.slug}`).expect(404);
    assert.equal((await request(app).get(`/api/v1/courses/${published.slug}`).expect(200)).body.course.id, published.id);
  });
  it("validates contact and records a message", async function () {
    await request(app).post("/api/v1/contact").send({ email: "bad" }).expect(400);
    await request(app).post("/api/v1/contact").send({ name: "Test", email: `m06-${suffix}@example.test`, subject: "Hello", message: "Please contact me" }).expect(201);
    assert.equal(await db.contactMessage.count({ where: { email: `m06-${suffix}@example.test` } }), 1);
  });
  it("normalizes concurrent newsletter duplicates", async function () {
    const email = `M06-${suffix}@Example.Test`;
    const responses = await Promise.all(Array.from({ length: 2 }, () => request(app).post("/api/v1/newsletter/subscribe").send({ email })));
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
    assert.equal(await db.subscriber.count({ where: { email: email.toLowerCase() } }), 1);
    await request(app).post("/api/v1/newsletter/subscribe").send({ email: "invalid" }).expect(400);
  });
});
