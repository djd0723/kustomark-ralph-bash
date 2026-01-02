/**
 * Tests for the enhanced dry-run analysis feature
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/dry-run-analysis";

describe("kustomark dry-run analysis", () => {
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

## Section 2

More content.
`,
    );

    // Create another file
    writeFileSync(
      join(FIXTURES_DIR, "another.md"),
      `# Another File

Some content.
`,
    );
  };

  const cleanupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  };

  test("--dry-run includes analysis in JSON output", () => {
    setupFixtures();

    try {
      // Create kustomark.yaml with simple patches
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
  - another.md
patches:
  - op: replace
    old: "test"
    new: "production"
  - op: set-frontmatter
    key: "status"
    value: "published"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Verify basic structure
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
      expect(result).toHaveProperty("dryRun");
      expect(result.dryRun).toBe(true);

      // Verify dry-run analysis is included
      expect(result).toHaveProperty("dryRunAnalysis");
      expect(result.dryRunAnalysis).toHaveProperty("complexityScore");
      expect(result.dryRunAnalysis).toHaveProperty("riskLevel");
      expect(result.dryRunAnalysis).toHaveProperty("impact");
      expect(result.dryRunAnalysis).toHaveProperty("conflicts");
      expect(result.dryRunAnalysis).toHaveProperty("dependencies");
      expect(result.dryRunAnalysis).toHaveProperty("assessment");

      // Verify complexity score is a number
      expect(typeof result.dryRunAnalysis.complexityScore).toBe("number");
      expect(result.dryRunAnalysis.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.dryRunAnalysis.complexityScore).toBeLessThanOrEqual(100);

      // Verify risk level is valid
      expect(["low", "medium", "high"]).toContain(result.dryRunAnalysis.riskLevel);

      // Verify impact structure
      expect(result.dryRunAnalysis.impact).toHaveProperty("filesCreated");
      expect(result.dryRunAnalysis.impact).toHaveProperty("filesModified");
      expect(result.dryRunAnalysis.impact).toHaveProperty("filesDeleted");
      expect(result.dryRunAnalysis.impact).toHaveProperty("bytesAdded");
      expect(result.dryRunAnalysis.impact).toHaveProperty("bytesRemoved");
      expect(result.dryRunAnalysis.impact).toHaveProperty("netBytes");
    } finally {
      cleanupFixtures();
    }
  });

  test("complexity calculation - simple patches", () => {
    setupFixtures();

    try {
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
  - op: set-frontmatter
    key: "title"
    value: "Test"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Simple patches should have low complexity
      expect(result.dryRunAnalysis.complexityScore).toBeLessThan(30);
      expect(result.dryRunAnalysis.riskLevel).toBe("low");
    } finally {
      cleanupFixtures();
    }
  });

  test("complexity calculation - regex patches", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace-regex
    pattern: "test\\\\s+(\\\\w+)"
    replacement: "production $1"
    flags: "gi"
  - op: replace-regex
    pattern: "Section\\\\s+\\\\d+"
    replacement: "Chapter"
    flags: "gi"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Regex patches should have higher complexity
      expect(result.dryRunAnalysis.complexityScore).toBeGreaterThan(20);
    } finally {
      cleanupFixtures();
    }
  });

  test("risk assessment - destructive operations", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
  - another.md
patches:
  - op: delete-file
    match: "another.md"
  - op: remove-section
    id: "section-1"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Destructive operations should have high risk
      expect(["medium", "high"]).toContain(result.dryRunAnalysis.riskLevel);
    } finally {
      cleanupFixtures();
    }
  });

  test("conflict detection - overlapping section operations", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: remove-section
    id: "section-1"
  - op: replace-section
    id: "section-1"
    content: "New content"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should detect conflict between patches targeting same section
      expect(result.dryRunAnalysis.conflicts.length).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.conflicts[0].type).toBe("overlapping-targets");
    } finally {
      cleanupFixtures();
    }
  });

  test("conflict detection - frontmatter key conflicts", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: set-frontmatter
    key: "title"
    value: "First Title"
  - op: set-frontmatter
    key: "title"
    value: "Second Title"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should detect competing changes to same key
      expect(result.dryRunAnalysis.conflicts.length).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.conflicts[0].type).toBe("competing-changes");
    } finally {
      cleanupFixtures();
    }
  });

  test("conflict detection - order-dependent operations", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace-regex
    pattern: "test"
    replacement: "production"
    flags: "g"
  - op: replace-regex
    pattern: "production"
    replacement: "staging"
    flags: "g"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should detect order-dependent regex replacements
      expect(result.dryRunAnalysis.conflicts.length).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.conflicts[0].type).toBe("order-dependent");
    } finally {
      cleanupFixtures();
    }
  });

  test("impact calculation - file operations", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: copy-file
    src: "test.md"
    dest: "copy.md"
  - op: delete-file
    match: "another.md"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should estimate file operations
      expect(result.dryRunAnalysis.impact.filesCreated).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.impact.filesDeleted).toBeGreaterThan(0);
    } finally {
      cleanupFixtures();
    }
  });

  test("impact calculation - content modifications", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
  - another.md
patches:
  - op: prepend-to-section
    id: "section-1"
    content: "New paragraph"
  - op: remove-section
    id: "section-2"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should estimate bytes added and removed
      expect(result.dryRunAnalysis.impact.filesModified).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.impact.bytesAdded).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.impact.bytesRemoved).toBeGreaterThan(0);
    } finally {
      cleanupFixtures();
    }
  });

  test("dependency analysis - sequential patches", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace-section
    id: "section-1"
    content: "New content"
  - op: prepend-to-section
    id: "section-1"
    content: "Prefix"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should detect dependency
      expect(result.dryRunAnalysis.dependencies.length).toBeGreaterThan(0);
      expect(result.dryRunAnalysis.dependencies[0].dependentPatch).toBe(1);
      expect(result.dryRunAnalysis.dependencies[0].dependsOn).toContain(0);
    } finally {
      cleanupFixtures();
    }
  });

  test("--analyze flag runs analysis without dry-run", () => {
    setupFixtures();

    try {
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

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --analyze --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should include analysis
      expect(result).toHaveProperty("dryRunAnalysis");
      expect(result.dryRunAnalysis).toHaveProperty("complexityScore");

      // Should actually write files (not dry-run)
      expect(result.dryRun).toBeUndefined();
      expect(result.filesWritten).toBeGreaterThan(0);

      // Verify output was actually created
      const outputDir = join(FIXTURES_DIR, "output");
      expect(existsSync(outputDir)).toBe(true);
    } finally {
      cleanupFixtures();
    }
  });

  test("text output format includes analysis", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace-regex
    pattern: "test"
    replacement: "production"
    flags: "g"
  - op: delete-file
    match: "*.tmp"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run`, {
        encoding: "utf-8",
      });

      // Verify text output includes analysis sections
      expect(output).toContain("Dry-Run Analysis:");
      expect(output).toContain("Complexity Score:");
      expect(output).toContain("Risk Level:");
      expect(output).toContain("Impact:");
      expect(output).toContain("Files to be created:");
      expect(output).toContain("Files to be modified:");
      expect(output).toContain("Files to be deleted:");
      expect(output).toContain("Bytes to be added:");
      expect(output).toContain("Bytes to be removed:");
      expect(output).toContain("Net bytes:");
    } finally {
      cleanupFixtures();
    }
  });

  test("text output shows conflicts when present", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: remove-section
    id: "section-1"
  - op: replace-section
    id: "section-1"
    content: "New"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run`, {
        encoding: "utf-8",
      });

      // Verify conflicts are shown
      expect(output).toContain("Conflicts");
      expect(output).toMatch(/Patches \d+ & \d+/);
    } finally {
      cleanupFixtures();
    }
  });

  test("text output shows dependencies when present", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: replace-section
    id: "section-1"
    content: "Base content"
  - op: append-to-section
    id: "section-1"
    content: "Additional content"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run`, {
        encoding: "utf-8",
      });

      // Verify dependencies are shown
      expect(output).toContain("Dependencies");
      expect(output).toContain("depends on");
    } finally {
      cleanupFixtures();
    }
  });

  test("assessment message reflects overall analysis", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches:
  - op: delete-file
    match: "*.md"
  - op: remove-section
    id: "section-1"
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Assessment should mention high risk for destructive operations
      expect(result.dryRunAnalysis.assessment).toMatch(/risk/i);
      expect(result.dryRunAnalysis.riskLevel).toBe("high");
    } finally {
      cleanupFixtures();
    }
  });

  test("empty patches array", () => {
    setupFixtures();

    try {
      writeFileSync(
        join(FIXTURES_DIR, "kustomark.yaml"),
        `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - test.md
patches: []
`,
      );

      const output = execSync(`bun run ${CLI_PATH} build ${FIXTURES_DIR} --dry-run --format=json`, {
        encoding: "utf-8",
      });

      const result = JSON.parse(output);

      // Should handle empty patches gracefully
      expect(result.dryRunAnalysis.complexityScore).toBe(0);
      expect(result.dryRunAnalysis.riskLevel).toBe("low");
      expect(result.dryRunAnalysis.conflicts.length).toBe(0);
      expect(result.dryRunAnalysis.dependencies.length).toBe(0);
    } finally {
      cleanupFixtures();
    }
  });
});
