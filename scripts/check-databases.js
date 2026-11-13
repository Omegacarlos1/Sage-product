require("dotenv/config");
const { Client } = require("pg");

const databases = [
  { key: "DATABASE_URL", name: "sage_lms_dev" },
  { key: "TEST_DATABASE_URL", name: "sage_lms_test" },
  { key: "SHADOW_DATABASE_URL", name: "sage_lms_shadow" },
];

async function checkDatabase({ key, name }) {
  const connectionString = process.env[key];
  if (!connectionString) {
    process.stdout.write(`${key}: missing from .env\n`);
    return false;
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    process.stdout.write(`${key}: invalid PostgreSQL URL\n`);
    return false;
  }

  if (
    url.pathname !== `/${name}`
    || !["localhost", "127.0.0.1"].includes(url.hostname)
    || !["postgres:", "postgresql:"].includes(url.protocol)
  ) {
    process.stdout.write(`${key}: must target local ${name}\n`);
    return false;
  }

  const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const result = await client.query("SELECT current_database() AS name");
    process.stdout.write(`${key}: connected to ${result.rows[0].name}\n`);
    return result.rows[0].name === name;
  } catch (error) {
    const code = error.code || error.name;
    const detail = code === "28P01" ? "authentication failed; reset sage_app and update .env" : `connection failed (${code})`;
    process.stdout.write(`${key}: ${detail}\n`);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const results = await Promise.all(databases.map(checkDatabase));
  if (results.some((result) => !result)) process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write("Database checks could not be completed.\n");
  process.exitCode = 1;
});
