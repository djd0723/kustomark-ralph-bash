# CLI flattens directory structure instead of preserving relative paths

**Issue:** [#1](https://github.com/dexhorthy/kustomark-ralph-bash/issues/1)
**Author:** dexhorthy
**Created:** 2026-01-02
**State:** open

## Description

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
