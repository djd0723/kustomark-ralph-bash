/**
 * History API endpoints — list, inspect, and rollback builds
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Request, Response } from "express";
import { Router } from "express";
import {
  getHistoryStats,
  listBuilds,
  loadBuild,
  rollbackBuild,
} from "../../../core/build-history.js";
import { loadConfig } from "../services/config-service.js";
import type {
  HistoryListResponse,
  HistoryRollbackRequest,
  HistoryRollbackResponse,
  HistoryStatsResponse,
  ServerConfig,
  TypedRequest,
} from "../types.js";

/**
 * Create history routes
 */
export function createHistoryRoutes(config: ServerConfig): Router {
  const router = Router();

  /**
   * GET /api/history
   * List build history entries
   * Query:
   *   - configPath: Path to config file (relative to base directory)
   *   - limit: Maximum number of builds to return (optional)
   *   - success: Filter by success status (optional, "true" or "false")
   */
  router.get("/", async (req: Request, res: Response<HistoryListResponse>) => {
    const configPath = req.query.configPath as string | undefined;
    if (!configPath || typeof configPath !== "string") {
      res.status(400).json({ error: "configPath query parameter is required" } as never);
      return;
    }

    const limitStr = req.query.limit as string | undefined;
    const successStr = req.query.success as string | undefined;

    const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
    const success = successStr === "true" ? true : successStr === "false" ? false : undefined;

    if (config.verbose) {
      console.log(`History list requested for: ${configPath}`);
    }

    const absoluteConfigPath = resolve(config.baseDir, configPath);

    const filter: { success?: boolean; limit?: number } = {};
    if (success !== undefined) filter.success = success;
    if (limit !== undefined && !Number.isNaN(limit)) filter.limit = limit;

    const builds = await listBuilds(absoluteConfigPath, filter);
    const stats = await getHistoryStats(absoluteConfigPath);

    res.json({ builds, totalBuilds: stats.totalBuilds });
  });

  /**
   * GET /api/history/stats
   * Get aggregate statistics for build history
   * Query:
   *   - configPath: Path to config file (relative to base directory)
   */
  router.get("/stats", async (req: Request, res: Response<HistoryStatsResponse>) => {
    const configPath = req.query.configPath as string | undefined;
    if (!configPath || typeof configPath !== "string") {
      res.status(400).json({ error: "configPath query parameter is required" } as never);
      return;
    }

    if (config.verbose) {
      console.log(`History stats requested for: ${configPath}`);
    }

    const absoluteConfigPath = resolve(config.baseDir, configPath);
    const stats = await getHistoryStats(absoluteConfigPath);

    res.json(stats);
  });

  /**
   * GET /api/history/:id
   * Get a specific build entry by ID
   * Query:
   *   - configPath: Path to config file (relative to base directory)
   */
  router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const configPath = req.query.configPath as string | undefined;
    if (!configPath || typeof configPath !== "string") {
      res.status(400).json({ error: "configPath query parameter is required" });
      return;
    }

    if (!id) {
      res.status(400).json({ error: "Build ID is required" });
      return;
    }

    if (config.verbose) {
      console.log(`History entry requested: ${id} for ${configPath}`);
    }

    const absoluteConfigPath = resolve(config.baseDir, configPath);
    const entry = await loadBuild(id, absoluteConfigPath);

    if (!entry) {
      res.status(404).json({ error: `Build not found: ${id}` });
      return;
    }

    res.json(entry);
  });

  /**
   * POST /api/history/rollback/:id
   * Rollback to a specific build
   * Body:
   *   - configPath: Path to config file (relative to base directory)
   *   - dryRun: Dry-run mode (optional, default false)
   */
  router.post(
    "/rollback/:id",
    async (req: TypedRequest<HistoryRollbackRequest>, res: Response<HistoryRollbackResponse>) => {
      const { id } = req.params;
      const { configPath, dryRun = false } = req.body;

      if (!configPath || typeof configPath !== "string") {
        res.status(400).json({ error: "configPath is required" } as never);
        return;
      }

      if (!id) {
        res.status(400).json({ error: "Build ID is required" } as never);
        return;
      }

      if (config.verbose) {
        console.log(`History rollback requested: ${id} for ${configPath} (dryRun=${dryRun})`);
      }

      const absoluteConfigPath = resolve(config.baseDir, configPath);

      // Verify the build exists
      const entry = await loadBuild(id, absoluteConfigPath);
      if (!entry) {
        res.status(404).json({ error: `Build not found: ${id}` } as never);
        return;
      }

      // Get output directory from config
      let outputDir: string;
      try {
        const kustomarkConfig = loadConfig(config.baseDir, configPath);
        outputDir = join(config.baseDir, kustomarkConfig.output ?? "output");
      } catch {
        outputDir = join(config.baseDir, "output");
      }

      if (dryRun) {
        // In dry-run, report what files would be restored without touching disk
        const filesRestored = entry.files.map((f) => f.path);
        res.json({
          success: true,
          filesRestored,
          dryRun: true,
          buildId: id,
        });
        return;
      }

      // Check that output dir exists or entry has files to restore
      if (!existsSync(outputDir)) {
        res.status(400).json({ error: "Output directory does not exist" } as never);
        return;
      }

      const result = await rollbackBuild(id, outputDir, absoluteConfigPath);

      res.json({
        success: result.success,
        filesRestored: result.filesRestored,
        dryRun: false,
        buildId: id,
      });
    },
  );

  return router;
}
