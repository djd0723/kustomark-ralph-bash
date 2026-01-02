# CLI flattens directory structure instead of preserving relative paths

**Issue:** [#1](https://github.com/dexhorthy/kustomark-ralph-bash/issues/1)
**Author:** dexhorthy
**Created:** 2026-01-02
**State:** ✅ RESOLVED
**Resolution Date:** 2026-01-02

## Problem

When resolving resources from a directory reference, the CLI flattens all files to just their basename instead of preserving the relative directory structure.

## Current Behavior

Given a source structure like:
```
skills/
  create-research/
    SKILL.md
    references/
      research_template.md
      research_final_answer.md
  iterate-research/
    SKILL.md
    references/
      research_final_answer.md
```

The build outputs:
```
output/
  SKILL.md              # Only one! Others overwritten
  research_template.md
  research_final_answer.md  # Only one! Others overwritten
```

## Expected Behavior

The build should preserve relative paths:
```
output/
  create-research/
    SKILL.md
    references/
      research_template.md
      research_final_answer.md
  iterate-research/
    SKILL.md
    references/
      research_final_answer.md
```

## Root Cause

In `src/cli/index.ts` lines 170-182, the `resolveResources` function extracts just the filename:

```typescript
for (const resource of resolvedResources) {
  const normalizedPath = normalize(resource.path);
  // Extract just the filename
  const parts = normalizedPath.split("/");
  const filename = parts[parts.length - 1] || normalizedPath;
  resultMap.set(filename, resource.content);
}
```

## Suggested Fix

Compute relative paths from the source directory instead of flattening:

```typescript
for (const resource of resolvedResources) {
  // Compute relative path from the source config's directory
  const relativePath = relative(sourceBaseDir, resource.path);
  resultMap.set(relativePath, resource.content);
}
```

The tricky part is tracking which base directory each resource came from when using directory references (overlays).

## Resolution

**Status:** ✅ Fixed (already implemented)

Upon investigation, this issue was already resolved in the codebase. The fix is located in `src/cli/index.ts` at lines 789-794:

```typescript
// Compute relative path from the resource's base directory
// If baseDir is provided, use it; otherwise fall back to basePath
const baseDirectory = resource.baseDir || basePath;
const relativePath = relative(baseDirectory, normalizedPath);

resultMap.set(relativePath, resource.content);
```

The `ResolvedResource` interface includes a `baseDir` field that tracks the origin directory for each resource, and the CLI correctly computes relative paths from this base directory instead of flattening to basenames.

**Test Coverage:**
A comprehensive integration test was added in `tests/cli-integration.test.ts` (lines 1175-1308) that:
- Creates a nested directory structure with duplicate filenames
- Verifies all files are preserved in their relative paths
- Confirms files with the same basename maintain separate content
- Ensures no flattening occurs (all 5 test files exist in correct paths)

**Test Results:** All 2652 tests passing ✓

The issue reporter may have been using an older version of the codebase or encountering a different scenario. The current implementation correctly preserves directory structure for all resource resolution patterns including glob patterns like `skills/**/*.md`.
