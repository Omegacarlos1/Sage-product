require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Account model integration tests require local sage_lms_test.");
const db = createDatabaseClient(url);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: url }, async () => {}, db);
const password = "correct horse battery staple";
const learnerEmail = `v2-learner-${randomUUID()}@example.test`;
const instructorEmail = `v2-instructor-${randomUUID()}@example.test`;
let learnerId, instructorId, adminId, learnerToken, instructorToken, adminToken;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("V2 separate learner and instructor accounts", function () {
  before(async function () {
    for (const code of ["LEARNER", "INSTRUCTOR", "ADMIN"])
      await db.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
    adminId = (await db.user.create({ data: { email: `v2-admin-${randomUUID()}@example.test`, passwordHash: await require("../../dist/services/auth").hashPassword(password), roleAssignments: { create: { role: { connect: { code: "ADMIN" } } } } } })).id;
    adminToken = (await request(app).post("/api/v1/auth/login").send({ email: (await db.user.findUniqueOrThrow({ where: { id: adminId } })).email, password }).expect(200)).body.tokens.accessToken;
  });
  after(async function () {
    await db.$executeRawUnsafe('TRUNCATE TABLE "admin_audit"');
    for (const id of [learnerId, instructorId, adminId]) if (id) await db.user.delete({ where: { id } });
    await db.$disconnect();
  });

  it("creates distinct credentials and keeps instructor privileges pending approval", async function () {
    learnerId = (await request(app).post("/api/v1/auth/signup").send({ email: learnerEmail, password }).expect(201)).body.user.id;
    const signup = await request(app).post("/api/v1/auth/instructor/signup").send({ email: instructorEmail, password: "different secure password", displayName: "Example Teacher" }).expect(201);
    instructorId = signup.body.user.id;
    assert.notEqual(instructorId, learnerId);
    assert.deepEqual(signup.body.user.roles, []);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: instructorId }, include: { learnerProfile: true } })).learnerProfile, null);
    await request(app).post("/api/v1/auth/instructor/signup").send({ email: learnerEmail, password, displayName: "Duplicate" }).expect(409);
    learnerToken = (await request(app).post("/api/v1/auth/login").send({ email: learnerEmail, password }).expect(200)).body.tokens.accessToken;
    instructorToken = (await request(app).post("/api/v1/auth/login").send({ email: instructorEmail, password: "different secure password" }).expect(200)).body.tokens.accessToken;
    await request(app).post("/api/v1/courses").set(auth(instructorToken)).send({}).expect(403);
    await request(app).patch("/api/v1/instructors/me").set(auth(instructorToken)).send({ headline: "Pending applicant" }).expect(200);
    await request(app).patch(`/api/v1/admin/instructors/${instructorId}/verification`).set(auth(adminToken)).send({ status: "VERIFIED" }).expect(200);
    const login = await request(app).post("/api/v1/auth/login").send({ email: instructorEmail, password: "different secure password" }).expect(200);
    assert.deepEqual(login.body.user.roles, ["INSTRUCTOR"]);
    await request(app).post("/api/v1/courses/00000000-0000-0000-0000-000000000000/enroll").set(auth(instructorToken)).send({}).expect(403);
  });

  it("requires consent from both authenticated accounts and never merges their roles", async function () {
    await request(app).post("/api/v1/account-links/requests").set(auth(learnerToken)).send({ instructorEmail: "missing@example.test" }).expect(202);
    await request(app).post("/api/v1/account-links/requests").set(auth(instructorToken)).send({ instructorEmail }).expect(403);
    await request(app).post("/api/v1/account-links/requests").set(auth(learnerToken)).send({ instructorEmail }).expect(202);
    const pending = await request(app).get("/api/v1/account-links").set(auth(instructorToken)).expect(200);
    const id = pending.body.links.find((link) => link.accountId === learnerId).id;
    await request(app).post(`/api/v1/account-links/${id}/confirm`).set(auth(learnerToken)).send({}).expect(404);
    await request(app).post(`/api/v1/account-links/${id}/confirm`).set(auth(instructorToken)).send({}).expect(200);
    await request(app).post(`/api/v1/account-links/${id}/confirm`).set(auth(instructorToken)).send({}).expect(409);
    assert.deepEqual((await request(app).get("/api/v1/auth/me").set(auth(learnerToken)).expect(200)).body.user.roles, ["LEARNER"]);
    assert.deepEqual((await request(app).get("/api/v1/auth/me").set(auth(instructorToken)).expect(200)).body.user.roles, ["INSTRUCTOR"]);
    await request(app).delete(`/api/v1/account-links/${id}`).set(auth(learnerToken)).expect(204);
    assert.equal((await request(app).get("/api/v1/account-links").set(auth(instructorToken)).expect(200)).body.links.length, 0);
  });

  it("rejects expired requests", async function () {
    await request(app).post("/api/v1/account-links/requests").set(auth(learnerToken)).send({ instructorEmail }).expect(202);
    const link = await db.accountLink.findUniqueOrThrow({ where: { learnerId: learnerId } });
    await db.accountLink.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).post(`/api/v1/account-links/${link.id}/confirm`).set(auth(instructorToken)).send({}).expect(409);
  });
});
