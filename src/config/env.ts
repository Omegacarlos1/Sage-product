export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  mediaRoot?: string;
  mediaSigningSecret?: string;
  paystackSecretKey?: string;
  paystackWebhookSecret?: string;
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

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ConfigurationError("DATABASE_URL must be set to a PostgreSQL connection URL.");
  }
  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new ConfigurationError("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)
    || !parsedDatabaseUrl.hostname
    || parsedDatabaseUrl.pathname.length < 2
    || parsedDatabaseUrl.hash
  ) {
    throw new ConfigurationError("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (nodeEnv === "production" && (!env.MEDIA_ROOT || !env.MEDIA_SIGNING_SECRET || env.MEDIA_SIGNING_SECRET.length < 32)) {
    throw new ConfigurationError("MEDIA_ROOT and a MEDIA_SIGNING_SECRET of at least 32 characters are required in production.");
  }
  if (env.PAYSTACK_SECRET_KEY && !/^sk_(test|live)_[A-Za-z0-9]+$/.test(env.PAYSTACK_SECRET_KEY)) {
    throw new ConfigurationError("PAYSTACK_SECRET_KEY must be a Paystack secret key.");
  }
  if (nodeEnv === "production" && env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_WEBHOOK_SECRET) {
    throw new ConfigurationError("PAYSTACK_WEBHOOK_SECRET is required with Paystack in production.");
  }
  return { nodeEnv, port, corsOrigins, databaseUrl, mediaRoot: env.MEDIA_ROOT, mediaSigningSecret: env.MEDIA_SIGNING_SECRET,
    ...(env.PAYSTACK_SECRET_KEY ? { paystackSecretKey: env.PAYSTACK_SECRET_KEY } : {}),
    ...(env.PAYSTACK_WEBHOOK_SECRET ? { paystackWebhookSecret: env.PAYSTACK_WEBHOOK_SECRET } : {}) };
}
