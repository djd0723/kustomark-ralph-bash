/**
 * Build API endpoint
 */

import type { Response } from "express";
import { Router } from "express";
import {
  validateBoolean,
  validateRequiredFields,
  validateString,
  validateStringArray,
} from "../middleware/validation.js";
import { executeBuild } from "../services/build-service.js";
import { loadConfig } from "../services/config-service.js";
import type { BuildRequest, BuildResponse, ServerConfig, TypedRequest } from "../types.js";

/**
 * Create build routes
 */
export function createBuildRoutes(config: ServerConfig): Router {
  const router = Router();

  /**
   * POST /api/build
   * Execute a build
   * Body:
   *   - configPath: Path to config file (relative to base directory)
   *   - incremental: Enable incremental build (optional)
   *   - clean: Clean build (optional)
   *   - enableGroups: Enable specific patch groups (optional)
   *   - disableGroups: Disable specific patch groups (optional)
   */
  router.post(
    "/",
    validateRequiredFields(["configPath"]),
    validateString("configPath"),
    validateBoolean("incremental"),
    validateBoolean("clean"),
    validateStringArray("enableGroups"),
    validateStringArray("disableGroups"),
    async (req: TypedRequest<BuildRequest>, res: Response<BuildResponse>) => {
      const { configPath, enableGroups, disableGroups } = req.body;

      if (config.verbose) {
        console.log(`Build requested for: ${configPath}`);
      }

      // Load config
      const kustomarkConfig = loadConfig(config.baseDir, configPath);

      // Execute build
      const result = await executeBuild(
        config.baseDir,
        configPath,
        kustomarkConfig,
        enableGroups,
        disableGroups,
      );

      if (config.verbose) {
        console.log(
          `Build completed: ${result.filesWritten} files written, ${result.patchesApplied} patches applied in ${result.duration}ms`,
        );
      }

      res.json(result);
    },
  );

  return router;
}
