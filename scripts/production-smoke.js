// Read-only smoke checks. Run only against the approved deployment URL.
const assert = require("node:assert/strict");
const base = process.env.SMOKE_BASE_URL;
if (!base || !/^https:\/\/[^/]+$/.test(base)) {
  console.error("Set SMOKE_BASE_URL to an HTTPS origin without a path.");
  process.exit(2);
}
const checks = [
  ["/api/v1/health", 200, (body) => body.status === "ok"],
  ["/api/v1/ready", 200, (body) => body.status === "ready"],
  ["/api/v1/categories", 200, (body) => body !== null],
];
(async () => {
  for (const [path, expected, valid] of checks) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(5000) });
    const body = await response.json();
    assert.equal(response.status, expected, `${path}: HTTP ${response.status}`);
    assert(valid(body), `${path}: unexpected response`);
    console.log(`${path}: ${response.status}`);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
