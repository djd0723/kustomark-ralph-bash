/**
 * Tests for the `kustomark snapshot` command
 *
 * Covers create, verify, and update modes with both text and JSON output formats.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/snapshot";

// ============================================================================
// Helpers
// ============================================================================

function setupFixtures(dir: string = FIXTURES_DIR): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, "source.md"),
    `# Hello World

This is a test document.

## Section One

Content in section one.

## Section Two

Content in section two.
`,
  );

  writeFileSync(
    join(dir, "kustomark.yaml"),
    `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - source.md
patches:
  - op: replace
    old: "test"
    new: "production"
`,
  );
}

function cleanupFixtures(dir: string = FIXTURES_DIR): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runSnapshot(args: string, dir: string = FIXTURES_DIR): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    "bun",
    ["run", CLI_PATH, "snapshot", dir, ...args.split(" ").filter(Boolean)],
    { encoding: "utf-8", cwd: process.cwd() },
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// ============================================================================
// Create mode
// ============================================================================

describe("kustomark snapshot (create mode)", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("creates snapshot manifest and exits 0", () => {
    const { exitCode } = runSnapshot("");
    expect(exitCode).toBe(0);

    const manifestPath = join(FIXTURES_DIR, ".kustomark", "snapshots", "manifest.yaml");
    expect(existsSync(manifestPath)).toBe(true);
  });

  test("snapshot manifest contains version, timestamp, and files", () => {
    runSnapshot("");

    const manifestPath = join(FIXTURES_DIR, ".kustomark", "snapshots", "manifest.yaml");
    const content = readFileSync(manifestPath, "utf-8");
    expect(content).toContain("version:");
    expect(content).toContain("timestamp:");
    expect(content).toContain("files:");
  });

  test("snapshot manifest files have path, hash, and size fields", () => {
    runSnapshot("");

    const manifestPath = join(FIXTURES_DIR, ".kustomark", "snapshots", "manifest.yaml");
    const content = readFileSync(manifestPath, "utf-8");
    expect(content).toContain("path:");
    expect(content).toContain("hash:");
    expect(content).toContain("size:");
  });

  test("text output reports snapshot created", () => {
    const { stdout } = runSnapshot("");
    expect(stdout).toContain("Snapshot Created");
  });

  test("text output reports file count", () => {
    const { stdout } = runSnapshot("");
    // Strip ANSI color codes before matching
    const plain = stdout.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toMatch(/Files:\s*\d+/);
  });

  test("text output includes snapshot location", () => {
    const { stdout } = runSnapshot("");
    expect(stdout).toContain("Location:");
    expect(stdout).toContain("manifest.yaml");
  });

  test("--format=json outputs valid JSON", () => {
    const { stdout, exitCode } = runSnapshot("--format=json");
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("--format=json result has success, mode, fileCount, snapshotPath", () => {
    const { stdout } = runSnapshot("--format=json");
    const result = JSON.parse(stdout);

    expect(result.success).toBe(true);
    expect(result.mode).toBe("create");
    expect(typeof result.fileCount).toBe("number");
    expect(result.fileCount).toBeGreaterThan(0);
    expect(typeof result.snapshotPath).toBe("string");
    expect(result.snapshotPath).toContain("manifest.yaml");
  });

  test("fails with exit code 1 when config file not found", () => {
    const { exitCode } = runSnapshot("", "/nonexistent/path");
    expect(exitCode).toBe(1);
  });

  test("--format=json error output has success=false and error field", () => {
    const result = spawnSync(
      "bun",
      ["run", CLI_PATH, "snapshot", "/nonexistent/path", "--format=json"],
      { encoding: "utf-8", cwd: process.cwd() },
    );
    const output = JSON.parse(result.stdout ?? "{}");
    expect(output.success).toBe(false);
    expect(typeof output.error).toBe("string");
    expect(output.error.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Verify mode
// ============================================================================

describe("kustomark snapshot --verify", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("fails with exit code 1 when no snapshot exists", () => {
    const { exitCode } = runSnapshot("--verify");
    expect(exitCode).toBe(1);
  });

  test("error message mentions creating a snapshot first when none exists", () => {
    const result = spawnSync(
      "bun",
      ["run", CLI_PATH, "snapshot", FIXTURES_DIR, "--verify"],
      { encoding: "utf-8", cwd: process.cwd() },
    );
    const combined = (result.stdout ?? "") + (result.stderr ?? "");
    expect(combined).toContain("snapshot");
  });

  test("exits 0 when build output matches snapshot", () => {
    // Create snapshot first
    runSnapshot("");

    // Verify against same content — should match
    const { exitCode } = runSnapshot("--verify");
    expect(exitCode).toBe(0);
  });

  test("text output reports match when snapshot matches", () => {
    runSnapshot("");
    const { stdout } = runSnapshot("--verify");
    expect(stdout).toContain("matches");
  });

  test("exits 1 when build output differs from snapshot", () => {
    // Create snapshot
    runSnapshot("");

    // Modify source file to change the build output
    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# Hello World

This is a MODIFIED document.

## Section One

Changed content in section one.
`,
    );

    const { exitCode } = runSnapshot("--verify");
    expect(exitCode).toBe(1);
  });

  test("text output shows diff summary when snapshot does not match", () => {
    runSnapshot("");

    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# Totally Different

Completely different content here.
`,
    );

    const { stdout } = runSnapshot("--verify");
    expect(stdout).toContain("Snapshot Verification");
  });

  test("--format=json verify result has success, mode, diff, hasChanges", () => {
    runSnapshot("");

    const { stdout, exitCode } = runSnapshot("--verify --format=json");
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);

    expect(result.mode).toBe("verify");
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.hasChanges).toBe("boolean");
    expect(result.diff).toBeDefined();
    expect(Array.isArray(result.diff.added)).toBe(true);
    expect(Array.isArray(result.diff.removed)).toBe(true);
    expect(Array.isArray(result.diff.modified)).toBe(true);
  });

  test("--format=json success=true and hasChanges=false when snapshot matches", () => {
    runSnapshot("");
    const { stdout } = runSnapshot("--verify --format=json");
    const result = JSON.parse(stdout);

    expect(result.success).toBe(true);
    expect(result.hasChanges).toBe(false);
    expect(result.diff.added).toHaveLength(0);
    expect(result.diff.removed).toHaveLength(0);
    expect(result.diff.modified).toHaveLength(0);
  });

  test("--format=json success=false and hasChanges=true when snapshot differs", () => {
    runSnapshot("");

    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# Different Title

Completely changed content.
`,
    );

    const { stdout } = runSnapshot("--verify --format=json");
    const result = JSON.parse(stdout);

    expect(result.success).toBe(false);
    expect(result.hasChanges).toBe(true);
  });
});

// ============================================================================
// Update mode
// ============================================================================

describe("kustomark snapshot --update", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("fails with exit code 1 when no snapshot exists", () => {
    const { exitCode } = runSnapshot("--update");
    expect(exitCode).toBe(1);
  });

  test("exits 0 and updates snapshot when snapshot exists", () => {
    runSnapshot("");

    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# Updated Title

Modified content for update test.
`,
    );

    const { exitCode } = runSnapshot("--update");
    expect(exitCode).toBe(0);
  });

  test("snapshot manifest timestamp changes after update", () => {
    runSnapshot("");

    const manifestPath = join(FIXTURES_DIR, ".kustomark", "snapshots", "manifest.yaml");
    const before = readFileSync(manifestPath, "utf-8");

    // Small delay then update with changed content
    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# New Content\n\nDifferent text here.\n`,
    );

    runSnapshot("--update");
    const after = readFileSync(manifestPath, "utf-8");

    // Manifest should have been rewritten (content changes since source changed)
    expect(after).not.toBe(before);
  });

  test("text output reports update mode", () => {
    runSnapshot("");
    const { stdout } = runSnapshot("--update");
    expect(stdout).toContain("Snapshot Updated");
  });

  test("reports no changes when content identical on update", () => {
    runSnapshot("");
    const { stdout } = runSnapshot("--update");
    expect(stdout).toContain("No changes");
  });

  test("--format=json update result has mode=update and success=true", () => {
    runSnapshot("");
    const { stdout, exitCode } = runSnapshot("--update --format=json");
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.mode).toBe("update");
    expect(result.success).toBe(true);
  });

  test("--format=json update result includes diff and hasChanges", () => {
    runSnapshot("");

    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# Changed\n\nNew content after update.\n`,
    );

    const { stdout } = runSnapshot("--update --format=json");
    const result = JSON.parse(stdout);
    expect(result.diff).toBeDefined();
    expect(typeof result.hasChanges).toBe("boolean");
  });

  test("updated snapshot is valid for subsequent verify", () => {
    runSnapshot("");

    writeFileSync(
      join(FIXTURES_DIR, "source.md"),
      `# Updated\n\nNew stable content.\n`,
    );

    runSnapshot("--update");

    // Verify should now pass with updated content
    const { exitCode } = runSnapshot("--verify");
    expect(exitCode).toBe(0);
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe("kustomark snapshot edge cases", () => {
  afterEach(() => cleanupFixtures());

  test("accepts directory path (auto-detects kustomark.yaml)", () => {
    setupFixtures();
    const { exitCode } = runSnapshot("");
    expect(exitCode).toBe(0);
  });

  test("fails gracefully with invalid YAML in config", () => {
    setupFixtures();
    writeFileSync(join(FIXTURES_DIR, "kustomark.yaml"), "invalid: yaml: : :\n  bad indent");
    const { exitCode } = runSnapshot("");
    expect(exitCode).toBe(1);
  });

  test("snapshot manifest is sorted by file path", () => {
    setupFixtures();

    // Add a second file with alphabetically earlier name
    writeFileSync(
      join(FIXTURES_DIR, "aaa.md"),
      `# AAA\n\nEarly file.\n`,
    );

    // Update config to include both files
    writeFileSync(
      join(FIXTURES_DIR, "kustomark.yaml"),
      `apiVersion: kustomark/v1
kind: Kustomization
output: output
resources:
  - aaa.md
  - source.md
patches: []
`,
    );

    runSnapshot("");

    const manifestPath = join(FIXTURES_DIR, ".kustomark", "snapshots", "manifest.yaml");
    const content = readFileSync(manifestPath, "utf-8");

    const aPos = content.indexOf("aaa.md");
    const sPos = content.indexOf("source.md");
    expect(aPos).toBeLessThan(sPos);
  });
});
