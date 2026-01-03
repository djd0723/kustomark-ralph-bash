# Performance Documentation

Comprehensive guide to understanding, measuring, and optimizing kustomark performance.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Documentation Index](#documentation-index)
- [Performance Characteristics](#performance-characteristics)
- [Common Use Cases](#common-use-cases)

## Overview

Kustomark is designed for high-performance markdown processing with efficient patching operations. This documentation will help you:

- **Measure** performance using built-in benchmarking tools
- **Optimize** your patch configurations for maximum throughput
- **Profile** memory usage and identify bottlenecks
- **Integrate** performance testing into CI/CD pipelines

## Quick Start

### Run a Quick Benchmark

```bash
# Benchmark all patch operations
kustomark benchmark run

# Benchmark specific operations
kustomark benchmark run --operations replace,append,prepend

# Save results as a baseline
kustomark benchmark run --save-baseline main
```

### Compare Performance

```bash
# Compare current performance against baseline
kustomark benchmark run --baseline main

# List available baselines
kustomark benchmark list
```

### Enable Performance Optimizations

```yaml
# kustomark.yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

# Enable parallel builds
parallel: true
jobs: 4

# Enable incremental builds
incremental: true

resources:
  - ../base/

patches:
  - op: replace
    old: "foo"
    new: "bar"
```

### Build with Performance Monitoring

```bash
# Parallel build with statistics
kustomark build . --parallel --stats

# Incremental build
kustomark build . --incremental

# Clean cache and rebuild
kustomark build . --clean-cache
```

## Documentation Index

### [Benchmarking Guide](./benchmarking.md)
Learn how to run benchmarks, interpret results, and compare performance across versions.

**Topics:**
- Running benchmarks
- Understanding metrics (mean, median, p95, p99)
- Creating custom benchmarks
- Baseline management
- Performance regression detection

### [Optimization Guide](./optimization-guide.md)
Best practices for optimizing kustomark configurations and builds.

**Topics:**
- Patch organization strategies
- Groups vs conditions
- Cache optimization
- Large file handling
- Memory-constrained environments
- CI/CD optimization

### [Profiling Guide](./profiling.md)
Deep dive into profiling memory usage and identifying bottlenecks.

**Topics:**
- Memory profiling workflow
- Identifying memory leaks
- CPU profiling
- Performance bottleneck detection
- Tools and techniques

### [CI Integration Guide](./ci-integration.md)
Integrate performance testing into your CI/CD pipeline.

**Topics:**
- Setting up performance tests in CI
- Regression detection
- Baseline management
- PR performance reports
- GitHub Actions examples

## Performance Characteristics

### Throughput

Kustomark can process thousands of files per second depending on:

- **File size**: Smaller files process faster
- **Patch complexity**: Simple operations (replace) are faster than complex ones (table operations)
- **Number of patches**: Linear scaling with patch count
- **File count**: Parallel builds scale with CPU cores

**Typical Performance** (on modern hardware):

| Operation | Simple Files | Medium Files | Complex Files |
|-----------|--------------|--------------|---------------|
| Replace | 1000+ ops/s | 500+ ops/s | 200+ ops/s |
| Section ops | 800+ ops/s | 400+ ops/s | 150+ ops/s |
| Table ops | 600+ ops/s | 300+ ops/s | 100+ ops/s |
| Frontmatter | 900+ ops/s | 450+ ops/s | 180+ ops/s |

### Memory Usage

Memory usage scales linearly with:

- Number of files loaded in memory
- File sizes
- Number of concurrent operations (parallel mode)

**Memory Efficiency:**
- Average: 1-5 MB per 100 files (simple documents)
- Peak: 10-50 MB per 100 files (complex documents with tables)

### Build Modes

#### Sequential Build
```bash
kustomark build .
```
- **Pros**: Minimal memory usage, deterministic order
- **Cons**: Slower for large file sets
- **Use when**: Memory is constrained, order matters

#### Parallel Build
```bash
kustomark build . --parallel --jobs 4
```
- **Pros**: 2-4x faster with multiple cores
- **Cons**: Higher memory usage
- **Use when**: Processing many files, performance critical

#### Incremental Build
```bash
kustomark build . --incremental
```
- **Pros**: Only rebuilds changed files, very fast for updates
- **Cons**: Requires cache storage
- **Use when**: Iterative development, CI/CD

## Common Use Cases

### Development Workflow

**Scenario**: Rapid iteration during development

```bash
# Use incremental builds for fast feedback
kustomark build . --incremental

# Use watch mode for automatic rebuilds
kustomark watch .
```

**Expected Performance**: 10-100ms for small changes

### CI/CD Pipeline

**Scenario**: Building documentation in CI

```bash
# Use parallel builds for speed
kustomark build . --parallel --jobs 4

# Compare against baseline
kustomark benchmark run --baseline main --format json > perf-report.json
```

**Expected Performance**: 1-5 seconds for typical projects

### Large Documentation Sites

**Scenario**: Processing 1000+ markdown files

```yaml
# kustomark.yaml - optimized for large sites
apiVersion: kustomark/v1
kind: Kustomization

output: ./output
parallel: true
jobs: 8
incremental: true

resources:
  - ../docs/**/*.md

# Group patches by file type for efficiency
patchGroups:
  - name: headers
    selector:
      filePattern: "*.md"
    patches:
      - op: replace
        old: "Company Name"
        new: "ACME Corp"
```

**Expected Performance**: 5-30 seconds for full rebuild, <1 second for incremental

### Memory-Constrained Environments

**Scenario**: Running on limited hardware (CI runners, containers)

```bash
# Sequential build with minimal memory
kustomark build . --jobs 1

# Or small batch parallel
kustomark build . --parallel --jobs 2
```

**Memory Usage**: 50-200 MB typical

## Getting Help

- **Slow builds?** See [Optimization Guide](./optimization-guide.md)
- **Memory issues?** See [Profiling Guide](./profiling.md)
- **CI integration?** See [CI Integration Guide](./ci-integration.md)
- **Benchmarking?** See [Benchmarking Guide](./benchmarking.md)

## Performance Tips

1. **Use patch groups** to organize related patches
2. **Enable incremental builds** for development
3. **Use parallel builds** in CI/CD
4. **Monitor baselines** to catch regressions early
5. **Profile before optimizing** to find real bottlenecks

## Next Steps

- [Run your first benchmark](./benchmarking.md#quick-start)
- [Optimize your configuration](./optimization-guide.md#best-practices)
- [Set up CI performance tests](./ci-integration.md#github-actions)
