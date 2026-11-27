import cors from "cors";
import helmet from "helmet";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import type { AppConfig } from "./config/env";
import type { PrismaClient } from "./generated/prisma/client";
import { authRouter } from "./routes/auth";
import { profileRouter, instructorRouter } from "./routes/profiles";
import { categoryRouter, courseRouter } from "./routes/courses";
import { publicSubmissionsRouter } from "./routes/public-submissions";
import { mediaRouter } from "./routes/media";
import { enrollmentRouter } from "./routes/enrollments";
import { paymentRouter } from "./routes/payments";
import { progressRouter } from "./routes/progress";
import { quizRouter } from "./routes/quizzes";
import { certificateRouter } from "./routes/certificates";
import { reviewRouter } from "./routes/reviews";
import { financeRouter } from "./routes/finance";
import { adminRouter } from "./routes/admin";
import type { PaymentGateway } from "./services/paystack";
import { LocalMediaStorage } from "./services/media-storage";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { notificationRouter, type NotificationPublisher, noPublisher } from "./services/notifications";

export function createApp(config: AppConfig, checkDatabase: () => Promise<void> = async () => {
  throw new Error("Database health check is not configured.");
}, database?: PrismaClient, paymentGateway?: PaymentGateway, publish: NotificationPublisher = noPublisher) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false }));
  app.use("/api/v1/payments/paystack/webhook", express.raw({ type: "application/json", limit: "100kb" }));
  app.use(express.json({ limit: "100kb" }));
  if (database) app.use("/api/v1", paymentRouter(database, config, paymentGateway, publish));
  app.use("/api/v1/media/:key/upload", express.raw({ type: ["video/mp4", "audio/mpeg", "application/pdf"], limit: "100mb" }));

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

  // Readiness is dependency-aware; keep the legacy database health route for existing clients.
  app.get("/api/v1/ready", async (_request: Request, response: Response) => {
    try {
      await checkDatabase();
      response.status(200).json({ status: "ready", service: "sage-api" });
    } catch {
      console.warn(JSON.stringify({ level: "warn", message: "Readiness check failed" }));
      response.status(503).json({ error: { code: "NOT_READY", message: "Service is not ready." } });
    }
  });

  if (database) {
    app.use("/api/v1/notifications", notificationRouter(database));
    app.use("/api/v1", enrollmentRouter(database, publish));
    app.use("/api/v1", progressRouter(database));
    app.use("/api/v1", quizRouter(database, publish));
    app.use("/api/v1", certificateRouter(database, publish));
    app.use("/api/v1", reviewRouter(database));
    app.use("/api/v1", financeRouter(database));
    app.use("/api/v1/admin", adminRouter(database, publish));
    app.use("/api/v1", mediaRouter(database, new LocalMediaStorage(config.mediaRoot ?? path.resolve(".media-private"), config.mediaSigningSecret ?? randomBytes(32).toString("hex"))));
    app.use("/api/v1", publicSubmissionsRouter(database));
    app.use("/api/v1/auth", authRouter(database, config));
    app.use("/api/v1/profile", profileRouter(database));
    app.use("/api/v1/instructors", instructorRouter(database));
    app.use("/api/v1/categories", categoryRouter(database));
    app.use("/api/v1/courses", courseRouter(database, publish));
  }

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
      response.status(413).json({ error: { code: "FILE_TOO_LARGE", message: "Upload exceeds the size limit." } });
      return;
    }
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
