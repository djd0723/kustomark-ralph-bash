# Parallel Builds Feature

## Overview

Kustomark now supports parallel processing of files to significantly speed up builds for projects with many files. The parallel mode processes files concurrently while keeping patches sequential within each file to ensure correctness.

## Usage

### Basic Usage

Enable parallel mode with the `--parallel` flag:

```bash
kustomark build . --parallel
```

### Control Concurrency

Specify the number of parallel jobs with `--jobs`:

```bash
kustomark build . --parallel --jobs=4
```

By default, kustomark uses the number of CPU cores available on your system.

### With Statistics

Combine with `--stats` to see performance metrics:

```bash
kustomark build . --parallel --stats
```

Output example:
```
Built 100 file(s) with 350 patch(es) applied

Build Statistics:
  Duration: 234ms
  Files processed: 100
  Files written: 100
  Patches applied: 350
  Patches skipped: 0
  Total bytes: 52480
  By operation:
    replace: 200
    set-frontmatter: 100
    remove-section: 50
```

## Implementation Details

### Architecture

1. **File-Level Parallelization**: Files are processed concurrently
2. **Sequential Patches**: Patches within each file are applied sequentially
3. **Concurrency Control**: Limits concurrent operations to prevent resource exhaustion
4. **Deterministic Output**: Results are sorted to ensure consistent ordering

### Key Components

- `applyPatchesParallel()`: Main parallel processing function
- `createConcurrencyLimiter()`: Controls concurrent operation limits
- `writeFilesParallel()`: Async batch file writing with concurrency control

### Performance Characteristics

- **Best Case**: Projects with many files and moderate patches per file
- **Scaling**: Linear speedup up to CPU core count
- **Overhead**: Minimal for small projects (<10 files)
- **Memory**: Constant overhead, similar to sequential mode

## Backward Compatibility

- **Default Mode**: Sequential (parallel mode is opt-in)
- **Identical Output**: Same results as sequential mode
- **API Compatibility**: All existing flags work with `--parallel`

## Examples

### Large Project

```bash
# Process 500 markdown files with 8 parallel jobs
kustomark build ./docs --parallel --jobs=8 --stats
```

### CI/CD Pipeline

```bash
# Use parallel mode with verbose logging
kustomark build . --parallel --jobs=2 -vv
```

### Development

```bash
# Quick builds during development
kustomark build . --parallel --clean
```

## Testing

The parallel builds feature includes comprehensive test coverage:

- Identical output verification (sequential vs parallel)
- Statistics accuracy
- Job limit respect
- Deterministic operation counts
- Validation error handling
- Backward compatibility

Run tests with:
```bash
bun test tests/cli/parallel.test.ts
```

## Troubleshooting

### Performance Not Improving

If parallel mode doesn't improve performance:
- Check if you have few files (parallel overhead may dominate)
- Verify CPU usage (you may be I/O bound)
- Try different `--jobs` values

### Different Results

If you see different results between sequential and parallel:
- File a bug report (this shouldn't happen!)
- Include your kustomark.yaml and sample files
- Mention the `--jobs` value used

### Memory Issues

If you encounter memory issues:
- Reduce `--jobs` value
- Process files in smaller batches
- Check for memory leaks in custom validators

## Future Enhancements

Potential future improvements:
- Adaptive job count based on file size
- Progress bars for long-running builds
- Distributed processing across machines
- Caching for unchanged files
