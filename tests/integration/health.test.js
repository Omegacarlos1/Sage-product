const request = require("supertest");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { closeSageServer, createSageServer } = require("../../dist/server");
const { createApp } = require("../../dist/app");

const appConfig = {
  nodeEnv: "test",
  port: 3000,
  corsOrigins: ["http://localhost:3000"],
  databaseUrl: "postgresql://sage_app:local-only@localhost:5432/sage_lms_test?schema=public",
};
const app = createApp(appConfig, async () => {});

describe("API health and HTTP foundation", () => {
  it("returns a predictable health response", async () => {
    await request(app)
      .get("/api/v1/health")
      .expect("Content-Type", /json/)
      .expect(200)
      .expect({ status: "ok", service: "sage-api", version: "v1" });
  });

  it("reports that the database is unavailable without leaking connection details", async () => {
    const failedDatabaseApp = createApp(appConfig, async () => {
      throw new Error("password=do-not-return-this");
    });
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      await request(failedDatabaseApp)
        .get("/api/v1/health/database")
        .expect(503)
        .expect({
          error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." },
        });
    } finally {
      console.warn = originalWarn;
    }
  });

  it("returns a structured 404 for unknown routes", async () => {
    await request(app)
      .get("/api/v1/unknown")
      .expect(404)
      .expect({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  it("returns a safe 400 for malformed JSON", async () => {
    await request(app)
      .post("/api/v1/example")
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400)
      .expect({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
  });

  it("returns the database-unavailable response if no database check is configured", async () => {
    await request(createApp(appConfig))
      .get("/api/v1/health/database")
      .expect(503)
      .expect({
        error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." },
      });
  });

  it("starts and closes the HTTP and Socket.IO server cleanly", async () => {
    const { httpServer, io, database } = createSageServer({ ...appConfig, port: 0 });
    httpServer.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    const address = httpServer.address();
    assert(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
    assert.equal(response.status, 200);
    await closeSageServer(io, database);
    assert.equal(httpServer.listening, false);
  });
});
