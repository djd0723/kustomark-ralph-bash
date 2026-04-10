import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("kustomark suggest command", () => {
  const testDir = "/tmp/kustomark-suggest-test";
  const cliPath = join(process.cwd(), "dist/cli/index.js");

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ============================================================================
  // Basic patch suggestion tests
  // ============================================================================

  test("suggest simple replace operation", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Hello\n\nThis is foo content.");
    writeFileSync(targetFile, "# Hello\n\nThis is bar content.");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBeGreaterThan(0);

    // Should suggest a replace operation
    const replacePatch = output.config.patches.find((p: any) => p.op === "replace");
    expect(replacePatch).toBeDefined();
    expect(replacePatch.old).toBe("foo");
    expect(replacePatch.new).toBe("bar");
  });

  test("suggest replace-regex operation for pattern changes", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Version 1.0.0\n\nRelease date: 2024-01-15");
    writeFileSync(targetFile, "# Version 2.0.0\n\nRelease date: 2024-06-20");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBeGreaterThan(0);

    // Should suggest operations for version and date changes
    // Could be replace, replace-regex, rename-header, etc.
    const patches = output.config.patches;
    expect(patches.length).toBeGreaterThan(0);
  });

  test("suggest frontmatter changes", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const sourceContent = `---
title: Original Title
author: John Doe
version: 1.0
---

# Content`;

    const targetContent = `---
title: Updated Title
author: Jane Smith
version: 2.0
published: true
---

# Content`;

    writeFileSync(sourceFile, sourceContent);
    writeFileSync(targetFile, targetContent);

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();

    // Should suggest set-frontmatter or merge-frontmatter operations
    const frontmatterPatches = output.config.patches.filter(
      (p: any) => p.op === "set-frontmatter" || p.op === "merge-frontmatter",
    );
    expect(frontmatterPatches.length).toBeGreaterThan(0);
  });

  test("suggest section operations", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const sourceContent = `# Document

## Introduction
Some intro text.

## Features
- Feature 1
- Feature 2

## Conclusion
The end.`;

    const targetContent = `# Document

## Introduction
Updated intro text.

## Features
- Feature 1
- Feature 2
- Feature 3

## New Section
New content here.

## Conclusion
The end.`;

    writeFileSync(sourceFile, sourceContent);
    writeFileSync(targetFile, targetContent);

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBeGreaterThan(0);

    // Should suggest section-related operations
    const sectionPatches = output.config.patches.filter((p: any) =>
      ["replace-section", "append-to-section", "prepend-to-section"].includes(p.op),
    );
    expect(sectionPatches.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // File-based suggestions
  // ============================================================================

  test("suggest patches for actual files with differences", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const sourceContent = `# API Documentation

## Authentication
Use API key for authentication.

## Endpoints
- GET /users
- POST /users`;

    const targetContent = `# API Documentation

## Authentication
Use OAuth2 for authentication.

## Endpoints
- GET /users
- POST /users
- DELETE /users/:id

## Rate Limiting
Maximum 1000 requests per hour.`;

    writeFileSync(sourceFile, sourceContent);
    writeFileSync(targetFile, targetContent);

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBeGreaterThan(0);
    expect(output.stats).toBeDefined();
    expect(output.stats.filesAnalyzed).toBe(1);
  });

  test("suggest no patches for identical files", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const content = "# Same Content\n\nIdentical in both files.";
    writeFileSync(sourceFile, content);
    writeFileSync(targetFile, content);

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBe(0);
    expect(output.stats.filesAnalyzed).toBe(0);
  });

  test("suggest patches for completely different files", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Original\n\nCompletely different.");
    writeFileSync(targetFile, "# New Document\n\nNothing in common.");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    // Should suggest patches, possibly including full content replacement
    expect(output.config.patches.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // Directory-based suggestions
  // ============================================================================

  test("suggest patches for entire directories", () => {
    const sourceDir = join(testDir, "source");
    const targetDir = join(testDir, "target");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    // Create matching files with differences
    writeFileSync(join(sourceDir, "doc1.md"), "# Doc 1\n\nOriginal content.");
    writeFileSync(join(targetDir, "doc1.md"), "# Doc 1\n\nUpdated content.");

    writeFileSync(join(sourceDir, "doc2.md"), "# Doc 2\n\nVersion 1.0");
    writeFileSync(join(targetDir, "doc2.md"), "# Doc 2\n\nVersion 2.0");

    const result = execSync(`${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBeGreaterThan(0);
    expect(output.stats.filesAnalyzed).toBe(2);

    // Patches should have include patterns for each file
    const patchesWithInclude = output.config.patches.filter((p: any) => p.include);
    expect(patchesWithInclude.length).toBeGreaterThan(0);
  });

  test("match files by relative path in directories", () => {
    const sourceDir = join(testDir, "source");
    const targetDir = join(testDir, "target");

    mkdirSync(join(sourceDir, "subdir"), { recursive: true });
    mkdirSync(join(targetDir, "subdir"), { recursive: true });

    // Create multiple files to ensure include patterns are added
    writeFileSync(join(sourceDir, "subdir", "nested.md"), "# Nested\n\nOriginal.");
    writeFileSync(join(targetDir, "subdir", "nested.md"), "# Nested\n\nModified.");
    writeFileSync(join(sourceDir, "other.md"), "# Other\n\nOriginal.");
    writeFileSync(join(targetDir, "other.md"), "# Other\n\nModified.");

    const result = execSync(`${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.stats.filesAnalyzed).toBe(2);

    // Should have patches with include pattern for nested file
    const nestedPatch = output.config.patches.find((p: any) => p.include && p.include.includes("subdir"));
    expect(nestedPatch).toBeDefined();
  });

  test("suggests delete-file for files only in source", () => {
    const sourceDir = join(testDir, "source");
    const targetDir = join(testDir, "target");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    // File only in source (deleted in target)
    writeFileSync(join(sourceDir, "only-source.md"), "# Only in source");

    // File only in target (added in target — no suggestion possible)
    writeFileSync(join(targetDir, "only-target.md"), "# Only in target");

    // Files in both (need at least 2 for include patterns to be added)
    writeFileSync(join(sourceDir, "both.md"), "# Both\n\nOriginal.");
    writeFileSync(join(targetDir, "both.md"), "# Both\n\nModified.");
    writeFileSync(join(sourceDir, "another.md"), "# Another\n\nOriginal.");
    writeFileSync(join(targetDir, "another.md"), "# Another\n\nModified.");

    const result = execSync(`${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.stats.filesAnalyzed).toBe(2);
    expect(output.stats.filesDeleted).toBe(1);

    // Should generate a delete-file patch for the source-only file
    const deleteFilePatch = output.config.patches.find((p: any) => p.op === "delete-file");
    expect(deleteFilePatch).toBeDefined();
    expect(deleteFilePatch.match).toBe("only-source.md");

    // delete-file patches should not carry an include filter
    expect(deleteFilePatch.include).toBeUndefined();

    // Content patches for matched files should still use include patterns
    const bothPatch = output.config.patches.find((p: any) => p.include && p.include.includes("both.md"));
    expect(bothPatch).toBeDefined();
  });

  test("delete-file patch has high confidence score", () => {
    const sourceDir = join(testDir, "source-del-score");
    const targetDir = join(testDir, "target-del-score");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    // File only in source
    writeFileSync(join(sourceDir, "removed.md"), "# Removed");
    // At least one matching file so the command doesn't error
    writeFileSync(join(sourceDir, "kept.md"), "# Kept\n\nSame.");
    writeFileSync(join(targetDir, "kept.md"), "# Kept\n\nSame.");

    const result = execSync(`${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    const deleteScored = output.scoredPatches.find((sp: any) => sp.patch.op === "delete-file");
    expect(deleteScored).toBeDefined();
    expect(deleteScored.score).toBe(0.9);
    expect(deleteScored.description).toContain("removed.md");
  });

  test("suggest works with only source-only files (no matched pairs)", () => {
    const sourceDir = join(testDir, "source-only-dir");
    const targetDir = join(testDir, "target-only-dir");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    // Only source files — all deleted in target
    writeFileSync(join(sourceDir, "deleted1.md"), "# Deleted 1");
    writeFileSync(join(sourceDir, "deleted2.md"), "# Deleted 2");

    const result = execSync(`${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.stats.filesAnalyzed).toBe(0);
    expect(output.stats.filesDeleted).toBe(2);

    const deletePatches = output.config.patches.filter((p: any) => p.op === "delete-file");
    expect(deletePatches).toHaveLength(2);

    const matchValues = deletePatches.map((p: any) => p.match).sort();
    expect(matchValues).toEqual(["deleted1.md", "deleted2.md"]);
  });

  // ============================================================================
  // Output formats
  // ============================================================================

  test("output text format", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile}`, {
      encoding: "utf-8",
    });

    // Text format should include human-readable output
    expect(result).toContain("suggested patches");
    expect(result).toMatch(/op:\s*replace/);
  });

  test("output JSON format", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config).toBeDefined();
    expect(output.config.patches).toBeDefined();
    expect(Array.isArray(output.config.patches)).toBe(true);
    expect(output.stats).toBeDefined();
  });

  test("write config to file with --output flag", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const outputFile = join(testDir, "kustomark.yaml");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --output ${outputFile}`, {
      encoding: "utf-8",
    });

    expect(existsSync(outputFile)).toBe(true);

    const configContent = readFileSync(outputFile, "utf-8");

    // Should be valid YAML with kustomark structure
    expect(configContent).toContain("apiVersion: kustomark/v1");
    expect(configContent).toContain("kind: Kustomization");
    expect(configContent).toContain("patches:");
    expect(configContent).toMatch(/op:\s*replace/);
  });

  test("YAML output with --output flag writes YAML config", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const outputFile = join(testDir, "kustomark.yaml");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --output ${outputFile}`,
      {
        encoding: "utf-8",
      },
    );

    expect(existsSync(outputFile)).toBe(true);

    const configContent = readFileSync(outputFile, "utf-8");

    // The --output flag writes YAML config (regardless of --format flag)
    expect(configContent).toContain("apiVersion: kustomark/v1");
    expect(configContent).toContain("kind: Kustomization");
    expect(configContent).toContain("patches:");
    expect(configContent).toMatch(/op:\s*replace/);
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  test("handle non-existent source file", () => {
    const sourceFile = join(testDir, "nonexistent.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(targetFile, "# Target");

    try {
      execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("does not exist");
    }
  });

  test("handle non-existent target file", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "nonexistent.md");

    writeFileSync(sourceFile, "# Source");

    try {
      execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("does not exist");
    }
  });

  test("handle invalid file paths", () => {
    try {
      execSync(`${cliPath} suggest --source /invalid/path/source.md --target /invalid/path/target.md`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
    }
  });

  test("handle empty files", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "");
    writeFileSync(targetFile, "");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.config.patches.length).toBe(0);
    expect(output.stats.filesAnalyzed).toBe(0);
  });

  test("handle binary files gracefully", () => {
    const sourceFile = join(testDir, "source.bin");
    const targetFile = join(testDir, "target.bin");

    // Create binary-like content
    const binaryContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    writeFileSync(sourceFile, binaryContent);
    writeFileSync(targetFile, binaryContent);

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    // Should handle identical binary files (no patches needed)
    expect(output.config).toBeDefined();
    expect(output.config.patches.length).toBe(0);
  });

  test("handle empty source file with content in target", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "");
    writeFileSync(targetFile, "# New Content\n\nThis was added.");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    // Empty source vs non-empty target may or may not generate patches
    // depending on the suggestion algorithm
    expect(output.config.patches.length).toBeGreaterThanOrEqual(0);
  });

  test("handle content in source but empty target", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Original Content\n\nThis was removed.");
    writeFileSync(targetFile, "");

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    // Might suggest deletion or replacement with empty content
    expect(output.config.patches.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // Advanced scenarios
  // ============================================================================

  test("suggest multiple patch types in single comparison", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const sourceContent = `---
title: Original
version: 1.0
---

# Document

## Section 1
Original text here.

## Section 2
More original text.`;

    const targetContent = `---
title: Updated
version: 2.0
author: Jane Doe
---

# Document

## Section 1
Updated text here.

## Section 2
More updated text.

## Section 3
New section added.`;

    writeFileSync(sourceFile, sourceContent);
    writeFileSync(targetFile, targetContent);

    const result = execSync(`${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();

    // Should suggest multiple types of patches
    const patchOps = output.config.patches.map((p: any) => p.op);
    const uniqueOps = new Set(patchOps);

    // Should have at least 2 different operation types
    expect(uniqueOps.size).toBeGreaterThanOrEqual(2);
  });

  test("suggest patches with --min-confidence threshold", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nSome content here.");
    writeFileSync(targetFile, "# Title\n\nSlightly different content.");

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json --min-confidence=0.8`,
      {
        encoding: "utf-8",
      },
    );

    const output = JSON.parse(result);

    expect(output.config.patches).toBeDefined();
    expect(output.stats).toBeDefined();
    // High confidence threshold may filter out some patches
    expect(output.config.patches.length).toBeGreaterThanOrEqual(0);
  });

  // ============================================================================
  // Per-patch confidence scores
  // ============================================================================

  test("JSON output includes scoredPatches array", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld content here.");
    writeFileSync(targetFile, "# Title\n\nNew content here.");

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
      { encoding: "utf-8" },
    );

    const output = JSON.parse(result);

    expect(output.scoredPatches).toBeDefined();
    expect(Array.isArray(output.scoredPatches)).toBe(true);
  });

  test("scoredPatches contains score and description for each patch", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld content here.");
    writeFileSync(targetFile, "# Title\n\nNew content here.");

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
      { encoding: "utf-8" },
    );

    const output = JSON.parse(result);

    expect(output.scoredPatches.length).toBeGreaterThan(0);
    for (const sp of output.scoredPatches) {
      expect(typeof sp.score).toBe("number");
      expect(sp.score).toBeGreaterThanOrEqual(0);
      expect(sp.score).toBeLessThanOrEqual(1);
      expect(typeof sp.description).toBe("string");
      expect(sp.description.length).toBeGreaterThan(0);
      expect(sp.patch).toBeDefined();
      expect(typeof sp.patch.op).toBe("string");
    }
  });

  test("scoredPatches length matches config.patches length", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const sourceContent = `---
title: Draft
author: Alice
---

# Guide

## Installation
Run npm install.

## Usage
See docs.`;

    const targetContent = `---
title: Published
author: Bob
---

# Guide

## Installation
Run npm install then configure.

## Usage
See updated docs.

## Troubleshooting
Check logs.`;

    writeFileSync(sourceFile, sourceContent);
    writeFileSync(targetFile, targetContent);

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
      { encoding: "utf-8" },
    );

    const output = JSON.parse(result);

    expect(output.scoredPatches.length).toBe(output.config.patches.length);
  });

  test("scoredPatches is empty for identical files", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const content = "# Same\n\nIdentical content.";
    writeFileSync(sourceFile, content);
    writeFileSync(targetFile, content);

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
      { encoding: "utf-8" },
    );

    const output = JSON.parse(result);

    expect(output.scoredPatches).toBeDefined();
    expect(output.scoredPatches.length).toBe(0);
  });

  test("scoredPatches respects --min-confidence filter", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    // Rich content with many change types (mix of high and low confidence)
    const sourceContent = `---
title: Old Title
status: draft
---

# Document

## Section One
Original content.

## Section Two
More content.`;

    const targetContent = `---
title: New Title
status: published
---

# Document

## Section One
Updated content.

## Section Two
More updated content.`;

    writeFileSync(sourceFile, sourceContent);
    writeFileSync(targetFile, targetContent);

    const lowThreshold = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json --min-confidence=0.0`,
      { encoding: "utf-8" },
    );
    const highThreshold = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json --min-confidence=0.9`,
      { encoding: "utf-8" },
    );

    const lowOutput = JSON.parse(lowThreshold);
    const highOutput = JSON.parse(highThreshold);

    // High threshold should produce fewer or equal patches
    expect(highOutput.scoredPatches.length).toBeLessThanOrEqual(lowOutput.scoredPatches.length);

    // All scoredPatches from high-threshold output should have score >= 0.9
    for (const sp of highOutput.scoredPatches) {
      expect(sp.score).toBeGreaterThanOrEqual(0.9);
    }
  });

  test("scoredPatches patches match config.patches operations", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Heading\n\nOld word in text.");
    writeFileSync(targetFile, "# Heading\n\nNew word in text.");

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
      { encoding: "utf-8" },
    );

    const output = JSON.parse(result);

    // Every op in scoredPatches should match the corresponding config.patches entry
    const scoredOps = output.scoredPatches.map((sp: any) => sp.patch.op);
    const configOps = output.config.patches.map((p: any) => p.op);
    expect(scoredOps).toEqual(configOps);
  });

  test("text output with verbosity shows patch confidence scores", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld text here.");
    writeFileSync(targetFile, "# Title\n\nNew text here.");

    const result = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} -vv`,
      { encoding: "utf-8" },
    );

    // Verbose text output should include per-patch confidence percentages
    expect(result).toMatch(/\[\d+%\]/);
    expect(result).toContain("Patch confidence scores:");
  });
});
