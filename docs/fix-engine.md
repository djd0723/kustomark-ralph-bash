# Fix Engine

The Fix Engine provides intelligent analysis and automated fixing for failed patches in kustomark. It analyzes patches that failed to match (count === 0) and generates fix suggestions with confidence scores.

## Overview

When patches fail to match content, the Fix Engine can:

1. **Analyze failures** - Identify why patches failed and what went wrong
2. **Generate suggestions** - Provide intelligent fix suggestions based on the failure type
3. **Auto-fix** - Automatically apply high-confidence fixes
4. **Fuzzy matching** - Find similar strings/sections when exact matches fail

## Core Functions

### `analyzeFilePatchFailures(content, patches, onNoMatch?)`

Analyzes a file's patch results and generates fix suggestions for each failure.

**Parameters:**
- `content` - The original content to be patched
- `patches` - Array of patches to analyze
- `onNoMatch` - Strategy for handling no-match scenarios (default: "warn")

**Returns:** Array of `FixSuggestion` objects

**Example:**
```typescript
import { analyzeFilePatchFailures } from "./src/core/fix-engine.js";

const content = "HELLO world";
const patches = [
  { op: "replace", old: "hello", new: "hi" } // Case mismatch
];

const failures = analyzeFilePatchFailures(content, patches);
// Returns: [{ strategy: "exact-match", confidence: 95, ... }]
```

### `generateFixSuggestions(patch, patchIndex, content, warning)`

Generates fix suggestions for a single failed patch.

**Parameters:**
- `patch` - The patch that failed
- `patchIndex` - Index of the patch in the patches array
- `content` - The content that was being patched
- `warning` - The warning message from the failed patch

**Returns:** `FixSuggestion` object with strategy and confidence score

**Example:**
```typescript
import { generateFixSuggestions } from "./src/core/fix-engine.js";

const patch = { op: "remove-section", id: "introductio" };
const warning = { message: "Patch matched 0 times" };
const content = "# Introduction\n\nContent here";

const suggestion = generateFixSuggestions(patch, 0, content, warning);
// Returns: { strategy: "exact-match", confidence: 85, modifiedPatch: { ...patch, id: "introduction" } }
```

### `applyAutoFix(content, fixSuggestion, confidenceThreshold?)`

Applies an auto-fix to content based on a fix suggestion.

**Parameters:**
- `content` - The content to patch
- `fixSuggestion` - The fix suggestion to apply
- `confidenceThreshold` - Minimum confidence score to auto-apply (0-100, default: 75)

**Returns:** `ApplyFixResult` with success status, modified content, and error details

**Example:**
```typescript
import { applyAutoFix } from "./src/core/fix-engine.js";

const content = "HELLO world";
const fixSuggestion = {
  originalPatch: { op: "replace", old: "hello", new: "hi" },
  patchIndex: 0,
  strategy: "exact-match",
  confidence: 95,
  modifiedPatch: { op: "replace", old: "HELLO", new: "hi" },
  // ... other fields
};

const result = applyAutoFix(content, fixSuggestion);
// Returns: { success: true, content: "hi world", count: 1 }
```

## Fix Strategies

The Fix Engine uses different strategies based on the type of failure:

### 1. Exact Match (`exact-match`)

**When Used:** When a very similar or correct version is found with high confidence
- Case-insensitive string matches
- Section names with minor typos
- Frontmatter keys with typos

**Confidence:** 80-95%

**Example:**
```typescript
// Original patch looking for "hello" finds "HELLO" (case mismatch)
{
  strategy: "exact-match",
  confidence: 95,
  modifiedPatch: { op: "replace", old: "HELLO", new: "hi" }
}
```

### 2. Fuzzy Match (`fuzzy-match`)

**When Used:** When similar strings are found using Levenshtein distance
- Typos in strings (e.g., "confiuration" → "configuration")
- Similar line content
- Word variations

**Confidence:** 0-100% based on edit distance

**Example:**
```typescript
// Original patch has typo "confiuration"
{
  strategy: "fuzzy-match",
  confidence: 67,
  fuzzyMatches: [
    { value: "configuration", distance: 1, confidence: 67 },
    { value: "configure", distance: 3, confidence: 33 }
  ]
}
```

### 3. Manual Edit (`manual-edit`)

**When Used:** When no good automatic fix can be found
- No similar strings exist
- Regex patterns that don't match
- Complex scenarios requiring human review

**Confidence:** 0%

**Example:**
```typescript
{
  strategy: "manual-edit",
  confidence: 0,
  description: "String 'xyz123' not found. Manual review required."
}
```

### 4. Skip (`skip`)

**When Used:** For operations that shouldn't fail with match count errors
- File operations
- Operations that always succeed

## Confidence Scoring

Confidence scores range from 0-100 and indicate how likely the fix is to be correct:

| Range | Meaning | Recommendation |
|-------|---------|----------------|
| 90-100% | Very High | Safe to auto-apply |
| 75-89% | High | Auto-apply with default threshold |
| 50-74% | Medium | Review before applying |
| 25-49% | Low | Manual review recommended |
| 0-24% | Very Low | Manual edit required |

**Factors affecting confidence:**
- **Edit distance** - Fewer changes = higher confidence
- **String length** - Longer strings with small distances = higher confidence
- **Match type** - Case-only differences = highest confidence

## Usage Patterns

### Pattern 1: Analyze and Report

```typescript
import { analyzeFilePatchFailures } from "./src/core/fix-engine.js";

const failures = analyzeFilePatchFailures(content, patches);

console.log(`Found ${failures.length} failures:`);
for (const failure of failures) {
  console.log(`\nPatch #${failure.patchIndex}:`);
  console.log(`  Strategy: ${failure.strategy}`);
  console.log(`  Confidence: ${failure.confidence}%`);
  console.log(`  Description: ${failure.description}`);

  if (failure.fuzzyMatches) {
    console.log(`  Suggestions:`);
    for (const match of failure.fuzzyMatches.slice(0, 3)) {
      console.log(`    - "${match.value}"`);
    }
  }
}
```

### Pattern 2: Auto-Fix High-Confidence Failures

```typescript
import { analyzeFilePatchFailures, applyAutoFix } from "./src/core/fix-engine.js";

const failures = analyzeFilePatchFailures(content, patches);
let currentContent = content;

for (const failure of failures) {
  if (failure.confidence >= 75) {
    const result = applyAutoFix(currentContent, failure);
    if (result.success) {
      currentContent = result.content;
      console.log(`✓ Fixed patch #${failure.patchIndex}`);
    }
  }
}
```

### Pattern 3: Interactive Fix Selection

```typescript
import { analyzeFilePatchFailures, applyAutoFix } from "./src/core/fix-engine.js";

const failures = analyzeFilePatchFailures(content, patches);
let currentContent = content;

for (const failure of failures) {
  if (failure.strategy === "fuzzy-match" && failure.fuzzyMatches) {
    console.log(`\nSelect fix for patch #${failure.patchIndex}:`);
    failure.fuzzyMatches.forEach((match, i) => {
      console.log(`  ${i + 1}. "${match.value}" (confidence: ${match.confidence}%)`);
    });

    // Get user selection...
    const selection = await getUserSelection();
    if (selection >= 0) {
      const selectedMatch = failure.fuzzyMatches[selection];
      const fixSuggestion = { ...failure, modifiedPatch: selectedMatch.patch };
      const result = applyAutoFix(currentContent, fixSuggestion, 0); // Override threshold
      if (result.success) {
        currentContent = result.content;
      }
    }
  }
}
```

### Pattern 4: Batch Processing with Stats

```typescript
import { analyzeFilePatchFailures, applyAutoFix } from "./src/core/fix-engine.js";

const stats = {
  total: 0,
  autoFixed: 0,
  manualReview: 0,
  lowConfidence: 0
};

const failures = analyzeFilePatchFailures(content, patches);
stats.total = failures.length;
let currentContent = content;

for (const failure of failures) {
  if (failure.confidence >= 75) {
    const result = applyAutoFix(currentContent, failure);
    if (result.success) {
      currentContent = result.content;
      stats.autoFixed++;
    }
  } else if (failure.strategy === "manual-edit") {
    stats.manualReview++;
  } else {
    stats.lowConfidence++;
  }
}

console.log(`\nFix Statistics:`);
console.log(`  Total failures: ${stats.total}`);
console.log(`  Auto-fixed: ${stats.autoFixed}`);
console.log(`  Low confidence: ${stats.lowConfidence}`);
console.log(`  Manual review: ${stats.manualReview}`);
```

## Integration with Build System

The Fix Engine is designed to integrate with the `kustomark fix` command:

```typescript
// Pseudo-code for fix command
async function fixCommand(configPath: string, options: FixOptions) {
  // 1. Load config and run build
  const config = await loadConfig(configPath);
  const resources = await resolveResources(config.resources);

  // 2. Track failures during build
  const allFailures = [];

  for (const [file, content] of resources.entries()) {
    const patches = getApplicablePatches(config.patches, file);
    const failures = analyzeFilePatchFailures(content, patches);

    if (failures.length > 0) {
      allFailures.push({ file, failures });
    }
  }

  // 3. Report or auto-fix based on options
  if (options.autoFix) {
    // Apply high-confidence fixes
    for (const { file, failures } of allFailures) {
      let content = resources.get(file);
      for (const failure of failures) {
        if (failure.confidence >= options.confidenceThreshold) {
          const result = applyAutoFix(content, failure);
          if (result.success) {
            content = result.content;
            // Update resource or write to file
          }
        }
      }
    }
  } else {
    // Interactive mode - present options to user
    for (const { file, failures } of allFailures) {
      console.log(`\nFile: ${file}`);
      // Show each failure with options...
    }
  }
}
```

## Type Definitions

### FixSuggestion

```typescript
interface FixSuggestion {
  /** The original patch that failed */
  originalPatch: PatchOperation;
  /** Index of the patch in the original patches array */
  patchIndex: number;
  /** Suggested fix strategy */
  strategy: FixStrategy;
  /** Confidence score (0-100) for auto-fix */
  confidence: number;
  /** Human-readable description of the fix */
  description: string;
  /** The modified patch to apply (if applicable) */
  modifiedPatch?: PatchOperation;
  /** Fuzzy match options (for fuzzy-match strategy) */
  fuzzyMatches?: Array<{
    value: string;
    distance: number;
    confidence: number;
    patch: PatchOperation;
  }>;
  /** Original error/warning message */
  errorMessage: string;
}
```

### ApplyFixResult

```typescript
interface ApplyFixResult {
  /** Whether the fix was successfully applied */
  success: boolean;
  /** The patched content after applying the fix */
  content: string;
  /** Number of changes made */
  count: number;
  /** Error message if the fix failed */
  error?: string;
  /** The patch that was applied (original or modified) */
  appliedPatch: PatchOperation;
}
```

### FailedPatchAnalysis

```typescript
interface FailedPatchAnalysis {
  /** Total number of patches analyzed */
  totalPatches: number;
  /** Number of patches that failed */
  failedPatches: number;
  /** Number of patches that succeeded */
  successfulPatches: number;
  /** Number of patches skipped due to conditions */
  conditionSkippedPatches: number;
  /** Detailed information about each failed patch with fix suggestions */
  failures: FixSuggestion[];
}
```

## Supported Patch Types

The Fix Engine provides specialized handling for each patch type:

| Patch Type | Fix Strategy | Notes |
|------------|--------------|-------|
| `replace` | Exact match, Fuzzy match | Checks case-insensitive and similar words |
| `replace-regex` | Manual edit | Regex patterns are too complex for auto-fix |
| `replace-line` | Fuzzy match | Finds similar lines |
| `insert-after-line` | Fuzzy match | Finds similar lines |
| `insert-before-line` | Fuzzy match | Finds similar lines |
| `remove-section` | Exact match | Uses section suggestion engine |
| `replace-section` | Exact match | Uses section suggestion engine |
| `prepend-to-section` | Exact match | Uses section suggestion engine |
| `append-to-section` | Exact match | Uses section suggestion engine |
| `rename-header` | Exact match | Uses section suggestion engine |
| `move-section` | Exact match | Uses section suggestion engine |
| `change-section-level` | Exact match | Uses section suggestion engine |
| `remove-frontmatter` | Exact match | Uses frontmatter suggestion engine |
| `rename-frontmatter` | Exact match | Uses frontmatter suggestion engine |
| `delete-between` | Manual edit | Analyzes which markers are missing |
| `replace-between` | Manual edit | Analyzes which markers are missing |
| Table operations | Manual edit | Too complex for auto-fix |
| File operations | Skip | Should not fail with match errors |

## Best Practices

1. **Use High Thresholds for Production** - Set confidence threshold to 85+ for automated fixes in CI/CD

2. **Review Low-Confidence Fixes** - Always review fixes with confidence < 75% before applying

3. **Combine with Testing** - Apply fixes to a test environment first

4. **Track Fix Success Rate** - Monitor which types of fixes succeed most often

5. **Provide User Context** - When presenting fixes to users, show the original content and the suggested change

6. **Handle Edge Cases** - Some patches may require manual intervention even with good suggestions

## Limitations

- **Regex Patterns**: Cannot auto-fix complex regex patterns
- **Context Sensitivity**: May not understand semantic meaning of changes
- **Multiple Fixes**: Each fix is independent; combined effects are not analyzed
- **Confidence Calibration**: Confidence scores are heuristic-based, not statistically validated

## Future Enhancements

Potential improvements to the Fix Engine:

- Machine learning-based confidence scoring
- Multi-patch interaction analysis
- Content-aware suggestions (understand markdown structure)
- Historical fix success tracking
- Custom fix strategies per project
- Integration with version control for rollback
