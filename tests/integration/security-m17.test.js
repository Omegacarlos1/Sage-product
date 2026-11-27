require("dotenv/config");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { readConfig } = require("../../dist/config/env");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || new URL(testDatabaseUrl).pathname !== "/sage_lms_test" || !["localhost", "127.0.0.1"].includes(new URL(testDatabaseUrl).hostname)) {
  throw new Error("M17 security tests require local sage_lms_test.");
}
const config = { nodeEnv: "test", port: 3000, corsOrigins: ["https://sage.example.test"], databaseUrl: testDatabaseUrl };
const fakeDb = { user: { findUnique: async () => null } };

describe("M17 security controls", function () {
  it("sends security headers and grants CORS only to the allowlisted origin", async function () {
    const app = createApp(config, async () => {});
    const allowed = await request(app).get("/api/v1/health").set("Origin", "https://sage.example.test").expect(200);
    assert.equal(allowed.headers["access-control-allow-origin"], "https://sage.example.test");
    assert.equal(allowed.headers["x-content-type-options"], "nosniff");
    assert.ok(allowed.headers["content-security-policy"]);
    assert.equal(allowed.headers["x-powered-by"], undefined);
    const denied = await request(app).get("/api/v1/health").set("Origin", "https://evil.example.test").expect(200);
    assert.equal(denied.headers["access-control-allow-origin"], undefined);
  });

  it("rejects invalid and insecure production CORS origins", function () {
    const base = { NODE_ENV: "production", DATABASE_URL: testDatabaseUrl, MEDIA_ROOT: "private", MEDIA_SIGNING_SECRET: "x".repeat(32) };
    assert.throws(() => readConfig(base), /CORS_ORIGINS/);
    assert.throws(() => readConfig({ ...base, CORS_ORIGINS: "http://sage.example.test" }), /CORS_ORIGINS/);
    assert.throws(() => readConfig({ ...base, CORS_ORIGINS: "https://sage.example.test/path" }), /CORS_ORIGINS/);
  });

  it("limits repeated login attempts with a retry time and safe response", async function () {
    const app = createApp(config, async () => {}, fakeDb);
    for (let index = 0; index < 20; index++) {
      await request(app).post("/api/v1/auth/login").send({ email: "missing@example.test", password: "wrong" }).expect(401);
    }
    const limited = await request(app).post("/api/v1/auth/login").send({ email: "missing@example.test", password: "wrong" }).expect(429);
    assert.deepEqual(limited.body, { error: { code: "RATE_LIMITED", message: "Try again later." } });
    assert.ok(Number(limited.headers["retry-after"]) > 0);
  });

  it("limits contact and newsletter submissions before a database write", async function () {
    let contacts = 0;
    let subscribers = 0;
    const db = {
      contactMessage: { create: async () => { contacts++; } },
      subscriber: { create: async () => { subscribers++; } },
    };
    const app = createApp(config, async () => {}, db);
    const contact = { name: "Test", email: "test@example.test", subject: "Hello", message: "Please respond" };
    for (let index = 0; index < 5; index++) await request(app).post("/api/v1/contact").send(contact).expect(201);
    await request(app).post("/api/v1/contact").send(contact).expect(429);
    assert.equal(contacts, 5);
    for (let index = 0; index < 20; index++) await request(app).post("/api/v1/newsletter/subscribe").send({ email: "test@example.test" }).expect(201);
    await request(app).post("/api/v1/newsletter/subscribe").send({ email: "test@example.test" }).expect(429);
    assert.equal(subscribers, 20);
  });

  it("rejects missing admin credentials and malformed JSON without leaking internals", async function () {
    const app = createApp(config, async () => {}, fakeDb);
    const denied = await request(app).get("/api/v1/auth/admin-check").expect(401);
    assert.equal(denied.body.error.code, "UNAUTHORIZED");
    const invalid = await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{").expect(400);
    assert.equal(invalid.body.error.code, "INVALID_JSON");
    assert.equal(JSON.stringify(invalid.body).includes(testDatabaseUrl), false);
  });
});
