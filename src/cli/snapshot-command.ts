/**
 * Snapshot command implementation
 * Provides snapshot testing capabilities for kustomark builds
 *
 * Features:
 * - Create snapshots of build output with file hashes
 * - Verify build output against saved snapshots
 * - Update existing snapshots
 * - Show diffs for modified files
 * - JSON and text output formats
 *
 * Usage:
 * - Create: kustomark snapshot ./path/to/config
 * - Verify: kustomark snapshot --verify ./path/to/config
 * - Update: kustomark snapshot --update ./path/to/config
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as yaml from "js-yaml";
import { calculateFileHash } from "../core/build-cache.js";
import { parseConfig, validateConfig } from "../core/config-parser.js";
import { generateFileDiff } from "../core/diff-generator.js";
import { loadLockFile } from "../core/lock-file.js";
import { applyPatches } from "../core/patch-engine.js";
import { resolveResources } from "../core/resource-resolver.js";
import type { KustomarkConfig, LockFile, LockFileEntry } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  verbosity: number; // 0=quiet, 1=normal, 2=-v, 3=-vv, 4=-vvv
  verify?: boolean;
  update?: boolean;
}

interface FileSnapshot {
  path: string;
  hash: string;
  size: number;
}

interface SnapshotManifest {
  version: string;
  timestamp: string;
  files: FileSnapshot[];
}

interface SnapshotDiff {
  added: string[];
  removed: string[];
  modified: Array<{
    path: string;
    oldHash: string;
    newHash: string;
    diff?: string;
  }>;
}

interface SnapshotResult {
  success: boolean;
  mode: "create" | "verify" | "update";
  fileCount?: number;
  snapshotPath?: string;
  diff?: SnapshotDiff;
  hasChanges?: boolean;
  error?: string;
}

// ============================================================================
// Color Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// Snapshot Management Functions
// ============================================================================

/**
 * Get the snapshot directory path for a config
 */
function getSnapshotDir(configPath: string): string {
  const baseDir = dirname(configPath);
  return join(baseDir, ".kustomark", "snapshots");
}

/**
 * Get the snapshot manifest file path
 */
function getSnapshotManifestPath(configPath: string): string {
  return join(getSnapshotDir(configPath), "manifest.yaml");
}

/**
 * Load a snapshot manifest if it exists
 */
function loadSnapshot(configPath: string): SnapshotManifest | null {
  const manifestPath = getSnapshotManifestPath(configPath);
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    return yaml.load(content) as SnapshotManifest;
  } catch (error) {
    throw new Error(
      `Failed to load snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Save a snapshot manifest
 */
function saveSnapshot(configPath: string, manifest: SnapshotManifest): void {
  const snapshotDir = getSnapshotDir(configPath);
  const manifestPath = getSnapshotManifestPath(configPath);

  // Create snapshot directory if it doesn't exist
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }

  try {
    const content = yaml.dump(manifest, { indent: 2, lineWidth: 120 });
    writeFileSync(manifestPath, content, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to save snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create a snapshot manifest from build output
 */
function createSnapshotManifest(files: Map<string, string>): SnapshotManifest {
  const fileSnapshots: FileSnapshot[] = [];

  for (const [path, content] of files.entries()) {
    fileSnapshots.push({
      path,
      hash: calculateFileHash(content),
      size: Buffer.byteLength(content, "utf-8"),
    });
  }

  // Sort by path for consistent ordering
  fileSnapshots.sort((a, b) => a.path.localeCompare(b.path));

  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    files: fileSnapshots,
  };
}

/**
 * Compare two snapshots and generate a diff
 */
function compareSnapshots(
  oldManifest: SnapshotManifest,
  newManifest: SnapshotManifest,
  oldFiles: Map<string, string>,
  newFiles: Map<string, string>,
): SnapshotDiff {
  const oldFileMap = new Map(oldManifest.files.map((f) => [f.path, f]));
  const newFileMap = new Map(newManifest.files.map((f) => [f.path, f]));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{ path: string; oldHash: string; newHash: string; diff?: string }> = [];

  // Find added and modified files
  for (const [path, newFile] of newFileMap) {
    const oldFile = oldFileMap.get(path);
    if (!oldFile) {
      added.push(path);
    } else if (oldFile.hash !== newFile.hash) {
      const oldContent = oldFiles.get(path) || "";
      const newContent = newFiles.get(path) || "";
      const diffResult = generateFileDiff([
        {
          path,
          original: oldContent,
          modified: newContent,
        },
      ]);
      const fileDiff = diffResult.files.find((f) => f.path === path);

      modified.push({
        path,
        oldHash: oldFile.hash,
        newHash: newFile.hash,
        diff: fileDiff?.diff,
      });
    }
  }

  // Find removed files
  for (const [path] of oldFileMap) {
    if (!newFileMap.has(path)) {
      removed.push(path);
    }
  }

  return { added, removed, modified };
}

// ============================================================================
// Build Execution Functions
// ============================================================================

/**
 * Build file map by scanning directory tree
 */
function buildCompleteFileMap(basePath: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  const { readdirSync } = require("node:fs");

  function scanDirectory(dir: string): void {
    if (!existsSync(dir)) {
      return;
    }

    // biome-ignore lint/suspicious/noImplicitAnyLet: temporary variable for directory entries
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "output" ||
          entry.name === ".kustomark"
        ) {
          continue;
        }
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        if (
          entry.name.endsWith(".md") ||
          entry.name === "kustomark.yaml" ||
          entry.name === "kustomark.yml"
        ) {
          try {
            const content = readFileSync(fullPath, "utf-8");
            fileMap.set(fullPath, content);
          } catch (_error) {
            // Skip files we can't read
          }
        }
      }
    }
  }

  scanDirectory(dirname(basePath));
  return fileMap;
}

/**
 * Run build and return output files
 */
async function runBuild(
  config: KustomarkConfig,
  basePath: string,
  options: CLIOptions,
): Promise<Map<string, string>> {
  // Load lock file
  let lockFile: LockFile | null = null;
  const lockEntries: LockFileEntry[] = [];

  try {
    const configPath = join(basePath, "kustomark.yaml");
    lockFile = loadLockFile(configPath);
  } catch {
    // Lock file is optional
  }

  // Scan directory for files
  const fileMap = buildCompleteFileMap(basePath);

  // Resolve resources
  if (options.verbosity >= 2) {
    console.error("Resolving resources...");
  }

  const resolvedResources = await resolveResources(config.resources, basePath, fileMap, {
    lockFile: lockFile ?? undefined,
    updateLock: false,
    lockEntries,
  });

  if (options.verbosity >= 2) {
    console.error(`Resolved ${resolvedResources.length} resource(s)`);
  }

  // Apply patches to get output
  const outputFiles = new Map<string, string>();

  for (const resource of resolvedResources) {
    const baseDirectory = resource.baseDir || basePath;
    const relativePath = relative(baseDirectory, resource.path);

    // Apply patches
    const result = applyPatches(
      resource.content,
      config.patches || [],
      "warn",
      options.verbosity >= 3,
    );

    outputFiles.set(relativePath, result.content);
  }

  return outputFiles;
}

// ============================================================================
// Output Functions
// ============================================================================

/**
 * Output create mode results
 */
function outputCreateResult(result: SnapshotResult, options: CLIOptions): void {
  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(colorize("\n=== Snapshot Created ===", "bold"));
    console.log(`Files: ${colorize(String(result.fileCount), "green")}`);
    console.log(`Location: ${result.snapshotPath}`);
  }
}

/**
 * Output verify mode results
 */
function outputVerifyResult(result: SnapshotResult, options: CLIOptions): void {
  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(colorize("\n=== Snapshot Verification ===", "bold"));

  if (!result.diff) {
    console.log(colorize("Error: No diff information", "red"));
    return;
  }

  const { added, removed, modified } = result.diff;

  if (!result.hasChanges) {
    console.log(colorize("✓ Snapshot matches current build", "green"));
    return;
  }

  console.log(colorize("✗ Snapshot does not match current build", "red"));
  console.log("");

  // Show added files
  if (added.length > 0) {
    console.log(colorize(`Added files (${added.length}):`, "green"));
    for (const file of added) {
      console.log(`  ${colorize("+", "green")} ${file}`);
    }
    console.log("");
  }

  // Show removed files
  if (removed.length > 0) {
    console.log(colorize(`Removed files (${removed.length}):`, "red"));
    for (const file of removed) {
      console.log(`  ${colorize("-", "red")} ${file}`);
    }
    console.log("");
  }

  // Show modified files
  if (modified.length > 0) {
    console.log(colorize(`Modified files (${modified.length}):`, "yellow"));
    for (const file of modified) {
      console.log(`  ${colorize("~", "yellow")} ${file.path}`);
      if (options.verbosity >= 2 && file.diff) {
        // Show diff with indentation
        const diffLines = file.diff.split("\n");
        for (const line of diffLines) {
          if (line.startsWith("+")) {
            console.log(`    ${colorize(line, "green")}`);
          } else if (line.startsWith("-")) {
            console.log(`    ${colorize(line, "red")}`);
          } else if (line.startsWith("@@")) {
            console.log(`    ${colorize(line, "cyan")}`);
          } else {
            console.log(`    ${colors.dim}${line}${colors.reset}`);
          }
        }
        console.log("");
      }
    }
  }

  console.log(
    `Total changes: ${colorize(`+${added.length}`, "green")} ${colorize(`-${removed.length}`, "red")} ${colorize(`~${modified.length}`, "yellow")}`,
  );
}

/**
 * Output update mode results
 */
function outputUpdateResult(result: SnapshotResult, options: CLIOptions): void {
  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(colorize("\n=== Snapshot Updated ===", "bold"));

  if (!result.diff) {
    console.log(`Files: ${colorize(String(result.fileCount), "green")}`);
    console.log(`Location: ${result.snapshotPath}`);
    return;
  }

  const { added, removed, modified } = result.diff;

  if (!result.hasChanges) {
    console.log(colorize("No changes detected", "dim"));
    return;
  }

  console.log("Changes since last snapshot:");
  console.log("");

  if (added.length > 0) {
    console.log(colorize(`  Added: ${added.length} file(s)`, "green"));
  }
  if (removed.length > 0) {
    console.log(colorize(`  Removed: ${removed.length} file(s)`, "red"));
  }
  if (modified.length > 0) {
    console.log(colorize(`  Modified: ${modified.length} file(s)`, "yellow"));
  }

  console.log("");
  console.log(`Snapshot updated: ${result.snapshotPath}`);
}

/**
 * Output error
 */
function outputError(error: string, options: CLIOptions): void {
  if (options.format === "json") {
    const result: SnapshotResult = {
      success: false,
      mode: options.verify ? "verify" : options.update ? "update" : "create",
      error,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error(colorize(`Error: ${error}`, "red"));
  }
}

// ============================================================================
// Main Command Function
// ============================================================================

/**
 * Snapshot command implementation
 * Supports create, verify, and update modes
 */
export async function snapshotCommand(configPath: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(configPath);

    // Determine the actual config file path
    let actualConfigPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      actualConfigPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(actualConfigPath);

    // Load and validate config
    if (options.verbosity >= 2) {
      console.error(`Loading config from ${actualConfigPath}...`);
    }

    if (!existsSync(actualConfigPath)) {
      throw new Error(`Config file not found: ${actualConfigPath}`);
    }

    const configContent = readFileSync(actualConfigPath, "utf-8");
    const config: KustomarkConfig = parseConfig(configContent);

    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new Error(`Invalid configuration: ${errorMessages}`);
    }

    // Run build to get current output
    if (options.verbosity >= 1) {
      console.error("Running build...");
    }

    const currentFiles = await runBuild(config, basePath, options);

    if (options.verbosity >= 2) {
      console.error(`Built ${currentFiles.size} file(s)`);
    }

    // Create manifest from current build
    const currentManifest = createSnapshotManifest(currentFiles);

    // Determine mode and execute
    if (options.verify) {
      // Verify mode
      const savedManifest = loadSnapshot(actualConfigPath);

      if (!savedManifest) {
        throw new Error("No snapshot found. Create one first with: kustomark snapshot [path]");
      }

      // Load saved files for diff generation
      const savedFiles = new Map<string, string>();
      for (const file of savedManifest.files) {
        savedFiles.set(file.path, ""); // We don't have the actual content, just hashes
      }

      const diff = compareSnapshots(savedManifest, currentManifest, savedFiles, currentFiles);
      const hasChanges =
        diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;

      const result: SnapshotResult = {
        success: !hasChanges,
        mode: "verify",
        diff,
        hasChanges,
      };

      outputVerifyResult(result, options);
      return hasChanges ? 1 : 0;
    } else if (options.update) {
      // Update mode
      const savedManifest = loadSnapshot(actualConfigPath);

      if (!savedManifest) {
        throw new Error("No snapshot found. Create one first with: kustomark snapshot [path]");
      }

      // Load saved files for diff generation
      const savedFiles = new Map<string, string>();
      for (const file of savedManifest.files) {
        savedFiles.set(file.path, "");
      }

      const diff = compareSnapshots(savedManifest, currentManifest, savedFiles, currentFiles);
      const hasChanges =
        diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;

      // Save updated snapshot
      saveSnapshot(actualConfigPath, currentManifest);
      const snapshotPath = getSnapshotManifestPath(actualConfigPath);

      const result: SnapshotResult = {
        success: true,
        mode: "update",
        fileCount: currentManifest.files.length,
        snapshotPath,
        diff,
        hasChanges,
      };

      outputUpdateResult(result, options);
      return 0;
    } else {
      // Create mode (default)
      saveSnapshot(actualConfigPath, currentManifest);
      const snapshotPath = getSnapshotManifestPath(actualConfigPath);

      const result: SnapshotResult = {
        success: true,
        mode: "create",
        fileCount: currentManifest.files.length,
        snapshotPath,
      };

      outputCreateResult(result, options);
      return 0;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputError(errorMessage, options);
    return 1;
  }
}
