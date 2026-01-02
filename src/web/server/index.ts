/**
 * Kustomark Web Server
 * Express server providing REST API for the web UI
 */

import { createServer } from "node:http";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import type { Application } from "express";
import { WebSocketServer } from "ws";
import { errorHandler } from "./middleware/error-handler.js";
import { createBuildRoutes } from "./routes/build.js";
import { createConfigRoutes } from "./routes/config.js";
import type { ServerConfig, WebSocketMessage } from "./types.js";

/**
 * Extended Express Application with WebSocket broadcast capability
 */
declare global {
  namespace Express {
    interface Application {
      wsBroadcast?: (message: WebSocketMessage) => void;
    }
  }
}

/**
 * Create and configure the Express application
 */
function createApp(config: ServerConfig): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (config.cors) {
    app.use(
      cors({
        origin: true,
        credentials: true,
      }),
    );
  }

  // Request logging (if verbose)
  if (config.verbose) {
    app.use((req, _res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API routes
  app.use("/api/config", createConfigRoutes(config));
  app.use("/api/build", createBuildRoutes(config));

  // Serve static files from client build (production only)
  if (process.env.NODE_ENV === "production") {
    const clientDir = resolve(process.cwd(), "dist/web/client");
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => {
      res.sendFile(resolve(clientDir, "index.html"));
    });
  }

  // Error handling
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  // Server configuration from environment variables
  const config: ServerConfig = {
    port: Number.parseInt(process.env.KUSTOMARK_PORT || "3000", 10),
    host: process.env.KUSTOMARK_HOST || "localhost",
    baseDir: resolve(process.env.KUSTOMARK_BASE_DIR || process.cwd()),
    cors: process.env.KUSTOMARK_CORS !== "false",
    verbose: process.env.KUSTOMARK_VERBOSE === "true",
    websocket: process.env.KUSTOMARK_WEBSOCKET !== "false",
  };

  if (config.verbose) {
    console.log("Server configuration:", config);
  }

  // Create Express app
  const app = createApp(config);

  // Create HTTP server
  const server = createServer(app);

  // Set up WebSocket server for live updates
  if (config.websocket) {
    const wss = new WebSocketServer({ server, path: "/ws" });

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

    // Broadcast function for sending messages to all clients
    const broadcast = (message: WebSocketMessage): void => {
      const messageStr = JSON.stringify(message);
      for (const client of wss.clients) {
        if (client.readyState === 1) {
          // OPEN
          client.send(messageStr);
        }
      }
    };

    // Store broadcast function on app for use in routes
    app.wsBroadcast = broadcast;
  }

  // Start listening
  server.listen(config.port, config.host, () => {
    console.log(`\nKustomark Web Server running at http://${config.host}:${config.port}`);
    console.log(`Base directory: ${config.baseDir}`);
    if (config.websocket) {
      console.log(`WebSocket endpoint: ws://${config.host}:${config.port}/ws`);
    }
    console.log("\nPress Ctrl+C to stop\n");
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("\nShutting down server...");
    server.close(() => {
      console.log("Server stopped");
      process.exit(0);
    });

    // Force shutdown after 5 seconds
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
