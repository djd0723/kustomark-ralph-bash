/**
 * Tests for the build history service functions
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getHistoryStats,
  listBuilds,
  loadBuild,
  recordBuild,
  rollbackBuild,
} from "../src/core/build-history.js";
import type { BuildHistoryEntry } from "../src/core/types.js";

const FIXTURES_DIR = "tests/fixtures/history-service";
const CONFIG_PATH = join(FIXTURES_DIR, "kustomark.yaml");

function setup() {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
  mkdirSync(FIXTURES_DIR, { recursive: true });
  // Write a minimal config file
  writeFileSync(
    CONFIG_PATH,
    "apiVersion: kustomark/v1\nkind: Kustomization\noutput: out\nresources: []\n",
  );
}

function cleanup() {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

function makeBuildEntry(overrides: Partial<BuildHistoryEntry> = {}): BuildHistoryEntry {
  return {
    id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    duration: 100,
    success: true,
    configHash: "abc123",
    version: "1.0.0",
    fileCount: 2,
    totalPatchesApplied: 3,
    files: [
      {
        path: "doc.md",
        sourceHash: "src-hash",
        outputHash: "out-hash",
        patchesApplied: 2,
        sourceSize: 100,
        outputSize: 120,
        processedAt: new Date().toISOString(),
      },
    ],
    errors: [],
    warnings: [],
    ...overrides,
  };
}

describe("listBuilds", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("returns empty array when no history exists", async () => {
    const builds = await listBuilds(resolve(CONFIG_PATH));
    expect(builds).toHaveLength(0);
  });

  test("returns recorded builds", async () => {
    const entry = makeBuildEntry();
    await recordBuild(entry, resolve(CONFIG_PATH));

    const builds = await listBuilds(resolve(CONFIG_PATH));
    expect(builds).toHaveLength(1);
    expect(builds[0]?.id).toBe(entry.id);
  });

  test("returns multiple builds in reverse chronological order", async () => {
    const entry1 = makeBuildEntry({ id: "build-001", timestamp: "2026-01-01T10:00:00Z" });
    const entry2 = makeBuildEntry({ id: "build-002", timestamp: "2026-01-01T11:00:00Z" });
    const entry3 = makeBuildEntry({ id: "build-003", timestamp: "2026-01-01T12:00:00Z" });

    await recordBuild(entry1, resolve(CONFIG_PATH));
    await recordBuild(entry2, resolve(CONFIG_PATH));
    await recordBuild(entry3, resolve(CONFIG_PATH));

    const builds = await listBuilds(resolve(CONFIG_PATH));
    expect(builds).toHaveLength(3);
    // Most recent first
    expect(builds[0]?.id).toBe("build-003");
    expect(builds[2]?.id).toBe("build-001");
  });

  test("filters by success=true", async () => {
    const success = makeBuildEntry({ id: "build-success", success: true });
    const failed = makeBuildEntry({ id: "build-failed", success: false });
    await recordBuild(success, resolve(CONFIG_PATH));
    await recordBuild(failed, resolve(CONFIG_PATH));

    const builds = await listBuilds(resolve(CONFIG_PATH), { success: true });
    expect(builds).toHaveLength(1);
    expect(builds[0]?.id).toBe("build-success");
  });

  test("filters by success=false", async () => {
    const success = makeBuildEntry({ id: "build-success", success: true });
    const failed = makeBuildEntry({ id: "build-failed", success: false });
    await recordBuild(success, resolve(CONFIG_PATH));
    await recordBuild(failed, resolve(CONFIG_PATH));

    const builds = await listBuilds(resolve(CONFIG_PATH), { success: false });
    expect(builds).toHaveLength(1);
    expect(builds[0]?.id).toBe("build-failed");
  });

  test("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await recordBuild(makeBuildEntry(), resolve(CONFIG_PATH));
    }

    const builds = await listBuilds(resolve(CONFIG_PATH), { limit: 2 });
    expect(builds).toHaveLength(2);
  });
});

describe("loadBuild", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("returns null when build does not exist", async () => {
    const result = await loadBuild("nonexistent-id", resolve(CONFIG_PATH));
    expect(result).toBeNull();
  });

  test("returns the recorded build entry", async () => {
    const entry = makeBuildEntry({ id: "test-build-123" });
    await recordBuild(entry, resolve(CONFIG_PATH));

    const loaded = await loadBuild("test-build-123", resolve(CONFIG_PATH));
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe("test-build-123");
    expect(loaded?.success).toBe(true);
    expect(loaded?.fileCount).toBe(2);
  });

  test("preserves all entry fields", async () => {
    const entry = makeBuildEntry({
      id: "full-entry",
      duration: 456,
      totalPatchesApplied: 7,
      tags: ["release", "v1"],
      description: "Test build",
    });
    await recordBuild(entry, resolve(CONFIG_PATH));

    const loaded = await loadBuild("full-entry", resolve(CONFIG_PATH));
    expect(loaded?.duration).toBe(456);
    expect(loaded?.totalPatchesApplied).toBe(7);
    expect(loaded?.tags).toEqual(["release", "v1"]);
    expect(loaded?.description).toBe("Test build");
  });
});

describe("getHistoryStats", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("returns zero stats when no history exists", async () => {
    const stats = await getHistoryStats(resolve(CONFIG_PATH));
    expect(stats.totalBuilds).toBe(0);
    expect(stats.successfulBuilds).toBe(0);
    expect(stats.failedBuilds).toBe(0);
    expect(stats.avgFileCount).toBe(0);
  });

  test("counts total builds", async () => {
    await recordBuild(makeBuildEntry(), resolve(CONFIG_PATH));
    await recordBuild(makeBuildEntry(), resolve(CONFIG_PATH));

    const stats = await getHistoryStats(resolve(CONFIG_PATH));
    expect(stats.totalBuilds).toBe(2);
  });

  test("counts successful and failed builds", async () => {
    await recordBuild(makeBuildEntry({ success: true }), resolve(CONFIG_PATH));
    await recordBuild(makeBuildEntry({ success: true }), resolve(CONFIG_PATH));
    await recordBuild(makeBuildEntry({ success: false }), resolve(CONFIG_PATH));

    const stats = await getHistoryStats(resolve(CONFIG_PATH));
    expect(stats.successfulBuilds).toBe(2);
    expect(stats.failedBuilds).toBe(1);
    expect(stats.totalBuilds).toBe(3);
  });

  test("provides oldest and newest build timestamps", async () => {
    await recordBuild(
      makeBuildEntry({ timestamp: "2026-01-01T10:00:00Z" }),
      resolve(CONFIG_PATH),
    );
    await recordBuild(
      makeBuildEntry({ timestamp: "2026-01-02T10:00:00Z" }),
      resolve(CONFIG_PATH),
    );

    const stats = await getHistoryStats(resolve(CONFIG_PATH));
    expect(stats.oldestBuild).toBe("2026-01-01T10:00:00Z");
    expect(stats.newestBuild).toBe("2026-01-02T10:00:00Z");
  });

  test("calculates average file count", async () => {
    await recordBuild(makeBuildEntry({ fileCount: 2 }), resolve(CONFIG_PATH));
    await recordBuild(makeBuildEntry({ fileCount: 4 }), resolve(CONFIG_PATH));

    const stats = await getHistoryStats(resolve(CONFIG_PATH));
    expect(stats.avgFileCount).toBe(3);
  });
});

describe("rollbackBuild", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("returns success=false when build output snapshot is missing", async () => {
    // Record a build entry (no output snapshot stored on disk)
    const entry = makeBuildEntry({ id: "rollback-no-snapshot" });
    await recordBuild(entry, resolve(CONFIG_PATH));

    const outputDir = join(FIXTURES_DIR, "out");
    mkdirSync(outputDir, { recursive: true });

    // rollbackBuild requires stored file content under
    // .kustomark/history/builds/{id}/output/ — if missing, returns success=false
    const result = await rollbackBuild("rollback-no-snapshot", outputDir, resolve(CONFIG_PATH));
    expect(result.success).toBe(false);
    expect(result.filesRestored).toHaveLength(0);
  });

  test("throws for nonexistent build ID", async () => {
    const outputDir = join(FIXTURES_DIR, "out");
    mkdirSync(outputDir, { recursive: true });

    // rollbackBuild throws rather than returning { success: false } for unknown IDs
    await expect(
      rollbackBuild("nonexistent-build", outputDir, resolve(CONFIG_PATH)),
    ).rejects.toThrow("nonexistent-build");
  });

  test("restores files when build output snapshot exists", async () => {
    const outputDir = join(FIXTURES_DIR, "out");
    mkdirSync(outputDir, { recursive: true });
    const fileContent = "# Restored file\n\nContent.\n";
    writeFileSync(join(outputDir, "doc.md"), "# Current version\n");

    const entry = makeBuildEntry({
      id: "rollback-with-snapshot",
      files: [
        {
          path: "doc.md",
          sourceHash: "src-hash",
          outputHash: "out-hash",
          patchesApplied: 1,
          sourceSize: fileContent.length,
          outputSize: fileContent.length,
          processedAt: new Date().toISOString(),
        },
      ],
    });
    await recordBuild(entry, resolve(CONFIG_PATH));

    // Create the snapshot directory that rollbackBuild reads from
    const snapshotDir = join(
      FIXTURES_DIR,
      ".kustomark",
      "history",
      "builds",
      "rollback-with-snapshot",
      "output",
    );
    mkdirSync(snapshotDir, { recursive: true });
    writeFileSync(join(snapshotDir, "doc.md"), fileContent);

    const result = await rollbackBuild(
      "rollback-with-snapshot",
      outputDir,
      resolve(CONFIG_PATH),
    );

    expect(result.success).toBe(true);
    expect(result.filesRestored).toContain("doc.md");
  });
});
