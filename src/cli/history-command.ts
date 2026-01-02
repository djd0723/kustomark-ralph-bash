/**
 * History command implementation
 * Provides build history tracking and management capabilities
 *
 * Features:
 * - List all builds with filtering and pagination
 * - Show detailed build information
 * - Compare two builds with diff visualization
 * - Rollback to previous builds
 * - Clean old builds based on retention policies
 * - Show statistics and trends
 * - JSON and text output formats
 *
 * Usage:
 * - List: kustomark history list [options]
 * - Show: kustomark history show <build-id> [options]
 * - Diff: kustomark history diff <from> <to> [options]
 * - Rollback: kustomark history rollback <build-id> [options]
 * - Clean: kustomark history clean [options]
 * - Stats: kustomark history stats [options]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as yaml from "js-yaml";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  verbosity: number; // 0=quiet, 1=normal, 2=-v, 3=-vv, 4=-vvv
  limit?: number;
  offset?: number;
  status?: "success" | "error" | "all";
  before?: string; // ISO date
  after?: string; // ISO date
  keepLast?: number; // For clean command
  keepDays?: number; // For clean command
  dryRun?: boolean; // For clean/rollback commands
}

interface BuildFileEntry {
  path: string;
  hash: string;
  size: number;
}

interface BuildHistoryEntry {
  id: string; // Unique build ID (timestamp-based)
  timestamp: string; // ISO 8601 timestamp
  status: "success" | "error";
  duration: number; // Build duration in milliseconds
  configHash: string; // Hash of config at build time
  patchCount: number; // Number of patches applied
  fileCount: number; // Number of files processed
  files: BuildFileEntry[]; // List of files in this build
  error?: string; // Error message if status is error
  metadata?: {
    // Optional metadata
    user?: string;
    hostname?: string;
    command?: string;
  };
}

interface BuildHistoryManifest {
  version: string;
  builds: BuildHistoryEntry[];
}

interface HistoryListResult {
  total: number;
  builds: BuildHistoryEntry[];
  hasMore: boolean;
}

interface HistoryDiffResult {
  from: BuildHistoryEntry;
  to: BuildHistoryEntry;
  added: string[];
  removed: string[];
  modified: Array<{
    path: string;
    fromHash: string;
    toHash: string;
    diff?: string;
  }>;
  unchanged: string[];
}

interface HistoryStatsResult {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageDuration: number;
  averageFileCount: number;
  oldestBuild?: BuildHistoryEntry;
  newestBuild?: BuildHistoryEntry;
  buildFrequency: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
    lastMonth: number;
  };
  trends: {
    durationTrend: "increasing" | "decreasing" | "stable";
    fileCountTrend: "increasing" | "decreasing" | "stable";
  };
}

interface HistoryCleanResult {
  removedCount: number;
  removedBuilds: string[];
  keptCount: number;
  spaceFreed?: number;
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
  magenta: "\x1b[35m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// History Storage Functions
// ============================================================================

/**
 * Get the history directory path for a config
 */
function getHistoryDir(configPath: string): string {
  const baseDir = dirname(configPath);
  return join(baseDir, ".kustomark", "history");
}

/**
 * Get the history manifest file path
 */
function getHistoryManifestPath(configPath: string): string {
  return join(getHistoryDir(configPath), "manifest.yaml");
}

/**
 * Load history manifest if it exists
 */
function loadHistoryManifest(configPath: string): BuildHistoryManifest | null {
  const manifestPath = getHistoryManifestPath(configPath);
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    return yaml.load(content) as BuildHistoryManifest;
  } catch (error) {
    throw new Error(
      `Failed to load history manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Save history manifest
 */
function saveHistoryManifest(configPath: string, manifest: BuildHistoryManifest): void {
  const historyDir = getHistoryDir(configPath);
  const manifestPath = getHistoryManifestPath(configPath);

  // Create history directory if it doesn't exist
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  try {
    const content = yaml.dump(manifest, { indent: 2, lineWidth: 120 });
    writeFileSync(manifestPath, content, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to save history manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generate a unique build ID based on timestamp
 */
function generateBuildId(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
}

/**
 * Add a build entry to history
 */
export function addBuildToHistory(
  configPath: string,
  status: "success" | "error",
  duration: number,
  configHash: string,
  patchCount: number,
  files: BuildFileEntry[],
  error?: string,
): string {
  const manifest = loadHistoryManifest(configPath) || {
    version: "1.0",
    builds: [],
  };

  const buildId = generateBuildId();
  const entry: BuildHistoryEntry = {
    id: buildId,
    timestamp: new Date().toISOString(),
    status,
    duration,
    configHash,
    patchCount,
    fileCount: files.length,
    files,
    ...(error && { error }),
  };

  manifest.builds.push(entry);

  // Sort by timestamp descending (newest first)
  manifest.builds.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  saveHistoryManifest(configPath, manifest);
  return buildId;
}

// ============================================================================
// History Query Functions
// ============================================================================

/**
 * Filter builds based on options
 */
function filterBuilds(builds: BuildHistoryEntry[], options: CLIOptions): BuildHistoryEntry[] {
  let filtered = [...builds];

  // Filter by status
  if (options.status && options.status !== "all") {
    filtered = filtered.filter((b) => b.status === options.status);
  }

  // Filter by date range
  if (options.after) {
    const afterDate = new Date(options.after);
    filtered = filtered.filter((b) => new Date(b.timestamp) >= afterDate);
  }

  if (options.before) {
    const beforeDate = new Date(options.before);
    filtered = filtered.filter((b) => new Date(b.timestamp) <= beforeDate);
  }

  return filtered;
}

/**
 * Get builds with pagination
 */
function paginateBuilds(
  builds: BuildHistoryEntry[],
  options: CLIOptions,
): { items: BuildHistoryEntry[]; hasMore: boolean } {
  const offset = options.offset || 0;
  const limit = options.limit || 20;

  const items = builds.slice(offset, offset + limit);
  const hasMore = builds.length > offset + limit;

  return { items, hasMore };
}

/**
 * Find a build by ID or partial ID
 */
function findBuildById(builds: BuildHistoryEntry[], id: string): BuildHistoryEntry | null {
  // Try exact match first
  const exact = builds.find((b) => b.id === id);
  if (exact) return exact;

  // Try partial match (prefix)
  const matches = builds.filter((b) => b.id.startsWith(id));
  if (matches.length === 1) {
    const match = matches[0];
    return match || null;
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous build ID "${id}": matches ${matches.length} builds`);
  }

  return null;
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * List builds with filtering and pagination
 */
async function handleListCommand(configPath: string, options: CLIOptions): Promise<number> {
  const manifest = loadHistoryManifest(configPath);

  if (!manifest || manifest.builds.length === 0) {
    if (options.format === "json") {
      console.log(JSON.stringify({ total: 0, builds: [], hasMore: false }, null, 2));
    } else {
      console.log("No build history found.");
    }
    return 0;
  }

  // Filter and paginate
  const filtered = filterBuilds(manifest.builds, options);
  const { items, hasMore } = paginateBuilds(filtered, options);

  const result: HistoryListResult = {
    total: filtered.length,
    builds: items,
    hasMore,
  };

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(colorize("\n=== Build History ===", "bold"));
    console.log(`Total builds: ${filtered.length}`);
    console.log("");

    for (const build of items) {
      const date = new Date(build.timestamp);
      const statusColor = build.status === "success" ? "green" : "red";
      const statusIcon = build.status === "success" ? "✓" : "✗";

      console.log(colorize(`${statusIcon} ${build.id}`, statusColor));
      console.log(`  Date: ${date.toLocaleString()}`);
      console.log(`  Duration: ${build.duration}ms`);
      console.log(`  Files: ${build.fileCount}`);
      console.log(`  Patches: ${build.patchCount}`);

      if (build.error && options.verbosity >= 1) {
        console.log(`  ${colorize("Error:", "red")} ${build.error}`);
      }

      console.log("");
    }

    if (hasMore) {
      const nextOffset = (options.offset || 0) + items.length;
      console.log(
        colorize(
          `Showing ${items.length} of ${filtered.length} builds. Use --offset ${nextOffset} to see more.`,
          "dim",
        ),
      );
    }
  }

  return 0;
}

/**
 * Show detailed information about a specific build
 */
async function handleShowCommand(
  configPath: string,
  buildId: string,
  options: CLIOptions,
): Promise<number> {
  const manifest = loadHistoryManifest(configPath);

  if (!manifest) {
    console.error(colorize("Error: No build history found", "red"));
    return 1;
  }

  const build = findBuildById(manifest.builds, buildId);

  if (!build) {
    console.error(colorize(`Error: Build not found: ${buildId}`, "red"));
    return 1;
  }

  if (options.format === "json") {
    console.log(JSON.stringify(build, null, 2));
  } else {
    const date = new Date(build.timestamp);
    const statusColor = build.status === "success" ? "green" : "red";
    const statusText = build.status.toUpperCase();

    console.log(colorize("\n=== Build Details ===", "bold"));
    console.log("");
    console.log(`Build ID: ${colorize(build.id, "cyan")}`);
    console.log(`Status: ${colorize(statusText, statusColor)}`);
    console.log(`Timestamp: ${date.toLocaleString()}`);
    console.log(`Duration: ${build.duration}ms`);
    console.log(`Config Hash: ${build.configHash}`);
    console.log(`Patches Applied: ${build.patchCount}`);
    console.log(`Files Processed: ${build.fileCount}`);
    console.log("");

    if (build.error) {
      console.log(colorize("Error Message:", "red"));
      console.log(`  ${build.error}`);
      console.log("");
    }

    if (options.verbosity >= 2 && build.files.length > 0) {
      console.log(colorize("Files:", "bold"));
      for (const file of build.files) {
        console.log(`  ${file.path}`);
        if (options.verbosity >= 3) {
          console.log(`    Hash: ${file.hash}`);
          console.log(`    Size: ${file.size} bytes`);
        }
      }
      console.log("");
    }

    if (build.metadata) {
      console.log(colorize("Metadata:", "bold"));
      if (build.metadata.user) console.log(`  User: ${build.metadata.user}`);
      if (build.metadata.hostname) console.log(`  Hostname: ${build.metadata.hostname}`);
      if (build.metadata.command) console.log(`  Command: ${build.metadata.command}`);
      console.log("");
    }
  }

  return 0;
}

/**
 * Compare two builds and show differences
 */
async function handleDiffCommand(
  configPath: string,
  fromId: string,
  toId: string,
  options: CLIOptions,
): Promise<number> {
  const manifest = loadHistoryManifest(configPath);

  if (!manifest) {
    console.error(colorize("Error: No build history found", "red"));
    return 1;
  }

  const fromBuild = findBuildById(manifest.builds, fromId);
  const toBuild = findBuildById(manifest.builds, toId);

  if (!fromBuild) {
    console.error(colorize(`Error: Build not found: ${fromId}`, "red"));
    return 1;
  }

  if (!toBuild) {
    console.error(colorize(`Error: Build not found: ${toId}`, "red"));
    return 1;
  }

  // Compare builds
  const fromFileMap = new Map(fromBuild.files.map((f) => [f.path, f]));
  const toFileMap = new Map(toBuild.files.map((f) => [f.path, f]));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{ path: string; fromHash: string; toHash: string }> = [];
  const unchanged: string[] = [];

  // Find added and modified files
  for (const [path, toFile] of toFileMap) {
    const fromFile = fromFileMap.get(path);
    if (!fromFile) {
      added.push(path);
    } else if (fromFile.hash !== toFile.hash) {
      modified.push({
        path,
        fromHash: fromFile.hash,
        toHash: toFile.hash,
      });
    } else {
      unchanged.push(path);
    }
  }

  // Find removed files
  for (const [path] of fromFileMap) {
    if (!toFileMap.has(path)) {
      removed.push(path);
    }
  }

  const result: HistoryDiffResult = {
    from: fromBuild,
    to: toBuild,
    added,
    removed,
    modified,
    unchanged,
  };

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(colorize("\n=== Build Comparison ===", "bold"));
    console.log("");
    console.log(
      `From: ${colorize(fromBuild.id, "cyan")} (${new Date(fromBuild.timestamp).toLocaleString()})`,
    );
    console.log(
      `To:   ${colorize(toBuild.id, "cyan")} (${new Date(toBuild.timestamp).toLocaleString()})`,
    );
    console.log("");

    const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

    if (!hasChanges) {
      console.log(colorize("No differences found", "dim"));
      return 0;
    }

    if (added.length > 0) {
      console.log(colorize(`Added files (${added.length}):`, "green"));
      for (const file of added) {
        console.log(`  ${colorize("+", "green")} ${file}`);
      }
      console.log("");
    }

    if (removed.length > 0) {
      console.log(colorize(`Removed files (${removed.length}):`, "red"));
      for (const file of removed) {
        console.log(`  ${colorize("-", "red")} ${file}`);
      }
      console.log("");
    }

    if (modified.length > 0) {
      console.log(colorize(`Modified files (${modified.length}):`, "yellow"));
      for (const file of modified) {
        console.log(`  ${colorize("~", "yellow")} ${file.path}`);
        if (options.verbosity >= 2) {
          console.log(`    From: ${file.fromHash}`);
          console.log(`    To:   ${file.toHash}`);
        }
      }
      console.log("");
    }

    console.log(
      `Summary: ${colorize(`+${added.length}`, "green")} ${colorize(`-${removed.length}`, "red")} ${colorize(`~${modified.length}`, "yellow")} (${unchanged.length} unchanged)`,
    );
    console.log("");
  }

  return 0;
}

/**
 * Rollback to a previous build
 */
async function handleRollbackCommand(
  configPath: string,
  buildId: string,
  options: CLIOptions,
): Promise<number> {
  const manifest = loadHistoryManifest(configPath);

  if (!manifest) {
    console.error(colorize("Error: No build history found", "red"));
    return 1;
  }

  const build = findBuildById(manifest.builds, buildId);

  if (!build) {
    console.error(colorize(`Error: Build not found: ${buildId}`, "red"));
    return 1;
  }

  if (build.status !== "success") {
    console.error(colorize("Error: Cannot rollback to a failed build", "red"));
    return 1;
  }

  if (options.format === "json") {
    const result = {
      success: true,
      buildId: build.id,
      fileCount: build.fileCount,
      dryRun: options.dryRun || false,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(colorize("\n=== Rollback ===", "bold"));
    console.log("");
    console.log(`Target build: ${colorize(build.id, "cyan")}`);
    console.log(`Date: ${new Date(build.timestamp).toLocaleString()}`);
    console.log(`Files: ${build.fileCount}`);
    console.log("");

    if (options.dryRun) {
      console.log(colorize("DRY RUN MODE - No changes will be made", "yellow"));
      console.log("");
      console.log("Would restore:");
      for (const file of build.files) {
        console.log(`  ${file.path}`);
      }
    } else {
      console.log(
        colorize(
          "Warning: Rollback functionality requires integration with the build system.",
          "yellow",
        ),
      );
      console.log("To rollback, you need to rebuild using the configuration from this build.");
      console.log("");
      console.log(`Config hash: ${build.configHash}`);
    }
    console.log("");
  }

  return 0;
}

/**
 * Clean old builds based on retention policy
 */
async function handleCleanCommand(configPath: string, options: CLIOptions): Promise<number> {
  const manifest = loadHistoryManifest(configPath);

  if (!manifest || manifest.builds.length === 0) {
    if (options.format === "json") {
      console.log(JSON.stringify({ removedCount: 0, removedBuilds: [], keptCount: 0 }, null, 2));
    } else {
      console.log("No build history to clean.");
    }
    return 0;
  }

  const toRemove: BuildHistoryEntry[] = [];
  const toKeep: BuildHistoryEntry[] = [];

  // Apply retention policies
  if (options.keepLast) {
    // Keep last N builds
    toKeep.push(...manifest.builds.slice(0, options.keepLast));
    toRemove.push(...manifest.builds.slice(options.keepLast));
  } else if (options.keepDays) {
    // Keep builds from last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.keepDays);

    for (const build of manifest.builds) {
      const buildDate = new Date(build.timestamp);
      if (buildDate >= cutoffDate) {
        toKeep.push(build);
      } else {
        toRemove.push(build);
      }
    }
  } else {
    // Default: keep last 10 builds
    toKeep.push(...manifest.builds.slice(0, 10));
    toRemove.push(...manifest.builds.slice(10));
  }

  const result: HistoryCleanResult = {
    removedCount: toRemove.length,
    removedBuilds: toRemove.map((b) => b.id),
    keptCount: toKeep.length,
  };

  if (options.dryRun) {
    if (options.format === "json") {
      console.log(JSON.stringify({ ...result, dryRun: true }, null, 2));
    } else {
      console.log(colorize("\n=== Clean Build History (DRY RUN) ===", "bold"));
      console.log("");
      console.log(`Would remove: ${result.removedCount} builds`);
      console.log(`Would keep: ${result.keptCount} builds`);
      console.log("");

      if (result.removedCount > 0 && options.verbosity >= 2) {
        console.log(colorize("Builds to remove:", "yellow"));
        for (const id of result.removedBuilds) {
          console.log(`  ${id}`);
        }
        console.log("");
      }
    }
  } else {
    // Actually remove builds
    manifest.builds = toKeep;
    saveHistoryManifest(configPath, manifest);

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(colorize("\n=== Clean Build History ===", "bold"));
      console.log("");
      console.log(`Removed: ${colorize(String(result.removedCount), "green")} builds`);
      console.log(`Kept: ${result.keptCount} builds`);
      console.log("");
    }
  }

  return 0;
}

/**
 * Show build statistics and trends
 */
async function handleStatsCommand(configPath: string, options: CLIOptions): Promise<number> {
  const manifest = loadHistoryManifest(configPath);

  if (!manifest || manifest.builds.length === 0) {
    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            totalBuilds: 0,
            successfulBuilds: 0,
            failedBuilds: 0,
            averageDuration: 0,
            averageFileCount: 0,
          },
          null,
          2,
        ),
      );
    } else {
      console.log("No build history found.");
    }
    return 0;
  }

  // Calculate statistics
  const totalBuilds = manifest.builds.length;
  const successfulBuilds = manifest.builds.filter((b) => b.status === "success").length;
  const failedBuilds = manifest.builds.filter((b) => b.status === "error").length;

  const durations = manifest.builds.map((b) => b.duration);
  const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  const fileCounts = manifest.builds.map((b) => b.fileCount);
  const averageFileCount = fileCounts.reduce((a, b) => a + b, 0) / fileCounts.length;

  const oldestBuild = manifest.builds[manifest.builds.length - 1];
  const newestBuild = manifest.builds[0];

  // Calculate build frequency
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const buildFrequency = {
    lastHour: manifest.builds.filter((b) => new Date(b.timestamp) >= oneHourAgo).length,
    lastDay: manifest.builds.filter((b) => new Date(b.timestamp) >= oneDayAgo).length,
    lastWeek: manifest.builds.filter((b) => new Date(b.timestamp) >= oneWeekAgo).length,
    lastMonth: manifest.builds.filter((b) => new Date(b.timestamp) >= oneMonthAgo).length,
  };

  // Calculate trends (compare recent builds to older builds)
  const recentBuilds = manifest.builds.slice(0, Math.min(5, manifest.builds.length));
  const olderBuilds = manifest.builds.slice(
    Math.max(0, manifest.builds.length - 5),
    manifest.builds.length,
  );

  const recentAvgDuration = recentBuilds.reduce((a, b) => a + b.duration, 0) / recentBuilds.length;
  const olderAvgDuration = olderBuilds.reduce((a, b) => a + b.duration, 0) / olderBuilds.length;

  const recentAvgFileCount =
    recentBuilds.reduce((a, b) => a + b.fileCount, 0) / recentBuilds.length;
  const olderAvgFileCount = olderBuilds.reduce((a, b) => a + b.fileCount, 0) / olderBuilds.length;

  const durationTrend =
    Math.abs(recentAvgDuration - olderAvgDuration) < olderAvgDuration * 0.1
      ? "stable"
      : recentAvgDuration > olderAvgDuration
        ? "increasing"
        : "decreasing";

  const fileCountTrend =
    Math.abs(recentAvgFileCount - olderAvgFileCount) < olderAvgFileCount * 0.1
      ? "stable"
      : recentAvgFileCount > olderAvgFileCount
        ? "increasing"
        : "decreasing";

  const result: HistoryStatsResult = {
    totalBuilds,
    successfulBuilds,
    failedBuilds,
    averageDuration,
    averageFileCount,
    oldestBuild,
    newestBuild,
    buildFrequency,
    trends: {
      durationTrend,
      fileCountTrend,
    },
  };

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(colorize("\n=== Build Statistics ===", "bold"));
    console.log("");

    console.log(colorize("Overview:", "bold"));
    console.log(`  Total builds: ${totalBuilds}`);
    console.log(`  Successful: ${colorize(String(successfulBuilds), "green")}`);
    console.log(`  Failed: ${colorize(String(failedBuilds), failedBuilds > 0 ? "red" : "dim")}`);
    console.log(`  Success rate: ${((successfulBuilds / totalBuilds) * 100).toFixed(1)}%`);
    console.log("");

    console.log(colorize("Performance:", "bold"));
    console.log(`  Average duration: ${averageDuration.toFixed(0)}ms`);
    console.log(`  Average files: ${averageFileCount.toFixed(1)}`);
    console.log("");

    console.log(colorize("Build Frequency:", "bold"));
    console.log(`  Last hour: ${buildFrequency.lastHour}`);
    console.log(`  Last day: ${buildFrequency.lastDay}`);
    console.log(`  Last week: ${buildFrequency.lastWeek}`);
    console.log(`  Last month: ${buildFrequency.lastMonth}`);
    console.log("");

    console.log(colorize("Trends:", "bold"));
    const durationTrendColor =
      durationTrend === "increasing" ? "yellow" : durationTrend === "decreasing" ? "green" : "dim";
    const fileCountTrendColor =
      fileCountTrend === "increasing" ? "blue" : fileCountTrend === "decreasing" ? "yellow" : "dim";

    console.log(`  Duration: ${colorize(durationTrend, durationTrendColor)}`);
    console.log(`  File count: ${colorize(fileCountTrend, fileCountTrendColor)}`);
    console.log("");

    if (oldestBuild && newestBuild) {
      console.log(colorize("Timeline:", "bold"));
      console.log(
        `  Oldest: ${oldestBuild.id} (${new Date(oldestBuild.timestamp).toLocaleString()})`,
      );
      console.log(
        `  Newest: ${newestBuild.id} (${new Date(newestBuild.timestamp).toLocaleString()})`,
      );
      console.log("");
    }
  }

  return 0;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Output error message
 */
function outputError(error: string, format: "text" | "json"): void {
  if (format === "json") {
    console.log(JSON.stringify({ success: false, error }, null, 2));
  } else {
    console.error(colorize(`Error: ${error}`, "red"));
  }
}

// ============================================================================
// Main Command Handler
// ============================================================================

/**
 * History command handler
 * Routes to appropriate subcommand
 */
export async function historyCommand(args: string[], options: CLIOptions): Promise<number> {
  const subcommand = args[0];

  try {
    // Find config file - default to current directory
    let resolvedConfigPath: string;
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, "kustomark.yaml");

    if (existsSync(defaultConfigPath)) {
      resolvedConfigPath = defaultConfigPath;
    } else {
      throw new Error(
        "Config file not found. Please run this command from a directory containing kustomark.yaml",
      );
    }

    switch (subcommand) {
      case "list":
        return await handleListCommand(resolvedConfigPath, options);

      case "show": {
        const buildId = args[1];
        if (!buildId) {
          throw new Error("Build ID required for 'show' command");
        }
        return await handleShowCommand(resolvedConfigPath, buildId, options);
      }

      case "diff": {
        const fromId = args[1];
        const toId = args[2];
        if (!fromId || !toId) {
          throw new Error("Two build IDs required for 'diff' command");
        }
        return await handleDiffCommand(resolvedConfigPath, fromId, toId, options);
      }

      case "rollback": {
        const buildId = args[1];
        if (!buildId) {
          throw new Error("Build ID required for 'rollback' command");
        }
        return await handleRollbackCommand(resolvedConfigPath, buildId, options);
      }

      case "clean":
        return await handleCleanCommand(resolvedConfigPath, options);

      case "stats":
        return await handleStatsCommand(resolvedConfigPath, options);

      default:
        throw new Error(
          `Unknown history subcommand: ${subcommand}. Valid subcommands: list, show, diff, rollback, clean, stats`,
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputError(errorMessage, options.format);
    return 1;
  }
}
