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
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import * as yaml from "js-yaml";
import micromatch from "micromatch";
import {
  calculateFileHash,
  clearProjectCache,
  createEmptyCache,
  haveGroupFiltersChanged,
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
import {
  applyCopyFile,
  applyDeleteFile,
  applyMoveFile,
  applyRenameFile,
} from "../core/file-operations.js";
import {
  clearGitCache,
  getDefaultCacheDir as getDefaultGitCacheDir,
  listGitCache,
} from "../core/git-fetcher.js";
import {
  clearHttpCache,
  getDefaultCacheDir as getDefaultHttpCacheDir,
  listHttpCache,
} from "../core/http-fetcher.js";
import { findLockEntry, loadLockFile, saveLockFile } from "../core/lock-file.js";
import { applyPatches as coreApplyPatches } from "../core/patch-engine.js";
import { resolveResources as coreResolveResources } from "../core/resource-resolver.js";
import { generateSchema } from "../core/schema.js";
import { runTestSuite } from "../core/test-runner.js";
import { parseTestSuite, validateTestSuite } from "../core/test-suite-parser.js";
import type {
  BuildCache,
  BuildCacheEntry,
  CopyFilePatch,
  DeleteFilePatch,
  KustomarkConfig,
  LockFile,
  LockFileEntry,
  MoveFilePatch,
  OnNoMatchStrategy,
  PatchOperation,
  RenameFilePatch,
  ResourceItem,
  ValidationError,
  ValidationResult,
  ValidationWarning,
  WatchHooks,
} from "../core/types.js";
import { runValidators } from "../core/validators.js";
import { debugCommand } from "./debug-command.js";
import { getCommandHelp, getMainHelp, isValidHelpCommand } from "./help.js";
import { initNonInteractive } from "./init-command.js";
import { initInteractive } from "./init-interactive.js";
import { areOverlappingPatches, areRedundantPatches } from "./lint-command.js";
import { createProgressReporter } from "./progress.js";
import { suggestCommand } from "./suggest-command.js";
import { templateApply, templateList, templateShow } from "./template-commands.js";
import { executeOnBuildHooks, executeOnChangeHooks, executeOnErrorHooks } from "./watch-hooks.js";
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
  noHooks?: boolean; // For watch --no-hooks option
  offline?: boolean; // For build --offline option (fail if remote fetch needed)
  dryRun?: boolean; // For build --dry-run option (preview changes without writing files)
  suite?: string; // For test --suite option (test suite file path)
  patch?: string; // For test --patch option (inline YAML patch)
  patchFile?: string; // For test --patch-file option (patch file path)
  input?: string; // For test --input option (input markdown file)
  content?: string; // For test --content option (inline markdown content)
  showSteps?: boolean; // For test --show-steps option (show intermediate results)
  source?: string; // For suggest --source option (source file or directory)
  target?: string; // For suggest --target option (target file or directory)
  var?: Record<string, string>; // For template apply --var key=value
  overwrite?: boolean; // For template apply --overwrite option
  category?: string; // For template list --category option
  progress?: boolean; // For --progress option (show progress feedback)
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
  warnings: ValidationWarning[];
  validationErrors: ValidationError[];
  stats?: BuildStats; // Optional stats when --stats flag is used
  dryRun?: boolean; // True if --dry-run flag was used
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
    offline: false,
    suite: undefined,
    patch: undefined,
    patchFile: undefined,
    input: undefined,
    content: undefined,
    showSteps: false,
    var: undefined,
    overwrite: false,
    category: undefined,
    progress: false,
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
    } else if (arg === "--progress") {
      options.progress = true;
    } else if (arg === "--update") {
      options.update = true;
    } else if (arg === "--no-lock") {
      options.noLock = true;
    } else if (arg === "--offline") {
      options.offline = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-hooks") {
      options.noHooks = true;
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
    } else if (arg === "--suite" || arg.startsWith("--suite=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.suite = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.suite = nextArg;
          i++;
        }
      }
    } else if (arg === "--patch" || arg.startsWith("--patch=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.patch = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.patch = nextArg;
          i++;
        }
      }
    } else if (arg === "--patch-file" || arg.startsWith("--patch-file=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.patchFile = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.patchFile = nextArg;
          i++;
        }
      }
    } else if (arg === "--input" || arg.startsWith("--input=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.input = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.input = nextArg;
          i++;
        }
      }
    } else if (arg === "--content" || arg.startsWith("--content=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.content = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.content = nextArg;
          i++;
        }
      }
    } else if (arg === "--show-steps") {
      options.showSteps = true;
    } else if (arg === "--overwrite") {
      options.overwrite = true;
    } else if (arg === "--category" || arg.startsWith("--category=")) {
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) options.category = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          options.category = nextArg;
          i++;
        }
      }
    } else if (arg === "--var" || arg.startsWith("--var=")) {
      let varPair = "";
      if (arg.includes("=")) {
        const value = arg.split("=")[1];
        if (value) varPair = value;
      } else if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          varPair = nextArg;
          i++;
        }
      }
      // Parse KEY=VALUE
      if (varPair) {
        const eqIndex = varPair.indexOf("=");
        if (eqIndex > 0) {
          const key = varPair.substring(0, eqIndex);
          const value = varPair.substring(eqIndex + 1);
          if (!options.var) options.var = {};
          options.var[key] = value;
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
 * Find all kustomark config files referenced in the resources
 * Returns absolute paths to all base config files
 */
function findReferencedConfigs(resources: ResourceItem[], basePath: string): string[] {
  const configPaths: string[] = [];

  for (const resource of resources) {
    // Extract URL from ResourceItem
    const resourceUrl = getResourceUrl(resource);
    // Check if resource is a directory reference (ends with / or contains ../)
    if (resourceUrl.endsWith("/") || resourceUrl.includes("../")) {
      const resolvedDir = isAbsolute(resourceUrl) ? resourceUrl : resolve(basePath, resourceUrl);

      // Look for kustomark.yaml or kustomark.yml
      const yamlPath = join(resolvedDir, "kustomark.yaml");
      const ymlPath = join(resolvedDir, "kustomark.yml");

      if (existsSync(yamlPath)) {
        configPaths.push(normalize(yamlPath));
      } else if (existsSync(ymlPath)) {
        configPaths.push(normalize(ymlPath));
      }
    }
  }

  return configPaths;
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
  offline?: boolean,
): Promise<Map<string, string>> {
  // Build file map by scanning the file system
  const fileMap = buildCompleteFileMap(basePath);

  // Use core resource resolver
  const resolvedResources = await coreResolveResources(config.resources, basePath, fileMap, {
    lockFile: lockFile ?? undefined,
    updateLock,
    lockEntries,
    gitFetchOptions: {
      offline,
    },
    httpFetchOptions: {
      offline,
    },
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
 * Partition patches into file operations and content operations
 */
function partitionPatches(patches: PatchOperation[]): {
  fileOps: (CopyFilePatch | RenameFilePatch | DeleteFilePatch | MoveFilePatch)[];
  contentOps: PatchOperation[];
} {
  const fileOps: (CopyFilePatch | RenameFilePatch | DeleteFilePatch | MoveFilePatch)[] = [];
  const contentOps: PatchOperation[] = [];

  for (const patch of patches) {
    if (
      patch.op === "copy-file" ||
      patch.op === "rename-file" ||
      patch.op === "delete-file" ||
      patch.op === "move-file"
    ) {
      fileOps.push(patch);
    } else {
      contentOps.push(patch);
    }
  }

  return { fileOps, contentOps };
}

/**
 * Apply file operations to the file map
 *
 * File operations modify the file map structure (add/rename/delete/move files)
 * before content patches are applied.
 */
function applyFileOperations(
  fileMap: Map<string, string>,
  fileOps: (CopyFilePatch | RenameFilePatch | DeleteFilePatch | MoveFilePatch)[],
  basePath: string,
  options: CLIOptions,
): {
  fileMap: Map<string, string>;
  operationsApplied: number;
  operationCounts: Record<string, number>;
} {
  let currentMap = fileMap;
  let totalOperations = 0;
  const operationCounts: Record<string, number> = {};

  for (const patch of fileOps) {
    // Check if this patch should be applied based on group filters
    if (!shouldApplyPatchGroup(patch, options)) {
      continue;
    }

    let result: { fileMap: Map<string, string>; count: number } | null = null;

    try {
      switch (patch.op) {
        case "copy-file":
          log(`  Applying copy-file: ${patch.src} -> ${patch.dest}`, 3, options);
          result = applyCopyFile(currentMap, patch.src, patch.dest, basePath);
          break;

        case "rename-file":
          log(`  Applying rename-file: match=${patch.match}, rename=${patch.rename}`, 3, options);
          result = applyRenameFile(currentMap, patch.match, patch.rename, basePath);
          break;

        case "delete-file":
          log(`  Applying delete-file: match=${patch.match}`, 3, options);
          result = applyDeleteFile(currentMap, patch.match, basePath);
          break;

        case "move-file":
          log(`  Applying move-file: match=${patch.match}, dest=${patch.dest}`, 3, options);
          result = applyMoveFile(currentMap, patch.match, patch.dest, basePath);
          break;
      }

      if (result) {
        currentMap = result.fileMap;
        totalOperations += result.count;

        // Track operation counts
        operationCounts[patch.op] = (operationCounts[patch.op] || 0) + result.count;

        log(`    Affected ${result.count} file(s)`, 3, options);
      }
    } catch (error) {
      console.error(
        `Error applying file operation ${patch.op}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    fileMap: currentMap,
    operationsApplied: totalOperations,
    operationCounts,
  };
}

/**
 * Apply patches to resources using the core patch engine
 */
function applyPatches(
  resources: Map<string, string>,
  patches: PatchOperation[],
  onNoMatch: OnNoMatchStrategy,
  options: CLIOptions,
  progressReporter?: ReturnType<typeof createProgressReporter>,
): {
  resources: Map<string, string>;
  patchesApplied: number;
  patchesSkipped: number;
  warnings: ValidationWarning[];
  validationErrors: ValidationError[];
  operationCounts: Record<string, number>;
} {
  const patchedResources = new Map<string, string>();
  let totalPatchesApplied = 0;
  let totalPatchesSkipped = 0;
  const allWarnings: ValidationWarning[] = [];
  const allValidationErrors: ValidationError[] = [];
  const operationCounts: Record<string, number> = {};

  // Initialize progress if provided
  if (progressReporter) {
    progressReporter.start(resources.size, "Applying patches...");
  }

  let fileIndex = 0;

  // Apply patches to each file
  for (const [filePath, content] of resources.entries()) {
    fileIndex++;

    // Update progress
    if (progressReporter) {
      progressReporter.setCurrent(
        fileIndex,
        `Processing file ${fileIndex}/${resources.size}: ${filePath}`,
      );
    }

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
    const verbose = options.verbosity >= 2;
    const result = coreApplyPatches(content, applicablePatches, onNoMatch, verbose);
    patchedResources.set(filePath, result.content);
    totalPatchesApplied += result.applied;

    // Track skipped patches (patches that didn't match + condition-skipped patches)
    const skipped = applicablePatches.length - result.applied - result.conditionSkipped;
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

  // Finish progress
  if (progressReporter) {
    progressReporter.finish(`Patches applied to ${resources.size} files`);
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
  progressReporter?: ReturnType<typeof createProgressReporter>,
): Promise<{
  resources: Map<string, string>;
  patchesApplied: number;
  patchesSkipped: number;
  warnings: ValidationWarning[];
  validationErrors: ValidationError[];
  operationCounts: Record<string, number>;
}> {
  // Determine concurrency level
  const jobCount = options.jobs || cpus().length;
  const limit = createConcurrencyLimiter(jobCount);

  log(`Processing ${resources.size} files with ${jobCount} parallel jobs`, 2, options);

  // Initialize progress if provided
  if (progressReporter) {
    progressReporter.start(resources.size, "Applying patches...");
  }

  let completedFiles = 0;

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
          completedFiles++;
          if (progressReporter) {
            progressReporter.setCurrent(
              completedFiles,
              `Processing file ${completedFiles}/${resources.size}: ${filePath}`,
            );
          }

          return {
            filePath,
            content,
            applied: 0,
            skipped: 0,
            warnings: [] as ValidationWarning[],
            validationErrors: [] as ValidationError[],
            operations: {} as Record<string, number>,
          };
        }

        // Apply all applicable patches sequentially for this file
        const verbose = options.verbosity >= 2;
        const result = coreApplyPatches(content, applicablePatches, onNoMatch, verbose);

        // Calculate skipped patches (patches that didn't match + condition-skipped patches)
        const skipped = applicablePatches.length - result.applied - result.conditionSkipped;

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

        completedFiles++;
        if (progressReporter) {
          progressReporter.setCurrent(
            completedFiles,
            `Processing file ${completedFiles}/${resources.size}: ${filePath}`,
          );
        }

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
  const allWarnings: ValidationWarning[] = [];
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

  // Finish progress
  if (progressReporter) {
    progressReporter.finish(`Patches applied to ${resources.size} files`);
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
  progressReporter?: ReturnType<typeof createProgressReporter>,
): Promise<number> {
  const limit = createConcurrencyLimiter(concurrency);
  let totalBytes = 0;
  let filesWritten = 0;

  // Initialize progress if provided
  if (progressReporter) {
    progressReporter.start(resources.size, "Writing files...");
  }

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

        // Update progress
        filesWritten++;
        if (progressReporter) {
          progressReporter.setCurrent(
            filesWritten,
            `Writing file ${filesWritten}/${resources.size}: ${filePath}`,
          );
        }
      }),
    ),
  );

  // Finish progress
  if (progressReporter) {
    progressReporter.finish(`Wrote ${resources.size} files`);
  }

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
        const resourceUrl = getResourceUrl(resource);
        if (isDirectoryReference(resourceUrl)) {
          const resolvedDir = resolvePathFromBase(resourceUrl, currentBase);
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
 * Extracts URL string from a ResourceItem (handles both string and ResourceObject)
 */
function getResourceUrl(resource: ResourceItem): string {
  return typeof resource === "string" ? resource : resource.url;
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

    // Find all referenced configs (base configs in overlays)
    const referencedConfigPaths = findReferencedConfigs(config.resources, basePath);
    const allConfigHashes: Record<string, string> = {};

    // Hash all referenced configs
    for (const refConfigPath of referencedConfigPaths) {
      try {
        const refConfigContent = readFileSync(refConfigPath, "utf-8");
        allConfigHashes[refConfigPath] = calculateFileHash(refConfigContent);
      } catch (error) {
        // If we can't read a referenced config, skip it (will be caught later)
        console.warn(`Warning: Could not read referenced config at ${refConfigPath}`);
      }
    }

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
            log(`Loaded cache with ${buildCache.entries.size} entries`, 3, options);

            // Check if config changed
            if (buildCache.configHash !== configHash) {
              log("Config changed, invalidating cache", 2, options);
              buildCache = null;
            }

            // Check if group filters changed
            if (
              buildCache &&
              haveGroupFiltersChanged(
                options.enableGroups ? new Set(options.enableGroups) : undefined,
                options.disableGroups ? new Set(options.disableGroups) : undefined,
                buildCache,
              )
            ) {
              log("Group filters changed, invalidating cache", 2, options);
              buildCache = null;
            }

            // Check if any base config changed
            if (buildCache && referencedConfigPaths.length > 0) {
              for (const refConfigPath of referencedConfigPaths) {
                const cachedHash = buildCache.configHashes?.[refConfigPath];
                const currentHash = allConfigHashes[refConfigPath];

                if (!cachedHash || cachedHash !== currentHash) {
                  log("Config changed, invalidating cache", 2, options);
                  buildCache = null;
                  break;
                }
              }
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
        buildCache = createEmptyCache(
          configHash,
          referencedConfigPaths.length > 0 ? allConfigHashes : undefined,
          options.enableGroups,
          options.disableGroups,
        );
      }
    }

    // Create progress reporter
    const progress = createProgressReporter(options);

    // Resolve resources
    log("Resolving resources...", 2, options);
    progress.start(1, "Fetching remote resources...");
    const resources = await resolveResources(
      config,
      basePath,
      lockFile,
      options.update,
      lockEntries,
      options.offline,
    );
    progress.finish("Resources resolved");

    // Track build start time for stats
    const startTime = options.stats ? performance.now() : 0;

    // Partition patches into file operations and content operations
    const { fileOps, contentOps } = partitionPatches(config.patches || []);

    // Apply file operations first (if any)
    let processedResources = resources;
    let fileOpsApplied = 0;
    const fileOpCounts: Record<string, number> = {};

    if (fileOps.length > 0) {
      log(`Applying ${fileOps.length} file operation(s)...`, 2, options);
      const fileOpResult = applyFileOperations(resources, fileOps, basePath, options);
      processedResources = fileOpResult.fileMap;
      fileOpsApplied = fileOpResult.operationsApplied;
      Object.assign(fileOpCounts, fileOpResult.operationCounts);
      log(`  Applied ${fileOpsApplied} file operation(s)`, 2, options);
    }

    // Determine which files need rebuilding (incremental builds only)
    let filesToRebuild = new Set<string>(processedResources.keys());
    let filesUnchanged = 0;

    if (options.incremental && buildCache) {
      log("Checking for changed files...", 2, options);
      filesToRebuild = new Set();

      for (const [filePath, sourceContent] of processedResources.entries()) {
        // Determine which patches apply to this file (only content operations)
        const applicablePatches = contentOps.filter(
          (patch) => shouldApplyPatchGroup(patch, options) && shouldApplyPatch(patch, filePath),
        );

        // Calculate hashes
        const sourceHash = calculateFileHash(sourceContent);
        const patchHash = calculateFileHash(
          JSON.stringify(applicablePatches, Object.keys(applicablePatches).sort()),
        );

        // Check cache
        const cacheEntry = buildCache.entries.get(filePath);

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

    // Apply content patches (parallel or sequential)
    // For incremental builds, only apply patches to files that need rebuilding
    const resourcesToProcess = options.incremental
      ? new Map(
          Array.from(processedResources.entries()).filter(([path]) => filesToRebuild.has(path)),
        )
      : processedResources;

    log(
      `Applying content patches${options.incremental ? ` to ${resourcesToProcess.size} file(s)` : ""}...`,
      2,
      options,
    );
    const {
      resources: patchedResources,
      patchesApplied,
      patchesSkipped,
      warnings,
      validationErrors: patchValidationErrors,
      operationCounts: contentOpCounts,
    } = options.parallel
      ? await applyPatchesParallel(
          resourcesToProcess,
          contentOps,
          config.onNoMatch || "warn",
          options,
          progress,
        )
      : applyPatches(resourcesToProcess, contentOps, config.onNoMatch || "warn", options, progress);

    // Merge file operation counts with content operation counts
    const operationCounts = { ...fileOpCounts, ...contentOpCounts };

    // For incremental builds, add unchanged files from cache
    const allPatchedResources = new Map(patchedResources);
    if (options.incremental && buildCache) {
      for (const [filePath, sourceContent] of processedResources.entries()) {
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
    if (!options.dryRun) {
      mkdirSync(outputDir, { recursive: true });
    }

    const sourceFiles = new Set<string>();
    let filesWritten = 0;
    let totalBytes = 0;

    // For incremental builds, only write files that were rebuilt
    const filesToWrite = options.incremental
      ? new Map(
          Array.from(allPatchedResources.entries()).filter(([path]) => filesToRebuild.has(path)),
        )
      : allPatchedResources;

    if (options.dryRun) {
      // Dry-run mode: skip file writes, just track what would be written
      log(`Dry-run mode: would write ${filesToWrite.size} files`, 2, options);

      for (const [filePath, content] of filesToWrite.entries()) {
        sourceFiles.add(filePath);
        filesWritten++;

        // Track bytes for stats
        if (options.stats) {
          totalBytes += Buffer.byteLength(content, "utf-8");
        }

        log(`  Would write ${filePath}`, 3, options);
      }

      // Track all source files for cleaning (even if not written)
      for (const filePath of allPatchedResources.keys()) {
        sourceFiles.add(filePath);
      }
    } else if (options.parallel) {
      // Parallel file writing
      const jobCount = options.jobs || cpus().length;
      log(`Writing ${filesToWrite.size} files with ${jobCount} parallel jobs`, 2, options);

      totalBytes = await writeFilesParallel(outputDir, filesToWrite, jobCount, progress);
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
      progress.start(filesToWrite.size, "Writing files...");

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

        // Update progress
        progress.setCurrent(
          filesWritten,
          `Writing file ${filesWritten}/${filesToWrite.size}: ${filePath}`,
        );

        log(`  Wrote ${filePath}`, 3, options);
      }

      progress.finish(`Wrote ${filesToWrite.size} files`);

      // Track all source files for cleaning (even if not written)
      for (const filePath of allPatchedResources.keys()) {
        sourceFiles.add(filePath);
      }
    }

    // Clean if requested (skip in dry-run mode)
    if (options.clean && !options.dryRun) {
      log("Cleaning output directory...", 2, options);
      const removed = cleanOutputDir(outputDir, sourceFiles);
      log(`  Removed ${removed} files`, 3, options);
    } else if (options.clean && options.dryRun) {
      log("Dry-run mode: would clean output directory", 2, options);
    }

    // Save lock file if needed (skip in dry-run mode)
    if (
      !options.dryRun &&
      !options.noLock &&
      (options.update || !lockFileExisted) &&
      lockEntries.length > 0
    ) {
      log("Saving lock file...", 2, options);
      const newLockFile: LockFile = {
        version: 1,
        resources: lockEntries,
      };
      saveLockFile(configPath, newLockFile);
      log("Lock file saved", 2, options);
    } else if (
      options.dryRun &&
      !options.noLock &&
      (options.update || !lockFileExisted) &&
      lockEntries.length > 0
    ) {
      log("Dry-run mode: would save lock file", 2, options);
    }

    // Update and save build cache
    if (options.incremental && buildCache) {
      log("Updating build cache...", 3, options);
      const newCacheEntries = new Map<string, BuildCacheEntry>();

      // Create cache entries for ALL resources, not just rebuilt files
      for (const [filePath, sourceContent] of processedResources.entries()) {
        // Check if this file was rebuilt
        const wasRebuilt = filesToRebuild.has(filePath);

        if (wasRebuilt) {
          // File was rebuilt - create new cache entry with output content
          const outputContent = allPatchedResources.get(filePath);
          if (!outputContent) continue;

          // Only use content operations for cache hashing
          const applicablePatches = contentOps.filter(
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
          const existingEntry = buildCache.entries.get(filePath);
          if (existingEntry) {
            newCacheEntries.set(filePath, existingEntry);
          } else {
            // File wasn't rebuilt and has no cache entry - create one from current state
            const outputContent = allPatchedResources.get(filePath);
            if (!outputContent) continue;

            // Only use content operations for cache hashing
            const applicablePatches = contentOps.filter(
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

      // Save cache to disk (even if no files were rebuilt) - skip in dry-run mode
      if (!options.dryRun) {
        try {
          await saveBuildCache(configPath, buildCache, options.cacheDir);
          log(`Cache saved with ${buildCache.entries.size} entries`, 3, options);
        } catch (error) {
          console.warn(
            `Warning: Failed to save cache: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        log("Dry-run mode: would save build cache", 3, options);
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
      ...(options.dryRun && { dryRun: true }),
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (options.verbosity > 0) {
        const action = options.dryRun ? "Would build" : "Built";
        console.log(`${action} ${filesWritten} file(s) with ${patchesApplied} patch(es) applied`);
        if (warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of warnings) {
            console.log(`  ${warning.message}`);
            if (warning.suggestions && warning.suggestions.length > 0) {
              for (const suggestion of warning.suggestions) {
                console.log(`    - ${suggestion}`);
              }
            }
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

async function testCommand(_path: string, options: CLIOptions): Promise<number> {
  try {
    // ANSI color codes for colored output
    const colors = {
      reset: "\x1b[0m",
      green: "\x1b[32m",
      red: "\x1b[31m",
      yellow: "\x1b[33m",
      cyan: "\x1b[36m",
      dim: "\x1b[2m",
      bold: "\x1b[1m",
    };

    // Validate input: must have either --suite, --patch, or --patch-file
    if (!options.suite && !options.patch && !options.patchFile) {
      const errorMsg = "Error: Must specify one of --suite, --patch, or --patch-file";
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              total: 0,
              passed: 0,
              failed: 0,
              results: [],
              error: errorMsg,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(errorMsg);
        console.error("\nUsage:");
        console.error("  kustomark test --suite <file>");
        console.error("  kustomark test --patch <yaml> --input <file>");
        console.error("  kustomark test --patch-file <file> --input <file>");
      }
      return 1;
    }

    // Mode 1: Test suite file
    if (options.suite) {
      const suitePath = resolve(options.suite);

      if (!existsSync(suitePath)) {
        const errorMsg = `Test suite file not found: ${suitePath}`;
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                error: errorMsg,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(`Error: ${errorMsg}`);
        }
        return 1;
      }

      log(`Loading test suite from ${suitePath}...`, 2, options);
      const suiteContent = readFileSync(suitePath, "utf-8");

      // Parse and validate the test suite
      const suite = parseTestSuite(suiteContent);
      const validation = validateTestSuite(suite);

      if (!validation.valid) {
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                validationErrors: validation.errors,
              },
              null,
              2,
            ),
          );
        } else {
          console.error("Test suite validation failed:\n");
          for (const error of validation.errors) {
            console.error(`  ${error.field}: ${error.message}`);
          }
        }
        return 1;
      }

      log(`Running ${suite.tests.length} test(s)...`, 2, options);

      // Run the test suite
      const result = runTestSuite(suite);

      // Output results
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: result.failed === 0,
              total: result.total,
              passed: result.passed,
              failed: result.failed,
              results: result.results.map((r) => ({
                name: r.name,
                passed: r.passed,
                actual: r.actual,
                expected: r.expected,
                diff: r.diff,
                error: r.error,
                appliedPatches: r.appliedPatches,
                warnings: r.warnings,
                validationErrors: r.validationErrors,
              })),
            },
            null,
            2,
          ),
        );
      } else {
        // Text format with colorized output
        console.log(`\n${colors.bold}Test Results${colors.reset}`);
        console.log("=".repeat(60));

        for (const testResult of result.results) {
          const statusIcon = testResult.passed
            ? `${colors.green}✓${colors.reset}`
            : `${colors.red}✗${colors.reset}`;
          console.log(`\n${statusIcon} ${testResult.name}`);

          if (!testResult.passed) {
            if (testResult.error) {
              console.log(`  ${colors.red}Error: ${testResult.error}${colors.reset}`);
            } else if (testResult.diff) {
              console.log(`\n  ${colors.yellow}Diff:${colors.reset}`);
              // Print diff with indentation
              const diffLines = testResult.diff.split("\n");
              for (const line of diffLines) {
                if (line.startsWith("+")) {
                  console.log(`  ${colors.green}${line}${colors.reset}`);
                } else if (line.startsWith("-")) {
                  console.log(`  ${colors.red}${line}${colors.reset}`);
                } else {
                  console.log(`  ${colors.dim}${line}${colors.reset}`);
                }
              }
            }
          }

          // Show warnings if any
          if (testResult.warnings.length > 0 && options.verbosity >= 2) {
            console.log(`  ${colors.yellow}Warnings:${colors.reset}`);
            for (const warning of testResult.warnings) {
              console.log(`    ${warning}`);
            }
          }

          // Show validation errors if any
          if (testResult.validationErrors.length > 0) {
            console.log(`  ${colors.red}Validation Errors:${colors.reset}`);
            for (const error of testResult.validationErrors) {
              console.log(`    ${error.field}: ${error.message}`);
            }
          }
        }

        // Summary
        console.log(`\n${"=".repeat(60)}`);
        const passColor = result.passed === result.total ? colors.green : colors.yellow;
        const failColor = result.failed > 0 ? colors.red : colors.dim;
        console.log(
          `${colors.bold}Summary:${colors.reset} ${passColor}${result.passed} passed${colors.reset}, ${failColor}${result.failed} failed${colors.reset}, ${result.total} total`,
        );
      }

      // Exit with appropriate code
      if (options.strict && result.failed > 0) {
        return 1;
      }
      return result.failed > 0 ? 1 : 0;
    }

    // Mode 2 & 3: Single patch test (inline or from file)
    // Must have either --input or --content
    if (!options.input && !options.content) {
      const errorMsg = "Error: Must specify either --input or --content for patch testing";
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              total: 0,
              passed: 0,
              failed: 0,
              results: [],
              error: errorMsg,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(errorMsg);
      }
      return 1;
    }

    // Get input content
    let inputContent: string;
    if (options.input) {
      const inputPath = resolve(options.input);
      if (!existsSync(inputPath)) {
        const errorMsg = `Input file not found: ${inputPath}`;
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                error: errorMsg,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(`Error: ${errorMsg}`);
        }
        return 1;
      }
      inputContent = readFileSync(inputPath, "utf-8");
    } else {
      inputContent = options.content || "";
    }

    // Get patches
    let patches: PatchOperation[];
    if (options.patch) {
      // Parse inline YAML patch
      try {
        const parsed = yaml.load(options.patch);
        patches = Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        const errorMsg = `Failed to parse patch YAML: ${error instanceof Error ? error.message : String(error)}`;
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                error: errorMsg,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(`Error: ${errorMsg}`);
        }
        return 1;
      }
    } else if (options.patchFile) {
      const patchFilePath = resolve(options.patchFile);
      if (!existsSync(patchFilePath)) {
        const errorMsg = `Patch file not found: ${patchFilePath}`;
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                error: errorMsg,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(`Error: ${errorMsg}`);
        }
        return 1;
      }

      const patchContent = readFileSync(patchFilePath, "utf-8");
      try {
        const parsed = yaml.load(patchContent);
        patches = Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        const errorMsg = `Failed to parse patch file: ${error instanceof Error ? error.message : String(error)}`;
        if (options.format === "json") {
          console.log(
            JSON.stringify(
              {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                error: errorMsg,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(`Error: ${errorMsg}`);
        }
        return 1;
      }
    } else {
      // This should never happen due to earlier validation
      patches = [];
    }

    // Apply patches
    log(`Applying ${patches.length} patch(es)...`, 2, options);

    try {
      const patchResult = coreApplyPatches(inputContent, patches, "warn");

      // Show results
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: true,
              applied: patchResult.applied,
              skipped: patchResult.conditionSkipped,
              output: patchResult.content,
              warnings: patchResult.warnings,
              validationErrors: patchResult.validationErrors,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`\n${colors.bold}Patch Application Results${colors.reset}`);
        console.log("=".repeat(60));
        console.log(`${colors.green}Applied: ${patchResult.applied}${colors.reset}`);
        console.log(`${colors.yellow}Skipped: ${patchResult.conditionSkipped}${colors.reset}`);

        if (patchResult.warnings.length > 0) {
          console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
          for (const warning of patchResult.warnings) {
            console.log(`  ${warning}`);
          }
        }

        if (patchResult.validationErrors.length > 0) {
          console.log(`\n${colors.red}Validation Errors:${colors.reset}`);
          for (const error of patchResult.validationErrors) {
            console.log(`  ${error.field}: ${error.message}`);
          }
        }

        console.log(`\n${colors.bold}Output:${colors.reset}`);
        console.log(patchResult.content);
      }

      return 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              applied: 0,
              skipped: 0,
              output: "",
              error: errorMsg,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`Error: ${errorMsg}`);
      }
      return 1;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            success: false,
            total: 0,
            passed: 0,
            failed: 0,
            results: [],
            error: errorMsg,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`Error: ${errorMsg}`);
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
    const config = readKustomarkConfig(inputPath);
    await performWatchBuild(inputPath, options, basePath, config.watch);

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
        const watcher = fsWatch(watchPath, { recursive: false }, (_eventType, filename) => {
          // Debounce file changes
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(async () => {
            log("File change detected, rebuilding...", 2, options);

            // Load config to get watch hooks
            const config = readKustomarkConfig(inputPath);

            // Execute onChange hooks
            if (config.watch && filename) {
              await executeOnChangeHooks(config.watch, filename, {
                verbosity: options.verbosity,
                disabled: options.noHooks ?? false,
              });
            }

            performWatchBuild(inputPath, options, basePath, config.watch).catch((error) => {
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
            const resourceUrl = getResourceUrl(resource);
            if (isDirectoryReference(resourceUrl)) {
              const resolvedDir = resolvePathFromBase(resourceUrl, basePath);
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
  watchHooks?: WatchHooks,
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

    // Execute onBuild hooks after successful build
    if (watchHooks) {
      await executeOnBuildHooks(watchHooks, filesWritten, {
        verbosity: options.verbosity,
        disabled: options.noHooks ?? false,
      });
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
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Execute onError hooks
    if (watchHooks) {
      await executeOnErrorHooks(watchHooks, errorMessage, {
        verbosity: options.verbosity,
        disabled: options.noHooks ?? false,
      });
    }

    if (options.format === "json") {
      const event: WatchEvent = {
        event: "build",
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(event));
    } else {
      log(`Build failed: ${errorMessage}`, 1, options);
    }
    throw error;
  }
}

/**
 * Fetch command - fetch remote resources only (no build)
 */
async function fetchCommand(path: string, options: CLIOptions): Promise<number> {
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

    // Load lock file if not disabled
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    if (!options.noLock) {
      log("Loading lock file...", 3, options);
      lockFile = loadLockFile(configPath);

      if (!lockFile && options.verbosity >= 2) {
        log("Lock file not found, will be created after fetch", 2, options);
      }
    }

    // Track which resources are remote and will be fetched
    const remoteResources: string[] = [];
    const fetchedInfo: Array<{ url: string; cached: boolean }> = [];

    // Identify remote resources
    for (const resource of config.resources) {
      const resourceUrl = getResourceUrl(resource);
      if (
        resourceUrl.startsWith("git::") ||
        resourceUrl.startsWith("http://") ||
        resourceUrl.startsWith("https://") ||
        resourceUrl.match(/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\//) || // github.com/org/repo style
        resourceUrl.startsWith("git@")
      ) {
        remoteResources.push(resourceUrl);
      }
    }

    if (remoteResources.length === 0) {
      const result: FetchResult = {
        success: true,
        fetched: [],
      };

      if (options.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (options.verbosity > 0) {
          console.log("No remote resources to fetch");
        }
      }
      return 0;
    }

    // Build file map and resolve resources (this will trigger fetching)
    log("Resolving resources...", 2, options);
    const fileMap = buildCompleteFileMap(basePath);

    // Before resolving, check cache status for each remote resource
    // This is a heuristic - we check if resources exist in lock file before resolving
    const cacheStatusBefore = new Map<string, boolean>();
    for (const resource of remoteResources) {
      // Check if resource is in lock file (indicates it was previously fetched)
      const lockEntry = lockFile ? findLockEntry(lockFile, resource) : null;
      cacheStatusBefore.set(resource, lockEntry !== null);
    }

    await coreResolveResources(config.resources, basePath, fileMap, {
      lockFile: lockFile ?? undefined,
      updateLock: options.update,
      lockEntries,
    });

    // After resolution, determine cached status based on whether lock entries were created
    for (const resource of remoteResources) {
      const wasCached = cacheStatusBefore.get(resource) ?? false;

      // If we're not updating and it was in the lock file, it was cached
      // If we're updating or it wasn't in lock file, it was fetched fresh
      const cached = !options.update && wasCached;

      fetchedInfo.push({
        url: resource,
        cached,
      });

      const status = cached ? "(cached)" : "(fetched)";
      log(`${resource} ${status}`, 2, options);
    }

    // Save lock file if update flag is set
    if (options.update && lockEntries.length > 0) {
      log("Updating lock file...", 2, options);
      const newLockFile: LockFile = {
        version: 1,
        resources: lockEntries,
      };
      saveLockFile(configPath, newLockFile);
      log("Lock file updated", 2, options);
    }

    // Output results
    const result: FetchResult = {
      success: true,
      fetched: fetchedInfo,
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (options.verbosity > 0) {
        console.log(`Fetched ${fetchedInfo.length} remote resource(s):`);
        for (const item of fetchedInfo) {
          const cacheStatus = item.cached ? " (cached)" : "";
          console.log(`  ${item.url}${cacheStatus}`);
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
// Cache Command
// ============================================================================

interface CacheListItem {
  type: "git" | "http";
  key: string;
}

interface CacheListResult {
  success: boolean;
  cached: CacheListItem[];
  error?: string;
}

interface CacheClearResult {
  success: boolean;
  cleared: number;
  error?: string;
}

/**
 * Cache command - list or clear cached resources
 */
async function cacheCommand(args: string[], options: CLIOptions): Promise<number> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "list") {
    // List all cached resources
    try {
      const gitCached = await listGitCache();
      const httpCached = await listHttpCache();

      const cached: CacheListItem[] = [
        ...gitCached.map((key) => ({ type: "git" as const, key })),
        ...httpCached.map((key) => ({ type: "http" as const, key })),
      ];

      if (options.format === "json") {
        const result: CacheListResult = {
          success: true,
          cached,
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (cached.length === 0) {
          console.log("No cached resources");
        } else {
          console.log(`Cached resources (${cached.length}):`);
          console.log();

          if (gitCached.length > 0) {
            console.log("Git repositories:");
            for (const key of gitCached) {
              console.log(`  ${key}`);
            }
            console.log();
          }

          if (httpCached.length > 0) {
            console.log("HTTP archives:");
            for (const key of httpCached) {
              console.log(`  ${key}`);
            }
          }
        }
      }

      return 0;
    } catch (error) {
      if (options.format === "json") {
        const result: CacheListResult = {
          success: false,
          cached: [],
          error: error instanceof Error ? error.message : String(error),
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(
          `Error listing cache: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return 1;
    }
  } else if (subcommand === "clear") {
    // Clear cache (optionally with pattern)
    const pattern = args[1]; // Optional pattern for selective clearing

    try {
      const gitCleared = await clearGitCache(getDefaultGitCacheDir(), pattern);
      const httpCleared = await clearHttpCache(getDefaultHttpCacheDir(), pattern);
      const totalCleared = gitCleared + httpCleared;

      if (options.format === "json") {
        const result: CacheClearResult = {
          success: true,
          cleared: totalCleared,
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (pattern) {
          console.log(`Cleared ${totalCleared} cache entries matching pattern: ${pattern}`);
        } else {
          console.log(`Cleared ${totalCleared} cache entries`);
        }
      }

      return 0;
    } catch (error) {
      if (options.format === "json") {
        const result: CacheClearResult = {
          success: false,
          cleared: 0,
          error: error instanceof Error ? error.message : String(error),
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(
          `Error clearing cache: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return 1;
    }
  } else {
    console.error(`Unknown cache subcommand: ${subcommand}`);
    console.error("Usage:");
    console.error("  kustomark cache list              List all cached resources");
    console.error("  kustomark cache clear             Clear all caches");
    console.error("  kustomark cache clear <pattern>   Clear specific resources matching pattern");
    console.error("");
    console.error("All commands support --format=json");
    return 1;
  }
}

// ============================================================================
// Exports (for testing)
// ============================================================================

export {
  buildCommand,
  diffCommand,
  fetchCommand,
  validateCommand,
  watchCommand,
  lintCommand,
  explainCommand,
  initCommand,
  cacheCommand,
};

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  // Handle help command
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    if (args[0] === "help" && args.length > 1) {
      // kustomark help <command>
      const commandName = args[1];
      if (commandName && isValidHelpCommand(commandName)) {
        console.log(getCommandHelp(commandName));
      } else {
        console.error(`Unknown command: ${commandName || "(none)"}`);
        console.log("\nAvailable commands:");
        console.log(getMainHelp());
      }
    } else {
      // kustomark --help or kustomark help
      console.log(getMainHelp());
    }
    return 0;
  }

  const { command, path, options } = parseArgs(args);

  // Check if --help or -h is in args for specific command help
  if (args.includes("--help") || args.includes("-h")) {
    if (command && isValidHelpCommand(command)) {
      console.log(getCommandHelp(command));
      return 0;
    }
  }

  switch (command) {
    case "build":
      return await buildCommand(path, options);
    case "diff":
      return await diffCommand(path, options);
    case "fetch":
      return await fetchCommand(path, options);
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
    case "test":
      return await testCommand(path, options);
    case "suggest":
      return await suggestCommand(options);
    case "template": {
      // Handle template subcommands
      // Extract positional args (non-flags) from args
      const positionalArgs = args.slice(1).filter((arg) => !arg.startsWith("-"));
      const subcommand = positionalArgs[0]; // First positional arg after 'template'
      const templateOptions = {
        format: options.format,
        verbosity: options.verbosity,
        category: options.category,
        var: options.var,
        dryRun: options.dryRun,
        overwrite: options.overwrite,
      };

      switch (subcommand) {
        case "list":
        case undefined: // Default to list
          return await templateList(templateOptions);
        case "show": {
          const templateName = positionalArgs[1];
          if (!templateName) {
            console.error("Error: Template name is required");
            console.error("Usage: kustomark template show <template-name>");
            return 1;
          }
          return await templateShow(templateName, templateOptions);
        }
        case "apply": {
          const templateName = positionalArgs[1];
          if (!templateName) {
            console.error("Error: Template name is required");
            console.error("Usage: kustomark template apply <template-name> [output-dir]");
            return 1;
          }
          // Output directory can be positionalArgs[2] or options.output or current directory
          const outputDir = positionalArgs[2] || options.output || ".";
          return await templateApply(templateName, outputDir, templateOptions);
        }
        default:
          console.error(`Unknown template subcommand: ${subcommand}`);
          console.error("Valid subcommands: list, show, apply");
          console.error("Run 'kustomark help template' for usage information");
          return 1;
      }
    }
    case "cache":
      return await cacheCommand(args.slice(1), options);
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
