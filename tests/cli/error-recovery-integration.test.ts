/**
 * Comprehensive tests for CLI Error Recovery Integration
 *
 * Tests CLI integration with --auto-fix flag, recovery statistics tracking,
 * JSON output with recovery info, and non-interactive mode behavior.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/error-recovery-integration";

describe("CLI Error Recovery Integration", () => {
  beforeEach(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("--auto-fix flag", () => {
    test("enables error recovery system", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello world"  # Will fail due to case
    new: "hi there"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHello World");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result).toHaveProperty("recovery");
      expect(result.recovery).toBeDefined();
    });

    test("automatically fixes case mismatch errors", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello world"
    new: "hi there"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHello World");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBeGreaterThan(0);

      // Verify the file was actually fixed
      const outputFile = join(FIXTURES_DIR, "output", "test.md");
      const content = readFileSync(outputFile, "utf-8");
      expect(content).toContain("hi there");
      expect(content).not.toContain("Hello World");
    });

    test("automatically fixes whitespace normalization errors", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "Hello World"
    new: "Hi"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHello  World"); // Two spaces

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBeGreaterThan(0);
    });

    test("automatically fixes section ID typos", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: remove-section
    id: "instalation"  # Typo: should be "installation"
`
      );

      writeFileSync(
        join(FIXTURES_DIR, "test.md"),
        `# Test

## Installation

Content here

## Configuration

More content`
      );

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBeGreaterThan(0);

      // Verify the section was removed
      const outputFile = join(FIXTURES_DIR, "output", "test.md");
      const content = readFileSync(outputFile, "utf-8");
      expect(content).not.toContain("## Installation");
      expect(content).toContain("## Configuration");
    });

    test("automatically fixes frontmatter key typos", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: remove-frontmatter
    key: "athour"  # Typo: should be "author"
`
      );

      writeFileSync(
        join(FIXTURES_DIR, "test.md"),
        `---
title: Test
author: John Doe
---

# Test

Content here`
      );

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBeGreaterThan(0);

      // Verify the frontmatter key was removed
      const outputFile = join(FIXTURES_DIR, "output", "test.md");
      const content = readFileSync(outputFile, "utf-8");
      expect(content).not.toContain("author:");
    });

    test("automatically fixes reversed marker order", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-between
    start: "<!-- START -->"
    end: "<!-- END -->"
`
      );

      writeFileSync(
        join(FIXTURES_DIR, "test.md"),
        `# Test

Before
<!-- END -->
Content to delete
<!-- START -->
After`
      );

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBeGreaterThan(0);
    });

    test("does not auto-fix when confidence is below threshold", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: remove-section
    id: "completely-different-section"
`
      );

      writeFileSync(
        join(FIXTURES_DIR, "test.md"),
        `# Test

## Introduction

Content`
      );

      try {
        execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        // Should fail since no high-confidence recovery available
        expect(error.status).toBe(1);
      }
    });
  });

  describe("Recovery statistics tracking", () => {
    test("tracks total errors encountered", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello world"
    new: "hi"
  - op: replace
    old: "foo bar"
    new: "baz"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHello World\nFoo Bar");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.recovery.totalErrors).toBe(2);
    });

    test("tracks successfully recovered errors", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello world"
    new: "hi"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHello World");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.recovery.recovered).toBe(1);
    });

    test("tracks skipped errors", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "nonexistent"
    new: "test"
    onNoMatch: skip
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nContent");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.recovery.skipped).toBeGreaterThanOrEqual(0);
    });

    test("tracks recovery strategies used", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello world"
    new: "hi"
  - op: remove-section
    id: "instalation"
`
      );

      writeFileSync(
        join(FIXTURES_DIR, "test.md"),
        `# Test

Hello World

## Installation

Content`
      );

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.recovery.strategies).toBeDefined();
      expect(typeof result.recovery.strategies).toBe("object");
    });

    test("handles multiple files with different errors", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "file1.md"), "# File 1\n\nTest");
      writeFileSync(join(FIXTURES_DIR, "file2.md"), "# File 2\n\nTEST");
      writeFileSync(join(FIXTURES_DIR, "file3.md"), "# File 3\n\nTest");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.totalErrors).toBeGreaterThanOrEqual(1);
      expect(result.recovery.recovered).toBeGreaterThanOrEqual(1);
    });

    test("recovery stats not present without --auto-fix", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\ntest");

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      expect(result.recovery).toBeUndefined();
    });
  });

  describe("JSON output with recovery info", () => {
    test("includes recovery section in JSON output", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello"
    new: "hi"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHELLO");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result).toHaveProperty("recovery");
      expect(result.recovery).toHaveProperty("totalErrors");
      expect(result.recovery).toHaveProperty("recovered");
      expect(result.recovery).toHaveProperty("skipped");
      expect(result.recovery).toHaveProperty("failed");
      expect(result.recovery).toHaveProperty("strategies");
    });

    test("recovery stats show correct structure", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nTEST");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(typeof result.recovery.totalErrors).toBe("number");
      expect(typeof result.recovery.recovered).toBe("number");
      expect(typeof result.recovery.skipped).toBe("number");
      expect(typeof result.recovery.failed).toBe("number");
      expect(typeof result.recovery.strategies).toBe("object");
    });

    test("recovery stats in dry-run mode", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello"
    new: "hi"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHELLO");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --dry-run --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.dryRun).toBe(true);
      expect(result.recovery).toBeDefined();
    });

    test("recovery stats with --verbose flag", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nTEST");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --verbose --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.recovery).toBeDefined();
    });

    test("JSON output is valid and parseable", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "foo"
    new: "bar"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nFOO");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe("Non-interactive mode behavior", () => {
    test("auto-fixes without user prompts in non-interactive mode", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello"
    new: "hi"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHELLO");

      // In CI/non-interactive environment, should auto-apply high-confidence fixes
      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBeGreaterThan(0);
    });

    test("fails gracefully when no high-confidence recovery available", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: remove-section
    id: "nonexistent-section"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\n## Different Section");

      try {
        execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(1);
      }
    });

    test("processes multiple errors in sequence", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello"
    new: "hi"
  - op: replace
    old: "world"
    new: "universe"
  - op: remove-section
    id: "instalation"
`
      );

      writeFileSync(
        join(FIXTURES_DIR, "test.md"),
        `# Test

HELLO WORLD

## Installation

Content`
      );

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.totalErrors).toBe(3);
      expect(result.recovery.recovered).toBe(3);
    });

    test("respects onNoMatch strategy with auto-fix", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "nonexistent"
    new: "test"
    onNoMatch: skip
  - op: replace
    old: "hello"
    new: "hi"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nHELLO");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.skipped).toBeGreaterThanOrEqual(1);
    });

    test("handles errors in middle of patch sequence", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "first"
    new: "1st"
  - op: replace
    old: "second"
    new: "2nd"
  - op: replace
    old: "third"
    new: "3rd"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nFIRST\nSECOND\nTHIRD");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.recovered).toBe(3);

      // Verify all replacements were applied
      const outputFile = join(FIXTURES_DIR, "output", "test.md");
      const content = readFileSync(outputFile, "utf-8");
      expect(content).toContain("1st");
      expect(content).toContain("2nd");
      expect(content).toContain("3rd");
    });
  });

  describe("Edge cases and error handling", () => {
    test("handles malformed patches gracefully", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    # Missing 'old' field
    new: "test"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nContent");

      try {
        execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(1);
      }
    });

    test("handles empty files", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
    });

    test("handles binary files gracefully", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      // Create a binary file
      const binaryData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      writeFileSync(join(FIXTURES_DIR, "image.md"), binaryData);

      try {
        execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        // May succeed or fail depending on how binary files are handled
        expect(true).toBe(true);
      } catch (error: any) {
        // Also acceptable to fail on binary files
        expect(error.status).toBe(1);
      }
    });

    test("recovery stats remain at zero when no errors occur", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\ntest");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery.totalErrors).toBe(0);
      expect(result.recovery.recovered).toBe(0);
      expect(result.recovery.skipped).toBe(0);
      expect(result.recovery.failed).toBe(0);
    });

    test("handles very long content efficiently", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "hello"
    new: "hi"
`
      );

      const longContent = "# Test\n\n" + "HELLO\n".repeat(10000);
      writeFileSync(join(FIXTURES_DIR, "test.md"), longContent);

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
    });

    test("handles multiple files with mixed success/failure", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "file1.md"), "# File 1\n\nTEST");
      writeFileSync(join(FIXTURES_DIR, "file2.md"), "# File 2\n\ntest");
      writeFileSync(join(FIXTURES_DIR, "file3.md"), "# File 3\n\nTeSt");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(3);
    });

    test("combines --auto-fix with --offline flag", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nTEST");

      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --offline --format=json`,
        { encoding: "utf-8" }
      );

      const result = JSON.parse(output);

      expect(result.success).toBe(true);
      expect(result.recovery).toBeDefined();
    });

    test("combines --auto-fix with caching", () => {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "test"
    new: "production"
`
      );

      writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\nTEST");

      // First run
      const output1 = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result1 = JSON.parse(output1);
      expect(result1.success).toBe(true);

      // Second run (should use cache)
      const output2 = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --auto-fix --format=json`,
        { encoding: "utf-8" }
      );

      const result2 = JSON.parse(output2);
      expect(result2.success).toBe(true);
    });
  });
});
