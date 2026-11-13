export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigins: string[];
};

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new ConfigurationError("NODE_ENV must be development, test, or production.");
  }

  const portValue = env.PORT ?? "3000";
  if (!/^\d+$/.test(portValue)) {
    throw new ConfigurationError("PORT must be an integer between 1 and 65535.");
  }
  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError("PORT must be an integer between 1 and 65535.");
  }

  const corsOrigins = (env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return { nodeEnv, port, corsOrigins };
}
