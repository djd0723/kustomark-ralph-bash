/**
 * Web UI command
 * Launches the kustomark web interface
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface WebCommandOptions {
  dev?: boolean;
  port?: number;
  host?: string;
  open?: boolean;
  verbose?: boolean;
}

/**
 * Launch the web UI server
 */
export async function webCommand(path: string, options: WebCommandOptions): Promise<number> {
  const baseDir = resolve(path);

  // Verify the base directory exists
  if (!existsSync(baseDir)) {
    console.error(`Error: Directory not found: ${baseDir}`);
    return 1;
  }

  const port = options.port ?? 3000;
  const host = options.host ?? "localhost";
  const isDev = options.dev ?? false;

  if (options.verbose) {
    console.log("Starting kustomark web UI...");
    console.log(`  Base directory: ${baseDir}`);
    console.log(`  Mode: ${isDev ? "development" : "production"}`);
    console.log(`  URL: http://${host}:${port}`);
  }

  try {
    if (isDev) {
      // Development mode: Run dev servers
      console.log("\nStarting development servers...");
      console.log(`Web UI will be available at http://${host}:${port}\n`);

      // Use the dev-web.sh script
      const devScript = resolve(process.cwd(), "scripts/dev-web.sh");

      if (!existsSync(devScript)) {
        console.error(
          "Error: Development script not found. Make sure you're running from the project root.",
        );
        return 1;
      }

      const child = spawn("bash", [devScript], {
        stdio: "inherit",
        env: {
          ...process.env,
          KUSTOMARK_BASE_DIR: baseDir,
          KUSTOMARK_PORT: port.toString(),
          KUSTOMARK_HOST: host,
        },
      });

      // Handle process exit
      let hasExited = false;

      const cleanup = () => {
        if (!hasExited) {
          hasExited = true;
          child.kill("SIGTERM");
        }
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      return new Promise<number>((resolve) => {
        child.on("exit", (code) => {
          hasExited = true;
          resolve(code ?? 0);
        });
      });
    }
    // Production mode: Run built server
    const serverPath = resolve(process.cwd(), "dist/web/index.js");

    if (!existsSync(serverPath)) {
      console.error("Error: Production server not found. Run 'bun run build:web' first.");
      return 1;
    }

    console.log(`Web UI available at http://${host}:${port}`);
    console.log("Press Ctrl+C to stop\n");

    const child = spawn("node", [serverPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        KUSTOMARK_BASE_DIR: baseDir,
        KUSTOMARK_PORT: port.toString(),
        KUSTOMARK_HOST: host,
      },
    });

    // Handle process exit
    let hasExited = false;

    const cleanup = () => {
      if (!hasExited) {
        hasExited = true;
        child.kill("SIGTERM");
      }
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    return new Promise<number>((resolve) => {
      child.on("exit", (code) => {
        hasExited = true;
        resolve(code ?? 0);
      });
    });
  } catch (error) {
    console.error(
      `Error starting web UI: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}
