import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const databaseUrl = env("DATABASE_URL");
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

if (process.env.NODE_ENV !== "production") {
  let developmentDatabase: URL;
  let shadowDatabase: URL;
  try {
    developmentDatabase = new URL(databaseUrl);
    if (!shadowDatabaseUrl) throw new Error();
    shadowDatabase = new URL(shadowDatabaseUrl);
  } catch {
    throw new Error("Local migrations require valid DATABASE_URL and SHADOW_DATABASE_URL values.");
  }
  const isLocalPostgres = (url: URL) =>
    ["postgres:", "postgresql:"].includes(url.protocol)
    && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    developmentDatabase.pathname !== "/sage_lms_dev"
    || shadowDatabase.pathname !== "/sage_lms_shadow"
    || !isLocalPostgres(developmentDatabase)
    || !isLocalPostgres(shadowDatabase)
  ) {
    throw new Error("Local Prisma migrations are restricted to sage_lms_dev and sage_lms_shadow.");
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: databaseUrl,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
