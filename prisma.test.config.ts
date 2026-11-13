import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const testDatabaseUrl = env("TEST_DATABASE_URL");
let testDatabase: URL;
try {
  testDatabase = new URL(testDatabaseUrl);
} catch {
  throw new Error("TEST_DATABASE_URL must point to the local sage_lms_test database.");
}
if (
  testDatabase.pathname !== "/sage_lms_test"
  || !["postgres:", "postgresql:"].includes(testDatabase.protocol)
  || !["localhost", "127.0.0.1"].includes(testDatabase.hostname)
) {
  throw new Error("Database migrations for tests are restricted to local sage_lms_test.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: testDatabaseUrl,
  },
});
