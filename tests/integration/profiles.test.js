require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Profiles integration tests require local sage_lms_test.");
const database = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, database);
const password = "correct horse battery staple";
let learnerId, teacherId, learnerToken, teacherToken;

describe("M04 profiles integration", function () {
  before(async function () {
    for (const code of ["LEARNER", "INSTRUCTOR"])
      await database.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
    const learnerEmail = `m04-learner-${randomUUID()}@example.test`;
    const teacherEmail = `m04-teacher-${randomUUID()}@example.test`;
    learnerId = (await request(app).post("/api/v1/auth/signup").send({ email: learnerEmail, password }).expect(201)).body.user.id;
    teacherId = (await request(app).post("/api/v1/auth/signup").send({ email: teacherEmail, password }).expect(201)).body.user.id;
    learnerToken = (await request(app).post("/api/v1/auth/login").send({ email: learnerEmail, password }).expect(200)).body.tokens.accessToken;
    teacherToken = (await request(app).post("/api/v1/auth/login").send({ email: teacherEmail, password }).expect(200)).body.tokens.accessToken;
    await database.userRoleAssignment.create({ data: { user: { connect: { id: teacherId } }, role: { connect: { code: "INSTRUCTOR" } } } });
    await database.instructorProfile.create({ data: { userId: teacherId, displayName: "Ada Teacher", verificationStatus: "VERIFIED" } });
  });
  after(async function () {
    if (learnerId) await database.user.delete({ where: { id: learnerId } });
    if (teacherId) await database.user.delete({ where: { id: teacherId } });
    await database.$disconnect();
  });

  it("requires authentication and edits only the caller's learner profile", async function () {
    await request(app).get("/api/v1/profile/me").expect(401);
    const before = await request(app).get("/api/v1/profile/me").set("Authorization", `Bearer ${learnerToken}`).expect(200);
    assert.equal(before.body.user.id, learnerId);
    assert.equal(before.body.user.passwordHash, undefined);
    await request(app).patch("/api/v1/profile/me").set("Authorization", `Bearer ${learnerToken}`)
      .send({ displayName: " Learner One ", userId: teacherId }).expect(400);
    const updated = await request(app).patch("/api/v1/profile/me").set("Authorization", `Bearer ${learnerToken}`)
      .send({ displayName: " Learner One " }).expect(200);
    assert.equal(updated.body.profile.displayName, "Learner One");
    assert.equal((await database.learnerProfile.findUniqueOrThrow({ where: { userId: teacherId } })).displayName, null);
  });

  it("returns only safe fields for verified instructors", async function () {
    const detail = await request(app).get(`/api/v1/instructors/${teacherId}`).expect(200);
    assert.deepEqual(Object.keys(detail.body.instructor).sort(), ["biography", "displayName", "headline", "userId", "websiteUrl"].sort());
    const list = await request(app).get("/api/v1/instructors?page=1&limit=1").expect(200);
    assert.ok(list.body.total >= 1);
    await request(app).get("/api/v1/instructors?page=0").expect(400);
    await request(app).get(`/api/v1/instructors/${learnerId}`).expect(404);
  });

  it("forbids a learner from editing instructor details and prevents cross-owner changes", async function () {
    await request(app).patch("/api/v1/instructors/me").set("Authorization", `Bearer ${learnerToken}`)
      .send({ headline: "Wrong owner" }).expect(403);
    await request(app).patch("/api/v1/instructors/me").set("Authorization", `Bearer ${teacherToken}`)
      .send({ verificationStatus: "VERIFIED" }).expect(400);
    await request(app).patch("/api/v1/instructors/me").set("Authorization", `Bearer ${teacherToken}`)
      .send({ headline: "Teaching responsibly" }).expect(200);
    assert.equal((await database.instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })).headline, "Teaching responsibly");
  });
});
