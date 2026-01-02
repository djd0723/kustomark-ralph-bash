#!/usr/bin/env bun

/**
 * Example: Using the Kustomark Benchmark Engine
 *
 * This script demonstrates how to use the benchmark engine to measure
 * the performance of different patch operations.
 *
 * Run with:
 *   bun run examples/benchmark-example.ts
 */

import {
  generateTestContent,
  printBenchmarkResult,
  runBenchmark,
  type BenchmarkConfig,
} from "../src/core/benchmark-engine.js";
import type { PatchOperation } from "../src/core/types.js";

/**
 * Benchmark 1: Simple string replacement
 */
async function benchmarkSimpleReplace() {
  console.log("\n🚀 Benchmark 1: Simple String Replacement\n");

  const patches: PatchOperation[] = [
    {
      op: "replace",
      old: "Lorem ipsum",
      new: "Test content",
    },
  ];

  const config: BenchmarkConfig = {
    name: "Simple Replace",
    patches,
    content: generateTestContent(10, "simple"),
    warmupRuns: 5,
    benchmarkRuns: 100,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Benchmark 2: Regex replacement
 */
async function benchmarkRegexReplace() {
  console.log("\n🚀 Benchmark 2: Regex Replacement\n");

  const patches: PatchOperation[] = [
    {
      op: "replace-regex",
      pattern: "Document (\\d+)",
      replacement: "File $1",
      flags: "g",
    },
  ];

  const config: BenchmarkConfig = {
    name: "Regex Replace",
    patches,
    content: generateTestContent(10, "medium"),
    warmupRuns: 5,
    benchmarkRuns: 100,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Benchmark 3: Section operations
 */
async function benchmarkSectionOperations() {
  console.log("\n🚀 Benchmark 3: Section Operations\n");

  const patches: PatchOperation[] = [
    {
      op: "append-to-section",
      id: "introduction",
      content: "\n\nAdditional notes added during benchmarking.",
    },
    {
      op: "prepend-to-section",
      id: "details",
      content: "**Important:** Read this first.\n\n",
    },
  ];

  const config: BenchmarkConfig = {
    name: "Section Operations",
    patches,
    content: generateTestContent(10, "simple"),
    warmupRuns: 5,
    benchmarkRuns: 100,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Benchmark 4: Frontmatter operations
 */
async function benchmarkFrontmatterOperations() {
  console.log("\n🚀 Benchmark 4: Frontmatter Operations\n");

  const patches: PatchOperation[] = [
    {
      op: "set-frontmatter",
      key: "benchmark",
      value: true,
    },
    {
      op: "set-frontmatter",
      key: "tested_at",
      value: new Date().toISOString(),
    },
    {
      op: "merge-frontmatter",
      values: {
        performance: "high",
        optimized: true,
      },
    },
  ];

  const config: BenchmarkConfig = {
    name: "Frontmatter Operations",
    patches,
    content: generateTestContent(10, "complex"),
    warmupRuns: 5,
    benchmarkRuns: 100,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Benchmark 5: Table operations
 */
async function benchmarkTableOperations() {
  console.log("\n🚀 Benchmark 5: Table Operations\n");

  const patches: PatchOperation[] = [
    {
      op: "replace-table-cell",
      table: 0,
      row: 0,
      column: "Status",
      content: "Updated",
    },
    {
      op: "add-table-row",
      table: 0,
      values: ["New Component", "1.0.0", "Beta", "Experimental feature"],
    },
  ];

  const config: BenchmarkConfig = {
    name: "Table Operations",
    patches,
    content: generateTestContent(10, "complex"),
    warmupRuns: 5,
    benchmarkRuns: 100,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Benchmark 6: Complex multi-patch workflow
 */
async function benchmarkComplexWorkflow() {
  console.log("\n🚀 Benchmark 6: Complex Multi-Patch Workflow\n");

  const patches: PatchOperation[] = [
    {
      op: "set-frontmatter",
      key: "updated",
      value: new Date().toISOString(),
    },
    {
      op: "replace",
      old: "Document",
      new: "Report",
    },
    {
      op: "replace-regex",
      pattern: "version: \"1\\.(\\d+)\\.0\"",
      replacement: 'version: "2.$1.0"',
    },
    {
      op: "append-to-section",
      id: "executive-summary",
      content: "\n\n**Note:** Updated automatically by the benchmark system.",
    },
    {
      op: "replace-table-cell",
      table: 0,
      row: 0,
      column: "Status",
      content: "Production",
    },
  ];

  const config: BenchmarkConfig = {
    name: "Complex Workflow",
    patches,
    content: generateTestContent(20, "complex"),
    warmupRuns: 5,
    benchmarkRuns: 50,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Benchmark 7: Scalability test with many files
 */
async function benchmarkScalability() {
  console.log("\n🚀 Benchmark 7: Scalability Test (100 files)\n");

  const patches: PatchOperation[] = [
    {
      op: "replace",
      old: "Lorem ipsum",
      new: "Benchmark test",
    },
  ];

  const config: BenchmarkConfig = {
    name: "Scalability Test",
    patches,
    content: generateTestContent(100, "medium"),
    warmupRuns: 3,
    benchmarkRuns: 20,
    measureMemory: true,
  };

  const result = await runBenchmark(config);
  printBenchmarkResult(result);
}

/**
 * Main function - run all benchmarks
 */
async function main() {
  console.log("=" + "=".repeat(60));
  console.log("   Kustomark Benchmark Engine - Example Suite");
  console.log("=" + "=".repeat(60));

  try {
    await benchmarkSimpleReplace();
    await benchmarkRegexReplace();
    await benchmarkSectionOperations();
    await benchmarkFrontmatterOperations();
    await benchmarkTableOperations();
    await benchmarkComplexWorkflow();
    await benchmarkScalability();

    console.log("\n✅ All benchmarks completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Benchmark failed:", error);
    process.exit(1);
  }
}

// Run the benchmarks
main();
