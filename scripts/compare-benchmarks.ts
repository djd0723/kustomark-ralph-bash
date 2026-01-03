#!/usr/bin/env bun

/**
 * Compare benchmark results and detect performance regressions
 *
 * This script compares current benchmark results with a baseline and generates
 * a detailed comparison report in JSON and Markdown formats.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BenchmarkComparison, BenchmarkSuiteResult } from "../src/core/types.js";
import { compareResults, detectRegressions } from "../src/core/benchmark-storage.js";

// ============================================================================
// Types
// ============================================================================

interface ComparisonOptions {
  baseline: string;
  current: string;
  threshold: number;
  output?: string;
  markdown?: string;
  format?: "json" | "markdown" | "both";
}

interface ComparisonOutput {
  summary: {
    total: number;
    improvements: number;
    regressions: number;
    unchanged: number;
    criticalRegressions: number;
  };
  comparisons: BenchmarkComparison[];
  regressions: BenchmarkComparison[];
  critical: BenchmarkComparison[];
  improvements: BenchmarkComparison[];
}

// ============================================================================
// Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================================
// Loading and Validation
// ============================================================================

function loadBenchmarkResults(path: string): BenchmarkSuiteResult {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(content);

    // Basic validation
    if (!data.timestamp || !data.environment || !data.results || !data.summary) {
      throw new Error("Invalid benchmark result format");
    }

    return data as BenchmarkSuiteResult;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================================
// Comparison Analysis
// ============================================================================

function analyzeComparisons(
  comparisons: BenchmarkComparison[],
  threshold: number,
): ComparisonOutput {
  const improvements = comparisons.filter((c) => c.change.improvement);
  const regressions = detectRegressions(comparisons, threshold);
  const critical = regressions.filter((c) => c.change.meanPercent > threshold * 2);
  const unchanged = comparisons.length - improvements.length - regressions.length;

  return {
    summary: {
      total: comparisons.length,
      improvements: improvements.length,
      regressions: regressions.length,
      unchanged,
      criticalRegressions: critical.length,
    },
    comparisons,
    regressions,
    critical,
    improvements,
  };
}

// ============================================================================
// Output Formatting - JSON
// ============================================================================

function formatJsonOutput(output: ComparisonOutput): string {
  return JSON.stringify(output, null, 2);
}

// ============================================================================
// Output Formatting - Markdown
// ============================================================================

function formatMarkdownOutput(
  baseline: BenchmarkSuiteResult,
  current: BenchmarkSuiteResult,
  output: ComparisonOutput,
  threshold: number,
): string {
  const lines: string[] = [];

  // Header
  lines.push("## Performance Benchmark Results");
  lines.push("");

  // Summary badges
  if (output.summary.criticalRegressions > 0) {
    lines.push("⚠️ **Critical Performance Regressions Detected**");
  } else if (output.summary.regressions > 0) {
    lines.push("⚡ **Performance Changes Detected**");
  } else if (output.summary.improvements > 0) {
    lines.push("✅ **Performance Improvements Detected**");
  } else {
    lines.push("✅ **No Significant Performance Changes**");
  }
  lines.push("");

  // Summary table
  lines.push("### Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push(`| Total Comparisons | ${output.summary.total} |`);
  lines.push(`| Improvements | ${output.summary.improvements} ✅ |`);
  lines.push(`| Regressions | ${output.summary.regressions} ⚠️ |`);
  lines.push(`| Critical Regressions | ${output.summary.criticalRegressions} 🔴 |`);
  lines.push(`| Unchanged | ${output.summary.unchanged} |`);
  lines.push(`| Threshold | ${threshold}% |`);
  lines.push("");

  // Environment comparison
  lines.push("### Environment");
  lines.push("");
  lines.push("| Aspect | Baseline | Current |");
  lines.push("|--------|----------|---------|");
  lines.push(`| Platform | ${baseline.environment.platform} | ${current.environment.platform} |`);
  lines.push(`| Arch | ${baseline.environment.arch} | ${current.environment.arch} |`);
  lines.push(`| Bun Version | ${baseline.environment.bunVersion} | ${current.environment.bunVersion} |`);
  lines.push(`| CPU Cores | ${baseline.environment.cpuCount} | ${current.environment.cpuCount} |`);
  lines.push(
    `| Memory | ${formatBytes(baseline.environment.totalMemory)} | ${formatBytes(current.environment.totalMemory)} |`,
  );
  lines.push("");

  // Critical regressions
  if (output.critical.length > 0) {
    lines.push("### 🔴 Critical Regressions");
    lines.push("");
    lines.push(
      "These operations show severe performance degradation (>20%) and require immediate attention:",
    );
    lines.push("");
    lines.push("| Operation | Files | Complexity | Mean Change | Memory Change | Baseline | Current |");
    lines.push(
      "|-----------|-------|------------|-------------|---------------|----------|---------|",
    );

    for (const comp of output.critical) {
      const meanChange = formatPercent(comp.change.meanPercent);
      const memChange = formatPercent(comp.change.memoryPercent);
      const baselineTime = formatTime(comp.baseline.timing.mean);
      const currentTime = formatTime(comp.current.timing.mean);

      lines.push(
        `| ${comp.operation} | ${comp.fileCount} | ${comp.current.complexity} | ${meanChange} | ${memChange} | ${baselineTime} | ${currentTime} |`,
      );
    }

    lines.push("");
  }

  // Regular regressions
  if (output.regressions.length > 0 && output.regressions.length !== output.critical.length) {
    lines.push("### ⚠️ Performance Regressions");
    lines.push("");
    lines.push(
      `These operations show performance degradation (>${threshold}%) but below critical threshold:`,
    );
    lines.push("");
    lines.push("| Operation | Files | Complexity | Mean Change | Memory Change | Baseline | Current |");
    lines.push(
      "|-----------|-------|------------|-------------|---------------|----------|---------|",
    );

    for (const comp of output.regressions.filter((c) => !output.critical.includes(c))) {
      const meanChange = formatPercent(comp.change.meanPercent);
      const memChange = formatPercent(comp.change.memoryPercent);
      const baselineTime = formatTime(comp.baseline.timing.mean);
      const currentTime = formatTime(comp.current.timing.mean);

      lines.push(
        `| ${comp.operation} | ${comp.fileCount} | ${comp.current.complexity} | ${meanChange} | ${memChange} | ${baselineTime} | ${currentTime} |`,
      );
    }

    lines.push("");
  }

  // Improvements
  if (output.improvements.length > 0) {
    lines.push("### ✅ Performance Improvements");
    lines.push("");
    lines.push("These operations show improved performance:");
    lines.push("");
    lines.push("| Operation | Files | Complexity | Mean Change | Memory Change | Baseline | Current |");
    lines.push(
      "|-----------|-------|------------|-------------|---------------|----------|---------|",
    );

    for (const comp of output.improvements) {
      const meanChange = formatPercent(comp.change.meanPercent);
      const memChange = formatPercent(comp.change.memoryPercent);
      const baselineTime = formatTime(comp.baseline.timing.mean);
      const currentTime = formatTime(comp.current.timing.mean);

      lines.push(
        `| ${comp.operation} | ${comp.fileCount} | ${comp.current.complexity} | ${meanChange} | ${memChange} | ${baselineTime} | ${currentTime} |`,
      );
    }

    lines.push("");
  }

  // Detailed results table
  lines.push("### Detailed Results");
  lines.push("");
  lines.push(
    "| Operation | Files | Complexity | Mean Time | Median Time | P95 Time | Memory | Throughput | Change |",
  );
  lines.push(
    "|-----------|-------|------------|-----------|-------------|----------|--------|------------|--------|",
  );

  for (const comp of output.comparisons) {
    const { current } = comp;
    const meanChange = formatPercent(comp.change.meanPercent);

    let changeIndicator = "";
    if (output.critical.includes(comp)) {
      changeIndicator = `🔴 ${meanChange}`;
    } else if (output.regressions.includes(comp)) {
      changeIndicator = `⚠️ ${meanChange}`;
    } else if (output.improvements.includes(comp)) {
      changeIndicator = `✅ ${meanChange}`;
    } else {
      changeIndicator = `➖ ${meanChange}`;
    }

    lines.push(
      `| ${current.operation} | ${current.fileCount} | ${current.complexity} | ` +
        `${formatTime(current.timing.mean)} | ${formatTime(current.timing.median)} | ` +
        `${formatTime(current.timing.p95)} | ${formatBytes(current.memory.heapUsed)} | ` +
        `${current.throughput.filesPerSecond.toFixed(0)} files/s | ${changeIndicator} |`,
    );
  }

  lines.push("");

  // Cache performance (if available)
  lines.push("### Cache Performance");
  lines.push("");
  lines.push(
    "Cache performance metrics are tracked across benchmark runs to identify caching efficiency.",
  );
  lines.push("");
  lines.push(
    "| Metric | Baseline | Current | Change |",
  );
  lines.push("|--------|----------|---------|--------|");
  lines.push(
    `| Average Throughput | ${baseline.summary.averageThroughput.toFixed(2)} files/s | ${current.summary.averageThroughput.toFixed(2)} files/s | ${formatPercent(((current.summary.averageThroughput - baseline.summary.averageThroughput) / baseline.summary.averageThroughput) * 100)} |`,
  );
  lines.push(
    `| Total Operations | ${baseline.summary.totalOperations} | ${current.summary.totalOperations} | ${current.summary.totalOperations - baseline.summary.totalOperations} |`,
  );
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("**Baseline:** " + new Date(baseline.timestamp).toISOString());
  lines.push("<br>");
  lines.push("**Current:** " + new Date(current.timestamp).toISOString());

  return lines.join("\n");
}

// ============================================================================
// Console Output
// ============================================================================

function printConsoleOutput(output: ComparisonOutput, threshold: number): void {
  console.log("");
  console.log(colorize("═".repeat(80), "bold"));
  console.log(colorize("Performance Comparison Results", "bold"));
  console.log(colorize("═".repeat(80), "bold"));
  console.log("");

  // Summary
  console.log(colorize("Summary:", "bold"));
  console.log(`  Total Comparisons:      ${output.summary.total}`);
  console.log(
    `  Improvements:           ${colorize(String(output.summary.improvements), "green")}`,
  );
  console.log(
    `  Regressions:            ${colorize(String(output.summary.regressions), output.summary.regressions > 0 ? "yellow" : "green")}`,
  );
  console.log(
    `  Critical Regressions:   ${colorize(String(output.summary.criticalRegressions), output.summary.criticalRegressions > 0 ? "red" : "green")}`,
  );
  console.log(`  Unchanged:              ${output.summary.unchanged}`);
  console.log(`  Threshold:              ${threshold}%`);
  console.log("");

  // Critical regressions
  if (output.critical.length > 0) {
    console.log(colorize("🔴 Critical Regressions:", "red"));
    for (const comp of output.critical) {
      console.log(
        `  ${comp.operation} (${comp.fileCount} files): ${colorize(formatPercent(comp.change.meanPercent), "red")}`,
      );
      console.log(
        `    Baseline: ${formatTime(comp.baseline.timing.mean)} → Current: ${formatTime(comp.current.timing.mean)}`,
      );
    }
    console.log("");
  }

  // Regular regressions
  if (output.regressions.length > 0 && output.regressions.length !== output.critical.length) {
    console.log(colorize("⚠️  Performance Regressions:", "yellow"));
    for (const comp of output.regressions.filter((c) => !output.critical.includes(c))) {
      console.log(
        `  ${comp.operation} (${comp.fileCount} files): ${colorize(formatPercent(comp.change.meanPercent), "yellow")}`,
      );
    }
    console.log("");
  }

  // Improvements
  if (output.improvements.length > 0) {
    console.log(colorize("✅ Performance Improvements:", "green"));
    for (const comp of output.improvements) {
      console.log(
        `  ${comp.operation} (${comp.fileCount} files): ${colorize(formatPercent(comp.change.meanPercent), "green")}`,
      );
    }
    console.log("");
  }

  console.log(colorize("═".repeat(80), "bold"));
  console.log("");
}

// ============================================================================
// Main Function
// ============================================================================

function parseArgs(): ComparisonOptions {
  const args = process.argv.slice(2);
  const options: Partial<ComparisonOptions> = {
    threshold: 10, // Default 10% threshold
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--baseline":
      case "-b":
        options.baseline = args[++i];
        break;
      case "--current":
      case "-c":
        options.current = args[++i];
        break;
      case "--threshold":
      case "-t":
        options.threshold = Number.parseFloat(args[++i] ?? "10");
        break;
      case "--output":
      case "-o":
        options.output = args[++i];
        break;
      case "--markdown":
      case "-m":
        options.markdown = args[++i];
        break;
      case "--format":
      case "-f":
        options.format = args[++i] as "json" | "markdown" | "both";
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: compare-benchmarks.ts [options]

Compare benchmark results and detect performance regressions.

Options:
  -b, --baseline <file>    Baseline benchmark results file (required)
  -c, --current <file>     Current benchmark results file (required)
  -t, --threshold <num>    Regression threshold percentage (default: 10)
  -o, --output <file>      Output JSON file (optional)
  -m, --markdown <file>    Output Markdown file (optional)
  -f, --format <format>    Output format: json|markdown|both (default: both)
  -h, --help               Show this help message

Examples:
  compare-benchmarks.ts -b baseline.json -c current.json
  compare-benchmarks.ts -b baseline.json -c current.json -t 5 -o comparison.json
  compare-benchmarks.ts -b baseline.json -c current.json -m report.md
        `);
        process.exit(0);
        break;
    }
  }

  if (!options.baseline || !options.current) {
    console.error(colorize("Error: --baseline and --current are required", "red"));
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  return options as ComparisonOptions;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();

    // Load benchmark results
    console.error(colorize("Loading benchmark results...", "cyan"));
    const baseline = loadBenchmarkResults(options.baseline);
    const current = loadBenchmarkResults(options.current);

    // Compare results
    console.error(colorize("Comparing results...", "cyan"));
    const comparisons = compareResults(baseline, current);
    const output = analyzeComparisons(comparisons, options.threshold);

    // Print to console
    printConsoleOutput(output, options.threshold);

    // Save JSON output
    if (options.output || options.format === "json" || options.format === "both") {
      const jsonOutput = formatJsonOutput(output);
      const jsonPath = options.output || "comparison.json";
      writeFileSync(jsonPath, jsonOutput, "utf-8");
      console.error(colorize(`✓ JSON output written to: ${jsonPath}`, "green"));
    }

    // Save Markdown output
    if (options.markdown || options.format === "markdown" || options.format === "both") {
      const markdownOutput = formatMarkdownOutput(baseline, current, output, options.threshold);
      const markdownPath = options.markdown || "comparison.md";
      writeFileSync(markdownPath, markdownOutput, "utf-8");
      console.error(colorize(`✓ Markdown output written to: ${markdownPath}`, "green"));
    }

    // Exit with error code if critical regressions found
    if (output.summary.criticalRegressions > 0) {
      console.error("");
      console.error(colorize("❌ Critical performance regressions detected!", "red"));
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error(colorize("Error:", "red"), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
