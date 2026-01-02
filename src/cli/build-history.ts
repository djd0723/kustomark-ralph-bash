/**
 * Build history module for Kustomark
 *
 * This module handles recording and managing build history.
 * Build history is stored in .kustomark/builds/ directory with the following structure:
 * - history/{timestamp}.json - Historical build records
 * - latest.json - Copy of the most recent build
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { KustomarkConfig, ValidationError, ValidationWarning } from "../core/types.js";

/**
 * Build history record interface
 */
export interface BuildHistoryRecord {
  /** ISO 8601 timestamp of the build */
  timestamp: string;
  /** Build configuration snapshot */
  config: {
    /** Configuration file path */
    configPath: string;
    /** Base directory */
    basePath: string;
    /** Number of resources configured */
    resourceCount: number;
    /** Number of patches configured */
    patchCount: number;
    /** Output directory */
    outputDir?: string;
  };
  /** Build results */
  results: {
    /** Number of files written */
    filesWritten: number;
    /** Total bytes written */
    totalBytes: number;
    /** Number of patches applied */
    patchesApplied: number;
    /** Number of patches skipped */
    patchesSkipped: number;
  };
  /** Build duration in milliseconds */
  duration?: number;
  /** Build statistics (when --stats is used) */
  stats?: {
    /** Files processed */
    processed: number;
    /** Files written */
    written: number;
    /** Files checked (incremental builds) */
    checked?: number;
    /** Files rebuilt (incremental builds) */
    rebuilt?: number;
    /** Files unchanged (incremental builds) */
    unchanged?: number;
    /** Operation counts by type */
    byOperation: Record<string, number>;
    /** Cache statistics (incremental builds) */
    cache?: {
      hits: number;
      misses: number;
      hitRate: number;
      speedup?: number;
    };
  };
  /** Warnings generated during build */
  warnings: Array<{
    message: string;
    suggestions?: string[];
  }>;
  /** Validation errors */
  validationErrors: Array<{
    message: string;
    file?: string;
    validator?: string;
    field?: string;
  }>;
  /** Operation counts */
  operationCounts: Record<string, number>;
  /** Build success status */
  success: boolean;
}

/**
 * Gets the build history directory
 *
 * Build history is stored at .kustomark/builds/ relative to the base directory.
 * If baseDir is not provided, uses the current working directory.
 *
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @returns Path to the build history directory
 */
function getBuildHistoryDirectory(baseDir?: string): string {
  const base = baseDir ? resolve(baseDir) : process.cwd();
  return join(base, ".kustomark", "builds");
}

/**
 * Gets the history subdirectory path
 *
 * @param baseDir - Base directory for the project
 * @returns Path to the history directory
 */
function getHistoryDirectory(baseDir?: string): string {
  return join(getBuildHistoryDirectory(baseDir), "history");
}

/**
 * Validates a build history record object
 *
 * @param data - Data to validate
 * @throws Error if validation fails
 */
function validateBuildHistoryRecord(data: unknown): asserts data is BuildHistoryRecord {
  if (!data || typeof data !== "object") {
    throw new Error("Build history record must be an object");
  }

  const record = data as Record<string, unknown>;

  // Validate timestamp
  if (typeof record.timestamp !== "string") {
    throw new Error("Build history record must have a string 'timestamp' field");
  }

  const timestamp = new Date(record.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Build history record 'timestamp' must be a valid ISO 8601 date string");
  }

  // Validate config
  if (!record.config || typeof record.config !== "object") {
    throw new Error("Build history record must have a 'config' object");
  }

  // Validate results
  if (!record.results || typeof record.results !== "object") {
    throw new Error("Build history record must have a 'results' object");
  }

  const results = record.results as Record<string, unknown>;
  if (
    typeof results.filesWritten !== "number" ||
    typeof results.totalBytes !== "number" ||
    typeof results.patchesApplied !== "number" ||
    typeof results.patchesSkipped !== "number"
  ) {
    throw new Error(
      "Build history record 'results' must have filesWritten, totalBytes, patchesApplied, and patchesSkipped fields",
    );
  }

  // Validate warnings array
  if (!Array.isArray(record.warnings)) {
    throw new Error("Build history record must have a 'warnings' array");
  }

  // Validate validationErrors array
  if (!Array.isArray(record.validationErrors)) {
    throw new Error("Build history record must have a 'validationErrors' array");
  }

  // Validate operationCounts
  if (!record.operationCounts || typeof record.operationCounts !== "object") {
    throw new Error("Build history record must have an 'operationCounts' object");
  }

  // Validate success
  if (typeof record.success !== "boolean") {
    throw new Error("Build history record must have a boolean 'success' field");
  }
}

/**
 * Serializes a build history record to JSON
 *
 * @param record - Build history record to serialize
 * @returns JSON string representation
 */
function serializeBuildHistoryRecord(record: BuildHistoryRecord): string {
  return JSON.stringify(record, null, 2);
}

/**
 * Parses JSON content into a BuildHistoryRecord object
 *
 * @param content - JSON content as string
 * @returns Parsed BuildHistoryRecord object
 * @throws Error if JSON is malformed or validation fails
 */
async function parseBuildHistoryRecord(
  content: string | Promise<string>,
): Promise<BuildHistoryRecord> {
  const resolvedContent = await content;

  try {
    const parsed = JSON.parse(resolvedContent);
    validateBuildHistoryRecord(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Records a build to the build history
 *
 * Saves the build record to history/{timestamp}.json and updates latest.json.
 * Errors are caught and logged but do not fail the build.
 *
 * @param params - Build record parameters
 * @param params.config - Kustomark configuration
 * @param params.basePath - Base directory path
 * @param params.configPath - Configuration file path
 * @param params.filesWritten - Number of files written
 * @param params.totalBytes - Total bytes written
 * @param params.patchesApplied - Number of patches applied
 * @param params.patchesSkipped - Number of patches skipped
 * @param params.duration - Build duration in milliseconds
 * @param params.stats - Build statistics (optional)
 * @param params.warnings - Warnings generated during build
 * @param params.validationErrors - Validation errors
 * @param params.operationCounts - Operation counts by type
 * @param params.success - Build success status (defaults to true)
 * @returns Promise that resolves when history is recorded, or null if recording failed
 */
export async function recordBuild(params: {
  config: KustomarkConfig;
  basePath: string;
  configPath: string;
  filesWritten: number;
  totalBytes: number;
  patchesApplied: number;
  patchesSkipped: number;
  duration?: number;
  stats?: {
    processed: number;
    written: number;
    checked?: number;
    rebuilt?: number;
    unchanged?: number;
    byOperation: Record<string, number>;
    cache?: {
      hits: number;
      misses: number;
      hitRate: number;
      speedup?: number;
    };
  };
  warnings: ValidationWarning[];
  validationErrors: ValidationError[];
  operationCounts: Record<string, number>;
  success?: boolean;
}): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const buildHistoryDir = getBuildHistoryDirectory(params.basePath);
    const historyDir = getHistoryDirectory(params.basePath);

    // Ensure directories exist
    await mkdir(historyDir, { recursive: true });

    // Create build history record
    const record: BuildHistoryRecord = {
      timestamp,
      config: {
        configPath: params.configPath,
        basePath: params.basePath,
        resourceCount: Array.isArray(params.config.resources) ? params.config.resources.length : 0,
        patchCount: Array.isArray(params.config.patches) ? params.config.patches.length : 0,
        outputDir: params.config.output,
      },
      results: {
        filesWritten: params.filesWritten,
        totalBytes: params.totalBytes,
        patchesApplied: params.patchesApplied,
        patchesSkipped: params.patchesSkipped,
      },
      duration: params.duration,
      stats: params.stats,
      warnings: params.warnings.map((w) => ({
        message: w.message,
        suggestions: w.suggestions,
      })),
      validationErrors: params.validationErrors.map((e) => ({
        message: e.message,
        file: e.file,
        validator: e.validator,
        field: e.field,
      })),
      operationCounts: params.operationCounts,
      success: params.success ?? true,
    };

    const content = serializeBuildHistoryRecord(record);

    // Save to history with timestamp
    const historyPath = join(historyDir, `${timestamp}.json`);
    await writeFile(historyPath, content, "utf-8");

    // Update latest.json
    const latestPath = join(buildHistoryDir, "latest.json");
    await writeFile(latestPath, content, "utf-8");
  } catch (error) {
    // Log warning but don't fail the build
    console.warn(
      `Warning: Failed to record build history: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Loads the latest build history record
 *
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @returns Latest build history record or null if not found
 * @throws Error if the record file is invalid
 */
export async function loadLatestBuild(baseDir?: string): Promise<BuildHistoryRecord | null> {
  const buildHistoryDir = getBuildHistoryDirectory(baseDir);
  const latestPath = join(buildHistoryDir, "latest.json");

  if (!existsSync(latestPath)) {
    return null;
  }

  try {
    const content = await readFile(latestPath, "utf-8");
    return await parseBuildHistoryRecord(content);
  } catch (error) {
    throw new Error(
      `Failed to load latest build: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Lists all build history records
 *
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @returns Array of build history records (sorted by timestamp, newest first)
 */
export async function listBuildHistory(baseDir?: string): Promise<BuildHistoryRecord[]> {
  const historyDir = getHistoryDirectory(baseDir);

  if (!existsSync(historyDir)) {
    return [];
  }

  try {
    const files = await readdir(historyDir);
    const historyFiles = files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .reverse();

    const records: BuildHistoryRecord[] = [];
    for (const file of historyFiles) {
      const filePath = join(historyDir, file);
      try {
        const content = await readFile(filePath, "utf-8");
        const record = await parseBuildHistoryRecord(content);
        records.push(record);
      } catch (error) {
        // Skip invalid records
        console.warn(`Warning: Skipping invalid history file ${file}: ${error}`);
      }
    }

    return records;
  } catch (error) {
    throw new Error(
      `Failed to list build history: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Deletes old build history records, keeping only the most recent N records
 *
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @param keepCount - Number of recent records to keep (default: 100)
 * @returns Number of records deleted
 */
export async function pruneHistory(baseDir?: string, keepCount = 100): Promise<number> {
  const historyDir = getHistoryDirectory(baseDir);

  if (!existsSync(historyDir)) {
    return 0;
  }

  try {
    const files = await readdir(historyDir);
    const historyFiles = files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .reverse();

    // Delete files beyond the keep count
    const filesToDelete = historyFiles.slice(keepCount);
    let deletedCount = 0;

    for (const file of filesToDelete) {
      const filePath = join(historyDir, file);
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(filePath);
        deletedCount++;
      } catch (error) {
        console.warn(`Warning: Failed to delete history file ${file}: ${error}`);
      }
    }

    return deletedCount;
  } catch (error) {
    throw new Error(
      `Failed to prune history: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
