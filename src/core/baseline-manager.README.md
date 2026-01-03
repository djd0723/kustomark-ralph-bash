# Baseline Manager

The Baseline Manager is a comprehensive system for managing performance baselines, detecting regressions, and tracking performance trends in Kustomark.

## Features

- **Version-Tagged Baselines**: Save and load baselines with version identifiers (e.g., `v1.0.0`, `main`, `feature-branch`)
- **Regression Detection**: Automatically detect performance regressions with configurable thresholds
- **Memory Tracking**: Monitor memory usage changes across versions
- **History Management**: Track all baselines with timestamps and metadata
- **Report Generation**: Export comparison reports in JSON and Markdown formats
- **Comprehensive Metadata**: Store system information (Bun version, platform, CPU count, memory)

## Installation

The Baseline Manager is part of the core library:

```typescript
import { BaselineManager } from "@kustomark/core";
```

## Quick Start

### Basic Usage

```typescript
import { BaselineManager } from "@kustomark/core";
import type { BenchmarkSuiteResult } from "@kustomark/core";

// Create a manager instance
const manager = new BaselineManager({
  baseDir: process.cwd(),
  timingThreshold: 10,  // Flag timing regressions > 10%
  memoryThreshold: 20,  // Flag memory regressions > 20%
});

// Generate and save a baseline
const baselineResults = await runBenchmarkSuite();
await manager.generateBaselineForVersion("v1.0.0", baselineResults);

// Compare current results with baseline
const currentResults = await runBenchmarkSuite();
const comparison = await manager.compareWithBaseline(currentResults, "v1.0.0");

if (comparison.hasRegressions) {
  console.log("Performance regressions detected!");
  console.log(await manager.exportBaselineReport("markdown"));
  process.exit(1);
}
```

## API Reference

### Constructor

```typescript
new BaselineManager(options?: BaselineManagerOptions)
```

**Options:**
- `baseDir?: string` - Base directory for storage (defaults to `process.cwd()`)
- `timingThreshold?: number` - Timing regression threshold in % (default: 10)
- `memoryThreshold?: number` - Memory regression threshold in % (default: 20)

### Methods

#### `generateBaselineForVersion(version: string, results: BenchmarkSuiteResult): Promise<void>`

Generate and save a baseline for a specific version.

**Parameters:**
- `version` - Version identifier (alphanumeric, dots, hyphens, underscores)
- `results` - Benchmark suite results to save

**Example:**
```typescript
await manager.generateBaselineForVersion("v1.0.0", benchmarkResults);
```

#### `loadBaselineForVersion(version: string): Promise<BaselineRecord | null>`

Load an existing baseline.

**Returns:** Baseline record or `null` if not found

**Example:**
```typescript
const baseline = await manager.loadBaselineForVersion("v1.0.0");
if (baseline) {
  console.log(`Loaded baseline from ${baseline.metadata.timestamp}`);
}
```

#### `compareWithBaseline(current: BenchmarkSuiteResult, baselineVersion: string): Promise<BaselineComparisonResult>`

Compare current results with a baseline and detect regressions.

**Returns:** Detailed comparison result with regression detection

**Example:**
```typescript
const comparison = await manager.compareWithBaseline(currentResults, "v1.0.0");
console.log(`Regressions: ${comparison.regressions.length}`);
console.log(`Improvements: ${comparison.improvements.length}`);
```

#### `getBaselineHistory(): Promise<BaselineHistoryEntry[]>`

Get a list of all saved baselines, sorted by timestamp (newest first).

**Example:**
```typescript
const history = await manager.getBaselineHistory();
for (const entry of history) {
  console.log(`${entry.version}: ${entry.resultCount} results - ${entry.timestamp}`);
}
```

#### `exportBaselineReport(format: 'json' | 'markdown'): Promise<string>`

Export the last comparison result as a formatted report.

**Note:** Must call `compareWithBaseline()` first.

**Example:**
```typescript
await manager.compareWithBaseline(currentResults, "v1.0.0");

// Export as JSON
const jsonReport = await manager.exportBaselineReport("json");
await writeFile("report.json", jsonReport);

// Export as Markdown
const mdReport = await manager.exportBaselineReport("markdown");
console.log(mdReport);
```

## Storage Structure

Baselines are stored in `.kustomark/benchmarks/baselines/` with the following structure:

```
.kustomark/
└── benchmarks/
    └── baselines/
        ├── v1.0.0.json
        ├── v1.1.0.json
        ├── main.json
        └── feature-branch.json
```

Each baseline file contains:
```json
{
  "metadata": {
    "version": "v1.0.0",
    "timestamp": "2026-01-03T00:00:00.000Z",
    "bunVersion": "1.0.0",
    "platform": "linux",
    "arch": "x64",
    "cpuCount": 8,
    "totalMemory": 16000000000
  },
  "results": {
    "timestamp": "2026-01-03T00:00:00.000Z",
    "environment": { ... },
    "results": [ ... ],
    "summary": { ... }
  }
}
```

## Regression Detection

### Timing Regressions

A timing regression is detected when:
- Mean execution time increases by more than `timingThreshold` %
- OR Median execution time increases by more than `timingThreshold` %

Default threshold: **10%**

### Memory Regressions

A memory regression is detected when:
- Heap memory usage increases by more than `memoryThreshold` %

Default threshold: **20%**

### Improvements

An improvement is detected when:
- Mean or median execution time decreases
- AND memory usage doesn't increase beyond the memory threshold

## Report Formats

### JSON Report

Complete comparison data in JSON format, suitable for:
- CI/CD integration
- Automated analysis
- Custom reporting tools

```typescript
const jsonReport = await manager.exportBaselineReport("json");
const data = JSON.parse(jsonReport);
// Access: data.regressions, data.improvements, data.comparisons
```

### Markdown Report

Human-readable report with:
- Metadata (versions, timestamps, environment)
- Summary (total comparisons, regressions, improvements)
- Regression table with color-coded changes
- Improvements table
- Detailed comparison table

**Example Output:**
```markdown
# Benchmark Comparison Report

## Metadata
**Baseline Version:** v1.0.0
**Baseline Timestamp:** 2026-01-03T00:00:00.000Z

## Summary
- **Total Comparisons:** 5
- **Regressions:** 2
- **Improvements:** 1
- **Status:** ⚠️ REGRESSIONS DETECTED

## Regressions
| Operation | Files | Mean Change | Median Change | Memory Change |
|-----------|-------|-------------|---------------|---------------|
| replace | 10 | 🔴 +15.00% | 🔴 +14.50% | +0.00% |
```

## Best Practices

### 1. Consistent Versioning

Use consistent version identifiers:
```typescript
// Good
"v1.0.0", "v1.1.0", "v2.0.0"
"main", "develop", "feature-x"

// Avoid
"version 1.0", "my baseline", "test 123"
```

### 2. Regular Baseline Updates

Update baselines when making intentional performance changes:
```typescript
// After optimization
await manager.generateBaselineForVersion("v1.1.0", optimizedResults);

// After major refactor
await manager.generateBaselineForVersion("v2.0.0", refactoredResults);
```

### 3. CI/CD Integration

Fail builds on regressions:
```typescript
const comparison = await manager.compareWithBaseline(current, "main");

if (comparison.hasRegressions) {
  console.error("Performance regressions detected!");
  console.log(await manager.exportBaselineReport("markdown"));
  process.exit(1);
}
```

### 4. Custom Thresholds

Adjust thresholds based on your requirements:
```typescript
// Stricter thresholds
const strictManager = new BaselineManager({
  timingThreshold: 5,   // 5% timing threshold
  memoryThreshold: 10,  // 10% memory threshold
});

// More lenient for development
const devManager = new BaselineManager({
  timingThreshold: 20,  // 20% timing threshold
  memoryThreshold: 30,  // 30% memory threshold
});
```

### 5. Historical Tracking

Keep track of performance over time:
```typescript
const history = await manager.getBaselineHistory();

// Find oldest and newest baselines
const oldest = history[history.length - 1];
const newest = history[0];

console.log(`Performance tracking since ${oldest?.timestamp}`);
```

## Common Patterns

### Pre-Release Baseline

```typescript
// Before releasing v2.0.0, create a baseline
const preReleaseResults = await runBenchmarkSuite();
await manager.generateBaselineForVersion("v2.0.0-rc.1", preReleaseResults);

// Test against RC baseline
const finalResults = await runBenchmarkSuite();
const comparison = await manager.compareWithBaseline(
  finalResults,
  "v2.0.0-rc.1"
);
```

### Branch-Specific Baselines

```typescript
// Create baseline for feature branch
const featureResults = await runBenchmarkSuite();
await manager.generateBaselineForVersion("feature-optimization", featureResults);

// Compare with main
const comparison = await manager.compareWithBaseline(featureResults, "main");
```

### Automated Reporting

```typescript
async function generatePerformanceReport() {
  const manager = new BaselineManager();
  const current = await runBenchmarkSuite();

  try {
    const comparison = await manager.compareWithBaseline(current, "main");
    const report = await manager.exportBaselineReport("markdown");

    // Send to Slack, email, etc.
    await sendNotification({
      title: comparison.hasRegressions ? "⚠️ Regressions" : "✅ No Issues",
      body: report,
    });
  } catch (error) {
    console.error("Baseline comparison failed:", error);
  }
}
```

## Error Handling

```typescript
try {
  await manager.generateBaselineForVersion("v1.0.0", results);
} catch (error) {
  if (error.message.includes("reserved name")) {
    console.error("Cannot use 'latest' as version name");
  } else if (error.message.includes("alphanumeric")) {
    console.error("Invalid version format");
  } else {
    console.error("Failed to save baseline:", error);
  }
}
```

## TypeScript Types

```typescript
interface BaselineManagerOptions {
  baseDir?: string;
  timingThreshold?: number;
  memoryThreshold?: number;
}

interface BaselineMetadata {
  version: string;
  timestamp: string;
  bunVersion: string;
  platform: string;
  arch: string;
  cpuCount: number;
  totalMemory: number;
  kustomarkVersion?: string;
}

interface BaselineRecord {
  metadata: BaselineMetadata;
  results: BenchmarkSuiteResult;
}

interface BaselineComparisonResult {
  baselineVersion: string;
  baselineMetadata: BaselineMetadata;
  currentMetadata: BaselineMetadata;
  comparisons: BenchmarkComparison[];
  regressions: BenchmarkComparison[];
  improvements: BenchmarkComparison[];
  memoryRegressions: BenchmarkComparison[];
  hasRegressions: boolean;
}

interface BaselineHistoryEntry {
  version: string;
  timestamp: string;
  filePath: string;
  resultCount: number;
}
```

## Examples

See:
- `examples/baseline-manager-example.ts` - Complete usage example
- `src/core/baseline-manager.test.ts` - Comprehensive test suite

## Related

- **Benchmark Engine** (`benchmark-engine.ts`) - Run performance benchmarks
- **Benchmark Storage** (`benchmark-storage.ts`) - Low-level baseline storage
- **Benchmark Suites** (`benchmark-suites.ts`) - Predefined benchmark configurations
