/**
 * Tests for BaselineManager
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { BaselineManager } from "./baseline-manager.js";
import type { BenchmarkSuiteResult } from "./types.js";

// Test directory for baseline storage
const TEST_DIR = join(process.cwd(), ".test-baselines");

// Helper function to create mock benchmark results
function createMockResults(meanMultiplier = 1.0): BenchmarkSuiteResult {
  return {
    timestamp: new Date().toISOString(),
    environment: {
      platform: "linux",
      arch: "x64",
      bunVersion: "1.0.0",
      cpuCount: 4,
      totalMemory: 8_000_000_000,
    },
    results: [
      {
        operation: "replace",
        fileCount: 10,
        complexity: "simple",
        runs: 100,
        timing: {
          mean: 1_000_000 * meanMultiplier,
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
    ],
    summary: {
      totalDuration: 1_000_000,
      totalOperations: 100,
      averageThroughput: 10000,
    },
  };
}

describe("BaselineManager", () => {
  let manager: BaselineManager;

  beforeEach(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
    manager = new BaselineManager({ baseDir: TEST_DIR });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("generateBaselineForVersion", () => {
    test("should save a baseline for a valid version", async () => {
      const results = createMockResults();
      await manager.generateBaselineForVersion("v1.0.0", results);

      const baselinePath = join(TEST_DIR, ".kustomark", "benchmarks", "baselines", "v1.0.0.json");
      expect(existsSync(baselinePath)).toBe(true);
    });

    test("should reject invalid version names", async () => {
      const results = createMockResults();

      await expect(manager.generateBaselineForVersion("", results)).rejects.toThrow(
        "Version must be a non-empty string",
      );

      await expect(
        manager.generateBaselineForVersion("version with spaces", results),
      ).rejects.toThrow("Version must contain only alphanumeric characters");

      await expect(manager.generateBaselineForVersion("latest", results)).rejects.toThrow(
        "'latest' is a reserved name",
      );
    });

    test("should accept valid version formats", async () => {
      const results = createMockResults();

      await manager.generateBaselineForVersion("v1.0.0", results);
      await manager.generateBaselineForVersion("main", results);
      await manager.generateBaselineForVersion("feature-123", results);
      await manager.generateBaselineForVersion("v2.0.0-beta.1", results);

      const history = await manager.getBaselineHistory();
      expect(history.length).toBe(4);
    });
  });

  describe("loadBaselineForVersion", () => {
    test("should load an existing baseline", async () => {
      const results = createMockResults();
      await manager.generateBaselineForVersion("v1.0.0", results);

      const loaded = await manager.loadBaselineForVersion("v1.0.0");
      expect(loaded).not.toBeNull();
      expect(loaded?.metadata.version).toBe("v1.0.0");
      expect(loaded?.results.results.length).toBe(1);
    });

    test("should return null for non-existent baseline", async () => {
      const loaded = await manager.loadBaselineForVersion("v9.9.9");
      expect(loaded).toBeNull();
    });

    test("should validate loaded baseline structure", async () => {
      const results = createMockResults();
      await manager.generateBaselineForVersion("v1.0.0", results);

      const loaded = await manager.loadBaselineForVersion("v1.0.0");
      expect(loaded?.metadata).toBeDefined();
      expect(loaded?.metadata.bunVersion).toBeDefined();
      expect(loaded?.metadata.platform).toBeDefined();
      expect(loaded?.results).toBeDefined();
    });
  });

  describe("compareWithBaseline", () => {
    test("should detect timing regressions", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      // Current results are 15% slower (should trigger regression)
      const current = createMockResults(1.15);
      const comparison = await manager.compareWithBaseline(current, "v1.0.0");

      expect(comparison.hasRegressions).toBe(true);
      expect(comparison.regressions.length).toBeGreaterThan(0);
      expect(comparison.comparisons[0]?.change.meanPercent).toBeCloseTo(15, 1);
    });

    test("should detect improvements", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      // Current results are 10% faster
      const current = createMockResults(0.9);
      const comparison = await manager.compareWithBaseline(current, "v1.0.0");

      expect(comparison.hasRegressions).toBe(false);
      expect(comparison.improvements.length).toBeGreaterThan(0);
      expect(comparison.comparisons[0]?.change.meanPercent).toBeCloseTo(-10, 1);
    });

    test("should not flag small improvements as regressions", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      // Current results are 5% slower (below 10% threshold)
      const current = createMockResults(1.05);
      const comparison = await manager.compareWithBaseline(current, "v1.0.0");

      expect(comparison.hasRegressions).toBe(false);
      expect(comparison.regressions.length).toBe(0);
    });

    test("should throw error for non-existent baseline", async () => {
      const current = createMockResults();

      await expect(manager.compareWithBaseline(current, "v9.9.9")).rejects.toThrow(
        "Baseline version 'v9.9.9' not found",
      );
    });

    test("should detect memory regressions", async () => {
      const manager = new BaselineManager({
        baseDir: TEST_DIR,
        memoryThreshold: 20,
      });

      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      // Create results with 25% higher memory usage
      const current = createMockResults(1.0);
      const firstResult = current.results[0];
      if (firstResult) {
        firstResult.memory.heapUsed *= 1.25;
      }

      const comparison = await manager.compareWithBaseline(current, "v1.0.0");

      expect(comparison.memoryRegressions.length).toBeGreaterThan(0);
      expect(comparison.hasRegressions).toBe(true);
    });
  });

  describe("getBaselineHistory", () => {
    test("should return empty array when no baselines exist", async () => {
      const history = await manager.getBaselineHistory();
      expect(history).toEqual([]);
    });

    test("should list all saved baselines", async () => {
      const results1 = createMockResults();
      const results2 = createMockResults();
      const results3 = createMockResults();

      await manager.generateBaselineForVersion("v1.0.0", results1);
      await manager.generateBaselineForVersion("v1.1.0", results2);
      await manager.generateBaselineForVersion("main", results3);

      const history = await manager.getBaselineHistory();
      expect(history.length).toBe(3);

      const versions = history.map((h) => h.version);
      expect(versions).toContain("v1.0.0");
      expect(versions).toContain("v1.1.0");
      expect(versions).toContain("main");
    });

    test("should sort baselines by timestamp (newest first)", async () => {
      const results = createMockResults();

      // Add small delays to ensure different timestamps
      await manager.generateBaselineForVersion("v1.0.0", results);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.generateBaselineForVersion("v1.1.0", results);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.generateBaselineForVersion("v1.2.0", results);

      const history = await manager.getBaselineHistory();
      expect(history.length).toBe(3);
      expect(history[0]?.version).toBe("v1.2.0");
      expect(history[2]?.version).toBe("v1.0.0");
    });
  });

  describe("exportBaselineReport", () => {
    test("should export JSON report", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      const current = createMockResults(1.15);
      await manager.compareWithBaseline(current, "v1.0.0");

      const report = await manager.exportBaselineReport("json");
      expect(typeof report).toBe("string");

      const parsed = JSON.parse(report);
      expect(parsed.baselineVersion).toBe("v1.0.0");
      expect(parsed.comparisons).toBeDefined();
      expect(parsed.regressions).toBeDefined();
    });

    test("should export Markdown report", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      const current = createMockResults(1.15);
      await manager.compareWithBaseline(current, "v1.0.0");

      const report = await manager.exportBaselineReport("markdown");
      expect(typeof report).toBe("string");
      expect(report).toContain("# Benchmark Comparison Report");
      expect(report).toContain("## Metadata");
      expect(report).toContain("## Summary");
      expect(report).toContain("## Regressions");
    });

    test("should throw error if no comparison has been performed", async () => {
      await expect(manager.exportBaselineReport("json")).rejects.toThrow("No comparison available");
    });

    test("should include regression markers in Markdown", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      const current = createMockResults(1.15);
      await manager.compareWithBaseline(current, "v1.0.0");

      const report = await manager.exportBaselineReport("markdown");
      expect(report).toContain("🔴"); // Red indicator for regression
      expect(report).toContain("⚠️"); // Warning for regressions detected
    });

    test("should show improvements in Markdown", async () => {
      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      const current = createMockResults(0.9);
      await manager.compareWithBaseline(current, "v1.0.0");

      const report = await manager.exportBaselineReport("markdown");
      expect(report).toContain("## Improvements");
      expect(report).toContain("🟢"); // Green indicator for improvement
    });
  });

  describe("custom thresholds", () => {
    test("should respect custom timing threshold", async () => {
      const manager = new BaselineManager({
        baseDir: TEST_DIR,
        timingThreshold: 20, // 20% threshold instead of default 10%
      });

      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      // 15% slower - should NOT be a regression with 20% threshold
      const current = createMockResults(1.15);
      const comparison = await manager.compareWithBaseline(current, "v1.0.0");

      expect(comparison.hasRegressions).toBe(false);
    });

    test("should respect custom memory threshold", async () => {
      const manager = new BaselineManager({
        baseDir: TEST_DIR,
        memoryThreshold: 30, // 30% threshold instead of default 20%
      });

      const baseline = createMockResults(1.0);
      await manager.generateBaselineForVersion("v1.0.0", baseline);

      // 25% more memory - should NOT be a regression with 30% threshold
      const current = createMockResults(1.0);
      const firstResult = current.results[0];
      if (firstResult) {
        firstResult.memory.heapUsed *= 1.25;
      }

      const comparison = await manager.compareWithBaseline(current, "v1.0.0");

      expect(comparison.memoryRegressions.length).toBe(0);
    });
  });
});
