/**
 * Non-interactive init command logic
 * Handles creation of kustomark.yaml configuration files
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as yaml from "js-yaml";
import type { KustomarkConfig } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

export interface InitResult {
  created: string | null;
  type: "base" | "overlay" | null;
  error?: string;
}

export interface CLIOptions {
  format: "text" | "json";
  verbosity: number;
  base?: string;
  output?: string;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Initialize a new kustomark configuration file (non-interactive)
 * @param path - Target directory path
 * @param options - CLI options
 * @returns Promise resolving to exit code (0=success, 1=error)
 */
export async function initNonInteractive(path: string, options: CLIOptions): Promise<number> {
  try {
    // Determine target directory - resolve path if provided, otherwise use cwd
    const targetDir = resolve(path);
    const configPath = join(targetDir, "kustomark.yaml");

    // Check if config file already exists
    if (existsSync(configPath)) {
      const error = `Config file already exists: ${configPath}`;
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              created: null,
              type: null,
              error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`Error: ${error}`);
      }
      return 1;
    }

    // Create directory if it doesn't exist
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Determine if this is a base or overlay config
    const isOverlay = options.base !== undefined;
    const type: "base" | "overlay" = isOverlay ? "overlay" : "base";

    // Build the config object
    const config = buildConfig(isOverlay, options);

    // Serialize to YAML
    const yamlContent = serializeConfig(config);

    // Write the config file
    writeFileSync(configPath, yamlContent, "utf-8");

    // Output results
    const result: InitResult = {
      created: configPath,
      type,
    };

    outputResult(result, options, isOverlay);

    return 0;
  } catch (error) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            created: null,
            type: null,
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return 1;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the configuration object based on type (base or overlay)
 * @param isOverlay - Whether this is an overlay configuration
 * @param options - CLI options
 * @returns KustomarkConfig object
 */
export function buildConfig(isOverlay: boolean, options: CLIOptions): KustomarkConfig {
  // Build the config object
  const config: KustomarkConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    resources: [],
    patches: [],
  };

  // Set resources based on type
  if (isOverlay && options.base) {
    // Overlay - reference the base directory
    config.resources = [options.base];
  } else {
    // Base - use glob pattern for local markdown files
    config.resources = ["*.md"];
  }

  // Set output if provided
  if (options.output) {
    config.output = options.output;
  }

  // Add example patches for overlay configs
  if (isOverlay) {
    config.patches = [
      {
        op: "replace",
        old: "example",
        new: "replacement",
      },
    ];
    config.onNoMatch = "warn";
  }

  return config;
}

/**
 * Serialize configuration to YAML format
 * @param config - Configuration object to serialize
 * @returns YAML string
 */
export function serializeConfig(config: KustomarkConfig): string {
  return yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * Output the initialization result based on format
 * @param result - Initialization result
 * @param options - CLI options
 * @param isOverlay - Whether this is an overlay configuration
 */
export function outputResult(result: InitResult, options: CLIOptions, isOverlay: boolean): void {
  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (options.verbosity > 0) {
      console.log(`Created ${result.type} config: ${result.created}`);
      if (isOverlay) {
        console.log(`  Referencing base: ${options.base}`);
      }
      if (options.output) {
        console.log(`  Output directory: ${options.output}`);
      }
    }
  }
}
