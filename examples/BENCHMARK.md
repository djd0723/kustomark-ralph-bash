# Kustomark Benchmark Engine

The benchmark engine provides high-precision performance testing capabilities for Kustomark patch operations.

## Features

- **High-Precision Timing**: Uses `Bun.nanoseconds()` for accurate measurements
- **Memory Profiling**: Tracks heap usage and memory deltas
- **Statistical Analysis**: Calculates mean, median, p95, p99, and standard deviation
- **Test Content Generation**: Generates markdown files with varying complexity levels
- **Throughput Metrics**: Measures operations per second and MB/sec

## Quick Start

```typescript
import {
  runBenchmark,
  generateTestContent,
  printBenchmarkResult,
  type BenchmarkConfig,
} from "./src/core/benchmark-engine.js";

// Create a benchmark configuration
const config: BenchmarkConfig = {
  name: "My Benchmark",
  patches: [
    {
      op: "replace",
      old: "foo",
      new: "bar",
    },
  ],
  content: generateTestContent(10, "medium"),
  warmupRuns: 5,
  benchmarkRuns: 100,
  measureMemory: true,
};

// Run the benchmark
const result = await runBenchmark(config);

// Print formatted results
printBenchmarkResult(result);
```

## API Reference

### `runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult>`

Main entry point for running a benchmark.

**Parameters:**
- `name`: Benchmark name
- `patches`: Array of patch operations to test
- `content`: Map of filename → content
- `warmupRuns` (optional): Number of warmup iterations (default: 5)
- `benchmarkRuns` (optional): Number of benchmark iterations (default: 100)
- `measureMemory` (optional): Whether to measure memory usage (default: true)
- `verbose` (optional): Enable verbose logging (default: false)

**Returns:**
- `name`: Benchmark name
- `timing`: Timing data with statistics
- `memory`: Memory usage measurements (if enabled)
- `filesProcessed`: Number of files in the test
- `contentSizeBytes`: Total content size
- `opsPerSecond`: Throughput in operations per second
- `mbPerSecond`: Throughput in megabytes per second

### `generateTestContent(fileCount: number, complexity: string): Map<string, string>`

Generate test markdown content.

**Complexity Levels:**
- `"simple"`: Basic sections with plain text
- `"medium"`: Multiple sections, lists, code blocks
- `"complex"`: Frontmatter, tables, nested sections

**Example:**
```typescript
const content = generateTestContent(10, "complex");
// Generates 10 files with complex markdown structures
```

### `measureOperation(patches: PatchOperation[], content: Map<string, string>, runs: number): Promise<TimingData>`

Measure the performance of applying patches.

**Example:**
```typescript
const timing = await measureOperation(patches, content, 100);
console.log(`Mean: ${timing.statistics.mean}ns`);
```

### `calculateStatistics(timings: number[]): StatisticsResult`

Calculate statistical metrics from timing data.

**Returns:**
- `mean`: Average time
- `median`: 50th percentile
- `p95`: 95th percentile
- `p99`: 99th percentile
- `stddev`: Standard deviation
- `min`: Minimum time
- `max`: Maximum time

### `measureMemory(fn: () => void): MemoryResult`

Measure memory usage of a function.

**Example:**
```typescript
const memory = measureMemory(() => {
  // Your code here
  applyPatches(content, patches);
});
console.log(`Heap delta: ${memory.heapDelta} bytes`);
```

## Utility Functions

### Formatting Functions

```typescript
// Format time values
formatTime(1_500_000)        // "1.50ms"
formatTime(500_000_000)      // "500.00ms"

// Format byte values
formatBytes(1_572_864)       // "1.50 MB"
formatBytes(500)             // "500 bytes"

// Format throughput
formatThroughput(1_500)      // "1.50K ops/sec"
formatThroughput(500_000)    // "500.00K ops/sec"
```

## Running the Example

The repository includes a comprehensive example demonstrating various benchmark scenarios:

```bash
bun run examples/benchmark-example.ts
```

This runs benchmarks for:
1. Simple string replacement
2. Regex replacement
3. Section operations
4. Frontmatter operations
5. Table operations
6. Complex multi-patch workflows
7. Scalability tests with many files

## Example Output

```
============================================================
Benchmark: Simple Replace
============================================================

Timing Statistics:
  Mean:   60.26μs
  Median: 57.33μs
  Min:    24.16μs
  Max:    132.80μs
  P95:    106.31μs
  P99:    121.18μs
  StdDev: 24.14μs

Throughput:
  Operations: 16.60K ops/sec
  Bandwidth:  66.95 MB/sec

Workload:
  Files:       10
  Total Size:  4.13 KB

Memory Usage:
  Before:  232.62 KB
  After:   232.62 KB
  Delta:   0 bytes

============================================================
```

## Best Practices

### 1. Warmup Runs

Always include warmup runs to stabilize the runtime before measurements:

```typescript
{
  warmupRuns: 5,      // Good: Stabilizes JIT compilation
  benchmarkRuns: 100  // Actual measurement runs
}
```

### 2. Sample Size

Use enough benchmark runs for statistical significance:

```typescript
{
  benchmarkRuns: 100  // Good: Provides reliable statistics
  // benchmarkRuns: 5 // Bad: Too few for accurate p95/p99
}
```

### 3. Test Content

Choose appropriate complexity for your use case:

```typescript
// Testing simple operations
generateTestContent(100, "simple")

// Testing complex operations
generateTestContent(10, "complex")
```

### 4. Memory Measurement

Be aware that memory measurement triggers garbage collection:

```typescript
{
  measureMemory: true  // More accurate but slower
  // measureMemory: false // Faster but no memory data
}
```

## Understanding Metrics

### Timing Metrics

- **Mean**: Average performance - good for overall trends
- **Median**: Middle value - less affected by outliers
- **P95/P99**: Worst-case performance for 95%/99% of operations
- **StdDev**: Consistency indicator - lower is more predictable

### When to Use Each

- **Mean**: Overall performance comparisons
- **Median**: Typical user experience
- **P95**: SLA and performance targets
- **P99**: Critical path optimization
- **StdDev**: Identifying performance inconsistencies

## Advanced Usage

### Custom Content

Create custom test content for specific scenarios:

```typescript
const content = new Map([
  ["file1.md", "# Custom Content\n\nSpecific test case"],
  ["file2.md", "# Another File\n\nDifferent scenario"],
]);

const config: BenchmarkConfig = {
  name: "Custom Test",
  patches: yourPatches,
  content,
  benchmarkRuns: 50,
};
```

### Comparative Benchmarks

Compare different approaches:

```typescript
const approach1Result = await runBenchmark({
  name: "Approach 1",
  patches: approach1Patches,
  content,
});

const approach2Result = await runBenchmark({
  name: "Approach 2",
  patches: approach2Patches,
  content,
});

console.log(`Approach 1: ${approach1Result.opsPerSecond} ops/sec`);
console.log(`Approach 2: ${approach2Result.opsPerSecond} ops/sec`);
```

### Profiling Specific Operations

Focus on individual patch types:

```typescript
// Test only replace operations
const replaceOnly = await runBenchmark({
  name: "Replace Only",
  patches: [{ op: "replace", old: "x", new: "y" }],
  content: generateTestContent(50, "medium"),
});

// Test only section operations
const sectionOnly = await runBenchmark({
  name: "Section Only",
  patches: [{ op: "append-to-section", id: "test", content: "..." }],
  content: generateTestContent(50, "medium"),
});
```

## Troubleshooting

### High Variance (Large StdDev)

If you see high standard deviation:

1. Increase warmup runs
2. Reduce background processes
3. Use more benchmark runs
4. Check for memory pressure

### Unexpected Memory Usage

If memory delta is unexpected:

1. Ensure garbage collection is enabled
2. Check for memory leaks in patches
3. Increase warmup runs to stabilize heap
4. Profile with verbose output

### Slow Benchmarks

If benchmarks take too long:

1. Reduce `benchmarkRuns` for quick tests
2. Disable `measureMemory` for faster runs
3. Use simpler test content
4. Reduce file count

## License

Part of the Kustomark project.
