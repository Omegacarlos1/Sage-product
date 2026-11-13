require("dotenv/config");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");
const { createApp } = require("../../dist/app");
const { checkDatabaseConnection, createDatabaseClient } = require("../../dist/services/database");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must be set before running PostgreSQL integration tests.");
}

const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
const databaseHost = new URL(testDatabaseUrl).hostname;
if (databaseName !== "sage_lms_test" || !["localhost", "127.0.0.1"].includes(databaseHost)) {
  throw new Error("Integration tests only run against the sage_lms_test database.");
}

const database = createDatabaseClient(testDatabaseUrl);
const app = createApp(
  {
    nodeEnv: "test",
    port: 3000,
    corsOrigins: [],
    databaseUrl: testDatabaseUrl,
  },
  () => checkDatabaseConnection(database),
);

describe("M02 PostgreSQL integration", function () {
  after(async function () {
    await database.$disconnect();
  });

  it("connects to the isolated test database and serves its health check", async function () {
    await checkDatabaseConnection(database);
    await request(app)
      .get("/api/v1/health/database")
      .expect(200)
      .expect({ status: "ok", service: "sage-api", database: "connected" });
  });

  it("enforces unique subscriber emails in PostgreSQL", async function () {
    const email = `m02-${randomUUID()}@example.test`;
    await database.subscriber.create({ data: { email } });
    try {
      await assert.rejects(
        database.subscriber.create({ data: { email } }),
        (error) => error.code === "P2002",
      );
    } finally {
      await database.subscriber.delete({ where: { email } });
    }
  });

  it("enforces enrollment foreign keys", async function () {
    await assert.rejects(
      database.enrollment.create({
        data: { learnerId: randomUUID(), courseId: randomUUID() },
      }),
      (error) => error.code === "P2003",
    );
  });
});
