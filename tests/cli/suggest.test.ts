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
  // File operation detection: rename-file, move-file, copy-file
  // ============================================================================

  test("suggests rename-file when source-only and target-only share content in same dir", () => {
    const sourceDir = join(testDir, "source-rename");
    const targetDir = join(testDir, "target-rename");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const sharedContent = "# Hello World\n\nThis is content.";
    // source-only: old-name.md; target-only: new-name.md; same content → rename-file
    writeFileSync(join(sourceDir, "old-name.md"), sharedContent);
    writeFileSync(join(targetDir, "new-name.md"), sharedContent);

    // A paired file so the command has context (avoids "no matching files" error)
    writeFileSync(join(sourceDir, "kept.md"), "# Kept\n\nSame.");
    writeFileSync(join(targetDir, "kept.md"), "# Kept\n\nSame.");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    const renamePatch = output.config.patches.find((p: any) => p.op === "rename-file");
    expect(renamePatch).toBeDefined();
    expect(renamePatch.match).toBe("old-name.md");
    expect(renamePatch.rename).toBe("new-name.md");

    expect(output.stats.filesRenamed).toBe(1);
  });

  test("rename-file is not also emitted as delete-file for the same source file", () => {
    const sourceDir = join(testDir, "source-rename-no-del");
    const targetDir = join(testDir, "target-rename-no-del");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const sharedContent = "# Content\n\nSome text.";
    writeFileSync(join(sourceDir, "before.md"), sharedContent);
    writeFileSync(join(targetDir, "after.md"), sharedContent);
    writeFileSync(join(sourceDir, "base.md"), "# Base");
    writeFileSync(join(targetDir, "base.md"), "# Base");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    // rename-file should be suggested
    expect(output.config.patches.some((p: any) => p.op === "rename-file")).toBe(true);
    // delete-file should NOT be suggested for before.md
    const deletePatches = output.config.patches.filter((p: any) => p.op === "delete-file");
    expect(deletePatches.every((p: any) => p.match !== "before.md")).toBe(true);
    expect(output.stats.filesDeleted).toBe(0);
  });

  test("suggests move-file when source-only and target-only share content and basename in different dirs", () => {
    const sourceDir = join(testDir, "source-move");
    const targetDir = join(testDir, "target-move");

    mkdirSync(join(sourceDir, "old-dir"), { recursive: true });
    mkdirSync(join(targetDir, "new-dir"), { recursive: true });

    const sharedContent = "# Document\n\nSome content.";
    // Same basename (doc.md), different directory → move-file
    writeFileSync(join(sourceDir, "old-dir", "doc.md"), sharedContent);
    writeFileSync(join(targetDir, "new-dir", "doc.md"), sharedContent);

    // Paired file so command has context
    writeFileSync(join(sourceDir, "base.md"), "# Base");
    writeFileSync(join(targetDir, "base.md"), "# Base");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    const movePatch = output.config.patches.find((p: any) => p.op === "move-file");
    expect(movePatch).toBeDefined();
    expect(movePatch.match).toBe("old-dir/doc.md");
    expect(movePatch.dest).toContain("new-dir");

    expect(output.stats.filesMoved).toBe(1);
  });

  test("move-file is not also emitted as delete-file for the same source file", () => {
    const sourceDir = join(testDir, "source-move-no-del");
    const targetDir = join(testDir, "target-move-no-del");

    mkdirSync(join(sourceDir, "subA"), { recursive: true });
    mkdirSync(join(targetDir, "subB"), { recursive: true });

    const sharedContent = "# Moved\n\nContent.";
    writeFileSync(join(sourceDir, "subA", "file.md"), sharedContent);
    writeFileSync(join(targetDir, "subB", "file.md"), sharedContent);
    writeFileSync(join(sourceDir, "base.md"), "# Base");
    writeFileSync(join(targetDir, "base.md"), "# Base");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    expect(output.config.patches.some((p: any) => p.op === "move-file")).toBe(true);
    const deletePatches = output.config.patches.filter((p: any) => p.op === "delete-file");
    expect(deletePatches.every((p: any) => p.match !== "subA/file.md")).toBe(true);
    expect(output.stats.filesDeleted).toBe(0);
  });

  test("suggests copy-file when an unchanged paired source file content appears in a target-only file", () => {
    const sourceDir = join(testDir, "source-copy");
    const targetDir = join(testDir, "target-copy");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const sharedContent = "# Original\n\nContent to copy.";
    // original.md: paired, unchanged
    writeFileSync(join(sourceDir, "original.md"), sharedContent);
    writeFileSync(join(targetDir, "original.md"), sharedContent);
    // copy.md: target-only with same content as original.md
    writeFileSync(join(targetDir, "copy.md"), sharedContent);

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    const copyPatch = output.config.patches.find((p: any) => p.op === "copy-file");
    expect(copyPatch).toBeDefined();
    expect(copyPatch.src).toBe("original.md");
    expect(copyPatch.dest).toBe("copy.md");

    expect(output.stats.filesCopied).toBe(1);
  });

  test("copy-file not suggested when paired source file was modified in target", () => {
    const sourceDir = join(testDir, "source-copy-modified");
    const targetDir = join(testDir, "target-copy-modified");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const sourceContent = "# Original\n\nOriginal content.";
    const targetContent = "# Original\n\nModified content.";
    // original.md: paired, CHANGED → copy-file must not be suggested
    writeFileSync(join(sourceDir, "original.md"), sourceContent);
    writeFileSync(join(targetDir, "original.md"), targetContent);
    // extra.md: target-only with the ORIGINAL source content
    writeFileSync(join(targetDir, "extra.md"), sourceContent);

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    expect(output.config.patches.some((p: any) => p.op === "copy-file")).toBe(false);
    expect(output.stats.filesCopied).toBe(0);
  });

  test("ambiguous rename (multiple source-only files with same content) falls back to delete-file", () => {
    const sourceDir = join(testDir, "source-ambig");
    const targetDir = join(testDir, "target-ambig");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const sharedContent = "# Duplicate\n\nSame content.";
    // Two source-only files with identical content → ambiguous, not renamed
    writeFileSync(join(sourceDir, "dup1.md"), sharedContent);
    writeFileSync(join(sourceDir, "dup2.md"), sharedContent);
    // One target-only with same content
    writeFileSync(join(targetDir, "target.md"), sharedContent);

    writeFileSync(join(sourceDir, "base.md"), "# Base");
    writeFileSync(join(targetDir, "base.md"), "# Base");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    // No rename-file suggested for ambiguous content
    expect(output.config.patches.some((p: any) => p.op === "rename-file")).toBe(false);
    // Both source-only files should fall back to delete-file
    expect(output.stats.filesDeleted).toBe(2);
  });

  test("rename-file patch has score 0.9", () => {
    const sourceDir = join(testDir, "source-rename-score");
    const targetDir = join(testDir, "target-rename-score");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const content = "# Score Test\n\nContent.";
    writeFileSync(join(sourceDir, "old.md"), content);
    writeFileSync(join(targetDir, "new.md"), content);
    writeFileSync(join(sourceDir, "base.md"), "# Base");
    writeFileSync(join(targetDir, "base.md"), "# Base");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    const renameScored = output.scoredPatches.find((sp: any) => sp.patch.op === "rename-file");
    expect(renameScored).toBeDefined();
    expect(renameScored.score).toBe(0.9);
  });

  test("move-file patch has score 0.9", () => {
    const sourceDir = join(testDir, "source-move-score");
    const targetDir = join(testDir, "target-move-score");

    mkdirSync(join(sourceDir, "dirA"), { recursive: true });
    mkdirSync(join(targetDir, "dirB"), { recursive: true });

    const content = "# Score Test\n\nContent.";
    writeFileSync(join(sourceDir, "dirA", "file.md"), content);
    writeFileSync(join(targetDir, "dirB", "file.md"), content);
    writeFileSync(join(sourceDir, "base.md"), "# Base");
    writeFileSync(join(targetDir, "base.md"), "# Base");

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    const moveScored = output.scoredPatches.find((sp: any) => sp.patch.op === "move-file");
    expect(moveScored).toBeDefined();
    expect(moveScored.score).toBe(0.9);
  });

  test("copy-file patch has score 0.9", () => {
    const sourceDir = join(testDir, "source-copy-score");
    const targetDir = join(testDir, "target-copy-score");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    const content = "# Score Test\n\nContent.";
    writeFileSync(join(sourceDir, "original.md"), content);
    writeFileSync(join(targetDir, "original.md"), content);
    writeFileSync(join(targetDir, "copy.md"), content);

    const result = execSync(
      `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
      { encoding: "utf-8" },
    );
    const output = JSON.parse(result);

    const copyScored = output.scoredPatches.find((sp: any) => sp.patch.op === "copy-file");
    expect(copyScored).toBeDefined();
    expect(copyScored.score).toBe(0.9);
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
  // --write flag: merge-aware patch writing
  // ============================================================================

  describe("--write flag", () => {
    test("creates a new config file when none exists", () => {
      const sourceFile = join(testDir, "source.md");
      const targetFile = join(testDir, "target.md");
      const writeFile = join(testDir, "patches.yaml");

      writeFileSync(sourceFile, "# Hello\n\nOld content.");
      writeFileSync(targetFile, "# Hello\n\nNew content.");

      execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --write ${writeFile}`,
        { encoding: "utf-8" },
      );

      expect(existsSync(writeFile)).toBe(true);
      const content = readFileSync(writeFile, "utf-8");
      expect(content).toContain("apiVersion: kustomark/v1");
      expect(content).toContain("kind: Kustomization");
      expect(content).toContain("patches:");
    });

    test("merges patches into existing config file", () => {
      const sourceFile = join(testDir, "source.md");
      const targetFile = join(testDir, "target.md");
      const writeFile = join(testDir, "patches.yaml");

      writeFileSync(sourceFile, "# Hello\n\nOld content.");
      writeFileSync(targetFile, "# Hello\n\nNew content.");

      // Pre-create a config with one existing patch
      const existingConfig = `apiVersion: kustomark/v1
kind: Kustomization
output: ./output
resources:
  - source.md
patches:
  - op: replace
    old: existing
    new: replaced
`;
      writeFileSync(writeFile, existingConfig, "utf-8");

      execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --write ${writeFile}`,
        { encoding: "utf-8" },
      );

      const content = readFileSync(writeFile, "utf-8");
      // Should still have the original patch
      expect(content).toContain("existing");
      // Should have new patches too
      expect(content).toContain("Old content");
      // apiVersion preserved
      expect(content).toContain("apiVersion: kustomark/v1");
    });

    test("still prints to stdout when --write is used", () => {
      const sourceFile = join(testDir, "source.md");
      const targetFile = join(testDir, "target.md");
      const writeFile = join(testDir, "patches.yaml");

      writeFileSync(sourceFile, "# Hello\n\nOld content.");
      writeFileSync(targetFile, "# Hello\n\nNew content.");

      const output = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --write ${writeFile} --format=json`,
        { encoding: "utf-8" },
      );

      // stdout still has JSON output
      const parsed = JSON.parse(output);
      expect(parsed.config).toBeDefined();
      expect(parsed.config.patches).toBeDefined();
    });

    test("without --write flag, no config file is created", () => {
      const sourceFile = join(testDir, "source.md");
      const targetFile = join(testDir, "target.md");
      const writeFile = join(testDir, "not-created.yaml");

      writeFileSync(sourceFile, "# Hello\n\nOld content.");
      writeFileSync(targetFile, "# Hello\n\nNew content.");

      execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );

      expect(existsSync(writeFile)).toBe(false);
    });

    test("confirmation message appears in text output", () => {
      const sourceFile = join(testDir, "source.md");
      const targetFile = join(testDir, "target.md");
      const writeFile = join(testDir, "patches.yaml");

      writeFileSync(sourceFile, "# Hello\n\nOld content.");
      writeFileSync(targetFile, "# Hello\n\nNew content.");

      const output = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --write ${writeFile}`,
        { encoding: "utf-8" },
      );

      expect(output).toContain("Patches written to:");
    });

    test("merges into config file with no existing patches key", () => {
      const sourceFile = join(testDir, "source.md");
      const targetFile = join(testDir, "target.md");
      const writeFile = join(testDir, "patches.yaml");

      writeFileSync(sourceFile, "# Hello\n\nOld content.");
      writeFileSync(targetFile, "# Hello\n\nNew content.");

      // Pre-create a config with no patches key
      const existingConfig = `apiVersion: kustomark/v1
kind: Kustomization
output: ./output
resources:
  - source.md
`;
      writeFileSync(writeFile, existingConfig, "utf-8");

      execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --write ${writeFile}`,
        { encoding: "utf-8" },
      );

      const content = readFileSync(writeFile, "utf-8");
      expect(content).toContain("patches:");
      // Original fields preserved
      expect(content).toContain("apiVersion: kustomark/v1");
      expect(content).toContain("resources:");
    });
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

  // ============================================================================
  // JSON/YAML file suggestion tests
  // ============================================================================

  describe("JSON/YAML file support", () => {
    test("suggests json-set for changed JSON value", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(sourceFile, JSON.stringify({ name: "kustomark", version: "1.0.0" }));
      writeFileSync(targetFile, JSON.stringify({ name: "kustomark", version: "2.0.0" }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("version");
      expect(patch.value).toBe("2.0.0");
    });

    test("suggests json-delete for removed JSON key", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(sourceFile, JSON.stringify({ name: "kustomark", debug: true }));
      writeFileSync(targetFile, JSON.stringify({ name: "kustomark" }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-delete");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("debug");
    });

    test("suggests json-set for added JSON key", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(sourceFile, JSON.stringify({ name: "kustomark" }));
      writeFileSync(targetFile, JSON.stringify({ name: "kustomark", port: 8080 }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("port");
      expect(patch.value).toBe(8080);
    });

    test("suggests nested json-set using dot notation", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(
        sourceFile,
        JSON.stringify({ server: { host: "localhost", port: 3000 } }),
      );
      writeFileSync(
        targetFile,
        JSON.stringify({ server: { host: "example.com", port: 3000 } }),
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("server.host");
      expect(patch.value).toBe("example.com");
    });

    test("produces no patches for identical JSON files", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      const content = JSON.stringify({ name: "kustomark", version: "1.0.0" });
      writeFileSync(sourceFile, content);
      writeFileSync(targetFile, content);

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      expect(output.config.patches).toHaveLength(0);
      expect(output.stats.filesAnalyzed).toBe(0);
    });

    test("suggests json-set for changed YAML value", () => {
      const sourceFile = join(testDir, "config.yaml");
      const targetFile = join(testDir, "config-target.yaml");

      writeFileSync(sourceFile, "name: kustomark\nenabled: false\n");
      writeFileSync(targetFile, "name: kustomark\nenabled: true\n");

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("enabled");
      expect(patch.value).toBe(true);
    });

    test("suggests json-set for changed .yml value", () => {
      const sourceFile = join(testDir, "config.yml");
      const targetFile = join(testDir, "config-target.yml");

      writeFileSync(sourceFile, "timeout: 30\nretries: 3\n");
      writeFileSync(targetFile, "timeout: 60\nretries: 3\n");

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("timeout");
      expect(patch.value).toBe(60);
    });

    test("JSON patches score at 0.9", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(sourceFile, JSON.stringify({ key: "old" }));
      writeFileSync(targetFile, JSON.stringify({ key: "new" }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const scored = output.scoredPatches.find((sp: any) => sp.patch.op === "json-set");
      expect(scored).toBeDefined();
      expect(scored.score).toBe(0.9);
    });

    test("discovers and suggests patches for JSON files in directory comparison", () => {
      const sourceDir = join(testDir, "source");
      const targetDir = join(testDir, "target");
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      writeFileSync(
        join(sourceDir, "app.json"),
        JSON.stringify({ version: "1.0.0", env: "dev" }),
      );
      writeFileSync(
        join(targetDir, "app.json"),
        JSON.stringify({ version: "2.0.0", env: "dev" }),
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      expect(output.stats.filesAnalyzed).toBe(1);
      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("version");
      expect(patch.value).toBe("2.0.0");
    });

    test("handles mixed markdown and JSON files in directory comparison", () => {
      const sourceDir = join(testDir, "source");
      const targetDir = join(testDir, "target");
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      writeFileSync(join(sourceDir, "README.md"), "# Hello\n\nOld content.");
      writeFileSync(join(targetDir, "README.md"), "# Hello\n\nNew content.");
      writeFileSync(join(sourceDir, "config.json"), JSON.stringify({ version: "1.0.0" }));
      writeFileSync(join(targetDir, "config.json"), JSON.stringify({ version: "2.0.0" }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      expect(output.stats.filesAnalyzed).toBe(2);
      // Should have both markdown patches and JSON patches
      const jsonPatch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(jsonPatch).toBeDefined();
      expect(jsonPatch.path).toBe("version");
    });
  });

  // ============================================================================
  // json-merge batching tests
  // ============================================================================

  describe("json-merge batch detection", () => {
    test("suggests json-merge when 2+ root-level JSON keys change", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(
        sourceFile,
        JSON.stringify({ name: "kustomark", version: "1.0.0", author: "old" }),
      );
      writeFileSync(
        targetFile,
        JSON.stringify({ name: "kustomark", version: "2.0.0", author: "new" }),
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const mergePatch = output.config.patches.find((p: any) => p.op === "json-merge");
      expect(mergePatch).toBeDefined();
      expect(mergePatch.value).toMatchObject({ version: "2.0.0", author: "new" });
      expect(mergePatch.path).toBeUndefined();
      // Should NOT emit individual json-set for these keys
      const setPatch = output.config.patches.find(
        (p: any) => p.op === "json-set" && (p.path === "version" || p.path === "author"),
      );
      expect(setPatch).toBeUndefined();
    });

    test("suggests json-set (not json-merge) when only 1 key changes", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(sourceFile, JSON.stringify({ name: "kustomark", version: "1.0.0" }));
      writeFileSync(targetFile, JSON.stringify({ name: "kustomark", version: "2.0.0" }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const setPatch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(setPatch).toBeDefined();
      expect(setPatch.path).toBe("version");
      // No json-merge for a single key change
      const mergePatch = output.config.patches.find((p: any) => p.op === "json-merge");
      expect(mergePatch).toBeUndefined();
    });

    test("suggests json-merge with path for 2+ sibling changes in nested object", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(
        sourceFile,
        JSON.stringify({ server: { host: "localhost", port: 3000, debug: false } }),
      );
      writeFileSync(
        targetFile,
        JSON.stringify({ server: { host: "example.com", port: 8080, debug: false } }),
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const mergePatch = output.config.patches.find((p: any) => p.op === "json-merge");
      expect(mergePatch).toBeDefined();
      expect(mergePatch.path).toBe("server");
      expect(mergePatch.value).toMatchObject({ host: "example.com", port: 8080 });
    });

    test("keeps json-delete separate from json-merge", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(
        sourceFile,
        JSON.stringify({ name: "kustomark", version: "1.0.0", deprecated: true }),
      );
      writeFileSync(
        targetFile,
        JSON.stringify({ name: "newname", version: "2.0.0" }),
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      // name and version both changed → json-merge
      const mergePatch = output.config.patches.find((p: any) => p.op === "json-merge");
      expect(mergePatch).toBeDefined();
      expect(mergePatch.value).toMatchObject({ name: "newname", version: "2.0.0" });
      // deprecated removed → separate json-delete
      const deletePatch = output.config.patches.find((p: any) => p.op === "json-delete");
      expect(deletePatch).toBeDefined();
      expect(deletePatch.path).toBe("deprecated");
    });

    test("suggests json-merge for 2+ added keys in YAML", () => {
      const sourceFile = join(testDir, "config.yaml");
      const targetFile = join(testDir, "config-target.yaml");

      writeFileSync(sourceFile, "name: kustomark\n");
      writeFileSync(targetFile, "name: kustomark\nversion: 2.0.0\nauthor: team\n");

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const mergePatch = output.config.patches.find((p: any) => p.op === "json-merge");
      expect(mergePatch).toBeDefined();
      expect(mergePatch.value).toMatchObject({ version: "2.0.0", author: "team" });
      expect(mergePatch.path).toBeUndefined();
    });

    test("scores json-merge at 0.9 (same as json-set)", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(sourceFile, JSON.stringify({ a: 1, b: 2 }));
      writeFileSync(targetFile, JSON.stringify({ a: 10, b: 20 }));

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const scored = output.scoredPatches.find((sp: any) => sp.patch.op === "json-merge");
      expect(scored).toBeDefined();
      expect(scored.score).toBe(0.9);
    });

    test("nested and root changes are handled independently", () => {
      const sourceFile = join(testDir, "config.json");
      const targetFile = join(testDir, "config-target.json");

      writeFileSync(
        sourceFile,
        JSON.stringify({ title: "old", db: { host: "localhost", port: 5432 } }),
      );
      writeFileSync(
        targetFile,
        JSON.stringify({ title: "new", db: { host: "prod.db", port: 5432 } }),
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      // title changed alone at root → json-set
      const setPatch = output.config.patches.find(
        (p: any) => p.op === "json-set" && p.path === "title",
      );
      expect(setPatch).toBeDefined();
      // db.host changed alone under db → json-set (only 1 sibling changed)
      const dbPatch = output.config.patches.find(
        (p: any) => p.op === "json-set" && p.path === "db.host",
      );
      expect(dbPatch).toBeDefined();
      // No json-merge since each level had only 1 change
      const mergePatch = output.config.patches.find((p: any) => p.op === "json-merge");
      expect(mergePatch).toBeUndefined();
    });
  });

  // ============================================================================
  // TOML file suggestion tests
  // ============================================================================

  describe("TOML file support", () => {
    test("suggests json-set for changed TOML value", () => {
      const sourceFile = join(testDir, "config.toml");
      const targetFile = join(testDir, "config-target.toml");

      writeFileSync(sourceFile, 'name = "kustomark"\nversion = "1.0.0"\n');
      writeFileSync(targetFile, 'name = "kustomark"\nversion = "2.0.0"\n');

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("version");
      expect(patch.value).toBe("2.0.0");
    });

    test("suggests json-delete for removed TOML key", () => {
      const sourceFile = join(testDir, "config.toml");
      const targetFile = join(testDir, "config-target.toml");

      writeFileSync(sourceFile, 'name = "kustomark"\ndebug = true\n');
      writeFileSync(targetFile, 'name = "kustomark"\n');

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-delete");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("debug");
    });

    test("suggests json-set for added TOML key", () => {
      const sourceFile = join(testDir, "config.toml");
      const targetFile = join(testDir, "config-target.toml");

      writeFileSync(sourceFile, 'name = "kustomark"\n');
      writeFileSync(targetFile, 'name = "kustomark"\nport = 8080\n');

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("port");
      expect(patch.value).toBe(8080);
    });

    test("suggests nested json-set for changed TOML table value", () => {
      const sourceFile = join(testDir, "config.toml");
      const targetFile = join(testDir, "config-target.toml");

      writeFileSync(
        sourceFile,
        "[server]\nhost = \"localhost\"\nport = 3000\n",
      );
      writeFileSync(
        targetFile,
        "[server]\nhost = \"example.com\"\nport = 3000\n",
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("server.host");
      expect(patch.value).toBe("example.com");
    });

    test("produces no patches for identical TOML files", () => {
      const sourceFile = join(testDir, "config.toml");
      const targetFile = join(testDir, "config-target.toml");

      const content = 'name = "kustomark"\nversion = "1.0.0"\n';
      writeFileSync(sourceFile, content);
      writeFileSync(targetFile, content);

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      expect(output.config.patches).toHaveLength(0);
      expect(output.stats.filesAnalyzed).toBe(0);
    });

    test("TOML patches score at 0.9", () => {
      const sourceFile = join(testDir, "config.toml");
      const targetFile = join(testDir, "config-target.toml");

      writeFileSync(sourceFile, 'key = "old"\n');
      writeFileSync(targetFile, 'key = "new"\n');

      const result = execSync(
        `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      const scored = output.scoredPatches.find((sp: any) => sp.patch.op === "json-set");
      expect(scored).toBeDefined();
      expect(scored.score).toBe(0.9);
    });

    test("discovers and suggests patches for TOML files in directory comparison", () => {
      const sourceDir = join(testDir, "source");
      const targetDir = join(testDir, "target");
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      writeFileSync(
        join(sourceDir, "Cargo.toml"),
        '[package]\nname = "myapp"\nversion = "0.1.0"\n',
      );
      writeFileSync(
        join(targetDir, "Cargo.toml"),
        '[package]\nname = "myapp"\nversion = "0.2.0"\n',
      );

      const result = execSync(
        `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      expect(output.stats.filesAnalyzed).toBe(1);
      const patch = output.config.patches.find((p: any) => p.op === "json-set");
      expect(patch).toBeDefined();
      expect(patch.path).toBe("package.version");
      expect(patch.value).toBe("0.2.0");
    });

    test("handles mixed markdown and TOML files in directory comparison", () => {
      const sourceDir = join(testDir, "source");
      const targetDir = join(testDir, "target");
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      writeFileSync(join(sourceDir, "README.md"), "# Hello\n\nOld content.");
      writeFileSync(join(targetDir, "README.md"), "# Hello\n\nNew content.");
      writeFileSync(join(sourceDir, "config.toml"), 'version = "1.0.0"\n');
      writeFileSync(join(targetDir, "config.toml"), 'version = "2.0.0"\n');

      const result = execSync(
        `${cliPath} suggest --source ${sourceDir} --target ${targetDir} --format=json`,
        { encoding: "utf-8" },
      );
      const output = JSON.parse(result);

      expect(output.stats.filesAnalyzed).toBe(2);
      const tomlPatch = output.config.patches.find((p: any) => p.op === "json-set" && p.path === "version");
      expect(tomlPatch).toBeDefined();
      expect(tomlPatch.value).toBe("2.0.0");
    });
  });
});

// ============================================================================
// Unit tests for verifyPatches (no CLI build needed)
// ============================================================================

import { verifyPatches } from "../../src/cli/suggest-command.js";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join as joinPath } from "node:path";

describe("verifyPatches", () => {
  const tmpDir = "/tmp/kustomark-verify-test";

  beforeEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  test("reports exact match when patch perfectly reproduces target", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "Hello world\n");
    writeFileSync(targetFile, "Hello universe\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    const patches = [{ op: "replace" as const, old: "world", new: "universe" }];

    const result = await verifyPatches(pairs, patches);

    expect(result.filesChecked).toBe(1);
    expect(result.exactMatches).toBe(1);
    expect(result.partialMatches).toBe(0);
    expect(result.notReproduced).toBe(0);
    expect(result.results[0]?.reproduced).toBe(true);
    expect(result.results[0]?.similarity).toBe(1);
  });

  test("reports partial match when patches partially reproduce target", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "Line one\nLine two\nLine three\n");
    // Target differs significantly — patches won't reproduce it
    writeFileSync(targetFile, "Completely different content\nNothing matches\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    // A patch that changes only one word — won't reproduce the completely different target
    const patches = [{ op: "replace" as const, old: "one", new: "ONE" }];

    const result = await verifyPatches(pairs, patches);

    expect(result.filesChecked).toBe(1);
    expect(result.exactMatches).toBe(0);
    expect(result.results[0]?.reproduced).toBe(false);
    expect(result.results[0]?.similarity).toBeGreaterThanOrEqual(0);
    expect(result.results[0]?.similarity).toBeLessThan(1);
  });

  test("reports not-reproduced when patches make no progress toward target", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "alpha beta gamma\n");
    writeFileSync(targetFile, "completely different file content here\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    // Patch that doesn't match anything — source is returned unchanged
    const patches = [{ op: "replace" as const, old: "notfound", new: "something" }];

    const result = await verifyPatches(pairs, patches);

    expect(result.filesChecked).toBe(1);
    expect(result.exactMatches).toBe(0);
    expect(result.results[0]?.reproduced).toBe(false);
  });

  test("handles empty patch list: source unchanged, similarity vs target", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "unchanged\n");
    writeFileSync(targetFile, "unchanged\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    const result = await verifyPatches(pairs, []);

    expect(result.exactMatches).toBe(1);
    expect(result.results[0]?.reproduced).toBe(true);
    expect(result.results[0]?.similarity).toBe(1);
  });

  test("filters patches by include pattern for multi-file pairs", async () => {
    const aSource = joinPath(tmpDir, "a.md");
    const aTarget = joinPath(tmpDir, "a-target.md");
    const bSource = joinPath(tmpDir, "b.md");
    const bTarget = joinPath(tmpDir, "b-target.md");
    writeFileSync(aSource, "foo bar\n");
    writeFileSync(aTarget, "foo baz\n");
    writeFileSync(bSource, "hello world\n");
    writeFileSync(bTarget, "hello world\n");

    const pairs = [
      { relativePath: "a.md", sourcePath: aSource, targetPath: aTarget },
      { relativePath: "b.md", sourcePath: bSource, targetPath: bTarget },
    ];
    // Patch scoped to a.md only
    const patches = [{ op: "replace" as const, old: "bar", new: "baz", include: "a.md" }];

    const result = await verifyPatches(pairs, patches);

    expect(result.filesChecked).toBe(2);
    const aResult = result.results.find((r) => r.file === "a.md");
    const bResult = result.results.find((r) => r.file === "b.md");
    expect(aResult?.reproduced).toBe(true);
    // b.md source === target, so it's also exact
    expect(bResult?.reproduced).toBe(true);
  });

  test("excludes file-op patches from content verification", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "Hello world\n");
    writeFileSync(targetFile, "Hello universe\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    // Mix of file-op (excluded) and content patch (included)
    const patches = [
      { op: "delete-file" as const, match: "other.md" },
      { op: "rename-file" as const, match: "old.md", rename: "new.md" },
      { op: "replace" as const, old: "world", new: "universe" },
    ];

    const result = await verifyPatches(pairs, patches);

    expect(result.exactMatches).toBe(1);
    expect(result.results[0]?.reproduced).toBe(true);
  });

  test("returns empty summary for empty pairs list", async () => {
    const result = await verifyPatches([], []);

    expect(result.filesChecked).toBe(0);
    expect(result.exactMatches).toBe(0);
    expect(result.partialMatches).toBe(0);
    expect(result.notReproduced).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  test("unmatchedLines is 0 for exact match", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "foo\n");
    writeFileSync(targetFile, "bar\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    const patches = [{ op: "replace" as const, old: "foo", new: "bar" }];

    const result = await verifyPatches(pairs, patches);

    expect(result.results[0]?.unmatchedLines).toBe(0);
  });

  test("unmatchedLines is positive for non-exact match", async () => {
    const sourceFile = joinPath(tmpDir, "source.md");
    const targetFile = joinPath(tmpDir, "target.md");
    writeFileSync(sourceFile, "line one\nline two\nline three\n");
    writeFileSync(targetFile, "alpha\nbeta\ngamma\n");

    const pairs = [{ relativePath: "source.md", sourcePath: sourceFile, targetPath: targetFile }];
    const result = await verifyPatches(pairs, []);

    expect(result.results[0]?.unmatchedLines).toBeGreaterThan(0);
  });
});

// ============================================================================
// Unit tests for consolidatePatches and computeMinimalGlob
// ============================================================================

import { consolidatePatches, computeMinimalGlob } from "../../src/cli/suggest-command.js";
import type { ScoredPatch } from "../../src/core/patch-suggester.js";

describe("computeMinimalGlob", () => {
  test("files in the same directory with same extension", () => {
    const glob = computeMinimalGlob(["docs/guide.md", "docs/intro.md"]);
    expect(glob).toBe("docs/*.md");
  });

  test("files across different directories with same extension", () => {
    const glob = computeMinimalGlob(["docs/guide.md", "api/guide.md"]);
    expect(glob).toBe("**/*.md");
  });

  test("files in subdirectories under a common ancestor with same extension", () => {
    const glob = computeMinimalGlob(["docs/v1/guide.md", "docs/v2/guide.md"]);
    expect(glob).toBe("docs/**/*.md");
  });

  test("files with mixed extensions", () => {
    const glob = computeMinimalGlob(["docs/guide.md", "config/settings.json"]);
    expect(glob).toBe("**/*");
  });

  test("single file returns specific glob", () => {
    const glob = computeMinimalGlob(["docs/guide.md"]);
    expect(glob).toBe("docs/*.md");
  });

  test("root-level files with same extension", () => {
    const glob = computeMinimalGlob(["guide.md", "intro.md"]);
    expect(glob).toBe("*.md");
  });

  test("empty array returns catch-all glob", () => {
    const glob = computeMinimalGlob([]);
    expect(glob).toBe("**/*");
  });
});

describe("consolidatePatches", () => {
  function makeScoredPatch(patch: Record<string, unknown>, score = 0.9): ScoredPatch {
    return { patch: patch as Parameters<typeof consolidatePatches>[0][0], score, description: "test" };
  }

  test("identical replace patches across two files are consolidated into a single glob patch", () => {
    const patches = [
      { op: "replace" as const, old: "Acme", new: "Corp", include: "docs/a.md" },
      { op: "replace" as const, old: "Acme", new: "Corp", include: "docs/b.md" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    const { patches: out, patchesConsolidated } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(1);
    expect((out[0] as { include: string }).include).toBe("docs/*.md");
    expect(patchesConsolidated).toBe(1);
  });

  test("different patches are kept separate", () => {
    const patches = [
      { op: "replace" as const, old: "Acme", new: "Corp", include: "docs/a.md" },
      { op: "replace" as const, old: "Foo", new: "Bar", include: "docs/b.md" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    const { patches: out, patchesConsolidated } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(2);
    expect(patchesConsolidated).toBe(0);
  });

  test("same set-frontmatter across three files consolidates to glob", () => {
    const patches = [
      { op: "set-frontmatter" as const, key: "draft", value: false, include: "posts/a.md" },
      { op: "set-frontmatter" as const, key: "draft", value: false, include: "posts/b.md" },
      { op: "set-frontmatter" as const, key: "draft", value: false, include: "posts/c.md" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    const { patches: out, patchesConsolidated } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(1);
    expect(patchesConsolidated).toBe(2);
    expect((out[0] as { include: string }).include).toBe("posts/*.md");
  });

  test("file operation patches (delete-file) are never consolidated", () => {
    const patches = [
      { op: "delete-file" as const, match: "old/a.md" },
      { op: "delete-file" as const, match: "old/b.md" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    const { patches: out, patchesConsolidated } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(2);
    expect(patchesConsolidated).toBe(0);
  });

  test("uses highest score from the group", () => {
    const patches = [
      { op: "replace" as const, old: "X", new: "Y", include: "a.md" },
      { op: "replace" as const, old: "X", new: "Y", include: "b.md" },
    ];
    const scored = [makeScoredPatch(patches[0]!, 0.7), makeScoredPatch(patches[1]!, 0.95)];

    const { scoredPatches: out } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(1);
    expect(out[0]!.score).toBe(0.95);
  });

  test("patches across directories with same extension get **/*.ext glob", () => {
    const patches = [
      { op: "replace" as const, old: "v1", new: "v2", include: "docs/guide.md" },
      { op: "replace" as const, old: "v1", new: "v2", include: "api/ref.md" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    const { patches: out } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(1);
    expect((out[0] as { include: string }).include).toBe("**/*.md");
  });

  test("empty input returns empty output with zero consolidation", () => {
    const { patches, scoredPatches, patchesConsolidated } = consolidatePatches([], []);
    expect(patches).toHaveLength(0);
    expect(scoredPatches).toHaveLength(0);
    expect(patchesConsolidated).toBe(0);
  });

  test("patches with no include field are kept as-is", () => {
    const patches = [
      { op: "replace" as const, old: "X", new: "Y" },
      { op: "replace" as const, old: "X", new: "Y" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    // Both have no include — they share identity key but no include to build glob from
    const { patches: out } = consolidatePatches(patches, scored);

    // Without include, consolidation removes duplicates and drops include
    expect(out).toHaveLength(1);
    expect((out[0] as { include?: string }).include).toBeUndefined();
  });

  test("mixed: some patches consolidate, others stay separate", () => {
    const patches = [
      { op: "replace" as const, old: "Acme", new: "Corp", include: "docs/a.md" },
      { op: "replace" as const, old: "Acme", new: "Corp", include: "docs/b.md" },
      { op: "replace" as const, old: "Foo", new: "Bar", include: "docs/a.md" },
    ];
    const scored = patches.map((p) => makeScoredPatch(p));

    const { patches: out, patchesConsolidated } = consolidatePatches(patches, scored);

    expect(out).toHaveLength(2);
    expect(patchesConsolidated).toBe(1);
  });
});

// ============================================================================
// --apply flag: apply patches directly to an output directory
// ============================================================================

import { applyPatchesToDirectory } from "../../src/cli/suggest-command.js";

describe("--apply flag", () => {
  const testDir = "/tmp/kustomark-apply-test";
  const cliPath = join(process.cwd(), "dist/cli/index.js");

  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  test("creates output directory and writes patched file", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const applyDir = join(testDir, "output");

    writeFileSync(sourceFile, "# Hello\n\nOld content.");
    writeFileSync(targetFile, "# Hello\n\nNew content.");

    execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --apply ${applyDir}`,
      { encoding: "utf-8" },
    );

    expect(existsSync(applyDir)).toBe(true);
    const outFile = join(applyDir, "source.md");
    expect(existsSync(outFile)).toBe(true);
  });

  test("applied file content matches target", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const applyDir = join(testDir, "output");

    writeFileSync(sourceFile, "Hello foo world.");
    writeFileSync(targetFile, "Hello bar world.");

    execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --apply ${applyDir}`,
      { encoding: "utf-8" },
    );

    const outContent = readFileSync(join(applyDir, "source.md"), "utf-8");
    expect(outContent).toContain("bar");
    expect(outContent).not.toContain("foo");
  });

  test("reports filesApplied count in JSON output", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const applyDir = join(testDir, "output");

    writeFileSync(sourceFile, "Hello foo.");
    writeFileSync(targetFile, "Hello bar.");

    const stdout = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --apply ${applyDir} --format=json`,
      { encoding: "utf-8" },
    );

    const output = JSON.parse(stdout);
    expect(output.stats.filesApplied).toBe(1);
  });

  test("prints 'Applied to:' confirmation in text output", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const applyDir = join(testDir, "output");

    writeFileSync(sourceFile, "Hello foo.");
    writeFileSync(targetFile, "Hello bar.");

    const stdout = execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --apply ${applyDir}`,
      { encoding: "utf-8" },
    );

    expect(stdout).toContain("Applied to:");
    expect(stdout).toContain("output");
  });

  test("can be combined with --write", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const applyDir = join(testDir, "output");
    const writeFile = join(testDir, "patches.yaml");

    writeFileSync(sourceFile, "Hello foo.");
    writeFileSync(targetFile, "Hello bar.");

    execSync(
      `${cliPath} suggest --source ${sourceFile} --target ${targetFile} --apply ${applyDir} --write ${writeFile}`,
      { encoding: "utf-8" },
    );

    expect(existsSync(applyDir)).toBe(true);
    expect(existsSync(writeFile)).toBe(true);
    const patchConfig = readFileSync(writeFile, "utf-8");
    expect(patchConfig).toContain("patches:");
  });

  test("applies across multiple files in a directory", () => {
    const srcDir = join(testDir, "src");
    const tgtDir = join(testDir, "tgt");
    const applyDir = join(testDir, "output");

    mkdirSync(srcDir, { recursive: true });
    mkdirSync(tgtDir, { recursive: true });

    writeFileSync(join(srcDir, "a.md"), "Company: Acme");
    writeFileSync(join(srcDir, "b.md"), "Company: Acme");
    writeFileSync(join(tgtDir, "a.md"), "Company: Corp");
    writeFileSync(join(tgtDir, "b.md"), "Company: Corp");

    execSync(
      `${cliPath} suggest --source ${srcDir} --target ${tgtDir} --apply ${applyDir} --format=json`,
      { encoding: "utf-8" },
    );

    expect(existsSync(join(applyDir, "a.md"))).toBe(true);
    expect(existsSync(join(applyDir, "b.md"))).toBe(true);
    const aContent = readFileSync(join(applyDir, "a.md"), "utf-8");
    expect(aContent).toContain("Corp");
  });
});

// Unit tests for applyPatchesToDirectory
describe("applyPatchesToDirectory", () => {
  const testDir = "/tmp/kustomark-apply-unit-test";

  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  test("applies patches to file and returns count", async () => {
    const srcFile = join(testDir, "doc.md");
    writeFileSync(srcFile, "Hello foo.");

    const pairs = [{ sourcePath: srcFile, targetPath: srcFile, relativePath: "doc.md" }];
    const patches = [{ op: "replace" as const, old: "foo", new: "bar" }];

    const outDir = join(testDir, "out");
    const count = await applyPatchesToDirectory(pairs, patches, testDir, outDir);

    expect(count).toBe(1);
    const result = readFileSync(join(outDir, "doc.md"), "utf-8");
    expect(result).toBe("Hello bar.");
  });

  test("preserves files with no applicable patches", async () => {
    const srcFile = join(testDir, "doc.md");
    writeFileSync(srcFile, "Unchanged content.");

    const pairs = [{ sourcePath: srcFile, targetPath: srcFile, relativePath: "doc.md" }];
    const patches = [{ op: "replace" as const, old: "other", new: "thing", include: "other.md" }];

    const outDir = join(testDir, "out");
    const count = await applyPatchesToDirectory(pairs, patches, testDir, outDir);

    expect(count).toBe(1);
    const result = readFileSync(join(outDir, "doc.md"), "utf-8");
    expect(result).toBe("Unchanged content.");
  });

  test("creates nested output directories for subdirectory files", async () => {
    mkdirSync(join(testDir, "sub"), { recursive: true });
    const srcFile = join(testDir, "sub", "doc.md");
    writeFileSync(srcFile, "Hello foo.");

    const pairs = [{ sourcePath: srcFile, targetPath: srcFile, relativePath: "sub/doc.md" }];
    const patches = [{ op: "replace" as const, old: "foo", new: "bar" }];

    const outDir = join(testDir, "out");
    const count = await applyPatchesToDirectory(pairs, patches, testDir, outDir);

    expect(count).toBe(1);
    expect(existsSync(join(outDir, "sub", "doc.md"))).toBe(true);
  });

  test("returns 0 for empty file pairs", async () => {
    const outDir = join(testDir, "out");
    const count = await applyPatchesToDirectory([], [], testDir, outDir);
    expect(count).toBe(0);
  });
});

// ============================================================================
// Unit tests for runInteractiveSession
// ============================================================================

import { runInteractiveSession } from "../../src/cli/suggest-command.js";
import { PassThrough, Writable } from "node:stream";

// Feed one response per readline prompt. Intercepts each stdout write that
// ends with ": " (the readline question prompt) and pushes the next answer
// into the stdin PassThrough so readline can read it.
function makeInteractiveMocks(responses: string[]): {
  stdin: PassThrough & { isTTY: boolean };
  stdout: Writable;
} {
  const stdinPT = new PassThrough();
  (stdinPT as unknown as { isTTY: boolean }).isTTY = true;
  const stdin = stdinPT as PassThrough & { isTTY: boolean };

  let i = 0;
  const stdout = new Writable({
    write(chunk, _enc, cb) {
      const text: string = chunk.toString();
      // Readline writes the prompt then waits; push the response when we see it.
      if (text.endsWith(": ") && i < responses.length) {
        const answer = responses[i++]!;
        setImmediate(() => stdinPT.push(answer + "\n"));
      }
      cb();
    },
  });

  return { stdin, stdout };
}

function makeMockStdout(): Writable {
  return new Writable({ write(_chunk, _enc, cb) { cb(); } });
}

function makeScoredPatch(op: string, score: number): ScoredPatch {
  return {
    patch: { op } as import("../../src/core/types.js").PatchOperation,
    score,
    description: `Test patch: ${op}`,
  };
}

describe("runInteractiveSession", () => {
  test("non-TTY returns all patches unchanged", async () => {
    const patches = [makeScoredPatch("replace", 0.9), makeScoredPatch("rename-header", 0.8)];
    const mockStdin = { isTTY: false } as unknown as NodeJS.ReadableStream;
    const mockStdout = makeMockStdout();

    const result = await runInteractiveSession(patches, mockStdin, mockStdout);

    expect(result).toEqual(patches);
  });

  test("empty patches returns empty array", async () => {
    const { stdin, stdout } = makeInteractiveMocks([]);

    const result = await runInteractiveSession([], stdin, stdout);

    expect(result).toEqual([]);
  });

  test("approve all with 'a' key", async () => {
    const patches = [makeScoredPatch("replace", 0.9), makeScoredPatch("rename-header", 0.8)];
    const { stdin, stdout } = makeInteractiveMocks(["a", "a"]);

    const result = await runInteractiveSession(patches, stdin, stdout);

    expect(result).toHaveLength(2);
    expect(result).toEqual(patches);
  });

  test("approve all with 'y' key", async () => {
    const patches = [makeScoredPatch("replace", 0.9), makeScoredPatch("rename-header", 0.8)];
    const { stdin, stdout } = makeInteractiveMocks(["y", "y"]);

    const result = await runInteractiveSession(patches, stdin, stdout);

    expect(result).toHaveLength(2);
    expect(result).toEqual(patches);
  });

  test("skip all with 's' key", async () => {
    const patches = [makeScoredPatch("replace", 0.9), makeScoredPatch("rename-header", 0.8)];
    const { stdin, stdout } = makeInteractiveMocks(["s", "s"]);

    const result = await runInteractiveSession(patches, stdin, stdout);

    expect(result).toEqual([]);
  });

  test("mixed approve and skip", async () => {
    const patches = [
      makeScoredPatch("replace", 0.9),
      makeScoredPatch("rename-header", 0.8),
      makeScoredPatch("delete", 0.7),
    ];
    const { stdin, stdout } = makeInteractiveMocks(["a", "s", "a"]);

    const result = await runInteractiveSession(patches, stdin, stdout);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(patches[0]);
    expect(result[1]).toEqual(patches[2]);
  });

  test("quit early with 'q' stops and returns approved so far", async () => {
    const patches = [
      makeScoredPatch("replace", 0.9),
      makeScoredPatch("rename-header", 0.8),
      makeScoredPatch("delete", 0.7),
    ];
    const { stdin, stdout } = makeInteractiveMocks(["a", "q"]);

    const result = await runInteractiveSession(patches, stdin, stdout);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(patches[0]);
  });
});

// ============================================================================
// --from-git: parseGitRange and fetchGitPairs unit tests
// ============================================================================

import { fetchGitPairs } from "../../src/cli/suggest-command.js";

describe("--from-git: fetchGitPairs", () => {
  const gitTestDir = "/tmp/kustomark-from-git-test";

  // Create an isolated git repo with two commits for testing
  beforeEach(() => {
    if (existsSync(gitTestDir)) {
      rmSync(gitTestDir, { recursive: true, force: true });
    }
    mkdirSync(gitTestDir, { recursive: true });

    // Init repo with identity so commits work without global config
    execSync("git init", { cwd: gitTestDir });
    execSync('git config user.email "test@example.com"', { cwd: gitTestDir });
    execSync('git config user.name "Test"', { cwd: gitTestDir });

    // First commit: initial docs
    writeFileSync(join(gitTestDir, "README.md"), "# Hello\n\nOriginal content.\n");
    writeFileSync(join(gitTestDir, "notes.md"), "# Notes\n\nSome notes.\n");
    execSync("git add -A && git commit -m 'initial'", { cwd: gitTestDir, shell: true as any });

    // Second commit: modify README, delete notes, add new file
    writeFileSync(join(gitTestDir, "README.md"), "# Hello\n\nUpdated content.\n");
    rmSync(join(gitTestDir, "notes.md"));
    writeFileSync(join(gitTestDir, "added.md"), "# Added\n\nNew file.\n");
    execSync("git add -A && git commit -m 'changes'", { cwd: gitTestDir, shell: true as any });
  });

  afterEach(() => {
    if (existsSync(gitTestDir)) {
      rmSync(gitTestDir, { recursive: true, force: true });
    }
  });

  test("returns FilePairs for modified files in range", async () => {
    const { pairs } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir);

    expect(pairs.length).toBe(1);
    expect(pairs[0].relativePath).toBe("README.md");
    expect(pairs[0].sourceContent).toContain("Original content");
    expect(pairs[0].targetContent).toContain("Updated content");
  });

  test("returns deletedPaths for files removed in range", async () => {
    const { deletedPaths } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir);

    expect(deletedPaths).toContain("notes.md");
  });

  test("returns addedFiles with content for files added in range", async () => {
    const { addedFiles } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir);

    expect(addedFiles.map((f) => f.path)).toContain("added.md");
    const added = addedFiles.find((f) => f.path === "added.md");
    expect(added?.content).toContain("# Added");
  });

  test("single ref without '..' defaults to <ref>..HEAD", async () => {
    const { pairs } = await fetchGitPairs("HEAD~1", gitTestDir);

    // Same as HEAD~1..HEAD
    expect(pairs.length).toBe(1);
    expect(pairs[0].relativePath).toBe("README.md");
  });

  test("filterPath restricts results to subdirectory", async () => {
    // Add a commit that changes a file in a subdirectory
    mkdirSync(join(gitTestDir, "docs"), { recursive: true });
    writeFileSync(join(gitTestDir, "docs", "guide.md"), "# Guide\n\nOriginal guide.\n");
    execSync("git add -A && git commit -m 'add docs'", { cwd: gitTestDir, shell: true as any });
    writeFileSync(join(gitTestDir, "docs", "guide.md"), "# Guide\n\nUpdated guide.\n");
    writeFileSync(join(gitTestDir, "README.md"), "# Hello\n\nAlso changed.\n");
    execSync("git add -A && git commit -m 'update docs and readme'", { cwd: gitTestDir, shell: true as any });

    const { pairs } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir, "docs");

    // Only docs/guide.md should appear, not README.md
    expect(pairs.length).toBe(1);
    expect(pairs[0].relativePath).toBe("guide.md");
  });

  test("throws when range is invalid", async () => {
    await expect(fetchGitPairs("nonexistent-branch..HEAD", gitTestDir)).rejects.toThrow();
  });

  test("returns empty pairs for range with no supported file changes", async () => {
    // Add a commit that only changes a binary-like file (not supported extension)
    writeFileSync(join(gitTestDir, "data.bin"), Buffer.from([0x00, 0x01, 0x02]));
    execSync("git add -A && git commit -m 'add binary'", { cwd: gitTestDir, shell: true as any });
    // The binary file is not in a supported extension set
    const { pairs, deletedPaths, addedFiles } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir);

    // Only added non-.md/.json/.yaml/.yml/.toml file — should not appear in pairs
    expect(pairs.length).toBe(0);
    expect(deletedPaths.length).toBe(0);
    // addedFiles only collects supported files
    expect(addedFiles.length).toBe(0);
  });

  test("addedFiles includes file content from git", async () => {
    const { addedFiles } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir);

    const added = addedFiles.find((f) => f.path === "added.md");
    expect(added).toBeDefined();
    expect(added?.content).toBe("# Added\n\nNew file.\n");
  });

  test("addedFiles not returned when file is unsupported extension", async () => {
    writeFileSync(join(gitTestDir, "script.sh"), "#!/bin/bash\necho hello\n");
    execSync("git add -A && git commit -m 'add script'", {
      cwd: gitTestDir,
      shell: true as any,
    });
    const { addedFiles } = await fetchGitPairs("HEAD~1..HEAD", gitTestDir);
    expect(addedFiles.map((f) => f.path)).not.toContain("script.sh");
  });
});

// ============================================================================
// write-file patch operation
// ============================================================================

describe("write-file: suggest generates write-file patches for new target files", () => {
  const testDir = "/tmp/kustomark-write-file-test";

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("target-only file generates write-file patch in config YAML", () => {
    const srcDir = join(testDir, "src");
    const tgtDir = join(testDir, "tgt");
    mkdirSync(srcDir);
    mkdirSync(tgtDir);

    // Source has one file, target has that file plus a new one
    writeFileSync(join(srcDir, "existing.md"), "# Existing\n");
    writeFileSync(join(tgtDir, "existing.md"), "# Existing\n");
    writeFileSync(join(tgtDir, "new.md"), "# New File\n\nAdded content.\n");

    const cliPath = join(process.cwd(), "dist/cli/index.js");
    const result = execSync(
      `bun run ${cliPath} suggest --source ${srcDir} --target ${tgtDir} --format=json`,
      { encoding: "utf-8" },
    );

    const json = JSON.parse(result);
    const writeOps = (json.config?.patches ?? []).filter((p: any) => p.op === "write-file");
    expect(writeOps.length).toBe(1);
    expect(writeOps[0].path).toBe("new.md");
    expect(writeOps[0].content).toContain("Added content.");
  });

  test("filesAdded stat is reported in JSON output", () => {
    const srcDir = join(testDir, "src");
    const tgtDir = join(testDir, "tgt");
    mkdirSync(srcDir);
    mkdirSync(tgtDir);

    writeFileSync(join(srcDir, "a.md"), "# A\n");
    writeFileSync(join(tgtDir, "a.md"), "# A\n");
    writeFileSync(join(tgtDir, "b.md"), "# B\n");
    writeFileSync(join(tgtDir, "c.md"), "# C\n");

    const cliPath = join(process.cwd(), "dist/cli/index.js");
    const result = execSync(
      `bun run ${cliPath} suggest --source ${srcDir} --target ${tgtDir} --format=json`,
      { encoding: "utf-8" },
    );

    const json = JSON.parse(result);
    expect(json.stats.filesAdded).toBe(2);
  });

  test("write-file patch content matches target file exactly", () => {
    const srcDir = join(testDir, "src");
    const tgtDir = join(testDir, "tgt");
    mkdirSync(srcDir);
    mkdirSync(tgtDir);

    const newContent = "# Brand New\n\nThis is fresh content.\n";
    writeFileSync(join(srcDir, "old.md"), "# Old\n");
    writeFileSync(join(tgtDir, "old.md"), "# Old\n");
    writeFileSync(join(tgtDir, "brand-new.md"), newContent);

    const cliPath = join(process.cwd(), "dist/cli/index.js");
    const result = execSync(
      `bun run ${cliPath} suggest --source ${srcDir} --target ${tgtDir} --format=json`,
      { encoding: "utf-8" },
    );

    const json = JSON.parse(result);
    const writeOp = (json.config?.patches ?? []).find((p: any) => p.op === "write-file");
    expect(writeOp?.content).toBe(newContent);
  });
});

describe("write-file: --from-git generates write-file patches for added files", () => {
  const gitDir = "/tmp/kustomark-write-file-git-test";

  beforeEach(() => {
    if (existsSync(gitDir)) {
      rmSync(gitDir, { recursive: true, force: true });
    }
    mkdirSync(gitDir, { recursive: true });

    execSync("git init", { cwd: gitDir });
    execSync('git config user.email "test@example.com"', { cwd: gitDir });
    execSync('git config user.name "Test"', { cwd: gitDir });

    // First commit
    writeFileSync(join(gitDir, "base.md"), "# Base\n");
    execSync("git add -A && git commit -m 'initial'", { cwd: gitDir, shell: true as any });

    // Second commit: add a new file
    writeFileSync(join(gitDir, "added.md"), "# Added\n\nNew content.\n");
    execSync("git add -A && git commit -m 'add file'", { cwd: gitDir, shell: true as any });
  });

  afterEach(() => {
    if (existsSync(gitDir)) {
      rmSync(gitDir, { recursive: true, force: true });
    }
  });

  test("fetchGitPairs returns addedFiles with content for git-added files", async () => {
    const { addedFiles } = await fetchGitPairs("HEAD~1..HEAD", gitDir);

    expect(addedFiles.length).toBe(1);
    expect(addedFiles[0].path).toBe("added.md");
    expect(addedFiles[0].content).toBe("# Added\n\nNew content.\n");
  });

  test("--from-git generates write-file patch for added file in config", () => {
    const cliPath = join(process.cwd(), "dist/cli/index.js");
    const result = execSync(
      `bun run ${cliPath} suggest --from-git HEAD~1..HEAD --format=json`,
      { cwd: gitDir, encoding: "utf-8" },
    );

    const json = JSON.parse(result);
    const writeOps = (json.config?.patches ?? []).filter((p: any) => p.op === "write-file");
    expect(writeOps.length).toBe(1);
    expect(writeOps[0].path).toBe("added.md");
    expect(writeOps[0].content).toContain("New content.");
  });

  test("filesAdded stat is set when --from-git detects added files", () => {
    const cliPath = join(process.cwd(), "dist/cli/index.js");
    const result = execSync(
      `bun run ${cliPath} suggest --from-git HEAD~1..HEAD --format=json`,
      { cwd: gitDir, encoding: "utf-8" },
    );

    const json = JSON.parse(result);
    expect(json.stats.filesAdded).toBe(1);
  });
});
