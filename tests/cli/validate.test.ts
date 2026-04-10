/**
 * Tests for the `kustomark validate` command.
 *
 * Covers:
 * - Exit codes: 0 = valid, 1 = invalid/error
 * - JSON output: valid config, invalid config, missing config, strict mode
 * - Text output: success message, error messages, quiet flag, directory detection
 * - --strict mode: warnings become errors, exit code behavior
 * - Validation checks: apiVersion, patch op, required patch fields
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/validate";
const CWD = "/Users/dominicdones/codeprojects/superhumanlayer/git_clones/github.com/djd0723/kustomark-ralph-bash";

// ============================================================================
// Helpers
// ============================================================================

function run(
  args: string[],
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "validate", ...args], {
    encoding: "utf-8",
    cwd: CWD,
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

/** Write a minimal valid kustomark.yaml to `dir`. */
function writeValidConfig(
  dir: string,
  opts: {
    patches?: string;
    plugins?: string;
    extraFields?: string;
  } = {},
): void {
  const patches = opts.patches ?? `  - op: replace
    old: "old text"
    new: "new text"`;
  const plugins = opts.plugins ? `plugins:\n${opts.plugins}\n` : "";
  const extra = opts.extraFields ?? "";
  writeFileSync(
    join(dir, "kustomark.yaml"),
    `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
${plugins}${extra}patches:
${patches}
`,
  );
  writeFileSync(join(dir, "file.md"), "# Hello\n\nold text\n");
}

// ============================================================================
// 1. Exit codes
// ============================================================================

describe("kustomark validate (exit codes)", () => {
  const dir = `${FIXTURES_DIR}/exit-codes`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("exits 0 for valid config (directory path)", () => {
    writeValidConfig(dir);
    const { exitCode } = run([dir]);
    expect(exitCode).toBe(0);
  });

  test("exits 0 for valid config with no patches key", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
`,
    );
    writeFileSync(join(dir, "file.md"), "# Hello\n");
    const { exitCode } = run([dir]);
    expect(exitCode).toBe(0);
  });

  test("exits 1 for missing config", () => {
    const { exitCode } = run([join(dir, "nonexistent", "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for malformed YAML", () => {
    writeFileSync(join(dir, "kustomark.yaml"), "this: is: not: valid: yaml: : : :");
    const { exitCode } = run([dir]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for invalid patch op type", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: invalid-op
    old: "old"
    new: "new"
`,
    );
    const { exitCode } = run([dir]);
    expect(exitCode).toBe(1);
  });
});

// ============================================================================
// 2. JSON output - valid config
// ============================================================================

describe("kustomark validate --format=json (valid config)", () => {
  const dir = `${FIXTURES_DIR}/json-valid`;

  beforeEach(() => {
    setupDir(dir);
    writeValidConfig(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("outputs valid JSON", () => {
    const { stdout, exitCode } = run([dir, "--format=json"]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("JSON has valid: true", () => {
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
  });

  test("JSON errors is empty array", () => {
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test("JSON warnings is empty array", () => {
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.length).toBe(0);
  });

  test("JSON strict is false by default", () => {
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.strict).toBe(false);
  });

  test("JSON strict is true when --strict flag passed", () => {
    const { stdout } = run([dir, "--format=json", "--strict"]);
    const result = JSON.parse(stdout);
    expect(result.strict).toBe(true);
  });
});

// ============================================================================
// 3. JSON output - invalid config
// ============================================================================

describe("kustomark validate --format=json (invalid config)", () => {
  const dir = `${FIXTURES_DIR}/json-invalid`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("valid: false for invalid patch op", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: invalid-op
    old: "old"
    new: "new"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
  });

  test("errors array is non-empty for invalid patch op", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: invalid-op
    old: "old"
    new: "new"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("error object has message field", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: invalid-op
    old: "old"
    new: "new"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.errors[0]).toHaveProperty("message");
    expect(typeof result.errors[0].message).toBe("string");
  });

  test("JSON is returned even for missing config error", () => {
    const { stdout } = run([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
  });

  test("valid: false for missing required patch field", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: replace
    new: "missing old field"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 4. Text output
// ============================================================================

describe("kustomark validate (text output)", () => {
  const dir = `${FIXTURES_DIR}/text`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test('"Configuration is valid" for valid config', () => {
    writeValidConfig(dir);
    const { stdout, exitCode } = run([dir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Configuration is valid");
  });

  test("shows error message for invalid op", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: invalid-op
    old: "old"
    new: "new"
`,
    );
    const { stdout, stderr, exitCode } = run([dir]);
    expect(exitCode).toBe(1);
    // Error text is on stderr
    expect(stdout + stderr).toContain("invalid-op");
  });

  test("directory path auto-detects kustomark.yaml", () => {
    writeValidConfig(dir);
    const { stdout, exitCode } = run([dir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Configuration is valid");
  });

  test("-q suppresses valid output", () => {
    writeValidConfig(dir);
    const { stdout, exitCode } = run([dir, "-q"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  test("error message for malformed YAML", () => {
    writeFileSync(join(dir, "kustomark.yaml"), "this: is: not: valid: yaml: : : :");
    const { stdout, stderr, exitCode } = run([dir]);
    expect(exitCode).toBe(1);
    expect(stdout + stderr).toContain("Error:");
  });
});

// ============================================================================
// 5. --strict mode
// ============================================================================

describe("kustomark validate --strict", () => {
  const dir = `${FIXTURES_DIR}/strict`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("valid config exits 0 without --strict", () => {
    writeValidConfig(dir);
    const { exitCode } = run([dir]);
    expect(exitCode).toBe(0);
  });

  test("valid config with no warnings still exits 0 with --strict", () => {
    writeValidConfig(dir);
    const { exitCode } = run([dir, "--strict"]);
    expect(exitCode).toBe(0);
  });

  test("config with warnings exits 1 with --strict", () => {
    // A plugin with a non-semver version triggers a warning but is otherwise valid
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
plugins:
  - name: test-plugin
    version: "not-semver"
    source: ./test-plugin.js
    command: echo
patches:
  - op: replace
    old: "old text"
    new: "new text"
`,
    );
    writeFileSync(join(dir, "file.md"), "# Hello\n");
    // Without strict: exits 0 (warning present but not failure)
    const { exitCode: normalExit } = run([dir]);
    expect(normalExit).toBe(0);
    // With strict: exits 1
    const { exitCode: strictExit } = run([dir, "--strict"]);
    expect(strictExit).toBe(1);
  });

  test("JSON strict: true when --strict flag passed", () => {
    writeValidConfig(dir);
    const { stdout } = run([dir, "--format=json", "--strict"]);
    const result = JSON.parse(stdout);
    expect(result.strict).toBe(true);
  });
});

// ============================================================================
// 6. Validation checks
// ============================================================================

describe("kustomark validate (validation checks)", () => {
  const dir = `${FIXTURES_DIR}/checks`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("valid apiVersion passes", () => {
    writeValidConfig(dir);
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
  });

  test("missing apiVersion fails", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `kind: Kustomization
output: output
resources:
  - file.md
`,
    );
    writeFileSync(join(dir, "file.md"), "# Hello\n");
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: { field: string }) => e.field === "apiVersion")).toBe(true);
  });

  test("valid patch op passes", () => {
    writeValidConfig(dir);
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test("unknown patch op fails", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: bogus-operation
    old: "old"
    new: "new"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e: { message: string }) => e.message.includes("bogus-operation")),
    ).toBe(true);
  });

  test("missing old field in replace fails", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: replace
    new: "no old field here"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e: { field: string; message: string }) =>
          e.field.includes("old") && e.message.includes("'old'"),
      ),
    ).toBe(true);
  });

  test("missing new field in replace fails", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches:
  - op: replace
    old: "has old but missing new"
`,
    );
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e: { field: string; message: string }) =>
          e.field.includes("new") && e.message.includes("'new'"),
      ),
    ).toBe(true);
  });

  test("empty patches array passes", () => {
    writeFileSync(
      join(dir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - file.md
patches: []
`,
    );
    writeFileSync(join(dir, "file.md"), "# Hello\n");
    const { stdout } = run([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
  });
});
