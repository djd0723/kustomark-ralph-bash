/**
 * Tests for analytics module
 *
 * These tests verify the analytics system for patch operations:
 * - Coverage analysis (files with/without patches)
 * - Impact analysis (patches affecting files)
 * - Complexity analysis (scoring based on patch types)
 * - Safety analysis (risk assessment)
 * - Complete analytics report generation
 */

import { describe, expect, test } from "bun:test";
import type { KustomarkConfig, PatchOperation } from "../../src/core/types.js";
import {
  analyzePatchCoverage,
  analyzePatchImpact,
  analyzeFileComplexity,
  analyzePatchSafety,
  generateAnalyticsReport,
  type CoverageAnalysis,
  type ImpactAnalysis,
  type ComplexityAnalysis,
  type SafetyAnalysis,
  type AnalyticsReport,
  type RiskLevel,
} from "../../src/core/analytics.js";

// ============================================================================
// Coverage Analysis Tests
// ============================================================================

describe("analyzePatchCoverage", () => {
  test("should calculate coverage for files with and without patches", () => {
    const files = new Set(["docs/api.md", "docs/guide.md", "README.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "docs/api.md",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.totalFiles).toBe(3);
    expect(coverage.filesWithPatches).toBe(1);
    expect(coverage.filesWithoutPatches).toBe(2);
    expect(coverage.coveragePercentage).toBeCloseTo(33.33, 2);
    expect(coverage.patchedFiles).toEqual(["docs/api.md"]);
    expect(coverage.unpatchedFiles).toContain("docs/guide.md");
    expect(coverage.unpatchedFiles).toContain("README.md");
  });

  test("should show 100% coverage when all files have patches", () => {
    const files = new Set(["file1.md", "file2.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        old: "test",
        new: "prod",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.coveragePercentage).toBe(100);
    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.filesWithoutPatches).toBe(0);
    expect(coverage.unpatchedFiles).toEqual([]);
  });

  test("should show 0% coverage when no files have patches", () => {
    const files = new Set(["file1.md", "file2.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "nonexistent.md",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.coveragePercentage).toBe(0);
    expect(coverage.filesWithPatches).toBe(0);
    expect(coverage.filesWithoutPatches).toBe(2);
    expect(coverage.patchedFiles).toEqual([]);
  });

  test("should handle empty file set", () => {
    const files = new Set<string>();
    const patches: PatchOperation[] = [
      {
        op: "replace",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.totalFiles).toBe(0);
    expect(coverage.coveragePercentage).toBe(0);
  });

  test("should handle empty patches array", () => {
    const files = new Set(["file1.md", "file2.md"]);
    const patches: PatchOperation[] = [];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(0);
    expect(coverage.filesWithoutPatches).toBe(2);
    expect(coverage.coveragePercentage).toBe(0);
  });

  test("should respect include patterns", () => {
    const files = new Set(["docs/api.md", "docs/guide.md", "README.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "docs/*.md",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("docs/api.md");
    expect(coverage.patchedFiles).toContain("docs/guide.md");
    expect(coverage.unpatchedFiles).toEqual(["README.md"]);
  });

  test("should respect exclude patterns", () => {
    const files = new Set(["file1.md", "file2.md", "file3.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        exclude: "file2.md",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("file1.md");
    expect(coverage.patchedFiles).toContain("file3.md");
    expect(coverage.unpatchedFiles).toEqual(["file2.md"]);
  });

  test("should respect both include and exclude patterns", () => {
    const files = new Set([
      "docs/api.md",
      "docs/internal/notes.md",
      "docs/guide.md",
      "README.md",
    ]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "docs/*.md",
        exclude: "docs/internal/*",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("docs/api.md");
    expect(coverage.patchedFiles).toContain("docs/guide.md");
    expect(coverage.unpatchedFiles).toContain("docs/internal/notes.md");
    expect(coverage.unpatchedFiles).toContain("README.md");
  });

  test("should handle array of include patterns", () => {
    const files = new Set(["docs/api.md", "guides/tutorial.md", "other/file.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: ["docs/*.md", "guides/*.md"],
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("docs/api.md");
    expect(coverage.patchedFiles).toContain("guides/tutorial.md");
    expect(coverage.unpatchedFiles).toEqual(["other/file.md"]);
  });

  test("should count file only once even with multiple applicable patches", () => {
    const files = new Set(["file1.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", old: "foo", new: "bar" },
      { op: "replace", old: "baz", new: "qux" },
      { op: "set-frontmatter", key: "title", value: "Test" },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(1);
    expect(coverage.patchedFiles).toEqual(["file1.md"]);
  });

  test("should handle file operations with match patterns", () => {
    const files = new Set(["old.md", "new.md"]);
    const patches: PatchOperation[] = [
      {
        op: "delete-file",
        match: "old.md",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(1);
    expect(coverage.patchedFiles).toEqual(["old.md"]);
  });

  test("should handle copy-file operation with src pattern", () => {
    const files = new Set(["template.md", "other.md"]);
    const patches: PatchOperation[] = [
      {
        op: "copy-file",
        src: "template.md",
        dest: "copy.md",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(1);
    expect(coverage.patchedFiles).toEqual(["template.md"]);
  });

  test("should handle wildcard patterns correctly", () => {
    const files = new Set(["api.md", "guide.md", "api.txt"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "*.md",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("api.md");
    expect(coverage.patchedFiles).toContain("guide.md");
    expect(coverage.unpatchedFiles).toEqual(["api.txt"]);
  });

  test("should handle double-star glob patterns", () => {
    const files = new Set(["docs/api.md", "docs/sub/guide.md", "other.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "docs/**",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("docs/api.md");
    expect(coverage.patchedFiles).toContain("docs/sub/guide.md");
    expect(coverage.unpatchedFiles).toEqual(["other.md"]);
  });
});

// ============================================================================
// Impact Analysis Tests
// ============================================================================

describe("analyzePatchImpact", () => {
  test("should track files affected per patch", () => {
    const files = new Set(["file1.md", "file2.md", "file3.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "file1.md",
        old: "foo",
        new: "bar",
      },
      {
        op: "replace",
        old: "test",
        new: "prod",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.totalPatches).toBe(2);
    expect(impact.totalAffectedFiles).toBe(3);

    // First patch affects only file1.md
    expect(impact.patches[0].patchIndex).toBe(0);
    expect(impact.patches[0].operation).toBe("replace");
    expect(impact.patches[0].affectedFiles).toBe(1);
    expect(impact.patches[0].files).toEqual(["file1.md"]);
    expect(impact.patches[0].modifications).toBe(1);

    // Second patch affects all files
    expect(impact.patches[1].affectedFiles).toBe(3);
    expect(impact.patches[1].files).toContain("file1.md");
    expect(impact.patches[1].files).toContain("file2.md");
    expect(impact.patches[1].files).toContain("file3.md");
  });

  test("should identify files with multiple patches", () => {
    const files = new Set(["multi.md", "single.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        old: "foo",
        new: "bar",
      },
      {
        op: "replace",
        include: "multi.md",
        old: "baz",
        new: "qux",
      },
      {
        op: "set-frontmatter",
        include: "multi.md",
        key: "title",
        value: "Test",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    // multi.md should be affected by all 3 patches
    expect(impact.multiPatchFiles.get("multi.md")).toBe(3);

    // single.md should not be in multiPatchFiles (only 1 patch)
    expect(impact.multiPatchFiles.has("single.md")).toBe(false);
  });

  test("should include patch group information", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        group: "branding",
        old: "foo",
        new: "bar",
      },
      {
        op: "replace",
        group: "versioning",
        old: "v1",
        new: "v2",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.patches[0].group).toBe("branding");
    expect(impact.patches[1].group).toBe("versioning");
  });

  test("should handle empty file set", () => {
    const files = new Set<string>();
    const patches: PatchOperation[] = [
      {
        op: "replace",
        old: "foo",
        new: "bar",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.totalPatches).toBe(1);
    expect(impact.totalAffectedFiles).toBe(0);
    expect(impact.patches[0].affectedFiles).toBe(0);
  });

  test("should handle empty patches array", () => {
    const files = new Set(["file1.md"]);
    const patches: PatchOperation[] = [];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.totalPatches).toBe(0);
    expect(impact.totalAffectedFiles).toBe(0);
    expect(impact.patches).toEqual([]);
  });

  test("should track all operation types", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", old: "a", new: "b" },
      { op: "replace-regex", pattern: "c", replacement: "d" },
      { op: "set-frontmatter", key: "title", value: "Test" },
      { op: "delete-file", match: "file.md" },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.patches[0].operation).toBe("replace");
    expect(impact.patches[1].operation).toBe("replace-regex");
    expect(impact.patches[2].operation).toBe("set-frontmatter");
    expect(impact.patches[3].operation).toBe("delete-file");
  });

  test("should handle patches with no matching files", () => {
    const files = new Set(["file1.md", "file2.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "nonexistent.md",
        old: "foo",
        new: "bar",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.patches[0].affectedFiles).toBe(0);
    expect(impact.patches[0].files).toEqual([]);
    expect(impact.totalAffectedFiles).toBe(0);
  });

  test("should count unique files across patches", () => {
    const files = new Set(["file1.md", "file2.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "file1.md",
        old: "foo",
        new: "bar",
      },
      {
        op: "replace",
        include: "file1.md",
        old: "baz",
        new: "qux",
      },
      {
        op: "replace",
        include: "file2.md",
        old: "test",
        new: "prod",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    // Both file1 and file2 are affected
    expect(impact.totalAffectedFiles).toBe(2);
  });

  test("should handle file operations correctly", () => {
    const files = new Set(["old.md", "template.md"]);
    const patches: PatchOperation[] = [
      {
        op: "rename-file",
        match: "old.md",
        name: "new.md",
      },
      {
        op: "copy-file",
        src: "template.md",
        dest: "copy.md",
      },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.patches[0].operation).toBe("rename-file");
    expect(impact.patches[0].affectedFiles).toBe(1);
    expect(impact.patches[0].files).toEqual(["old.md"]);

    expect(impact.patches[1].operation).toBe("copy-file");
    expect(impact.patches[1].affectedFiles).toBe(1);
    expect(impact.patches[1].files).toEqual(["template.md"]);
  });

  test("should handle large number of patches efficiently", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = Array.from({ length: 100 }, (_, i) => ({
      op: "replace" as const,
      old: `pattern${i}`,
      new: `replacement${i}`,
    }));

    const impact = analyzePatchImpact(files, patches);

    expect(impact.totalPatches).toBe(100);
    expect(impact.multiPatchFiles.get("file.md")).toBe(100);
  });
});

// ============================================================================
// Complexity Analysis Tests
// ============================================================================

describe("analyzeFileComplexity", () => {
  test("should calculate complexity score based on formula", () => {
    const files = new Set(["simple.md", "complex.md"]);
    const patches: PatchOperation[] = [
      // simple.md: 1 patch, 1 operation type, 0 high-risk
      {
        op: "replace",
        include: "simple.md",
        old: "foo",
        new: "bar",
      },
      // complex.md: 3 patches, 3 operation types, 2 high-risk
      {
        op: "replace",
        include: "complex.md",
        old: "foo",
        new: "bar",
      },
      {
        op: "replace-regex",
        include: "complex.md",
        pattern: "test",
        replacement: "prod",
      },
      {
        op: "delete-file",
        match: "complex.md",
      },
    ];

    const complexity = analyzeFileComplexity(files, patches);

    const simpleFile = complexity.files.find((f) => f.file === "simple.md");
    const complexFile = complexity.files.find((f) => f.file === "complex.md");

    // simple.md: (1*2) + (1*1.5) + (0*3) = 3.5
    expect(simpleFile?.patchCount).toBe(1);
    expect(simpleFile?.uniqueOperationTypes).toBe(1);
    expect(simpleFile?.highRiskOperations).toBe(0);
    expect(simpleFile?.complexityScore).toBe(3.5);
    expect(simpleFile?.operations).toEqual(["replace"]);

    // complex.md: (3*2) + (3*1.5) + (2*3) = 16.5
    expect(complexFile?.patchCount).toBe(3);
    expect(complexFile?.uniqueOperationTypes).toBe(3);
    expect(complexFile?.highRiskOperations).toBe(2);
    expect(complexFile?.complexityScore).toBe(16.5);
    expect(complexFile?.operations).toContain("replace");
    expect(complexFile?.operations).toContain("replace-regex");
    expect(complexFile?.operations).toContain("delete-file");
  });

  test("should calculate min, max, and average complexity", () => {
    const files = new Set(["low.md", "medium.md", "high.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", include: "low.md", old: "a", new: "b" }, // 3.5
      { op: "replace", include: "medium.md", old: "a", new: "b" },
      { op: "replace", include: "medium.md", old: "c", new: "d" }, // 5.5
      { op: "replace", include: "high.md", old: "a", new: "b" },
      { op: "replace-regex", include: "high.md", pattern: "c", replacement: "d" },
      { op: "delete-file", match: "high.md" }, // 16.5
    ];

    const complexity = analyzeFileComplexity(files, patches);

    expect(complexity.totalFiles).toBe(3);
    expect(complexity.minComplexity).toBe(3.5);
    expect(complexity.maxComplexity).toBe(16.5);
    expect(complexity.averageComplexity).toBe((3.5 + 5.5 + 16.5) / 3);
  });

  test("should sort files by complexity descending", () => {
    const files = new Set(["low.md", "high.md", "medium.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", include: "low.md", old: "a", new: "b" },
      { op: "replace", include: "high.md", old: "a", new: "b" },
      { op: "replace-regex", include: "high.md", pattern: "c", replacement: "d" },
      { op: "delete-file", match: "high.md" },
      { op: "replace", include: "medium.md", old: "a", new: "b" },
      { op: "replace", include: "medium.md", old: "c", new: "d" },
    ];

    const complexity = analyzeFileComplexity(files, patches);

    expect(complexity.topComplexFiles[0].file).toBe("high.md");
    expect(complexity.topComplexFiles[1].file).toBe("medium.md");
    expect(complexity.topComplexFiles[2].file).toBe("low.md");

    // Verify sorting is correct
    for (let i = 0; i < complexity.topComplexFiles.length - 1; i++) {
      expect(complexity.topComplexFiles[i].complexityScore).toBeGreaterThanOrEqual(
        complexity.topComplexFiles[i + 1].complexityScore,
      );
    }
  });

  test("should handle files with no patches", () => {
    const files = new Set(["patched.md", "unpatched.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "patched.md",
        old: "foo",
        new: "bar",
      },
    ];

    const complexity = analyzeFileComplexity(files, patches);

    const unpatchedFile = complexity.files.find((f) => f.file === "unpatched.md");
    expect(unpatchedFile?.patchCount).toBe(0);
    expect(unpatchedFile?.complexityScore).toBe(0);
    expect(unpatchedFile?.operations).toEqual([]);
  });

  test("should handle empty file set", () => {
    const files = new Set<string>();
    const patches: PatchOperation[] = [
      {
        op: "replace",
        old: "foo",
        new: "bar",
      },
    ];

    const complexity = analyzeFileComplexity(files, patches);

    expect(complexity.totalFiles).toBe(0);
    expect(complexity.averageComplexity).toBe(0);
    expect(complexity.minComplexity).toBe(0);
    expect(complexity.maxComplexity).toBe(0);
    expect(complexity.files).toEqual([]);
  });

  test("should count unique operation types correctly", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", old: "a", new: "b" },
      { op: "replace", old: "c", new: "d" }, // Same type, doesn't increase count
      { op: "set-frontmatter", key: "title", value: "Test" }, // New type
    ];

    const complexity = analyzeFileComplexity(files, patches);

    const file = complexity.files[0];
    expect(file.patchCount).toBe(3);
    expect(file.uniqueOperationTypes).toBe(2);
    expect(file.operations).toContain("replace");
    expect(file.operations).toContain("set-frontmatter");
  });

  test("should identify all high-risk operations", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" },
      { op: "remove-section", include: "file.md", section: "Test" },
      { op: "replace-regex", pattern: ".*", replacement: "x" },
      { op: "remove-frontmatter", key: "title" },
      { op: "replace", old: "a", new: "b" }, // Not high-risk
    ];

    const complexity = analyzeFileComplexity(files, patches);

    const file = complexity.files[0];
    expect(file.highRiskOperations).toBe(4);
  });

  test("should handle files with identical complexity scores", () => {
    const files = new Set(["file1.md", "file2.md", "file3.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", old: "a", new: "b" }, // Applies to all
    ];

    const complexity = analyzeFileComplexity(files, patches);

    // All files should have same complexity
    expect(complexity.minComplexity).toBe(3.5);
    expect(complexity.maxComplexity).toBe(3.5);
    expect(complexity.averageComplexity).toBe(3.5);
  });

  test("should handle large number of files efficiently", () => {
    const files = new Set(
      Array.from({ length: 1000 }, (_, i) => `file${i}.md`),
    );
    const patches: PatchOperation[] = [
      {
        op: "set-frontmatter",
        key: "generated",
        value: true,
      },
    ];

    const complexity = analyzeFileComplexity(files, patches);

    expect(complexity.totalFiles).toBe(1000);
    expect(complexity.files).toHaveLength(1000);
  });
});

// ============================================================================
// Safety Analysis Tests
// ============================================================================

describe("analyzePatchSafety", () => {
  test("should categorize patches by risk level", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" }, // High
      { op: "replace-regex", pattern: "test", replacement: "prod" }, // High
      { op: "replace", old: "foo", new: "bar" }, // Medium
      { op: "rename-file", match: "old.md", name: "new.md" }, // Medium
      { op: "append-to-section", section: "Notes", content: "test" }, // Low
      { op: "set-frontmatter", key: "title", value: "Test" }, // Low
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.totalPatches).toBe(6);
    expect(safety.highRiskPatches).toBe(2);
    expect(safety.mediumRiskPatches).toBe(2);
    expect(safety.lowRiskPatches).toBe(2);
  });

  test("should assign correct risk scores", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" },
      { op: "replace-regex", pattern: "test", replacement: "prod" },
      { op: "remove-section", section: "Test" },
      { op: "replace", old: "a", new: "b" },
      { op: "rename-file", match: "old.md", name: "new.md" },
      { op: "move-file", src: "a.md", dest: "b.md" },
      { op: "set-frontmatter", key: "title", value: "Test" },
      { op: "copy-file", src: "a.md", dest: "b.md" },
      { op: "append-to-section", section: "Notes", content: "test" },
    ];

    const safety = analyzePatchSafety(files, patches);

    // High risk
    expect(safety.patches[0].riskScore).toBe(10); // delete-file
    expect(safety.patches[1].riskScore).toBe(9); // replace-regex
    expect(safety.patches[2].riskScore).toBe(8); // remove-section

    // Medium risk
    expect(safety.patches[3].riskScore).toBe(5); // replace
    expect(safety.patches[4].riskScore).toBe(6); // rename-file
    expect(safety.patches[5].riskScore).toBe(6); // move-file

    // Low risk
    expect(safety.patches[6].riskScore).toBe(2); // set-frontmatter
    expect(safety.patches[7].riskScore).toBe(3); // copy-file
    expect(safety.patches[8].riskScore).toBe(1); // append-to-section
  });

  test("should include risk reasons", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" },
      { op: "replace", old: "a", new: "b" },
      { op: "append-to-section", section: "Notes", content: "test" },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.patches[0].riskReason).toContain("destructive");
    expect(safety.patches[1].riskReason).toContain("modifies");
    expect(safety.patches[2].riskReason).toContain("adds content");
  });

  test("should sort patches by risk score descending", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "append-to-section", section: "Notes", content: "test" },
      { op: "replace", old: "a", new: "b" },
      { op: "delete-file", match: "file.md" },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.highestRiskPatches[0].operation).toBe("delete-file");
    expect(safety.highestRiskPatches[1].operation).toBe("replace");
    expect(safety.highestRiskPatches[2].operation).toBe("append-to-section");

    // Verify sorting is correct
    for (let i = 0; i < safety.highestRiskPatches.length - 1; i++) {
      expect(safety.highestRiskPatches[i].riskScore).toBeGreaterThanOrEqual(
        safety.highestRiskPatches[i + 1].riskScore,
      );
    }
  });

  test("should calculate average risk score", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" }, // 10
      { op: "replace", old: "a", new: "b" }, // 5
      { op: "append-to-section", section: "Notes", content: "test" }, // 1
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.averageRiskScore).toBe((10 + 5 + 1) / 3);
  });

  test("should count affected files per patch", () => {
    const files = new Set(["file1.md", "file2.md", "file3.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "file1.md",
        old: "foo",
        new: "bar",
      },
      {
        op: "replace",
        old: "test",
        new: "prod",
      },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.patches[0].affectedFiles).toBe(1);
    expect(safety.patches[1].affectedFiles).toBe(3);
  });

  test("should include patch group information", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        group: "branding",
        old: "foo",
        new: "bar",
      },
      {
        op: "delete-file",
        group: "cleanup",
        match: "old.md",
      },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.patches[0].group).toBe("branding");
    expect(safety.patches[1].group).toBe("cleanup");
  });

  test("should handle empty patches array", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.totalPatches).toBe(0);
    expect(safety.averageRiskScore).toBe(0);
    expect(safety.patches).toEqual([]);
  });

  test("should handle all destructive operations as high risk", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" },
      { op: "remove-section", section: "Test" },
      { op: "replace-regex", pattern: ".*", replacement: "x" },
      { op: "remove-frontmatter", key: "title" },
      { op: "remove-table-row", table: 0, row: 0 },
      { op: "remove-table-column", table: 0, column: 0 },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.highRiskPatches).toBe(6);
    expect(safety.patches.every((p) => p.riskLevel === "high")).toBe(true);
  });

  test("should handle all modification operations as medium risk", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", old: "a", new: "b" },
      { op: "replace-section", section: "Test", content: "New" },
      { op: "replace-between", start: "BEGIN", end: "END", content: "X" },
      { op: "rename-file", match: "old.md", name: "new.md" },
      { op: "move-file", src: "a.md", dest: "b.md" },
      { op: "replace-line", line: 1, content: "new" },
      { op: "rename-header", old: "Old", new: "New" },
      { op: "move-section", section: "A", destination: "B" },
      { op: "change-section-level", section: "Test", newLevel: 2 },
      { op: "delete-between", start: "BEGIN", end: "END" },
      { op: "rename-frontmatter", oldKey: "old", newKey: "new" },
      { op: "merge-frontmatter", source: {}, destination: {} },
      { op: "replace-table-cell", table: 0, row: 0, column: 0, value: "x" },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.mediumRiskPatches).toBe(13);
    expect(safety.patches.every((p) => p.riskLevel === "medium")).toBe(true);
  });

  test("should handle all additive operations as low risk", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "append-to-section", section: "Notes", content: "test" },
      { op: "prepend-to-section", section: "Notes", content: "test" },
      { op: "set-frontmatter", key: "title", value: "Test" },
      { op: "copy-file", src: "a.md", dest: "b.md" },
      { op: "insert-after-line", line: 1, content: "new" },
      { op: "insert-before-line", line: 1, content: "new" },
      { op: "add-table-row", table: 0, row: ["a", "b"] },
      { op: "add-table-column", table: 0, column: ["x"] },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.lowRiskPatches).toBe(8);
    expect(safety.patches.every((p) => p.riskLevel === "low")).toBe(true);
  });

  test("should handle unknown operations as medium risk", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "unknown-operation" as any },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.patches[0].riskLevel).toBe("medium");
    expect(safety.patches[0].riskScore).toBe(5);
    expect(safety.patches[0].riskReason).toContain("unknown operation");
  });

  test("should include patch index", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", old: "a", new: "b" },
      { op: "replace", old: "c", new: "d" },
      { op: "replace", old: "e", new: "f" },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.patches[0].patchIndex).toBe(0);
    expect(safety.patches[1].patchIndex).toBe(1);
    expect(safety.patches[2].patchIndex).toBe(2);
  });
});

// ============================================================================
// Complete Analytics Report Tests
// ============================================================================

describe("generateAnalyticsReport", () => {
  test("should generate complete analytics report", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
      patches: [
        {
          op: "replace",
          include: "api.md",
          old: "foo",
          new: "bar",
        },
        {
          op: "delete-file",
          match: "old.md",
        },
      ],
    };
    const files = new Set(["api.md", "guide.md", "old.md"]);

    const report = generateAnalyticsReport(config, files);

    // Verify all sections are present
    expect(report).toHaveProperty("coverage");
    expect(report).toHaveProperty("impact");
    expect(report).toHaveProperty("complexity");
    expect(report).toHaveProperty("safety");
    expect(report).toHaveProperty("timestamp");

    // Verify timestamp is ISO 8601
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("should integrate all analysis results correctly", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
      patches: [
        {
          op: "replace",
          old: "test",
          new: "prod",
        },
      ],
    };
    const files = new Set(["file1.md", "file2.md"]);

    const report = generateAnalyticsReport(config, files);

    // Coverage
    expect(report.coverage.totalFiles).toBe(2);
    expect(report.coverage.filesWithPatches).toBe(2);

    // Impact
    expect(report.impact.totalPatches).toBe(1);
    expect(report.impact.totalAffectedFiles).toBe(2);

    // Complexity
    expect(report.complexity.totalFiles).toBe(2);
    expect(report.complexity.files).toHaveLength(2);

    // Safety
    expect(report.safety.totalPatches).toBe(1);
    expect(report.safety.mediumRiskPatches).toBe(1);
  });

  test("should handle config with no patches", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
      patches: [],
    };
    const files = new Set(["file.md"]);

    const report = generateAnalyticsReport(config, files);

    expect(report.coverage.coveragePercentage).toBe(0);
    expect(report.impact.totalPatches).toBe(0);
    expect(report.complexity.averageComplexity).toBe(0);
    expect(report.safety.totalPatches).toBe(0);
  });

  test("should handle config with undefined patches", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
    };
    const files = new Set(["file.md"]);

    const report = generateAnalyticsReport(config, files);

    expect(report.coverage.coveragePercentage).toBe(0);
    expect(report.impact.totalPatches).toBe(0);
  });

  test("should handle empty file set", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
      patches: [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ],
    };
    const files = new Set<string>();

    const report = generateAnalyticsReport(config, files);

    expect(report.coverage.totalFiles).toBe(0);
    expect(report.impact.totalAffectedFiles).toBe(0);
    expect(report.complexity.totalFiles).toBe(0);
  });

  test("should generate valid report for real-world scenario", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["docs/*.md", "README.md"],
      output: "output",
      patches: [
        {
          op: "replace",
          group: "branding",
          old: "Acme Corp",
          new: "Acme Tech",
        },
        {
          op: "replace-regex",
          group: "versioning",
          pattern: "v1\\.\\d+\\.\\d+",
          replacement: "v2.0.0",
        },
        {
          op: "set-frontmatter",
          group: "metadata",
          include: "docs/*.md",
          key: "version",
          value: "2.0",
        },
        {
          op: "delete-file",
          group: "cleanup",
          match: "docs/deprecated.md",
        },
      ],
    };
    const files = new Set([
      "README.md",
      "docs/api.md",
      "docs/guide.md",
      "docs/deprecated.md",
    ]);

    const report = generateAnalyticsReport(config, files);

    // Verify comprehensive metrics
    expect(report.coverage.totalFiles).toBe(4);
    expect(report.coverage.coveragePercentage).toBeGreaterThan(0);

    expect(report.impact.totalPatches).toBe(4);
    expect(report.impact.totalAffectedFiles).toBeGreaterThan(0);

    expect(report.complexity.files).toHaveLength(4);
    expect(report.complexity.topComplexFiles).toHaveLength(4);

    expect(report.safety.highRiskPatches).toBeGreaterThan(0);
    expect(report.safety.averageRiskScore).toBeGreaterThan(0);
  });

  test("should maintain consistency across all analyses", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
      patches: [
        {
          op: "replace",
          include: "file1.md",
          old: "foo",
          new: "bar",
        },
        {
          op: "replace",
          old: "test",
          new: "prod",
        },
      ],
    };
    const files = new Set(["file1.md", "file2.md"]);

    const report = generateAnalyticsReport(config, files);

    // Patch count should be consistent
    expect(report.impact.totalPatches).toBe(2);
    expect(report.safety.totalPatches).toBe(2);

    // File count should be consistent
    expect(report.coverage.totalFiles).toBe(2);
    expect(report.complexity.totalFiles).toBe(2);
  });

  test("should generate timestamp in ISO 8601 format", () => {
    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["*.md"],
      output: "output",
    };
    const files = new Set(["file.md"]);

    const report = generateAnalyticsReport(config, files);

    // Verify ISO 8601 format
    expect(report.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    // Verify it's a valid date
    const date = new Date(report.timestamp);
    expect(date.toString()).not.toBe("Invalid Date");
  });

  test("should handle large-scale configuration", () => {
    const patches: PatchOperation[] = Array.from({ length: 50 }, (_, i) => ({
      op: "replace" as const,
      old: `pattern${i}`,
      new: `replacement${i}`,
    }));

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["**/*.md"],
      output: "output",
      patches,
    };

    const files = new Set(
      Array.from({ length: 100 }, (_, i) => `file${i}.md`),
    );

    const report = generateAnalyticsReport(config, files);

    expect(report.impact.totalPatches).toBe(50);
    expect(report.coverage.totalFiles).toBe(100);
    expect(report.complexity.files).toHaveLength(100);
    expect(report.safety.patches).toHaveLength(50);
  });
});

// ============================================================================
// Edge Cases and Error Conditions
// ============================================================================

describe("edge cases and error conditions", () => {
  test("should handle special characters in file paths", () => {
    const files = new Set([
      "file with spaces.md",
      "file-with-dashes.md",
      "file_with_underscores.md",
      "file.multiple.dots.md",
    ]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        old: "test",
        new: "prod",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.totalFiles).toBe(4);
    expect(coverage.filesWithPatches).toBe(4);
  });

  test("should handle deeply nested glob patterns", () => {
    const files = new Set([
      "a/b/c/d/e/file.md",
      "a/b/file.md",
      "file.md",
    ]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: "a/**/*.md",
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("a/b/c/d/e/file.md");
    expect(coverage.patchedFiles).toContain("a/b/file.md");
    expect(coverage.unpatchedFiles).toEqual(["file.md"]);
  });

  test("should handle patches with complex include/exclude combinations", () => {
    const files = new Set([
      "docs/public/api.md",
      "docs/internal/notes.md",
      "docs/public/guide.md",
      "README.md",
    ]);
    const patches: PatchOperation[] = [
      {
        op: "replace",
        include: ["docs/*/*.md", "*.md"],
        exclude: ["docs/internal/*", "README.md"],
        old: "foo",
        new: "bar",
      },
    ];

    const coverage = analyzePatchCoverage(files, patches);

    expect(coverage.filesWithPatches).toBe(2);
    expect(coverage.patchedFiles).toContain("docs/public/api.md");
    expect(coverage.patchedFiles).toContain("docs/public/guide.md");
    expect(coverage.unpatchedFiles).toContain("docs/internal/notes.md");
    expect(coverage.unpatchedFiles).toContain("README.md");
  });

  test("should handle very high complexity scores", () => {
    const files = new Set(["ultra-complex.md"]);
    const patches: PatchOperation[] = Array.from({ length: 20 }, (_, i) => ({
      op: (i % 2 === 0 ? "delete-file" : "replace") as any,
      match: "ultra-complex.md",
      old: `pattern${i}`,
      new: `replacement${i}`,
    }));

    const complexity = analyzeFileComplexity(files, patches);

    const file = complexity.files[0];
    expect(file.patchCount).toBe(20);
    expect(file.complexityScore).toBeGreaterThan(50);
  });

  test("should handle zero-risk scenario (all low-risk patches)", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "append-to-section", section: "Notes", content: "test" },
      { op: "set-frontmatter", key: "title", value: "Test" },
      { op: "copy-file", src: "a.md", dest: "b.md" },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.highRiskPatches).toBe(0);
    expect(safety.mediumRiskPatches).toBe(0);
    expect(safety.lowRiskPatches).toBe(3);
    expect(safety.averageRiskScore).toBeLessThan(3);
  });

  test("should handle maximum-risk scenario (all high-risk patches)", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = [
      { op: "delete-file", match: "file.md" },
      { op: "replace-regex", pattern: ".*", replacement: "x" },
      { op: "remove-section", section: "Test" },
    ];

    const safety = analyzePatchSafety(files, patches);

    expect(safety.highRiskPatches).toBe(3);
    expect(safety.mediumRiskPatches).toBe(0);
    expect(safety.lowRiskPatches).toBe(0);
    expect(safety.averageRiskScore).toBeGreaterThan(8);
  });

  test("should handle patches affecting same file multiple times", () => {
    const files = new Set(["file.md"]);
    const patches: PatchOperation[] = Array.from({ length: 10 }, (_, i) => ({
      op: "replace" as const,
      old: `pattern${i}`,
      new: `replacement${i}`,
    }));

    const impact = analyzePatchImpact(files, patches);

    expect(impact.multiPatchFiles.get("file.md")).toBe(10);
  });

  test("should handle completely disjoint patch sets", () => {
    const files = new Set(["file1.md", "file2.md", "file3.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", include: "file1.md", old: "a", new: "b" },
      { op: "replace", include: "file2.md", old: "c", new: "d" },
      { op: "replace", include: "file3.md", old: "e", new: "f" },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.totalAffectedFiles).toBe(3);
    expect(impact.multiPatchFiles.size).toBe(0);
  });

  test("should handle overlapping but not identical patch sets", () => {
    const files = new Set(["file1.md", "file2.md", "file3.md"]);
    const patches: PatchOperation[] = [
      { op: "replace", include: ["file1.md", "file2.md"], old: "a", new: "b" },
      { op: "replace", include: ["file2.md", "file3.md"], old: "c", new: "d" },
    ];

    const impact = analyzePatchImpact(files, patches);

    expect(impact.totalAffectedFiles).toBe(3);
    expect(impact.multiPatchFiles.get("file2.md")).toBe(2);
    expect(impact.multiPatchFiles.has("file1.md")).toBe(false);
    expect(impact.multiPatchFiles.has("file3.md")).toBe(false);
  });

  test("should handle performance with many files and patches", () => {
    const files = new Set(
      Array.from({ length: 1000 }, (_, i) => `file${i}.md`),
    );
    const patches: PatchOperation[] = Array.from({ length: 100 }, (_, i) => ({
      op: "replace" as const,
      old: `pattern${i}`,
      new: `replacement${i}`,
    }));

    const config: KustomarkConfig = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      resources: ["**/*.md"],
      output: "output",
      patches,
    };

    const startTime = performance.now();
    const report = generateAnalyticsReport(config, files);
    const endTime = performance.now();

    expect(report.coverage.totalFiles).toBe(1000);
    expect(report.impact.totalPatches).toBe(100);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});
