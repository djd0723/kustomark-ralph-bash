/**
 * Tests for the `kustomark build --dry-run` flag
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/dry-run";

describe("kustomark build --dry-run", () => {
  // Setup test fixtures
  const setupFixtures = () => {
    // Clean up any existing fixtures
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }

    // Create test structure
    mkdirSync(FIXTURES_DIR, { recursive: true });

    // Create a simple markdown file
    writeFileSync(
      join(FIXTURES_DIR, "test.md"),
      `# Test File

This is a test file.

## Section 1

Content here.
`,
    );

    // Create kustomark.yaml with patches
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace
    old: "test"
    new: "production"
`,
    );
  };

  const cleanupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  };

  test("--dry-run does not write files", () => {
    setupFixtures();

    try {
      const outputDir = join(FIXTURES_DIR, "output");

      // Run build with --dry-run
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run`, {
        encoding: "utf-8",
      });

      // Verify output directory was NOT created
      expect(existsSync(outputDir)).toBe(false);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run with --format=json includes dryRun field", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Verify basic structure
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
      expect(result).toHaveProperty("dryRun");
      expect(result.dryRun).toBe(true);

      // Verify it still reports what would be written
      expect(result).toHaveProperty("filesWritten");
      expect(result.filesWritten).toBe(1);
      expect(result).toHaveProperty("patchesApplied");
      expect(result.patchesApplied).toBeGreaterThan(0);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run with text output shows 'Would build'", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run`, {
        encoding: "utf-8",
      });

      // Verify output message indicates dry-run
      expect(output).toContain("Would build");
      expect(output).toMatch(/Would build \d+ file\(s\)/);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run does not create lock file", () => {
    setupFixtures();

    try {
      const lockFilePath = join(FIXTURES_DIR, "kustomark.lock");

      // Run build with --dry-run
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run`, {
        encoding: "utf-8",
      });

      // Verify lock file was NOT created
      expect(existsSync(lockFilePath)).toBe(false);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run with --clean does not remove files", () => {
    setupFixtures();

    try {
      const outputDir = join(FIXTURES_DIR, "output");
      mkdirSync(outputDir, { recursive: true });

      // Create an extra file that would be removed by --clean
      const extraFile = join(outputDir, "extra.md");
      writeFileSync(extraFile, "This file should not be removed in dry-run mode");

      // Run build with --dry-run and --clean
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --clean`, {
        encoding: "utf-8",
      });

      // Verify extra file still exists
      expect(existsSync(extraFile)).toBe(true);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run with --stats reports statistics without writing", () => {
    setupFixtures();

    try {
      const output = execSync(
        `bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --stats --format=json`,
        {
          encoding: "utf-8",
        },
      );

      const result = JSON.parse(output);

      // Verify stats are included
      expect(result).toHaveProperty("stats");
      expect(result.stats).toHaveProperty("duration");
      expect(result.stats).toHaveProperty("files");
      expect(result.stats).toHaveProperty("patches");
      expect(result.stats).toHaveProperty("bytes");

      // Verify dry-run flag
      expect(result.dryRun).toBe(true);

      // Verify files not actually written
      const outputDir = join(FIXTURES_DIR, "output");
      expect(existsSync(outputDir)).toBe(false);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run with --incremental does not save cache", () => {
    setupFixtures();

    try {
      const cacheDir = join(FIXTURES_DIR, ".kustomark");

      // Run build with --dry-run and --incremental
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --incremental`, {
        encoding: "utf-8",
      });

      // Verify cache directory was NOT created
      expect(existsSync(cacheDir)).toBe(false);
    } finally {
      cleanupFixtures();
    }
  });

  test("--dry-run with verbose output shows file operations", () => {
    setupFixtures();

    try {
      const result = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run -vvv 2>&1`, {
        encoding: "utf-8",
      });

      // Verify verbose output includes dry-run messages
      expect(result).toMatch(/would write.*test\.md/i);
    } finally {
      cleanupFixtures();
    }
  });

  test("normal build (without --dry-run) actually writes files", () => {
    setupFixtures();

    try {
      const outputDir = join(FIXTURES_DIR, "output");

      // Run build WITHOUT --dry-run
      execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, {
        encoding: "utf-8",
      });

      // Verify output directory WAS created
      expect(existsSync(outputDir)).toBe(true);

      // Verify file was written
      const outputFile = join(outputDir, "test.md");
      expect(existsSync(outputFile)).toBe(true);

      // Verify content was patched
      const content = readFileSync(outputFile, "utf-8");
      expect(content).toContain("production");
      expect(content).not.toContain("test");
    } finally {
      cleanupFixtures();
    }
  });
});
