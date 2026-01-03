# Performance Benchmarks

This directory contains the performance benchmarking infrastructure for kustomark.

## Directory Structure

```
benchmarks/
├── baselines/           # Baseline benchmark results
│   └── main.json       # Main branch baseline
├── history/            # Historical benchmark runs (created at runtime)
└── README.md           # This file
```

## Baseline Files

Baseline files store reference performance measurements that are used to detect regressions.

### Main Baseline (`baselines/main.json`)

The `main.json` baseline represents the expected performance of the main branch. It is automatically updated when changes are merged to main.

**Structure:**
```json
{
  "timestamp": "ISO 8601 timestamp",
  "environment": {
    "platform": "linux",
    "arch": "x64",
    "bunVersion": "1.0.0",
    "cpuCount": 4,
    "totalMemory": 17179869184
  },
  "results": [
    {
      "operation": "replace",
      "fileCount": 10,
      "complexity": "simple",
      "runs": 10,
      "timing": {
        "mean": 2.5,
        "median": 2.4,
        "min": 2.2,
        "max": 2.8,
        "p95": 2.7,
        "p99": 2.8,
        "stdDev": 0.15
      },
      "memory": {
        "heapUsed": 1048576,
        "heapTotal": 2097152,
        "external": 524288,
        "rss": 20971520
      },
      "throughput": {
        "filesPerSecond": 4000,
        "operationsPerSecond": 4000,
        "bytesPerSecond": 2097152
      }
    }
  ],
  "summary": {
    "totalDuration": 150.5,
    "totalOperations": 1800,
    "averageThroughput": 4183
  }
}
```

## Benchmark Suites

### Quick Suite (PR Testing)

Used for pull request validation. Runs a subset of benchmarks:
- 6 benchmark scenarios
- 10 runs per scenario
- 3 warmup runs
- ~1-2 minutes execution time

**Operations tested:**
- `replace` (simple, medium, complex - 10, 50, 100 files)
- `append-to-section` (simple, medium - 10, 50 files)
- `replace-section` (medium - 10 files)

### Full Suite (Main Branch)

Used for baseline updates on main branch. Comprehensive testing:
- 30+ benchmark scenarios
- 20 runs per scenario
- 5 warmup runs
- ~5-10 minutes execution time

**Operations tested:**
- All content operations (replace, append, prepend, etc.)
- Section operations
- Frontmatter operations
- Regex operations
- Multiple file counts and complexity levels

## Running Benchmarks Locally

### Generate a New Baseline

```bash
# Generate default baseline
./scripts/generate-baseline.sh

# Generate with custom parameters
./scripts/generate-baseline.sh --name test --suite quick --runs 10
```

### Run Benchmarks Only

```bash
# Quick suite
bun run scripts/run-benchmarks.ts --suite quick --output results.json

# Full suite
bun run scripts/run-benchmarks.ts --suite full --runs 20 --warmup 5
```

### Compare with Baseline

```bash
# Compare current results with main baseline
bun run scripts/compare-benchmarks.ts \
  --baseline benchmarks/baselines/main.json \
  --current benchmark-results.json \
  --threshold 10 \
  --markdown comparison.md
```

## CI/CD Integration

The performance regression testing is integrated into GitHub Actions via `.github/workflows/performance.yml`.

### Pull Request Flow

1. PR is opened
2. Quick benchmark suite runs (10 iterations)
3. Results compared with `baselines/main.json`
4. PR comment posted with results
5. Workflow fails if critical regressions (>10%) detected

### Main Branch Flow

1. PR merged to main
2. Full benchmark suite runs (20 iterations)
3. Results compared with current baseline
4. New baseline saved as `baselines/main.json`
5. Baseline committed back to repository

## Performance Thresholds

### Regression Detection

- **Warning Threshold**: 10% performance degradation
  - Reported in PR comments
  - Does not fail workflow

- **Critical Threshold**: 10% mean performance degradation
  - Fails workflow
  - Blocks merge (if enabled)
  - Requires investigation

### Metrics Monitored

1. **Timing Metrics**
   - Mean execution time
   - Median execution time
   - P95 and P99 latencies
   - Standard deviation

2. **Memory Metrics**
   - Heap usage
   - Total heap size
   - External memory
   - RSS

3. **Throughput Metrics**
   - Files per second
   - Operations per second
   - Bytes per second

## Interpreting Results

### PR Comment Format

```markdown
## ✅ Performance Check Passed

### Summary
| Metric | Count |
|--------|-------|
| Total Comparisons | 6 |
| Improvements | 2 ✅ |
| Regressions | 0 ⚠️ |
| Critical Regressions | 0 🔴 |
| Unchanged | 4 |

### Detailed Results
| Operation | Files | Mean Time | Change |
|-----------|-------|-----------|--------|
| replace | 10 | 2.45ms | ✅ -2.0% |
| replace | 50 | 8.30ms | ➖ +0.5% |
```

### Symbols

- ✅ **Green check**: Performance improvement or no significant change
- ⚠️ **Yellow warning**: Minor regression (<10%)
- 🔴 **Red circle**: Critical regression (>10%)
- ➖ **Neutral**: Change below threshold

## Troubleshooting

### Baseline Not Found

If the baseline doesn't exist yet:
1. Run `./scripts/generate-baseline.sh` locally
2. Commit `benchmarks/baselines/main.json`
3. Push to main branch

### Inconsistent Results

Performance benchmarks can vary due to:
- System load
- CPU throttling
- Background processes
- Memory pressure

**Solutions:**
- Increase number of runs (`--runs`)
- Increase warmup runs (`--warmup`)
- Run on clean system
- Use same hardware/environment

### False Positives

If you see regressions that aren't real:
1. Check if environment changed (CPU, memory, Bun version)
2. Re-run benchmarks multiple times
3. Adjust threshold if needed
4. Update baseline if legitimate performance change

## Best Practices

1. **Keep baselines up-to-date**: Update after significant changes
2. **Run locally first**: Test performance changes before pushing
3. **Investigate regressions**: Don't ignore performance warnings
4. **Document changes**: Note why baseline changed in commits
5. **Monitor trends**: Track performance over time

## Related Documentation

- [Benchmark Engine](../src/core/benchmark-engine.ts) - Core benchmarking implementation
- [Benchmark Storage](../src/core/benchmark-storage.ts) - Baseline management
- [Performance Workflow](../.github/workflows/performance.yml) - CI/CD configuration
