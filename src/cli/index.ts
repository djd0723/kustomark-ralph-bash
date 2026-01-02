#!/usr/bin/env bun

/**
 * Kustomark CLI
 * Command-line interface for kustomark markdown patching
 */

import {
  type Dirent,
  existsSync,
  watch as fsWatch,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { mkdir as mkdirAsync, writeFile as writeFileAsync } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, join, normalize, relative, resolve } from "node:path";
import micromatch from "micromatch";
import {
  calculateFileHash,
  clearProjectCache,
  createEmptyCache,
  loadBuildCache,
  pruneCache,
  saveBuildCache,
  updateBuildCache,
} from "../core/build-cache.js";
import {
  parseConfig as coreParseConfig,
  validateConfig as coreValidateConfig,
} from "../core/config-parser.js";
import { generateFileDiff } from "../core/diff-generator.js";
import { loadLockFile, saveLockFile } from "../core/lock-file.js";
import { applyPatches as coreApplyPatches } from "../core/patch-engine.js";
import { resolveResources as coreResolveResources } from "../core/resource-resolver.js";
import { generateSchema } from "../core/schema.js";
import type {
  BuildCache,
  BuildCacheEntry,
  KustomarkConfig,
  LockFile,
  LockFileEntry,
  OnNoMatchStrategy,
  PatchOperation,
  ValidationError,
  ValidationResult,
} from "../core/types.js";
import { runValidators } from "../core/validators.js";
import { debugCommand } from "./debug-command.js";
import { initNonInteractive } from "./init-command.js";
import { initInteractive } from "./init-interactive.js";
import { areOverlappingPatches, areRedundantPatches } from "./lint-command.js";
import { webCommand } from "./web-command.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  clean: boolean;
  strict: boolean;
  verbosity: number; // 0=quiet, 1=normal, 2=-v, 3=-vv, 4=-vvv
  update: boolean;
  noLock: boolean;
  stats: boolean;
  file?: string; // For explain --file option
  base?: string; // For init --base option
  output?: string; // For init --output option
  debounce?: number; // For watch --debounce option (in milliseconds)
  enableGroups?: string[]; // For group filtering (whitelist)
  disableGroups?: string[]; // For group filtering (blacklist)
  parallel?: boolean; // For parallel processing (default: false)
  jobs?: number; // For parallel job count (default: CPU cores)
  incremental?: boolean; // Enable incremental builds (default: false)
  cleanCache?: boolean; // Clear cache before building (default: false)
  cacheDir?: string; // Custom cache directory
  interactive?: boolean; // For init -i/--interactive option
  dev?: boolean; // For web --dev option
  port?: number; // For web --port option
  host?: string; // For web --host option
  open?: boolean; // For web --open option
  autoApply?: boolean; // For debug --auto-apply option
  saveDecisions?: string; // For debug --save-decisions option
  loadDecisions?: string; // For debug --load-decisions option
}

interface BuildStats {
  duration: number; // Duration in milliseconds
  files: {
    processed: number;
    written: number;
    checked?: number; // For incremental builds
    rebuilt?: number; // For incremental builds
    unchanged?: number; // For incremental builds
  };
  patches: {
    applied: number;
    skipped: number;
  };
  bytes: number; // Total bytes written
  byOperation: Record<string, number>; // Count by operation type
  cache?: {
    // Cache statistics (only present in incremental builds)
    hits: number;
    misses: number;
    hitRate: number;
    speedup?: number; // Estimated speedup from caching
    invalidationReasons: Record<string, number>;
  };
}

interface BuildResult {
  success: boolean;
  filesWritten: number;
  patchesApplied: number;
  warnings: string[];
  validationErrors: ValidationError[];
  stats?: BuildStats; // Optional stats when --stats flag is used
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

interface ExplainResult {
  config: string;
  output: string;
  chain: Array<{
    config: string;
    resources: number;
    patches: number;
  }>;
  totalFiles: number;
  totalPatches: number;
}

interface ExplainFileResult {
  file: string;
  source?: string;
  patches: Array<{
    config: string;
    op: string;
    [key: string]: unknown;
  }>;
}

interface WatchEvent {
  event: "build";
  success: boolean;
  filesWritten?: number;
  error?: string;
  timestamp: string;
}

interface LintIssue {
  level: "error" | "warning" | "info";
  line?: number;
  message: string;
  patchIndex?: number;
}

interface LintResult {
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
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
    update: false,
    noLock: false,
    stats: false,
    file: undefined,
    base: undefined,
    output: undefined,
    debounce: undefined,
    enableGroups: undefined,
    disableGroups: undefined,
    parallel: false,
    jobs: undefined,
    incremental: false,
    cleanCache: false,
    cacheDir: undefined,
    interactive: false,
    dev: false,
    port: undefined,
    host: undefined,
    open: false,
    autoApply: false,
    saveDecisions: undefined,
    loadDecisions: undefined,
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
    } else if (arg === "--stats") {
      options.stats = true;
    } else if (arg === "--update") {
      options.update = true;
    } else if (arg === "--no-lock") {
      options.noLock = true;
    } else if (arg === "--file" || arg.startsWith("--file=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.file = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.file = nextArg;
          i++;
        }
      }
    } else if (arg === "--base" || arg.startsWith("--base=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.base = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.base = nextArg;
          i++;
        }
      }
    } else if (arg === "--output" || arg.startsWith("--output=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.output = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.output = nextArg;
          i++;
        }
      }
    } else if (arg === "-q") {
      options.verbosity = 0;
    } else if (arg === "--debounce" || arg.startsWith("--debounce=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.debounce = Number.parseInt(value, 10);
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.debounce = Number.parseInt(nextArg, 10);
          i++;
        }
      }
    } else if (arg === "--enable-groups" || arg.startsWith("--enable-groups=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) {
          options.enableGroups = value
            .split(",")
            .map((g) => g.trim())
            .filter((g) => g.length > 0);
        }
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          options.enableGroups = nextArg
            .split(",")
            .map((g) => g.trim())
            .filter((g) => g.length > 0);
          i++;
        }
      }
    } else if (arg === "--disable-groups" || arg.startsWith("--disable-groups=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) {
          options.disableGroups = value
            .split(",")
            .map((g) => g.trim())
            .filter((g) => g.length > 0);
        }
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          options.disableGroups = nextArg
            .split(",")
            .map((g) => g.trim())
            .filter((g) => g.length > 0);
          i++;
        }
      }
    } else if (arg === "-vvv") {
      options.verbosity = 4;
    } else if (arg === "-vv") {
      options.verbosity = 3;
    } else if (arg === "-v") {
      options.verbosity = 2;
    } else if (arg === "--parallel") {
      options.parallel = true;
    } else if (arg === "--jobs" || arg.startsWith("--jobs=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.jobs = Number.parseInt(value, 10);
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.jobs = Number.parseInt(nextArg, 10);
          i++;
        }
      }
    } else if (arg === "--incremental") {
      options.incremental = true;
    } else if (arg === "--clean-cache") {
      options.cleanCache = true;
    } else if (arg === "--cache-dir" || arg.startsWith("--cache-dir=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.cacheDir = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.cacheDir = nextArg;
          i++;
        }
      }
    } else if (arg === "-i" || arg === "--interactive") {
      options.interactive = true;
    } else if (arg === "--dev" || arg === "-d") {
      options.dev = true;
    } else if (arg === "--port" || arg.startsWith("--port=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.port = Number.parseInt(value, 10);
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.port = Number.parseInt(nextArg, 10);
          i++;
        }
      }
    } else if (arg === "--host" || arg.startsWith("--host=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.host = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.host = nextArg;
          i++;
        }
      }
    } else if (arg === "--open" || arg === "-o") {
      options.open = true;
    } else if (arg === "--auto-apply") {
      options.autoApply = true;
    } else if (arg === "--save-decisions" || arg.startsWith("--save-decisions=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.saveDecisions = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.saveDecisions = nextArg;
          i++;
        }
      }
    } else if (arg === "--load-decisions" || arg.startsWith("--load-decisions=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.loadDecisions = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.loadDecisions = nextArg;
          i++;
        }
      }
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
  lockFile?: LockFile | null,
  updateLock?: boolean,
  lockEntries?: LockFileEntry[],
): Promise<Map<string, string>> {
  // Build file map by scanning the file system
  const fileMap = buildCompleteFileMap(basePath);

  // Use core resource resolver
  const resolvedResources = await coreResolveResources(config.resources, basePath, fileMap, {
    lockFile: lockFile ?? undefined,
    updateLock,
    lockEntries,
  });

  // Convert from ResolvedResource[] to Map<string, string>
  const resultMap = new Map<string, string>();

  for (const resource of resolvedResources) {
    const normalizedPath = normalize(resource.path);

    // Compute relative path from the resource's base directory
    // If baseDir is provided, use it; otherwise fall back to basePath
    const baseDirectory = resource.baseDir || basePath;
    const relativePath = relative(baseDirectory, normalizedPath);

    resultMap.set(relativePath, resource.content);
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
  options: CLIOptions,
): {
  resources: Map<string, string>;
  patchesApplied: number;
  patchesSkipped: number;
  warnings: string[];
  validationErrors: ValidationError[];
  operationCounts: Record<string, number>;
} {
  const patchedResources = new Map<string, string>();
  let totalPatchesApplied = 0;
  let totalPatchesSkipped = 0;
  const allWarnings: string[] = [];
  const allValidationErrors: ValidationError[] = [];
  const operationCounts: Record<string, number> = {};

  // Apply patches to each file
  for (const [filePath, content] of resources.entries()) {
    // Filter patches by group first, then by file patterns
    const applicablePatches = patches.filter(
      (patch) => shouldApplyPatchGroup(patch, options) && shouldApplyPatch(patch, filePath),
    );

    if (applicablePatches.length === 0) {
      // No patches for this file, keep original content
      patchedResources.set(filePath, content);
      continue;
    }

    // Apply all applicable patches using the core patch engine
    const result = coreApplyPatches(content, applicablePatches, onNoMatch);
    patchedResources.set(filePath, result.content);
    totalPatchesApplied += result.applied;

    // Track skipped patches (patches that didn't match)
    const skipped = applicablePatches.length - result.applied;
    totalPatchesSkipped += skipped;

    // Count patches by operation type
    for (const patch of applicablePatches) {
      const opType = patch.op;
      operationCounts[opType] = (operationCounts[opType] || 0) + 1;
    }

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
    patchesSkipped: totalPatchesSkipped,
    warnings: allWarnings,
    validationErrors: allValidationErrors,
    operationCounts,
  };
}

/**
 * Concurrency limiter for parallel operations
 * Ensures only a limited number of operations run concurrently
 *
 * @param concurrency - Maximum number of concurrent operations
 * @returns A limiter function that wraps async operations
 */
function createConcurrencyLimiter(concurrency: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    while (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    activeCount++;
    try {
      return await fn();
    } finally {
      activeCount--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

/**
 * Apply patches to resources in parallel
 * Parallelizes at the file level while keeping patches sequential within each file
 *
 * @param resources - Map of file paths to content
 * @param patches - Array of patch operations
 * @param onNoMatch - Strategy for handling patches that don't match
 * @param options - CLI options including parallel settings
 * @returns Object with patched resources, stats, warnings, and errors
 */
async function applyPatchesParallel(
  resources: Map<string, string>,
  patches: PatchOperation[],
  onNoMatch: OnNoMatchStrategy,
  options: CLIOptions,
): Promise<{
  resources: Map<string, string>;
  patchesApplied: number;
  patchesSkipped: number;
  warnings: string[];
  validationErrors: ValidationError[];
  operationCounts: Record<string, number>;
}> {
  // Determine concurrency level
  const jobCount = options.jobs || cpus().length;
  const limit = createConcurrencyLimiter(jobCount);

  log(`Processing ${resources.size} files with ${jobCount} parallel jobs`, 2, options);

  // Sort file paths for deterministic processing order
  const sortedEntries = Array.from(resources.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Process files in parallel with concurrency limit
  const results = await Promise.all(
    sortedEntries.map(([filePath, content]) =>
      limit(async () => {
        // Filter patches by group first, then by file patterns
        const applicablePatches = patches.filter(
          (patch) => shouldApplyPatchGroup(patch, options) && shouldApplyPatch(patch, filePath),
        );

        if (applicablePatches.length === 0) {
          // No patches for this file, return original content
          return {
            filePath,
            content,
            applied: 0,
            skipped: 0,
            warnings: [] as string[],
            validationErrors: [] as ValidationError[],
            operations: {} as Record<string, number>,
          };
        }

        // Apply all applicable patches sequentially for this file
        const result = coreApplyPatches(content, applicablePatches, onNoMatch);

        // Calculate skipped patches
        const skipped = applicablePatches.length - result.applied;

        // Count patches by operation type
        const operations: Record<string, number> = {};
        for (const patch of applicablePatches) {
          const opType = patch.op;
          operations[opType] = (operations[opType] || 0) + 1;
        }

        // Add file path to validation errors
        const errorsWithFile = result.validationErrors.map((error) => ({
          ...error,
          file: filePath,
        }));

        return {
          filePath,
          content: result.content,
          applied: result.applied,
          skipped,
          warnings: result.warnings,
          validationErrors: errorsWithFile,
          operations,
        };
      }),
    ),
  );

  // Merge results
  const patchedResources = new Map<string, string>();
  let totalPatchesApplied = 0;
  let totalPatchesSkipped = 0;
  const allWarnings: string[] = [];
  const allValidationErrors: ValidationError[] = [];
  const operationCounts: Record<string, number> = {};

  for (const result of results) {
    patchedResources.set(result.filePath, result.content);
    totalPatchesApplied += result.applied;
    totalPatchesSkipped += result.skipped;
    allWarnings.push(...result.warnings);
    allValidationErrors.push(...result.validationErrors);

    // Merge operation counts
    for (const [op, count] of Object.entries(result.operations)) {
      operationCounts[op] = (operationCounts[op] || 0) + count;
    }
  }

  return {
    resources: patchedResources,
    patchesApplied: totalPatchesApplied,
    patchesSkipped: totalPatchesSkipped,
    warnings: allWarnings,
    validationErrors: allValidationErrors,
    operationCounts,
  };
}

/**
 * Write files asynchronously in parallel
 *
 * @param outputDir - Output directory path
 * @param resources - Map of file paths to content
 * @param concurrency - Maximum number of concurrent write operations
 * @returns Total bytes written
 */
async function writeFilesParallel(
  outputDir: string,
  resources: Map<string, string>,
  concurrency: number,
): Promise<number> {
  const limit = createConcurrencyLimiter(concurrency);
  let totalBytes = 0;

  // Sort file paths for deterministic order
  const sortedEntries = Array.from(resources.entries()).sort(([a], [b]) => a.localeCompare(b));

  await Promise.all(
    sortedEntries.map(([filePath, content]) =>
      limit(async () => {
        const outputPath = join(outputDir, filePath);

        // Ensure parent directory exists
        const dir = dirname(outputPath);
        try {
          await mkdirAsync(dir, { recursive: true });
        } catch (error) {
          // Directory might already exist from another parallel operation
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            throw error;
          }
        }

        // Write file
        await writeFileAsync(outputPath, content, "utf-8");

        // Track bytes written
        totalBytes += Buffer.byteLength(content, "utf-8");
      }),
    ),
  );

  return totalBytes;
}

/**
 * Check if a patch should be applied based on group filtering options
 *
 * Rules:
 * - Patches without a group are always enabled
 * - If enableGroups is specified: only those groups + ungrouped patches
 * - If disableGroups is specified: all except those groups
 * - If both specified: enableGroups takes precedence (whitelist mode)
 *
 * @param patch - The patch to check
 * @param options - CLI options containing group filters
 * @returns true if patch should be applied based on groups
 */
function shouldApplyPatchGroup(patch: PatchOperation, options: CLIOptions): boolean {
  const patchGroup = patch.group;

  // Patches without a group are always enabled
  if (!patchGroup) {
    return true;
  }

  const { enableGroups, disableGroups } = options;

  // If both are specified, enableGroups takes precedence
  if (enableGroups && enableGroups.length > 0) {
    return enableGroups.includes(patchGroup);
  }

  // If only disableGroups is specified
  if (disableGroups && disableGroups.length > 0) {
    return !disableGroups.includes(patchGroup);
  }

  // No group filtering specified, allow all
  return true;
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

    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read (permission denied, etc.)
      return;
    }

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
// Helper Functions for Explain Command
// ============================================================================

/**
 * Chain entry representing one config in the resolution chain
 */
interface ChainEntry {
  configPath: string;
  config: KustomarkConfig;
  resources: Map<string, string>;
}

/**
 * Builds the resolution chain by recursively loading base configs
 */
async function buildResolutionChain(
  configPath: string,
  basePath: string,
  fileMap: Map<string, string>,
  options: CLIOptions,
): Promise<ChainEntry[]> {
  const chain: ChainEntry[] = [];
  const visited = new Set<string>();

  async function loadConfig(currentPath: string, currentBase: string): Promise<void> {
    const normalizedPath = normalize(resolve(currentPath));

    // Detect cycles
    if (visited.has(normalizedPath)) {
      return;
    }
    visited.add(normalizedPath);

    log(`Loading config from ${normalizedPath}...`, 3, options);
    const config = readKustomarkConfig(currentPath);

    // First, recursively load base configs
    if (config.resources && config.resources.length > 0) {
      for (const resource of config.resources) {
        // Check if this is a directory reference (potential base config)
        if (isDirectoryReference(resource)) {
          const resolvedDir = resolvePathFromBase(resource, currentBase);
          const baseConfigPath = findKustomarkConfigHelper(resolvedDir, fileMap);

          if (baseConfigPath) {
            await loadConfig(baseConfigPath, dirname(baseConfigPath));
          }
        }
      }
    }

    // Resolve resources for this config level
    const lockFile = options.noLock ? null : loadLockFile(normalizedPath);
    const resources = await resolveResources(config, currentBase, lockFile, false);

    // Add this config to the chain
    chain.push({
      configPath: normalizedPath,
      config,
      resources,
    });
  }

  await loadConfig(configPath, basePath);
  return chain;
}

/**
 * Checks if a pattern is a directory reference
 */
function isDirectoryReference(pattern: string): boolean {
  // Skip glob patterns and URLs
  if (/[*?[\]{}!]/.test(pattern)) {
    return false;
  }
  if (
    pattern.startsWith("http://") ||
    pattern.startsWith("https://") ||
    pattern.startsWith("git::")
  ) {
    return false;
  }

  // If it ends with a file extension like .md, it's a file
  if (pattern.endsWith(".md") || /\.\w+$/.test(pattern)) {
    return false;
  }

  // Ends with / or starts with ./ or ../
  return pattern.endsWith("/") || pattern.startsWith("./") || pattern.startsWith("../");
}

/**
 * Resolves a path relative to a base directory (helper for explain)
 */
function resolvePathFromBase(path: string, baseDir: string): string {
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
  return normalize(resolve(baseDir, cleanPath));
}

/**
 * Finds kustomark.yaml or kustomark.yml in a directory (helper for explain)
 */
function findKustomarkConfigHelper(dir: string, fileMap: Map<string, string>): string | null {
  const yamlPath = join(dir, "kustomark.yaml");
  const ymlPath = join(dir, "kustomark.yml");

  if (fileMap.has(normalize(yamlPath))) {
    return normalize(yamlPath);
  }
  if (fileMap.has(normalize(ymlPath))) {
    return normalize(ymlPath);
  }

  return null;
}

// ============================================================================
// Commands
// ============================================================================

async function explainCommand(path: string, options: CLIOptions): Promise<number> {
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

    // Validate config (output is not required for explain)
    const validation = validateConfig(config, { requireOutput: false });
    if (!validation.valid) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              error: "Invalid configuration",
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

    // Build file map
    const fileMap = buildCompleteFileMap(basePath);

    // Build resolution chain
    log("Building resolution chain...", 2, options);
    const chain = await buildResolutionChain(configPath, basePath, fileMap, options);

    // If --file is specified, show lineage for that specific file
    if (options.file) {
      const targetFile = options.file;
      log(`Tracing lineage for ${targetFile}...`, 2, options);

      // Find which config introduced this file
      let sourceConfig: string | undefined;
      let found = false;

      for (const entry of chain) {
        if (entry.resources.has(targetFile)) {
          sourceConfig = entry.configPath;
          found = true;
          break;
        }
      }

      if (!found) {
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                error: `File not found in resolution chain: ${targetFile}`,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(`Error: File not found in resolution chain: ${targetFile}`);
        }
        return 1;
      }

      // Collect patches that apply to this file
      const applicablePatches: Array<{ config: string; op: string; [key: string]: unknown }> = [];

      for (const entry of chain) {
        if (entry.config.patches) {
          for (const patch of entry.config.patches) {
            if (shouldApplyPatch(patch, targetFile)) {
              applicablePatches.push({
                config: relative(basePath, entry.configPath),
                ...patch,
              });
            }
          }
        }
      }

      const result: ExplainFileResult = {
        file: targetFile,
        source: sourceConfig ? relative(basePath, sourceConfig) : undefined,
        patches: applicablePatches,
      };

      if (options.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`File: ${targetFile}`);
        console.log(`Source: ${result.source || "unknown"}`);
        console.log(`\nPatches (${result.patches.length}):`);
        for (const patch of result.patches) {
          const configName = patch.config;
          const op = patch.op;
          console.log(`  - [${configName}] ${op}`);

          // Show relevant patch details
          const patchDetails: Record<string, unknown> = { ...patch };
          patchDetails.config = undefined;

          const detailsStr = JSON.stringify(patchDetails, null, 4);
          console.log(`    ${detailsStr.split("\n").join("\n    ")}`);
        }
      }

      return 0;
    }

    // Show overall resolution chain
    const chainData = chain.map((entry) => ({
      config: relative(basePath, entry.configPath),
      resources: entry.resources.size,
      patches: entry.config.patches?.length || 0,
    }));

    // Calculate totals
    const allResources = new Map<string, string>();
    for (const entry of chain) {
      for (const [file, content] of entry.resources.entries()) {
        allResources.set(file, content);
      }
    }

    const totalPatches = chain.reduce((sum, entry) => sum + (entry.config.patches?.length || 0), 0);

    const result: ExplainResult = {
      config: relative(basePath, configPath),
      output: config.output || ".",
      chain: chainData,
      totalFiles: allResources.size,
      totalPatches,
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Config: ${result.config}`);
      console.log(`Output: ${result.output}`);
      console.log("\nResolution Chain:");
      for (const entry of result.chain) {
        console.log(`  - ${entry.config}`);
        console.log(`    Resources: ${entry.resources}`);
        console.log(`    Patches: ${entry.patches}`);
      }
      console.log(`\nTotal Files: ${result.totalFiles}`);
      console.log(`Total Patches: ${result.totalPatches}`);
    }

    return 0;
  } catch (error) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
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

    // Load lock file
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];
    let lockFileExisted = false;

    if (!options.noLock) {
      log("Loading lock file...", 3, options);
      lockFile = loadLockFile(configPath);
      lockFileExisted = lockFile !== null;

      if (!lockFileExisted && options.verbosity >= 2) {
        log("Lock file not found, will be created after build", 2, options);
      }
    }

    // Handle build cache for incremental builds
    let buildCache: BuildCache | null = null;
    const configContent = readFileSync(configPath, "utf-8");
    const configHash = calculateFileHash(configContent);
    const invalidationResults = new Map<string, { needsRebuild: boolean; reason?: string }>();
    let cacheCleared = false;

    if (options.incremental) {
      // Clear cache if requested
      if (options.cleanCache) {
        log("Clearing build cache...", 2, options);
        try {
          await clearProjectCache(configPath, options.cacheDir);
          cacheCleared = true;
          log("Build cache cleared", 2, options);
        } catch (error) {
          console.warn(
            `Warning: Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Load build cache
      if (!cacheCleared) {
        log("Loading build cache...", 3, options);
        try {
          buildCache = await loadBuildCache(configPath, options.cacheDir);
          if (buildCache) {
            log(`Loaded cache with ${buildCache.entries.length} entries`, 3, options);

            // Check if config changed
            if (buildCache.configHash !== configHash) {
              log("Config changed, invalidating cache", 2, options);
              buildCache = null;
            }
          } else {
            log("No cache found, performing full build", 2, options);
          }
        } catch (error) {
          console.warn(
            `Warning: Failed to load cache, falling back to full build: ${error instanceof Error ? error.message : String(error)}`,
          );
          buildCache = null;
        }
      }

      // Create empty cache if needed
      if (!buildCache) {
        buildCache = createEmptyCache(configHash);
      }
    }

    // Resolve resources
    log("Resolving resources...", 2, options);
    const resources = await resolveResources(
      config,
      basePath,
      lockFile,
      options.update,
      lockEntries,
    );

    // Track build start time for stats
    const startTime = options.stats ? performance.now() : 0;

    // Determine which files need rebuilding (incremental builds only)
    let filesToRebuild = new Set<string>(resources.keys());
    let filesUnchanged = 0;

    if (options.incremental && buildCache) {
      log("Checking for changed files...", 2, options);
      filesToRebuild = new Set();

      for (const [filePath, sourceContent] of resources.entries()) {
        // Determine which patches apply to this file
        const applicablePatches = (config.patches || []).filter(
          (patch) => shouldApplyPatchGroup(patch, options) && shouldApplyPatch(patch, filePath),
        );

        // Calculate hashes
        const sourceHash = calculateFileHash(sourceContent);
        const patchHash = calculateFileHash(
          JSON.stringify(applicablePatches, Object.keys(applicablePatches).sort()),
        );

        // Check cache
        const cacheEntry = buildCache.entries.find((e) => e.file === filePath);

        let needsRebuild = false;
        let reason: string | undefined;

        if (!cacheEntry) {
          needsRebuild = true;
          reason = "new-file";
        } else if (cacheEntry.sourceHash !== sourceHash) {
          needsRebuild = true;
          reason = "source-changed";
        } else if (cacheEntry.patchHash !== patchHash) {
          needsRebuild = true;
          reason = "patches-changed";
        }

        invalidationResults.set(filePath, { needsRebuild, reason });

        if (needsRebuild) {
          filesToRebuild.add(filePath);
          if (reason) {
            log(`  ${filePath}: ${reason}`, 3, options);
          }
        } else {
          filesUnchanged++;
        }
      }

      log(
        `Found ${filesToRebuild.size} file(s) to rebuild, ${filesUnchanged} unchanged`,
        2,
        options,
      );
    }

    // Apply patches (parallel or sequential)
    // For incremental builds, only apply patches to files that need rebuilding
    const resourcesToProcess = options.incremental
      ? new Map(Array.from(resources.entries()).filter(([path]) => filesToRebuild.has(path)))
      : resources;

    log(
      `Applying patches${options.incremental ? ` to ${resourcesToProcess.size} file(s)` : ""}...`,
      2,
      options,
    );
    const {
      resources: patchedResources,
      patchesApplied,
      patchesSkipped,
      warnings,
      validationErrors: patchValidationErrors,
      operationCounts,
    } = options.parallel
      ? await applyPatchesParallel(
          resourcesToProcess,
          config.patches || [],
          config.onNoMatch || "warn",
          options,
        )
      : applyPatches(resourcesToProcess, config.patches || [], config.onNoMatch || "warn", options);

    // For incremental builds, add unchanged files from cache
    const allPatchedResources = new Map(patchedResources);
    if (options.incremental && buildCache) {
      for (const [filePath, sourceContent] of resources.entries()) {
        if (!filesToRebuild.has(filePath)) {
          // Use cached output (which is the source content if no patches were applied)
          allPatchedResources.set(filePath, sourceContent);
        }
      }
    }

    // Collect all validation errors (from patches and global validators)
    const allValidationErrors: ValidationError[] = [...patchValidationErrors];

    // Run global validators on each patched file
    if (config.validators && config.validators.length > 0) {
      for (const [filePath, content] of allPatchedResources.entries()) {
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
    let totalBytes = 0;

    // For incremental builds, only write files that were rebuilt
    const filesToWrite = options.incremental
      ? new Map(
          Array.from(allPatchedResources.entries()).filter(([path]) => filesToRebuild.has(path)),
        )
      : allPatchedResources;

    if (options.parallel) {
      // Parallel file writing
      const jobCount = options.jobs || cpus().length;
      log(`Writing ${filesToWrite.size} files with ${jobCount} parallel jobs`, 2, options);

      totalBytes = await writeFilesParallel(outputDir, filesToWrite, jobCount);
      filesWritten = filesToWrite.size;

      // Track source files for cleaning
      for (const filePath of allPatchedResources.keys()) {
        sourceFiles.add(filePath);
      }

      if (options.verbosity >= 3) {
        for (const filePath of filesToWrite.keys()) {
          log(`  Wrote ${filePath}`, 3, options);
        }
      }
    } else {
      // Sequential file writing
      for (const [filePath, content] of filesToWrite.entries()) {
        const outputPath = join(outputDir, filePath);
        sourceFiles.add(filePath);

        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, content, "utf-8");
        filesWritten++;

        // Track bytes written for stats
        if (options.stats) {
          totalBytes += Buffer.byteLength(content, "utf-8");
        }

        log(`  Wrote ${filePath}`, 3, options);
      }

      // Track all source files for cleaning (even if not written)
      for (const filePath of allPatchedResources.keys()) {
        sourceFiles.add(filePath);
      }
    }

    // Clean if requested
    if (options.clean) {
      log("Cleaning output directory...", 2, options);
      const removed = cleanOutputDir(outputDir, sourceFiles);
      log(`  Removed ${removed} files`, 3, options);
    }

    // Save lock file if needed
    if (!options.noLock && (options.update || !lockFileExisted) && lockEntries.length > 0) {
      log("Saving lock file...", 2, options);
      const newLockFile: LockFile = {
        version: 1,
        resources: lockEntries,
      };
      saveLockFile(configPath, newLockFile);
      log("Lock file saved", 2, options);
    }

    // Update and save build cache
    if (options.incremental && buildCache) {
      log("Updating build cache...", 3, options);
      const newCacheEntries = new Map<string, BuildCacheEntry>();

      // Create cache entries for ALL resources, not just rebuilt files
      for (const [filePath, sourceContent] of resources.entries()) {
        // Check if this file was rebuilt
        const wasRebuilt = filesToRebuild.has(filePath);

        if (wasRebuilt) {
          // File was rebuilt - create new cache entry with output content
          const outputContent = allPatchedResources.get(filePath);
          if (!outputContent) continue;

          const applicablePatches = (config.patches || []).filter(
            (patch) => shouldApplyPatchGroup(patch, options) && shouldApplyPatch(patch, filePath),
          );

          const entry: BuildCacheEntry = {
            file: filePath,
            sourceHash: calculateFileHash(sourceContent),
            patchHash: calculateFileHash(
              JSON.stringify(applicablePatches, Object.keys(applicablePatches).sort()),
            ),
            outputHash: calculateFileHash(outputContent),
            built: new Date().toISOString(),
          };

          newCacheEntries.set(filePath, entry);
        } else {
          // File wasn't rebuilt - preserve existing cache entry if it exists
          const existingEntry = buildCache.entries.find((e) => e.file === filePath);
          if (existingEntry) {
            newCacheEntries.set(filePath, existingEntry);
          } else {
            // File wasn't rebuilt and has no cache entry - create one from current state
            const outputContent = allPatchedResources.get(filePath);
            if (!outputContent) continue;

            const applicablePatches = (config.patches || []).filter(
              (patch) => shouldApplyPatchGroup(patch, options) && shouldApplyPatch(patch, filePath),
            );

            const entry: BuildCacheEntry = {
              file: filePath,
              sourceHash: calculateFileHash(sourceContent),
              patchHash: calculateFileHash(
                JSON.stringify(applicablePatches, Object.keys(applicablePatches).sort()),
              ),
              outputHash: calculateFileHash(outputContent),
              built: new Date().toISOString(),
            };

            newCacheEntries.set(filePath, entry);
          }
        }
      }

      // Update cache with new entries
      buildCache = updateBuildCache(buildCache, newCacheEntries);

      // Prune deleted files from cache
      const currentFiles = new Set(resources.keys());
      buildCache = pruneCache(buildCache, currentFiles);

      // Save cache to disk (even if no files were rebuilt)
      try {
        await saveBuildCache(configPath, buildCache, options.cacheDir);
        log(`Cache saved with ${buildCache.entries.length} entries`, 3, options);
      } catch (error) {
        console.warn(
          `Warning: Failed to save cache: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Calculate stats if requested
    let stats: BuildStats | undefined;
    if (options.stats) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      stats = {
        duration,
        files: {
          processed: resources.size,
          written: filesWritten,
          ...(options.incremental && {
            checked: resources.size,
            rebuilt: filesToRebuild.size,
            unchanged: filesUnchanged,
          }),
        },
        patches: {
          applied: patchesApplied,
          skipped: patchesSkipped,
        },
        bytes: totalBytes,
        byOperation: operationCounts,
      };

      // Add cache statistics for incremental builds
      if (options.incremental) {
        const cacheHits = filesUnchanged;
        const cacheMisses = filesToRebuild.size;
        const total = cacheHits + cacheMisses;
        const hitRate = total > 0 ? cacheHits / total : 0;

        // Calculate invalidation reasons breakdown
        const invalidationReasons: Record<string, number> = {
          "new-file": 0,
          "source-changed": 0,
          "patches-changed": 0,
          "config-changed": 0,
          "missing-cache": 0,
          deleted: 0,
        };

        for (const result of invalidationResults.values()) {
          if (result.reason) {
            invalidationReasons[result.reason] = (invalidationReasons[result.reason] || 0) + 1;
          }
        }

        // Estimate speedup (very rough estimate)
        const speedup = cacheMisses > 0 ? total / cacheMisses : 1;

        stats.cache = {
          hits: cacheHits,
          misses: cacheMisses,
          hitRate,
          speedup,
          invalidationReasons,
        };
      }
    }

    // Output results
    const result: BuildResult = {
      success: true,
      filesWritten,
      patchesApplied,
      warnings,
      validationErrors: allValidationErrors,
      stats,
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

      // Output stats summary in text mode
      if (options.stats && stats) {
        console.log("\nBuild Statistics:");
        console.log(`  Duration: ${stats.duration}ms`);
        console.log(`  Files processed: ${stats.files.processed}`);
        console.log(`  Files written: ${stats.files.written}`);

        // Show incremental build stats
        if (options.incremental && stats.files.checked !== undefined) {
          console.log(`  Files checked: ${stats.files.checked}`);
          console.log(`  Files rebuilt: ${stats.files.rebuilt}`);
          console.log(`  Files unchanged: ${stats.files.unchanged}`);
        }

        console.log(`  Patches applied: ${stats.patches.applied}`);
        console.log(`  Patches skipped: ${stats.patches.skipped}`);
        console.log(`  Total bytes: ${stats.bytes}`);

        if (Object.keys(stats.byOperation).length > 0) {
          console.log("  By operation:");
          // Sort operation names for deterministic output
          const sortedOps = Object.entries(stats.byOperation).sort(([a], [b]) =>
            a.localeCompare(b),
          );
          for (const [op, count] of sortedOps) {
            console.log(`    ${op}: ${count}`);
          }
        }

        // Show cache statistics for incremental builds
        if (options.incremental && stats.cache) {
          console.log("\nCache Statistics:");
          console.log(`  Cache hits: ${stats.cache.hits}`);
          console.log(`  Cache misses: ${stats.cache.misses}`);
          console.log(`  Hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
          console.log(`  Estimated speedup: ${stats.cache.speedup?.toFixed(2) || "N/A"}x`);

          // Show invalidation reasons
          const reasons = Object.entries(stats.cache.invalidationReasons).filter(
            ([, count]) => count > 0,
          );
          if (reasons.length > 0) {
            console.log("  Invalidation reasons:");
            for (const [reason, count] of reasons) {
              console.log(`    ${reason}: ${count}`);
            }
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

    // Load lock file
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    if (!options.noLock) {
      log("Loading lock file...", 3, options);
      lockFile = loadLockFile(configPath);
    }

    // Resolve resources
    log("Resolving resources...", 2, options);
    const originalResources = await resolveResources(
      config,
      basePath,
      lockFile,
      options.update,
      lockEntries,
    );

    // Apply patches
    log("Applying patches...", 2, options);
    const { resources: patchedResources, validationErrors: patchValidationErrors } = applyPatches(
      originalResources,
      config.patches || [],
      config.onNoMatch || "warn",
      options,
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

async function initCommand(path: string, options: CLIOptions): Promise<number> {
  // Route to interactive or non-interactive implementation
  if (options.interactive) {
    return await initInteractive(path, options);
  }
  return await initNonInteractive(path, options);
}

function schemaCommand(_options: CLIOptions): number {
  try {
    // Generate and output the JSON Schema
    const schema = generateSchema();
    console.log(JSON.stringify(schema, null, 2));
    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function lintCommand(path: string, options: CLIOptions): Promise<number> {
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

    // Validate config first
    const validation = validateConfig(config, { requireOutput: false });
    if (!validation.valid) {
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              issues: validation.errors.map((e) => ({
                level: "error",
                message: `${e.field}: ${e.message}`,
              })),
              errorCount: validation.errors.length,
              warningCount: 0,
              infoCount: 0,
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

    // Load lock file
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    if (!options.noLock) {
      log("Loading lock file...", 3, options);
      lockFile = loadLockFile(configPath);
    }

    // Resolve resources
    log("Resolving resources...", 2, options);
    const resources = await resolveResources(
      config,
      basePath,
      lockFile,
      options.update,
      lockEntries,
    );

    log(`Resolved ${resources.size} resource(s)`, 3, options);

    // Run lint analysis
    const issues: LintIssue[] = [];

    if (config.patches && config.patches.length > 0) {
      // Track which patches match files
      const patchMatchCounts = new Map<number, number>();

      // Track patches for redundancy and overlap detection
      const patchDetails = new Map<
        number,
        {
          files: Set<string>;
          patch: PatchOperation;
        }
      >();

      // Analyze each patch
      for (let i = 0; i < config.patches.length; i++) {
        const patch = config.patches[i];
        if (!patch) continue;

        let matchCount = 0;
        const matchedFiles = new Set<string>();

        // Check which files this patch applies to
        for (const [filePath] of resources.entries()) {
          if (shouldApplyPatch(patch, filePath)) {
            matchCount++;
            matchedFiles.add(filePath);
          }
        }

        patchMatchCounts.set(i, matchCount);
        patchDetails.set(i, { files: matchedFiles, patch });

        // Check 1: Unreachable patches (patterns match nothing)
        if (matchCount === 0) {
          const hasInclude = patch.include !== undefined;
          const hasExclude = patch.exclude !== undefined;

          if (hasInclude || hasExclude) {
            // This patch has include/exclude patterns but matches nothing
            issues.push({
              level: "warning",
              patchIndex: i,
              message: `Patch #${i + 1} (${patch.op}) matches 0 files - check include/exclude patterns`,
            });
          }
        }
      }

      // Check 2: Redundant patches (same operation applied twice)
      for (let i = 0; i < config.patches.length; i++) {
        const patch1 = config.patches[i];
        if (!patch1) continue;

        for (let j = i + 1; j < config.patches.length; j++) {
          const patch2 = config.patches[j];
          if (!patch2) continue;

          // Check if patches are redundant
          if (areRedundantPatches(patch1, patch2)) {
            const details1 = patchDetails.get(i);
            const details2 = patchDetails.get(j);

            // Check if they apply to the same files
            if (details1 && details2) {
              const overlap = new Set([...details1.files].filter((f) => details2.files.has(f)));

              if (overlap.size > 0) {
                issues.push({
                  level: "warning",
                  patchIndex: j,
                  message: `Patch #${j + 1} (${patch2.op}) is redundant with patch #${i + 1} - same operation applied to ${overlap.size} file(s)`,
                });
              }
            }
          }
        }
      }

      // Check 3: Overlapping patches (multiple patches operating on same content)
      for (let i = 0; i < config.patches.length; i++) {
        const patch1 = config.patches[i];
        if (!patch1) continue;

        for (let j = i + 1; j < config.patches.length; j++) {
          const patch2 = config.patches[j];
          if (!patch2) continue;

          // Check if patches overlap (operate on the same target)
          if (areOverlappingPatches(patch1, patch2)) {
            const details1 = patchDetails.get(i);
            const details2 = patchDetails.get(j);

            // Check if they apply to the same files
            if (details1 && details2) {
              const overlap = new Set([...details1.files].filter((f) => details2.files.has(f)));

              if (overlap.size > 0) {
                issues.push({
                  level: "info",
                  patchIndex: j,
                  message: `Patch #${j + 1} (${patch2.op}) may overlap with patch #${i + 1} (${patch1.op}) on ${overlap.size} file(s) - review order and targets`,
                });
              }
            }
          }
        }
      }
    }

    // Count issues by level
    const errorCount = issues.filter((i) => i.level === "error").length;
    const warningCount = issues.filter((i) => i.level === "warning").length;
    const infoCount = issues.filter((i) => i.level === "info").length;

    // In strict mode, warnings become errors
    const effectiveErrorCount = options.strict ? errorCount + warningCount : errorCount;

    const result: LintResult = {
      issues,
      errorCount,
      warningCount,
      infoCount,
    };

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (issues.length === 0) {
        if (options.verbosity > 0) {
          console.log("No issues found");
        }
      } else {
        console.log(`Found ${issues.length} issue(s):\n`);

        for (const issue of issues) {
          const levelStr =
            options.strict && issue.level === "warning" ? "ERROR" : issue.level.toUpperCase();
          const patchInfo =
            issue.patchIndex !== undefined ? ` [patch #${issue.patchIndex + 1}]` : "";
          const lineInfo = issue.line !== undefined ? `:${issue.line}` : "";

          console.log(`${levelStr}${lineInfo}${patchInfo}: ${issue.message}`);
        }

        console.log("");
        console.log(
          `Summary: ${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info`,
        );

        if (options.strict && warningCount > 0) {
          console.log("(warnings treated as errors in strict mode)");
        }
      }
    }

    // Exit codes: 0=no errors, 1=has errors (warnings don't fail by default unless --strict)
    return effectiveErrorCount > 0 ? 1 : 0;
  } catch (error) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            issues: [
              {
                level: "error",
                message: error instanceof Error ? error.message : String(error),
              },
            ],
            errorCount: 1,
            warningCount: 0,
            infoCount: 0,
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

async function watchCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(configPath);

    // Default debounce to 300ms if not specified
    const debounceMs = options.debounce ?? 300;

    log(`Starting watch mode for ${configPath}`, 2, options);
    log(`Debounce: ${debounceMs}ms`, 3, options);

    // Perform initial build
    log("Performing initial build...", 2, options);
    await performWatchBuild(inputPath, options, basePath);

    // Set up file watching
    const watchedPaths = new Set<string>();
    const watchers: Array<ReturnType<typeof fsWatch>> = [];
    let debounceTimer: Timer | null = null;

    // Helper to add a path to watch
    const addWatch = (watchPath: string): void => {
      if (watchedPaths.has(watchPath)) {
        return;
      }

      try {
        const watcher = fsWatch(watchPath, { recursive: false }, (_eventType, _filename) => {
          // Debounce file changes
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            log("File change detected, rebuilding...", 2, options);
            performWatchBuild(inputPath, options, basePath).catch((error) => {
              log(
                `Error during rebuild: ${error instanceof Error ? error.message : String(error)}`,
                1,
                options,
              );
            });
          }, debounceMs);
        });

        watchers.push(watcher);
        watchedPaths.add(watchPath);
        log(`Watching: ${watchPath}`, 3, options);
      } catch (error) {
        log(
          `Failed to watch ${watchPath}: ${error instanceof Error ? error.message : String(error)}`,
          3,
          options,
        );
      }
    };

    // Watch the config file itself
    addWatch(configPath);

    // Discover and watch all resource files and referenced configs
    const discoverFilesToWatch = async (): Promise<void> => {
      try {
        const config = readKustomarkConfig(inputPath);
        const fileMap = buildCompleteFileMap(basePath);

        // Resolve resources to discover all files
        const lockFile = options.noLock ? null : loadLockFile(configPath);
        const resources = await resolveResources(config, basePath, lockFile, false);

        // Watch all resolved resource files
        for (const [filePath] of resources.entries()) {
          const absolutePath = resolve(basePath, filePath);
          const parentDir = dirname(absolutePath);

          // Watch the parent directory (to catch file changes, additions, deletions)
          addWatch(parentDir);
        }

        // Watch base configs if this is an overlay
        if (config.resources && config.resources.length > 0) {
          for (const resource of config.resources) {
            if (isDirectoryReference(resource)) {
              const resolvedDir = resolvePathFromBase(resource, basePath);
              const baseConfigPath = findKustomarkConfigHelper(resolvedDir, fileMap);

              if (baseConfigPath) {
                addWatch(baseConfigPath);
                addWatch(dirname(baseConfigPath));
              }
            }
          }
        }
      } catch (error) {
        log(
          `Failed to discover files to watch: ${error instanceof Error ? error.message : String(error)}`,
          2,
          options,
        );
      }
    };

    await discoverFilesToWatch();

    // Handle graceful shutdown
    let isShuttingDown = false;

    const cleanup = (): void => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;

      log("\nShutting down watch mode...", 2, options);

      // Clear debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Close all watchers
      for (const watcher of watchers) {
        watcher.close();
      }

      log("Watch mode stopped", 2, options);
      process.exit(0);
    };

    // Register signal handlers
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    log("Watching for changes... (press Ctrl+C to stop)", 1, options);

    // Keep the process running
    await new Promise(() => {
      // This promise never resolves, keeping the process alive
    });

    return 0;
  } catch (error) {
    if (options.format === "json") {
      const event: WatchEvent = {
        event: "build",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(event));
    } else {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return 1;
  }
}

/**
 * Perform a build for watch mode and output results according to format
 */
async function performWatchBuild(
  inputPath: string,
  options: CLIOptions,
  basePath: string,
): Promise<void> {
  try {
    log("Loading config...", 3, options);
    const config = readKustomarkConfig(inputPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: true });
    if (!validation.valid) {
      throw new Error(
        `Invalid configuration: ${validation.errors.map((e) => e.message).join(", ")}`,
      );
    }

    // Load lock file
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    if (!options.noLock) {
      log("Loading lock file...", 3, options);
      lockFile = loadLockFile(resolve(basePath, "kustomark.yaml"));
    }

    // Resolve resources
    log("Resolving resources...", 3, options);
    const resources = await resolveResources(
      config,
      basePath,
      lockFile,
      options.update,
      lockEntries,
    );

    // Apply patches
    log("Applying patches...", 3, options);
    const {
      resources: patchedResources,
      patchesApplied,
      warnings,
      validationErrors: patchValidationErrors,
    } = applyPatches(resources, config.patches || [], config.onNoMatch || "warn", options);

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

    // Check for validation errors
    if (allValidationErrors.length > 0) {
      const errorMessages = allValidationErrors
        .map((e) => `${e.file || "unknown"}: ${e.message}`)
        .join(", ");
      throw new Error(`Validation failed: ${errorMessages}`);
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

      log(`  Wrote ${filePath}`, 4, options);
    }

    // Clean if requested
    if (options.clean) {
      log("Cleaning output directory...", 3, options);
      const removed = cleanOutputDir(outputDir, sourceFiles);
      log(`  Removed ${removed} files`, 3, options);
    }

    // Output results
    if (options.format === "json") {
      const event: WatchEvent = {
        event: "build",
        success: true,
        filesWritten,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(event));
    } else {
      log(
        `Build complete: ${filesWritten} file(s) written, ${patchesApplied} patch(es) applied`,
        1,
        options,
      );
      if (warnings.length > 0) {
        log(`Warnings: ${warnings.join(", ")}`, 2, options);
      }
    }
  } catch (error) {
    if (options.format === "json") {
      const event: WatchEvent = {
        event: "build",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(event));
    } else {
      log(`Build failed: ${error instanceof Error ? error.message : String(error)}`, 1, options);
    }
    throw error;
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
  kustomark watch [path]      Watch and rebuild on file changes
  kustomark lint [path]       Check for common issues in config
  kustomark explain [path]    Show resolution chain and patch details
  kustomark schema            Export JSON Schema for editor integration
  kustomark init [path]       Create a new kustomark.yaml config
  kustomark web [path]        Launch web UI for visual editing
  kustomark debug [path]      Interactive patch debugging mode

Debug Mode Flags:
  --auto-apply                Auto-apply all patches without prompting
  --file <filename>           Debug only patches affecting specific file
  --save-decisions <path>     Save decisions to file for replay
  --load-decisions <path>     Load previous decisions from file
  --format <text|json>        Output format (default: text)

Explain Flags:
  --file <filename>           Show lineage for specific file
  --format <text|json>        Output format (default: text)

Watch Flags:
  --debounce <ms>             Debounce delay in milliseconds (default: 300)
  --format <text|json>        Output format (default: text)

Init Flags:
  -i, --interactive           Interactive wizard mode
  --base <path>               Create overlay referencing base config
  --output <path>             Set output directory in config

Web Flags:
  --dev, -d                   Run in development mode with hot reload
  --port <port>               Server port (default: 3000)
  --host <host>               Server host (default: localhost)
  --open, -o                  Open browser automatically

Flags:
  --format <text|json>        Output format (default: text)
  --clean                     Remove output files not in source
  --strict                    Enable strict validation (validate command)
  --stats                     Show build statistics (build command)
  -v, -vv, -vvv              Increase verbosity
  -q                         Quiet mode (errors only)

Performance:
  --parallel                  Enable parallel processing of files (build command)
  --jobs <N>                  Number of parallel jobs (default: CPU cores)
  --incremental               Enable incremental builds (only rebuild changed files)
  --clean-cache               Clear build cache before building
  --cache-dir <path>          Custom cache directory (default: ~/.cache/kustomark/builds)

  Parallel mode processes files concurrently while keeping patches
  sequential within each file. This can significantly speed up builds
  for projects with many files. Output order is deterministic.

  Incremental builds track file and patch changes to avoid rebuilding
  unchanged files. The build cache is stored in ~/.cache/kustommark/builds
  by default. Files are invalidated when source content, patches, or
  configuration changes. Use --clean-cache to force a full rebuild.
  Incremental builds work with --parallel for maximum performance.

Group Filtering:
  --enable-groups <groups>    Enable only specified groups (comma-separated)
  --disable-groups <groups>   Disable specified groups (comma-separated)

  Group filtering rules:
  - Patches without a group are always enabled
  - --enable-groups: whitelist mode (only listed groups + ungrouped)
  - --disable-groups: blacklist mode (all except listed groups)
  - If both specified, --enable-groups takes precedence

Lock File:
  --update                    Update kustomark.lock with latest refs
  --no-lock                   Ignore lock file (fetch latest versions)

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
    case "watch":
      return await watchCommand(path, options);
    case "lint":
      return await lintCommand(path, options);
    case "explain":
      return await explainCommand(path, options);
    case "schema":
      return schemaCommand(options);
    case "init":
      return await initCommand(path, options);
    case "web":
      return await webCommand(path, {
        dev: options.dev,
        port: options.port,
        host: options.host,
        open: options.open,
        verbose: options.verbosity >= 2,
      });
    case "debug":
      return await debugCommand(path, options);
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
