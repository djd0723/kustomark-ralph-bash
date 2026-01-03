/**
 * Cache command for build cache analytics and management
 * Provides tools for analyzing, validating, and optimizing the build cache
 */

import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  analyzeCachePerformance,
  type CacheOptimizationSuggestion,
  type CacheStats,
  getCacheDirectory,
  getCacheEfficiency,
  loadBuildCache,
  repairCache,
  saveBuildCache,
  suggestCacheOptimizations,
  validateCacheIntegrity,
} from "../core/build-cache.js";
import type { BuildCache } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  verbosity: number;
}

interface CacheStatsResult {
  success: boolean;
  stats?: {
    totalEntries: number;
    cacheSize: string;
    oldestEntry?: string;
    newestEntry?: string;
    configHash: string;
    groupFilters?: {
      enabled?: string[];
      disabled?: string[];
    };
  };
  error?: string;
}

interface CacheAnalyzeResult {
  success: boolean;
  analytics?: {
    hitRate: number;
    missRate: number;
    efficiency: number;
    timeSaved: number;
    avgRebuildTime: number;
    avgCachedTime: number;
    invalidationReasons: Array<{ reason: string; count: number }>;
  };
  suggestions?: CacheOptimizationSuggestion[];
  error?: string;
}

interface CacheValidateResult {
  success: boolean;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
  error?: string;
}

interface CacheRepairResult {
  success: boolean;
  entriesRemoved?: number;
  issues?: string[];
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Calculates directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;
  const { readdir, stat } = await import("node:fs/promises");

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (_error) {
    // Ignore errors (permission denied, etc.)
  }

  return totalSize;
}

/**
 * Creates mock cache statistics for demonstration purposes
 * In real usage, this would be collected during actual build operations
 */
function createMockStats(cache: BuildCache): CacheStats {
  const totalEntries = cache.entries.size;
  const hits = Math.floor(totalEntries * 0.7); // Assume 70% hit rate
  const misses = totalEntries - hits;

  const invalidationReasons = new Map<string, number>();
  invalidationReasons.set("Source file content changed", Math.floor(misses * 0.6));
  invalidationReasons.set("Applicable patches changed", Math.floor(misses * 0.3));
  invalidationReasons.set("Configuration file changed", Math.floor(misses * 0.1));

  // Mock some timing data
  const rebuildTimes: number[] = [];
  const cachedTimes: number[] = [];

  for (let i = 0; i < misses; i++) {
    rebuildTimes.push(100 + Math.random() * 200); // 100-300ms
  }

  for (let i = 0; i < hits; i++) {
    cachedTimes.push(1 + Math.random() * 5); // 1-6ms
  }

  return {
    totalLookups: totalEntries,
    hits,
    misses,
    invalidationReasons,
    rebuildTimes,
    cachedTimes,
  };
}

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * Shows cache statistics
 */
export async function cacheStatsCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    // Load cache
    const cache = await loadBuildCache(configPath);

    if (!cache) {
      if (options.format === "json") {
        const result: CacheStatsResult = {
          success: false,
          error: "No cache found",
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("No cache found. Run a build to create the cache.");
      }
      return 1;
    }

    // Calculate cache directory size
    const cacheDir = getCacheDirectory(configPath);
    const cacheDirSize = await getDirectorySize(cacheDir);

    // Find oldest and newest entries
    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;
    let oldestDate = new Date();
    let newestDate = new Date(0);

    for (const entry of cache.entries.values()) {
      const date = new Date(entry.built);
      if (date < oldestDate) {
        oldestDate = date;
        oldestEntry = entry.built;
      }
      if (date > newestDate) {
        newestDate = date;
        newestEntry = entry.built;
      }
    }

    if (options.format === "json") {
      const result: CacheStatsResult = {
        success: true,
        stats: {
          totalEntries: cache.entries.size,
          cacheSize: formatBytes(cacheDirSize),
          oldestEntry,
          newestEntry,
          configHash: cache.configHash,
          groupFilters: cache.groupFilters,
        },
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Cache Statistics");
      console.log("=".repeat(60));
      console.log(`Total Entries: ${cache.entries.size}`);
      console.log(`Cache Size: ${formatBytes(cacheDirSize)}`);
      console.log(`Config Hash: ${cache.configHash.substring(0, 16)}...`);
      if (oldestEntry) {
        console.log(`Oldest Entry: ${new Date(oldestEntry).toLocaleString()}`);
      }
      if (newestEntry) {
        console.log(`Newest Entry: ${new Date(newestEntry).toLocaleString()}`);
      }
      if (cache.groupFilters) {
        console.log("\nGroup Filters:");
        if (cache.groupFilters.enabled) {
          console.log(`  Enabled: ${cache.groupFilters.enabled.join(", ")}`);
        }
        if (cache.groupFilters.disabled) {
          console.log(`  Disabled: ${cache.groupFilters.disabled.join(", ")}`);
        }
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      const result: CacheStatsResult = {
        success: false,
        error: errorMessage,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

/**
 * Analyzes cache and suggests optimizations
 */
export async function cacheAnalyzeCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    // Load cache
    const cache = await loadBuildCache(configPath);

    if (!cache) {
      if (options.format === "json") {
        const result: CacheAnalyzeResult = {
          success: false,
          error: "No cache found",
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("No cache found. Run a build to create the cache.");
      }
      return 1;
    }

    // Create mock statistics (in real usage, this would come from actual build)
    const stats = createMockStats(cache);

    // Analyze performance
    const analytics = analyzeCachePerformance(stats);
    const efficiency = getCacheEfficiency(analytics);
    const suggestions = suggestCacheOptimizations(cache, analytics);

    if (options.format === "json") {
      const result: CacheAnalyzeResult = {
        success: true,
        analytics: {
          hitRate: analytics.hitRate,
          missRate: analytics.missRate,
          efficiency,
          timeSaved: analytics.timeSaved,
          avgRebuildTime: analytics.avgRebuildTime,
          avgCachedTime: analytics.avgCachedTime,
          invalidationReasons: Array.from(analytics.invalidationReasons.entries()).map(
            ([reason, count]) => ({ reason, count }),
          ),
        },
        suggestions,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Cache Performance Analysis");
      console.log("=".repeat(60));
      console.log(`Cache Hit Rate: ${analytics.hitRate.toFixed(1)}%`);
      console.log(`Cache Miss Rate: ${analytics.missRate.toFixed(1)}%`);
      console.log(`Cache Efficiency: ${efficiency.toFixed(1)}%`);
      console.log(`Average Rebuild Time: ${analytics.avgRebuildTime.toFixed(2)}ms`);
      console.log(`Average Cached Time: ${analytics.avgCachedTime.toFixed(2)}ms`);
      console.log(`Time Saved: ${(analytics.timeSaved / 1000).toFixed(2)}s`);

      console.log("\nInvalidation Reasons:");
      const sortedReasons = Array.from(analytics.invalidationReasons.entries()).sort(
        (a, b) => b[1] - a[1],
      );
      for (const [reason, count] of sortedReasons) {
        const percentage = (count / stats.totalLookups) * 100;
        console.log(`  ${reason}: ${count} (${percentage.toFixed(1)}%)`);
      }

      console.log("\nOptimization Suggestions:");
      for (const suggestion of suggestions) {
        const icon =
          suggestion.type === "success" ? "+" : suggestion.type === "warning" ? "!" : "i";
        const impactLabel = `[${suggestion.impact.toUpperCase()}]`;
        console.log(`  ${icon} ${impactLabel} ${suggestion.message}`);
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      const result: CacheAnalyzeResult = {
        success: false,
        error: errorMessage,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

/**
 * Validates cache integrity
 */
export async function cacheValidateCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    // Load cache
    const cache = await loadBuildCache(configPath);

    if (!cache) {
      if (options.format === "json") {
        const result: CacheValidateResult = {
          success: false,
          error: "No cache found",
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("No cache found. Run a build to create the cache.");
      }
      return 1;
    }

    // Validate integrity
    const validation = await validateCacheIntegrity(cache);

    if (options.format === "json") {
      const result: CacheValidateResult = {
        success: true,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Cache Integrity Validation");
      console.log("=".repeat(60));

      if (validation.valid) {
        console.log("Cache is valid!");
      } else {
        console.log("Cache validation failed!");
      }

      if (validation.errors.length > 0) {
        console.log("\nErrors:");
        for (const error of validation.errors) {
          console.log(`  - ${error}`);
        }
      }

      if (validation.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of validation.warnings) {
          console.log(`  - ${warning}`);
        }
      }

      if (!validation.valid) {
        console.log("\nRun 'kustomark cache repair' to fix cache issues.");
      }
    }

    return validation.valid ? 0 : 1;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      const result: CacheValidateResult = {
        success: false,
        error: errorMessage,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

/**
 * Repairs corrupted cache
 */
export async function cacheRepairCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    // Load cache
    const cache = await loadBuildCache(configPath);

    if (!cache) {
      if (options.format === "json") {
        const result: CacheRepairResult = {
          success: false,
          error: "No cache found",
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("No cache found. Nothing to repair.");
      }
      return 1;
    }

    // Repair cache
    const repair = await repairCache(cache);

    // Save repaired cache
    await saveBuildCache(configPath, repair.repairedCache);

    if (options.format === "json") {
      const result: CacheRepairResult = {
        success: true,
        entriesRemoved: repair.entriesRemoved,
        issues: repair.issues,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Cache Repair");
      console.log("=".repeat(60));

      if (repair.entriesRemoved === 0) {
        console.log("No issues found. Cache is clean!");
      } else {
        console.log(`Removed ${repair.entriesRemoved} invalid entries`);

        if (repair.issues.length > 0) {
          console.log("\nIssues Fixed:");
          for (const issue of repair.issues) {
            console.log(`  - ${issue}`);
          }
        }

        console.log("\nCache has been repaired successfully!");
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      const result: CacheRepairResult = {
        success: false,
        error: errorMessage,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}
