#!/usr/bin/env bun

/**
 * Kustomark CLI
 * Command-line interface for kustomark markdown patching
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import yaml from "js-yaml";
import type { KustomarkConfig, ValidationResult } from "../core/types";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  clean: boolean;
  verbosity: number; // 0=quiet, 1=normal, 2=-v, 3=-vv, 4=-vvv
}

interface BuildResult {
  success: boolean;
  filesWritten: number;
  patchesApplied: number;
  warnings: string[];
}

interface DiffResult {
  hasChanges: boolean;
  files: Array<{
    path: string;
    status: "added" | "modified" | "deleted";
    diff?: string;
  }>;
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(args: string[]): { command: string; path: string; options: CLIOptions } {
  let command = "";
  let path = ".";
  const options: CLIOptions = {
    format: "text",
    clean: false,
    verbosity: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (!command && !arg.startsWith("-")) {
      command = arg;
      continue;
    }

    if (command && !path.includes("-") && !arg.startsWith("-")) {
      path = arg;
      continue;
    }

    // Parse flags
    if (arg === "--format" || arg === "--format=text" || arg === "--format=json") {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.format = value as "text" | "json";
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.format = nextArg as "text" | "json";
          i++;
        }
      }
    } else if (arg === "--clean") {
      options.clean = true;
    } else if (arg === "-q") {
      options.verbosity = 0;
    } else if (arg === "-vvv") {
      options.verbosity = 4;
    } else if (arg === "-vv") {
      options.verbosity = 3;
    } else if (arg === "-v") {
      options.verbosity = 2;
    }
  }

  return { command, path, options };
}

// ============================================================================
// Core Library Stubs (to be implemented in separate files)
// ============================================================================

function parseConfig(yamlContent: string): KustomarkConfig {
  const config = yaml.load(yamlContent) as KustomarkConfig;
  return config;
}

function validateConfig(
  config: KustomarkConfig,
  options: { requireOutput: boolean },
): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: string[] = [];

  if (!config.apiVersion) {
    errors.push({ field: "apiVersion", message: "apiVersion is required" });
  } else if (config.apiVersion !== "kustomark/v1") {
    errors.push({
      field: "apiVersion",
      message: `apiVersion must be 'kustomark/v1', got '${config.apiVersion}'`,
    });
  }

  if (!config.kind) {
    errors.push({ field: "kind", message: "kind is required" });
  } else if (config.kind !== "Kustomization") {
    errors.push({ field: "kind", message: `kind must be 'Kustomization', got '${config.kind}'` });
  }

  if (options.requireOutput && !config.output) {
    errors.push({ field: "output", message: "output is required for build command" });
  }

  if (!config.resources || config.resources.length === 0) {
    errors.push({ field: "resources", message: "resources is required and must not be empty" });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function resolveResources(_config: KustomarkConfig, _basePath: string): Map<string, string> {
  // Placeholder: Returns a map of file paths to their content
  // In real implementation, this would:
  // 1. Resolve globs
  // 2. Load files
  // 3. Recursively load other kustomark configs
  const resources = new Map<string, string>();

  // For now, just return empty map
  // TODO: Implement actual resource resolution
  return resources;
}

function applyPatches(
  resources: Map<string, string>,
  _patches: Array<unknown>,
  _onNoMatch: string,
): { resources: Map<string, string>; patchesApplied: number; warnings: string[] } {
  // Placeholder: Apply patches to resources
  // In real implementation, this would apply all patch operations

  return {
    resources,
    patchesApplied: 0,
    warnings: [],
  };
}

function generateDiff(
  _original: Map<string, string>,
  _modified: Map<string, string>,
  _outputDir: string,
  _basePath: string,
): DiffResult {
  // Placeholder: Generate unified diff
  // In real implementation, this would:
  // 1. Compare original vs modified
  // 2. Generate unified diff format
  // 3. Detect additions/deletions

  const files: DiffResult["files"] = [];
  const hasChanges = files.length > 0;

  return { hasChanges, files };
}

// ============================================================================
// Utility Functions
// ============================================================================

function log(message: string, level: number, options: CLIOptions): void {
  if (options.verbosity >= level) {
    console.error(message);
  }
}

function readKustomarkConfig(configPath: string): KustomarkConfig {
  let configFile = configPath;

  // If path is a directory, look for kustomark.yaml inside it
  if (existsSync(configPath) && statSync(configPath).isDirectory()) {
    configFile = join(configPath, "kustomark.yaml");
  }

  if (!existsSync(configFile)) {
    throw new Error(`Config file not found: ${configFile}`);
  }

  const content = readFileSync(configFile, "utf-8");
  return parseConfig(content);
}

function cleanOutputDir(outputDir: string, sourceFiles: Set<string>): number {
  if (!existsSync(outputDir)) {
    return 0;
  }

  let removed = 0;
  const entries = readdirSync(outputDir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const fullPath = join(entry.parentPath ?? outputDir, entry.name);
      const relativePath = relative(outputDir, fullPath);

      if (!sourceFiles.has(relativePath)) {
        rmSync(fullPath);
        removed++;
      }
    }
  }

  return removed;
}

// ============================================================================
// Commands
// ============================================================================

async function buildCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const configPath = resolve(path);
    const basePath = dirname(configPath);

    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(configPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: true });
    if (!validation.valid) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              filesWritten: 0,
              patchesApplied: 0,
              warnings: [],
              errors: validation.errors,
            },
            null,
            2,
          ),
        );
      } else {
        console.error("Error: Invalid configuration");
        for (const error of validation.errors) {
          console.error(`  ${error.field}: ${error.message}`);
        }
      }
      return 1;
    }

    // Resolve resources
    log("Resolving resources...", 2, options);
    const resources = resolveResources(config, basePath);

    // Apply patches
    log("Applying patches...", 2, options);
    const {
      resources: patchedResources,
      patchesApplied,
      warnings,
    } = applyPatches(resources, config.patches || [], config.onNoMatch || "warn");

    // Write output files
    const outputDir = resolve(basePath, config.output ?? ".");
    mkdirSync(outputDir, { recursive: true });

    const sourceFiles = new Set<string>();
    let filesWritten = 0;

    for (const [filePath, content] of patchedResources.entries()) {
      const outputPath = join(outputDir, filePath);
      sourceFiles.add(filePath);

      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, content, "utf-8");
      filesWritten++;

      log(`  Wrote ${filePath}`, 3, options);
    }

    // Clean if requested
    if (options.clean) {
      log("Cleaning output directory...", 2, options);
      const removed = cleanOutputDir(outputDir, sourceFiles);
      log(`  Removed ${removed} files`, 3, options);
    }

    // Output results
    const result: BuildResult = {
      success: true,
      filesWritten,
      patchesApplied,
      warnings,
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (options.verbosity > 0) {
        console.log(`Built ${filesWritten} file(s) with ${patchesApplied} patch(es) applied`);
        if (warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of warnings) {
            console.log(`  ${warning}`);
          }
        }
      }
    }

    return 0;
  } catch (error) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            success: false,
            filesWritten: 0,
            patchesApplied: 0,
            warnings: [],
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

async function diffCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const configPath = resolve(path);
    const basePath = dirname(configPath);

    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(configPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: false });
    if (!validation.valid) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              hasChanges: false,
              files: [],
              errors: validation.errors,
            },
            null,
            2,
          ),
        );
      } else {
        console.error("Error: Invalid configuration");
        for (const error of validation.errors) {
          console.error(`  ${error.field}: ${error.message}`);
        }
      }
      return 1;
    }

    // Resolve resources
    log("Resolving resources...", 2, options);
    const originalResources = resolveResources(config, basePath);

    // Apply patches
    log("Applying patches...", 2, options);
    const { resources: patchedResources } = applyPatches(
      originalResources,
      config.patches || [],
      config.onNoMatch || "warn",
    );

    // Generate diff
    const outputDir = config.output ? resolve(basePath, config.output) : basePath;
    const diffResult = generateDiff(originalResources, patchedResources, outputDir, basePath);

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(diffResult, null, 2));
    } else {
      if (diffResult.hasChanges) {
        console.log(`${diffResult.files.length} file(s) would be changed:\n`);
        for (const file of diffResult.files) {
          console.log(`${file.status.toUpperCase()}: ${file.path}`);
          if (file.diff && options.verbosity >= 2) {
            console.log(file.diff);
            console.log("");
          }
        }
      } else {
        if (options.verbosity > 0) {
          console.log("No changes");
        }
      }
    }

    return diffResult.hasChanges ? 1 : 0;
  } catch (error) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            hasChanges: false,
            files: [],
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

async function validateCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const configPath = resolve(path);

    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(configPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: false });

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(validation, null, 2));
    } else {
      if (validation.valid) {
        if (options.verbosity > 0) {
          console.log("Configuration is valid");
        }
        if (validation.warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of validation.warnings) {
            console.log(`  ${warning}`);
          }
        }
      } else {
        console.error("Configuration is invalid\n");
        console.error("Errors:");
        for (const error of validation.errors) {
          console.error(`  ${error.field}: ${error.message}`);
        }
        if (validation.warnings.length > 0) {
          console.error("\nWarnings:");
          for (const warning of validation.warnings) {
            console.error(`  ${warning}`);
          }
        }
      }
    }

    return validation.valid ? 0 : 1;
  } catch (error) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            valid: false,
            errors: [
              {
                field: "config",
                message: error instanceof Error ? error.message : String(error),
              },
            ],
            warnings: [],
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
// Main Entry Point
// ============================================================================

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(
      `
Kustomark - Declarative markdown patching pipeline

Usage:
  kustomark build [path]      Build and write output
  kustomark diff [path]       Show what would change
  kustomark validate [path]   Validate configuration

Flags:
  --format <text|json>        Output format (default: text)
  --clean                     Remove output files not in source
  -v, -vv, -vvv              Increase verbosity
  -q                         Quiet mode (errors only)

Exit Codes:
  0    Success (for diff: no changes)
  1    Error or changes detected
    `.trim(),
    );
    return 0;
  }

  const { command, path, options } = parseArgs(args);

  switch (command) {
    case "build":
      return await buildCommand(path, options);
    case "diff":
      return await diffCommand(path, options);
    case "validate":
      return await validateCommand(path, options);
    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Run 'kustomark --help' for usage information`);
      return 1;
  }
}

// Run the CLI
main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
