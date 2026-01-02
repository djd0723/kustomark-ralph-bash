#!/usr/bin/env node

/**
 * Kustomark Web Server
 * Express server for the kustomark web UI
 */

import type { Server } from "node:http";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createBuildRoutes } from "./routes/build.js";
import { createConfigRoutes } from "./routes/config.js";
import type { ServerConfig, WebSocketMessage } from "./types.js";

/**
 * Create and configure the Express application
 */
export function createApp(config: ServerConfig): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // CORS
  if (config.cors) {
    app.use(
      cors({
        origin: true, // Allow all origins in development
        credentials: true,
      }),
    );
  }

  // Request logging
  if (config.verbose) {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api/build", createBuildRoutes(config));
  app.use("/api/config", createConfigRoutes(config));

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server with optional WebSocket support
 */
export function startServer(config: ServerConfig): {
  server: Server;
  wss?: WebSocketServer;
  broadcast?: (message: WebSocketMessage) => void;
} {
  const app = createApp(config);

  // Create HTTP server
  const server = app.listen(config.port, config.host, () => {
    console.log(`Kustomark server listening on http://${config.host}:${config.port}`);
    console.log(`Base directory: ${config.baseDir}`);
    if (config.websocket) {
      console.log("WebSocket support enabled");
    }
  });

  // Set up WebSocket server if enabled
  let wss: WebSocketServer | undefined;
  let broadcast: ((message: WebSocketMessage) => void) | undefined;

  if (config.websocket) {
    wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
      if (config.verbose) {
        console.log("WebSocket client connected");
      }

      ws.on("close", () => {
        if (config.verbose) {
          console.log("WebSocket client disconnected");
        }
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });

    // Broadcast function to send messages to all connected clients
    broadcast = (message: WebSocketMessage) => {
      if (!wss) return;

      const payload = JSON.stringify(message);
      for (const client of wss.clients) {
        if (client.readyState === 1) {
          // OPEN
          client.send(payload);
        }
      }
    };
  }

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  return { server, wss, broadcast };
}

/**
 * Main entry point when run as a standalone script
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  let port = 3000;
  let host = "localhost";
  let baseDir = process.cwd();
  let cors = true;
  let verbose = false;
  let websocket = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--port" && i + 1 < args.length) {
      const portArg = args[i + 1];
      if (portArg) {
        port = Number.parseInt(portArg, 10);
        i++;
      }
    } else if (arg === "--host" && i + 1 < args.length) {
      const hostArg = args[i + 1];
      if (hostArg) {
        host = hostArg;
        i++;
      }
    } else if (arg === "--base-dir" && i + 1 < args.length) {
      const baseDirArg = args[i + 1];
      if (baseDirArg) {
        baseDir = resolve(baseDirArg);
        i++;
      }
    } else if (arg === "--no-cors") {
      cors = false;
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--no-websocket") {
      websocket = false;
    }
  }

  const config: ServerConfig = {
    port,
    host,
    baseDir,
    cors,
    verbose,
    websocket,
  };

  startServer(config);
}
