/**
 * Build history manager for Kustomark
 *
 * This module handles recording, loading, and managing build history to enable:
 * - Build comparison and diffing
 * - Rollback to previous builds
 * - Build analytics and statistics
 * - Auditing and change tracking
 *
 * Build history is stored in .kustomark/history/ with the following structure:
 * - builds/{timestamp}.json - Individual build records
 * - manifest.json - Index of all builds with metadata
 * - current.json - Latest successful build (for quick access)
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * File record for a single built file
 */
export interface BuildFileRecord {
  /** File path relative to project root */
  path: string;
  /** SHA256 hash of source content */
  sourceHash: string;
  /** SHA256 hash of applied patches */
  patchHash: string;
  /** SHA256 hash of output content */
  outputHash: string;
  /** Size of output file in bytes */
  size: number;
}

/**
 * Complete build record
 */
export interface BuildRecord {
  /** Unique build ID (ISO 8601 timestamp) */
  id: string;
  /** Build creation timestamp (ISO 8601) */
  timestamp: string;
  /** Kustomark version used for build */
  version: string;
  /** SHA256 hash of config file */
  configHash: string;
  /** Map of config paths to their hashes (for tracking base configs) */
  configHashes?: Record<string, string>;
  /** Build success status */
  success: boolean;
  /** Error message if build failed */
  error?: string;
  /** Map of file paths to build file records */
  files: Record<string, BuildFileRecord>;
  /** Total number of files built */
  fileCount: number;
  /** Total size of all output files in bytes */
  totalSize: number;
  /** Build duration in milliseconds */
  duration?: number;
  /** Group filters used during build */
  groupFilters?: {
    /** Enabled groups (whitelist mode) */
    enabled?: string[];
    /** Disabled groups (blacklist mode) */
    disabled?: string[];
  };
}

/**
 * Manifest entry with summary information
 */
export interface BuildManifestEntry {
  /** Build ID (ISO 8601 timestamp) */
  id: string;
  /** Build timestamp (ISO 8601) */
  timestamp: string;
  /** Kustomark version */
  version: string;
  /** Build success status */
  success: boolean;
  /** Number of files in build */
  fileCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Build duration in milliseconds */
  duration?: number;
}

/**
 * Manifest index of all builds
 */
export interface BuildManifest {
  /** Manifest version for schema evolution */
  version: number;
  /** List of all builds (sorted by timestamp, newest first) */
  builds: BuildManifestEntry[];
  /** Total number of builds */
  totalBuilds: number;
  /** Timestamp of last update (ISO 8601) */
  lastUpdated: string;
}

/**
 * Build comparison result
 */
export interface BuildComparison {
  /** Build IDs being compared */
  baseline: string;
  current: string;
  /** Files added in current build */
  added: string[];
  /** Files removed in current build */
  removed: string[];
  /** Files modified in current build */
  modified: Array<{
    file: string;
    baselineHash: string;
    currentHash: string;
    sizeChange: number;
  }>;
  /** Files unchanged between builds */
  unchanged: string[];
  /** Overall statistics */
  stats: {
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
    totalSizeChange: number;
  };
}

/**
 * Filter options for listing builds
 */
export interface BuildListFilter {
  /** Filter by success status */
  success?: boolean;
  /** Filter by minimum timestamp (ISO 8601) */
  since?: string;
  /** Filter by maximum timestamp (ISO 8601) */
  until?: string;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * History statistics
 */
export interface HistoryStats {
  /** Total number of builds */
  totalBuilds: number;
  /** Number of successful builds */
  successfulBuilds: number;
  /** Number of failed builds */
  failedBuilds: number;
  /** Total disk space used by history in bytes */
  totalSize: number;
  /** Timestamp of oldest build (ISO 8601) */
  oldestBuild?: string;
  /** Timestamp of newest build (ISO 8601) */
  newestBuild?: string;
  /** Average build file count */
  avgFileCount: number;
  /** Average build size in bytes */
  avgBuildSize: number;
}

/**
 * Calculates SHA256 hash of content
 *
 * @param content - Content to hash (string or bytes)
 * @returns SHA256 hash in hex format (without prefix)
 */
export function calculateFileHash(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

/**
 * Gets the history directory for a project
 *
 * History is stored at .kustomark/history/ relative to the config file's directory.
 *
 * @param configPath - Path to the kustomark config file
 * @returns Path to the history directory
 */
export function getHistoryDirectory(configPath: string): string {
  const configDir = dirname(resolve(configPath));
  return join(configDir, ".kustomark", "history");
}

/**
 * Gets the builds subdirectory path
 *
 * @param configPath - Path to the kustomark config file
 * @returns Path to the builds directory
 */
function getBuildsDirectory(configPath: string): string {
  return join(getHistoryDirectory(configPath), "builds");
}

/**
 * Gets the current Kustomark version
 *
 * Reads the version from package.json. Returns "unknown" if the version
 * cannot be determined.
 *
 * @returns Kustomark version string
 * @internal
 */
function getKustomarkVersion(): string {
  try {
    // Try multiple common locations for package.json
    const possiblePaths = [
      join(process.cwd(), "package.json"),
      join(dirname(import.meta.dir ?? __dirname), "../../package.json"),
      join(import.meta.dir ?? __dirname, "../../package.json"),
    ];

    for (const pkgPath of possiblePaths) {
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.version && typeof pkg.version === "string") {
          return pkg.version;
        }
      }
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Validates a build record object structure
 *
 * @param data - Data to validate
 * @throws Error if validation fails
 */
function validateBuildRecord(data: unknown): asserts data is BuildRecord {
  if (!data || typeof data !== "object") {
    throw new Error("Build record must be an object");
  }

  const record = data as Record<string, unknown>;

  // Validate required fields
  if (typeof record.id !== "string") {
    throw new Error("Build record must have a string 'id' field");
  }

  if (typeof record.timestamp !== "string") {
    throw new Error("Build record must have a string 'timestamp' field");
  }

  const timestamp = new Date(record.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Build record 'timestamp' must be a valid ISO 8601 date string");
  }

  if (typeof record.version !== "string") {
    throw new Error("Build record must have a string 'version' field");
  }

  if (typeof record.configHash !== "string") {
    throw new Error("Build record must have a string 'configHash' field");
  }

  if (typeof record.success !== "boolean") {
    throw new Error("Build record must have a boolean 'success' field");
  }

  if (!record.files || typeof record.files !== "object") {
    throw new Error("Build record must have a 'files' object");
  }

  if (typeof record.fileCount !== "number") {
    throw new Error("Build record must have a number 'fileCount' field");
  }

  if (typeof record.totalSize !== "number") {
    throw new Error("Build record must have a number 'totalSize' field");
  }

  // Validate optional fields
  if (record.error !== undefined && typeof record.error !== "string") {
    throw new Error("Build record 'error' must be a string if present");
  }

  if (record.duration !== undefined && typeof record.duration !== "number") {
    throw new Error("Build record 'duration' must be a number if present");
  }

  // Validate file records
  const files = record.files as Record<string, unknown>;
  for (const [filePath, fileRecord] of Object.entries(files)) {
    if (!fileRecord || typeof fileRecord !== "object") {
      throw new Error(`Build file record for '${filePath}' must be an object`);
    }

    const file = fileRecord as Record<string, unknown>;
    if (
      typeof file.path !== "string" ||
      typeof file.sourceHash !== "string" ||
      typeof file.patchHash !== "string" ||
      typeof file.outputHash !== "string" ||
      typeof file.size !== "number"
    ) {
      throw new Error(
        `Build file record for '${filePath}' must have path, sourceHash, patchHash, outputHash, and size fields`,
      );
    }
  }
}

/**
 * Validates a build manifest object structure
 *
 * @param data - Data to validate
 * @throws Error if validation fails
 */
function validateBuildManifest(data: unknown): asserts data is BuildManifest {
  if (!data || typeof data !== "object") {
    throw new Error("Build manifest must be an object");
  }

  const manifest = data as Record<string, unknown>;

  if (typeof manifest.version !== "number") {
    throw new Error("Build manifest must have a number 'version' field");
  }

  if (!Array.isArray(manifest.builds)) {
    throw new Error("Build manifest must have a 'builds' array");
  }

  if (typeof manifest.totalBuilds !== "number") {
    throw new Error("Build manifest must have a number 'totalBuilds' field");
  }

  if (typeof manifest.lastUpdated !== "string") {
    throw new Error("Build manifest must have a string 'lastUpdated' field");
  }

  // Validate each manifest entry
  for (const [index, entry] of manifest.builds.entries()) {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Build manifest entry at index ${index} must be an object`);
    }

    const e = entry as Record<string, unknown>;
    if (
      typeof e.id !== "string" ||
      typeof e.timestamp !== "string" ||
      typeof e.version !== "string" ||
      typeof e.success !== "boolean" ||
      typeof e.fileCount !== "number" ||
      typeof e.totalSize !== "number"
    ) {
      throw new Error(
        `Build manifest entry at index ${index} must have id, timestamp, version, success, fileCount, and totalSize fields`,
      );
    }
  }
}

/**
 * Loads the build manifest from disk
 *
 * @param configPath - Path to the kustomark config file
 * @returns Parsed manifest or null if not found/invalid
 */
export async function loadManifest(configPath: string): Promise<BuildManifest | null> {
  const historyDir = getHistoryDirectory(configPath);
  const manifestPath = join(historyDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    validateBuildManifest(parsed);
    return parsed;
  } catch (error) {
    console.warn(
      `Warning: Invalid build manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Saves the build manifest to disk
 *
 * @param configPath - Path to the kustomark config file
 * @param manifest - Manifest to save
 */
async function saveManifest(configPath: string, manifest: BuildManifest): Promise<void> {
  const historyDir = getHistoryDirectory(configPath);
  const manifestPath = join(historyDir, "manifest.json");

  // Ensure history directory exists
  await mkdir(historyDir, { recursive: true });

  const content = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, content, "utf-8");
}

/**
 * Creates an empty build manifest
 *
 * @returns Empty BuildManifest object
 */
function createEmptyManifest(): BuildManifest {
  return {
    version: 1,
    builds: [],
    totalBuilds: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Loads a specific build record from disk
 *
 * @param configPath - Path to the kustomark config file
 * @param buildId - Build ID (ISO 8601 timestamp)
 * @returns Parsed build record or null if not found/invalid
 *
 * @example
 * ```typescript
 * const build = await loadBuild(configPath, '2024-01-15T10:30:00.000Z');
 * if (build) {
 *   console.log(`Build has ${build.fileCount} files`);
 * }
 * ```
 */
export async function loadBuild(configPath: string, buildId: string): Promise<BuildRecord | null> {
  const buildsDir = getBuildsDirectory(configPath);
  const buildPath = join(buildsDir, `${buildId}.json`);

  if (!existsSync(buildPath)) {
    return null;
  }

  try {
    const content = await readFile(buildPath, "utf-8");
    const parsed = JSON.parse(content);
    validateBuildRecord(parsed);
    return parsed;
  } catch (error) {
    console.warn(
      `Warning: Invalid build record at ${buildPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Saves a build record to disk
 *
 * @param configPath - Path to the kustomark config file
 * @param buildId - Build ID (ISO 8601 timestamp)
 * @param record - Build record to save
 */
async function saveBuild(configPath: string, buildId: string, record: BuildRecord): Promise<void> {
  const buildsDir = getBuildsDirectory(configPath);
  const buildPath = join(buildsDir, `${buildId}.json`);

  // Ensure builds directory exists
  await mkdir(buildsDir, { recursive: true });

  const content = JSON.stringify(record, null, 2);
  await writeFile(buildPath, content, "utf-8");
}

/**
 * Records a new build in the history
 *
 * Saves the build record, updates the manifest, and updates current.json
 * for successful builds.
 *
 * @param configPath - Path to the kustomark config file
 * @param files - Map of file paths to their content and hashes
 * @param configHash - SHA256 hash of config file
 * @param success - Whether the build succeeded
 * @param options - Optional build metadata
 * @returns Created build record
 *
 * @example
 * ```typescript
 * const files = new Map([
 *   ['docs/readme.md', {
 *     content: '# README\n\nHello',
 *     sourceHash: 'abc123...',
 *     patchHash: 'def456...',
 *     outputHash: 'ghi789...'
 *   }]
 * ]);
 *
 * const record = await recordBuild(
 *   configPath,
 *   files,
 *   'config-hash',
 *   true,
 *   { duration: 1500, configHashes: { 'base.yaml': 'base-hash' } }
 * );
 * ```
 */
export async function recordBuild(
  configPath: string,
  files: Map<
    string,
    {
      content: string;
      sourceHash: string;
      patchHash: string;
      outputHash: string;
    }
  >,
  configHash: string,
  success: boolean,
  options?: {
    error?: string;
    duration?: number;
    configHashes?: Record<string, string>;
    groupFilters?: {
      enabled?: string[];
      disabled?: string[];
    };
  },
): Promise<BuildRecord> {
  const timestamp = new Date().toISOString();
  const buildId = timestamp;

  // Create file records
  const fileRecords: Record<string, BuildFileRecord> = {};
  let totalSize = 0;

  for (const [filePath, fileData] of files.entries()) {
    const size = Buffer.byteLength(fileData.content, "utf-8");
    totalSize += size;

    fileRecords[filePath] = {
      path: filePath,
      sourceHash: fileData.sourceHash,
      patchHash: fileData.patchHash,
      outputHash: fileData.outputHash,
      size,
    };
  }

  // Create build record
  const record: BuildRecord = {
    id: buildId,
    timestamp,
    version: getKustomarkVersion(),
    configHash,
    success,
    files: fileRecords,
    fileCount: files.size,
    totalSize,
  };

  // Add optional fields
  if (options?.error) {
    record.error = options.error;
  }
  if (options?.duration !== undefined) {
    record.duration = options.duration;
  }
  if (options?.configHashes) {
    record.configHashes = options.configHashes;
  }
  if (options?.groupFilters) {
    record.groupFilters = options.groupFilters;
  }

  // Save build record
  await saveBuild(configPath, buildId, record);

  // Update manifest
  let manifest = await loadManifest(configPath);
  if (!manifest) {
    manifest = createEmptyManifest();
  }

  // Add new build to manifest
  const manifestEntry: BuildManifestEntry = {
    id: buildId,
    timestamp,
    version: record.version,
    success,
    fileCount: files.size,
    totalSize,
    duration: options?.duration,
  };

  manifest.builds.unshift(manifestEntry); // Add to beginning (newest first)
  manifest.totalBuilds += 1;
  manifest.lastUpdated = new Date().toISOString();

  await saveManifest(configPath, manifest);

  // Update current.json if build was successful
  if (success) {
    const historyDir = getHistoryDirectory(configPath);
    const currentPath = join(historyDir, "current.json");
    await writeFile(currentPath, JSON.stringify(record, null, 2), "utf-8");
  }

  return record;
}

/**
 * Lists builds with optional filtering
 *
 * @param configPath - Path to the kustomark config file
 * @param filter - Optional filter criteria
 * @returns Array of build manifest entries matching the filter
 *
 * @example
 * ```typescript
 * // Get last 10 successful builds
 * const builds = await listBuilds(configPath, {
 *   success: true,
 *   limit: 10
 * });
 *
 * // Get builds since a specific date
 * const recentBuilds = await listBuilds(configPath, {
 *   since: '2024-01-01T00:00:00.000Z'
 * });
 * ```
 */
export async function listBuilds(
  configPath: string,
  filter?: BuildListFilter,
): Promise<BuildManifestEntry[]> {
  const manifest = await loadManifest(configPath);
  if (!manifest) {
    return [];
  }

  let builds = manifest.builds;

  // Apply filters
  if (filter?.success !== undefined) {
    builds = builds.filter((b) => b.success === filter.success);
  }

  if (filter?.since) {
    const sinceTime = new Date(filter.since).getTime();
    builds = builds.filter((b) => new Date(b.timestamp).getTime() >= sinceTime);
  }

  if (filter?.until) {
    const untilTime = new Date(filter.until).getTime();
    builds = builds.filter((b) => new Date(b.timestamp).getTime() <= untilTime);
  }

  // Apply limit
  if (filter?.limit !== undefined && filter.limit > 0) {
    builds = builds.slice(0, filter.limit);
  }

  return builds;
}

/**
 * Compares two builds and returns the differences
 *
 * @param configPath - Path to the kustomark config file
 * @param baselineId - Baseline build ID
 * @param currentId - Current build ID
 * @returns Build comparison result
 * @throws Error if either build doesn't exist
 *
 * @example
 * ```typescript
 * const comparison = await compareBuilds(
 *   configPath,
 *   '2024-01-15T10:00:00.000Z',
 *   '2024-01-15T11:00:00.000Z'
 * );
 *
 * console.log(`Added: ${comparison.stats.addedCount} files`);
 * console.log(`Modified: ${comparison.stats.modifiedCount} files`);
 * console.log(`Removed: ${comparison.stats.removedCount} files`);
 * ```
 */
export async function compareBuilds(
  configPath: string,
  baselineId: string,
  currentId: string,
): Promise<BuildComparison> {
  const baseline = await loadBuild(configPath, baselineId);
  const current = await loadBuild(configPath, currentId);

  if (!baseline) {
    throw new Error(`Baseline build '${baselineId}' not found`);
  }

  if (!current) {
    throw new Error(`Current build '${currentId}' not found`);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{
    file: string;
    baselineHash: string;
    currentHash: string;
    sizeChange: number;
  }> = [];
  const unchanged: string[] = [];

  const baselineFiles = new Set(Object.keys(baseline.files));
  const currentFiles = new Set(Object.keys(current.files));

  // Find added and modified files
  for (const filePath of currentFiles) {
    if (!baselineFiles.has(filePath)) {
      added.push(filePath);
    } else {
      const baselineFile = baseline.files[filePath];
      const currentFile = current.files[filePath];

      if (baselineFile && currentFile) {
        if (baselineFile.outputHash !== currentFile.outputHash) {
          modified.push({
            file: filePath,
            baselineHash: baselineFile.outputHash,
            currentHash: currentFile.outputHash,
            sizeChange: currentFile.size - baselineFile.size,
          });
        } else {
          unchanged.push(filePath);
        }
      }
    }
  }

  // Find removed files
  for (const filePath of baselineFiles) {
    if (!currentFiles.has(filePath)) {
      removed.push(filePath);
    }
  }

  // Sort for consistent output
  added.sort();
  removed.sort();
  modified.sort((a, b) => a.file.localeCompare(b.file));
  unchanged.sort();

  // Calculate statistics
  const totalSizeChange = modified.reduce((sum, m) => sum + m.sizeChange, 0);

  return {
    baseline: baselineId,
    current: currentId,
    added,
    removed,
    modified,
    unchanged,
    stats: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: unchanged.length,
      totalSizeChange,
    },
  };
}

/**
 * Restores files from a previous build
 *
 * Loads the specified build and returns its file contents for restoration.
 * This function doesn't write files directly - it returns the data so the
 * caller can decide how to restore them.
 *
 * @param configPath - Path to the kustomark config file
 * @param buildId - Build ID to restore from
 * @returns Map of file paths to their content from the specified build
 * @throws Error if build doesn't exist or failed
 *
 * @example
 * ```typescript
 * const files = await rollbackToBuild(configPath, '2024-01-15T10:00:00.000Z');
 *
 * // Write restored files
 * for (const [filePath, content] of files.entries()) {
 *   await writeFile(filePath, content, 'utf-8');
 * }
 * ```
 */
export async function rollbackToBuild(
  configPath: string,
  buildId: string,
): Promise<Map<string, string>> {
  const build = await loadBuild(configPath, buildId);

  if (!build) {
    throw new Error(`Build '${buildId}' not found`);
  }

  if (!build.success) {
    throw new Error(`Cannot rollback to failed build '${buildId}'`);
  }

  // Load file contents from the builds directory
  const buildsDir = getBuildsDirectory(configPath);
  const files = new Map<string, string>();

  // Note: The build record only stores hashes, not content.
  // In a real implementation, you'd need to either:
  // 1. Store the actual file contents in the build record
  // 2. Store files in a separate content-addressable store
  // 3. Rely on git or another VCS for the actual content
  //
  // For this implementation, we'll assume the build directory structure
  // mirrors the output structure and load files from there
  const buildDir = join(buildsDir, buildId);

  for (const filePath of Object.keys(build.files)) {
    const fullPath = join(buildDir, filePath);
    if (existsSync(fullPath)) {
      try {
        const content = await readFile(fullPath, "utf-8");
        files.set(filePath, content);
      } catch (error) {
        console.warn(
          `Warning: Could not read file '${filePath}' from build '${buildId}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return files;
}

/**
 * Prunes old build history based on criteria
 *
 * Removes build records older than the specified date or keeps only the
 * most recent N builds. Always preserves the current (latest successful) build.
 *
 * @param configPath - Path to the kustomark config file
 * @param options - Pruning criteria
 * @returns Number of builds removed
 *
 * @example
 * ```typescript
 * // Keep only last 50 builds
 * const removed = await pruneHistory(configPath, { keep: 50 });
 *
 * // Remove builds older than 30 days
 * const thirtyDaysAgo = new Date();
 * thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
 * const removed = await pruneHistory(configPath, {
 *   before: thirtyDaysAgo.toISOString()
 * });
 * ```
 */
export async function pruneHistory(
  configPath: string,
  options: {
    /** Keep only this many most recent builds */
    keep?: number;
    /** Remove builds before this timestamp (ISO 8601) */
    before?: string;
  },
): Promise<number> {
  const manifest = await loadManifest(configPath);
  if (!manifest || manifest.builds.length === 0) {
    return 0;
  }

  const buildsToRemove: string[] = [];
  let buildsToKeep = manifest.builds;

  // Apply "before" filter
  if (options.before) {
    const beforeTime = new Date(options.before).getTime();
    const filtered = buildsToKeep.filter((b) => {
      const buildTime = new Date(b.timestamp).getTime();
      if (buildTime < beforeTime) {
        buildsToRemove.push(b.id);
        return false;
      }
      return true;
    });
    buildsToKeep = filtered;
  }

  // Apply "keep" limit
  if (options.keep !== undefined && options.keep > 0) {
    if (buildsToKeep.length > options.keep) {
      const toRemove = buildsToKeep.slice(options.keep);
      buildsToRemove.push(...toRemove.map((b) => b.id));
      buildsToKeep = buildsToKeep.slice(0, options.keep);
    }
  }

  // Remove build files
  const buildsDir = getBuildsDirectory(configPath);
  for (const buildId of buildsToRemove) {
    const buildPath = join(buildsDir, `${buildId}.json`);
    try {
      if (existsSync(buildPath)) {
        await rm(buildPath, { force: true });
      }

      // Also remove build directory if it exists
      const buildDir = join(buildsDir, buildId);
      if (existsSync(buildDir)) {
        await rm(buildDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(
        `Warning: Could not remove build '${buildId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Update manifest
  const updatedManifest: BuildManifest = {
    version: manifest.version,
    builds: buildsToKeep,
    totalBuilds: buildsToKeep.length,
    lastUpdated: new Date().toISOString(),
  };

  await saveManifest(configPath, updatedManifest);

  return buildsToRemove.length;
}

/**
 * Clears all build history
 *
 * Removes all build records and the manifest. This cannot be undone.
 *
 * @param configPath - Path to the kustomark config file
 * @returns Number of builds cleared
 *
 * @example
 * ```typescript
 * const cleared = await clearHistory(configPath);
 * console.log(`Cleared ${cleared} builds from history`);
 * ```
 */
export async function clearHistory(configPath: string): Promise<number> {
  const manifest = await loadManifest(configPath);
  const buildCount = manifest?.totalBuilds ?? 0;

  const historyDir = getHistoryDirectory(configPath);

  if (!existsSync(historyDir)) {
    return 0;
  }

  try {
    await rm(historyDir, { recursive: true, force: true });
  } catch (error) {
    throw new Error(
      `Failed to clear history: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return buildCount;
}

/**
 * Gets statistics about the build history
 *
 * @param configPath - Path to the kustomark config file
 * @returns History statistics
 *
 * @example
 * ```typescript
 * const stats = await getHistoryStats(configPath);
 * console.log(`Total builds: ${stats.totalBuilds}`);
 * console.log(`Success rate: ${(stats.successfulBuilds / stats.totalBuilds * 100).toFixed(1)}%`);
 * console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
 * ```
 */
export async function getHistoryStats(configPath: string): Promise<HistoryStats> {
  const manifest = await loadManifest(configPath);

  if (!manifest || manifest.builds.length === 0) {
    return {
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      totalSize: 0,
      avgFileCount: 0,
      avgBuildSize: 0,
    };
  }

  const successfulBuilds = manifest.builds.filter((b) => b.success).length;
  const failedBuilds = manifest.builds.length - successfulBuilds;

  // Calculate total size of history directory
  const historyDir = getHistoryDirectory(configPath);
  let totalSize = 0;

  try {
    totalSize = await calculateDirectorySize(historyDir);
  } catch (error) {
    console.warn(
      `Warning: Could not calculate history size: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Calculate averages
  const totalFileCount = manifest.builds.reduce((sum, b) => sum + b.fileCount, 0);
  const totalBuildSize = manifest.builds.reduce((sum, b) => sum + b.totalSize, 0);
  const avgFileCount = manifest.builds.length > 0 ? totalFileCount / manifest.builds.length : 0;
  const avgBuildSize = manifest.builds.length > 0 ? totalBuildSize / manifest.builds.length : 0;

  // Get oldest and newest build timestamps
  const sortedByTime = [...manifest.builds].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const oldestBuild = sortedByTime[0]?.timestamp;
  const newestBuild = sortedByTime[sortedByTime.length - 1]?.timestamp;

  return {
    totalBuilds: manifest.totalBuilds,
    successfulBuilds,
    failedBuilds,
    totalSize,
    oldestBuild,
    newestBuild,
    avgFileCount,
    avgBuildSize,
  };
}

/**
 * Recursively calculates the total size of a directory
 *
 * @param dirPath - Path to directory
 * @returns Total size in bytes
 * @internal
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn(
      `Warning: Could not calculate size of ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return totalSize;
}
