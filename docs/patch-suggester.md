# Patch Suggester

The patch suggester module provides intelligent analysis and automatic suggestion of patch operations based on differences between source and target markdown content.

## Overview

The patch suggester analyzes two versions of markdown content and automatically suggests appropriate patch operations to transform the source into the target. It uses sophisticated heuristics to detect:

- Frontmatter changes (additions, removals, modifications)
- Section-level changes (additions, removals, renames, content modifications)
- Line-based changes (insertions, deletions, modifications)
- Pattern-based replacements (strings, regex patterns)

## API

### `analyzeDiff(source: string, target: string): DiffAnalysis`

Analyzes the differences between source and target content.

**Parameters:**
- `source` - Original markdown content
- `target` - Target markdown content after changes

**Returns:** A `DiffAnalysis` object containing:
- `addedLines` - Lines that were added
- `removedLines` - Lines that were removed
- `modifiedLines` - Lines that were modified
- `frontmatterChanges` - Changes to frontmatter fields
- `sectionChanges` - Changes to markdown sections
- `hasFrontmatter` - Whether content has frontmatter

**Example:**

```typescript
import { analyzeDiff } from "./src/core/patch-suggester.js";

const source = "---\ntitle: Old\n---\n# Content";
const target = "---\ntitle: New\n---\n# Content";

const analysis = analyzeDiff(source, target);

console.log(analysis.frontmatterChanges.modified);
// { title: { old: 'Old', new: 'New' } }
```

### `suggestPatches(source: string, target: string): PatchOperation[]`

Automatically suggests patch operations to transform source into target.

**Parameters:**
- `source` - Original markdown content
- `target` - Target markdown content after changes

**Returns:** Array of suggested `PatchOperation` objects

**Example:**

```typescript
import { suggestPatches } from "./src/core/patch-suggester.js";

const source = "---\ntitle: v1\n---\nContent";
const target = "---\ntitle: v2\nauthor: John\n---\nContent";

const patches = suggestPatches(source, target);

console.log(patches);
// [
//   { op: 'set-frontmatter', key: 'title', value: 'v2' },
//   { op: 'set-frontmatter', key: 'author', value: 'John' }
// ]
```

### `scorePatches(patches: PatchOperation[], source: string, target: string): ScoredPatch[]`

Scores patch operations by effectiveness and confidence.

**Parameters:**
- `patches` - Array of patch operations to score
- `source` - Original content (used for scoring)
- `target` - Target content (used for scoring)

**Returns:** Array of `ScoredPatch` objects with:
- `patch` - The patch operation
- `score` - Confidence score (0-1, higher is better)
- `description` - Human-readable description

**Example:**

```typescript
import { scorePatches, suggestPatches } from "./src/core/patch-suggester.js";

const patches = suggestPatches(source, target);
const scored = scorePatches(patches, source, target);

// Sorted by score (highest first)
for (const { patch, score, description } of scored) {
  console.log(`[${(score * 100).toFixed(0)}%] ${description}`);
}
```

## Types

### `DiffAnalysis`

```typescript
interface DiffAnalysis {
  addedLines: Array<{ lineNumber: number; content: string }>;
  removedLines: Array<{ lineNumber: number; content: string }>;
  modifiedLines: Array<{
    oldLineNumber: number;
    newLineNumber: number;
    oldContent: string;
    newContent: string;
  }>;
  frontmatterChanges: {
    added: Record<string, unknown>;
    removed: string[];
    modified: Record<string, { old: unknown; new: unknown }>;
  };
  sectionChanges: Array<{
    sectionId: string;
    type: "added" | "removed" | "modified" | "renamed";
    oldContent?: string;
    newContent?: string;
    oldTitle?: string;
    newTitle?: string;
  }>;
  hasFrontmatter: boolean;
}
```

### `ScoredPatch`

```typescript
interface ScoredPatch {
  patch: PatchOperation;
  score: number;
  description: string;
}
```

## Detection Heuristics

### Frontmatter Changes

- **High Confidence (95%)**: Directly detected from YAML parsing
- Detects: additions, removals, and modifications of frontmatter fields
- Supports nested fields with dot notation

### Section Operations

- **High Confidence (90%)**: Based on markdown header parsing
- Detects: section removals, content replacements, header renames
- Uses position and level matching to detect renames even when slug changes

### String Replacements

- **Medium-High Confidence (70-85%)**: Based on occurrence frequency
- Detects: repeated string replacements (must appear 2+ times)
- Matches by occurrence count in source and target

### Regex Patterns

- **Medium Confidence (75%)**: Pattern-based detection
- Detects: URL transformations, version number changes
- Requires consistent pattern across multiple lines

### Line Operations

- **Lower Confidence (60%)**: Based on line similarity
- Detects: individual line replacements
- Uses word overlap similarity (>70% similarity threshold)

## Usage Patterns

### Interactive Patch Generation

```typescript
import { analyzeDiff, scorePatches, suggestPatches } from "./src/core/patch-suggester.js";

// Read source and target files
const source = await Bun.file("original.md").text();
const target = await Bun.file("modified.md").text();

// Get suggestions
const patches = suggestPatches(source, target);
const scored = scorePatches(patches, source, target);

// Filter high-confidence suggestions
const highConfidence = scored.filter((p) => p.score > 0.7);

// Generate kustomization file
const config = {
  apiVersion: "kustomark/v1",
  kind: "Kustomization",
  resources: ["original.md"],
  patches: highConfidence.map((p) => p.patch),
};
```

### Differential Analysis

```typescript
import { analyzeDiff } from "./src/core/patch-suggester.js";

const analysis = analyzeDiff(source, target);

// Check what changed
if (analysis.frontmatterChanges.modified.version) {
  console.log("Version changed:", analysis.frontmatterChanges.modified.version);
}

// Find new sections
const newSections = analysis.sectionChanges
  .filter((c) => c.type === "added")
  .map((c) => c.sectionId);

console.log("New sections:", newSections);
```

### Automated Migration

```typescript
import { suggestPatches } from "./src/core/patch-suggester.js";
import { applyPatches } from "./src/core/patch-engine.js";

// Analyze changes in one file
const template = await Bun.file("template-before.md").text();
const updated = await Bun.file("template-after.md").text();

const patches = suggestPatches(template, updated);

// Apply same patches to similar files
const files = ["doc1.md", "doc2.md", "doc3.md"];

for (const file of files) {
  const content = await Bun.file(file).text();
  const result = applyPatches(content, patches);
  await Bun.write(file, result.content);
}
```

## Limitations

1. **Section Renames**: Only detects renames when sections are at the same level and similar position
2. **Complex Transformations**: May not detect very complex multi-step transformations
3. **Content Ordering**: Position-based heuristics may fail if content is significantly reordered
4. **Nested Structures**: Limited support for deeply nested content transformations

## Best Practices

1. **Review Suggestions**: Always review suggested patches before applying them
2. **Use Confidence Scores**: Filter by score (>0.7) for production use
3. **Combine with Manual Patches**: Use suggestions as a starting point, then refine
4. **Test on Samples**: Test suggested patches on sample content first
5. **Iterative Refinement**: Run suggester multiple times for complex changes

## See Also

- [Patch Engine](../src/core/patch-engine.ts) - Applies patch operations
- [Types](../src/core/types.ts) - Type definitions for patch operations
- [Examples](../examples/patch-suggester-example.ts) - Usage examples
