/**
 * Baseline manager for Kustomark performance monitoring
 *
 * This module provides functionality for managing performance baselines,
 * comparing benchmark results, and detecting regressions. Baselines are
 * stored in .kustomark/benchmarks/baselines/ with version-tagged filenames.
 *
 * Features:
 * - Generate and save baselines for specific versions
 * - Load existing baselines for comparison
 * - Compare current results with baselines and detect regressions
 * - Track baseline history
 * - Export comparison reports in JSON and Markdown formats
 *
 * @example
 * ```typescript
 * const manager = new BaselineManager();
 *
 * // Generate and save a baseline
 * await manager.generateBaselineForVersion('v0.1.0');
 *
 * // Compare current results with baseline
 * const comparison = await manager.compareWithBaseline(currentResults, 'v0.1.0');
 *
 * // Export a report
 * const report = await manager.exportBaselineReport('markdown');
 * console.log(report);
 * ```
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { compareResults, detectRegressions } from "./benchmark-storage.js";
import type { BenchmarkComparison, BenchmarkSuiteResult } from "./types.js";

/**
 * Metadata stored with each baseline
 */
export interface BaselineMetadata {
  /** Baseline version identifier */
  version: string;
  /** Timestamp when baseline was created (ISO 8601) */
  timestamp: string;
  /** Bun runtime version */
  bunVersion: string;
  /** Operating system platform */
  platform: string;
  /** CPU architecture */
  arch: string;
  /** Number of CPU cores */
  cpuCount: number;
  /** Total system memory in bytes */
  totalMemory: number;
  /** Kustomark version (if available) */
  kustomarkVersion?: string;
}

/**
 * Complete baseline record including metadata and results
 */
export interface BaselineRecord {
  /** Baseline metadata */
  metadata: BaselineMetadata;
  /** Benchmark suite results */
  results: BenchmarkSuiteResult;
}

/**
 * Comparison result with regression detection
 */
export interface BaselineComparisonResult {
  /** Version being compared against */
  baselineVersion: string;
  /** Baseline metadata */
  baselineMetadata: BaselineMetadata;
  /** Current results metadata */
  currentMetadata: BaselineMetadata;
  /** Individual benchmark comparisons */
  comparisons: BenchmarkComparison[];
  /** Detected regressions (>10% slower) */
  regressions: BenchmarkComparison[];
  /** Detected improvements */
  improvements: BenchmarkComparison[];
  /** Memory regressions (>20% higher) */
  memoryRegressions: BenchmarkComparison[];
  /** Overall regression detected flag */
  hasRegressions: boolean;
}

/**
 * Baseline history entry
 */
export interface BaselineHistoryEntry {
  /** Baseline version identifier */
  version: string;
  /** Timestamp when baseline was created */
  timestamp: string;
  /** File path to the baseline */
  filePath: string;
  /** Number of benchmark results in this baseline */
  resultCount: number;
}

/**
 * Options for the BaselineManager
 */
export interface BaselineManagerOptions {
  /** Base directory for the project (defaults to current working directory) */
  baseDir?: string;
  /** Timing regression threshold percentage (default: 10) */
  timingThreshold?: number;
  /** Memory regression threshold percentage (default: 20) */
  memoryThreshold?: number;
}

/**
 * BaselineManager class for managing performance baselines
 *
 * Provides comprehensive baseline management including:
 * - Creating versioned baselines
 * - Loading and comparing baselines
 * - Detecting performance regressions
 * - Exporting comparison reports
 *
 * @example
 * ```typescript
 * const manager = new BaselineManager({
 *   baseDir: '/path/to/project',
 *   timingThreshold: 10,
 *   memoryThreshold: 20
 * });
 *
 * // Generate baseline for current version
 * await manager.generateBaselineForVersion('v1.0.0');
 *
 * // Load and compare
 * const comparison = await manager.compareWithBaseline(newResults, 'v1.0.0');
 * if (comparison.hasRegressions) {
 *   console.log('Performance regressions detected!');
 *   console.log(await manager.exportBaselineReport('markdown'));
 * }
 * ```
 */
export class BaselineManager {
  private baseDir: string;
  private timingThreshold: number;
  private memoryThreshold: number;
  private lastComparison: BaselineComparisonResult | null = null;

  /**
   * Create a new BaselineManager instance
   *
   * @param options - Configuration options
   */
  constructor(options: BaselineManagerOptions = {}) {
    this.baseDir = options.baseDir ? resolve(options.baseDir) : process.cwd();
    this.timingThreshold = options.timingThreshold ?? 10;
    this.memoryThreshold = options.memoryThreshold ?? 20;
  }

  /**
   * Get the baselines directory path
   *
   * @returns Path to the baselines directory
   */
  private getBaselinesDirectory(): string {
    return join(this.baseDir, ".kustomark", "benchmarks", "baselines");
  }

  /**
   * Get the baseline file path for a version
   *
   * @param version - Version identifier
   * @returns Path to the baseline file
   */
  private getBaselineFilePath(version: string): string {
    this.validateVersion(version);
    return join(this.getBaselinesDirectory(), `${version}.json`);
  }

  /**
   * Validate a version identifier
   *
   * Version identifiers must be non-empty and contain only alphanumeric
   * characters, dots, hyphens, and underscores.
   *
   * @param version - Version to validate
   * @throws Error if version is invalid
   */
  private validateVersion(version: string): void {
    if (!version || typeof version !== "string") {
      throw new Error("Version must be a non-empty string");
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(version)) {
      throw new Error(
        "Version must contain only alphanumeric characters, dots, hyphens, and underscores",
      );
    }

    if (version === "latest") {
      throw new Error("'latest' is a reserved name and cannot be used as a version");
    }
  }

  /**
   * Collect current system metadata
   *
   * @returns Baseline metadata for current system
   */
  private collectMetadata(version: string): BaselineMetadata {
    return {
      version,
      timestamp: new Date().toISOString(),
      bunVersion: Bun.version,
      platform: platform(),
      arch: arch(),
      cpuCount: cpus().length,
      totalMemory: totalmem(),
      kustomarkVersion: process.env.KUSTOMARK_VERSION,
    };
  }

  /**
   * Generate and save a baseline for a specific version
   *
   * This will run the complete benchmark suite and save the results as a baseline.
   * You must provide the benchmark results to save.
   *
   * @param version - Version identifier (e.g., 'v0.1.0', 'main', 'feature-x')
   * @param results - Benchmark suite results to save as baseline
   * @throws Error if version is invalid or file operations fail
   *
   * @example
   * ```typescript
   * const manager = new BaselineManager();
   * const results = await runBenchmarkSuite();
   * await manager.generateBaselineForVersion('v1.0.0', results);
   * ```
   */
  async generateBaselineForVersion(version: string, results: BenchmarkSuiteResult): Promise<void> {
    this.validateVersion(version);

    const metadata = this.collectMetadata(version);
    const baseline: BaselineRecord = {
      metadata,
      results,
    };

    // Ensure baselines directory exists
    const baselinesDir = this.getBaselinesDirectory();
    await mkdir(baselinesDir, { recursive: true });

    // Save baseline
    const filePath = this.getBaselineFilePath(version);
    const content = JSON.stringify(baseline, null, 2);
    await writeFile(filePath, content, "utf-8");
  }

  /**
   * Load an existing baseline for a specific version
   *
   * @param version - Version identifier
   * @returns Baseline record or null if not found
   * @throws Error if baseline file is corrupted or invalid
   *
   * @example
   * ```typescript
   * const manager = new BaselineManager();
   * const baseline = await manager.loadBaselineForVersion('v1.0.0');
   * if (baseline) {
   *   console.log(`Loaded baseline from ${baseline.metadata.timestamp}`);
   * }
   * ```
   */
  async loadBaselineForVersion(version: string): Promise<BaselineRecord | null> {
    this.validateVersion(version);

    const filePath = this.getBaselineFilePath(version);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFile(filePath, "utf-8");
      const baseline = JSON.parse(content) as BaselineRecord;

      // Validate the loaded baseline
      if (!baseline.metadata || !baseline.results) {
        throw new Error("Invalid baseline file: missing metadata or results");
      }

      return baseline;
    } catch (error) {
      throw new Error(
        `Failed to load baseline '${version}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compare current benchmark results with a baseline version
   *
   * Detects performance regressions and improvements by comparing timing and
   * memory metrics. Regressions are flagged when:
   * - Timing is >10% slower (configurable via timingThreshold)
   * - Memory usage is >20% higher (configurable via memoryThreshold)
   *
   * @param current - Current benchmark suite results
   * @param baselineVersion - Version identifier of the baseline to compare against
   * @returns Detailed comparison result with regression detection
   * @throws Error if baseline version doesn't exist
   *
   * @example
   * ```typescript
   * const manager = new BaselineManager();
   * const currentResults = await runBenchmarkSuite();
   * const comparison = await manager.compareWithBaseline(currentResults, 'v1.0.0');
   *
   * if (comparison.hasRegressions) {
   *   console.log(`Found ${comparison.regressions.length} timing regressions`);
   *   console.log(`Found ${comparison.memoryRegressions.length} memory regressions`);
   * }
   * ```
   */
  async compareWithBaseline(
    current: BenchmarkSuiteResult,
    baselineVersion: string,
  ): Promise<BaselineComparisonResult> {
    const baselineRecord = await this.loadBaselineForVersion(baselineVersion);

    if (!baselineRecord) {
      throw new Error(`Baseline version '${baselineVersion}' not found`);
    }

    // Get comparisons using existing benchmark-storage utility
    const comparisons = compareResults(baselineRecord.results, current);

    // Detect timing regressions (>threshold% slower)
    const timingRegressions = detectRegressions(comparisons, this.timingThreshold);

    // Detect memory regressions (>threshold% higher memory)
    const memoryRegressions = comparisons.filter(
      (comp) => comp.change.memoryPercent > this.memoryThreshold,
    );

    // Combine all regressions (timing or memory)
    const allRegressions = Array.from(new Set([...timingRegressions, ...memoryRegressions]));

    // Detect improvements (timing is better and memory didn't regress significantly)
    const improvements = comparisons.filter((comp) => {
      // Consider it an improvement if timing improved and memory didn't regress beyond threshold
      const timingImproved = comp.change.meanPercent < 0 || comp.change.medianPercent < 0;
      const memoryNotRegressed = comp.change.memoryPercent <= this.memoryThreshold;
      return timingImproved && memoryNotRegressed;
    });

    const currentMetadata = this.collectMetadata("current");

    const result: BaselineComparisonResult = {
      baselineVersion,
      baselineMetadata: baselineRecord.metadata,
      currentMetadata,
      comparisons,
      regressions: allRegressions,
      improvements,
      memoryRegressions,
      hasRegressions: allRegressions.length > 0,
    };

    // Store last comparison for report generation
    this.lastComparison = result;

    return result;
  }

  /**
   * Get a list of all saved baselines
   *
   * @returns Array of baseline history entries, sorted by timestamp (newest first)
   *
   * @example
   * ```typescript
   * const manager = new BaselineManager();
   * const history = await manager.getBaselineHistory();
   * for (const entry of history) {
   *   console.log(`${entry.version}: ${entry.resultCount} results`);
   * }
   * ```
   */
  async getBaselineHistory(): Promise<BaselineHistoryEntry[]> {
    const baselinesDir = this.getBaselinesDirectory();

    if (!existsSync(baselinesDir)) {
      return [];
    }

    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(baselinesDir);

      const entries: BaselineHistoryEntry[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }

        const version = file.slice(0, -5); // Remove .json extension
        const filePath = join(baselinesDir, file);

        try {
          const baseline = await this.loadBaselineForVersion(version);
          if (baseline) {
            entries.push({
              version: baseline.metadata.version,
              timestamp: baseline.metadata.timestamp,
              filePath,
              resultCount: baseline.results.results.length,
            });
          }
        } catch (_error) {}
      }

      // Sort by timestamp, newest first
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return entries;
    } catch (error) {
      throw new Error(
        `Failed to get baseline history: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Export a baseline comparison report
   *
   * Generates a formatted report from the last comparison result.
   * You must call compareWithBaseline() before exporting a report.
   *
   * @param format - Output format ('json' or 'markdown')
   * @returns Formatted report as a string
   * @throws Error if no comparison has been performed
   *
   * @example
   * ```typescript
   * const manager = new BaselineManager();
   * await manager.compareWithBaseline(currentResults, 'v1.0.0');
   *
   * // Export as JSON
   * const jsonReport = await manager.exportBaselineReport('json');
   * await writeFile('report.json', jsonReport);
   *
   * // Export as Markdown
   * const mdReport = await manager.exportBaselineReport('markdown');
   * console.log(mdReport);
   * ```
   */
  async exportBaselineReport(format: "json" | "markdown"): Promise<string> {
    if (!this.lastComparison) {
      throw new Error("No comparison available. Call compareWithBaseline() first.");
    }

    if (format === "json") {
      return this.exportJsonReport(this.lastComparison);
    } else {
      return this.exportMarkdownReport(this.lastComparison);
    }
  }

  /**
   * Export comparison as JSON
   */
  private exportJsonReport(comparison: BaselineComparisonResult): string {
    return JSON.stringify(comparison, null, 2);
  }

  /**
   * Export comparison as Markdown
   */
  private exportMarkdownReport(comparison: BaselineComparisonResult): string {
    const lines: string[] = [];

    // Title
    lines.push("# Benchmark Comparison Report");
    lines.push("");

    // Metadata
    lines.push("## Metadata");
    lines.push("");
    lines.push(`**Baseline Version:** ${comparison.baselineVersion}`);
    lines.push(`**Baseline Timestamp:** ${comparison.baselineMetadata.timestamp}`);
    lines.push(`**Current Timestamp:** ${comparison.currentMetadata.timestamp}`);
    lines.push("");

    // Environment
    lines.push("### Baseline Environment");
    lines.push("");
    lines.push(`- **Platform:** ${comparison.baselineMetadata.platform}`);
    lines.push(`- **Architecture:** ${comparison.baselineMetadata.arch}`);
    lines.push(`- **Bun Version:** ${comparison.baselineMetadata.bunVersion}`);
    lines.push(`- **CPU Count:** ${comparison.baselineMetadata.cpuCount}`);
    lines.push(`- **Total Memory:** ${this.formatBytes(comparison.baselineMetadata.totalMemory)}`);
    lines.push("");

    lines.push("### Current Environment");
    lines.push("");
    lines.push(`- **Platform:** ${comparison.currentMetadata.platform}`);
    lines.push(`- **Architecture:** ${comparison.currentMetadata.arch}`);
    lines.push(`- **Bun Version:** ${comparison.currentMetadata.bunVersion}`);
    lines.push(`- **CPU Count:** ${comparison.currentMetadata.cpuCount}`);
    lines.push(`- **Total Memory:** ${this.formatBytes(comparison.currentMetadata.totalMemory)}`);
    lines.push("");

    // Summary
    lines.push("## Summary");
    lines.push("");
    lines.push(`- **Total Comparisons:** ${comparison.comparisons.length}`);
    lines.push(`- **Regressions:** ${comparison.regressions.length}`);
    lines.push(`- **Improvements:** ${comparison.improvements.length}`);
    lines.push(`- **Memory Regressions:** ${comparison.memoryRegressions.length}`);
    lines.push(
      `- **Status:** ${comparison.hasRegressions ? "⚠️ REGRESSIONS DETECTED" : "✅ NO REGRESSIONS"}`,
    );
    lines.push("");

    // Regressions
    if (comparison.regressions.length > 0) {
      lines.push("## Regressions");
      lines.push("");
      lines.push("| Operation | Files | Mean Change | Median Change | Memory Change |");
      lines.push("|-----------|-------|-------------|---------------|---------------|");

      for (const regression of comparison.regressions) {
        const meanChange = this.formatPercent(regression.change.meanPercent);
        const medianChange = this.formatPercent(regression.change.medianPercent);
        const memoryChange = this.formatPercent(regression.change.memoryPercent);

        lines.push(
          `| ${regression.operation} | ${regression.fileCount} | ${meanChange} | ${medianChange} | ${memoryChange} |`,
        );
      }

      lines.push("");
    }

    // Improvements
    if (comparison.improvements.length > 0) {
      lines.push("## Improvements");
      lines.push("");
      lines.push("| Operation | Files | Mean Change | Median Change | Memory Change |");
      lines.push("|-----------|-------|-------------|---------------|---------------|");

      for (const improvement of comparison.improvements) {
        const meanChange = this.formatPercent(improvement.change.meanPercent);
        const medianChange = this.formatPercent(improvement.change.medianPercent);
        const memoryChange = this.formatPercent(improvement.change.memoryPercent);

        lines.push(
          `| ${improvement.operation} | ${improvement.fileCount} | ${meanChange} | ${medianChange} | ${memoryChange} |`,
        );
      }

      lines.push("");
    }

    // Detailed Comparisons
    lines.push("## Detailed Comparisons");
    lines.push("");
    lines.push("| Operation | Files | Mean (Baseline) | Mean (Current) | Change |");
    lines.push("|-----------|-------|-----------------|----------------|--------|");

    for (const comp of comparison.comparisons) {
      const baselineMean = this.formatTime(comp.baseline.timing.mean);
      const currentMean = this.formatTime(comp.current.timing.mean);
      const change = this.formatPercent(comp.change.meanPercent);

      lines.push(
        `| ${comp.operation} | ${comp.fileCount} | ${baselineMean} | ${currentMean} | ${change} |`,
      );
    }

    lines.push("");

    return lines.join("\n");
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes >= 1_073_741_824) {
      return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    }
    if (bytes >= 1_048_576) {
      return `${(bytes / 1_048_576).toFixed(2)} MB`;
    }
    if (bytes >= 1_024) {
      return `${(bytes / 1_024).toFixed(2)} KB`;
    }
    return `${bytes} bytes`;
  }

  /**
   * Format nanoseconds to human-readable time
   */
  private formatTime(nanoseconds: number): string {
    if (nanoseconds >= 1_000_000_000) {
      return `${(nanoseconds / 1_000_000_000).toFixed(2)}s`;
    }
    if (nanoseconds >= 1_000_000) {
      return `${(nanoseconds / 1_000_000).toFixed(2)}ms`;
    }
    if (nanoseconds >= 1_000) {
      return `${(nanoseconds / 1_000).toFixed(2)}μs`;
    }
    return `${nanoseconds.toFixed(0)}ns`;
  }

  /**
   * Format percentage with color indicators
   */
  private formatPercent(percent: number): string {
    const sign = percent >= 0 ? "+" : "";
    const formatted = `${sign}${percent.toFixed(2)}%`;

    if (percent > 0) {
      return `🔴 ${formatted}`;
    } else if (percent < 0) {
      return `🟢 ${formatted}`;
    } else {
      return formatted;
    }
  }
}
