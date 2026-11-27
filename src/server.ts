import "dotenv/config";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app";
import { type AppConfig, ConfigurationError, readConfig } from "./config/env";
import { createDatabaseClient, checkDatabaseConnection } from "./services/database";
import { hashToken } from "./services/auth";
import type { NotificationPublisher } from "./services/notifications";

export function createSageServer(config: AppConfig) {
  const database = createDatabaseClient(config.databaseUrl);
  let publish: NotificationPublisher = () => {};
  const httpServer = createServer(createApp(config, () => checkDatabaseConnection(database), database, undefined, (userId, event) => publish(userId, event)));
  const io = new SocketServer(httpServer, {
    cors: { origin: config.corsOrigins.length > 0 ? config.corsOrigins : false },
  });

  publish = (userId, event) => { void (async () => {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      const session = await database.authSession.findUnique({ where: { accessTokenHash: socket.data.accessTokenHash }, select: { revokedAt: true, accessExpiresAt: true, user: { select: { status: true } } } });
      if (!session || session.revokedAt || session.accessExpiresAt <= new Date() || session.user.status !== "ACTIVE") { socket.disconnect(true); continue; }
      socket.emit("notification:new", event);
    }
  })().catch(() => console.warn(JSON.stringify({ level: "warn", message: "Notification delivery failed; REST history remains available." }))); };
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) { next(new Error("UNAUTHORIZED")); return; }
    try {
      const session = await database.authSession.findUnique({ where: { accessTokenHash: hashToken(token) }, select: { userId: true, accessExpiresAt: true, revokedAt: true, user: { select: { status: true } } } });
      if (!session || session.revokedAt || session.accessExpiresAt <= new Date() || session.user.status !== "ACTIVE") { next(new Error("UNAUTHORIZED")); return; }
      socket.data.userId = session.userId;
      socket.data.accessTokenHash = hashToken(token);
      socket.data.expiresAt = session.accessExpiresAt.getTime();
      next();
    } catch { next(new Error("AUTH_UNAVAILABLE")); }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()));
    socket.on("disconnect", () => clearTimeout(expiry));
  });

  return { httpServer, io, database };
}

export async function closeSageServer(
  io: SocketServer,
  database?: { $disconnect: () => Promise<void> },
): Promise<void> {
  const closeSocketServer = new Promise<void>((resolve, reject) => {
    io.close((error?: Error) => error ? reject(error) : resolve());
  });
  await Promise.all([closeSocketServer, database?.$disconnect() ?? Promise.resolve()]);
}

function start(): void {
  let config;
  try {
    config = readConfig(process.env);
  } catch (error) {
    const message = error instanceof ConfigurationError ? error.message : "Invalid server configuration.";
    console.error(JSON.stringify({ level: "error", message }));
    process.exitCode = 1;
    return;
  }

  const { httpServer, io, database } = createSageServer(config);

  httpServer.listen(config.port, () => {
    console.info(JSON.stringify({ level: "info", message: "SAGE API listening", port: config.port }));
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(JSON.stringify({ level: "info", message: "Shutting down", signal }));
    void closeSageServer(io, database).then(() => {
      process.exitCode = 0;
    }).catch(() => {
      process.exitCode = 1;
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

if (require.main === module) start();
