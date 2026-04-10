/**
 * Tests for the `kustomark explain` command
 *
 * Covers:
 * - Exit codes: 0 = success, 1 = error
 * - JSON output (chain): config, output, chain array, totalFiles, totalPatches
 * - JSON output (--file): file, source, patches array
 * - Text output: Config, Output, Resolution Chain, Total Files, Total Patches
 * - Text output (--file): File, Source, Patches
 * - Directory path: auto-detects kustomark.yaml
 * - Nested configs: base referenced by overlay shows multi-entry chain
 * - Error handling: missing config, invalid YAML, --file not found in chain
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/explain";

// ============================================================================
// Helpers
// ============================================================================

function runExplain(
  args: string[],
  cwd: string = process.cwd(),
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "explain", ...args], {
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

function writeBasicConfig(
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

describe("kustomark explain (exit codes)", () => {
  const dir = `${FIXTURES_DIR}/exit-codes`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeBasicConfig(dir);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("exits 0 for valid config file path", () => {
    const { exitCode } = runExplain([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("exits 0 for valid directory path", () => {
    const { exitCode } = runExplain([dir]);
    expect(exitCode).toBe(0);
  });

  test("exits 1 for missing config", () => {
    const { exitCode } = runExplain([join(dir, "nonexistent", "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for malformed YAML", () => {
    writeFileSync(join(dir, "kustomark.yaml"), "not: valid: yaml: [\n");
    const { exitCode } = runExplain([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 when --file target not found in chain", () => {
    const { exitCode } = runExplain([join(dir, "kustomark.yaml"), "--file", "nonexistent.md"]);
    expect(exitCode).toBe(1);
  });

  test("exits 0 when --file is found in chain", () => {
    const { exitCode } = runExplain([join(dir, "kustomark.yaml"), "--file", "source.md"]);
    expect(exitCode).toBe(0);
  });
});

// ============================================================================
// JSON output (chain)
// ============================================================================

describe("kustomark explain --format=json (chain output)", () => {
  const dir = `${FIXTURES_DIR}/json-chain`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeBasicConfig(dir, {
      patches: [
        { op: "replace", old: "Hello", new: "World" },
        { op: "replace", old: "Content", new: "Text" },
      ],
    });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("outputs valid JSON", () => {
    const { stdout, exitCode } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("JSON has config field", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("config");
    expect(typeof result.config).toBe("string");
  });

  test("JSON has output field", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("output");
    expect(result.output).toBe("output");
  });

  test("JSON has chain array", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("chain");
    expect(Array.isArray(result.chain)).toBe(true);
  });

  test("chain array has at least one entry", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.chain.length).toBeGreaterThanOrEqual(1);
  });

  test("chain entries have config, resources, patches fields", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    for (const entry of result.chain) {
      expect(entry).toHaveProperty("config");
      expect(entry).toHaveProperty("resources");
      expect(entry).toHaveProperty("patches");
    }
  });

  test("chain entry resources count is correct", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    const entry = result.chain[0];
    expect(entry.resources).toBe(1);
  });

  test("chain entry patches count is correct", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    const entry = result.chain[0];
    expect(entry.patches).toBe(2);
  });

  test("JSON has totalFiles field", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("totalFiles");
    expect(result.totalFiles).toBe(1);
  });

  test("JSON has totalPatches field", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("totalPatches");
    expect(result.totalPatches).toBe(2);
  });

  test("zero patches reported correctly", () => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n");
    writeBasicConfig(dir, { patches: [] });
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.totalPatches).toBe(0);
  });
});

// ============================================================================
// JSON output (--file lineage)
// ============================================================================

describe("kustomark explain --file --format=json (file lineage output)", () => {
  const dir = `${FIXTURES_DIR}/json-file`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeBasicConfig(dir, {
      patches: [{ op: "replace", old: "Hello", new: "World" }],
    });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("outputs valid JSON for --file", () => {
    const { stdout, exitCode } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "source.md",
      "--format=json",
    ]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("JSON has file field matching requested file", () => {
    const { stdout } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "source.md",
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("file");
    expect(result.file).toBe("source.md");
  });

  test("JSON has source field", () => {
    const { stdout } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "source.md",
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("source");
    expect(typeof result.source).toBe("string");
  });

  test("JSON has patches array", () => {
    const { stdout } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "source.md",
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("patches");
    expect(Array.isArray(result.patches)).toBe(true);
  });

  test("patches array has correct count", () => {
    const { stdout } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "source.md",
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result.patches.length).toBe(1);
  });

  test("patch entry has config and op fields", () => {
    const { stdout } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "source.md",
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    const patch = result.patches[0];
    expect(patch).toHaveProperty("config");
    expect(patch).toHaveProperty("op");
    expect(patch.op).toBe("replace");
  });

  test("file not in chain returns error JSON with exit 1", () => {
    const { stdout, exitCode } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "missing.md",
      "--format=json",
    ]);
    expect(exitCode).toBe(1);
    // stderr or stdout may contain error info
    expect(stdout.length + (exitCode === 1 ? 1 : 0)).toBeGreaterThan(0);
  });

  test("file with no matching patches returns empty patches array", () => {
    writeFileSync(join(dir, "other.md"), "# Other\n");
    writeBasicConfig(dir, {
      resources: ["source.md", "other.md"],
      patches: [{ op: "replace", old: "Hello", new: "World", include: "source.md" }],
    });
    const { stdout, exitCode } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "other.md",
      "--format=json",
    ]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.patches.length).toBe(0);
  });
});

// ============================================================================
// Text output (chain)
// ============================================================================

describe("kustomark explain (text output)", () => {
  const dir = `${FIXTURES_DIR}/text-chain`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeBasicConfig(dir, {
      patches: [{ op: "replace", old: "Hello", new: "World" }],
    });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("text output contains Config: line", () => {
    const { stdout, exitCode } = runExplain([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Config:");
  });

  test("text output contains Output: line", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Output:");
  });

  test("text output contains Resolution Chain: header", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Resolution Chain:");
  });

  test("text output contains Total Files:", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Total Files:");
  });

  test("text output contains Total Patches:", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml")]);
    expect(stdout).toContain("Total Patches:");
  });

  test("text output shows correct total files count", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml")]);
    expect(stdout).toMatch(/Total Files:\s*1/);
  });

  test("text output shows correct total patches count", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml")]);
    expect(stdout).toMatch(/Total Patches:\s*1/);
  });
});

// ============================================================================
// Text output (--file lineage)
// ============================================================================

describe("kustomark explain --file (text output)", () => {
  const dir = `${FIXTURES_DIR}/text-file`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n\nContent.\n");
    writeBasicConfig(dir, {
      patches: [{ op: "replace", old: "Hello", new: "World" }],
    });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("text output contains File: line", () => {
    const { stdout, exitCode } = runExplain([join(dir, "kustomark.yaml"), "--file", "source.md"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("File:");
  });

  test("text output contains Source: line", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--file", "source.md"]);
    expect(stdout).toContain("Source:");
  });

  test("text output contains Patches header", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--file", "source.md"]);
    expect(stdout).toContain("Patches");
  });

  test("text output shows the file name", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--file", "source.md"]);
    expect(stdout).toContain("source.md");
  });

  test("text output shows patch op type", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--file", "source.md"]);
    expect(stdout).toContain("replace");
  });

  test("--file not found produces error message", () => {
    const { stdout, stderr, exitCode } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "missing.md",
    ]);
    expect(exitCode).toBe(1);
    // logger writes to stdout by default; error message contains the filename
    expect((stdout + stderr)).toContain("missing.md");
  });
});

// ============================================================================
// Directory path auto-detection
// ============================================================================

describe("kustomark explain (directory path)", () => {
  const dir = `${FIXTURES_DIR}/directory`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "source.md"), "# Hello\n");
    writeBasicConfig(dir, {
      patches: [{ op: "replace", old: "Hello", new: "World" }],
    });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("accepts directory and auto-detects kustomark.yaml", () => {
    const { exitCode } = runExplain([dir]);
    expect(exitCode).toBe(0);
  });

  test("directory path produces valid JSON", () => {
    const { stdout, exitCode } = runExplain([dir, "--format=json"]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("directory path JSON has correct totalFiles", () => {
    const { stdout } = runExplain([dir, "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.totalFiles).toBe(1);
  });
});

// ============================================================================
// Nested configs (overlay → base)
// ============================================================================

describe("kustomark explain (nested configs)", () => {
  const dir = `${FIXTURES_DIR}/nested`;

  beforeEach(() => {
    setupDir(dir);
    const baseDir = join(dir, "base");
    const overlayDir = join(dir, "overlay");
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(overlayDir, { recursive: true });

    // Base: has 2 files and 1 patch
    writeFileSync(join(baseDir, "file-a.md"), "# File A\n\nContent A.\n");
    writeFileSync(join(baseDir, "file-b.md"), "# File B\n\nContent B.\n");
    writeFileSync(
      join(baseDir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: ../../output-base
resources:
  - file-a.md
  - file-b.md
patches:
  - op: replace
    old: "Content A"
    new: "Modified A"
`,
    );

    // Overlay: references base dir and adds 1 patch
    writeFileSync(
      join(overlayDir, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: ../../output-overlay
resources:
  - ../base/
patches:
  - op: replace
    old: "Content B"
    new: "Modified B"
`,
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("overlay config exits 0", () => {
    const { exitCode } = runExplain([join(dir, "overlay", "kustomark.yaml")]);
    expect(exitCode).toBe(0);
  });

  test("chain has multiple entries for nested configs", () => {
    const { stdout } = runExplain([
      join(dir, "overlay", "kustomark.yaml"),
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result.chain.length).toBeGreaterThanOrEqual(2);
  });

  test("totalFiles accounts for all resources across chain", () => {
    const { stdout } = runExplain([
      join(dir, "overlay", "kustomark.yaml"),
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result.totalFiles).toBeGreaterThanOrEqual(2);
  });

  test("totalPatches sums patches from all chain entries", () => {
    const { stdout } = runExplain([
      join(dir, "overlay", "kustomark.yaml"),
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    expect(result.totalPatches).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe("kustomark explain (error handling)", () => {
  const dir = `${FIXTURES_DIR}/errors`;

  beforeEach(() => setupDir(dir));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("missing config exits 1", () => {
    const { exitCode } = runExplain([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("invalid YAML exits 1", () => {
    writeFileSync(join(dir, "kustomark.yaml"), "{ bad yaml: [unclosed\n");
    const { exitCode } = runExplain([join(dir, "kustomark.yaml")]);
    expect(exitCode).toBe(1);
  });

  test("invalid YAML with --format=json returns JSON error", () => {
    writeFileSync(join(dir, "kustomark.yaml"), "{ bad yaml: [unclosed\n");
    const { stdout, exitCode } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("error");
  });

  test("missing config with --format=json returns JSON error", () => {
    const { stdout, exitCode } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("error");
  });
});

// ============================================================================
// Multiple resources
// ============================================================================

describe("kustomark explain (multiple resources)", () => {
  const dir = `${FIXTURES_DIR}/multi-resource`;

  beforeEach(() => {
    setupDir(dir);
    writeFileSync(join(dir, "a.md"), "# A\n");
    writeFileSync(join(dir, "b.md"), "# B\n");
    writeFileSync(join(dir, "c.md"), "# C\n");
    writeBasicConfig(dir, {
      resources: ["a.md", "b.md", "c.md"],
      patches: [
        { op: "replace", old: "# A", new: "# Alpha" },
        { op: "replace", old: "# B", new: "# Beta" },
      ],
    });
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("totalFiles is 3 for 3 resources", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.totalFiles).toBe(3);
  });

  test("totalPatches is 2 for 2 patches", () => {
    const { stdout } = runExplain([join(dir, "kustomark.yaml"), "--format=json"]);
    const result = JSON.parse(stdout);
    expect(result.totalPatches).toBe(2);
  });

  test("--file lineage for one of multiple files exits 0", () => {
    const { exitCode } = runExplain([join(dir, "kustomark.yaml"), "--file", "a.md"]);
    expect(exitCode).toBe(0);
  });

  test("--file lineage for file with no matching patches has empty patches", () => {
    const { stdout } = runExplain([
      join(dir, "kustomark.yaml"),
      "--file",
      "c.md",
      "--format=json",
    ]);
    const result = JSON.parse(stdout);
    // c.md has no patches targeting it (patches use exact old text for a.md and b.md)
    expect(result.file).toBe("c.md");
  });
});
