/**
 * Config CRUD API endpoints
 */

import type { Response } from "express";
import { Router } from "express";
import { validateRequiredFields, validateString } from "../middleware/validation.js";
import { getConfigSchema, saveConfig, validateConfigFile } from "../services/config-service.js";
import { readFile } from "../services/file-service.js";
import type {
  ConfigSaveRequest,
  ConfigSaveResponse,
  ErrorResponse,
  FileContent,
  ServerConfig,
  TypedRequest,
  ValidateResponse,
} from "../types.js";

/**
 * Create config routes
 */
export function createConfigRoutes(config: ServerConfig): Router {
  const router = Router();

  /**
   * GET /api/config
   * Get config file content
   * Query params:
   *   - path: Config file path (relative to base directory, required)
   */
  router.get("/", (req: TypedRequest, res: Response<FileContent | ErrorResponse>) => {
    const path = req.query.path;

    if (!path || typeof path !== "string") {
      res.status(400).json({
        error: "Missing or invalid 'path' query parameter",
        status: 400,
      });
      return;
    }

    const content = readFile(config.baseDir, path);
    res.json(content);
  });

  /**
   * POST /api/config
   * Save config file
   * Body:
   *   - path: Config file path (relative to base directory)
   *   - content: Config content as YAML string
   */
  router.post(
    "/",
    validateRequiredFields(["path", "content"]),
    validateString("path"),
    validateString("content"),
    (req: TypedRequest<ConfigSaveRequest>, res: Response<ConfigSaveResponse>) => {
      const { path, content } = req.body;

      saveConfig(config.baseDir, path, content);

      res.json({
        success: true,
        path,
      });
    },
  );

  /**
   * POST /api/config/validate
   * Validate config file or content
   * Body (one of):
   *   - path: Config file path to validate
   *   - content: Config content string to validate
   */
  router.post("/validate", (req: TypedRequest, res: Response<ValidateResponse>) => {
    const body = req.body as { path?: string; content?: string };
    const path = body?.path;
    const content = body?.content;

    let validation: ValidateResponse;

    if (path && typeof path === "string") {
      // Validate file
      validation = validateConfigFile(config.baseDir, path);
    } else if (content && typeof content === "string") {
      // Validate content
      const { validateConfigContent } = require("../services/config-service.js");
      validation = validateConfigContent(content);
    } else {
      res.status(400).json({
        valid: false,
        errors: [
          {
            message: "Either 'path' or 'content' must be provided",
          },
        ],
        warnings: [],
      });
      return;
    }

    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  });

  /**
   * GET /api/config/schema
   * Get JSON schema for kustomark config
   */
  router.get("/schema", (_req: TypedRequest, res: Response) => {
    const schema = getConfigSchema();
    res.json(schema);
  });

  return router;
}
