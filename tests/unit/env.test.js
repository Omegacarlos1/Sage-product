const { ConfigurationError, readConfig } = require("../../dist/config/env");

describe("readConfig", () => {
  test("uses safe defaults and parses allowed origins", () => {
    expect(readConfig({
      CORS_ORIGINS: "https://sage.example, http://localhost:3000",
      DATABASE_URL: "postgresql://sage_app:local-only@localhost:5432/sage_lms_dev?schema=public",
    })).toEqual({
      nodeEnv: "development",
      port: 3000,
      corsOrigins: ["https://sage.example", "http://localhost:3000"],
      databaseUrl: "postgresql://sage_app:local-only@localhost:5432/sage_lms_dev?schema=public",
    });
  });

  test("rejects an invalid port without echoing environment values", () => {
    expect(() => readConfig({ PORT: "secret-value", DATABASE_URL: "postgresql://localhost/db" })).toThrow(ConfigurationError);
    expect(() => readConfig({ PORT: "secret-value", DATABASE_URL: "postgresql://localhost/db" })).toThrow("PORT must be an integer");
  });

  test("rejects unsupported environments", () => {
    expect(() => readConfig({ NODE_ENV: "production-ish", DATABASE_URL: "postgresql://localhost/db" })).toThrow(ConfigurationError);
  });

  test("rejects a missing or malformed database URL safely", () => {
    expect(() => readConfig({})).toThrow("DATABASE_URL must be set");
    expect(() => readConfig({ DATABASE_URL: "not-a-url" })).toThrow("valid PostgreSQL connection URL");
  });
});
