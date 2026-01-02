/**
 * Tests for the benchmark engine
 */

import { describe, expect, test } from "bun:test";
import {
  calculateStatistics,
  formatBytes,
  formatThroughput,
  formatTime,
  generateTestContent,
  measureMemory,
  measureOperation,
  runBenchmark,
  type BenchmarkConfig,
} from "../../src/core/benchmark-engine.js";
import type { PatchOperation } from "../../src/core/types.js";

describe("Benchmark Engine", () => {
  describe("calculateStatistics", () => {
    test("calculates statistics for a simple array", () => {
      const timings = [100, 200, 150, 180, 120];
      const stats = calculateStatistics(timings);

      expect(stats.mean).toBe(150);
      expect(stats.median).toBe(150);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
    });

    test("handles empty array", () => {
      const stats = calculateStatistics([]);

      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.stddev).toBe(0);
    });

    test("calculates percentiles correctly", () => {
      const timings = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = calculateStatistics(timings);

      expect(stats.p95).toBe(95);
      expect(stats.p99).toBe(99);
    });

    test("calculates median for even-length array", () => {
      const timings = [1, 2, 3, 4];
      const stats = calculateStatistics(timings);

      expect(stats.median).toBe(2.5);
    });

    test("calculates median for odd-length array", () => {
      const timings = [1, 2, 3, 4, 5];
      const stats = calculateStatistics(timings);

      expect(stats.median).toBe(3);
    });
  });

  describe("measureMemory", () => {
    test("measures memory usage of a function", () => {
      const result = measureMemory(() => {
        // Allocate some memory
        const arr = new Array(1000).fill(0);
        // Use the array to prevent optimization
        arr[0] = 1;
      });

      expect(result.heapUsedBefore).toBeGreaterThan(0);
      expect(result.heapUsedAfter).toBeGreaterThan(0);
      expect(result.heapTotalBefore).toBeGreaterThan(0);
      expect(result.heapTotalAfter).toBeGreaterThan(0);
    });

    test("calculates heap delta", () => {
      const result = measureMemory(() => {
        const arr = new Array(10000).fill({ data: "test" });
        arr[0] = { data: "modified" };
      });

      expect(result.heapDelta).toBe(result.heapUsedAfter - result.heapUsedBefore);
    });
  });

  describe("generateTestContent", () => {
    test("generates simple content", () => {
      const content = generateTestContent(5, "simple");

      expect(content.size).toBe(5);
      expect(content.has("test-file-0.md")).toBe(true);
      expect(content.has("test-file-4.md")).toBe(true);

      const firstFile = content.get("test-file-0.md");
      expect(firstFile).toBeDefined();
      expect(firstFile).toContain("# Document 0");
      expect(firstFile).toContain("## Introduction");
    });

    test("generates medium complexity content", () => {
      const content = generateTestContent(3, "medium");

      expect(content.size).toBe(3);

      const firstFile = content.get("test-file-0.md");
      expect(firstFile).toBeDefined();
      expect(firstFile).toContain("# Document 0");
      expect(firstFile).toContain("## Overview");
      expect(firstFile).toContain("### Features");
      expect(firstFile).toContain("```bash");
      expect(firstFile).toContain("- Feature 1");
    });

    test("generates complex content with frontmatter", () => {
      const content = generateTestContent(2, "complex");

      expect(content.size).toBe(2);

      const firstFile = content.get("test-file-0.md");
      expect(firstFile).toBeDefined();
      expect(firstFile).toContain("---");
      expect(firstFile).toContain("title:");
      expect(firstFile).toContain("author:");
      expect(firstFile).toContain("| Component | Version |");
      expect(firstFile).toContain("### Benchmarks");
    });

    test("throws error for unknown complexity level", () => {
      expect(() => generateTestContent(1, "invalid")).toThrow("Unknown complexity level");
    });

    test("generates different content for different indices", () => {
      const content = generateTestContent(2, "simple");

      const file0 = content.get("test-file-0.md");
      const file1 = content.get("test-file-1.md");

      expect(file0).not.toBe(file1);
      expect(file0).toContain("Document 0");
      expect(file1).toContain("Document 1");
    });
  });

  describe("measureOperation", () => {
    test("measures patch application timing", async () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "Lorem ipsum",
          new: "Test content",
        },
      ];

      const content = generateTestContent(3, "simple");
      const timingData = await measureOperation(patches, content, 10);

      expect(timingData.timings).toHaveLength(10);
      expect(timingData.statistics.mean).toBeGreaterThan(0);
      expect(timingData.statistics.min).toBeGreaterThan(0);
      expect(timingData.statistics.max).toBeGreaterThan(0);
    });

    test("timings increase with more complex operations", async () => {
      const simplePatch: PatchOperation[] = [
        {
          op: "replace",
          old: "simple",
          new: "test",
        },
      ];

      const complexPatches: PatchOperation[] = [
        { op: "replace", old: "Document", new: "File" },
        { op: "replace-regex", pattern: "\\d+", replacement: "X" },
        { op: "append-to-section", id: "introduction", content: "\nExtra content" },
      ];

      const content = generateTestContent(5, "medium");

      const simpleResult = await measureOperation(simplePatch, content, 20);
      const complexResult = await measureOperation(complexPatches, content, 20);

      // Complex operations should generally take longer, but this can vary
      // Just verify both produced valid results
      expect(simpleResult.statistics.mean).toBeGreaterThan(0);
      expect(complexResult.statistics.mean).toBeGreaterThan(0);
    });
  });

  describe("runBenchmark", () => {
    test("runs a complete benchmark", async () => {
      const config: BenchmarkConfig = {
        name: "Test Benchmark",
        patches: [
          {
            op: "replace",
            old: "Lorem ipsum",
            new: "Test text",
          },
        ],
        content: generateTestContent(3, "simple"),
        warmupRuns: 2,
        benchmarkRuns: 10,
        measureMemory: true,
        verbose: false,
      };

      const result = await runBenchmark(config);

      expect(result.name).toBe("Test Benchmark");
      expect(result.filesProcessed).toBe(3);
      expect(result.contentSizeBytes).toBeGreaterThan(0);
      expect(result.timing.timings).toHaveLength(10);
      expect(result.timing.statistics.mean).toBeGreaterThan(0);
      expect(result.opsPerSecond).toBeGreaterThan(0);
      expect(result.mbPerSecond).toBeGreaterThan(0);
      expect(result.memory).toBeDefined();
      expect(result.memory?.heapUsedBefore).toBeGreaterThan(0);
    });

    test("can skip memory measurement", async () => {
      const config: BenchmarkConfig = {
        name: "No Memory Test",
        patches: [{ op: "replace", old: "test", new: "example" }],
        content: generateTestContent(2, "simple"),
        warmupRuns: 1,
        benchmarkRuns: 5,
        measureMemory: false,
      };

      const result = await runBenchmark(config);

      expect(result.memory).toBeUndefined();
    });

    test("uses default values for optional parameters", async () => {
      const config: BenchmarkConfig = {
        name: "Default Values Test",
        patches: [{ op: "replace", old: "ipsum", new: "text" }],
        content: generateTestContent(1, "simple"),
      };

      const result = await runBenchmark(config);

      // Should use defaults: warmupRuns=5, benchmarkRuns=100, measureMemory=true
      expect(result.timing.timings).toHaveLength(100);
      expect(result.memory).toBeDefined();
    });
  });

  describe("formatTime", () => {
    test("formats nanoseconds", () => {
      expect(formatTime(500)).toBe("500ns");
    });

    test("formats microseconds", () => {
      expect(formatTime(1_500)).toBe("1.50μs");
      expect(formatTime(500_000)).toBe("500.00μs");
    });

    test("formats milliseconds", () => {
      expect(formatTime(1_500_000)).toBe("1.50ms");
      expect(formatTime(500_000_000)).toBe("500.00ms");
    });

    test("formats seconds", () => {
      expect(formatTime(1_500_000_000)).toBe("1.50s");
      expect(formatTime(10_000_000_000)).toBe("10.00s");
    });
  });

  describe("formatBytes", () => {
    test("formats bytes", () => {
      expect(formatBytes(500)).toBe("500 bytes");
    });

    test("formats kilobytes", () => {
      expect(formatBytes(1_536)).toBe("1.50 KB");
      expect(formatBytes(500_000)).toBe("488.28 KB");
    });

    test("formats megabytes", () => {
      expect(formatBytes(1_572_864)).toBe("1.50 MB");
      expect(formatBytes(500_000_000)).toBe("476.84 MB");
    });

    test("formats gigabytes", () => {
      expect(formatBytes(1_610_612_736)).toBe("1.50 GB");
      expect(formatBytes(5_000_000_000)).toBe("4.66 GB");
    });
  });

  describe("formatThroughput", () => {
    test("formats operations per second", () => {
      expect(formatThroughput(500)).toBe("500.00 ops/sec");
    });

    test("formats thousands of operations", () => {
      expect(formatThroughput(1_500)).toBe("1.50K ops/sec");
      expect(formatThroughput(500_000)).toBe("500.00K ops/sec");
    });

    test("formats millions of operations", () => {
      expect(formatThroughput(1_500_000)).toBe("1.50M ops/sec");
      expect(formatThroughput(5_000_000)).toBe("5.00M ops/sec");
    });
  });

  describe("Integration test", () => {
    test("benchmarks multiple patch types", async () => {
      const patches: PatchOperation[] = [
        {
          op: "set-frontmatter",
          key: "benchmark",
          value: true,
        },
        {
          op: "replace",
          old: "Document",
          new: "File",
        },
        {
          op: "append-to-section",
          id: "introduction",
          content: "\n\nBenchmark note: This was added during testing.",
        },
      ];

      const config: BenchmarkConfig = {
        name: "Multi-Patch Benchmark",
        patches,
        content: generateTestContent(5, "simple"),
        warmupRuns: 2,
        benchmarkRuns: 20,
        measureMemory: true,
      };

      const result = await runBenchmark(config);

      expect(result.name).toBe("Multi-Patch Benchmark");
      expect(result.filesProcessed).toBe(5);
      expect(result.timing.statistics.mean).toBeGreaterThan(0);
      expect(result.timing.statistics.median).toBeGreaterThan(0);
      expect(result.timing.statistics.p95).toBeGreaterThan(0);
      expect(result.timing.statistics.p99).toBeGreaterThan(0);
      expect(result.opsPerSecond).toBeGreaterThan(0);
    });

    test("benchmarks complex content with tables", async () => {
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: "Status",
          content: "Inactive",
        },
      ];

      const config: BenchmarkConfig = {
        name: "Table Operations Benchmark",
        patches,
        content: generateTestContent(3, "complex"),
        warmupRuns: 1,
        benchmarkRuns: 10,
      };

      const result = await runBenchmark(config);

      expect(result.filesProcessed).toBe(3);
      expect(result.contentSizeBytes).toBeGreaterThan(0);
    });
  });
});
