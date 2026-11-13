import cors from "cors";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import type { AppConfig } from "./config/env";

export function createApp(config: AppConfig, checkDatabase: () => Promise<void> = async () => {
  throw new Error("Database health check is not configured.");
}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/v1/health", (_request: Request, response: Response) => {
    response.status(200).json({ status: "ok", service: "sage-api", version: "v1" });
  });

  app.get("/api/v1/health/database", async (_request: Request, response: Response) => {
    try {
      await checkDatabase();
      response.status(200).json({ status: "ok", service: "sage-api", database: "connected" });
    } catch {
      console.warn(JSON.stringify({ level: "warn", message: "Database health check failed" }));
      response.status(503).json({
        error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable." },
      });
    }
  });

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
      return;
    }

    console.error(JSON.stringify({ level: "error", message: "Unhandled request error" }));
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  };
  app.use(errorHandler);

  return app;
}
