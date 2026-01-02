/**
 * Benchmark storage module for Kustomark
 *
 * This module handles saving, loading, and comparing benchmark results.
 * Baselines are stored in .kustomark/benchmarks/ directory with the following structure:
 * - baselines/{name}.json - Named baseline files
 * - history/{timestamp}.json - Historical benchmark runs
 * - latest.json - Copy of the most recent benchmark run
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BenchmarkComparison, BenchmarkResult, BenchmarkSuiteResult } from "./types.js";

/**
 * Gets the benchmark storage directory
 *
 * Benchmarks are stored at .kustomark/benchmarks/ relative to the base directory.
 * If baseDir is not provided, uses the current working directory.
 *
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @returns Path to the benchmark storage directory
 */
function getBenchmarkDirectory(baseDir?: string): string {
  const base = baseDir ? resolve(baseDir) : process.cwd();
  return join(base, ".kustomark", "benchmarks");
}

/**
 * Gets the baselines subdirectory path
 *
 * @param baseDir - Base directory for the project
 * @returns Path to the baselines directory
 */
function getBaselinesDirectory(baseDir?: string): string {
  return join(getBenchmarkDirectory(baseDir), "baselines");
}

/**
 * Gets the history subdirectory path
 *
 * @param baseDir - Base directory for the project
 * @returns Path to the history directory
 */
function getHistoryDirectory(baseDir?: string): string {
  return join(getBenchmarkDirectory(baseDir), "history");
}

/**
 * Validates a benchmark suite result object
 *
 * @param data - Data to validate
 * @throws Error if validation fails
 */
function validateBenchmarkSuiteResult(data: unknown): asserts data is BenchmarkSuiteResult {
  if (!data || typeof data !== "object") {
    throw new Error("Benchmark result must be an object");
  }

  const result = data as Record<string, unknown>;

  // Validate timestamp
  if (typeof result.timestamp !== "string") {
    throw new Error("Benchmark result must have a string 'timestamp' field");
  }

  const timestamp = new Date(result.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Benchmark result 'timestamp' must be a valid ISO 8601 date string");
  }

  // Validate environment
  if (!result.environment || typeof result.environment !== "object") {
    throw new Error("Benchmark result must have an 'environment' object");
  }

  const env = result.environment as Record<string, unknown>;
  if (
    typeof env.platform !== "string" ||
    typeof env.arch !== "string" ||
    typeof env.bunVersion !== "string" ||
    typeof env.cpuCount !== "number" ||
    typeof env.totalMemory !== "number"
  ) {
    throw new Error(
      "Benchmark result 'environment' must have platform, arch, bunVersion, cpuCount, and totalMemory fields",
    );
  }

  // Validate results array
  if (!Array.isArray(result.results)) {
    throw new Error("Benchmark result must have a 'results' array");
  }

  for (let i = 0; i < result.results.length; i++) {
    const item = result.results[i];
    if (!item || typeof item !== "object") {
      throw new Error(`Benchmark result at index ${i} must be an object`);
    }

    const benchResult = item as Record<string, unknown>;
    if (
      typeof benchResult.operation !== "string" ||
      typeof benchResult.fileCount !== "number" ||
      typeof benchResult.complexity !== "string" ||
      typeof benchResult.runs !== "number"
    ) {
      throw new Error(
        `Benchmark result at index ${i} must have operation, fileCount, complexity, and runs fields`,
      );
    }

    // Validate timing object
    if (!benchResult.timing || typeof benchResult.timing !== "object") {
      throw new Error(`Benchmark result at index ${i} must have a 'timing' object`);
    }

    // Validate memory object
    if (!benchResult.memory || typeof benchResult.memory !== "object") {
      throw new Error(`Benchmark result at index ${i} must have a 'memory' object`);
    }

    // Validate throughput object
    if (!benchResult.throughput || typeof benchResult.throughput !== "object") {
      throw new Error(`Benchmark result at index ${i} must have a 'throughput' object`);
    }
  }

  // Validate summary
  if (!result.summary || typeof result.summary !== "object") {
    throw new Error("Benchmark result must have a 'summary' object");
  }

  const summary = result.summary as Record<string, unknown>;
  if (
    typeof summary.totalDuration !== "number" ||
    typeof summary.totalOperations !== "number" ||
    typeof summary.averageThroughput !== "number"
  ) {
    throw new Error(
      "Benchmark result 'summary' must have totalDuration, totalOperations, and averageThroughput fields",
    );
  }
}

/**
 * Serializes a benchmark suite result to JSON
 *
 * @param results - Benchmark suite result to serialize
 * @returns JSON string representation
 */
function serializeBenchmarkResult(results: BenchmarkSuiteResult): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Parses JSON content into a BenchmarkSuiteResult object
 *
 * @param content - JSON content as string
 * @returns Parsed BenchmarkSuiteResult object
 * @throws Error if JSON is malformed or validation fails
 */
async function parseBenchmarkResult(
  content: string | Promise<string>,
): Promise<BenchmarkSuiteResult> {
  const resolvedContent = await content;

  try {
    const parsed = JSON.parse(resolvedContent);
    validateBenchmarkSuiteResult(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates a baseline name
 *
 * Baseline names must be non-empty and contain only alphanumeric characters,
 * hyphens, underscores, and dots.
 *
 * @param name - Baseline name to validate
 * @throws Error if name is invalid
 */
function validateBaselineName(name: string): void {
  if (!name || typeof name !== "string") {
    throw new Error("Baseline name must be a non-empty string");
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(
      "Baseline name must contain only alphanumeric characters, hyphens, underscores, and dots",
    );
  }

  if (name === "latest") {
    throw new Error("'latest' is a reserved name and cannot be used as a baseline name");
  }
}

/**
 * Saves benchmark results as a named baseline
 *
 * Also saves to history/{timestamp}.json and updates latest.json.
 *
 * @param name - Name for the baseline
 * @param results - Benchmark suite results to save
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @throws Error if name is invalid or filesystem operations fail
 */
export async function saveBaseline(
  name: string,
  results: BenchmarkSuiteResult,
  baseDir?: string,
): Promise<void> {
  validateBaselineName(name);

  const benchmarkDir = getBenchmarkDirectory(baseDir);
  const baselinesDir = getBaselinesDirectory(baseDir);
  const historyDir = getHistoryDirectory(baseDir);

  // Ensure all directories exist
  await mkdir(baselinesDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });

  const content = serializeBenchmarkResult(results);

  // Save as named baseline
  const baselinePath = join(baselinesDir, `${name}.json`);
  await writeFile(baselinePath, content, "utf-8");

  // Save to history with timestamp
  const historyPath = join(historyDir, `${results.timestamp}.json`);
  await writeFile(historyPath, content, "utf-8");

  // Update latest.json
  const latestPath = join(benchmarkDir, "latest.json");
  await writeFile(latestPath, content, "utf-8");
}

/**
 * Loads a baseline by name
 *
 * @param name - Name of the baseline to load
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @returns Benchmark suite result or null if baseline doesn't exist
 * @throws Error if baseline file is invalid
 */
export async function loadBaseline(
  name: string,
  baseDir?: string,
): Promise<BenchmarkSuiteResult | null> {
  validateBaselineName(name);

  const baselinesDir = getBaselinesDirectory(baseDir);
  const baselinePath = join(baselinesDir, `${name}.json`);

  if (!existsSync(baselinePath)) {
    return null;
  }

  try {
    const content = await readFile(baselinePath, "utf-8");
    return await parseBenchmarkResult(content);
  } catch (error) {
    throw new Error(
      `Failed to load baseline '${name}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Lists all available baselines
 *
 * @param baseDir - Base directory for the project (defaults to current working directory)
 * @returns Array of baseline names (sorted alphabetically)
 */
export async function listBaselines(baseDir?: string): Promise<string[]> {
  const baselinesDir = getBaselinesDirectory(baseDir);

  if (!existsSync(baselinesDir)) {
    return [];
  }

  try {
    const files = await readdir(baselinesDir);
    const baselines = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -5)) // Remove .json extension
      .sort();

    return baselines;
  } catch (error) {
    throw new Error(
      `Failed to list baselines: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Finds a matching benchmark result by operation and file count
 *
 * @param results - Array of benchmark results to search
 * @param operation - Operation name to match
 * @param fileCount - File count to match
 * @returns Matching benchmark result or null if not found
 */
function findMatchingResult(
  results: BenchmarkResult[],
  operation: string,
  fileCount: number,
): BenchmarkResult | null {
  return results.find((r) => r.operation === operation && r.fileCount === fileCount) || null;
}

/**
 * Calculates percentage change between two values
 *
 * @param baseline - Baseline value
 * @param current - Current value
 * @returns Percentage change (positive means current is higher)
 */
function calculatePercentChange(baseline: number, current: number): number {
  if (baseline === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - baseline) / baseline) * 100;
}

/**
 * Compares two benchmark result sets
 *
 * Matches results by operation and file count, and calculates performance differences.
 * Only includes comparisons where both baseline and current have matching results.
 *
 * @param baseline - Baseline benchmark suite result
 * @param current - Current benchmark suite result
 * @returns Array of benchmark comparisons
 */
export function compareResults(
  baseline: BenchmarkSuiteResult,
  current: BenchmarkSuiteResult,
): BenchmarkComparison[] {
  const comparisons: BenchmarkComparison[] = [];

  // For each current result, try to find a matching baseline
  for (const currentResult of current.results) {
    const baselineResult = findMatchingResult(
      baseline.results,
      currentResult.operation,
      currentResult.fileCount,
    );

    if (!baselineResult) {
      // Skip if no matching baseline found
      continue;
    }

    // Calculate performance changes
    const meanPercent = calculatePercentChange(
      baselineResult.timing.mean,
      currentResult.timing.mean,
    );
    const medianPercent = calculatePercentChange(
      baselineResult.timing.median,
      currentResult.timing.median,
    );
    const memoryPercent = calculatePercentChange(
      baselineResult.memory.heapUsed,
      currentResult.memory.heapUsed,
    );

    // Determine if this is a regression or improvement
    // For timing: positive percentage = slower = regression
    // For memory: positive percentage = more memory = regression
    const regression = meanPercent > 0 || medianPercent > 0 || memoryPercent > 0;
    const improvement = meanPercent < 0 && medianPercent < 0 && memoryPercent < 0;

    comparisons.push({
      operation: currentResult.operation,
      fileCount: currentResult.fileCount,
      baseline: baselineResult,
      current: currentResult,
      change: {
        meanPercent,
        medianPercent,
        memoryPercent,
        regression,
        improvement,
      },
    });
  }

  return comparisons;
}

/**
 * Filters comparisons to find regressions above a threshold
 *
 * A regression is defined as a performance decrease (slower execution or higher memory usage)
 * where the mean timing or memory usage increases by more than the threshold percentage.
 *
 * @param comparisons - Array of benchmark comparisons
 * @param thresholdPercent - Minimum percentage change to consider (e.g., 5 for 5%)
 * @returns Array of comparisons that show regressions above the threshold
 */
export function detectRegressions(
  comparisons: BenchmarkComparison[],
  thresholdPercent: number,
): BenchmarkComparison[] {
  if (thresholdPercent < 0) {
    throw new Error("Threshold percentage must be non-negative");
  }

  return comparisons.filter((comp) => {
    // Check if mean timing regression exceeds threshold
    const meanRegression = comp.change.meanPercent > thresholdPercent;

    // Check if median timing regression exceeds threshold
    const medianRegression = comp.change.medianPercent > thresholdPercent;

    // Check if memory regression exceeds threshold
    const memoryRegression = comp.change.memoryPercent > thresholdPercent;

    // Return true if any metric shows regression above threshold
    return meanRegression || medianRegression || memoryRegression;
  });
}
