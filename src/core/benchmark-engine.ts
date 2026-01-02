/**
 * Benchmark engine for kustomark performance testing
 *
 * Provides high-precision benchmarking capabilities for measuring:
 * - Patch operation performance
 * - Memory usage
 * - Statistical analysis (mean, median, p95, p99, stddev)
 * - Test content generation
 */

import { applyPatches } from "./patch-engine.js";
import type { PatchOperation } from "./types.js";

/**
 * Configuration for a benchmark run
 */
export interface BenchmarkConfig {
  /** Name of the benchmark */
  name: string;
  /** Patch operations to benchmark */
  patches: PatchOperation[];
  /** Content map (filename -> content) */
  content: Map<string, string>;
  /** Number of warmup runs (default: 5) */
  warmupRuns?: number;
  /** Number of benchmark runs (default: 100) */
  benchmarkRuns?: number;
  /** Whether to measure memory usage (default: true) */
  measureMemory?: boolean;
  /** Whether to log verbose output (default: false) */
  verbose?: boolean;
}

/**
 * Timing data from benchmark runs
 */
export interface TimingData {
  /** Individual run timings in nanoseconds */
  timings: number[];
  /** Statistical summary */
  statistics: StatisticsResult;
}

/**
 * Statistical analysis results
 */
export interface StatisticsResult {
  /** Mean (average) in nanoseconds */
  mean: number;
  /** Median (50th percentile) in nanoseconds */
  median: number;
  /** 95th percentile in nanoseconds */
  p95: number;
  /** 99th percentile in nanoseconds */
  p99: number;
  /** Standard deviation in nanoseconds */
  stddev: number;
  /** Minimum time in nanoseconds */
  min: number;
  /** Maximum time in nanoseconds */
  max: number;
}

/**
 * Memory usage measurement result
 */
export interface MemoryResult {
  /** Heap used before operation (bytes) */
  heapUsedBefore: number;
  /** Heap used after operation (bytes) */
  heapUsedAfter: number;
  /** Heap delta (bytes) */
  heapDelta: number;
  /** Total heap size before operation (bytes) */
  heapTotalBefore: number;
  /** Total heap size after operation (bytes) */
  heapTotalAfter: number;
  /** External memory before operation (bytes) */
  externalBefore: number;
  /** External memory after operation (bytes) */
  externalAfter: number;
}

/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Timing data from benchmark runs */
  timing: TimingData;
  /** Memory usage (if measured) */
  memory?: MemoryResult;
  /** Number of files processed */
  filesProcessed: number;
  /** Total content size in bytes */
  contentSizeBytes: number;
  /** Throughput in operations per second */
  opsPerSecond: number;
  /** Throughput in megabytes per second */
  mbPerSecond: number;
}

/**
 * Calculate statistical metrics from an array of timings
 *
 * @param timings - Array of timing values in nanoseconds
 * @returns Statistical analysis of the timings
 *
 * @example
 * ```typescript
 * const timings = [100, 150, 120, 180, 110];
 * const stats = calculateStatistics(timings);
 * console.log(`Mean: ${stats.mean}ns`);
 * console.log(`Median: ${stats.median}ns`);
 * console.log(`P95: ${stats.p95}ns`);
 * ```
 */
export function calculateStatistics(timings: number[]): StatisticsResult {
  if (timings.length === 0) {
    return {
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      stddev: 0,
      min: 0,
      max: 0,
    };
  }

  // Sort timings for percentile calculations
  const sorted = [...timings].sort((a, b) => a - b);

  // Calculate mean
  const sum = timings.reduce((acc, val) => acc + val, 0);
  const mean = sum / timings.length;

  // Calculate median
  const medianIndex = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[medianIndex - 1] ?? 0) + (sorted[medianIndex] ?? 0)) / 2
      : (sorted[medianIndex] ?? 0);

  // Calculate percentiles
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p99Index = Math.ceil(sorted.length * 0.99) - 1;
  const p95 = sorted[p95Index] ?? sorted[sorted.length - 1] ?? 0;
  const p99 = sorted[p99Index] ?? sorted[sorted.length - 1] ?? 0;

  // Calculate standard deviation
  const squaredDiffs = timings.map((t) => (t - mean) ** 2);
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / timings.length;
  const stddev = Math.sqrt(variance);

  // Min and max
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  return {
    mean,
    median,
    p95,
    p99,
    stddev,
    min,
    max,
  };
}

/**
 * Measure memory usage of a function execution
 *
 * Note: This triggers garbage collection before measurement to get more accurate results.
 * The Bun runtime automatically exposes gc() when needed.
 *
 * @param fn - Function to measure memory usage for
 * @returns Memory usage measurements
 *
 * @example
 * ```typescript
 * const result = measureMemory(() => {
 *   // Some operation that uses memory
 *   const largeArray = new Array(1000000).fill(0);
 * });
 * console.log(`Heap delta: ${result.heapDelta} bytes`);
 * ```
 */
export function measureMemory(fn: () => void): MemoryResult {
  // Force garbage collection if available (Bun exposes this)
  if (global.gc) {
    global.gc();
  }

  const memBefore = process.memoryUsage();

  // Execute the function
  fn();

  const memAfter = process.memoryUsage();

  return {
    heapUsedBefore: memBefore.heapUsed,
    heapUsedAfter: memAfter.heapUsed,
    heapDelta: memAfter.heapUsed - memBefore.heapUsed,
    heapTotalBefore: memBefore.heapTotal,
    heapTotalAfter: memAfter.heapTotal,
    externalBefore: memBefore.external,
    externalAfter: memAfter.external,
  };
}

/**
 * Measure the performance of applying patches to content
 *
 * This function runs multiple iterations of patch application and measures
 * the time taken for each run using high-precision Bun.nanoseconds().
 *
 * @param patches - Patch operations to apply
 * @param content - Content map to apply patches to
 * @param runs - Number of benchmark runs to perform
 * @returns Timing data with individual timings and statistics
 *
 * @example
 * ```typescript
 * const patches = [{ op: 'replace', old: 'foo', new: 'bar' }];
 * const content = new Map([['test.md', 'foo bar baz']]);
 * const timingData = await measureOperation(patches, content, 100);
 * console.log(`Mean: ${timingData.statistics.mean}ns`);
 * ```
 */
export async function measureOperation(
  patches: PatchOperation[],
  content: Map<string, string>,
  runs: number,
): Promise<TimingData> {
  const timings: number[] = [];

  for (let i = 0; i < runs; i++) {
    const startTime = Bun.nanoseconds();

    // Apply patches to all files in the content map
    for (const [_filename, fileContent] of content) {
      applyPatches(fileContent, patches);
    }

    const endTime = Bun.nanoseconds();
    const duration = endTime - startTime;
    timings.push(duration);
  }

  const statistics = calculateStatistics(timings);

  return {
    timings,
    statistics,
  };
}

/**
 * Generate test content for benchmarking
 *
 * Creates a map of markdown files with varying complexity levels.
 * Complexity levels determine the structure and size of the generated content.
 *
 * @param fileCount - Number of files to generate
 * @param complexity - Complexity level: 'simple', 'medium', 'complex'
 * @returns Map of filename to content
 *
 * @example
 * ```typescript
 * // Generate 10 simple files
 * const content = generateTestContent(10, 'simple');
 * console.log(`Generated ${content.size} files`);
 *
 * // Generate 5 complex files with tables and frontmatter
 * const complexContent = generateTestContent(5, 'complex');
 * ```
 */
export function generateTestContent(fileCount: number, complexity: string): Map<string, string> {
  const content = new Map<string, string>();

  for (let i = 0; i < fileCount; i++) {
    const filename = `test-file-${i}.md`;
    let fileContent = "";

    switch (complexity) {
      case "simple":
        // Simple: Just a few sections with basic text
        fileContent = generateSimpleContent(i);
        break;

      case "medium":
        // Medium: Multiple sections, lists, code blocks
        fileContent = generateMediumContent(i);
        break;

      case "complex":
        // Complex: Frontmatter, tables, nested sections, code blocks
        fileContent = generateComplexContent(i);
        break;

      default:
        throw new Error(`Unknown complexity level: ${complexity}`);
    }

    content.set(filename, fileContent);
  }

  return content;
}

/**
 * Generate simple markdown content
 */
function generateSimpleContent(index: number): string {
  return `# Document ${index}

This is a simple test document with basic content.

## Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Details

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
Nisi ut aliquip ex ea commodo consequat.

## Conclusion

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.
`;
}

/**
 * Generate medium complexity markdown content
 */
function generateMediumContent(index: number): string {
  return `# Document ${index}

This is a medium complexity test document.

## Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

### Features

- Feature 1: High performance
- Feature 2: Easy to use
- Feature 3: Extensible architecture

### Requirements

1. Node.js 18 or later
2. At least 4GB RAM
3. Modern web browser

## Installation

\`\`\`bash
npm install example-package
\`\`\`

### Configuration

Edit the config file:

\`\`\`json
{
  "name": "example",
  "version": "1.0.0",
  "enabled": true
}
\`\`\`

## Usage

Run the application:

\`\`\`bash
npm start
\`\`\`

## Troubleshooting

If you encounter issues:

- Check the logs in \`/var/log/app.log\`
- Verify configuration settings
- Restart the service

## Conclusion

Thank you for using this package.
`;
}

/**
 * Generate complex markdown content with frontmatter and tables
 */
function generateComplexContent(index: number): string {
  return `---
title: "Complex Document ${index}"
author: "Test Author"
version: "1.${index}.0"
tags:
  - documentation
  - testing
  - benchmarks
created: "2024-01-${(index % 28) + 1}"
status: "draft"
---

# Complex Document ${index}

This is a complex test document with frontmatter, tables, and nested sections.

## Executive Summary

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua.

### Key Points

- **Performance**: Optimized for high throughput
- **Reliability**: 99.9% uptime guarantee
- **Scalability**: Handles millions of requests
- **Security**: Enterprise-grade encryption

## Architecture

### Components

| Component | Version | Status | Description |
|-----------|---------|--------|-------------|
| Core Engine | 2.${index}.0 | Active | Main processing engine |
| API Gateway | 1.5.${index} | Active | REST API interface |
| Database | 3.2.1 | Active | Data persistence layer |
| Cache Layer | 1.1.${index} | Active | In-memory caching |

### Data Flow

1. **Request Reception**
   - Client sends HTTP request
   - API Gateway validates authentication
   - Request is routed to appropriate handler

2. **Processing**
   - Core engine processes the request
   - Data is fetched from cache or database
   - Business logic is applied

3. **Response Generation**
   - Results are formatted
   - Response is cached if applicable
   - HTTP response is sent to client

## Configuration

### Environment Variables

\`\`\`bash
export APP_NAME="complex-app-${index}"
export APP_PORT=300${index}
export DB_HOST="localhost"
export DB_PORT=5432
export CACHE_ENABLED=true
export LOG_LEVEL="info"
\`\`\`

### Configuration File

\`\`\`yaml
app:
  name: complex-app-${index}
  port: 300${index}

database:
  host: localhost
  port: 5432
  name: app_db_${index}

cache:
  enabled: true
  ttl: 3600

logging:
  level: info
  output: stdout
\`\`\`

## Performance Metrics

### Benchmarks

| Operation | Avg Time | P95 | P99 | Throughput |
|-----------|----------|-----|-----|------------|
| Read | ${10 + index}ms | ${15 + index}ms | ${20 + index}ms | ${1000 - index * 10} ops/s |
| Write | ${20 + index}ms | ${30 + index}ms | ${40 + index}ms | ${500 - index * 5} ops/s |
| Update | ${15 + index}ms | ${25 + index}ms | ${35 + index}ms | ${750 - index * 7} ops/s |
| Delete | ${12 + index}ms | ${18 + index}ms | ${25 + index}ms | ${900 - index * 9} ops/s |

### Load Testing Results

\`\`\`
Test Duration: 10 minutes
Concurrent Users: ${100 + index * 10}
Total Requests: ${10000 + index * 1000}
Success Rate: ${99.9 - index * 0.01}%
\`\`\`

## API Reference

### Endpoints

#### GET /api/items

Retrieve all items.

**Parameters:**
- \`limit\` (optional): Maximum number of items to return
- \`offset\` (optional): Number of items to skip

**Response:**
\`\`\`json
{
  "items": [],
  "total": 0,
  "limit": 10,
  "offset": 0
}
\`\`\`

#### POST /api/items

Create a new item.

**Request Body:**
\`\`\`json
{
  "name": "Item ${index}",
  "description": "Test item",
  "quantity": ${index}
}
\`\`\`

## Troubleshooting

### Common Issues

#### Issue: Connection Timeout

**Symptoms:**
- Requests fail with timeout errors
- Long response times

**Solutions:**
1. Check network connectivity
2. Verify database is running
3. Increase timeout settings
4. Check for resource exhaustion

#### Issue: Memory Leak

**Symptoms:**
- Memory usage grows over time
- Application becomes slow
- Out of memory errors

**Solutions:**
1. Monitor memory usage with profiler
2. Check for unclosed connections
3. Review cache eviction policy
4. Restart application periodically

## Appendix

### Glossary

- **API**: Application Programming Interface
- **CRUD**: Create, Read, Update, Delete
- **REST**: Representational State Transfer
- **JSON**: JavaScript Object Notation
- **YAML**: YAML Ain't Markup Language

### References

1. [Official Documentation](https://example.com/docs)
2. [GitHub Repository](https://github.com/example/repo)
3. [Community Forum](https://forum.example.com)
4. [Support Portal](https://support.example.com)
`;
}

/**
 * Run a complete benchmark suite
 *
 * This is the main entry point for benchmarking. It performs:
 * 1. Warmup runs to stabilize the runtime
 * 2. Benchmark runs with high-precision timing
 * 3. Memory measurement (optional)
 * 4. Statistical analysis
 * 5. Throughput calculation
 *
 * @param config - Benchmark configuration
 * @returns Complete benchmark results
 *
 * @example
 * ```typescript
 * const config: BenchmarkConfig = {
 *   name: 'Replace Operations',
 *   patches: [{ op: 'replace', old: 'foo', new: 'bar' }],
 *   content: generateTestContent(10, 'medium'),
 *   warmupRuns: 5,
 *   benchmarkRuns: 100,
 *   measureMemory: true,
 * };
 *
 * const result = await runBenchmark(config);
 * console.log(`Mean time: ${result.timing.statistics.mean}ns`);
 * console.log(`Throughput: ${result.opsPerSecond} ops/sec`);
 * ```
 */
export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const {
    name,
    patches,
    content,
    warmupRuns = 5,
    benchmarkRuns = 100,
    measureMemory: shouldMeasureMemory = true,
    verbose = false,
  } = config;

  if (verbose) {
    console.log(`Running benchmark: ${name}`);
    console.log(`Files: ${content.size}`);
    console.log(`Patches: ${patches.length}`);
    console.log(`Warmup runs: ${warmupRuns}`);
    console.log(`Benchmark runs: ${benchmarkRuns}`);
  }

  // Calculate total content size
  let totalContentSize = 0;
  for (const fileContent of content.values()) {
    totalContentSize += new TextEncoder().encode(fileContent).length;
  }

  // Warmup phase
  if (verbose) {
    console.log("Warming up...");
  }
  await measureOperation(patches, content, warmupRuns);

  // Benchmark phase
  if (verbose) {
    console.log("Running benchmark...");
  }
  const timing = await measureOperation(patches, content, benchmarkRuns);

  // Memory measurement
  let memory: MemoryResult | undefined;
  if (shouldMeasureMemory) {
    if (verbose) {
      console.log("Measuring memory...");
    }
    memory = measureMemory(() => {
      for (const [_filename, fileContent] of content) {
        applyPatches(fileContent, patches);
      }
    });
  }

  // Calculate throughput
  const meanTimeSeconds = timing.statistics.mean / 1_000_000_000; // Convert ns to seconds
  const opsPerSecond = 1 / meanTimeSeconds;
  const mbPerSecond = totalContentSize / 1_048_576 / meanTimeSeconds; // Convert bytes to MB

  if (verbose) {
    console.log("Benchmark complete!");
  }

  return {
    name,
    timing,
    memory,
    filesProcessed: content.size,
    contentSizeBytes: totalContentSize,
    opsPerSecond,
    mbPerSecond,
  };
}

/**
 * Format nanoseconds to human-readable time
 *
 * @param nanoseconds - Time in nanoseconds
 * @returns Formatted string (e.g., "1.23ms", "456.78μs")
 */
export function formatTime(nanoseconds: number): string {
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
 * Format bytes to human-readable size
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.23 MB", "456.78 KB")
 */
export function formatBytes(bytes: number): string {
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
 * Format throughput to human-readable string
 *
 * @param opsPerSecond - Operations per second
 * @returns Formatted string (e.g., "1.23K ops/sec", "456 ops/sec")
 */
export function formatThroughput(opsPerSecond: number): string {
  if (opsPerSecond >= 1_000_000) {
    return `${(opsPerSecond / 1_000_000).toFixed(2)}M ops/sec`;
  }
  if (opsPerSecond >= 1_000) {
    return `${(opsPerSecond / 1_000).toFixed(2)}K ops/sec`;
  }
  return `${opsPerSecond.toFixed(2)} ops/sec`;
}

/**
 * Print a formatted benchmark result to the console
 *
 * @param result - Benchmark result to print
 *
 * @example
 * ```typescript
 * const result = await runBenchmark(config);
 * printBenchmarkResult(result);
 * ```
 */
export function printBenchmarkResult(result: BenchmarkResult): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Benchmark: ${result.name}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("Timing Statistics:");
  console.log(`  Mean:   ${formatTime(result.timing.statistics.mean)}`);
  console.log(`  Median: ${formatTime(result.timing.statistics.median)}`);
  console.log(`  Min:    ${formatTime(result.timing.statistics.min)}`);
  console.log(`  Max:    ${formatTime(result.timing.statistics.max)}`);
  console.log(`  P95:    ${formatTime(result.timing.statistics.p95)}`);
  console.log(`  P99:    ${formatTime(result.timing.statistics.p99)}`);
  console.log(`  StdDev: ${formatTime(result.timing.statistics.stddev)}`);

  console.log("\nThroughput:");
  console.log(`  Operations: ${formatThroughput(result.opsPerSecond)}`);
  console.log(`  Bandwidth:  ${result.mbPerSecond.toFixed(2)} MB/sec`);

  console.log("\nWorkload:");
  console.log(`  Files:       ${result.filesProcessed}`);
  console.log(`  Total Size:  ${formatBytes(result.contentSizeBytes)}`);

  if (result.memory) {
    console.log("\nMemory Usage:");
    console.log(`  Before:  ${formatBytes(result.memory.heapUsedBefore)}`);
    console.log(`  After:   ${formatBytes(result.memory.heapUsedAfter)}`);
    console.log(`  Delta:   ${formatBytes(result.memory.heapDelta)}`);
  }

  console.log(`\n${"=".repeat(60)}\n`);
}
