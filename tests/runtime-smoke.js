const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const serverPath = path.join(__dirname, "..", "dist", "server.js");

async function findAvailablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function waitForExit(child) {
  return new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
}

async function waitForHealth(child, port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Server exited before becoming healthy.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server did not become healthy within five seconds.");
}

async function main() {
  const port = await findAvailablePort();
  const server = spawn(process.execPath, [serverPath], {
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), CORS_ORIGINS: "http://localhost:3000" },
    stdio: "ignore",
  });
  const health = await waitForHealth(server, port);
  assert.deepEqual(health, { status: "ok", service: "sage-api", version: "v1" });
  const serverExit = waitForExit(server);
  server.kill("SIGTERM");
  let timeout;
  const cleanExit = await Promise.race([
    serverExit,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Server did not stop after SIGTERM.")), 5000);
    }),
  ]);
  clearTimeout(timeout);
  if (process.platform === "win32") {
    assert.equal(cleanExit.code, null);
  } else {
    assert.equal(cleanExit.code, 0);
  }

  const invalid = spawn(process.execPath, [serverPath], {
    env: { ...process.env, NODE_ENV: "test", PORT: "invalid-secret-value" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  invalid.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  invalid.stderr.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  const invalidExit = await waitForExit(invalid);
  assert.equal(invalidExit.code, 1);
  assert.match(output, /PORT must be an integer/);
  assert.doesNotMatch(output, /invalid-secret-value/);
  process.stdout.write("Runtime smoke checks passed: process health, stop request, safe invalid configuration.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
