require("dotenv/config");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../dist/app");

const app = createApp({ nodeEnv: "test", port: 3000, corsOrigins: [], databaseUrl: process.env.TEST_DATABASE_URL }, async () => {});
const count = 100;
const started = Date.now();
Promise.all(Array.from({ length: count }, () => request(app).get("/api/v1/health")))
  .then((responses) => {
    assert.ok(responses.every((response) => response.status === 200));
    const elapsed = Date.now() - started;
    console.log(JSON.stringify({ scenario: "100 concurrent local health requests", passed: count, failed: 0, elapsedMs: elapsed }));
  })
  .catch((error) => { console.error(error.message); process.exitCode = 1; });
