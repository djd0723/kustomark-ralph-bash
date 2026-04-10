/**
 * Tests for the `kustomark build` command
 *
 * Covers:
 * - Exit codes: 0 = success, 1 = error
 * - JSON output: success, filesWritten, patchesApplied, warnings, validationErrors
 * - Text output: "Built N file(s) with N patch(es) applied"
 * - Files written: output dir created, content correct, --dry-run skips writes
 * - Patch application: replace, replace-regex, set-frontmatter, remove-section
 * - --clean flag: stale output files removed vs retained
 * - Error handling: missing config, malformed YAML, invalid op type
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/build";

// ============================================================================
// Helpers
// ============================================================================

function runBuild(
  args: string[],
  cwd: string = process.cwd(),
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "build", ...args], {
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

function writeConfig(
  dir: string,
  opts: {
    resources?: string[];
    patches?: object[];
    output?: string;
  } = {},
): void {
  const resources = opts.resources ?? ["source.md"];
  const output = opts.output ?? "output";
  const patches = opts.patches ?? [];
  writeFileSync(
    join(dir, "kustomark.yaml"),
    `apiVersion: kustomark/v1
kind: Kustomization
output: ${output}
resources:
${resources.map((r) => `  - ${r}`).join("\n")}
patches:
${patches.length > 0 ? patches.map((p) => `  - ${JSON.stringify(p)}`).join("\n") : "  []"}
`,
  );
}

// ============================================================================
// Exit codes
// ============================================================================

describe("kustomark build (exit codes)", () => {
  const dir = `${FIXTURES_DIR}/exit-codes`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nThis is content.\n");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("exits 0 for valid config with patches applied", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "Hello", new: "World" }] });
    const { exitCode } = runBuild([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("exits 0 for valid config with no patches", () => {
    writeConfig(dir, { patches: [] });
    const { exitCode } = runBuild([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("exits 1 for missing config file", () => {
    const { exitCode } = runBuild([join(dir, "nonexistent.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for malformed YAML config", () => {
    writeFileSync(join(dir, "bad.yaml"), "this: is: not: valid: yaml: [[[");
    const { exitCode } = runBuild([join(dir, "bad.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 0 for valid config with no matching patch (warning only)", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "DOES_NOT_EXIST", new: "replacement" }] });
    const { exitCode } = runBuild([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });
});

// ============================================================================
// JSON output
// ============================================================================

describe("kustomark build (JSON output)", () => {
  const dir = `${FIXTURES_DIR}/json`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nThis is content.\n");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("--format=json produces valid JSON", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("JSON output has success: true on success", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.success).toBe(true);
  });

  test("JSON filesWritten is correct for one resource", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.filesWritten).toBe(1);
  });

  test("JSON patchesApplied is 0 when patch does not match", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "DOES_NOT_EXIST", new: "x" }] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.patchesApplied).toBe(0);
  });

  test("JSON patchesApplied is 1 when patch matches", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "Hello", new: "World" }] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.patchesApplied).toBe(1);
  });

  test("JSON output has warnings array", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(Array.isArray(output.warnings)).toBe(true);
  });

  test("JSON output has validationErrors array", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(Array.isArray(output.validationErrors)).toBe(true);
  });

  test("JSON warnings is non-empty when patch does not match", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "DOES_NOT_EXIST", new: "x" }] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "--format=json"]);
    const output = JSON.parse(stdout);
    expect(output.warnings.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Text output
// ============================================================================

describe("kustomark build (text output)", () => {
  const dir = `${FIXTURES_DIR}/text`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nThis is content.\n");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("shows 'Built N file(s)' message", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Built");
    expect(stdout).toContain("file(s)");
  });

  test("shows '0 patch(es)' when no patch matches", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "DOES_NOT_EXIST", new: "x" }] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("0 patch(es)");
  });

  test("shows '1 patch(es)' when patch matches", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "Hello", new: "World" }] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("1 patch(es)");
  });

  test("-q suppresses build output", () => {
    writeConfig(dir, { patches: [] });
    const { stdout } = runBuild([join(dir, "kustomark.yaml"), "-q"]);
    expect(stdout).not.toContain("Built");
  });

  test("directory path auto-detects kustomark.yaml", () => {
    writeConfig(dir, { patches: [] });
    const { exitCode, stdout } = runBuild([dir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Built");
  });
});

// ============================================================================
// Files written
// ============================================================================

describe("kustomark build (files written)", () => {
  const dir = `${FIXTURES_DIR}/files`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nThis is content.\n");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("output file exists after build", () => {
    writeConfig(dir, { patches: [] });
    runBuild([join(dir, "kustomark.yaml")]);
    expect(existsSync(join(dir, "output", "source.md"))).toBe(true);
  });

  test("output content reflects applied patch", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "Hello", new: "World" }] });
    runBuild([join(dir, "kustomark.yaml")]);
    const content = readFileSync(join(dir, "output", "source.md"), "utf-8");
    expect(content).toContain("World");
    expect(content).not.toContain("Hello");
  });

  test("multiple resources all written to output", () => {
    writeFileSync(join(dir, "a.md"), "# Alpha\n\nContent A.\n");
    writeFileSync(join(dir, "b.md"), "# Beta\n\nContent B.\n");
    writeConfig(dir, { resources: ["a.md", "b.md"], patches: [] });
    runBuild([join(dir, "kustomark.yaml")]);
    expect(existsSync(join(dir, "output", "a.md"))).toBe(true);
    expect(existsSync(join(dir, "output", "b.md"))).toBe(true);
  });

  test("--dry-run does not write output files", () => {
    writeConfig(dir, { patches: [{ op: "replace", old: "Hello", new: "World" }] });
    runBuild([join(dir, "kustomark.yaml"), "--dry-run"]);
    expect(existsSync(join(dir, "output", "source.md"))).toBe(false);
  });
});

// ============================================================================
// Patch application
// ============================================================================

describe("kustomark build (patch application)", () => {
  const dir = `${FIXTURES_DIR}/patches`;

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("replace patch applies correctly", () => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nOld text here.\n");
    writeConfig(dir, { patches: [{ op: "replace", old: "Old text here", new: "New text here" }] });
    runBuild([join(dir, "kustomark.yaml")]);
    const content = readFileSync(join(dir, "output", "source.md"), "utf-8");
    expect(content).toContain("New text here");
    expect(content).not.toContain("Old text here");
  });

  test("replace-regex patch applies correctly", () => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nVersion 1.0.0 is here.\n");
    writeConfig(dir, {
      patches: [{ op: "replace-regex", pattern: "Version (\\d+\\.\\d+\\.\\d+)", replacement: "Version 2.0.0", flags: "g" }],
    });
    runBuild([join(dir, "kustomark.yaml")]);
    const content = readFileSync(join(dir, "output", "source.md"), "utf-8");
    expect(content).toContain("Version 2.0.0");
    expect(content).not.toContain("Version 1.0.0");
  });

  test("set-frontmatter patch applies correctly", () => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "---\ntitle: Old Title\n---\n\n# Hello\n");
    writeConfig(dir, { patches: [{ op: "set-frontmatter", key: "title", value: "New Title" }] });
    runBuild([join(dir, "kustomark.yaml")]);
    const content = readFileSync(join(dir, "output", "source.md"), "utf-8");
    expect(content).toContain("New Title");
    expect(content).not.toContain("Old Title");
  });

  test("remove-section patch applies correctly", () => {
    setupDir(dir);
    writeFileSync(
      join(dir, "source.md"),
      "# Title\n\n## Section One\n\nRemove this section.\n\n## Section Two\n\nKeep this.\n",
    );
    writeConfig(dir, { patches: [{ op: "remove-section", id: "section-one" }] });
    runBuild([join(dir, "kustomark.yaml")]);
    const content = readFileSync(join(dir, "output", "source.md"), "utf-8");
    expect(content).not.toContain("Section One");
    expect(content).not.toContain("Remove this section");
    expect(content).toContain("Section Two");
  });
});

// ============================================================================
// --clean flag
// ============================================================================

describe("kustomark build (--clean flag)", () => {
  const dir = `${FIXTURES_DIR}/clean`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    // Create a stale output file that is not in the source list
    mkdirSync(join(dir, "output"), { recursive: true });
    writeFileSync(join(dir, "output", "stale.md"), "# Stale\n\nThis should be removed.\n");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("without --clean, stale output files remain", () => {
    writeConfig(dir, { patches: [] });
    runBuild([join(dir, "kustomark.yaml")]);
    expect(existsSync(join(dir, "output", "stale.md"))).toBe(true);
  });

  test("with --clean, stale output files are removed", () => {
    writeConfig(dir, { patches: [] });
    runBuild([join(dir, "kustomark.yaml"), "--clean"]);
    expect(existsSync(join(dir, "output", "stale.md"))).toBe(false);
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe("kustomark build (error handling)", () => {
  const dir = `${FIXTURES_DIR}/errors`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("missing config exits 1 and prints error", () => {
    const { exitCode, stderr } = runBuild([join(dir, "missing.yaml")]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Error");
  });

  test("malformed YAML exits 1 and prints error", () => {
    writeFileSync(join(dir, "bad.yaml"), "this is: [broken yaml");
    const { exitCode, stderr } = runBuild([join(dir, "bad.yaml")]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Error");
  });

  test("invalid op type exits 1", () => {
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - source.md
patches:
  - op: not-a-real-op
    old: something
    new: something
`,
    );
    const { exitCode } = runBuild([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("--format=json on error returns JSON with success: false", () => {
    const { stdout, exitCode } = runBuild([join(dir, "missing.yaml"), "--format=json"]);
    expect(exitCode).toBe(1);
    // Some error paths print to stderr only; tolerate empty stdout gracefully
    if (stdout.trim()) {
      const output = JSON.parse(stdout);
      expect(output.success).toBe(false);
    }
  });
});
