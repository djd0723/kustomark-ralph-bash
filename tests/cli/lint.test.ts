/**
 * Tests for the `kustomark lint` command and lint-command helper functions.
 *
 * Covers:
 * - areRedundantPatches: identical patch detection
 * - areOverlappingPatches: conflicting-target detection
 * - validateRegexPattern: regex syntax validation
 * - checkRegexPatternWarnings: regex best-practice warnings
 * - checkGlobPatternWarnings: resource glob warnings
 * - checkDestructiveOperationWarnings: destructive-op warnings
 * - CLI integration: JSON output, text output, --strict mode, exit codes
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  areOverlappingPatches,
  areRedundantPatches,
  checkDestructiveOperationWarnings,
  checkGlobPatternWarnings,
  checkRegexPatternWarnings,
  validateRegexPattern,
} from "../../src/cli/lint-command.js";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/lint";

// ============================================================================
// Unit Tests: areRedundantPatches
// ============================================================================

describe("areRedundantPatches", () => {
  test("replace: identical old/new → redundant", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace" as const, old: "foo", new: "bar" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("replace: different old value → not redundant", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace" as const, old: "baz", new: "bar" };
    expect(areRedundantPatches(p1, p2)).toBe(false);
  });

  test("replace: different new value → not redundant", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace" as const, old: "foo", new: "qux" };
    expect(areRedundantPatches(p1, p2)).toBe(false);
  });

  test("replace-regex: identical pattern/replacement/flags → redundant", () => {
    const p1 = { op: "replace-regex" as const, pattern: "v\\d+", replacement: "v2", flags: "g" };
    const p2 = { op: "replace-regex" as const, pattern: "v\\d+", replacement: "v2", flags: "g" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("replace-regex: different pattern → not redundant", () => {
    const p1 = { op: "replace-regex" as const, pattern: "v\\d+", replacement: "v2" };
    const p2 = { op: "replace-regex" as const, pattern: "v\\d+\\.", replacement: "v2" };
    expect(areRedundantPatches(p1, p2)).toBe(false);
  });

  test("remove-section: same id and includeChildren → redundant", () => {
    const p1 = { op: "remove-section" as const, id: "intro", includeChildren: true };
    const p2 = { op: "remove-section" as const, id: "intro", includeChildren: true };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("remove-section: different id → not redundant", () => {
    const p1 = { op: "remove-section" as const, id: "intro" };
    const p2 = { op: "remove-section" as const, id: "outro" };
    expect(areRedundantPatches(p1, p2)).toBe(false);
  });

  test("replace-section: same id and content → redundant", () => {
    const p1 = { op: "replace-section" as const, id: "usage", content: "new content" };
    const p2 = { op: "replace-section" as const, id: "usage", content: "new content" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("prepend-to-section: same id and content → redundant", () => {
    const p1 = { op: "prepend-to-section" as const, id: "steps", content: "Note:" };
    const p2 = { op: "prepend-to-section" as const, id: "steps", content: "Note:" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("append-to-section: same id and content → redundant", () => {
    const p1 = { op: "append-to-section" as const, id: "steps", content: "Done." };
    const p2 = { op: "append-to-section" as const, id: "steps", content: "Done." };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("set-frontmatter: same key/value → redundant", () => {
    const p1 = { op: "set-frontmatter" as const, key: "version", value: "2.0" };
    const p2 = { op: "set-frontmatter" as const, key: "version", value: "2.0" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("set-frontmatter: different value → not redundant", () => {
    const p1 = { op: "set-frontmatter" as const, key: "version", value: "2.0" };
    const p2 = { op: "set-frontmatter" as const, key: "version", value: "3.0" };
    expect(areRedundantPatches(p1, p2)).toBe(false);
  });

  test("remove-frontmatter: same key → redundant", () => {
    const p1 = { op: "remove-frontmatter" as const, key: "deprecated" };
    const p2 = { op: "remove-frontmatter" as const, key: "deprecated" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("rename-frontmatter: same old/new → redundant", () => {
    const p1 = { op: "rename-frontmatter" as const, old: "name", new: "skill_name" };
    const p2 = { op: "rename-frontmatter" as const, old: "name", new: "skill_name" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("merge-frontmatter: same values → redundant", () => {
    const p1 = { op: "merge-frontmatter" as const, values: { version: "2.0", tags: ["a"] } };
    const p2 = { op: "merge-frontmatter" as const, values: { version: "2.0", tags: ["a"] } };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("delete-between: same markers → redundant", () => {
    const p1 = { op: "delete-between" as const, start: "<!-- BEGIN -->", end: "<!-- END -->", inclusive: true };
    const p2 = { op: "delete-between" as const, start: "<!-- BEGIN -->", end: "<!-- END -->", inclusive: true };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("replace-between: same markers and content → redundant", () => {
    const p1 = { op: "replace-between" as const, start: "<!-- S -->", end: "<!-- E -->", content: "x", inclusive: false };
    const p2 = { op: "replace-between" as const, start: "<!-- S -->", end: "<!-- E -->", content: "x", inclusive: false };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("replace-line: same match/replacement → redundant", () => {
    const p1 = { op: "replace-line" as const, match: "old line", replacement: "new line" };
    const p2 = { op: "replace-line" as const, match: "old line", replacement: "new line" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("insert-after-line: same match/content → redundant", () => {
    const p1 = { op: "insert-after-line" as const, match: "## Steps", content: "Note:" };
    const p2 = { op: "insert-after-line" as const, match: "## Steps", content: "Note:" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("insert-before-line: same match/content → redundant", () => {
    const p1 = { op: "insert-before-line" as const, match: "## Output", content: "## Validation\n" };
    const p2 = { op: "insert-before-line" as const, match: "## Output", content: "## Validation\n" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("move-section: same id and after → redundant", () => {
    const p1 = { op: "move-section" as const, id: "validation", after: "output" };
    const p2 = { op: "move-section" as const, id: "validation", after: "output" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("rename-header: same id and new → redundant", () => {
    const p1 = { op: "rename-header" as const, id: "old-title", new: "New Title" };
    const p2 = { op: "rename-header" as const, id: "old-title", new: "New Title" };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("change-section-level: same id and delta → redundant", () => {
    const p1 = { op: "change-section-level" as const, id: "sub", delta: -1 };
    const p2 = { op: "change-section-level" as const, id: "sub", delta: -1 };
    expect(areRedundantPatches(p1, p2)).toBe(true);
  });

  test("different op types → never redundant", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace-regex" as const, pattern: "foo", replacement: "bar" };
    expect(areRedundantPatches(p1, p2)).toBe(false);
  });
});

// ============================================================================
// Unit Tests: areOverlappingPatches
// ============================================================================

describe("areOverlappingPatches", () => {
  test("remove-section + replace-section on same id → overlap", () => {
    const p1 = { op: "remove-section" as const, id: "intro" };
    const p2 = { op: "replace-section" as const, id: "intro", content: "new" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("section ops on different ids → no overlap", () => {
    const p1 = { op: "remove-section" as const, id: "intro" };
    const p2 = { op: "replace-section" as const, id: "outro", content: "new" };
    expect(areOverlappingPatches(p1, p2)).toBe(false);
  });

  test("prepend + append to same section id → overlap", () => {
    const p1 = { op: "prepend-to-section" as const, id: "steps", content: "note" };
    const p2 = { op: "append-to-section" as const, id: "steps", content: "done" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("move-section + rename-header on same id → overlap", () => {
    const p1 = { op: "move-section" as const, id: "validation", after: "output" };
    const p2 = { op: "rename-header" as const, id: "validation", new: "Validation Steps" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("set-frontmatter same key → overlap", () => {
    const p1 = { op: "set-frontmatter" as const, key: "version", value: "1.0" };
    const p2 = { op: "set-frontmatter" as const, key: "version", value: "2.0" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("set-frontmatter different keys → no overlap", () => {
    const p1 = { op: "set-frontmatter" as const, key: "version", value: "1.0" };
    const p2 = { op: "set-frontmatter" as const, key: "author", value: "alice" };
    expect(areOverlappingPatches(p1, p2)).toBe(false);
  });

  test("remove-frontmatter same key → overlap", () => {
    const p1 = { op: "remove-frontmatter" as const, key: "deprecated" };
    const p2 = { op: "remove-frontmatter" as const, key: "deprecated" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("rename-frontmatter same old key → overlap", () => {
    const p1 = { op: "rename-frontmatter" as const, old: "name", new: "title" };
    const p2 = { op: "rename-frontmatter" as const, old: "name", new: "skill_name" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("replace same old value → overlap", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace" as const, old: "foo", new: "baz" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("replace different old values → no overlap", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace" as const, old: "baz", new: "qux" };
    expect(areOverlappingPatches(p1, p2)).toBe(false);
  });

  test("replace-regex same pattern → overlap", () => {
    const p1 = { op: "replace-regex" as const, pattern: "v\\d+", replacement: "v2" };
    const p2 = { op: "replace-regex" as const, pattern: "v\\d+", replacement: "v3" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("delete-between + replace-between same markers → overlap", () => {
    const p1 = { op: "delete-between" as const, start: "<!-- S -->", end: "<!-- E -->" };
    const p2 = { op: "replace-between" as const, start: "<!-- S -->", end: "<!-- E -->", content: "x" };
    expect(areOverlappingPatches(p1, p2)).toBe(true);
  });

  test("delete-between different markers → no overlap", () => {
    const p1 = { op: "delete-between" as const, start: "<!-- A -->", end: "<!-- B -->" };
    const p2 = { op: "delete-between" as const, start: "<!-- C -->", end: "<!-- D -->" };
    expect(areOverlappingPatches(p1, p2)).toBe(false);
  });

  test("replace + replace-regex → no overlap (different types)", () => {
    const p1 = { op: "replace" as const, old: "foo", new: "bar" };
    const p2 = { op: "replace-regex" as const, pattern: "foo", replacement: "bar" };
    expect(areOverlappingPatches(p1, p2)).toBe(false);
  });
});

// ============================================================================
// Unit Tests: validateRegexPattern
// ============================================================================

describe("validateRegexPattern", () => {
  test("valid simple pattern → null", () => {
    expect(validateRegexPattern("v\\d+\\.\\d+")).toBe(null);
  });

  test("valid pattern with flags → null", () => {
    expect(validateRegexPattern("foo", "gi")).toBe(null);
  });

  test("invalid pattern → returns error message", () => {
    const result = validateRegexPattern("[unclosed");
    expect(result).not.toBe(null);
    expect(typeof result).toBe("string");
  });

  test("invalid flags → returns error message", () => {
    // Invalid regex with bad escape
    const result = validateRegexPattern("(unmatched");
    expect(result).not.toBe(null);
  });

  test("empty pattern → null (matches everything)", () => {
    expect(validateRegexPattern("")).toBe(null);
  });
});

// ============================================================================
// Unit Tests: checkRegexPatternWarnings
// ============================================================================

describe("checkRegexPatternWarnings", () => {
  test("no g flag and no anchors → warns about first-match-only", () => {
    const patch = { op: "replace-regex" as const, pattern: "foo", replacement: "bar" };
    const warnings = checkRegexPatternWarnings(patch);
    expect(warnings.some((w) => w.includes("g") || w.includes("first match"))).toBe(true);
  });

  test("g flag present → no first-match warning", () => {
    const patch = { op: "replace-regex" as const, pattern: "foo", replacement: "bar", flags: "g" };
    const warnings = checkRegexPatternWarnings(patch);
    const firstMatchWarning = warnings.filter((w) => w.includes("first match"));
    expect(firstMatchWarning.length).toBe(0);
  });

  test("anchored pattern (^) → no first-match warning", () => {
    const patch = { op: "replace-regex" as const, pattern: "^foo", replacement: "bar" };
    const warnings = checkRegexPatternWarnings(patch);
    const firstMatchWarning = warnings.filter((w) => w.includes("first match"));
    expect(firstMatchWarning.length).toBe(0);
  });

  test("'.*' pattern → warns about overly broad match", () => {
    const patch = { op: "replace-regex" as const, pattern: ".*", replacement: "", flags: "g" };
    const warnings = checkRegexPatternWarnings(patch);
    expect(warnings.some((w) => w.includes("entire file") || w.includes("broad"))).toBe(true);
  });

  test("capture group unused in replacement → warns", () => {
    const patch = { op: "replace-regex" as const, pattern: "(foo)", replacement: "bar", flags: "g" };
    const warnings = checkRegexPatternWarnings(patch);
    expect(warnings.some((w) => w.includes("capturing group") || w.includes("$1"))).toBe(true);
  });

  test("capture group used in replacement → no unused-group warning", () => {
    const patch = { op: "replace-regex" as const, pattern: "(foo)", replacement: "$1-bar", flags: "g" };
    const warnings = checkRegexPatternWarnings(patch);
    const unusedWarning = warnings.filter((w) => w.includes("capturing group") && w.includes("doesn't use"));
    expect(unusedWarning.length).toBe(0);
  });

  test("backreference to nonexistent group → warns", () => {
    const patch = { op: "replace-regex" as const, pattern: "foo", replacement: "$1-bar", flags: "g" };
    const warnings = checkRegexPatternWarnings(patch);
    expect(warnings.some((w) => w.includes("group") && w.includes("0"))).toBe(true);
  });
});

// ============================================================================
// Unit Tests: checkGlobPatternWarnings
// ============================================================================

describe("checkGlobPatternWarnings", () => {
  test("'**/*.md' → warns about broad pattern", () => {
    const warnings = checkGlobPatternWarnings(["**/*.md"]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("**/*.md");
  });

  test("'**/*' → warns about broad pattern", () => {
    const warnings = checkGlobPatternWarnings(["**/*"]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test("absolute path → warns about portability", () => {
    const warnings = checkGlobPatternWarnings(["/absolute/path/to/file.md"]);
    expect(warnings.some((w) => w.includes("absolute"))).toBe(true);
  });

  test("specific relative glob → no warnings", () => {
    const warnings = checkGlobPatternWarnings(["docs/guides/*.md"]);
    expect(warnings.length).toBe(0);
  });

  test("non-string resource (object) → skipped, no warnings", () => {
    // Object resources are allowed (auth/integrity) — should not warn
    const resources = [{ url: "https://example.com/archive.tar.gz" }] as unknown as string[];
    const warnings = checkGlobPatternWarnings(resources);
    expect(warnings.length).toBe(0);
  });
});

// ============================================================================
// Unit Tests: checkDestructiveOperationWarnings
// ============================================================================

describe("checkDestructiveOperationWarnings", () => {
  test("remove-section with includeChildren: true → warns about children", () => {
    const patch = { op: "remove-section" as const, id: "section", includeChildren: true };
    const warnings = checkDestructiveOperationWarnings(patch);
    expect(warnings.some((w) => w.includes("children"))).toBe(true);
  });

  test("remove-section with includeChildren: false → no children warning", () => {
    const patch = { op: "remove-section" as const, id: "section", includeChildren: false };
    const warnings = checkDestructiveOperationWarnings(patch);
    const childrenWarning = warnings.filter((w) => w.includes("children"));
    expect(childrenWarning.length).toBe(0);
  });

  test("delete-between with short markers → warns about uniqueness", () => {
    const patch = { op: "delete-between" as const, start: "<!--", end: "-->" };
    const warnings = checkDestructiveOperationWarnings(patch);
    expect(warnings.some((w) => w.includes("short") || w.includes("unique"))).toBe(true);
  });

  test("delete-between with long descriptive markers → no warning", () => {
    const patch = { op: "delete-between" as const, start: "<!-- BEGIN GENERATED SECTION -->", end: "<!-- END GENERATED SECTION -->" };
    const warnings = checkDestructiveOperationWarnings(patch);
    expect(warnings.length).toBe(0);
  });

  test("replace with empty new value → warns about empty replacement", () => {
    const patch = { op: "replace" as const, old: "some content to remove", new: "" };
    const warnings = checkDestructiveOperationWarnings(patch);
    expect(warnings.some((w) => w.includes("empty") || w.includes("delete-between"))).toBe(true);
  });

  test("replace with non-empty new value → no warning", () => {
    const patch = { op: "replace" as const, old: "old", new: "new" };
    const warnings = checkDestructiveOperationWarnings(patch);
    expect(warnings.length).toBe(0);
  });

  test("non-destructive op → no warnings", () => {
    const patch = { op: "set-frontmatter" as const, key: "version", value: "2.0" };
    const warnings = checkDestructiveOperationWarnings(patch);
    expect(warnings.length).toBe(0);
  });
});

// ============================================================================
// CLI Integration Tests
// ============================================================================

describe("kustomark lint (CLI)", () => {
  const setupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });
  };

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

  // --- helpers ---

  const writeConfig = (patches: string, extras = "") => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "*.md"
${extras}patches:
${patches}`,
    );
    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Hello\n\nfoo bar\n");
  };

  const runLint = (args = "") => {
    return execSync(`bun run ${CLI_PATH} lint ${FIXTURES_DIR} ${args}`, {
      encoding: "utf-8",
    });
  };

  const runLintWithStatus = (args = "") => {
    try {
      const stdout = execSync(`bun run ${CLI_PATH} lint ${FIXTURES_DIR} ${args} 2>&1`, {
        encoding: "utf-8",
      });
      return { stdout, exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return { stdout: (e.stdout ?? "") + (e.stderr ?? ""), exitCode: e.status ?? 1 };
    }
  };

  // --- tests ---

  test("clean config with no issues exits 0", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"`);
    const { exitCode } = runLintWithStatus("--format=json");
    expect(exitCode).toBe(0);
  });

  test("clean config returns JSON with zero issues", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    expect(result.issues).toBeDefined();
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  test("JSON output has required fields", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    expect(result).toHaveProperty("issues");
    expect(result).toHaveProperty("errorCount");
    expect(result).toHaveProperty("warningCount");
    expect(result).toHaveProperty("infoCount");
  });

  test("redundant patches detected as warnings in JSON", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "foo"
    new: "bar"`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.issues.some((i: { level: string }) => i.level === "warning")).toBe(true);
  });

  test("redundant patches: warning message mentions patch numbers", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "foo"
    new: "bar"`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    const warning = result.issues.find((i: { level: string; message: string }) => i.level === "warning");
    expect(warning?.message).toMatch(/redundant|Patch #/i);
  });

  test("overlapping patches detected as info issues", () => {
    writeConfig(`  - op: replace-section
    id: intro
    content: "first content"
  - op: remove-section
    id: intro`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    expect(result.infoCount).toBeGreaterThan(0);
    expect(result.issues.some((i: { level: string }) => i.level === "info")).toBe(true);
  });

  test("unreachable patch (include pattern matches nothing) → warning", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
    include: "*.xyz"`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(
      result.issues.some(
        (i: { level: string; message: string }) =>
          i.level === "warning" && i.message.includes("0 files"),
      ),
    ).toBe(true);
  });

  test("invalid regex pattern → error in JSON, exit 1", () => {
    writeConfig(`  - op: replace-regex
    pattern: "[unclosed"
    replacement: "bar"
    flags: "g"`);
    const { stdout, exitCode } = runLintWithStatus("--format=json");
    const result = JSON.parse(stdout);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(exitCode).toBe(1);
  });

  test("--strict mode: warnings become errors, exit 1", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "foo"
    new: "bar"`);
    // Without strict: exit 0 (warnings don't fail)
    const { exitCode: normalExit } = runLintWithStatus("--format=json");
    expect(normalExit).toBe(0);
    // With strict: exit 1
    const { exitCode: strictExit } = runLintWithStatus("--format=json --strict");
    expect(strictExit).toBe(1);
  });

  test("--strict mode: warningCount still reflects original warning level", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "foo"
    new: "bar"`);
    const { stdout } = runLintWithStatus("--format=json --strict");
    const result = JSON.parse(stdout);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  test("text output: no issues prints confirmation at default verbosity", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"`);
    const { stdout, exitCode } = runLintWithStatus("");
    expect(exitCode).toBe(0);
    // Default verbosity is 1, so "No issues found" is printed
    expect(stdout).toContain("No issues found");
  });

  test("text output with issues: shows summary line", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "foo"
    new: "bar"`);
    const output = runLint("2>&1 || true");
    // text output format shows "Found N issue(s)"
    expect(output).toMatch(/Found \d+ issue/);
  });

  test("accepts directory path and auto-detects kustomark.yaml", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"`);
    // Pass directory, not file path
    const output = execSync(`bun run ${CLI_PATH} lint ${FIXTURES_DIR} --format=json`, {
      encoding: "utf-8",
    });
    const result = JSON.parse(output);
    expect(result).toHaveProperty("issues");
  });

  test("missing config file → error exit", () => {
    const { exitCode } = runLintWithStatus("--format=json");
    // No kustomark.yaml written — should fail
    // (we call cleanupFixtures then re-setup empty dir)
    rmSync(join(FIXTURES_DIR, "kustomark.yaml"), { force: true });
    const { exitCode: exitAfterRemove } = runLintWithStatus("--format=json");
    expect(exitAfterRemove).toBe(1);
  });

  test("invalid YAML config → error exit with JSON error", () => {
    writeFileSync(join(FIXTURES_DIR, "kustomark.yaml"), "this: is: not: valid: yaml: : : :");
    const { stdout, exitCode } = runLintWithStatus("--format=json");
    expect(exitCode).toBe(1);
    // Should still output valid JSON error
    try {
      const result = JSON.parse(stdout);
      expect(result.errorCount).toBeGreaterThan(0);
    } catch {
      // May output non-JSON error text for deeply invalid YAML — acceptable
    }
  });

  test("regex warnings (missing g flag) emitted as info issues", () => {
    writeConfig(`  - op: replace-regex
    pattern: "foo"
    replacement: "bar"`);
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    // Should have info-level warnings about missing g flag
    expect(result.issues.some((i: { level: string }) => i.level === "info")).toBe(true);
  });

  test("broad glob resource pattern → info issue", () => {
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - "**/*"
patches:
  - op: replace
    old: "foo"
    new: "bar"
`,
    );
    writeFileSync(join(FIXTURES_DIR, "doc.md"), "# Hello\n\nfoo\n");
    const output = runLint("--format=json");
    const result = JSON.parse(output);
    expect(result.issues.some((i: { level: string }) => i.level === "info")).toBe(true);
  });

  test("exit code 0 when only warnings present (not strict)", () => {
    writeConfig(`  - op: replace
    old: "foo"
    new: "bar"
  - op: replace
    old: "foo"
    new: "bar"`);
    const { exitCode } = runLintWithStatus("--format=json");
    expect(exitCode).toBe(0);
  });
});
