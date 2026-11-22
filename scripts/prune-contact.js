require("dotenv/config");
const { createDatabaseClient } = require("../dist/services/database");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["postgres:", "postgresql:"].includes(new URL(url).protocol)) throw new Error("DATABASE_URL must be PostgreSQL.");
  const db = createDatabaseClient(url);
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await db.contactMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
    process.stdout.write(`Pruned ${result.count} contact messages older than 90 days.\n`);
  } finally { await db.$disconnect(); }
}
main().catch(() => { process.stderr.write("Contact retention job failed.\n"); process.exitCode = 1; });
