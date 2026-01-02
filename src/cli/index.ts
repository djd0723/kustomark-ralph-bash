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
import { dirname, join, normalize, relative, resolve } from "node:path";
import micromatch from "micromatch";
import {
  parseConfig as coreParseConfig,
  validateConfig as coreValidateConfig,
} from "../core/config-parser.js";
import { generateFileDiff } from "../core/diff-generator.js";
import { applyPatches as coreApplyPatches } from "../core/patch-engine.js";
import { resolveResources as coreResolveResources } from "../core/resource-resolver.js";
import type {
  KustomarkConfig,
  OnNoMatchStrategy,
  PatchOperation,
  ValidationError,
  ValidationResult,
} from "../core/types.js";
import { runValidators } from "../core/validators.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  clean: boolean;
  strict: boolean;
  verbosity: number; // 0=quiet, 1=normal, 2=-v, 3=-vv, 4=-vvv
}

interface BuildResult {
  success: boolean;
  filesWritten: number;
  patchesApplied: number;
  warnings: string[];
  validationErrors: ValidationError[];
}

interface DiffResult {
  hasChanges: boolean;
  files: Array<{
    path: string;
    status: "added" | "modified" | "deleted";
    diff?: string;
  }>;
  validationErrors: ValidationError[];
}

interface FetchResult {
  success: boolean;
  fetched: Array<{
    url: string;
    cached: boolean;
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
    strict: false,
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
    } else if (arg === "--strict") {
      options.strict = true;
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
// Core Library Integration
// ============================================================================

/**
 * Wrapper around core validateConfig that adds CLI-specific validation
 */
function validateConfig(
  config: KustomarkConfig,
  options: { requireOutput: boolean },
): ValidationResult {
  // Use core validation
  const result = coreValidateConfig(config);

  // Add CLI-specific validation for output field
  if (options.requireOutput && !config.output) {
    result.errors.push({
      field: "output",
      message: "output is required for build command",
    });
    result.valid = false;
  }

  return result;
}

/**
 * Resolve resources using the core resource resolver
 * This builds a fileMap and calls the core resolver
 */
async function resolveResources(
  config: KustomarkConfig,
  basePath: string,
): Promise<Map<string, string>> {
  // Build file map by scanning the file system
  const fileMap = buildCompleteFileMap(basePath);

  // Use core resource resolver
  const resolvedResources = await coreResolveResources(config.resources, basePath, fileMap);

  // Convert from ResolvedResource[] to Map<string, string>
  // For now, use just the basename of each file as the key
  // This matches kustomize behavior where resources are flattened into the output directory
  const resultMap = new Map<string, string>();

  for (const resource of resolvedResources) {
    const normalizedPath = normalize(resource.path);
    // Extract just the filename
    const parts = normalizedPath.split("/");
    const filename = parts[parts.length - 1] || normalizedPath;

    resultMap.set(filename, resource.content);
  }

  return resultMap;
}

/**
 * Apply patches to resources using the core patch engine
 */
function applyPatches(
  resources: Map<string, string>,
  patches: PatchOperation[],
  onNoMatch: OnNoMatchStrategy,
): {
  resources: Map<string, string>;
  patchesApplied: number;
  warnings: string[];
  validationErrors: ValidationError[];
} {
  const patchedResources = new Map<string, string>();
  let totalPatchesApplied = 0;
  const allWarnings: string[] = [];
  const allValidationErrors: ValidationError[] = [];

  // Apply patches to each file
  for (const [filePath, content] of resources.entries()) {
    // Filter patches that apply to this file
    const applicablePatches = patches.filter((patch) => shouldApplyPatch(patch, filePath));

    if (applicablePatches.length === 0) {
      // No patches for this file, keep original content
      patchedResources.set(filePath, content);
      continue;
    }

    // Apply all applicable patches using the core patch engine
    const result = coreApplyPatches(content, applicablePatches, onNoMatch);
    patchedResources.set(filePath, result.content);
    totalPatchesApplied += result.applied;
    allWarnings.push(...result.warnings);

    // Collect validation errors from per-patch validation
    for (const error of result.validationErrors) {
      allValidationErrors.push({
        ...error,
        file: filePath,
      });
    }
  }

  return {
    resources: patchedResources,
    patchesApplied: totalPatchesApplied,
    warnings: allWarnings,
    validationErrors: allValidationErrors,
  };
}

/**
 * Check if a patch should be applied to a file based on include/exclude patterns
 */
function shouldApplyPatch(patch: PatchOperation, filePath: string): boolean {
  // If include is specified, file must match at least one include pattern
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    const matches = micromatch.isMatch(filePath, includePatterns);
    if (!matches) {
      return false;
    }
  }

  // If exclude is specified, file must not match any exclude pattern
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    const matches = micromatch.isMatch(filePath, excludePatterns);
    if (matches) {
      return false;
    }
  }

  return true;
}

/**
 * Generate diff using the core diff generator
 */
function generateDiff(
  original: Map<string, string>,
  modified: Map<string, string>,
  _outputDir: string,
  _basePath: string,
): DiffResult {
  // Build list of files for diff generation
  const allPaths = new Set<string>();
  for (const path of original.keys()) {
    allPaths.add(path);
  }
  for (const path of modified.keys()) {
    allPaths.add(path);
  }

  const files: Array<{ path: string; original?: string; modified?: string }> = [];

  for (const path of allPaths) {
    files.push({
      path,
      original: original.get(path),
      modified: modified.get(path),
    });
  }

  // Use core diff generator
  const result = generateFileDiff(files);

  return {
    hasChanges: result.hasChanges,
    files: result.files,
    validationErrors: [],
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function log(message: string, level: number, options: CLIOptions): void {
  if (options.verbosity >= level) {
    console.error(message);
  }
}

/**
 * Build a complete file map by scanning the directory tree
 * This includes all .md files and kustomark config files
 *
 * To support references to parent/sibling directories (like ../base/),
 * we scan from the parent directory of basePath to capture all relevant files.
 */
function buildCompleteFileMap(basePath: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  const normalizedBasePath = normalize(resolve(basePath));

  // Start scanning from the parent directory to catch sibling references
  const scanRoot = dirname(normalizedBasePath);

  function scanDirectory(dir: string): void {
    if (!existsSync(dir)) {
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .git, and other common directories
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "output") {
          continue;
        }
        // Recursively scan subdirectories
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        // Include markdown files and kustomark config files
        if (
          entry.name.endsWith(".md") ||
          entry.name === "kustomark.yaml" ||
          entry.name === "kustomark.yml"
        ) {
          try {
            const content = readFileSync(fullPath, "utf-8");
            const normalizedPath = normalize(fullPath);
            fileMap.set(normalizedPath, content);
          } catch (error) {
            // Skip files we can't read
            console.warn(
              `Warning: Could not read file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }
  }

  scanDirectory(scanRoot);
  return fileMap;
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
  return coreParseConfig(content);
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
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(configPath);

    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(inputPath);

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
              validationErrors: [],
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
    const resources = await resolveResources(config, basePath);

    // Apply patches
    log("Applying patches...", 2, options);
    const {
      resources: patchedResources,
      patchesApplied,
      warnings,
      validationErrors: patchValidationErrors,
    } = applyPatches(resources, config.patches || [], config.onNoMatch || "warn");

    // Collect all validation errors (from patches and global validators)
    const allValidationErrors: ValidationError[] = [...patchValidationErrors];

    // Run global validators on each patched file
    if (config.validators && config.validators.length > 0) {
      for (const [filePath, content] of patchedResources.entries()) {
        const errors = runValidators(content, config.validators);
        for (const error of errors) {
          allValidationErrors.push({
            ...error,
            file: filePath,
          });
        }
      }
    }

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
      validationErrors: allValidationErrors,
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
        if (allValidationErrors.length > 0) {
          console.error("\nValidation Errors:");
          for (const error of allValidationErrors) {
            const location = error.file ? `${error.file}` : "";
            const validator = error.validator ? `[${error.validator}]` : "";
            const field = error.field ? `(${error.field})` : "";
            console.error(`  Error in ${location}${validator}${field}: ${error.message}`);
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
            validationErrors: [],
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
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(configPath);

    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(inputPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: false });
    if (!validation.valid) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              hasChanges: false,
              files: [],
              validationErrors: [],
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
    const originalResources = await resolveResources(config, basePath);

    // Apply patches
    log("Applying patches...", 2, options);
    const { resources: patchedResources, validationErrors: patchValidationErrors } = applyPatches(
      originalResources,
      config.patches || [],
      config.onNoMatch || "warn",
    );

    // Collect all validation errors (from patches and global validators)
    const allValidationErrors: ValidationError[] = [...patchValidationErrors];

    // Run global validators on each patched file
    if (config.validators && config.validators.length > 0) {
      for (const [filePath, content] of patchedResources.entries()) {
        const errors = runValidators(content, config.validators);
        for (const error of errors) {
          allValidationErrors.push({
            ...error,
            file: filePath,
          });
        }
      }
    }

    // Generate diff
    const outputDir = config.output ? resolve(basePath, config.output) : basePath;
    const diffResult = generateDiff(originalResources, patchedResources, outputDir, basePath);

    // Add validation errors to diff result
    diffResult.validationErrors = allValidationErrors;

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

      // Show validation errors after diff summary
      if (allValidationErrors.length > 0) {
        console.log("\nValidation Errors:");
        for (const error of allValidationErrors) {
          const location = error.file ? `${error.file}` : "unknown";
          const validator = error.validator ? ` [${error.validator}]` : "";
          const field = error.field ? ` (${error.field})` : "";
          console.log(`  Error in ${location}${validator}${field}: ${error.message}`);
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
            validationErrors: [],
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

    // In strict mode, treat warnings as errors
    const hasWarnings = validation.warnings.length > 0;
    const failsStrictMode = options.strict && hasWarnings;
    const isValid = validation.valid && !failsStrictMode;

    // Output results
    if (options.format === "json") {
      const jsonOutput = {
        ...validation,
        strict: options.strict,
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      if (validation.valid && !failsStrictMode) {
        if (options.verbosity > 0) {
          console.log("Configuration is valid");
        }
        if (validation.warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of validation.warnings) {
            console.log(`  ${warning}`);
          }
        }
      } else if (failsStrictMode) {
        console.error("Configuration validation failed (strict mode)\n");
        if (validation.errors.length > 0) {
          console.error("Errors:");
          for (const error of validation.errors) {
            console.error(`  ${error.field}: ${error.message}`);
          }
        }
        console.error(
          validation.errors.length > 0
            ? "\nWarnings (treated as errors in strict mode):"
            : "Warnings (treated as errors in strict mode):",
        );
        for (const warning of validation.warnings) {
          console.error(`  ${warning}`);
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

    return isValid ? 0 : 1;
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
            strict: options.strict,
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

// Future: Implement fetch command for M3 remote sources
// @ts-expect-error Reserved for future implementation
async function _fetchCommand(_path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(_path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(inputPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: false });
    if (!validation.valid) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              fetched: [],
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

    // For M3 implementation, we'll simulate fetching remote resources
    // In a real implementation, this would:
    // 1. Parse resource URLs for git://, https://, github.com shortcuts
    // 2. Download/clone remote resources
    // 3. Cache them in ~/.cache/kustomark/
    // 4. Return info about what was fetched

    // For now, we'll just list the resources that would be fetched
    const fetched: Array<{ url: string; cached: boolean }> = [];

    for (const resource of config.resources) {
      // Check if resource looks like a remote URL
      if (
        resource.startsWith("http://") ||
        resource.startsWith("https://") ||
        resource.startsWith("git::") ||
        resource.includes("github.com/") ||
        resource.includes("git@")
      ) {
        // This is a remote resource
        fetched.push({
          url: resource,
          cached: false, // In real implementation, check if it's in cache
        });
        log(`Would fetch: ${resource}`, 2, options);
      } else {
        // Local resource, skip
        log(`Skipping local resource: ${resource}`, 3, options);
      }
    }

    // Output results
    const result: FetchResult = {
      success: true,
      fetched,
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (fetched.length > 0) {
        if (options.verbosity > 0) {
          console.log(`Fetched ${fetched.length} remote resource(s):`);
          for (const item of fetched) {
            const cacheStatus = item.cached ? " (cached)" : "";
            console.log(`  ${item.url}${cacheStatus}`);
          }
        }
      } else {
        if (options.verbosity > 0) {
          console.log("No remote resources to fetch");
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
            fetched: [],
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
  --strict                    Enable strict validation (validate command)
  -v, -vv, -vvv              Increase verbosity
  -q                         Quiet mode (errors only)

Remote Resources:
  Git URLs are recognized and validated but fetching is not yet implemented.
  Supported formats: github.com/org/repo, git::https://..., git::git@...

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
