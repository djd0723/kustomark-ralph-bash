/**
 * Tests for the `kustomark history` command
 *
 * Covers list, show, diff, rollback, clean, and stats subcommands
 * with both text and JSON output formats.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = process.cwd();
// Use absolute path so bun can find the file when cwd is set to FIXTURES_DIR
const CLI_PATH = join(PROJECT_ROOT, "src/cli/index.ts");
const FIXTURES_DIR = join(PROJECT_ROOT, "tests/fixtures/history");

// ============================================================================
// Helpers
// ============================================================================

function setupFixtures(dir: string = FIXTURES_DIR): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "kustomark.yaml"),
    "apiVersion: kustomark/v1\nkind: Kustomization\noutput: output\nresources:\n  - source.md\n",
  );
  writeFileSync(join(dir, "source.md"), "# Source\n\nContent.\n");
}

function cleanupFixtures(dir: string = FIXTURES_DIR): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

interface BuildEntry {
  id: string;
  timestamp: string;
  status: "success" | "error";
  duration: number;
  configHash: string;
  patchCount: number;
  fileCount: number;
  files: Array<{ path: string; hash: string; size: number }>;
  error?: string;
}

function makeEntry(id: string, overrides: Partial<Omit<BuildEntry, "id">> = {}): BuildEntry {
  return {
    id,
    timestamp: "2026-01-01T10:00:00.000Z",
    status: "success",
    duration: 150,
    configHash: "abc123hash",
    patchCount: 2,
    fileCount: 1,
    files: [{ path: "output/source.md", hash: "filehash1", size: 100 }],
    ...overrides,
  };
}

/** Serialize a BuildEntry to an indented YAML block (no leading newline). */
function entryToYaml(b: BuildEntry): string {
  const filesYaml = b.files
    .map(
      (f) =>
        `      - path: '${f.path}'\n        hash: ${f.hash}\n        size: ${f.size}`,
    )
    .join("\n");
  let block =
    `  - id: ${b.id}\n` +
    `    timestamp: '${b.timestamp}'\n` +
    `    status: ${b.status}\n` +
    `    duration: ${b.duration}\n` +
    `    configHash: ${b.configHash}\n` +
    `    patchCount: ${b.patchCount}\n` +
    `    fileCount: ${b.fileCount}\n` +
    `    files:\n${filesYaml}`;
  if (b.error) block += `\n    error: '${b.error}'`;
  return block;
}

/** Write a history manifest to the fixture directory. Builds should be newest-first. */
function seedHistory(builds: BuildEntry[], dir: string = FIXTURES_DIR): void {
  const histDir = join(dir, ".kustomark", "history");
  mkdirSync(histDir, { recursive: true });
  const entriesYaml = builds.map(entryToYaml).join("\n");
  writeFileSync(
    join(histDir, "manifest.yaml"),
    `version: '1.0'\nbuilds:\n${entriesYaml}\n`,
  );
}

function runHistory(
  args: string[],
  dir: string = FIXTURES_DIR,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, "history", ...args], {
    encoding: "utf-8",
    cwd: dir,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// ============================================================================
// list subcommand
// ============================================================================

describe("kustomark history list", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("exits 0 with no history", () => {
    const { exitCode } = runHistory(["list"]);
    expect(exitCode).toBe(0);
  });

  test("text output says 'No build history found' when empty", () => {
    const { stdout } = runHistory(["list"]);
    expect(stdout).toContain("No build history found");
  });

  test("JSON output has total: 0 when empty", () => {
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.total).toBe(0);
  });

  test("JSON output has empty builds array when empty", () => {
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.builds).toEqual([]);
  });

  test("JSON output has hasMore: false when empty", () => {
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.hasMore).toBe(false);
  });

  test("exits 0 with 1 build in history", () => {
    seedHistory([makeEntry("build-001")]);
    const { exitCode } = runHistory(["list"]);
    expect(exitCode).toBe(0);
  });

  test("JSON total is 1 with 1 build", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.total).toBe(1);
  });

  test("JSON builds array has 1 entry with 1 build", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.builds).toHaveLength(1);
  });

  test("text output contains build ID", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["list"]);
    expect(stdout).toContain("build-001");
  });

  test("JSON total matches number of seeded builds", () => {
    seedHistory([
      makeEntry("build-003", { timestamp: "2026-01-03T10:00:00.000Z" }),
      makeEntry("build-002", { timestamp: "2026-01-02T10:00:00.000Z" }),
      makeEntry("build-001", { timestamp: "2026-01-01T10:00:00.000Z" }),
    ]);
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.total).toBe(3);
  });

  test("--status=success filters out error builds", () => {
    seedHistory([
      makeEntry("build-002", { timestamp: "2026-01-02T10:00:00.000Z", status: "error" }),
      makeEntry("build-001", { timestamp: "2026-01-01T10:00:00.000Z", status: "success" }),
    ]);
    const { stdout } = runHistory(["list", "--format=json", "--status=success"]);
    const json = JSON.parse(stdout);
    expect(json.total).toBe(1);
    expect(json.builds[0].id).toBe("build-001");
  });

  test("--status=error filters out success builds", () => {
    seedHistory([
      makeEntry("build-002", { timestamp: "2026-01-02T10:00:00.000Z", status: "error" }),
      makeEntry("build-001", { timestamp: "2026-01-01T10:00:00.000Z", status: "success" }),
    ]);
    const { stdout } = runHistory(["list", "--format=json", "--status=error"]);
    const json = JSON.parse(stdout);
    expect(json.total).toBe(1);
    expect(json.builds[0].id).toBe("build-002");
  });

  test("--limit=1 returns only 1 build and hasMore: true when more exist", () => {
    seedHistory([
      makeEntry("build-003", { timestamp: "2026-01-03T10:00:00.000Z" }),
      makeEntry("build-002", { timestamp: "2026-01-02T10:00:00.000Z" }),
      makeEntry("build-001", { timestamp: "2026-01-01T10:00:00.000Z" }),
    ]);
    const { stdout } = runHistory(["list", "--format=json", "--limit=1"]);
    const json = JSON.parse(stdout);
    expect(json.builds).toHaveLength(1);
    expect(json.hasMore).toBe(true);
  });
});

// ============================================================================
// show subcommand
// ============================================================================

describe("kustomark history show", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("exits 1 with no history", () => {
    const { exitCode } = runHistory(["show", "build-001"]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for unknown build ID", () => {
    seedHistory([makeEntry("build-001")]);
    const { exitCode } = runHistory(["show", "unknown-xyz"]);
    expect(exitCode).toBe(1);
  });

  test("exits 0 for valid build ID", () => {
    seedHistory([makeEntry("build-001")]);
    const { exitCode } = runHistory(["show", "build-001"]);
    expect(exitCode).toBe(0);
  });

  test("JSON output has id field matching the requested build", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["show", "build-001", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.id).toBe("build-001");
  });

  test("JSON output has status field", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["show", "build-001", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.status).toBe("success");
  });

  test("JSON output has timestamp, duration, configHash, patchCount, fileCount", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["show", "build-001", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.timestamp).toBeDefined();
    expect(json.duration).toBe(150);
    expect(json.configHash).toBe("abc123hash");
    expect(json.patchCount).toBe(2);
    expect(json.fileCount).toBe(1);
  });

  test("text output contains 'Build ID:'", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["show", "build-001"]);
    expect(stdout).toContain("Build ID:");
  });

  test("failed build JSON includes error field", () => {
    seedHistory([
      makeEntry("build-001", { status: "error", error: "Patch failed to apply" }),
    ]);
    const { stdout } = runHistory(["show", "build-001", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.status).toBe("error");
    expect(json.error).toContain("Patch failed");
  });
});

// ============================================================================
// diff subcommand
// ============================================================================

describe("kustomark history diff", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("exits 1 with no history", () => {
    const { exitCode } = runHistory(["diff", "build-001", "build-002"]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for unknown fromId", () => {
    seedHistory([makeEntry("build-001")]);
    const { exitCode } = runHistory(["diff", "unknown-from", "build-001"]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for unknown toId", () => {
    seedHistory([makeEntry("build-001")]);
    const { exitCode } = runHistory(["diff", "build-001", "unknown-to"]);
    expect(exitCode).toBe(1);
  });

  test("same build compared with itself shows no differences", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["diff", "build-001", "build-001"]);
    expect(stdout).toContain("No differences found");
  });

  test("added file appears in JSON added array", () => {
    seedHistory([
      makeEntry("build-002", {
        timestamp: "2026-01-02T10:00:00.000Z",
        files: [
          { path: "output/source.md", hash: "hash1", size: 100 },
          { path: "output/new.md", hash: "hash2", size: 50 },
        ],
        fileCount: 2,
      }),
      makeEntry("build-001", {
        timestamp: "2026-01-01T10:00:00.000Z",
        files: [{ path: "output/source.md", hash: "hash1", size: 100 }],
        fileCount: 1,
      }),
    ]);
    const { stdout } = runHistory(["diff", "build-001", "build-002", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.added).toContain("output/new.md");
  });

  test("removed file appears in JSON removed array", () => {
    seedHistory([
      makeEntry("build-002", {
        timestamp: "2026-01-02T10:00:00.000Z",
        files: [{ path: "output/source.md", hash: "hash1", size: 100 }],
        fileCount: 1,
      }),
      makeEntry("build-001", {
        timestamp: "2026-01-01T10:00:00.000Z",
        files: [
          { path: "output/source.md", hash: "hash1", size: 100 },
          { path: "output/old.md", hash: "hash3", size: 75 },
        ],
        fileCount: 2,
      }),
    ]);
    const { stdout } = runHistory(["diff", "build-001", "build-002", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.removed).toContain("output/old.md");
  });

  test("hash-changed file appears in JSON modified array", () => {
    seedHistory([
      makeEntry("build-002", {
        timestamp: "2026-01-02T10:00:00.000Z",
        files: [{ path: "output/source.md", hash: "newhash", size: 120 }],
      }),
      makeEntry("build-001", {
        timestamp: "2026-01-01T10:00:00.000Z",
        files: [{ path: "output/source.md", hash: "oldhash", size: 100 }],
      }),
    ]);
    const { stdout } = runHistory(["diff", "build-001", "build-002", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.modified).toHaveLength(1);
    expect(json.modified[0].path).toBe("output/source.md");
  });

  test("identical file appears in JSON unchanged array", () => {
    seedHistory([
      makeEntry("build-002", {
        timestamp: "2026-01-02T10:00:00.000Z",
        files: [{ path: "output/source.md", hash: "hash1", size: 100 }],
      }),
      makeEntry("build-001", {
        timestamp: "2026-01-01T10:00:00.000Z",
        files: [{ path: "output/source.md", hash: "hash1", size: 100 }],
      }),
    ]);
    const { stdout } = runHistory(["diff", "build-001", "build-002", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.unchanged).toContain("output/source.md");
  });

  test("JSON has from, to, added, removed, modified, unchanged fields", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["diff", "build-001", "build-001", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.from).toBeDefined();
    expect(json.to).toBeDefined();
    expect(Array.isArray(json.added)).toBe(true);
    expect(Array.isArray(json.removed)).toBe(true);
    expect(Array.isArray(json.modified)).toBe(true);
    expect(Array.isArray(json.unchanged)).toBe(true);
  });

  test("text output contains 'Build Comparison'", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["diff", "build-001", "build-001"]);
    expect(stdout).toContain("Build Comparison");
  });
});

// ============================================================================
// rollback subcommand
// ============================================================================

describe("kustomark history rollback", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("exits 1 with no history", () => {
    const { exitCode } = runHistory(["rollback", "build-001"]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for unknown build ID", () => {
    seedHistory([makeEntry("build-001")]);
    const { exitCode } = runHistory(["rollback", "unknown-xyz"]);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for a failed build", () => {
    seedHistory([makeEntry("build-001", { status: "error", error: "Build failed" })]);
    const { exitCode } = runHistory(["rollback", "build-001"]);
    expect(exitCode).toBe(1);
  });

  test("exits 0 for a successful build", () => {
    seedHistory([makeEntry("build-001", { status: "success" })]);
    const { exitCode } = runHistory(["rollback", "build-001"]);
    expect(exitCode).toBe(0);
  });

  test("--dry-run shows DRY RUN in text output", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["rollback", "build-001", "--dry-run"]);
    expect(stdout).toContain("DRY RUN");
  });

  test("JSON output has success, buildId, fileCount, dryRun fields", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["rollback", "build-001", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.success).toBe(true);
    expect(json.buildId).toBe("build-001");
    expect(json.fileCount).toBe(1);
    expect(json.dryRun).toBe(false);
  });

  test("JSON dryRun field is true when --dry-run is passed", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["rollback", "build-001", "--format=json", "--dry-run"]);
    const json = JSON.parse(stdout);
    expect(json.dryRun).toBe(true);
  });
});

// ============================================================================
// clean subcommand
// ============================================================================

describe("kustomark history clean", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("exits 0 with no history", () => {
    const { exitCode } = runHistory(["clean"]);
    expect(exitCode).toBe(0);
  });

  test("text output says 'No build history to clean' when empty", () => {
    const { stdout } = runHistory(["clean"]);
    expect(stdout).toContain("No build history to clean");
  });

  test("empty history JSON has removedCount: 0", () => {
    const { stdout } = runHistory(["clean", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.removedCount).toBe(0);
  });

  test("default clean keeps 10 most recent builds and removes the rest", () => {
    // 15 builds, newest first
    const builds = Array.from({ length: 15 }, (_, i) =>
      makeEntry(`build-${String(15 - i).padStart(3, "0")}`, {
        timestamp: `2026-01-${String(15 - i).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    seedHistory(builds);
    const { stdout } = runHistory(["clean", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.removedCount).toBe(5);
    expect(json.keptCount).toBe(10);
  });

  test("--keep-last=3 keeps 3 newest builds and removes the rest", () => {
    const builds = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`build-${String(5 - i).padStart(3, "0")}`, {
        timestamp: `2026-01-0${5 - i}T10:00:00.000Z`,
      }),
    );
    seedHistory(builds);
    const { stdout } = runHistory(["clean", "--format=json", "--keep-last=3"]);
    const json = JSON.parse(stdout);
    expect(json.keptCount).toBe(3);
    expect(json.removedCount).toBe(2);
  });

  test("--dry-run does not modify the manifest", () => {
    const builds = Array.from({ length: 15 }, (_, i) =>
      makeEntry(`build-${String(15 - i).padStart(3, "0")}`, {
        timestamp: `2026-01-${String(15 - i).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    seedHistory(builds);
    runHistory(["clean", "--dry-run"]);
    // Manifest should still have all 15 builds
    const { stdout } = runHistory(["list", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.total).toBe(15);
  });

  test("--dry-run JSON has dryRun: true", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["clean", "--format=json", "--dry-run"]);
    const json = JSON.parse(stdout);
    expect(json.dryRun).toBe(true);
  });

  test("JSON result has removedCount and keptCount fields", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["clean", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.removedCount).toBeDefined();
    expect(json.keptCount).toBeDefined();
  });

  test("text output shows 'Removed:' and 'Kept:' counts when builds are removed", () => {
    const builds = Array.from({ length: 12 }, (_, i) =>
      makeEntry(`build-${String(12 - i).padStart(3, "0")}`, {
        timestamp: `2026-01-${String(12 - i).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    seedHistory(builds);
    const { stdout } = runHistory(["clean"]);
    expect(stdout).toContain("Removed:");
    expect(stdout).toContain("Kept:");
  });
});

// ============================================================================
// stats subcommand
// ============================================================================

describe("kustomark history stats", () => {
  beforeEach(() => setupFixtures());
  afterEach(() => cleanupFixtures());

  test("exits 0 with no history", () => {
    const { exitCode } = runHistory(["stats"]);
    expect(exitCode).toBe(0);
  });

  test("text output says 'No build history found' when empty", () => {
    const { stdout } = runHistory(["stats"]);
    expect(stdout).toContain("No build history found");
  });

  test("empty history JSON has totalBuilds: 0", () => {
    const { stdout } = runHistory(["stats", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.totalBuilds).toBe(0);
  });

  test("JSON has successfulBuilds and failedBuilds fields", () => {
    seedHistory([
      makeEntry("build-002", { timestamp: "2026-01-02T10:00:00.000Z", status: "error" }),
      makeEntry("build-001", { timestamp: "2026-01-01T10:00:00.000Z", status: "success" }),
    ]);
    const { stdout } = runHistory(["stats", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.successfulBuilds).toBeDefined();
    expect(json.failedBuilds).toBeDefined();
  });

  test("successfulBuilds + failedBuilds equals totalBuilds", () => {
    seedHistory([
      makeEntry("build-003", { timestamp: "2026-01-03T10:00:00.000Z", status: "success" }),
      makeEntry("build-002", { timestamp: "2026-01-02T10:00:00.000Z", status: "error" }),
      makeEntry("build-001", { timestamp: "2026-01-01T10:00:00.000Z", status: "success" }),
    ]);
    const { stdout } = runHistory(["stats", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.successfulBuilds + json.failedBuilds).toBe(json.totalBuilds);
    expect(json.successfulBuilds).toBe(2);
    expect(json.failedBuilds).toBe(1);
  });

  test("JSON averageDuration equals the duration when there is one build", () => {
    seedHistory([makeEntry("build-001", { duration: 200 })]);
    const { stdout } = runHistory(["stats", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.averageDuration).toBe(200);
  });

  test("JSON has buildFrequency with lastHour, lastDay, lastWeek, lastMonth fields", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["stats", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.buildFrequency).toBeDefined();
    expect(json.buildFrequency.lastHour).toBeDefined();
    expect(json.buildFrequency.lastDay).toBeDefined();
    expect(json.buildFrequency.lastWeek).toBeDefined();
    expect(json.buildFrequency.lastMonth).toBeDefined();
  });

  test("JSON has trends with durationTrend and fileCountTrend fields", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["stats", "--format=json"]);
    const json = JSON.parse(stdout);
    expect(json.trends).toBeDefined();
    expect(json.trends.durationTrend).toBeDefined();
    expect(json.trends.fileCountTrend).toBeDefined();
  });

  test("text output contains 'Overview:', 'Performance:', and 'Trends:'", () => {
    seedHistory([makeEntry("build-001")]);
    const { stdout } = runHistory(["stats"]);
    expect(stdout).toContain("Overview:");
    expect(stdout).toContain("Performance:");
    expect(stdout).toContain("Trends:");
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe("kustomark history - error handling", () => {
  const EMPTY_DIR = join(PROJECT_ROOT, "tests/fixtures/history-no-config");

  beforeEach(() => {
    setupFixtures();
    if (existsSync(EMPTY_DIR)) rmSync(EMPTY_DIR, { recursive: true, force: true });
    mkdirSync(EMPTY_DIR, { recursive: true });
    // EMPTY_DIR deliberately has no kustomark.yaml
  });

  afterEach(() => {
    cleanupFixtures();
    if (existsSync(EMPTY_DIR)) rmSync(EMPTY_DIR, { recursive: true, force: true });
  });

  test("exits 1 when kustomark.yaml is missing from cwd", () => {
    const { exitCode } = runHistory(["list"], EMPTY_DIR);
    expect(exitCode).toBe(1);
  });

  test("exits 1 for an unknown subcommand", () => {
    const { exitCode } = runHistory(["unknown-subcommand"]);
    expect(exitCode).toBe(1);
  });

  test("unknown subcommand error message lists valid subcommands", () => {
    const { stdout, stderr } = runHistory(["unknown-subcommand"]);
    const combined = stdout + stderr;
    // The error message includes "Valid subcommands: list, show, ..."
    expect(combined).toContain("list");
  });

  test("show without build ID exits 1", () => {
    const { exitCode } = runHistory(["show"]);
    expect(exitCode).toBe(1);
  });

  test("diff with only one build ID exits 1", () => {
    const { exitCode } = runHistory(["diff", "build-001"]);
    expect(exitCode).toBe(1);
  });

  test("rollback without build ID exits 1", () => {
    const { exitCode } = runHistory(["rollback"]);
    expect(exitCode).toBe(1);
  });
});
