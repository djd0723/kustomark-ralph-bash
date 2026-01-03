#!/usr/bin/env bun

/**
 * Run benchmark suite for kustomark performance testing
 *
 * This script runs predefined benchmark suites (quick or full) and outputs
 * results in JSON format for baseline comparison.
 */

import { writeFileSync } from "node:fs";
import { arch, cpus, platform, totalmem } from "node:os";
import { resolve } from "node:path";
import { generateTestContent, runBenchmark } from "../src/core/benchmark-engine.js";
import type {
  BenchmarkConfig as EngineBenchmarkConfig,
  BenchmarkResult as EngineBenchmarkResult,
} from "../src/core/benchmark-engine.js";
import type { BenchmarkSuiteResult, PatchOperation } from "../src/core/types.js";

// ============================================================================
// Types
// ============================================================================

interface RunnerOptions {
  suite: "quick" | "full" | "custom";
  operations?: string[];
  fileCounts?: number[];
  complexity?: Array<"simple" | "medium" | "complex">;
  runs: number;
  warmup: number;
  output?: string;
}

interface BenchmarkSpec {
  name: string;
  operation: string;
  fileCount: number;
  complexity: "simple" | "medium" | "complex";
  patches: PatchOperation[];
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

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// Benchmark Specifications
// ============================================================================

/**
 * Get quick benchmark suite (for PRs)
 */
function getQuickSuite(): BenchmarkSpec[] {
  return [
    {
      name: "replace",
      operation: "replace",
      fileCount: 10,
      complexity: "simple",
      patches: [{ op: "replace", old: "Test Author", new: "Updated Author" }],
    },
    {
      name: "replace",
      operation: "replace",
      fileCount: 50,
      complexity: "medium",
      patches: [{ op: "replace", old: "Test Author", new: "Updated Author" }],
    },
    {
      name: "replace",
      operation: "replace",
      fileCount: 100,
      complexity: "complex",
      patches: [{ op: "replace", old: "Test Author", new: "Updated Author" }],
    },
    {
      name: "append-to-section",
      operation: "append-to-section",
      fileCount: 10,
      complexity: "simple",
      patches: [
        {
          op: "append-to-section",
          id: "introduction",
          content: "\nAppended content for benchmarking.\n",
        },
      ],
    },
    {
      name: "append-to-section",
      operation: "append-to-section",
      fileCount: 50,
      complexity: "medium",
      patches: [
        {
          op: "append-to-section",
          id: "introduction",
          content: "\nAppended content for benchmarking.\n",
        },
      ],
    },
    {
      name: "replace-section",
      operation: "replace-section",
      fileCount: 10,
      complexity: "medium",
      patches: [
        {
          op: "replace-section",
          id: "section-one",
          content: "This is the new content for section one.",
        },
      ],
    },
  ];
}

/**
 * Get full benchmark suite (for main branch)
 */
function getFullSuite(): BenchmarkSpec[] {
  const specs: BenchmarkSpec[] = [];
  const fileCounts = [10, 50, 100];
  const complexities: Array<"simple" | "medium" | "complex"> = ["simple", "medium", "complex"];

  // Replace operation
  for (const fileCount of fileCounts) {
    for (const complexity of complexities) {
      specs.push({
        name: "replace",
        operation: "replace",
        fileCount,
        complexity,
        patches: [{ op: "replace", old: "Test Author", new: "Updated Author" }],
      });
    }
  }

  // Append operation
  for (const fileCount of fileCounts) {
    for (const complexity of complexities) {
      specs.push({
        name: "append-to-section",
        operation: "append-to-section",
        fileCount,
        complexity,
        patches: [
          {
            op: "append-to-section",
            id: "introduction",
            content: "\nAppended content for benchmarking.\n",
          },
        ],
      });
    }
  }

  // Replace section operation
  for (const fileCount of [10, 50]) {
    for (const complexity of ["medium", "complex"] as const) {
      specs.push({
        name: "replace-section",
        operation: "replace-section",
        fileCount,
        complexity,
        patches: [
          {
            op: "replace-section",
            id: "section-one",
            content: "This is the new content for section one.",
          },
        ],
      });
    }
  }

  // Regex replace operation
  for (const fileCount of [10, 50, 100]) {
    specs.push({
      name: "replace-regex",
      operation: "replace-regex",
      fileCount,
      complexity: "medium",
      patches: [
        {
          op: "replace-regex",
          pattern: "Document \\d+",
          replacement: "Document Updated",
          flags: "g",
        },
      ],
    });
  }

  // Frontmatter operations
  for (const fileCount of [10, 50]) {
    specs.push({
      name: "set-frontmatter",
      operation: "set-frontmatter",
      fileCount,
      complexity: "medium",
      patches: [{ op: "set-frontmatter", key: "version", value: "2.0.0" }],
    });
  }

  return specs;
}

// ============================================================================
// Benchmark Execution
// ============================================================================

/**
 * Convert engine result to suite result format
 */
function convertResult(
  spec: BenchmarkSpec,
  engineResult: EngineBenchmarkResult,
  runs: number,
): {
  operation: string;
  fileCount: number;
  complexity: string;
  runs: number;
  timing: {
    mean: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  throughput: {
    filesPerSecond: number;
    operationsPerSecond: number;
    bytesPerSecond: number;
  };
} {
  return {
    operation: spec.operation,
    fileCount: spec.fileCount,
    complexity: spec.complexity,
    runs,
    timing: {
      mean: engineResult.timing.statistics.mean / 1_000_000, // Convert ns to ms
      median: engineResult.timing.statistics.median / 1_000_000,
      min: engineResult.timing.statistics.min / 1_000_000,
      max: engineResult.timing.statistics.max / 1_000_000,
      p95: engineResult.timing.statistics.p95 / 1_000_000,
      p99: engineResult.timing.statistics.p99 / 1_000_000,
      stdDev: engineResult.timing.statistics.stddev / 1_000_000,
    },
    memory: {
      heapUsed: engineResult.memory?.heapDelta ?? 0,
      heapTotal: engineResult.memory?.heapTotalAfter ?? 0,
      external: engineResult.memory?.externalAfter ?? 0,
      rss: engineResult.memory?.heapUsedAfter ?? 0,
    },
    throughput: {
      filesPerSecond: engineResult.opsPerSecond,
      operationsPerSecond: engineResult.opsPerSecond * spec.patches.length,
      bytesPerSecond: engineResult.mbPerSecond * 1_048_576,
    },
  };
}

/**
 * Run benchmark suite
 */
async function runBenchmarkSuite(
  specs: BenchmarkSpec[],
  runs: number,
  warmup: number,
): Promise<BenchmarkSuiteResult> {
  const results: BenchmarkSuiteResult["results"] = [];
  const startTime = performance.now();

  let completed = 0;
  const total = specs.length;

  for (const spec of specs) {
    console.error(
      colorize(
        `[${++completed}/${total}] Running: ${spec.operation} (${spec.fileCount} files, ${spec.complexity})...`,
        "cyan",
      ),
    );

    // Generate test content
    const content = generateTestContent(spec.fileCount, spec.complexity);

    // Create benchmark config
    const config: EngineBenchmarkConfig = {
      name: spec.name,
      patches: spec.patches,
      content,
      warmupRuns: warmup,
      benchmarkRuns: runs,
      measureMemory: true,
      verbose: false,
    };

    // Run benchmark
    const engineResult = await runBenchmark(config);

    // Convert to suite result format
    const result = convertResult(spec, engineResult, runs);
    results.push(result);

    console.error(
      colorize(
        `  ✓ Completed: ${formatTime(result.timing.mean)} (${result.throughput.filesPerSecond.toFixed(2)} files/s)`,
        "dim",
      ),
    );
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
// Main Function
// ============================================================================

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {
    suite: "quick",
    runs: 10,
    warmup: 3,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--suite":
      case "-s":
        options.suite = args[++i] as "quick" | "full" | "custom";
        break;
      case "--operations":
      case "-o":
        options.operations = args[++i]?.split(",");
        break;
      case "--file-counts":
      case "-f":
        options.fileCounts = args[++i]?.split(",").map((n) => Number.parseInt(n, 10));
        break;
      case "--complexity":
      case "-c":
        options.complexity = args[++i]?.split(",") as Array<"simple" | "medium" | "complex">;
        break;
      case "--runs":
      case "-r":
        options.runs = Number.parseInt(args[++i] ?? "10", 10);
        break;
      case "--warmup":
      case "-w":
        options.warmup = Number.parseInt(args[++i] ?? "3", 10);
        break;
      case "--output":
        options.output = args[++i];
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: run-benchmarks.ts [options]

Run performance benchmark suite for kustomark.

Options:
  -s, --suite <type>         Suite type: quick|full (default: quick)
  -o, --operations <ops>     Comma-separated operations (for custom suite)
  -f, --file-counts <nums>   Comma-separated file counts (for custom suite)
  -c, --complexity <levels>  Comma-separated complexity levels (for custom suite)
  -r, --runs <num>           Number of benchmark runs (default: 10)
  -w, --warmup <num>         Number of warmup runs (default: 3)
  --output <file>            Output file path (default: benchmark-results.json)
  -h, --help                 Show this help message

Examples:
  run-benchmarks.ts --suite quick --runs 10
  run-benchmarks.ts --suite full --runs 20 --warmup 5
  run-benchmarks.ts --suite quick --output results.json
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();

    console.error("");
    console.error(colorize("═".repeat(80), "bold"));
    console.error(colorize("Kustomark Performance Benchmark Suite", "bold"));
    console.error(colorize("═".repeat(80), "bold"));
    console.error("");
    console.error(colorize("Configuration:", "yellow"));
    console.error(`  Suite:        ${colorize(options.suite, "cyan")}`);
    console.error(`  Runs:         ${colorize(String(options.runs), "cyan")}`);
    console.error(`  Warmup:       ${colorize(String(options.warmup), "cyan")}`);
    console.error(`  Output:       ${colorize(options.output || "benchmark-results.json", "cyan")}`);
    console.error("");

    // Get benchmark specs
    let specs: BenchmarkSpec[];
    switch (options.suite) {
      case "quick":
        specs = getQuickSuite();
        break;
      case "full":
        specs = getFullSuite();
        break;
      case "custom":
        // TODO: Implement custom suite from options
        throw new Error("Custom suite not yet implemented");
      default:
        throw new Error(`Unknown suite: ${options.suite}`);
    }

    console.error(colorize(`Running ${specs.length} benchmarks...`, "yellow"));
    console.error("");

    // Run benchmarks
    const result = await runBenchmarkSuite(specs, options.runs, options.warmup);

    // Save results
    const outputPath = resolve(options.output || "benchmark-results.json");
    const jsonOutput = JSON.stringify(result, null, 2);
    writeFileSync(outputPath, jsonOutput, "utf-8");

    console.error("");
    console.error(colorize("═".repeat(80), "bold"));
    console.error(colorize("✓ Benchmark suite completed!", "green"));
    console.error(colorize("═".repeat(80), "bold"));
    console.error("");
    console.error(colorize("Summary:", "yellow"));
    console.error(`  Total Benchmarks:      ${result.results.length}`);
    console.error(`  Total Operations:      ${result.summary.totalOperations}`);
    console.error(
      `  Total Duration:        ${formatTime(result.summary.totalDuration)}`,
    );
    console.error(
      `  Average Throughput:    ${result.summary.averageThroughput.toFixed(2)} files/s`,
    );
    console.error(`  Output File:           ${colorize(outputPath, "cyan")}`);
    console.error("");

    process.exit(0);
  } catch (error) {
    console.error(
      colorize("Error:", "red"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
