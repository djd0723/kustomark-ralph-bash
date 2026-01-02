/**
 * Tests for the `kustomark build --stats` flag
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/stats";

describe("kustomark build --stats", () => {
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

This is a test file for stats.

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
  - op: replace
    old: "Test"
    new: "Production"
  - op: replace-regex
    pattern: "Content"
    replacement: "New content"
`,
    );
  };

  const cleanupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  };

  test("--stats with --format=json outputs statistics in JSON format", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --stats --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Verify basic structure
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
      expect(result).toHaveProperty("stats");

      // Verify stats structure
      const stats = result.stats;
      expect(stats).toHaveProperty("duration");
      expect(stats).toHaveProperty("files");
      expect(stats).toHaveProperty("patches");
      expect(stats).toHaveProperty("bytes");
      expect(stats).toHaveProperty("byOperation");

      // Verify stats types
      expect(typeof stats.duration).toBe("number");
      expect(stats.duration).toBeGreaterThanOrEqual(0);

      // Verify files stats
      expect(stats.files).toHaveProperty("processed");
      expect(stats.files).toHaveProperty("written");
      expect(stats.files.processed).toBe(1);
      expect(stats.files.written).toBe(1);

      // Verify patches stats
      expect(stats.patches).toHaveProperty("applied");
      expect(stats.patches).toHaveProperty("skipped");
      expect(typeof stats.patches.applied).toBe("number");
      expect(typeof stats.patches.skipped).toBe("number");

      // Verify bytes
      expect(typeof stats.bytes).toBe("number");
      expect(stats.bytes).toBeGreaterThan(0);

      // Verify operation counts
      expect(stats.byOperation).toHaveProperty("replace");
      expect(stats.byOperation).toHaveProperty("replace-regex");
      expect(stats.byOperation.replace).toBe(2);
      expect(stats.byOperation["replace-regex"]).toBe(1);
    } finally {
      cleanupFixtures();
    }
  });

  test("--stats without --format=json outputs statistics in text format", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --stats`, {
        encoding: "utf-8",
      });

      // Verify text output contains stats
      expect(output).toContain("Build Statistics:");
      expect(output).toContain("Duration:");
      expect(output).toContain("Files processed:");
      expect(output).toContain("Files written:");
      expect(output).toContain("Patches applied:");
      expect(output).toContain("Patches skipped:");
      expect(output).toContain("Total bytes:");
      expect(output).toContain("By operation:");
      expect(output).toContain("replace:");
      expect(output).toContain("replace-regex:");
    } finally {
      cleanupFixtures();
    }
  });

  test("build without --stats does not output statistics", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR}`, {
        encoding: "utf-8",
      });

      // Verify no stats in text output
      expect(output).not.toContain("Build Statistics:");
      expect(output).not.toContain("Duration:");
    } finally {
      cleanupFixtures();
    }
  });

  test("build without --stats and --format=json does not include stats in JSON", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Verify stats is undefined or not present
      expect(result.stats).toBeUndefined();
    } finally {
      cleanupFixtures();
    }
  });

  test("stats track correct file counts", () => {
    // Create a fixture with multiple files
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });

    // Create multiple markdown files
    writeFileSync(join(FIXTURES_DIR, "file1.md"), "# File 1\n\nContent");
    writeFileSync(join(FIXTURES_DIR, "file2.md"), "# File 2\n\nContent");
    writeFileSync(join(FIXTURES_DIR, "file3.md"), "# File 3\n\nContent");

    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "Content"
    new: "Modified"
`,
    );

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --stats --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);
      const stats = result.stats;

      expect(stats.files.processed).toBe(3);
      expect(stats.files.written).toBe(3);
    } finally {
      cleanupFixtures();
    }
  });

  test("stats track skipped patches correctly", () => {
    setupFixtures();

    // Create fixture with patches that won't match
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace
    old: "nonexistent"
    new: "replacement"
  - op: replace
    old: "test"
    new: "production"
`,
    );

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --stats --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);
      const stats = result.stats;

      // At least one patch should be skipped (the one with "nonexistent")
      expect(stats.patches.skipped).toBeGreaterThan(0);
    } finally {
      cleanupFixtures();
    }
  });

  test("stats duration is reasonable", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --stats --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);
      const stats = result.stats;

      // Duration should be a reasonable number (less than 10 seconds for a simple build)
      expect(stats.duration).toBeGreaterThan(0);
      expect(stats.duration).toBeLessThan(10000);
    } finally {
      cleanupFixtures();
    }
  });

  test("stats match spec example format", () => {
    setupFixtures();

    try {
      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --stats --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Verify the format matches the M4 spec example
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        stats: {
          duration: expect.any(Number),
          files: {
            processed: expect.any(Number),
            written: expect.any(Number),
          },
          patches: {
            applied: expect.any(Number),
            skipped: expect.any(Number),
          },
          bytes: expect.any(Number),
          byOperation: expect.any(Object),
        },
      });
    } finally {
      cleanupFixtures();
    }
  });
});
