const request = require("supertest");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { closeSageServer, createSageServer } = require("../../dist/server");
const { createApp } = require("../../dist/app");

const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: ["http://localhost:3000"] });

describe("M01 HTTP foundation", () => {
  it("returns a predictable health response", async () => {
    await request(app)
      .get("/api/v1/health")
      .expect("Content-Type", /json/)
      .expect(200)
      .expect({ status: "ok", service: "sage-api", version: "v1" });
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

  it("starts and closes the HTTP and Socket.IO server cleanly", async () => {
    const { httpServer, io } = createSageServer({ nodeEnv: "test", port: 0, corsOrigins: [] });
    httpServer.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    const address = httpServer.address();
    assert(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
    assert.equal(response.status, 200);
    await closeSageServer(io);
    assert.equal(httpServer.listening, false);
  });
});
