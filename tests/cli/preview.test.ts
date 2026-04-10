/**
 * Tests for the `kustomark preview` command
 *
 * Covers:
 * - Exit codes: 0 = no changes, 1 = has changes
 * - JSON output structure: filesChanged, totalLinesAdded, totalLinesDeleted, files array
 * - Text output: file headers, +/- summary
 * - Quiet mode: suppress text output
 * - Verbose mode: more context lines shown
 * - Error handling: missing config, invalid YAML
 * - Directory path: auto-detects kustomark.yaml
 * - Multiple files
 * - No-change configs
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/preview";

// ============================================================================
// Helpers
// ============================================================================

function runPreview(
  args: string[],
  cwd: string = process.cwd(),
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "preview", ...args], {
    encoding: "utf-8",
    cwd,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

function setupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

function writeConfig(dir: string, patches: object[] = []): void {
  writeFileSync(
    join(dir, "kustomark.yaml"),
    `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - source.md
patches:
${patches.length > 0 ? patches.map((p) => `  - ${JSON.stringify(p)}`).join("\n") : "  []"}
`,
  );
}

// ============================================================================
// Exit codes
// ============================================================================

describe("kustomark preview (exit codes)", () => {
  const dir = `${FIXTURES_DIR}/exit-codes`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Hello\n\nThis is content.\n",
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("exits 0 when no patches change anything", () => {
    writeConfig(dir, []);
    const { exitCode } = runPreview([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("exits 1 when patches produce changes", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { exitCode } = runPreview([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 when config file does not exist", () => {
    const { exitCode } = runPreview([join(dir, "nonexistent.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 when config YAML is invalid", () => {
    writeFileSync(join(dir, "bad.yaml"), "this: is: not: valid: yaml: [[[");
    const { exitCode } = runPreview([join(dir, "bad.yaml")]);
    expect(exitCode).toBe(1);
  });
});

// ============================================================================
// JSON output
// ============================================================================

describe("kustomark preview (JSON output)", () => {
  const dir = `${FIXTURES_DIR}/json`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Hello\n\nThis is content.\n",
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("--format=json produces valid JSON", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("JSON output has filesChanged field", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(typeof output.filesChanged).toBe("number");
  });

  test("JSON filesChanged is 1 when one file changes", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(1);
  });

  test("JSON filesChanged is 0 when no patches apply", () => {
    writeConfig(dir, []);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(0);
  });

  test("JSON output has totalLinesAdded field", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(typeof output.totalLinesAdded).toBe("number");
  });

  test("JSON output has totalLinesDeleted field", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(typeof output.totalLinesDeleted).toBe("number");
  });

  test("JSON output has totalLinesModified field", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(typeof output.totalLinesModified).toBe("number");
  });

  test("JSON output has files array", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(Array.isArray(output.files)).toBe(true);
  });

  test("JSON files array has one entry for one source file", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files).toHaveLength(1);
  });

  test("JSON file entry has path, hasChanges, changes fields", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    const file = output.files[0];
    expect(file).toHaveProperty("path");
    expect(file).toHaveProperty("hasChanges");
    expect(file).toHaveProperty("changes");
  });

  test("JSON file hasChanges is true when patch applies", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0].hasChanges).toBe(true);
  });

  test("JSON file hasChanges is false when no patches apply", () => {
    writeConfig(dir, []);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0].hasChanges).toBe(false);
  });

  test("JSON file linesModified is nonzero for replace patch", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0].linesModified).toBeGreaterThan(0);
  });
});

// ============================================================================
// Text output
// ============================================================================

describe("kustomark preview (text output)", () => {
  const dir = `${FIXTURES_DIR}/text`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Hello\n\nThis is content.\n",
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("shows Preview header line with config path", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Preview:");
  });

  test("shows Summary line when changes exist", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Summary:");
  });

  test("shows file path in output when file changes", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("source.md");
  });

  test("shows +/- stats in summary", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    // Summary shows counts with + and - and ~
    expect(stdout).toMatch(/[+\-~]/);
  });

  test("shows 0 files changed in summary when no changes", () => {
    writeConfig(dir, []);
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("0 files changed");
  });

  test("shows 1 files changed in summary when one file changes", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("1 files changed");
  });
});

// ============================================================================
// Quiet mode
// ============================================================================

describe("kustomark preview (quiet mode)", () => {
  const dir = `${FIXTURES_DIR}/quiet`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Hello\n\nThis is content.\n",
    );
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("-q suppresses Preview header", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "-q"]);
    expect(stdout).not.toContain("Preview:");
  });

  test("-q suppresses Summary line", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "-q"]);
    expect(stdout).not.toContain("Summary:");
  });

  test("--format=json still works with -q", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "-q", "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(1);
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe("kustomark preview (error handling)", () => {
  const dir = `${FIXTURES_DIR}/errors`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("prints error message when config not found", () => {
    const { stderr } = runPreview([join(dir, "missing.yaml")]);
    expect(stderr).toContain("Error");
  });

  test("prints error when config YAML is malformed", () => {
    writeFileSync(join(dir, "bad.yaml"), "this is: [broken yaml");
    const { stderr } = runPreview([join(dir, "bad.yaml")]);
    expect(stderr).toContain("Error");
  });

  test("prints validation error when required fields missing", () => {
    writeFileSync(
      join(dir, "invalid.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
# missing output and resources
`,
    );
    const { stderr } = runPreview([join(dir, "invalid.yaml")]);
    expect(stderr).toContain("Error");
  });
});

// ============================================================================
// Directory path (auto-detects kustomark.yaml)
// ============================================================================

describe("kustomark preview (directory path)", () => {
  const dir = `${FIXTURES_DIR}/directory`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("accepts directory path and auto-detects kustomark.yaml", () => {
    const { exitCode } = runPreview([dir]);
    // Should exit 1 (changes found) not error
    expect(exitCode).toBe(1);
  });

  test("directory path JSON output is valid", () => {
    const { stdout } = runPreview([dir, "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("directory path detects the correct number of changes", () => {
    const { stdout } = runPreview([dir, "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(1);
  });
});

// ============================================================================
// Multiple files
// ============================================================================

describe("kustomark preview (multiple files)", () => {
  const dir = `${FIXTURES_DIR}/multi`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "a.md"), "# Alpha\n\nHello from alpha.\n");
    writeFileSync(join(dir, "b.md"), "# Beta\n\nHello from beta.\n");
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - a.md
  - b.md
patches:
  - ${JSON.stringify({ op: "replace", old: "Hello", new: "Goodbye" })}
`,
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("JSON filesChanged is 2 when both files change", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(2);
  });

  test("JSON files array has 2 entries for 2 source files", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files).toHaveLength(2);
  });

  test("text output mentions both file names", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("a.md");
    expect(stdout).toContain("b.md");
  });

  test("totalLinesModified accounts for all files", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    // Both files have a modified line
    expect(output.totalLinesModified).toBeGreaterThanOrEqual(2);
  });

  test("exits 1 (has changes) for multiple changed files", () => {
    const { exitCode } = runPreview([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });
});

// ============================================================================
// Specific patch operations
// ============================================================================

describe("kustomark preview (patch operations)", () => {
  const dir = `${FIXTURES_DIR}/ops`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Title\n\n## Section One\n\nOld content here.\n\n## Section Two\n\nMore content.\n",
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("replace-regex patch shows changes in JSON", () => {
    writeConfig(dir, [{ op: "replace-regex", pattern: "Old (\\w+)", replacement: "New $1", flags: "g" }]);
    const { stdout, exitCode } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(1);
    expect(exitCode).toBe(1);
  });

  test("set-frontmatter patch shows changes in JSON", () => {
    writeConfig(dir, [{ op: "set-frontmatter", key: "version", value: "2.0" }]);
    const { stdout, exitCode } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(1);
    expect(exitCode).toBe(1);
  });

  test("remove-section patch shows changes in JSON", () => {
    writeConfig(dir, [{ op: "remove-section", id: "section-one" }]);
    const { stdout, exitCode } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(1);
    expect(exitCode).toBe(1);
  });

  test("patches apply to all files (include/exclude not path-filtered in preview)", () => {
    writeFileSync(join(dir, "other.md"), "# Other\n\nOld content here.\n");
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - source.md
  - other.md
patches:
  - ${JSON.stringify({ op: "replace", old: "Old", new: "New" })}
`,
    );
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    // Both files have "Old" → both change
    expect(output.filesChanged).toBe(2);
    expect(output.files).toHaveLength(2);
  });
});

// ============================================================================
// Verbose mode
// ============================================================================

describe("kustomark preview (verbose mode)", () => {
  const dir = `${FIXTURES_DIR}/verbose`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Hello\n\nThis is content.\n",
    );
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("-v still shows changes and summary", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "-v"]);
    expect(stdout).toContain("Summary:");
  });

  test("-vv still shows changes and summary", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "-vv"]);
    expect(stdout).toContain("Summary:");
  });

  test("-v JSON output is valid", () => {
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "-v", "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });
});

// ============================================================================
// No-op configs
// ============================================================================

describe("kustomark preview (no-op configs)", () => {
  const dir = `${FIXTURES_DIR}/noop`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("patch targeting non-existent text makes no changes", () => {
    writeConfig(dir, [{ op: "replace", old: "DOES_NOT_EXIST", new: "replacement" }]);
    const { exitCode } = runPreview([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("empty patches array makes no changes", () => {
    writeConfig(dir, []);
    const { exitCode } = runPreview([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("JSON filesChanged is 0 for no-op config", () => {
    writeConfig(dir, []);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesChanged).toBe(0);
  });

  test("JSON totalLinesAdded is 0 for no-op config", () => {
    writeConfig(dir, []);
    const { stdout } = runPreview([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.totalLinesAdded).toBe(0);
  });
});
