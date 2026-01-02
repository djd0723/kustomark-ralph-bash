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

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBeGreaterThan(0);

    // Should suggest a replace operation
    const replacePatch = output.patches.find((p: any) => p.op === "replace");
    expect(replacePatch).toBeDefined();
    expect(replacePatch.old).toBe("foo");
    expect(replacePatch.new).toBe("bar");
  });

  test("suggest replace-regex operation for pattern changes", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Version 1.0.0\n\nRelease date: 2024-01-15");
    writeFileSync(targetFile, "# Version 2.0.0\n\nRelease date: 2024-06-20");

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBeGreaterThan(0);

    // Should suggest operations for version and date changes
    const patches = output.patches;
    expect(patches.some((p: any) => p.op === "replace" || p.op === "replace-regex")).toBe(true);
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

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.patches).toBeDefined();

    // Should suggest set-frontmatter or merge-frontmatter operations
    const frontmatterPatches = output.patches.filter(
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

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBeGreaterThan(0);

    // Should suggest section-related operations
    const sectionPatches = output.patches.filter((p: any) =>
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

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBeGreaterThan(0);
    expect(output.sourceFile).toBe(sourceFile);
    expect(output.targetFile).toBe(targetFile);
  });

  test("suggest no patches for identical files", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    const content = "# Same Content\n\nIdentical in both files.";
    writeFileSync(sourceFile, content);
    writeFileSync(targetFile, content);

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBe(0);
    expect(output.message).toContain("identical");
  });

  test("suggest patches for completely different files", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Original\n\nCompletely different.");
    writeFileSync(targetFile, "# New Document\n\nNothing in common.");

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    // Should suggest patches, possibly including full content replacement
    expect(output.patches.length).toBeGreaterThan(0);
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

    const result = execSync(`${cliPath} suggest ${sourceDir} ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.files).toBeDefined();
    expect(output.files.length).toBe(2);

    // Each file should have suggested patches
    for (const file of output.files) {
      expect(file.path).toBeDefined();
      expect(file.patches).toBeDefined();
      expect(file.patches.length).toBeGreaterThan(0);
    }
  });

  test("match files by relative path in directories", () => {
    const sourceDir = join(testDir, "source");
    const targetDir = join(testDir, "target");

    mkdirSync(join(sourceDir, "subdir"), { recursive: true });
    mkdirSync(join(targetDir, "subdir"), { recursive: true });

    writeFileSync(join(sourceDir, "subdir", "nested.md"), "# Nested\n\nOriginal.");
    writeFileSync(join(targetDir, "subdir", "nested.md"), "# Nested\n\nModified.");

    const result = execSync(`${cliPath} suggest ${sourceDir} ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.files).toBeDefined();

    const nestedFile = output.files.find((f: any) => f.path.includes("subdir/nested.md"));
    expect(nestedFile).toBeDefined();
    expect(nestedFile.patches.length).toBeGreaterThan(0);
  });

  test("handle files that don't exist in both directories", () => {
    const sourceDir = join(testDir, "source");
    const targetDir = join(testDir, "target");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });

    // File only in source
    writeFileSync(join(sourceDir, "only-source.md"), "# Only in source");

    // File only in target
    writeFileSync(join(targetDir, "only-target.md"), "# Only in target");

    // File in both
    writeFileSync(join(sourceDir, "both.md"), "# Both\n\nOriginal.");
    writeFileSync(join(targetDir, "both.md"), "# Both\n\nModified.");

    const result = execSync(`${cliPath} suggest ${sourceDir} ${targetDir} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.files).toBeDefined();

    // Should include files that exist in both directories
    const bothFile = output.files.find((f: any) => f.path.includes("both.md"));
    expect(bothFile).toBeDefined();

    // Files only in one directory might be reported separately or skipped
    // depending on implementation
    expect(output.skipped).toBeDefined();
  });

  // ============================================================================
  // Output formats
  // ============================================================================

  test("output text format", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile}`, {
      encoding: "utf-8",
    });

    // Text format should include human-readable output
    expect(result).toContain("Suggested patches");
    expect(result).toMatch(/op:\s*replace/);
  });

  test("output JSON format", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    expect(Array.isArray(output.patches)).toBe(true);
  });

  test("write config to file with --output flag", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const outputFile = join(testDir, "kustomark.yaml");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --output ${outputFile}`, {
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

  test("JSON output with --output flag writes JSON config", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");
    const outputFile = join(testDir, "kustomark.json");

    writeFileSync(sourceFile, "# Title\n\nOld text.");
    writeFileSync(targetFile, "# Title\n\nNew text.");

    execSync(
      `${cliPath} suggest ${sourceFile} ${targetFile} --format=json --output ${outputFile}`,
      {
        encoding: "utf-8",
      },
    );

    expect(existsSync(outputFile)).toBe(true);

    const configContent = readFileSync(outputFile, "utf-8");
    const config = JSON.parse(configContent);

    expect(config.apiVersion).toBe("kustomark/v1");
    expect(config.kind).toBe("Kustomization");
    expect(config.patches).toBeDefined();
    expect(Array.isArray(config.patches)).toBe(true);
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  test("handle non-existent source file", () => {
    const sourceFile = join(testDir, "nonexistent.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(targetFile, "# Target");

    try {
      execSync(`${cliPath} suggest ${sourceFile} ${targetFile}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("not found");
    }
  });

  test("handle non-existent target file", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "nonexistent.md");

    writeFileSync(sourceFile, "# Source");

    try {
      execSync(`${cliPath} suggest ${sourceFile} ${targetFile}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("not found");
    }
  });

  test("handle invalid file paths", () => {
    try {
      execSync(`${cliPath} suggest /invalid/path/source.md /invalid/path/target.md`, {
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

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBe(0);
  });

  test("handle binary files gracefully", () => {
    const sourceFile = join(testDir, "source.bin");
    const targetFile = join(testDir, "target.bin");

    // Create binary-like content
    const binaryContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    writeFileSync(sourceFile, binaryContent);
    writeFileSync(targetFile, binaryContent);

    try {
      const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
        encoding: "utf-8",
      });

      const output = JSON.parse(result);

      // Should either skip binary files or handle them gracefully
      expect(output.success).toBe(true);
      if (output.skipped) {
        expect(output.skipped).toContain("binary");
      }
    } catch (error: any) {
      // Or might error with a helpful message
      expect(error.stderr.toString()).toMatch(/binary|not.*text/i);
    }
  });

  test("handle empty source file with content in target", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "");
    writeFileSync(targetFile, "# New Content\n\nThis was added.");

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    expect(output.patches.length).toBeGreaterThan(0);
  });

  test("handle content in source but empty target", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Original Content\n\nThis was removed.");
    writeFileSync(targetFile, "");

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
    // Might suggest deletion or replacement with empty content
    expect(output.patches.length).toBeGreaterThan(0);
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

    const result = execSync(`${cliPath} suggest ${sourceFile} ${targetFile} --format=json`, {
      encoding: "utf-8",
    });

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();

    // Should suggest multiple types of patches
    const patchOps = output.patches.map((p: any) => p.op);
    const uniqueOps = new Set(patchOps);

    // Should have at least 2 different operation types
    expect(uniqueOps.size).toBeGreaterThanOrEqual(2);
  });

  test("suggest patches with --min-similarity threshold", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nSome content here.");
    writeFileSync(targetFile, "# Title\n\nSlightly different content.");

    const result = execSync(
      `${cliPath} suggest ${sourceFile} ${targetFile} --format=json --min-similarity=0.8`,
      {
        encoding: "utf-8",
      },
    );

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();
  });

  test("suggest with --strategy=minimal flag for fewer patches", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nLine 1\nLine 2\nLine 3");
    writeFileSync(targetFile, "# Title\n\nLine A\nLine 2\nLine B");

    const result = execSync(
      `${cliPath} suggest ${sourceFile} ${targetFile} --format=json --strategy=minimal`,
      {
        encoding: "utf-8",
      },
    );

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();

    // Minimal strategy should produce fewer, more general patches
    expect(output.strategy).toBe("minimal");
  });

  test("suggest with --strategy=detailed flag for more patches", () => {
    const sourceFile = join(testDir, "source.md");
    const targetFile = join(testDir, "target.md");

    writeFileSync(sourceFile, "# Title\n\nLine 1\nLine 2\nLine 3");
    writeFileSync(targetFile, "# Title\n\nLine A\nLine 2\nLine B");

    const result = execSync(
      `${cliPath} suggest ${sourceFile} ${targetFile} --format=json --strategy=detailed`,
      {
        encoding: "utf-8",
      },
    );

    const output = JSON.parse(result);

    expect(output.success).toBe(true);
    expect(output.patches).toBeDefined();

    // Detailed strategy should produce more specific patches
    expect(output.strategy).toBe("detailed");
  });
});
