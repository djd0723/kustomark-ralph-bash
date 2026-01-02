/**
 * Tests for the `kustomark analyze` command
 *
 * The analyze command provides comprehensive analytics for patch operations,
 * including coverage, impact, complexity, and safety metrics.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/analyze";

describe("kustomark analyze", () => {
  // Helper to setup fixtures directory
  const setupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });
  };

  // Helper to cleanup fixtures
  const cleanupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  };

  beforeEach(() => {
    setupFixtures();
  });

  afterEach(() => {
    cleanupFixtures();
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  test("analyze command outputs analytics in JSON format by default", () => {
    // Create a simple config with patches
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
  - op: replace-regex
    pattern: 'v\\d+\\.\\d+\\.\\d+'
    replacement: "v2.0.0"
`,
    );

    // Create test markdown files
    writeFileSync(join(FIXTURES_DIR, "doc1.md"), "# Doc 1\n\nContent with foo.");
    writeFileSync(join(FIXTURES_DIR, "doc2.md"), "# Doc 2\n\nVersion v1.0.0 here.");
    writeFileSync(join(FIXTURES_DIR, "doc3.md"), "# Doc 3\n\nUnpatched content.");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Verify basic structure
    expect(result).toHaveProperty("coverage");
    expect(result).toHaveProperty("impact");
    expect(result).toHaveProperty("complexity");
    expect(result).toHaveProperty("safety");
    expect(result).toHaveProperty("timestamp");

    // Verify it's an ISO timestamp
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("analyze command with text format shows human-readable output", () => {
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
`,
    );

    writeFileSync(join(FIXTURES_DIR, "test.md"), "# Test\n\ntest content");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR}`, {
      encoding: "utf-8",
    });

    // Verify text output contains expected sections
    expect(output).toContain("Coverage Analysis");
    expect(output).toContain("Impact Analysis");
    expect(output).toContain("Complexity Analysis");
    expect(output).toContain("Safety Analysis");
  });

  // ============================================================================
  // Coverage Analysis Tests
  // ============================================================================

  test("coverage analysis tracks files with and without patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "patched.md"
    old: "foo"
    new: "bar"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "patched.md"), "# Patched\n\nfoo content");
    writeFileSync(join(FIXTURES_DIR, "unpatched.md"), "# Unpatched\n\nno patches here");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    expect(result.coverage.totalFiles).toBe(2);
    expect(result.coverage.filesWithPatches).toBe(1);
    expect(result.coverage.filesWithoutPatches).toBe(1);
    expect(result.coverage.coveragePercentage).toBe(50);
    expect(result.coverage.unpatchedFiles).toContain("unpatched.md");
    expect(result.coverage.patchedFiles).toContain("patched.md");
  });

  test("coverage analysis shows 100% when all files have patches", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc1.md"), "# Doc 1\n\ntest");
    writeFileSync(join(FIXTURES_DIR, "doc2.md"), "# Doc 2\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    expect(result.coverage.coveragePercentage).toBe(100);
    expect(result.coverage.filesWithoutPatches).toBe(0);
    expect(result.coverage.unpatchedFiles).toHaveLength(0);
  });

  test("coverage analysis shows 0% when no files have patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "nonexistent.md"
    old: "foo"
    new: "bar"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc1.md"), "# Doc 1");
    writeFileSync(join(FIXTURES_DIR, "doc2.md"), "# Doc 2");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    expect(result.coverage.coveragePercentage).toBe(0);
    expect(result.coverage.filesWithPatches).toBe(0);
    expect(result.coverage.filesWithoutPatches).toBe(2);
  });

  // ============================================================================
  // Impact Analysis Tests
  // ============================================================================

  test("impact analysis tracks files affected per patch", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "doc1.md"
    old: "foo"
    new: "bar"
  - op: replace
    old: "test"
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc1.md"), "# Doc 1\n\nfoo test");
    writeFileSync(join(FIXTURES_DIR, "doc2.md"), "# Doc 2\n\ntest only");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    expect(result.impact.totalPatches).toBe(2);
    expect(result.impact.totalAffectedFiles).toBe(2);

    // First patch affects only doc1.md
    expect(result.impact.patches[0].affectedFiles).toBe(1);
    expect(result.impact.patches[0].files).toContain("doc1.md");

    // Second patch affects both files
    expect(result.impact.patches[1].affectedFiles).toBe(2);
    expect(result.impact.patches[1].files).toContain("doc1.md");
    expect(result.impact.patches[1].files).toContain("doc2.md");
  });

  test("impact analysis identifies files with multiple patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "*.md"
    old: "foo"
    new: "bar"
  - op: replace
    include: "multi.md"
    old: "test"
    new: "prod"
  - op: replace-regex
    include: "multi.md"
    pattern: 'v\\d+'
    replacement: "v2"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "multi.md"), "# Multi\n\nfoo test v1");
    writeFileSync(join(FIXTURES_DIR, "single.md"), "# Single\n\nfoo only");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // multi.md should be affected by all 3 patches
    const multiPatchCount = result.impact.multiPatchFiles["multi.md"];
    expect(multiPatchCount).toBe(3);

    // single.md should be affected by 1 patch
    const singlePatchCount = result.impact.multiPatchFiles["single.md"];
    expect(singlePatchCount).toBeUndefined(); // Not in multiPatchFiles (only 1 patch)
  });

  test("impact analysis includes patch group information", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    group: "branding"
    old: "foo"
    new: "bar"
  - op: replace
    group: "versioning"
    old: "v1"
    new: "v2"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\nfoo v1");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    expect(result.impact.patches[0].group).toBe("branding");
    expect(result.impact.patches[1].group).toBe("versioning");
  });

  // ============================================================================
  // Complexity Analysis Tests
  // ============================================================================

  test("complexity analysis calculates scores based on patch count and types", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "simple.md"
    old: "foo"
    new: "bar"
  - op: replace
    include: "complex.md"
    old: "foo"
    new: "bar"
  - op: replace-regex
    include: "complex.md"
    pattern: "test"
    replacement: "prod"
  - op: delete-file
    match: "complex.md"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "simple.md"), "# Simple\n\nfoo");
    writeFileSync(join(FIXTURES_DIR, "complex.md"), "# Complex\n\nfoo test");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Find complexity for each file
    const simpleFile = result.complexity.files.find((f: any) => f.file === "simple.md");
    const complexFile = result.complexity.files.find((f: any) => f.file === "complex.md");

    // simple.md: 1 patch, 1 operation type, 0 high-risk = (1*2) + (1*1.5) + (0*3) = 3.5
    expect(simpleFile.patchCount).toBe(1);
    expect(simpleFile.uniqueOperationTypes).toBe(1);
    expect(simpleFile.highRiskOperations).toBe(0);
    expect(simpleFile.complexityScore).toBe(3.5);

    // complex.md: 3 patches, 3 operation types, 2 high-risk (replace-regex, delete-file)
    // = (3*2) + (3*1.5) + (2*3) = 6 + 4.5 + 6 = 16.5
    expect(complexFile.patchCount).toBe(3);
    expect(complexFile.uniqueOperationTypes).toBe(3);
    expect(complexFile.highRiskOperations).toBe(2);
    expect(complexFile.complexityScore).toBe(16.5);
  });

  test("complexity analysis includes top complex files sorted by score", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "low.md"
    old: "a"
    new: "b"
  - op: replace
    include: "high.md"
    old: "a"
    new: "b"
  - op: replace-regex
    include: "high.md"
    pattern: "c"
    replacement: "d"
  - op: delete-file
    match: "high.md"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "low.md"), "# Low");
    writeFileSync(join(FIXTURES_DIR, "high.md"), "# High");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // topComplexFiles should be sorted by complexity (descending)
    expect(result.complexity.topComplexFiles[0].file).toBe("high.md");
    expect(result.complexity.topComplexFiles[1].file).toBe("low.md");

    expect(result.complexity.topComplexFiles[0].complexityScore).toBeGreaterThan(
      result.complexity.topComplexFiles[1].complexityScore,
    );
  });

  test("complexity analysis calculates min, max, and average scores", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc1.md"), "# Doc 1\n\ntest");
    writeFileSync(join(FIXTURES_DIR, "doc2.md"), "# Doc 2\n\ntest");
    writeFileSync(join(FIXTURES_DIR, "doc3.md"), "# Doc 3\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // All files have same complexity: (1*2) + (1*1.5) + (0*3) = 3.5
    expect(result.complexity.minComplexity).toBe(3.5);
    expect(result.complexity.maxComplexity).toBe(3.5);
    expect(result.complexity.averageComplexity).toBe(3.5);
  });

  // ============================================================================
  // Safety Analysis Tests
  // ============================================================================

  test("safety analysis categorizes patches by risk level", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-file
    match: "*.md"
  - op: replace
    old: "foo"
    new: "bar"
  - op: append-to-section
    section: "Notes"
    content: "Added note"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\n## Notes\n\nfoo");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    expect(result.safety.totalPatches).toBe(3);
    expect(result.safety.highRiskPatches).toBe(1); // delete-file
    expect(result.safety.mediumRiskPatches).toBe(1); // replace
    expect(result.safety.lowRiskPatches).toBe(1); // append-to-section

    // Verify individual patch assessments
    const deleteFilePatch = result.safety.patches.find((p: any) => p.operation === "delete-file");
    expect(deleteFilePatch.riskLevel).toBe("high");
    expect(deleteFilePatch.riskScore).toBe(10);

    const replacePatch = result.safety.patches.find((p: any) => p.operation === "replace");
    expect(replacePatch.riskLevel).toBe("medium");
    expect(replacePatch.riskScore).toBe(5);

    const appendPatch = result.safety.patches.find(
      (p: any) => p.operation === "append-to-section",
    );
    expect(appendPatch.riskLevel).toBe("low");
    expect(appendPatch.riskScore).toBe(1);
  });

  test("safety analysis includes risk reasons", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace-regex
    pattern: "test"
    replacement: "prod"
  - op: set-frontmatter
    key: "version"
    value: "2.0"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    const regexPatch = result.safety.patches.find((p: any) => p.operation === "replace-regex");
    expect(regexPatch.riskReason).toContain("destructive");

    const frontmatterPatch = result.safety.patches.find(
      (p: any) => p.operation === "set-frontmatter",
    );
    expect(frontmatterPatch.riskReason).toContain("adds content");
  });

  test("safety analysis sorts patches by risk score", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: append-to-section
    section: "Notes"
    content: "note"
  - op: replace
    old: "a"
    new: "b"
  - op: delete-file
    match: "*.md"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // highestRiskPatches should be sorted by risk score (descending)
    expect(result.safety.highestRiskPatches[0].operation).toBe("delete-file");
    expect(result.safety.highestRiskPatches[0].riskScore).toBe(10);

    expect(result.safety.highestRiskPatches[2].operation).toBe("append-to-section");
    expect(result.safety.highestRiskPatches[2].riskScore).toBe(1);
  });

  test("safety analysis calculates average risk score", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "a"
    new: "b"
  - op: replace
    old: "c"
    new: "d"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Both replace patches have risk score of 5
    expect(result.safety.averageRiskScore).toBe(5);
  });

  // ============================================================================
  // Output Format Tests
  // ============================================================================

  test("JSON format matches analytics API types", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Verify exact structure matches AnalyticsReport interface
    expect(result).toMatchObject({
      coverage: {
        totalFiles: expect.any(Number),
        filesWithPatches: expect.any(Number),
        filesWithoutPatches: expect.any(Number),
        coveragePercentage: expect.any(Number),
        unpatchedFiles: expect.any(Array),
        patchedFiles: expect.any(Array),
      },
      impact: {
        totalPatches: expect.any(Number),
        totalAffectedFiles: expect.any(Number),
        patches: expect.any(Array),
        multiPatchFiles: expect.any(Object),
      },
      complexity: {
        totalFiles: expect.any(Number),
        averageComplexity: expect.any(Number),
        maxComplexity: expect.any(Number),
        minComplexity: expect.any(Number),
        files: expect.any(Array),
        topComplexFiles: expect.any(Array),
      },
      safety: {
        totalPatches: expect.any(Number),
        highRiskPatches: expect.any(Number),
        mediumRiskPatches: expect.any(Number),
        lowRiskPatches: expect.any(Number),
        averageRiskScore: expect.any(Number),
        patches: expect.any(Array),
        highestRiskPatches: expect.any(Array),
      },
      timestamp: expect.any(String),
    });
  });

  test("text format includes color coding for risk levels", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-file
    match: "*.md"
  - op: replace
    old: "a"
    new: "b"
  - op: append-to-section
    section: "Notes"
    content: "note"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR}`, {
      encoding: "utf-8",
    });

    // Verify text output contains risk levels
    expect(output).toContain("high");
    expect(output).toContain("medium");
    expect(output).toContain("low");
  });

  // ============================================================================
  // Risk Filtering Tests
  // ============================================================================

  test("--min-risk=high filters to show only high-risk patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-file
    match: "high.md"
  - op: replace-regex
    pattern: "test"
    replacement: "prod"
  - op: replace
    old: "a"
    new: "b"
  - op: append-to-section
    section: "Notes"
    content: "note"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --min-risk=high --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Should only show high-risk patches
    expect(result.safety.patches.every((p: any) => p.riskLevel === "high")).toBe(true);
    expect(result.safety.patches.length).toBe(2); // delete-file and replace-regex
  });

  test("--min-risk=medium filters to show medium and high-risk patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-file
    match: "*.md"
  - op: replace
    old: "a"
    new: "b"
  - op: append-to-section
    section: "Notes"
    content: "note"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --min-risk=medium --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Should show high and medium risk patches
    const riskLevels = result.safety.patches.map((p: any) => p.riskLevel);
    expect(riskLevels).not.toContain("low");
    expect(result.safety.patches.length).toBe(2); // delete-file and replace
  });

  test("--min-risk=low shows all patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-file
    match: "*.md"
  - op: replace
    old: "a"
    new: "b"
  - op: append-to-section
    section: "Notes"
    content: "note"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --min-risk=low --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Should show all patches
    expect(result.safety.patches.length).toBe(3);
  });

  // ============================================================================
  // Sorting Tests
  // ============================================================================

  test("--sort=risk sorts patches by risk score descending", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: append-to-section
    section: "Notes"
    content: "note"
  - op: replace
    old: "a"
    new: "b"
  - op: delete-file
    match: "*.md"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --sort=risk --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Verify patches are sorted by risk score (descending)
    const riskScores = result.safety.patches.map((p: any) => p.riskScore);
    const sortedScores = [...riskScores].sort((a, b) => b - a);
    expect(riskScores).toEqual(sortedScores);
  });

  test("--sort=complexity sorts files by complexity score descending", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "simple.md"
    old: "a"
    new: "b"
  - op: replace
    include: "complex.md"
    old: "a"
    new: "b"
  - op: replace-regex
    include: "complex.md"
    pattern: "c"
    replacement: "d"
  - op: delete-file
    match: "complex.md"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "simple.md"), "# Simple");
    writeFileSync(join(FIXTURES_DIR, "complex.md"), "# Complex");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --sort=complexity --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Verify files are sorted by complexity (descending)
    const complexityScores = result.complexity.files.map((f: any) => f.complexityScore);
    const sortedScores = [...complexityScores].sort((a, b) => b - a);
    expect(complexityScores).toEqual(sortedScores);
  });

  test("--sort=impact sorts patches by affected files descending", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "doc1.md"
    old: "a"
    new: "b"
  - op: replace
    old: "test"
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc1.md"), "# Doc 1\n\ntest");
    writeFileSync(join(FIXTURES_DIR, "doc2.md"), "# Doc 2\n\ntest");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --sort=impact --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Verify patches are sorted by affected files (descending)
    const affectedCounts = result.impact.patches.map((p: any) => p.affectedFiles);
    const sortedCounts = [...affectedCounts].sort((a, b) => b - a);
    expect(affectedCounts).toEqual(sortedCounts);
  });

  test("--sort=coverage sorts files by patch count descending", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    old: "a"
    new: "b"
  - op: replace
    include: "multi.md"
    old: "test"
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "multi.md"), "# Multi\n\na test");
    writeFileSync(join(FIXTURES_DIR, "single.md"), "# Single\n\na");

    const output = execSync(
      `bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --sort=coverage --format=json`,
      {
        encoding: "utf-8",
      },
    );

    const result = JSON.parse(output);

    // Verify files are sorted by patch count (descending)
    const patchCounts = result.complexity.files.map((f: any) => f.patchCount);
    const sortedCounts = [...patchCounts].sort((a, b) => b - a);
    expect(patchCounts).toEqual(sortedCounts);
  });

  // ============================================================================
  // Verbosity Tests
  // ============================================================================

  test("-v flag shows additional details", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} -v`, {
      encoding: "utf-8",
    });

    // -v should show file lists
    expect(output).toContain("Patched files:");
    expect(output).toContain("doc.md");
  });

  test("-vv flag shows more detailed analysis", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} -vv`, {
      encoding: "utf-8",
    });

    // -vv should show per-patch details
    expect(output).toContain("Patch");
    expect(output).toContain("operation:");
  });

  test("-vvv flag shows maximum detail", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} -vvv`, {
      encoding: "utf-8",
    });

    // -vvv should show all details including complexity formula
    expect(output).toContain("complexity");
    expect(output).toContain("score");
  });

  test("-q flag suppresses non-essential output", () => {
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
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} -q`, {
      encoding: "utf-8",
    });

    // -q should show minimal output
    expect(output.length).toBeLessThan(500);
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  test("analyze fails with invalid path", () => {
    try {
      execSync(`bun run ${CLI_PATH} analyze /nonexistent/path`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("not found");
    }
  });

  test("analyze fails with malformed config", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `this is not valid yaml: [unclosed`,
    );

    try {
      execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
    }
  });

  test("analyze handles missing kustomark.yaml", () => {
    // No kustomark.yaml file created

    try {
      execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("kustomark.yaml");
    }
  });

  test("analyze handles invalid risk filter value", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches: []
`,
    );

    try {
      execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --min-risk=invalid`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("Invalid");
    }
  });

  test("analyze handles invalid sort option", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches: []
`,
    );

    try {
      execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --sort=invalid`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain("Invalid");
    }
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  test("analyze handles real-world config with multiple patches and groups", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "docs/**/*.md"
  - "README.md"
patches:
  # Branding updates
  - op: replace
    group: "branding"
    old: "Acme Corp"
    new: "Acme Technologies"
  - op: replace
    group: "branding"
    old: "acme.com"
    new: "acme.tech"

  # Version updates
  - op: replace-regex
    group: "versioning"
    pattern: 'v1\\.\\d+\\.\\d+'
    replacement: "v2.0.0"

  # Documentation fixes
  - op: replace
    group: "docs"
    include: "docs/**/*.md"
    old: "depreciated"
    new: "deprecated"

  # Conditional patches
  - op: set-frontmatter
    group: "metadata"
    include: "docs/**/*.md"
    key: "version"
    value: "2.0"
    condition: "env.RELEASE == 'true'"
`,
    );

    mkdirSync(join(FIXTURES_DIR, "docs"), { recursive: true });
    writeFileSync(
      join(FIXTURES_DIR, "README.md"),
      "# Acme Corp\n\nVisit acme.com\n\nVersion v1.0.0",
    );
    writeFileSync(
      join(FIXTURES_DIR, "docs", "guide.md"),
      "# Guide\n\nAcme Corp guide. Version v1.2.3. This is depreciated.",
    );
    writeFileSync(
      join(FIXTURES_DIR, "docs", "api.md"),
      "# API\n\nAcme Corp API docs. Visit acme.com",
    );

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Verify comprehensive analysis
    expect(result.coverage.totalFiles).toBe(3);
    expect(result.impact.totalPatches).toBe(5);
    expect(result.impact.patches.some((p: any) => p.group === "branding")).toBe(true);
    expect(result.impact.patches.some((p: any) => p.group === "versioning")).toBe(true);
    expect(result.safety.highRiskPatches).toBeGreaterThan(0); // replace-regex
    expect(result.complexity.files.length).toBe(3);
  });

  test("analyze handles config with conditional patches", () => {
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
    new: "prod"
    condition: "env.ENV == 'production'"
  - op: replace
    old: "debug"
    new: "info"
    condition: "env.ENV == 'production'"
  - op: replace
    old: "foo"
    new: "bar"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc\n\ntest debug foo");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // All patches should be analyzed regardless of condition
    expect(result.impact.totalPatches).toBe(3);
    expect(result.safety.totalPatches).toBe(3);
  });

  test("analyze handles config with file operations", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: copy-file
    src: "template.md"
    dest: "copy.md"
  - op: rename-file
    match: "old.md"
    name: "new.md"
  - op: delete-file
    match: "obsolete.md"
  - op: move-file
    src: "src.md"
    dest: "dest.md"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "template.md"), "# Template");
    writeFileSync(join(FIXTURES_DIR, "old.md"), "# Old");
    writeFileSync(join(FIXTURES_DIR, "obsolete.md"), "# Obsolete");
    writeFileSync(join(FIXTURES_DIR, "src.md"), "# Source");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // File operations should be analyzed
    expect(result.impact.totalPatches).toBe(4);
    expect(result.safety.highRiskPatches).toBe(1); // delete-file
    expect(result.safety.mediumRiskPatches).toBe(2); // rename-file, move-file
    expect(result.safety.lowRiskPatches).toBe(1); // copy-file
  });

  test("analyze handles large config with many patches", () => {
    const patches = [];
    for (let i = 0; i < 50; i++) {
      patches.push(`  - op: replace
    old: "text${i}"
    new: "replacement${i}"`);
    }

    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
${patches.join("\n")}
`,
    );

    // Create files with various content
    for (let i = 0; i < 10; i++) {
      const content = Array.from({ length: 10 }, (_, j) => `text${i * 5 + j}`).join(" ");
      writeFileSync(join(FIXTURES_DIR, `doc${i}.md`), `# Doc ${i}\n\n${content}`);
    }

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Verify it handles large configs
    expect(result.impact.totalPatches).toBe(50);
    expect(result.coverage.totalFiles).toBe(10);
    expect(result.complexity.files.length).toBe(10);
    expect(result.safety.patches.length).toBe(50);
  });

  test("analyze handles config with no patches", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches: []
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Should handle empty patches array
    expect(result.coverage.coveragePercentage).toBe(0);
    expect(result.impact.totalPatches).toBe(0);
    expect(result.complexity.averageComplexity).toBe(0);
    expect(result.safety.totalPatches).toBe(0);
  });

  test("analyze handles config with exclude patterns", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: replace
    include: "*.md"
    exclude: "excluded.md"
    old: "test"
    new: "prod"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "included.md"), "# Included\n\ntest");
    writeFileSync(join(FIXTURES_DIR, "excluded.md"), "# Excluded\n\ntest");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });

    const result = JSON.parse(output);

    // Only included.md should be patched
    expect(result.coverage.filesWithPatches).toBe(1);
    expect(result.coverage.patchedFiles).toContain("included.md");
    expect(result.coverage.unpatchedFiles).toContain("excluded.md");
  });

  test("analyze shows recommendations in text format", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
patches:
  - op: delete-file
    match: "*.md"
  - op: replace-regex
    pattern: ".*"
    replacement: "dangerous"
`,
    );

    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Doc");

    const output = execSync(`bun run ${CLI_PATH} analyze ${FIXTURES_DIR}`, {
      encoding: "utf-8",
    });

    // Should show recommendations for high-risk patches
    expect(output).toContain("Recommendation");
    expect(output.toLowerCase()).toContain("high risk");
  });
});
