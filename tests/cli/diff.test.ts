/**
 * Tests for the `kustomark diff` command
 *
 * Covers:
 * - Exit codes: 0 = no changes, 1 = has changes or error
 * - JSON output structure: hasChanges, files, validationErrors
 * - Text output: "No changes", file path, unified diff markers
 * - No writes: output directory and source files untouched
 * - Error handling: missing config, malformed YAML, invalid patches
 * - Directory path: auto-detects kustomark.yaml
 * - Multiple files
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = process.cwd();
const CLI_PATH = join(PROJECT_ROOT, "src/cli/index.ts");
const FIXTURES_DIR = join(PROJECT_ROOT, "tests/fixtures/diff");

// ============================================================================
// Helpers
// ============================================================================

function runDiff(
  args: string[],
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "diff", ...args], {
    encoding: "utf-8",
    cwd: PROJECT_ROOT,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

function setupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function writeConfig(dir: string, patches: object[] = []): void {
  const patchLines =
    patches.length > 0
      ? patches.map((p) => `  - ${JSON.stringify(p)}`).join("\n")
      : "  []";
  writeFileSync(
    join(dir, "kustomark.yaml"),
    `apiVersion: kustomark/v1\nkind: Kustomization\noutput: output\nresources:\n  - source.md\npatches:\n${patchLines}\n`,
  );
}

function writeSourceFile(dir: string, content = "# Hello\n\nThis is content.\n"): void {
  writeFileSync(join(dir, "source.md"), content);
}

// ============================================================================
// Exit codes
// ============================================================================

describe("kustomark diff (exit codes)", () => {
  const dir = `${FIXTURES_DIR}/exit-codes`;

  beforeEach(() => {
    setupDir(dir);
    writeSourceFile(dir);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("exits 0 when no patches change anything (empty patches)", () => {
    writeConfig(dir, []);
    const { exitCode } = runDiff([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("exits 1 when patches produce changes", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { exitCode } = runDiff([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 when config file does not exist", () => {
    const { exitCode } = runDiff([join(dir, "nonexistent.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 when config YAML is malformed", () => {
    writeFileSync(join(dir, "bad.yaml"), "this: is: [broken yaml");
    const { exitCode } = runDiff([join(dir, "bad.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 0 when patch has no match in source file", () => {
    writeConfig(dir, [{ op: "replace", old: "DOES_NOT_EXIST", new: "replacement" }]);
    const { exitCode } = runDiff([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });
});

// ============================================================================
// JSON output - no changes
// ============================================================================

describe("kustomark diff (JSON output - no changes)", () => {
  const dir = `${FIXTURES_DIR}/json-nochange`;

  beforeEach(() => {
    setupDir(dir);
    writeSourceFile(dir);
    writeConfig(dir, []);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("--format=json produces valid JSON", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("JSON hasChanges is false when no patches", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.hasChanges).toBe(false);
  });

  test("JSON files is empty array when no changes", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(Array.isArray(output.files)).toBe(true);
    expect(output.files).toHaveLength(0);
  });

  test("JSON validationErrors is empty array when no errors", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(Array.isArray(output.validationErrors)).toBe(true);
    expect(output.validationErrors).toHaveLength(0);
  });

  test("JSON hasChanges is false when patch has no match", () => {
    writeConfig(dir, [{ op: "replace", old: "DOES_NOT_EXIST", new: "replacement" }]);
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.hasChanges).toBe(false);
  });
});

// ============================================================================
// JSON output - with changes
// ============================================================================

describe("kustomark diff (JSON output - with changes)", () => {
  const dir = `${FIXTURES_DIR}/json-changes`;

  beforeEach(() => {
    setupDir(dir);
    writeSourceFile(dir);
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("JSON hasChanges is true when patch applies", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.hasChanges).toBe(true);
  });

  test("JSON files array has one entry for one changed source file", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(Array.isArray(output.files)).toBe(true);
    expect(output.files).toHaveLength(1);
  });

  test("JSON file entry has path field", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0]).toHaveProperty("path");
    expect(typeof output.files[0].path).toBe("string");
  });

  test("JSON file entry has status field", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0]).toHaveProperty("status");
  });

  test("JSON file status is 'modified' for replace patch", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0].status).toBe("modified");
  });

  test("JSON file entry has diff field", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0]).toHaveProperty("diff");
    expect(typeof output.files[0].diff).toBe("string");
  });

  test("JSON diff field contains --- and +++ unified diff markers", () => {
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.files[0].diff).toContain("---");
    expect(output.files[0].diff).toContain("+++");
  });
});

// ============================================================================
// Text output
// ============================================================================

describe("kustomark diff (text output)", () => {
  const dir = `${FIXTURES_DIR}/text`;

  beforeEach(() => {
    setupDir(dir);
    writeSourceFile(dir);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("shows 'No changes' when no patches match", () => {
    writeConfig(dir, []);
    const { stdout } = runDiff([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("No changes");
  });

  test("shows file path when changes exist", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runDiff([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("source.md");
  });

  test("shows + lines in unified diff with -vv", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "-vv"]);
    expect(stdout).toMatch(/^\+/m);
  });

  test("shows - lines in unified diff with -vv", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "-vv"]);
    expect(stdout).toMatch(/^-/m);
  });

  test("directory path auto-detects kustomark.yaml and shows output", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    const { stdout, exitCode } = runDiff([dir]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("source.md");
  });
});

// ============================================================================
// No writes
// ============================================================================

describe("kustomark diff (no writes)", () => {
  const dir = `${FIXTURES_DIR}/no-writes`;

  beforeEach(() => {
    setupDir(dir);
    writeSourceFile(dir);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("output directory NOT created when no changes", () => {
    writeConfig(dir, []);
    runDiff([join(dir, "kustomark.yaml")]);
    expect(existsSync(join(dir, "output"))).toBe(false);
  });

  test("output directory NOT created when changes exist", () => {
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    runDiff([join(dir, "kustomark.yaml")]);
    expect(existsSync(join(dir, "output"))).toBe(false);
  });

  test("source file content unchanged after diff", () => {
    const original = readFileSync(join(dir, "source.md"), "utf-8");
    writeConfig(dir, [{ op: "replace", old: "Hello", new: "World" }]);
    runDiff([join(dir, "kustomark.yaml")]);
    const after = readFileSync(join(dir, "source.md"), "utf-8");
    expect(after).toBe(original);
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe("kustomark diff (error handling)", () => {
  const dir = `${FIXTURES_DIR}/errors`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("missing config exits 1", () => {
    const { exitCode } = runDiff([join(dir, "missing.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("missing config prints error message to stderr", () => {
    const { stderr } = runDiff([join(dir, "missing.yaml")]);
    expect(stderr).toContain("Error");
  });

  test("malformed YAML exits 1", () => {
    writeFileSync(join(dir, "bad.yaml"), "this is: [broken yaml");
    const { exitCode } = runDiff([join(dir, "bad.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("missing config with --format=json returns JSON with error field", () => {
    const { stdout } = runDiff([join(dir, "missing.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output).toHaveProperty("error");
    expect(output.hasChanges).toBe(false);
  });

  test("invalid patch op with --format=json returns JSON with errors field", () => {
    writeSourceFile(dir);
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1\nkind: Kustomization\noutput: output\nresources:\n  - source.md\npatches:\n  - {"op":"bad-op","old":"Hello","new":"World"}\n`,
    );
    const { stdout, exitCode } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(exitCode).toBe(1);
    const output = JSON.parse(stdout);
    expect(output).toHaveProperty("errors");
    expect(Array.isArray(output.errors)).toBe(true);
    expect(output.errors.length).toBeGreaterThan(0);
  });

  test("multiple files shows all changed files in JSON files array", () => {
    writeFileSync(join(dir, "a.md"), "# Alpha\n\nHello from alpha.\n");
    writeFileSync(join(dir, "b.md"), "# Beta\n\nHello from beta.\n");
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1\nkind: Kustomization\noutput: output\nresources:\n  - a.md\n  - b.md\npatches:\n  - ${JSON.stringify({ op: "replace", old: "Hello", new: "Goodbye" })}\n`,
    );
    const { stdout } = runDiff([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.hasChanges).toBe(true);
    expect(output.files).toHaveLength(2);
  });
});
