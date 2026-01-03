# Benchmarking Guide

Comprehensive guide to measuring kustomark performance with the built-in benchmark engine.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Running Benchmarks](#running-benchmarks)
- [Understanding Metrics](#understanding-metrics)
- [Baseline Management](#baseline-management)
- [Creating Custom Benchmarks](#creating-custom-benchmarks)
- [Comparing Performance](#comparing-performance)
- [Interpreting Results](#interpreting-results)
- [Troubleshooting](#troubleshooting)

## Overview

Kustomark includes a sophisticated benchmarking engine that provides:

- **High-precision timing** using nanosecond resolution
- **Statistical analysis** including mean, median, percentiles, and standard deviation
- **Memory profiling** to track heap usage and allocations
- **Baseline comparison** to detect performance regressions
- **Multiple output formats** (text, JSON, markdown)

## Quick Start

### Run a Basic Benchmark

```bash
# Benchmark common operations
kustomark benchmark run

# Benchmark specific operations
kustomark benchmark run --operations replace,append,prepend

# Benchmark with custom file counts
kustomark benchmark run --file-counts 10,50,100
```

### Example Output

```
============================================================
Benchmark Results
============================================================

Environment:
  Platform: linux (x64)
  Bun Version: 1.1.0
  CPU Cores: 8
  Total Memory: 16.00 GB
  Timestamp: 2024-02-01T10:30:00.000Z

Results:

  replace:
    10 files (medium): 2.45ms (median: 2.42ms, p95: 2.89ms)
      Throughput: 4081.63 files/s, 40816.33 ops/s
      Memory: 0.52 MB heap, 1.23 MB RSS

    50 files (medium): 11.23ms (median: 11.15ms, p95: 12.67ms)
      Throughput: 4452.63 files/s, 44526.31 ops/s
      Memory: 2.34 MB heap, 5.67 MB RSS

Summary:
  Total Duration: 45.23s
  Total Operations: 12000
  Average Throughput: 4234.56 files/s
```

## Running Benchmarks

### Command-Line Options

```bash
kustomark benchmark run [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--operations <ops>` | Comma-separated list of operations to benchmark | All operations |
| `--file-counts <counts>` | Comma-separated file counts to test | 10,50,100 |
| `--complexity <level>` | Complexity level: simple, medium, complex | medium |
| `--warmup <n>` | Number of warmup runs | 3 |
| `--runs <n>` | Number of benchmark runs | 10 |
| `--format <format>` | Output format: text, json, markdown | text |
| `--output <file>` | Write results to file | stdout |
| `--baseline <name>` | Compare against named baseline | - |
| `--save-baseline <name>` | Save results as baseline | - |

### Available Operations

**Content Operations:**
- `replace` - Simple string replacement
- `replace-regex` - Regular expression replacement
- `replace-line` - Replace entire lines
- `insert-before` - Insert content before a line
- `insert-after` - Insert content after a line
- `delete-between` - Delete content between markers

**Section Operations:**
- `append` - Append to sections
- `prepend` - Prepend to sections
- `replace-section` - Replace entire sections
- `remove-section` - Remove sections
- `rename-header` - Rename section headers
- `move-section` - Move sections

**Table Operations:**
- `replace-table-cell` - Replace table cells
- `add-table-row` - Add table rows
- `remove-table-row` - Remove table rows
- `add-table-column` - Add table columns
- `remove-table-column` - Remove table columns

**Frontmatter Operations:**
- `set-frontmatter` - Set frontmatter fields
- `remove-frontmatter` - Remove frontmatter fields
- `merge-frontmatter` - Merge frontmatter objects
- `rename-frontmatter` - Rename frontmatter fields

### Examples

**Benchmark specific operations:**
```bash
kustomark benchmark run \
  --operations replace,append,prepend \
  --file-counts 10,100 \
  --runs 50
```

**Benchmark with high precision:**
```bash
kustomark benchmark run \
  --warmup 10 \
  --runs 100 \
  --complexity complex
```

**Save results to file:**
```bash
kustomark benchmark run \
  --format markdown \
  --output benchmark-results.md
```

**Compare against baseline:**
```bash
kustomark benchmark run \
  --baseline v1.0.0 \
  --format json \
  --output comparison.json
```

## Understanding Metrics

### Timing Metrics

#### Mean (Average)
The arithmetic mean of all timing measurements.

```
Mean = (sum of all times) / (number of runs)
```

**Use when**: Getting overall performance impression
**Pros**: Easy to understand, commonly used
**Cons**: Sensitive to outliers

#### Median (50th Percentile)
The middle value when timings are sorted.

**Use when**: Want typical performance without outlier influence
**Pros**: Robust against outliers
**Cons**: Doesn't show full distribution

#### P95 (95th Percentile)
95% of runs complete faster than this value.

**Use when**: Understanding worst-case scenarios
**Pros**: Shows tail latency
**Cons**: Requires many samples for accuracy

#### P99 (99th Percentile)
99% of runs complete faster than this value.

**Use when**: Service-level objectives, critical performance
**Pros**: Catches rare slowdowns
**Cons**: Very sensitive to outliers

#### Standard Deviation
Measure of timing variation.

**Use when**: Assessing consistency
**Pros**: Shows stability
**Cons**: Requires statistical knowledge

### Memory Metrics

#### Heap Used
Memory allocated on the JavaScript heap.

```javascript
const memory = process.memoryUsage();
console.log(memory.heapUsed); // Bytes of heap memory in use
```

**What it means**: Active JavaScript objects and data

#### Heap Total
Total size of the heap.

**What it means**: Memory reserved by the runtime

#### RSS (Resident Set Size)
Total memory used by the process.

**What it means**: Actual memory consumption including heap, stack, and V8

#### External
Memory used by C++ objects bound to JavaScript.

**What it means**: Native memory allocations

### Throughput Metrics

#### Operations Per Second
How many operations complete in one second.

```
ops/sec = 1000 / mean_time_ms
```

**Use when**: Comparing different implementations

#### Files Per Second
How many files are processed per second.

```
files/sec = file_count * 1000 / mean_time_ms
```

**Use when**: Capacity planning

#### Bytes Per Second
Throughput in terms of data processed.

```
bytes/sec = total_content_size / mean_time_seconds
```

**Use when**: I/O-bound operations

## Baseline Management

Baselines allow you to track performance over time and detect regressions.

### Saving a Baseline

```bash
# Save current performance as baseline
kustomark benchmark run --save-baseline main

# Save with descriptive name
kustomark benchmark run --save-baseline v2.0.0-release
```

Baselines are stored in `.kustomark/benchmarks/baselines/`:

```
.kustomark/
└── benchmarks/
    ├── baselines/
    │   ├── main.json
    │   ├── v2.0.0-release.json
    │   └── optimize-regex.json
    ├── history/
    │   └── 2024-02-01T10:30:00.000Z.json
    └── latest.json
```

### Listing Baselines

```bash
kustomark benchmark list
```

**Output:**
```
Available Baselines:

  main
    Date: 2/1/2024, 10:30:00 AM
    Results: 45
    Platform: linux (x64)
    Bun: 1.1.0

  v2.0.0-release
    Date: 1/15/2024, 3:45:00 PM
    Results: 45
    Platform: linux (x64)
    Bun: 1.1.0
```

### Loading and Comparing

```bash
# Compare against specific baseline
kustomark benchmark run --baseline main

# Compare and save as new baseline
kustomark benchmark run \
  --baseline v1.0.0 \
  --save-baseline v2.0.0
```

### Baseline File Format

Baselines are stored as JSON:

```json
{
  "name": "main",
  "timestamp": "2024-02-01T10:30:00.000Z",
  "result": {
    "timestamp": "2024-02-01T10:30:00.000Z",
    "environment": {
      "platform": "linux",
      "arch": "x64",
      "bunVersion": "1.1.0",
      "cpuCount": 8,
      "totalMemory": 17179869184
    },
    "results": [
      {
        "operation": "replace",
        "fileCount": 10,
        "complexity": "medium",
        "runs": 10,
        "timing": {
          "mean": 2.45,
          "median": 2.42,
          "min": 2.31,
          "max": 2.89,
          "p95": 2.76,
          "p99": 2.89,
          "stdDev": 0.18
        },
        "memory": {
          "heapUsed": 524288,
          "heapTotal": 1048576,
          "external": 102400,
          "rss": 1290240
        },
        "throughput": {
          "filesPerSecond": 4081.63,
          "operationsPerSecond": 40816.33,
          "bytesPerSecond": 2048000
        }
      }
    ],
    "summary": {
      "totalDuration": 45230,
      "totalOperations": 12000,
      "averageThroughput": 4234.56
    }
  }
}
```

## Creating Custom Benchmarks

### Programmatic API

Create custom benchmark scripts using the benchmark engine API:

```typescript
import {
  generateTestContent,
  runBenchmark,
  printBenchmarkResult,
  type BenchmarkConfig,
} from "kustomark";

// Define benchmark configuration
const config: BenchmarkConfig = {
  name: "Custom Replace Benchmark",
  patches: [
    {
      op: "replace",
      old: "foo",
      new: "bar",
    },
  ],
  content: generateTestContent(50, "medium"),
  warmupRuns: 5,
  benchmarkRuns: 100,
  measureMemory: true,
};

// Run the benchmark
const result = await runBenchmark(config);

// Print formatted results
printBenchmarkResult(result);
```

### Custom Content Generation

Generate specific test content:

```typescript
import { generateTestContent } from "kustomark";

// Simple content: basic headers and text
const simple = generateTestContent(10, "simple");

// Medium content: sections, lists, code blocks
const medium = generateTestContent(10, "medium");

// Complex content: frontmatter, tables, nested sections
const complex = generateTestContent(10, "complex");
```

### Custom Test Content

Create domain-specific test content:

```typescript
function generateApiDocs(count: number): Map<string, string> {
  const content = new Map<string, string>();

  for (let i = 0; i < count; i++) {
    const doc = `---
title: API Endpoint ${i}
version: 1.0.0
---

# ${i}. GET /api/resource

## Description

Retrieve resource information.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Resource ID |
| format | string | No | Response format |

## Response

\`\`\`json
{
  "id": "resource-${i}",
  "name": "Resource ${i}",
  "status": "active"
}
\`\`\`
`;
    content.set(`endpoint-${i}.md`, doc);
  }

  return content;
}

// Use in benchmark
const config: BenchmarkConfig = {
  name: "API Documentation Benchmark",
  patches: [
    { op: "set-frontmatter", key: "reviewed", value: true },
    { op: "replace", old: "1.0.0", new: "2.0.0" },
  ],
  content: generateApiDocs(100),
  warmupRuns: 5,
  benchmarkRuns: 50,
};
```

### Complete Example

```typescript
#!/usr/bin/env bun

import {
  runBenchmark,
  printBenchmarkResult,
  formatTime,
  formatBytes,
  type BenchmarkConfig,
  type PatchOperation,
} from "kustomark";

// Generate realistic documentation content
function generateDocs(count: number): Map<string, string> {
  const docs = new Map<string, string>();

  for (let i = 0; i < count; i++) {
    docs.set(`doc-${i}.md`, `---
title: Document ${i}
author: Team
version: 1.0.0
tags: [documentation, guide]
---

# Introduction

This is document ${i} in our documentation set.

## Overview

Content goes here with various **formatting** and *styles*.

### Details

- Point 1
- Point 2
- Point 3

## Code Example

\`\`\`javascript
function example${i}() {
  return "Hello from doc ${i}";
}
\`\`\`

## Conclusion

Final thoughts and next steps.
`);
  }

  return docs;
}

// Run multiple benchmarks
async function main() {
  const operations: PatchOperation[][] = [
    // Simple replace
    [{ op: "replace", old: "Team", new: "Engineering Team" }],

    // Frontmatter update
    [{ op: "set-frontmatter", key: "version", value: "2.0.0" }],

    // Complex multi-patch
    [
      { op: "set-frontmatter", key: "updated", value: new Date().toISOString() },
      { op: "replace", old: "1.0.0", new: "2.0.0" },
      { op: "append-to-section", id: "introduction", content: "\nUpdated content.\n" },
    ],
  ];

  const names = ["Simple Replace", "Frontmatter Update", "Multi-Patch"];
  const fileCounts = [10, 50, 100];

  for (let i = 0; i < operations.length; i++) {
    for (const fileCount of fileCounts) {
      const config: BenchmarkConfig = {
        name: `${names[i]} - ${fileCount} files`,
        patches: operations[i],
        content: generateDocs(fileCount),
        warmupRuns: 5,
        benchmarkRuns: 50,
        measureMemory: true,
      };

      console.log(`\nRunning: ${config.name}`);
      const result = await runBenchmark(config);

      // Custom result formatting
      console.log(`  Mean: ${formatTime(result.timing.statistics.mean)}`);
      console.log(`  P95: ${formatTime(result.timing.statistics.p95)}`);
      console.log(`  Memory: ${formatBytes(result.memory?.heapDelta ?? 0)}`);
      console.log(`  Throughput: ${result.opsPerSecond.toFixed(2)} ops/s`);
    }
  }
}

main();
```

**Run it:**
```bash
chmod +x my-benchmark.ts
bun run my-benchmark.ts
```

## Comparing Performance

### Version Comparison

Compare performance between versions:

```bash
# Baseline from v1.0
git checkout v1.0.0
kustomark benchmark run --save-baseline v1.0.0

# Compare with v2.0
git checkout v2.0.0
kustomark benchmark run --baseline v1.0.0
```

**Output:**
```
Baseline Comparison:
  Improvements: 15
  Regressions: 2
  Unchanged: 28

  Regressions detected:
    replace (50 files): +12.5%
    append (100 files): +8.3%
```

### Feature Branch Comparison

```bash
# Save main baseline
git checkout main
kustomark benchmark run --save-baseline main

# Compare feature branch
git checkout feature/optimize-regex
kustomark benchmark run \
  --baseline main \
  --format markdown \
  --output perf-comparison.md
```

### Detecting Regressions

Regressions are automatically detected when:

- Mean timing increases > 10%
- Median timing increases > 10%
- Memory usage increases > 20%

**Example regression report:**
```
Baseline Comparison:

Improvements: 12
Regressions: 1
Unchanged: 32

Regressions detected:
  replace-regex (100 files): +15.7% (red flag)
```

## Interpreting Results

### Good Performance Indicators

1. **Low standard deviation** (< 10% of mean)
   - Indicates consistent, predictable performance

2. **P95 close to median** (< 2x median)
   - Shows minimal outliers, stable performance

3. **Linear scaling** with file count
   - Performance scales predictably

4. **Stable memory usage**
   - No memory leaks or excessive allocations

### Warning Signs

1. **High standard deviation** (> 20% of mean)
   - Inconsistent performance, investigate causes

2. **P95 >> median** (> 3x median)
   - Frequent outliers, check for GC pauses or I/O

3. **Superlinear scaling**
   - Performance degrades faster than input size

4. **Growing memory usage**
   - Potential memory leak

### Example Analysis

```
replace operation:
  10 files: 2.45ms (median: 2.42ms, p95: 2.89ms)
  50 files: 11.23ms (median: 11.15ms, p95: 12.67ms)
  100 files: 22.15ms (median: 21.98ms, p95: 24.32ms)
```

**Analysis:**
- Linear scaling: 10 files → 50 files = 4.6x time (5x expected)
- Low variance: P95 only 10-20% higher than median
- Consistent behavior across file counts
- **Conclusion**: Healthy, predictable performance

## Troubleshooting

### High Variance in Results

**Symptoms:**
- Standard deviation > 20% of mean
- Large gap between min and max times

**Causes:**
- Background processes consuming resources
- Garbage collection pauses
- Insufficient warmup runs

**Solutions:**
```bash
# Increase warmup runs
kustomark benchmark run --warmup 10

# Increase benchmark runs for better averaging
kustomark benchmark run --runs 100

# Close background applications
# Run on dedicated benchmark machine
```

### Unexpected Memory Growth

**Symptoms:**
- Memory usage increases with file count more than expected
- Different runs show different memory usage

**Causes:**
- Memory not released between runs
- Cached data accumulating
- Large intermediate objects

**Solutions:**
```typescript
// Force garbage collection between runs
if (global.gc) {
  global.gc();
}

// Use streaming for large files
// Break work into smaller chunks
```

### Inconsistent Baseline Comparisons

**Symptoms:**
- Same code shows different performance against baseline
- Fluctuating regression reports

**Causes:**
- Different hardware
- Different Node/Bun versions
- Different system load

**Solutions:**
- Always compare on same hardware
- Document environment in baseline
- Use percentage thresholds (e.g., > 15% regression)
- Run multiple times and average

### Benchmark Takes Too Long

**Symptoms:**
- Benchmarks take minutes to complete

**Solutions:**
```bash
# Reduce runs
kustomark benchmark run --warmup 3 --runs 10

# Test fewer operations
kustomark benchmark run --operations replace,append

# Test smaller file counts
kustomarm benchmark run --file-counts 10,50
```

## Best Practices

1. **Run on consistent hardware** for comparisons
2. **Close background applications** during benchmarking
3. **Use adequate warmup runs** (5-10) to stabilize runtime
4. **Run enough iterations** (50-100) for statistical significance
5. **Save baselines** for important milestones
6. **Document environment** in baseline names
7. **Track trends over time** not just single comparisons
8. **Investigate all regressions** before merging changes
9. **Use JSON output** for automated analysis
10. **Run benchmarks in CI** to catch regressions early

## Next Steps

- [Optimize your configuration](./optimization-guide.md)
- [Set up CI integration](./ci-integration.md)
- [Profile memory usage](./profiling.md)
