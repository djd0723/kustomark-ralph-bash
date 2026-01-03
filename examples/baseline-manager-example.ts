/**
 * Example usage of the BaselineManager
 *
 * This example demonstrates how to:
 * 1. Create a baseline for a specific version
 * 2. Load an existing baseline
 * 3. Compare current results with a baseline
 * 4. Detect regressions
 * 5. Export reports in JSON and Markdown formats
 */

import { BaselineManager } from "../src/core/baseline-manager.js";
import type { BenchmarkSuiteResult } from "../src/core/types.js";

// Mock benchmark results for demonstration
function createMockBenchmarkResults(meanMultiplier = 1.0): BenchmarkSuiteResult {
  return {
    timestamp: new Date().toISOString(),
    environment: {
      platform: "linux",
      arch: "x64",
      bunVersion: Bun.version,
      cpuCount: 8,
      totalMemory: 16_000_000_000,
    },
    results: [
      {
        operation: "replace",
        fileCount: 10,
        complexity: "simple",
        runs: 100,
        timing: {
          mean: 1_000_000 * meanMultiplier, // 1ms * multiplier
          median: 950_000 * meanMultiplier,
          min: 800_000 * meanMultiplier,
          max: 1_500_000 * meanMultiplier,
          p95: 1_200_000 * meanMultiplier,
          p99: 1_400_000 * meanMultiplier,
          stdDev: 150_000 * meanMultiplier,
        },
        memory: {
          heapUsed: 10_000_000,
          heapTotal: 20_000_000,
          external: 1_000_000,
          rss: 50_000_000,
        },
        throughput: {
          filesPerSecond: 1000,
          operationsPerSecond: 10000,
          bytesPerSecond: 1_000_000,
        },
      },
      {
        operation: "replace-regex",
        fileCount: 10,
        complexity: "medium",
        runs: 100,
        timing: {
          mean: 2_000_000 * meanMultiplier,
          median: 1_900_000 * meanMultiplier,
          min: 1_600_000 * meanMultiplier,
          max: 2_500_000 * meanMultiplier,
          p95: 2_200_000 * meanMultiplier,
          p99: 2_400_000 * meanMultiplier,
          stdDev: 200_000 * meanMultiplier,
        },
        memory: {
          heapUsed: 15_000_000,
          heapTotal: 25_000_000,
          external: 1_500_000,
          rss: 55_000_000,
        },
        throughput: {
          filesPerSecond: 500,
          operationsPerSecond: 5000,
          bytesPerSecond: 500_000,
        },
      },
    ],
    summary: {
      totalDuration: 1_000_000,
      totalOperations: 200,
      averageThroughput: 7500,
    },
  };
}

async function main() {
  console.log("Baseline Manager Example\n");
  console.log("========================\n");

  // Create a baseline manager instance
  const manager = new BaselineManager({
    baseDir: process.cwd(),
    timingThreshold: 10,  // 10% timing regression threshold
    memoryThreshold: 20,  // 20% memory regression threshold
  });

  // Step 1: Generate and save a baseline for version v1.0.0
  console.log("1. Generating baseline for v1.0.0...");
  const baselineResults = createMockBenchmarkResults(1.0);
  await manager.generateBaselineForVersion("v1.0.0", baselineResults);
  console.log("   ✓ Baseline saved\n");

  // Step 2: Load the baseline
  console.log("2. Loading baseline for v1.0.0...");
  const loadedBaseline = await manager.loadBaselineForVersion("v1.0.0");
  if (loadedBaseline) {
    console.log("   ✓ Baseline loaded");
    console.log(`   - Timestamp: ${loadedBaseline.metadata.timestamp}`);
    console.log(`   - Results count: ${loadedBaseline.results.results.length}\n`);
  }

  // Step 3: Generate current results (15% slower - should trigger regression)
  console.log("3. Generating current results (15% slower)...");
  const currentResults = createMockBenchmarkResults(1.15);
  console.log("   ✓ Current results generated\n");

  // Step 4: Compare with baseline
  console.log("4. Comparing with baseline...");
  const comparison = await manager.compareWithBaseline(currentResults, "v1.0.0");
  console.log(`   ✓ Comparison complete`);
  console.log(`   - Total comparisons: ${comparison.comparisons.length}`);
  console.log(`   - Regressions: ${comparison.regressions.length}`);
  console.log(`   - Improvements: ${comparison.improvements.length}`);
  console.log(`   - Has regressions: ${comparison.hasRegressions ? "YES ⚠️" : "NO ✓"}\n`);

  // Step 5: Export JSON report
  console.log("5. Exporting JSON report...");
  const jsonReport = await manager.exportBaselineReport("json");
  console.log(`   ✓ JSON report generated (${jsonReport.length} bytes)\n`);

  // Step 6: Export Markdown report
  console.log("6. Exporting Markdown report...");
  const markdownReport = await manager.exportBaselineReport("markdown");
  console.log("   ✓ Markdown report generated\n");
  console.log("Markdown Report:");
  console.log("================");
  console.log(markdownReport);

  // Step 7: Get baseline history
  console.log("\n7. Getting baseline history...");
  const history = await manager.getBaselineHistory();
  console.log(`   ✓ Found ${history.length} baseline(s):`);
  for (const entry of history) {
    console.log(`   - ${entry.version} (${entry.resultCount} results) - ${entry.timestamp}`);
  }

  // Step 8: Test with improved results (5% faster - should show improvement)
  console.log("\n8. Testing with improved results (5% faster)...");
  const improvedResults = createMockBenchmarkResults(0.95);
  const improvedComparison = await manager.compareWithBaseline(improvedResults, "v1.0.0");
  console.log(`   ✓ Comparison complete`);
  console.log(`   - Regressions: ${improvedComparison.regressions.length}`);
  console.log(`   - Improvements: ${improvedComparison.improvements.length}`);
  console.log(`   - Has regressions: ${improvedComparison.hasRegressions ? "YES ⚠️" : "NO ✓"}\n`);

  console.log("Example completed successfully!");
}

// Run the example
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
