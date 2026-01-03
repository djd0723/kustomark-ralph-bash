# Optimization Guide

Best practices and strategies for optimizing kustomark performance.

## Table of Contents

- [Overview](#overview)
- [Best Practices](#best-practices)
- [Patch Organization](#patch-organization)
- [Groups vs Conditions](#groups-vs-conditions)
- [Cache Optimization](#cache-optimization)
- [Large File Strategies](#large-file-strategies)
- [Memory-Constrained Environments](#memory-constrained-environments)
- [CI/CD Optimization](#cicd-optimization)
- [Anti-Patterns](#anti-patterns)
- [Real-World Examples](#real-world-examples)

## Overview

Kustomark performance depends on:

1. **Patch complexity** - Simple operations are faster
2. **File organization** - Efficient resource resolution
3. **Build mode** - Sequential vs parallel vs incremental
4. **Cache utilization** - Avoiding redundant work
5. **Memory management** - Keeping memory usage reasonable

This guide shows you how to optimize each of these factors.

## Best Practices

### 1. Order Patches Efficiently

Patches are applied sequentially. Order them for efficiency:

**Good:**
```yaml
patches:
  # Fast operations first
  - op: replace
    old: "v1.0"
    new: "v2.0"

  # Then section operations
  - op: append-to-section
    id: changelog
    content: "## v2.0 Changes"

  # Complex operations last
  - op: add-table-row
    table: 0
    values: ["Feature", "Status", "Priority"]
```

**Why**: If an early patch fails, you haven't wasted time on later expensive operations.

### 2. Use Specific Selectors

Target patches precisely to avoid unnecessary work:

**Bad:**
```yaml
patches:
  # Applies to ALL files
  - op: replace
    old: "Company"
    new: "ACME Corp"
```

**Good:**
```yaml
patches:
  # Only applies where needed
  - op: replace
    old: "Company"
    new: "ACME Corp"
    fileMatch: "*.md"
    condition:
      filePattern: "docs/**/*.md"
```

### 3. Minimize Regex Usage

Regular expressions are powerful but slower than literal strings:

**Slow:**
```yaml
patches:
  - op: replace-regex
    pattern: "foo"
    replacement: "bar"
    flags: "g"
```

**Fast:**
```yaml
patches:
  - op: replace
    old: "foo"
    new: "bar"
```

**Use regex when needed:**
```yaml
patches:
  # Good regex use case
  - op: replace-regex
    pattern: "version: \\d+\\.\\d+\\.\\d+"
    replacement: "version: 2.0.0"
    flags: "g"
```

### 4. Batch Similar Operations

Group similar changes together:

**Inefficient:**
```yaml
patches:
  - op: set-frontmatter
    key: author
    value: "Team A"

  - op: set-frontmatter
    key: version
    value: "2.0"

  - op: set-frontmatter
    key: updated
    value: "2024-02-01"
```

**Efficient:**
```yaml
patches:
  - op: merge-frontmatter
    values:
      author: "Team A"
      version: "2.0"
      updated: "2024-02-01"
```

### 5. Use Incremental Builds

For development, enable incremental builds:

```bash
# First build
kustomark build . --incremental

# Subsequent builds only process changed files
kustomark build . --incremental
```

**Benefits:**
- 10-100x faster for small changes
- Automatically tracks file modifications
- Works with watch mode

### 6. Enable Parallel Processing

For large file sets, use parallel mode:

```bash
# Use all CPU cores
kustomark build . --parallel

# Limit concurrent jobs
kustomark build . --parallel --jobs 4
```

**Benefits:**
- 2-4x faster with multiple cores
- Scales with CPU count
- Ideal for CI/CD

## Patch Organization

### Strategy 1: Use Patch Groups

Organize patches by purpose or file type:

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../docs/

patchGroups:
  # Group 1: Version updates
  - name: version-updates
    selector:
      filePattern: "**/*.md"
    patches:
      - op: replace
        old: "v1.0"
        new: "v2.0"

  # Group 2: API docs only
  - name: api-updates
    selector:
      filePattern: "api/**/*.md"
    patches:
      - op: set-frontmatter
        key: api-version
        value: "2024-02-01"

  # Group 3: Table updates
  - name: table-updates
    selector:
      filePattern: "reference/**/*.md"
    patches:
      - op: add-table-column
        table: 0
        header: "Since Version"
        defaultValue: "2.0"
```

**Benefits:**
- Easier to maintain
- Better performance (targeted matching)
- Clearer intent

### Strategy 2: Inheritance Hierarchy

Use overlay inheritance for complex configurations:

```
project/
├── base/
│   └── kustomark.yaml          # Common patches
├── staging/
│   └── kustomark.yaml          # Staging-specific
└── production/
    └── kustomark.yaml          # Production-specific
```

**base/kustomark.yaml:**
```yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - ../docs/

patches:
  # Common to all environments
  - op: replace
    old: "TODO"
    new: "DONE"
```

**production/kustomark.yaml:**
```yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - ../base/

patches:
  # Production-specific
  - op: set-frontmatter
    key: environment
    value: "production"

  - op: replace
    old: "staging.example.com"
    new: "api.example.com"
```

### Strategy 3: Separate Concerns

Split patches by concern:

```yaml
resources:
  - ../docs/

# Import patch definitions
patches:
  - ./patches/branding.yaml
  - ./patches/versioning.yaml
  - ./patches/api-updates.yaml
```

**patches/branding.yaml:**
```yaml
- op: replace
  old: "OldCo"
  new: "NewCo"

- op: replace
  old: "old-logo.png"
  new: "new-logo.png"
```

## Groups vs Conditions

### When to Use Groups

Use **groups** when:
- Patches naturally cluster by file type or purpose
- You want to reuse patch sets
- Managing complex configurations
- Different teams own different patch groups

**Example:**
```yaml
patchGroups:
  - name: legal
    description: "Legal compliance updates"
    selector:
      filePattern: "**/*.md"
    patches:
      - op: replace
        old: "Copyright 2023"
        new: "Copyright 2024"

  - name: api-docs
    description: "API documentation updates"
    selector:
      filePattern: "api/**/*.md"
    patches:
      - op: set-frontmatter
        key: api-version
        value: "v2"
```

### When to Use Conditions

Use **conditions** when:
- Single patch needs conditional application
- Logic is simple (file patterns, frontmatter values)
- Want to keep patches inline

**Example:**
```yaml
patches:
  - op: replace
    old: "beta"
    new: "stable"
    condition:
      filePattern: "docs/**/*.md"
      not:
        frontmatter:
          status: "deprecated"
```

### Performance Comparison

```yaml
# Slower: Re-evaluate condition for every file
patches:
  - op: replace
    old: "A"
    new: "B"
    condition:
      filePattern: "api/**/*.md"

  - op: replace
    old: "C"
    new: "D"
    condition:
      filePattern: "api/**/*.md"

# Faster: Group evaluates pattern once
patchGroups:
  - name: api-patches
    selector:
      filePattern: "api/**/*.md"
    patches:
      - op: replace
        old: "A"
        new: "B"
      - op: replace
        old: "C"
        new: "D"
```

**Recommendation:** Use groups for multiple patches with same selector.

## Cache Optimization

### Incremental Build Cache

Enable incremental builds to cache results:

```bash
# Enable caching
kustomark build . --incremental
```

**Cache location:** `.kustomark/cache/`

**Cache invalidation triggers:**
- File content changes
- Configuration changes
- Patch changes
- Resource changes

### Cleaning Cache

```bash
# Force full rebuild
kustomark build . --clean-cache

# Or manually
rm -rf .kustomark/cache/
```

### Cache Best Practices

1. **Use in development**
   ```bash
   # Fast iteration
   kustomark watch . --incremental
   ```

2. **Gitignore cache**
   ```gitignore
   .kustomark/cache/
   ```

3. **Clean in CI**
   ```yaml
   # .github/workflows/ci.yml
   - name: Build docs
     run: kustomark build . --clean-cache
   ```

4. **Monitor cache size**
   ```bash
   du -sh .kustomark/cache/
   ```

### Cache Size Management

Large caches can slow builds. Optimize:

```bash
# Limit cache size (hypothetical - not implemented)
kustomark build . --incremental --max-cache-size 100M

# Or clean periodically
find .kustomark/cache -mtime +7 -delete
```

## Large File Strategies

### Strategy 1: Parallel Processing

Process large file sets in parallel:

```bash
# Use all cores
kustomark build . --parallel

# Optimal for most systems
kustomark build . --parallel --jobs 4
```

**Performance:**
- 1000 files, sequential: 30s
- 1000 files, parallel (4 jobs): 8s

### Strategy 2: Split by Directory

Organize large projects by directory:

```
docs/
├── api/           # 500 files
├── guides/        # 300 files
├── reference/     # 200 files
└── tutorials/     # 100 files
```

**Build selectively:**
```bash
# Build only API docs
kustomark build docs/api/

# Build everything
kustomark build docs/
```

### Strategy 3: Batch Processing

Process files in batches:

```yaml
# Process by category
resources:
  - docs/api/**/*.md      # First batch
  - docs/guides/**/*.md   # Second batch

# Use separate output directories
patchGroups:
  - name: api
    selector:
      filePattern: "api/**/*.md"
    outputPath: ./output/api

  - name: guides
    selector:
      filePattern: "guides/**/*.md"
    outputPath: ./output/guides
```

### Strategy 4: Optimize Content

Reduce file sizes where possible:

**Before:**
```markdown
<!-- 10MB file with huge embedded image -->
![Large Screenshot](data:image/png;base64,iVBORw0KG...)
```

**After:**
```markdown
<!-- Reference external image -->
![Large Screenshot](./images/screenshot.png)
```

### Strategy 5: Resource Loading

Use selective resource loading:

```yaml
# Load only what you need
resources:
  # Good: Specific files
  - docs/important/**/*.md

  # Avoid: Entire tree
  # - docs/**/*.md  # Too broad
```

## Memory-Constrained Environments

Running kustomark in memory-limited environments (CI containers, edge devices, etc.)

### Understanding Memory Usage

**Typical memory consumption:**
- Base runtime: 50-100 MB
- Per file (small): 0.01-0.05 MB
- Per file (large): 0.1-1 MB
- Parallel builds: 2-4x sequential

**Example:**
```
Sequential build of 1000 small files:
  Base: 75 MB
  Files: 1000 × 0.02 MB = 20 MB
  Total: ~95 MB

Parallel build (4 jobs):
  Base: 75 MB
  Files: 1000 × 0.02 MB = 20 MB
  Overhead: 50 MB (parallelization)
  Total: ~145 MB
```

### Optimization Techniques

#### 1. Sequential Processing

```bash
# Use minimal memory
kustomark build . --jobs 1
```

**Memory usage:** ~100 MB for typical projects

#### 2. Reduce Batch Size

```yaml
# Process fewer files at once
resources:
  - docs/section1/*.md

# Instead of
# resources:
#   - docs/**/*.md
```

#### 3. Clear Objects Early

For custom scripts, clear references:

```typescript
let content = await loadFile(path);

// Process content
const result = applyPatches(content, patches);

// Clear large object
content = "";

// Continue processing
writeFile(outputPath, result);
```

#### 4. Limit Concurrent Operations

```bash
# Limit parallel jobs
kustomark build . --parallel --jobs 2
```

**Memory usage:** Linear with job count

#### 5. Stream Processing

For very large files, process in chunks:

```typescript
// Hypothetical streaming API
const stream = createReadStream('large-file.md');
const patchStream = createPatchStream(patches);

stream
  .pipe(patchStream)
  .pipe(createWriteStream('output.md'));
```

### Container Configuration

When running in containers:

```dockerfile
# Dockerfile
FROM oven/bun:1

# Set memory limit
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY . .

RUN bun install

# Run with limited resources
CMD ["bun", "run", "kustomark", "build", ".", "--jobs", "2"]
```

```yaml
# docker-compose.yml
services:
  kustomark:
    image: kustomark:latest
    mem_limit: 512m
    memswap_limit: 512m
```

### Kubernetes Resource Limits

```yaml
# kustomark-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: build-docs
spec:
  template:
    spec:
      containers:
      - name: kustomark
        image: kustomark:latest
        resources:
          requests:
            memory: "256Mi"
          limits:
            memory: "512Mi"
        command:
        - bun
        - run
        - kustomark
        - build
        - .
        - --jobs
        - "2"
```

## CI/CD Optimization

### GitHub Actions

Optimized workflow:

```yaml
# .github/workflows/build-docs.yml
name: Build Documentation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Cache kustomark builds
        uses: actions/cache@v4
        with:
          path: .kustomark/cache
          key: kustomark-${{ runner.os }}-${{ hashFiles('**/*.md', 'kustomark.yaml') }}
          restore-keys: |
            kustomark-${{ runner.os }}-

      - name: Build documentation
        run: |
          bun run kustomark build . \
            --parallel \
            --jobs 4 \
            --incremental \
            --stats

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: documentation
          path: output/
```

**Performance improvements:**
- Cache restoration: Saves 10-30s
- Parallel builds: 2-3x faster
- Incremental builds: 10-100x faster for small changes

### GitLab CI

```yaml
# .gitlab-ci.yml
build-docs:
  image: oven/bun:latest

  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - .kustomark/cache/
      - node_modules/

  script:
    - bun install
    - bun run kustomark build . --parallel --jobs 4 --incremental

  artifacts:
    paths:
      - output/
    expire_in: 1 week

  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

### Performance Testing in CI

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Run benchmarks
        run: |
          bun run kustomark benchmark run \
            --baseline main \
            --save-baseline pr-${{ github.event.pull_request.number }} \
            --format json \
            --output benchmark-results.json

      - name: Check for regressions
        run: |
          # Parse results and fail if regressions detected
          bun run scripts/check-performance.ts

      - name: Comment results on PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('benchmark-results.json'));

            // Format comment
            const body = `## Performance Results\n\n${formatResults(results)}`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

## Anti-Patterns

### 1. Over-Using Regex

**Bad:**
```yaml
patches:
  - op: replace-regex
    pattern: "foo"
    replacement: "bar"
  - op: replace-regex
    pattern: "baz"
    replacement: "qux"
```

**Good:**
```yaml
patches:
  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "baz"
    new: "qux"
```

### 2. Processing Unnecessary Files

**Bad:**
```yaml
resources:
  - ../**/*.md  # Processes everything including node_modules
```

**Good:**
```yaml
resources:
  - ../docs/**/*.md
  - ../README.md

# Exclude unnecessary paths
exclude:
  - ../node_modules/**
  - ../.git/**
```

### 3. Redundant Patches

**Bad:**
```yaml
patches:
  - op: set-frontmatter
    key: author
    value: "Team"
  - op: set-frontmatter
    key: author
    value: "Team A"  # Overwrites previous
```

**Good:**
```yaml
patches:
  - op: set-frontmatter
    key: author
    value: "Team A"
```

### 4. Ignoring Cache

**Bad:**
```bash
# Always rebuilds everything
kustomark build .
```

**Good:**
```bash
# Uses cache for development
kustomark build . --incremental

# Full rebuild for CI
kustomark build . --clean-cache  # Only in CI
```

### 5. Monolithic Configuration

**Bad:**
```yaml
# 1000 line kustomark.yaml with all patches inline
patches:
  - op: replace...
  - op: replace...
  # ... 100 more patches
```

**Good:**
```yaml
# Split into logical files
patches:
  - ./patches/branding.yaml
  - ./patches/versioning.yaml
  - ./patches/api-updates.yaml
```

## Real-World Examples

### Example 1: API Documentation Site

**Scenario:** 1000 API endpoint documentation files

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./dist

# Optimize resource loading
resources:
  - ../docs/api/**/*.md

# Use parallel processing
parallel: true
jobs: 8

# Enable caching for development
incremental: true

# Organized patch groups
patchGroups:
  # Update API version across all docs
  - name: api-version
    selector:
      filePattern: "**/*.md"
    patches:
      - op: merge-frontmatter
        values:
          api_version: "v2.0"
          updated: "2024-02-01"

  # Update response examples
  - name: response-updates
    selector:
      filePattern: "**/responses/*.md"
    patches:
      - op: replace
        old: '"version": "1.0"'
        new: '"version": "2.0"'

  # Update authentication docs
  - name: auth-updates
    selector:
      filePattern: "**/auth/*.md"
    patches:
      - op: replace-section
        id: authentication
        content: |
          ## Authentication

          All API requests require OAuth 2.0 authentication.
```

**Performance:**
- Sequential: 45s
- Parallel (8 jobs): 12s
- Incremental (10 files changed): 0.8s

### Example 2: Multi-Language Documentation

**Scenario:** Documentation in 5 languages

```yaml
# base/kustomark.yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - ../content/

patchGroups:
  # Common to all languages
  - name: global-updates
    patches:
      - op: replace
        old: "OldProduct"
        new: "NewProduct"
```

```yaml
# locales/es/kustomark.yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - ../../base/

output: ./dist/es

patchGroups:
  # Spanish-specific
  - name: spanish-branding
    patches:
      - op: set-frontmatter
        key: lang
        value: "es"

      - op: replace
        old: "Copyright"
        new: "Derechos de autor"
```

**Build script:**
```bash
#!/bin/bash
# Build all languages in parallel

languages=("en" "es" "fr" "de" "ja")

for lang in "${languages[@]}"; do
  (
    cd "locales/$lang"
    kustomark build . --parallel --incremental
  ) &
done

wait
echo "All languages built!"
```

### Example 3: Migration Project

**Scenario:** Migrating 500 docs from old format to new

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./migrated

resources:
  - ../old-docs/**/*.md

patchGroups:
  # Phase 1: Update frontmatter structure
  - name: frontmatter-migration
    patches:
      - op: rename-frontmatter
        old: "publish_date"
        new: "date"

      - op: set-frontmatter
        key: "layout"
        value: "document"

      - op: remove-frontmatter
        key: "legacy_field"

  # Phase 2: Update content structure
  - name: content-migration
    patches:
      # Old callout format → new format
      - op: replace-regex
        pattern: '> \*\*Note:\*\* (.*)'
        replacement: ':::note\n$1\n:::'
        flags: "g"

      # Old code blocks → new
      - op: replace-regex
        pattern: '~~~(\w+)\n([\s\S]*?)~~~'
        replacement: '```$1\n$2```'
        flags: "g"

  # Phase 3: Update links
  - name: link-migration
    patches:
      - op: replace-regex
        pattern: '\[([^\]]+)\]\(/old-path/'
        replacement: '[$1](/new-path/'
        flags: "g"
```

**Migration performance:**
- Total files: 500
- Total time: 18s (parallel)
- Success rate: 100%

## Next Steps

- [Profile memory usage](./profiling.md)
- [Set up CI benchmarks](./ci-integration.md)
- [Run performance tests](./benchmarking.md)
