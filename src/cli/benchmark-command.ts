/**
 * CLI command for benchmarking kustomark performance
 * Provides comprehensive performance testing with baseline comparison
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  BenchmarkComparison,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkSuiteResult,
  PatchOperation,
} from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface BenchmarkCommandOptions {
  operations?: string; // Comma-separated operations to benchmark
  fileCounts?: string; // File counts to test (default: 10,50,100)
  complexity?: "simple" | "medium" | "complex"; // Complexity level
  warmup?: number; // Warmup runs (default: 3)
  runs?: number; // Benchmark runs (default: 10)
  format?: "text" | "json" | "markdown"; // Output format
  output?: string; // Output file
  baseline?: string; // Compare with this baseline
  saveBaseline?: string; // Save results as baseline
}

interface BaselineData {
  name: string;
  timestamp: string;
  result: BenchmarkSuiteResult;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FILE_COUNTS = [10, 50, 100];
const DEFAULT_WARMUP_RUNS = 3;
const DEFAULT_BENCHMARK_RUNS = 10;
const DEFAULT_COMPLEXITY = "medium";

const BASELINE_DIR = ".kustomark/benchmarks";

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
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// Benchmark Execution
// ============================================================================

/**
 * Generate test data for benchmarking
 */
function generateTestData(
  fileCount: number,
  complexity: "simple" | "medium" | "complex",
): Map<string, string> {
  const files = new Map<string, string>();

  for (let i = 0; i < fileCount; i++) {
    const fileName = `test-file-${i}.md`;
    let content = `# Test File ${i}\n\n`;

    switch (complexity) {
      case "simple":
        content += `This is a simple test file.\n\n`;
        content += `## Section 1\n\nSome content here.\n`;
        break;

      case "medium":
        content += `This is a medium complexity test file.\n\n`;
        for (let j = 0; j < 5; j++) {
          content += `## Section ${j + 1}\n\n`;
          content += `Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n`;
          content += `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n`;
        }
        break;

      case "complex":
        content += `This is a complex test file with nested structures.\n\n`;
        for (let j = 0; j < 10; j++) {
          content += `## Section ${j + 1}\n\n`;
          content += `### Subsection ${j + 1}.1\n\n`;
          content += `Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n`;
          content += `\`\`\`javascript\n`;
          content += `function example() {\n`;
          content += `  return "test";\n`;
          content += `}\n`;
          content += `\`\`\`\n\n`;
          content += `### Subsection ${j + 1}.2\n\n`;
          content += `More content with **bold** and *italic* text.\n\n`;
        }
        break;
    }

    files.set(fileName, content);
  }

  return files;
}

/**
 * Generate patch operations based on operation type
 */
function generatePatchOperations(operation: string): PatchOperation[] {
  const patches: PatchOperation[] = [];

  switch (operation) {
    case "append":
      patches.push({
        op: "append-to-section",
        id: "section-1",
        content: "\n\nAppended content for benchmarking.\n",
      });
      break;

    case "prepend":
      patches.push({
        op: "prepend-to-section",
        id: "section-1",
        content: "Prepended content for benchmarking.\n\n",
      });
      break;

    case "replace":
      patches.push({
        op: "replace",
        old: "Lorem ipsum",
        new: "Replaced content",
      });
      break;

    case "replace-section":
      patches.push({
        op: "replace-section",
        id: "section-1",
        content: "## Section 1\n\nReplaced section content.\n",
      });
      break;

    case "insert-before":
      patches.push({
        op: "insert-before-line",
        match: "## Section 1",
        content: "## New Section\n\nInserted before Section 1.\n\n",
      });
      break;

    case "insert-after":
      patches.push({
        op: "insert-after-line",
        match: "## Section 1",
        content: "\n## New Section\n\nInserted after Section 1.\n",
      });
      break;

    case "delete-section":
      patches.push({
        op: "remove-section",
        id: "section-1",
      });
      break;

    case "regex":
      patches.push({
        op: "replace-regex",
        pattern: "Lorem ipsum",
        replacement: "Replaced text",
      });
      break;

    default:
      // Default to append
      patches.push({
        op: "append-to-section",
        id: "section-1",
        content: "\n\nDefault appended content.\n",
      });
  }

  return patches;
}

/**
 * Run a single benchmark
 */
async function runSingleBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const { applyPatches } = await import("../core/patch-engine.js");

  // Generate test data
  const files = generateTestData(config.fileCount, config.complexity);

  // Warmup runs
  for (let i = 0; i < config.warmupRuns; i++) {
    for (const [_path, content] of files) {
      applyPatches(content, config.operations, "warn", false);
    }
  }

  // Benchmark runs
  const timings: number[] = [];
  const memoryUsage: { heapUsed: number; heapTotal: number; external: number; rss: number }[] = [];

  for (let i = 0; i < config.benchmarkRuns; i++) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    for (const [_path, content] of files) {
      applyPatches(content, config.operations, "warn", false);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    timings.push(endTime - startTime);
    memoryUsage.push({
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external,
      rss: endMemory.rss - startMemory.rss,
    });
  }

  // Calculate statistics
  const sortedTimings = [...timings].sort((a, b) => a - b);
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
  const median = sortedTimings[Math.floor(sortedTimings.length / 2)] || 0;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const p95 = sortedTimings[Math.floor(sortedTimings.length * 0.95)] || 0;
  const p99 = sortedTimings[Math.floor(sortedTimings.length * 0.99)] || 0;
  const stdDev = Math.sqrt(timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length);

  const avgHeapUsed = memoryUsage.reduce((sum, m) => sum + m.heapUsed, 0) / memoryUsage.length;
  const avgHeapTotal = memoryUsage.reduce((sum, m) => sum + m.heapTotal, 0) / memoryUsage.length;
  const avgExternal = memoryUsage.reduce((sum, m) => sum + m.external, 0) / memoryUsage.length;
  const avgRss = memoryUsage.reduce((sum, m) => sum + m.rss, 0) / memoryUsage.length;

  // Calculate total bytes processed (approximate)
  const totalBytes = Array.from(files.values()).reduce((sum, content) => sum + content.length, 0);

  return {
    operation: config.name,
    fileCount: config.fileCount,
    complexity: config.complexity,
    runs: config.benchmarkRuns,
    timing: {
      mean,
      median,
      min,
      max,
      p95,
      p99,
      stdDev,
    },
    memory: {
      heapUsed: avgHeapUsed,
      heapTotal: avgHeapTotal,
      external: avgExternal,
      rss: avgRss,
    },
    throughput: {
      filesPerSecond: (config.fileCount * 1000) / mean,
      operationsPerSecond: (config.fileCount * config.operations.length * 1000) / mean,
      bytesPerSecond: (totalBytes * 1000) / mean,
    },
  };
}

/**
 * Run benchmark suite
 */
async function runBenchmarkSuite(
  operations: string[],
  fileCounts: number[],
  complexity: "simple" | "medium" | "complex",
  warmupRuns: number,
  benchmarkRuns: number,
): Promise<BenchmarkSuiteResult> {
  const results: BenchmarkResult[] = [];
  const startTime = performance.now();

  for (const operation of operations) {
    for (const fileCount of fileCounts) {
      console.error(
        colorize(
          `Running benchmark: ${operation} (${fileCount} files, ${complexity} complexity)...`,
          "cyan",
        ),
      );

      const config: BenchmarkConfig = {
        name: operation,
        description: `Benchmark ${operation} operation`,
        fileCount,
        operations: generatePatchOperations(operation),
        complexity,
        warmupRuns,
        benchmarkRuns,
      };

      const result = await runSingleBenchmark(config);
      results.push(result);

      console.error(
        colorize(
          `  Completed: ${result.timing.mean.toFixed(2)}ms (${result.throughput.filesPerSecond.toFixed(2)} files/s)`,
          "dim",
        ),
      );
    }
  }

  const endTime = performance.now();
  const totalDuration = endTime - startTime;
  const totalOperations = results.reduce((sum, r) => sum + r.fileCount * r.runs, 0);
  const averageThroughput =
    results.reduce((sum, r) => sum + r.throughput.filesPerSecond, 0) / results.length;

  return {
    timestamp: new Date().toISOString(),
    environment: {
      platform: platform(),
      arch: arch(),
      bunVersion: Bun.version,
      cpuCount: cpus().length,
      totalMemory: totalmem(),
    },
    results,
    summary: {
      totalDuration,
      totalOperations,
      averageThroughput,
    },
  };
}

// ============================================================================
// Baseline Management
// ============================================================================

/**
 * Get baseline file path
 */
function getBaselinePath(name: string): string {
  return join(BASELINE_DIR, `${name}.json`);
}

/**
 * Save benchmark results as baseline
 */
function saveBaseline(name: string, result: BenchmarkSuiteResult): void {
  if (!existsSync(BASELINE_DIR)) {
    mkdirSync(BASELINE_DIR, { recursive: true });
  }

  const baseline: BaselineData = {
    name,
    timestamp: new Date().toISOString(),
    result,
  };

  const baselinePath = getBaselinePath(name);
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

  console.error(colorize(`Baseline saved: ${name}`, "green"));
}

/**
 * Load baseline data
 */
function loadBaseline(name: string): BaselineData | null {
  const baselinePath = getBaselinePath(name);

  if (!existsSync(baselinePath)) {
    return null;
  }

  const content = readFileSync(baselinePath, "utf-8");
  return JSON.parse(content) as BaselineData;
}

/**
 * List available baselines
 */
function listBaselines(): BaselineData[] {
  if (!existsSync(BASELINE_DIR)) {
    return [];
  }

  const files = readdirSync(BASELINE_DIR).filter((f) => f.endsWith(".json"));
  const baselines: BaselineData[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(BASELINE_DIR, file), "utf-8");
      const baseline = JSON.parse(content) as BaselineData;
      baselines.push(baseline);
    } catch {
      // Skip invalid baseline files
    }
  }

  return baselines.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Compare benchmark results with baseline
 */
function compareWithBaseline(
  current: BenchmarkSuiteResult,
  baseline: BenchmarkSuiteResult,
): BenchmarkComparison[] {
  const comparisons: BenchmarkComparison[] = [];

  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find(
      (r) => r.operation === currentResult.operation && r.fileCount === currentResult.fileCount,
    );

    if (!baselineResult) {
      continue;
    }

    const meanPercent =
      ((currentResult.timing.mean - baselineResult.timing.mean) / baselineResult.timing.mean) * 100;
    const medianPercent =
      ((currentResult.timing.median - baselineResult.timing.median) /
        baselineResult.timing.median) *
      100;
    const memoryPercent =
      ((currentResult.memory.heapUsed - baselineResult.memory.heapUsed) /
        baselineResult.memory.heapUsed) *
      100;

    const regression = meanPercent > 10 || memoryPercent > 20; // 10% slower or 20% more memory
    const improvement = meanPercent < -10 || memoryPercent < -20; // 10% faster or 20% less memory

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

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format benchmark results as text
 */
function formatText(result: BenchmarkSuiteResult, comparison?: BenchmarkComparison[]): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(colorize("=".repeat(80), "bold"));
  lines.push(colorize("Benchmark Results", "bold"));
  lines.push(colorize("=".repeat(80), "bold"));
  lines.push("");

  // Environment info
  lines.push(colorize("Environment:", "bold"));
  lines.push(`  Platform: ${result.environment.platform} (${result.environment.arch})`);
  lines.push(`  Bun Version: ${result.environment.bunVersion}`);
  lines.push(`  CPU Cores: ${result.environment.cpuCount}`);
  lines.push(
    `  Total Memory: ${(result.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
  );
  lines.push(`  Timestamp: ${result.timestamp}`);
  lines.push("");

  // Results table
  lines.push(colorize("Results:", "bold"));
  lines.push("");

  // Group by operation
  const groupedResults = new Map<string, BenchmarkResult[]>();
  for (const r of result.results) {
    if (!groupedResults.has(r.operation)) {
      groupedResults.set(r.operation, []);
    }
    groupedResults.get(r.operation)?.push(r);
  }

  for (const [operation, results] of groupedResults) {
    lines.push(colorize(`  ${operation}:`, "cyan"));

    for (const r of results) {
      const comp = comparison?.find(
        (c) => c.operation === r.operation && c.fileCount === r.fileCount,
      );

      let suffix = "";
      if (comp) {
        if (comp.change.improvement) {
          suffix = colorize(` (${comp.change.meanPercent.toFixed(1)}% faster)`, "green");
        } else if (comp.change.regression) {
          suffix = colorize(` (${comp.change.meanPercent.toFixed(1)}% slower)`, "red");
        } else {
          suffix = colorize(` (${comp.change.meanPercent.toFixed(1)}%)`, "dim");
        }
      }

      lines.push(
        `    ${r.fileCount} files (${r.complexity}): ` +
          `${r.timing.mean.toFixed(2)}ms ` +
          `(median: ${r.timing.median.toFixed(2)}ms, ` +
          `p95: ${r.timing.p95.toFixed(2)}ms)${suffix}`,
      );

      lines.push(
        `      Throughput: ${r.throughput.filesPerSecond.toFixed(2)} files/s, ` +
          `${r.throughput.operationsPerSecond.toFixed(2)} ops/s`,
      );

      lines.push(
        `      Memory: ${(r.memory.heapUsed / 1024 / 1024).toFixed(2)} MB heap, ` +
          `${(r.memory.rss / 1024 / 1024).toFixed(2)} MB RSS`,
      );

      lines.push("");
    }
  }

  // Summary
  lines.push(colorize("Summary:", "bold"));
  lines.push(`  Total Duration: ${(result.summary.totalDuration / 1000).toFixed(2)}s`);
  lines.push(`  Total Operations: ${result.summary.totalOperations}`);
  lines.push(`  Average Throughput: ${result.summary.averageThroughput.toFixed(2)} files/s`);
  lines.push("");

  // Comparison summary
  if (comparison && comparison.length > 0) {
    lines.push(colorize("Baseline Comparison:", "bold"));
    const improvements = comparison.filter((c) => c.change.improvement).length;
    const regressions = comparison.filter((c) => c.change.regression).length;
    const unchanged = comparison.length - improvements - regressions;

    lines.push(`  Improvements: ${colorize(String(improvements), "green")}`);
    lines.push(`  Regressions: ${colorize(String(regressions), "red")}`);
    lines.push(`  Unchanged: ${unchanged}`);
    lines.push("");

    if (regressions > 0) {
      lines.push(colorize("  Regressions detected:", "yellow"));
      for (const comp of comparison.filter((c) => c.change.regression)) {
        lines.push(
          `    ${comp.operation} (${comp.fileCount} files): ` +
            colorize(`+${comp.change.meanPercent.toFixed(1)}%`, "red"),
        );
      }
      lines.push("");
    }
  }

  lines.push(colorize("=".repeat(80), "bold"));
  lines.push("");

  return lines.join("\n");
}

/**
 * Format benchmark results as JSON
 */
function formatJson(result: BenchmarkSuiteResult, comparison?: BenchmarkComparison[]): string {
  const output = {
    ...result,
    comparison: comparison || null,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Format benchmark results as Markdown
 */
function formatMarkdown(result: BenchmarkSuiteResult, comparison?: BenchmarkComparison[]): string {
  const lines: string[] = [];

  lines.push("# Benchmark Results");
  lines.push("");
  lines.push(`**Timestamp:** ${result.timestamp}`);
  lines.push("");

  // Environment
  lines.push("## Environment");
  lines.push("");
  lines.push(`- **Platform:** ${result.environment.platform} (${result.environment.arch})`);
  lines.push(`- **Bun Version:** ${result.environment.bunVersion}`);
  lines.push(`- **CPU Cores:** ${result.environment.cpuCount}`);
  lines.push(
    `- **Total Memory:** ${(result.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
  );
  lines.push("");

  // Results
  lines.push("## Results");
  lines.push("");

  // Group by operation
  const groupedResults = new Map<string, BenchmarkResult[]>();
  for (const r of result.results) {
    if (!groupedResults.has(r.operation)) {
      groupedResults.set(r.operation, []);
    }
    groupedResults.get(r.operation)?.push(r);
  }

  for (const [operation, results] of groupedResults) {
    lines.push(`### ${operation}`);
    lines.push("");
    lines.push(
      "| Files | Complexity | Mean (ms) | Median (ms) | P95 (ms) | Files/s | Ops/s | Memory (MB) |",
    );
    lines.push(
      "|-------|------------|-----------|-------------|----------|---------|-------|-------------|",
    );

    for (const r of results) {
      const comp = comparison?.find(
        (c) => c.operation === r.operation && c.fileCount === r.fileCount,
      );

      let meanCell = r.timing.mean.toFixed(2);
      if (comp) {
        if (comp.change.improvement) {
          meanCell += ` ✓ (${comp.change.meanPercent.toFixed(1)}%)`;
        } else if (comp.change.regression) {
          meanCell += ` ⚠ (+${comp.change.meanPercent.toFixed(1)}%)`;
        }
      }

      lines.push(
        `| ${r.fileCount} | ${r.complexity} | ${meanCell} | ${r.timing.median.toFixed(2)} | ` +
          `${r.timing.p95.toFixed(2)} | ${r.throughput.filesPerSecond.toFixed(2)} | ` +
          `${r.throughput.operationsPerSecond.toFixed(2)} | ${(r.memory.heapUsed / 1024 / 1024).toFixed(2)} |`,
      );
    }

    lines.push("");
  }

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total Duration:** ${(result.summary.totalDuration / 1000).toFixed(2)}s`);
  lines.push(`- **Total Operations:** ${result.summary.totalOperations}`);
  lines.push(`- **Average Throughput:** ${result.summary.averageThroughput.toFixed(2)} files/s`);
  lines.push("");

  // Comparison
  if (comparison && comparison.length > 0) {
    lines.push("## Baseline Comparison");
    lines.push("");

    const improvements = comparison.filter((c) => c.change.improvement).length;
    const regressions = comparison.filter((c) => c.change.regression).length;
    const unchanged = comparison.length - improvements - regressions;

    lines.push(`- **Improvements:** ${improvements}`);
    lines.push(`- **Regressions:** ${regressions}`);
    lines.push(`- **Unchanged:** ${unchanged}`);
    lines.push("");

    if (regressions > 0) {
      lines.push("### Regressions");
      lines.push("");
      lines.push("| Operation | Files | Change |");
      lines.push("|-----------|-------|--------|");

      for (const comp of comparison.filter((c) => c.change.regression)) {
        lines.push(
          `| ${comp.operation} | ${comp.fileCount} | +${comp.change.meanPercent.toFixed(1)}% |`,
        );
      }

      lines.push("");
    }

    if (improvements > 0) {
      lines.push("### Improvements");
      lines.push("");
      lines.push("| Operation | Files | Change |");
      lines.push("|-----------|-------|--------|");

      for (const comp of comparison.filter((c) => c.change.improvement)) {
        lines.push(
          `| ${comp.operation} | ${comp.fileCount} | ${comp.change.meanPercent.toFixed(1)}% |`,
        );
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Handle benchmark run command
 */
async function handleRunCommand(options: BenchmarkCommandOptions): Promise<number> {
  const operations = options.operations
    ? options.operations.split(",").map((s) => s.trim())
    : ["append", "prepend", "replace", "replace-section"];

  const fileCounts = options.fileCounts
    ? options.fileCounts.split(",").map((s) => parseInt(s.trim(), 10))
    : DEFAULT_FILE_COUNTS;

  const complexity = options.complexity || DEFAULT_COMPLEXITY;
  const warmup = options.warmup ?? DEFAULT_WARMUP_RUNS;
  const runs = options.runs ?? DEFAULT_BENCHMARK_RUNS;
  const format = options.format || "text";

  console.error(colorize("\nStarting benchmark suite...", "bold"));
  console.error(`Operations: ${operations.join(", ")}`);
  console.error(`File counts: ${fileCounts.join(", ")}`);
  console.error(`Complexity: ${complexity}`);
  console.error(`Warmup runs: ${warmup}`);
  console.error(`Benchmark runs: ${runs}`);
  console.error("");

  const result = await runBenchmarkSuite(operations, fileCounts, complexity, warmup, runs);

  // Compare with baseline if specified
  let comparison: BenchmarkComparison[] | undefined;
  if (options.baseline) {
    const baseline = loadBaseline(options.baseline);
    if (baseline) {
      comparison = compareWithBaseline(result, baseline.result);
      console.error(colorize(`Comparing with baseline: ${options.baseline}`, "cyan"));
      console.error("");
    } else {
      console.error(colorize(`Warning: Baseline not found: ${options.baseline}`, "yellow"));
      console.error("");
    }
  }

  // Format and output results
  let output: string;
  switch (format) {
    case "json":
      output = formatJson(result, comparison);
      break;
    case "markdown":
      output = formatMarkdown(result, comparison);
      break;
    default:
      output = formatText(result, comparison);
  }

  if (options.output) {
    const outputPath = resolve(options.output);
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    writeFileSync(outputPath, output);
    console.error(colorize(`Results written to: ${outputPath}`, "green"));
  } else {
    console.log(output);
  }

  // Save as baseline if specified
  if (options.saveBaseline) {
    saveBaseline(options.saveBaseline, result);
  }

  return 0;
}

/**
 * Handle benchmark baseline command
 */
function handleBaselineCommand(args: string[]): number {
  const nameIndex = args.indexOf("--name");
  if (nameIndex === -1 || nameIndex === args.length - 1) {
    console.error(colorize("Error: --name is required for baseline command", "red"));
    return 1;
  }

  const name = args[nameIndex + 1];

  // This would be called after a run, but for now we'll just show an error
  console.error(
    colorize("Error: Use --save-baseline with the run command to save a baseline", "yellow"),
  );
  console.error(`Example: kustomark benchmark run --save-baseline ${name}`);

  return 1;
}

/**
 * Handle benchmark compare command
 */
function handleCompareCommand(args: string[]): number {
  const baselineIndex = args.indexOf("--baseline");
  if (baselineIndex === -1 || baselineIndex === args.length - 1) {
    console.error(colorize("Error: --baseline is required for compare command", "red"));
    return 1;
  }

  const baselineName = args[baselineIndex + 1];

  console.error(
    colorize("Error: Use --baseline with the run command to compare with a baseline", "yellow"),
  );
  console.error(`Example: kustomark benchmark run --baseline ${baselineName}`);

  return 1;
}

/**
 * Handle benchmark list command
 */
function handleListCommand(): number {
  const baselines = listBaselines();

  if (baselines.length === 0) {
    console.log("No baselines found.");
    return 0;
  }

  console.log("");
  console.log(colorize("Available Baselines:", "bold"));
  console.log("");

  for (const baseline of baselines) {
    const date = new Date(baseline.timestamp);
    const resultCount = baseline.result.results.length;

    console.log(colorize(`  ${baseline.name}`, "cyan"));
    console.log(`    Date: ${date.toLocaleString()}`);
    console.log(`    Results: ${resultCount}`);
    console.log(
      `    Platform: ${baseline.result.environment.platform} (${baseline.result.environment.arch})`,
    );
    console.log(`    Bun: ${baseline.result.environment.bunVersion}`);
    console.log("");
  }

  return 0;
}

// ============================================================================
// Main Command Handler
// ============================================================================

/**
 * Main benchmark command handler
 */
export async function handleBenchmarkCommand(args: string[]): Promise<number> {
  const subcommand = args[0];

  try {
    let exitCode = 0;

    if (!subcommand || subcommand === "run" || subcommand.startsWith("-")) {
      // Parse run options
      const options: BenchmarkCommandOptions = {};

      for (let i = subcommand === "run" ? 1 : 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
          case "--operations":
            options.operations = args[++i] ?? "";
            break;
          case "--file-counts":
            options.fileCounts = args[++i] ?? "";
            break;
          case "--complexity":
            options.complexity = (args[++i] ?? "medium") as "simple" | "medium" | "complex";
            break;
          case "--warmup":
            options.warmup = parseInt(args[++i] ?? "0", 10);
            break;
          case "--runs":
            options.runs = parseInt(args[++i] ?? "0", 10);
            break;
          case "--format":
            options.format = (args[++i] ?? "text") as "text" | "json" | "markdown";
            break;
          case "--output":
            options.output = args[++i] ?? "";
            break;
          case "--baseline":
            options.baseline = args[++i] ?? "";
            break;
          case "--save-baseline":
            options.saveBaseline = args[++i] ?? "";
            break;
        }
      }

      exitCode = await handleRunCommand(options);
    } else if (subcommand === "baseline") {
      exitCode = handleBaselineCommand(args.slice(1));
    } else if (subcommand === "compare") {
      exitCode = handleCompareCommand(args.slice(1));
    } else if (subcommand === "list") {
      exitCode = handleListCommand();
    } else {
      console.error(colorize(`Unknown subcommand: ${subcommand}`, "red"));
      console.error("");
      console.error("Usage:");
      console.error("  kustomark benchmark run [options]");
      console.error("  kustomark benchmark baseline --name <name>");
      console.error("  kustomark benchmark compare --baseline <name>");
      console.error("  kustomark benchmark list");
      exitCode = 1;
    }

    return exitCode;
  } catch (error) {
    console.error(
      colorize("Error:", "red"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
