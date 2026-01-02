/**
 * Configuration service for loading, saving, and validating kustomark configs
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import * as yaml from "js-yaml";
import { parseConfig, validateConfig } from "../../../core/config-parser.js";
import type { KustomarkConfig, ValidationResult } from "../../../core/types.js";
import { HttpError } from "../middleware/error-handler.js";

/**
 * Load a kustomark config file
 *
 * @param baseDir - Base directory for resolving paths
 * @param configPath - Path to config file (relative to baseDir)
 * @returns Parsed and validated KustomarkConfig
 * @throws HttpError if file not found or invalid
 */
export function loadConfig(baseDir: string, configPath: string): KustomarkConfig {
  const absolutePath = resolve(baseDir, configPath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    throw new HttpError(404, `Config file not found: ${configPath}`);
  }

  try {
    // Read and parse config
    const content = readFileSync(absolutePath, "utf-8");
    const config = parseConfig(content);

    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new HttpError(400, "Invalid config file", {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    return config;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      400,
      `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Save a kustomark config file
 *
 * @param baseDir - Base directory for resolving paths
 * @param configPath - Path to config file (relative to baseDir)
 * @param content - Config content as YAML string
 * @throws HttpError if validation fails or save fails
 */
export function saveConfig(baseDir: string, configPath: string, content: string): void {
  const absolutePath = resolve(baseDir, configPath);

  try {
    // Validate content before saving
    const config = parseConfig(content);
    const validation = validateConfig(config);

    if (!validation.valid) {
      throw new HttpError(400, "Invalid config content", {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Ensure directory exists
    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      mkdir(dir, { recursive: true });
    }

    // Write file
    writeFileSync(absolutePath, content, "utf-8");
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      500,
      `Failed to save config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate a config file
 *
 * @param baseDir - Base directory for resolving paths
 * @param configPath - Path to config file (relative to baseDir)
 * @returns ValidationResult
 * @throws HttpError if file not found or cannot be read
 */
export function validateConfigFile(baseDir: string, configPath: string): ValidationResult {
  const absolutePath = resolve(baseDir, configPath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    throw new HttpError(404, `Config file not found: ${configPath}`);
  }

  try {
    // Read and parse config
    const content = readFileSync(absolutePath, "utf-8");
    const config = parseConfig(content);

    // Validate config
    return validateConfig(config);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    // Return validation error
    return {
      valid: false,
      errors: [
        {
          message: `Failed to parse config: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Validate config content string
 *
 * @param content - Config content as YAML string
 * @returns ValidationResult
 */
export function validateConfigContent(content: string): ValidationResult {
  try {
    // Parse config
    const config = parseConfig(content);

    // Validate config
    return validateConfig(config);
  } catch (error) {
    // Return validation error
    return {
      valid: false,
      errors: [
        {
          message: `Failed to parse config: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Get the JSON schema for kustomark config files
 *
 * @returns JSON schema object
 */
export function getConfigSchema(): Record<string, unknown> {
  // Import and use the schema generator from core
  // For now, return a basic schema structure
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["apiVersion", "kind", "resources"],
    properties: {
      apiVersion: {
        type: "string",
        const: "kustomark/v1",
        description: "API version - must be 'kustomark/v1'",
      },
      kind: {
        type: "string",
        const: "Kustomization",
        description: "Kind - must be 'Kustomization'",
      },
      output: {
        type: "string",
        description: "Output directory for build results",
      },
      resources: {
        type: "array",
        description: "List of resource files, patterns, or URLs",
        minItems: 1,
        items: {
          type: "string",
        },
      },
      patches: {
        type: "array",
        description: "List of patch operations to apply",
        items: {
          type: "object",
          required: ["op"],
          properties: {
            op: {
              type: "string",
              enum: [
                "replace",
                "replace-regex",
                "remove-section",
                "replace-section",
                "prepend-to-section",
                "append-to-section",
                "set-frontmatter",
                "remove-frontmatter",
                "rename-frontmatter",
                "merge-frontmatter",
                "delete-between",
                "replace-between",
                "replace-line",
                "insert-after-line",
                "insert-before-line",
                "move-section",
                "rename-header",
                "change-section-level",
              ],
            },
            id: {
              type: "string",
              description: "Unique identifier for this patch",
            },
            extends: {
              oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              description: "Patch ID(s) to extend from",
            },
            include: {
              oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              description: "Glob pattern(s) to include specific files",
            },
            exclude: {
              oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              description: "Glob pattern(s) to exclude specific files",
            },
            onNoMatch: {
              type: "string",
              enum: ["skip", "warn", "error"],
              description: "Strategy for handling patches that don't match",
            },
            group: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]+$",
              description: "Group name for selective patch application",
            },
          },
        },
      },
      onNoMatch: {
        type: "string",
        enum: ["skip", "warn", "error"],
        description: "Default strategy for patches that don't match",
      },
      validators: {
        type: "array",
        description: "Global validators to run on all resources",
        items: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              description: "Unique name for this validator",
            },
            notContains: {
              type: "string",
              description: "Validate that content does not contain this string",
            },
            frontmatterRequired: {
              type: "array",
              items: { type: "string" },
              description: "Required frontmatter fields",
            },
          },
        },
      },
    },
  };
}
