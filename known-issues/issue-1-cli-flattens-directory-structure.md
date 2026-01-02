# CLI flattens directory structure instead of preserving relative paths

**Issue:** [#1](https://github.com/dexhorthy/kustomark-ralph-bash/issues/1)
**Author:** dexhorthy
**Created:** 2026-01-02
**State:** RESOLVED
**Resolved:** 2026-01-02

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

In `src/cli/index.ts` lines 170-182, the `resolveResources` function was extracting just the filename instead of preserving relative paths.

## Fix Applied

The fix has been implemented in `src/cli/index.ts` (lines 555-564):

```typescript
for (const resource of resolvedResources) {
  const normalizedPath = normalize(resource.path);

  // Compute relative path from the resource's base directory
  // If baseDir is provided, use it; otherwise fall back to basePath
  const baseDirectory = resource.baseDir || basePath;
  const relativePath = relative(baseDirectory, normalizedPath);

  resultMap.set(relativePath, resource.content);
}
```

The `ResolvedResource` interface (in `src/core/resource-resolver.ts`) includes a `baseDir` field that tracks the base directory for each resource. The core resource resolver sets this field appropriately for:
- Glob patterns: uses the search directory (lines 203)
- Git URLs: uses the normalized base directory (lines 271)
- HTTP archives: uses the normalized base directory (lines 365)

## Verification

Tested with the example structure from the issue:
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

Build output correctly preserves directory structure:
```
output/
  skills/create-research/SKILL.md
  skills/create-research/references/research_template.md
  skills/create-research/references/research_final_answer.md
  skills/iterate-research/SKILL.md
  skills/iterate-research/references/research_final_answer.md
```

All files preserved with correct content. Issue is resolved.
