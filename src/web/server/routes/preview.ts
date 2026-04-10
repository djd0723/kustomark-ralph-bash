/**
 * Preview API endpoint — dry-run build returning per-file diffs
 */

import type { Response } from "express";
import { Router } from "express";
import {
  validateRequiredFields,
  validateString,
  validateStringArray,
} from "../middleware/validation.js";
import { loadConfig } from "../services/config-service.js";
import { executePreview } from "../services/preview-service.js";
import type { PreviewRequest, PreviewResponse, ServerConfig, TypedRequest } from "../types.js";

/**
 * Create preview routes
 */
export function createPreviewRoutes(config: ServerConfig): Router {
  const router = Router();

  /**
   * POST /api/preview
   * Execute a dry-run build and return per-file diffs
   * Body:
   *   - configPath: Path to config file (relative to base directory)
   *   - enableGroups: Enable specific patch groups (optional)
   *   - disableGroups: Disable specific patch groups (optional)
   */
  router.post(
    "/",
    validateRequiredFields(["configPath"]),
    validateString("configPath"),
    validateStringArray("enableGroups"),
    validateStringArray("disableGroups"),
    async (req: TypedRequest<PreviewRequest>, res: Response<PreviewResponse>) => {
      const { configPath, enableGroups, disableGroups } = req.body;

      if (config.verbose) {
        console.log(`Preview requested for: ${configPath}`);
      }

      const kustomarkConfig = loadConfig(config.baseDir, configPath);

      const result = await executePreview(
        config.baseDir,
        configPath,
        kustomarkConfig,
        enableGroups,
        disableGroups,
      );

      if (config.verbose) {
        console.log(
          `Preview completed: ${result.filesChanged} files changed in ${result.duration}ms`,
        );
      }

      res.json(result);
    },
  );

  return router;
}
