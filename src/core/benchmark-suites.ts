/**
 * Predefined benchmark configurations for all patch operations
 *
 * This module provides comprehensive benchmark suites for testing the performance
 * of all Kustomark patch operations across different file sizes and complexities.
 */

import type { PatchOperation } from "./types.js";

/**
 * Configuration for a single benchmark test
 */
export interface BenchmarkConfig {
  /** Name of the benchmark */
  name: string;
  /** Category of the benchmark */
  category: string;
  /** Number of files to process */
  fileCount: number;
  /** Complexity level (simple, medium, complex) */
  complexity: "simple" | "medium" | "complex";
  /** Function to generate test content */
  contentGenerator: (index: number) => string;
  /** Patches to apply */
  patches: PatchOperation[];
  /** Number of warmup runs before measurement */
  warmupRuns?: number;
  /** Number of benchmark runs to average */
  benchmarkRuns?: number;
}

/**
 * Options for generating benchmark configurations
 */
export interface BenchmarkOptions {
  /** File counts to test (default: [1, 10, 100]) */
  fileCounts?: number[];
  /** Complexity levels to test (default: ["simple", "medium", "complex"]) */
  complexity?: Array<"simple" | "medium" | "complex">;
  /** Number of warmup runs (default: 3) */
  warmupRuns?: number;
  /** Number of benchmark runs (default: 10) */
  benchmarkRuns?: number;
}

/**
 * Default benchmark options
 */
const DEFAULT_OPTIONS: Required<BenchmarkOptions> = {
  fileCounts: [1, 10, 100],
  complexity: ["simple", "medium", "complex"],
  warmupRuns: 3,
  benchmarkRuns: 10,
};

/**
 * Content generators for different complexity levels
 */

function generateSimpleContent(index: number): string {
  return `---
title: Document ${index}
author: Test Author
date: 2024-01-01
---

# Introduction

This is a simple document with basic content.

## Section One

Some content in section one.

## Section Two

Some content in section two.

### Subsection 2.1

Nested content here.

## Conclusion

Final thoughts.
`;
}

function generateMediumContent(index: number): string {
  return `---
title: Document ${index}
author: Test Author
date: 2024-01-01
tags: [markdown, testing, benchmark]
version: 1.0.0
status: draft
---

# Introduction

This is a medium complexity document with multiple sections and tables.

## Overview

The overview section contains important information about this document.

### Purpose

This document serves as a test case for benchmarking.

### Scope

The scope includes various markdown features.

## Features

### Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Replace | Done | High |
| Section | Done | High |
| Table | Done | Medium |

### Code Blocks

\`\`\`javascript
function example() {
  return "Hello, World!";
}
\`\`\`

## Details

<!-- START_MARKER -->
Content between markers for testing delete-between operations.
This content spans multiple lines.
<!-- END_MARKER -->

### Subsection A

First subsection with content.

### Subsection B

Second subsection with content.

## Conclusion

Final thoughts and summary.

## References

- Reference 1
- Reference 2
- Reference 3
`;
}

function generateComplexContent(index: number): string {
  return `---
title: Complex Document ${index}
author: Test Author
date: 2024-01-01
tags: [markdown, testing, benchmark, performance, analysis]
version: 2.0.0
status: published
metadata:
  reviewed: true
  reviewers: [Alice, Bob, Charlie]
  updated: 2024-02-01
keywords: [performance, testing, markdown, kustomark]
---

# Executive Summary

This is a complex document with extensive content, multiple sections, tables, and various markdown features.

## Table of Contents

1. [Introduction](#introduction)
2. [Methodology](#methodology)
3. [Results](#results)
4. [Analysis](#analysis)
5. [Conclusions](#conclusions)

## Introduction {#introduction}

The introduction provides comprehensive background information.

### Background

Historical context and motivation for this document.

### Objectives

- Primary objective one
- Secondary objective two
- Tertiary objective three

### Scope and Limitations

This section outlines what is and isn't covered.

## Methodology {#methodology}

### Experimental Design

Detailed description of the experimental approach.

### Data Collection

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| Sample Size | 1000 | items | Randomly selected |
| Duration | 30 | days | Continuous monitoring |
| Frequency | 1 | Hz | Per second sampling |
| Accuracy | 99.9 | % | Three sigma |

### Analysis Techniques

<!-- START_ANALYSIS -->
Multiple analysis techniques were employed:
1. Statistical analysis
2. Regression modeling
3. Pattern recognition
<!-- END_ANALYSIS -->

## Results {#results}

### Primary Findings

#### Finding One

Detailed explanation of the first major finding.

\`\`\`python
def analyze_data(data):
    return sum(data) / len(data)
\`\`\`

#### Finding Two

Detailed explanation of the second major finding.

#### Finding Three

Detailed explanation of the third major finding.

### Secondary Findings

Additional observations and patterns.

### Data Tables

#### Performance Metrics

| Metric | Baseline | Treatment | Change | P-Value |
|--------|----------|-----------|--------|---------|
| Speed | 100 | 150 | +50% | 0.001 |
| Accuracy | 95% | 98% | +3% | 0.010 |
| Efficiency | 80% | 92% | +12% | 0.005 |

#### Resource Utilization

| Resource | Before | After | Savings |
|----------|--------|-------|---------|
| CPU | 80% | 60% | 20% |
| Memory | 4GB | 3GB | 1GB |
| Storage | 100GB | 80GB | 20GB |

## Analysis {#analysis}

### Statistical Analysis

Comprehensive statistical evaluation of the results.

### Comparative Analysis

Comparison with previous studies and benchmarks.

### Error Analysis

Assessment of measurement errors and uncertainties.

<!-- START_SECTION -->
This section contains important analysis details
that span multiple paragraphs and should be preserved
unless explicitly modified by patches.
<!-- END_SECTION -->

## Discussion

### Interpretation

What do these results mean?

### Implications

What are the practical implications?

### Future Work

Recommendations for future research and improvements.

## Conclusions {#conclusions}

Summary of key findings and their significance.

### Key Takeaways

1. First major conclusion
2. Second major conclusion
3. Third major conclusion

### Recommendations

- Recommendation A
- Recommendation B
- Recommendation C

## Appendices

### Appendix A: Raw Data

Detailed raw data tables and figures.

### Appendix B: Calculations

Step-by-step calculations and derivations.

## References

1. Smith, J. (2023). "Research Paper Title". Journal of Testing.
2. Jones, A. (2023). "Another Paper". Conference Proceedings.
3. Brown, B. (2024). "Latest Research". Academic Journal.
`;
}

/**
 * Content operation benchmarks
 */
export function getContentOperationsSuite(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const configs: BenchmarkConfig[] = [];

  for (const fileCount of opts.fileCounts) {
    for (const complexity of opts.complexity) {
      const generator =
        complexity === "simple"
          ? generateSimpleContent
          : complexity === "medium"
            ? generateMediumContent
            : generateComplexContent;

      // Replace operation
      configs.push({
        name: `replace-${complexity}-${fileCount}files`,
        category: "content",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [{ op: "replace", old: "Test Author", new: "Updated Author" }],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Replace-regex operation
      configs.push({
        name: `replace-regex-${complexity}-${fileCount}files`,
        category: "content",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "replace-regex",
            pattern: "Document \\d+",
            replacement: "Document Updated",
            flags: "g",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Delete-between operation
      if (complexity !== "simple") {
        configs.push({
          name: `delete-between-${complexity}-${fileCount}files`,
          category: "content",
          fileCount,
          complexity,
          contentGenerator: generator,
          patches: [
            {
              op: "delete-between",
              start: "<!-- START_MARKER -->",
              end: "<!-- END_MARKER -->",
              inclusive: true,
            },
          ],
          warmupRuns: opts.warmupRuns,
          benchmarkRuns: opts.benchmarkRuns,
        });
      }

      // Replace-between operation
      if (complexity !== "simple") {
        configs.push({
          name: `replace-between-${complexity}-${fileCount}files`,
          category: "content",
          fileCount,
          complexity,
          contentGenerator: generator,
          patches: [
            {
              op: "replace-between",
              start: "<!-- START_MARKER -->",
              end: "<!-- END_MARKER -->",
              content: "Replaced content between markers.",
              inclusive: false,
            },
          ],
          warmupRuns: opts.warmupRuns,
          benchmarkRuns: opts.benchmarkRuns,
        });
      }

      // Replace-line operation
      configs.push({
        name: `replace-line-${complexity}-${fileCount}files`,
        category: "content",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "replace-line",
            match: "This is a simple document with basic content.",
            replacement: "This is an updated document with modified content.",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Insert-after-line operation
      configs.push({
        name: `insert-after-line-${complexity}-${fileCount}files`,
        category: "content",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "insert-after-line",
            match: "# Introduction",
            content: "\nThis line was inserted after the introduction header.\n",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Insert-before-line operation
      configs.push({
        name: `insert-before-line-${complexity}-${fileCount}files`,
        category: "content",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "insert-before-line",
            pattern: "## Conclusion",
            regex: false,
            content: "\nThis line was inserted before the conclusion.\n",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });
    }
  }

  return configs;
}

/**
 * Section operation benchmarks
 */
export function getSectionOperationsSuite(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const configs: BenchmarkConfig[] = [];

  for (const fileCount of opts.fileCounts) {
    for (const complexity of opts.complexity) {
      const generator =
        complexity === "simple"
          ? generateSimpleContent
          : complexity === "medium"
            ? generateMediumContent
            : generateComplexContent;

      // Remove-section operation
      configs.push({
        name: `remove-section-${complexity}-${fileCount}files`,
        category: "section",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [{ op: "remove-section", id: "section-two", includeChildren: true }],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Replace-section operation
      configs.push({
        name: `replace-section-${complexity}-${fileCount}files`,
        category: "section",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "replace-section",
            id: "section-one",
            content: "This is the new content for section one.",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Prepend-to-section operation
      configs.push({
        name: `prepend-to-section-${complexity}-${fileCount}files`,
        category: "section",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "prepend-to-section",
            id: "introduction",
            content: "\nThis content was prepended to the introduction.\n",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Append-to-section operation
      configs.push({
        name: `append-to-section-${complexity}-${fileCount}files`,
        category: "section",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "append-to-section",
            id: "introduction",
            content: "\nThis content was appended to the introduction.\n",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Rename-header operation
      configs.push({
        name: `rename-header-${complexity}-${fileCount}files`,
        category: "section",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "rename-header",
            id: "introduction",
            new: "Overview and Introduction",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Move-section operation
      if (complexity !== "simple") {
        configs.push({
          name: `move-section-${complexity}-${fileCount}files`,
          category: "section",
          fileCount,
          complexity,
          contentGenerator: generator,
          patches: [
            {
              op: "move-section",
              id: "overview",
              after: "features",
            },
          ],
          warmupRuns: opts.warmupRuns,
          benchmarkRuns: opts.benchmarkRuns,
        });
      }

      // Change-section-level operation
      configs.push({
        name: `change-section-level-${complexity}-${fileCount}files`,
        category: "section",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "change-section-level",
            id: "section-one",
            delta: 1,
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });
    }
  }

  return configs;
}

/**
 * Frontmatter operation benchmarks
 */
export function getFrontmatterOperationsSuite(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const configs: BenchmarkConfig[] = [];

  for (const fileCount of opts.fileCounts) {
    for (const complexity of opts.complexity) {
      const generator =
        complexity === "simple"
          ? generateSimpleContent
          : complexity === "medium"
            ? generateMediumContent
            : generateComplexContent;

      // Set-frontmatter operation (simple value)
      configs.push({
        name: `set-frontmatter-simple-${complexity}-${fileCount}files`,
        category: "frontmatter",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [{ op: "set-frontmatter", key: "version", value: "2.0.0" }],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Set-frontmatter operation (complex value)
      configs.push({
        name: `set-frontmatter-complex-${complexity}-${fileCount}files`,
        category: "frontmatter",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "set-frontmatter",
            key: "metadata",
            value: {
              lastModified: "2024-02-01",
              contributors: ["Alice", "Bob"],
              reviewStatus: "approved",
            },
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Remove-frontmatter operation
      configs.push({
        name: `remove-frontmatter-${complexity}-${fileCount}files`,
        category: "frontmatter",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [{ op: "remove-frontmatter", key: "date" }],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Rename-frontmatter operation
      configs.push({
        name: `rename-frontmatter-${complexity}-${fileCount}files`,
        category: "frontmatter",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [{ op: "rename-frontmatter", old: "author", new: "creator" }],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Merge-frontmatter operation
      configs.push({
        name: `merge-frontmatter-${complexity}-${fileCount}files`,
        category: "frontmatter",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "merge-frontmatter",
            values: {
              updated: "2024-02-01",
              reviewer: "Alice",
              approved: true,
            },
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });
    }
  }

  return configs;
}

/**
 * Table operation benchmarks
 */
export function getTableOperationsSuite(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const configs: BenchmarkConfig[] = [];

  // Tables only exist in medium and complex documents
  const complexityLevels = opts.complexity.filter((c) => c !== "simple");

  for (const fileCount of opts.fileCounts) {
    for (const complexity of complexityLevels) {
      const generator = complexity === "medium" ? generateMediumContent : generateComplexContent;

      // Replace-table-cell operation (by index)
      configs.push({
        name: `replace-table-cell-index-${complexity}-${fileCount}files`,
        category: "table",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "replace-table-cell",
            table: 0,
            row: 0,
            column: 1,
            content: "Updated",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Replace-table-cell operation (by header)
      configs.push({
        name: `replace-table-cell-header-${complexity}-${fileCount}files`,
        category: "table",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "replace-table-cell",
            table: 0,
            row: 1,
            column: "Status",
            content: "In Progress",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Add-table-row operation
      configs.push({
        name: `add-table-row-${complexity}-${fileCount}files`,
        category: "table",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "add-table-row",
            table: 0,
            values: ["New Feature", "Pending", "Low"],
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Remove-table-row operation
      configs.push({
        name: `remove-table-row-${complexity}-${fileCount}files`,
        category: "table",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "remove-table-row",
            table: 0,
            row: 1,
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Add-table-column operation
      configs.push({
        name: `add-table-column-${complexity}-${fileCount}files`,
        category: "table",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "add-table-column",
            table: 0,
            header: "Owner",
            defaultValue: "Unassigned",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Remove-table-column operation
      configs.push({
        name: `remove-table-column-${complexity}-${fileCount}files`,
        category: "table",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "remove-table-column",
            table: 0,
            column: "Priority",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });
    }
  }

  return configs;
}

/**
 * File operation benchmarks
 *
 * Note: These benchmarks test file operations but don't actually perform
 * file system operations. They're included for completeness and can be
 * used with appropriate test harnesses.
 */
export function getFileOperationsSuite(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const configs: BenchmarkConfig[] = [];

  for (const fileCount of opts.fileCounts) {
    for (const complexity of opts.complexity) {
      const generator =
        complexity === "simple"
          ? generateSimpleContent
          : complexity === "medium"
            ? generateMediumContent
            : generateComplexContent;

      // Copy-file operation
      configs.push({
        name: `copy-file-${complexity}-${fileCount}files`,
        category: "file",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "copy-file",
            src: "test.md",
            dest: "test-copy.md",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Rename-file operation
      configs.push({
        name: `rename-file-${complexity}-${fileCount}files`,
        category: "file",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "rename-file",
            match: "*.md",
            rename: "renamed.md",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Move-file operation
      configs.push({
        name: `move-file-${complexity}-${fileCount}files`,
        category: "file",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "move-file",
            match: "*.md",
            dest: "moved/",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Delete-file operation
      configs.push({
        name: `delete-file-${complexity}-${fileCount}files`,
        category: "file",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          {
            op: "delete-file",
            match: "*.tmp",
          },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });
    }
  }

  return configs;
}

/**
 * Combined operations benchmarks (multiple patches applied together)
 */
export function getCombinedOperationsSuite(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const configs: BenchmarkConfig[] = [];

  for (const fileCount of opts.fileCounts) {
    for (const complexity of opts.complexity) {
      const generator =
        complexity === "simple"
          ? generateSimpleContent
          : complexity === "medium"
            ? generateMediumContent
            : generateComplexContent;

      // Combined: frontmatter + content + section operations
      configs.push({
        name: `combined-typical-${complexity}-${fileCount}files`,
        category: "combined",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          { op: "set-frontmatter", key: "updated", value: "2024-02-01" },
          { op: "replace", old: "Test Author", new: "Updated Author" },
          { op: "append-to-section", id: "introduction", content: "\nAdded content.\n" },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Combined: multiple section operations
      configs.push({
        name: `combined-sections-${complexity}-${fileCount}files`,
        category: "combined",
        fileCount,
        complexity,
        contentGenerator: generator,
        patches: [
          { op: "rename-header", id: "introduction", new: "Overview" },
          { op: "change-section-level", id: "section-one", delta: 1 },
          { op: "replace-section", id: "conclusion", content: "Updated conclusion." },
        ],
        warmupRuns: opts.warmupRuns,
        benchmarkRuns: opts.benchmarkRuns,
      });

      // Combined: complex multi-operation workflow
      if (complexity !== "simple") {
        configs.push({
          name: `combined-complex-${complexity}-${fileCount}files`,
          category: "combined",
          fileCount,
          complexity,
          contentGenerator: generator,
          patches: [
            { op: "merge-frontmatter", values: { updated: "2024-02-01", version: "2.0" } },
            {
              op: "replace-regex",
              pattern: "Document \\d+",
              replacement: "Document Updated",
              flags: "g",
            },
            {
              op: "delete-between",
              start: "<!-- START_MARKER -->",
              end: "<!-- END_MARKER -->",
              inclusive: true,
            },
            { op: "replace-table-cell", table: 0, row: 0, column: 1, content: "Updated" },
            { op: "add-table-row", table: 0, values: ["New", "Added", "High"] },
          ],
          warmupRuns: opts.warmupRuns,
          benchmarkRuns: opts.benchmarkRuns,
        });
      }
    }
  }

  return configs;
}

/**
 * Generate all standard benchmark configurations
 *
 * @param options - Configuration options for benchmarks
 * @returns Array of all benchmark configurations
 */
export function generateAllBenchmarkConfigs(options: BenchmarkOptions = {}): BenchmarkConfig[] {
  const configs: BenchmarkConfig[] = [];

  configs.push(...getContentOperationsSuite(options));
  configs.push(...getSectionOperationsSuite(options));
  configs.push(...getFrontmatterOperationsSuite(options));
  configs.push(...getTableOperationsSuite(options));
  configs.push(...getFileOperationsSuite(options));
  configs.push(...getCombinedOperationsSuite(options));

  return configs;
}

/**
 * Get benchmarks filtered by category
 *
 * @param category - Category to filter by
 * @param options - Configuration options for benchmarks
 * @returns Array of benchmark configurations for the specified category
 */
export function getBenchmarksByCategory(
  category: string,
  options: BenchmarkOptions = {},
): BenchmarkConfig[] {
  const categoryMap: Record<string, () => BenchmarkConfig[]> = {
    content: () => getContentOperationsSuite(options),
    section: () => getSectionOperationsSuite(options),
    frontmatter: () => getFrontmatterOperationsSuite(options),
    table: () => getTableOperationsSuite(options),
    file: () => getFileOperationsSuite(options),
    combined: () => getCombinedOperationsSuite(options),
  };

  const generator = categoryMap[category.toLowerCase()];
  if (!generator) {
    throw new Error(`Unknown benchmark category: ${category}`);
  }

  return generator();
}

/**
 * Get benchmarks filtered by complexity
 *
 * @param complexity - Complexity level to filter by
 * @param options - Configuration options for benchmarks
 * @returns Array of benchmark configurations for the specified complexity
 */
export function getBenchmarksByComplexity(
  complexity: "simple" | "medium" | "complex",
  options: BenchmarkOptions = {},
): BenchmarkConfig[] {
  const opts = { ...options, complexity: [complexity] };
  return generateAllBenchmarkConfigs(opts);
}

/**
 * Get a specific benchmark configuration by name
 *
 * @param name - Name of the benchmark
 * @param options - Configuration options for benchmarks
 * @returns The matching benchmark configuration or undefined
 */
export function getBenchmarkByName(
  name: string,
  options: BenchmarkOptions = {},
): BenchmarkConfig | undefined {
  const all = generateAllBenchmarkConfigs(options);
  return all.find((config) => config.name === name);
}

/**
 * Get summary statistics about available benchmarks
 *
 * @param options - Configuration options for benchmarks
 * @returns Summary of benchmark counts by category and complexity
 */
export function getBenchmarkSummary(options: BenchmarkOptions = {}): {
  total: number;
  byCategory: Record<string, number>;
  byComplexity: Record<string, number>;
} {
  const all = generateAllBenchmarkConfigs(options);

  const byCategory: Record<string, number> = {};
  const byComplexity: Record<string, number> = {};

  for (const config of all) {
    byCategory[config.category] = (byCategory[config.category] || 0) + 1;
    byComplexity[config.complexity] = (byComplexity[config.complexity] || 0) + 1;
  }

  return {
    total: all.length,
    byCategory,
    byComplexity,
  };
}
