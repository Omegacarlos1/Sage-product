require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { createDatabaseClient } = require("../../dist/services/database");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || new URL(testDatabaseUrl).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(testDatabaseUrl).hostname)) {
  throw new Error("Authentication integration tests require local sage_lms_test.");
}
const database = createDatabaseClient(testDatabaseUrl);
const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: testDatabaseUrl }, async () => {}, database);
const email = `m03-${randomUUID()}@example.test`;
const password = "correct horse battery staple";
let userId;
let accessToken;
let refreshToken;

describe("M03 authentication integration", function () {
  before(async function () {
    await database.role.upsert({ where: { code: "LEARNER" }, update: {}, create: { code: "LEARNER", name: "Learner" } });
  });
  after(async function () {
    if (userId) await database.user.delete({ where: { id: userId } });
    await database.$disconnect();
  });

  it("signs up a learner and blocks client-assigned roles", async function () {
    await request(app).post("/api/v1/auth/signup").send({ email, password, role: "ADMIN" }).expect(400);
    const result = await request(app).post("/api/v1/auth/signup").send({ email: email.toUpperCase(), password }).expect(201);
    userId = result.body.user.id;
    assert.deepEqual(result.body.user.roles, ["LEARNER"]);
    const stored = await database.user.findUniqueOrThrow({ where: { id: userId } });
    assert.notEqual(stored.passwordHash, password);
    await request(app).post("/api/v1/auth/signup").send({ email, password }).expect(409);
  });

  it("rejects invalid credentials and issues opaque tokens", async function () {
    await request(app).post("/api/v1/auth/login").send({ email, password: "wrong" }).expect(401);
    const result = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    accessToken = result.body.tokens.accessToken;
    refreshToken = result.body.tokens.refreshToken;
    assert.equal(accessToken.length, 43);
  });

  it("enforces authentication and admin authorization", async function () {
    await request(app).get("/api/v1/auth/me").expect(401);
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    await request(app).get("/api/v1/auth/admin-check").set("Authorization", `Bearer ${accessToken}`).expect(403);
  });

  it("rotates tokens once and revokes on logout", async function () {
    const oldAccess = accessToken;
    const oldRefresh = refreshToken;
    const rotated = await request(app).post("/api/v1/auth/refresh").send({ refreshToken }).expect(200);
    accessToken = rotated.body.tokens.accessToken;
    refreshToken = rotated.body.tokens.refreshToken;
    await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldRefresh }).expect(401);
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${oldAccess}`).expect(401);
    await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${accessToken}`).expect(204);
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`).expect(401);
  });

  it("allows one reset, rejects replay and expiry, and revokes sessions", async function () {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const reset = await request(app).post("/api/v1/auth/password-reset/request").send({ email }).expect(200);
    const token = reset.body.resetToken;
    assert.equal(token.length, 43);
    await request(app).post("/api/v1/auth/password-reset/complete").send({ token, password: "another secure password" }).expect(200);
    await request(app).post("/api/v1/auth/password-reset/complete").send({ token, password: "third secure password" }).expect(400);
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${login.body.tokens.accessToken}`).expect(401);
    await request(app).post("/api/v1/auth/login").send({ email, password }).expect(401);
    const expired = await request(app).post("/api/v1/auth/password-reset/request").send({ email }).expect(200);
    await database.passwordResetToken.update({ where: { tokenHash: require("../../dist/services/auth").hashToken(expired.body.resetToken) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).post("/api/v1/auth/password-reset/complete").send({ token: expired.body.resetToken, password: "third secure password" }).expect(400);
  });
});
