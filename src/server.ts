import "dotenv/config";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app";
import { type AppConfig, ConfigurationError, readConfig } from "./config/env";
import { createDatabaseClient, checkDatabaseConnection } from "./services/database";

export function createSageServer(config: AppConfig) {
  const database = createDatabaseClient(config.databaseUrl);
  const httpServer = createServer(createApp(config, () => checkDatabaseConnection(database)));
  const io = new SocketServer(httpServer, {
    cors: { origin: config.corsOrigins.length > 0 ? config.corsOrigins : false },
  });

  io.on("connection", (socket) => {
    console.info(JSON.stringify({ level: "info", message: "Socket connected", socketId: socket.id }));
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
