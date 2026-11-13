const { ConfigurationError, readConfig } = require("../../dist/config/env");

describe("readConfig", () => {
  test("uses safe defaults and parses allowed origins", () => {
    expect(readConfig({ CORS_ORIGINS: "https://sage.example, http://localhost:3000" })).toEqual({
      nodeEnv: "development",
      port: 3000,
      corsOrigins: ["https://sage.example", "http://localhost:3000"],
    });
  });

  test("rejects an invalid port without echoing environment values", () => {
    expect(() => readConfig({ PORT: "secret-value" })).toThrow(ConfigurationError);
    expect(() => readConfig({ PORT: "secret-value" })).toThrow("PORT must be an integer");
  });

  test("rejects unsupported environments", () => {
    expect(() => readConfig({ NODE_ENV: "production-ish" })).toThrow(ConfigurationError);
  });
});
