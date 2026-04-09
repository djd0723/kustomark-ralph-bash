/**
 * Tests for build history system
 *
 * These tests verify the build history tracking functionality:
 * - Recording builds with complete metadata
 * - Loading builds and manifest from disk
 * - Listing builds with filtering capabilities
 * - Comparing builds to detect differences
 * - Rollback operations to restore previous states
 * - Pruning history to manage storage
 * - Clearing history
 * - Error handling (corrupted data, missing files)
 * - Complete workflow integration
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  BuildHistoryEntry,
  BuildHistoryManifest,
  BuildFileEntry,
  BuildComparisonResult,
  ValidationError,
  ValidationWarning,
} from "../../src/core/types.js";

// Import functions from build-history module (to be implemented)
import {
  recordBuild,
  loadBuild,
  loadManifest,
  listBuilds,
  compareBuildHistory,
  rollbackBuild,
  pruneHistory,
  clearHistory,
  getHistoryDirectory,
  saveBuildToHistory,
  getBuildById,
  getLatestBuild,
  deleteBuild,
} from "../../src/core/build-history.js";

const TEST_DIR = join(tmpdir(), "kustomark-test-history", `history-test-${Date.now()}`);

describe("Build History Module", () => {
  beforeEach(async () => {
    await mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("getHistoryDirectory", () => {
    test("should return .kustomark/history directory in config location", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      expect(historyDir).toBe(join(TEST_DIR, ".kustomark", "history"));
    });

    test("should handle nested config paths", () => {
      const configPath = join(TEST_DIR, "nested", "config", "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      expect(historyDir).toBe(join(TEST_DIR, "nested", "config", ".kustomark", "history"));
    });

    test("should handle file paths at root level", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      expect(historyDir).toBe(join(TEST_DIR, ".kustomark", "history"));
    });
  });

  describe("recordBuild", () => {
    test("should record a successful build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const buildEntry: BuildHistoryEntry = {
        id: "build-001",
        timestamp: new Date().toISOString(),
        duration: 1500,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 2,
        totalPatchesApplied: 5,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 3,
            sourceSize: 100,
            outputSize: 120,
            processedAt: new Date().toISOString(),
          },
          {
            path: "docs/guide.md",
            sourceHash: "hash3",
            outputHash: "hash4",
            patchesApplied: 2,
            sourceSize: 200,
            outputSize: 210,
            processedAt: new Date().toISOString(),
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(buildEntry, configPath);

      const historyDir = getHistoryDirectory(configPath);
      expect(existsSync(historyDir)).toBe(true);

      // Verify build file exists
      const buildFilePath = join(historyDir, "builds", `${buildEntry.id}.json`);
      expect(existsSync(buildFilePath)).toBe(true);

      // Verify manifest was created/updated
      const manifestPath = join(historyDir, "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);
    });

    test("should record a failed build with errors", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const buildEntry: BuildHistoryEntry = {
        id: "build-002",
        timestamp: new Date().toISOString(),
        duration: 500,
        success: false,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 0,
        files: [],
        errors: [
          {
            message: "File not found",
            path: "missing.md",
            line: 0,
            column: 0,
            severity: "error",
          },
        ],
        warnings: [],
      };

      await recordBuild(buildEntry, configPath);

      const loadedBuild = await loadBuild(buildEntry.id, configPath);
      expect(loadedBuild).not.toBeNull();
      if (loadedBuild) {
        expect(loadedBuild.success).toBe(false);
        expect(loadedBuild.errors).toHaveLength(1);
        expect(loadedBuild.errors[0]?.message).toBe("File not found");
      }
    });

    test("should create history directory if it doesn't exist", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      expect(existsSync(historyDir)).toBe(false);

      const buildEntry: BuildHistoryEntry = {
        id: "build-003",
        timestamp: new Date().toISOString(),
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 0,
        totalPatchesApplied: 0,
        files: [],
        errors: [],
        warnings: [],
      };

      await recordBuild(buildEntry, configPath);

      expect(existsSync(historyDir)).toBe(true);
    });

    test("should record build with tags and description", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const buildEntry: BuildHistoryEntry = {
        id: "build-004",
        timestamp: new Date().toISOString(),
        duration: 1200,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [],
        errors: [],
        warnings: [],
        tags: ["production", "release"],
        description: "Production release v2.0",
      };

      await recordBuild(buildEntry, configPath);

      const loadedBuild = await loadBuild(buildEntry.id, configPath);
      expect(loadedBuild?.tags).toEqual(["production", "release"]);
      expect(loadedBuild?.description).toBe("Production release v2.0");
    });

    test("should record build with group filters", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const buildEntry: BuildHistoryEntry = {
        id: "build-005",
        timestamp: new Date().toISOString(),
        duration: 1100,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 1,
        files: [],
        errors: [],
        warnings: [],
        groupFilters: {
          enabled: ["docs", "api"],
          disabled: ["internal"],
        },
      };

      await recordBuild(buildEntry, configPath);

      const loadedBuild = await loadBuild(buildEntry.id, configPath);
      expect(loadedBuild?.groupFilters?.enabled).toEqual(["docs", "api"]);
      expect(loadedBuild?.groupFilters?.disabled).toEqual(["internal"]);
    });

    test("should handle builds with warnings", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const buildEntry: BuildHistoryEntry = {
        id: "build-006",
        timestamp: new Date().toISOString(),
        duration: 1300,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 2,
        totalPatchesApplied: 3,
        files: [],
        errors: [],
        warnings: [
          {
            message: "Deprecated syntax used",
            path: "old-doc.md",
            line: 10,
            column: 5,
            severity: "warning",
          },
        ],
      };

      await recordBuild(buildEntry, configPath);

      const loadedBuild = await loadBuild(buildEntry.id, configPath);
      expect(loadedBuild?.warnings).toHaveLength(1);
      expect(loadedBuild?.warnings[0]?.message).toBe("Deprecated syntax used");
    });
  });

  describe("loadBuild and loadManifest", () => {
    test("should load existing build by ID", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const buildEntry: BuildHistoryEntry = {
        id: "build-007",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1400,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [
          {
            path: "test.md",
            sourceHash: "src1",
            outputHash: "out1",
            patchesApplied: 2,
            sourceSize: 50,
            outputSize: 60,
            processedAt: "2024-01-01T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(buildEntry, configPath);

      const loadedBuild = await loadBuild("build-007", configPath);
      expect(loadedBuild).not.toBeNull();
      if (loadedBuild) {
        expect(loadedBuild.id).toBe("build-007");
        expect(loadedBuild.timestamp).toBe("2024-01-01T12:00:00Z");
        expect(loadedBuild.duration).toBe(1400);
        expect(loadedBuild.fileCount).toBe(1);
        expect(loadedBuild.files).toHaveLength(1);
      }
    });

    test("should return null for non-existent build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const build = await loadBuild("non-existent-build", configPath);

      expect(build).toBeNull();
    });

    test("should load manifest with multiple builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Record multiple builds
      for (let i = 1; i <= 3; i++) {
        const buildEntry: BuildHistoryEntry = {
          id: `build-${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          duration: 1000 + i * 100,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: i,
          totalPatchesApplied: i * 2,
          files: [],
          errors: [],
          warnings: [],
        };
        await recordBuild(buildEntry, configPath);
      }

      const manifest = await loadManifest(configPath);
      expect(manifest).not.toBeNull();
      if (manifest) {
        expect(manifest.totalBuilds).toBe(3);
        expect(manifest.builds.size).toBe(3);
        expect(manifest.latestBuildId).toBe("build-3");
      }
    });

    test("should return null for non-existent manifest", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const manifest = await loadManifest(configPath);

      expect(manifest).toBeNull();
    });

    test("should handle corrupted build file gracefully", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);
      const buildsDir = join(historyDir, "builds");

      mkdirSync(buildsDir, { recursive: true });
      writeFileSync(join(buildsDir, "corrupted-build.json"), "invalid json {", "utf-8");

      const build = await loadBuild("corrupted-build", configPath);
      expect(build).toBeNull();
    });

    test("should handle corrupted manifest gracefully", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      mkdirSync(historyDir, { recursive: true });
      writeFileSync(join(historyDir, "manifest.json"), "not valid json {", "utf-8");

      const manifest = await loadManifest(configPath);
      expect(manifest).toBeNull();
    });

    test("should handle empty manifest file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      mkdirSync(historyDir, { recursive: true });
      writeFileSync(join(historyDir, "manifest.json"), "", "utf-8");

      const manifest = await loadManifest(configPath);
      expect(manifest).toBeNull();
    });
  });

  describe("listBuilds", () => {
    test("should list all builds in chronological order", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Record builds with different timestamps
      for (let i = 1; i <= 5; i++) {
        const buildEntry: BuildHistoryEntry = {
          id: `build-${i}`,
          timestamp: new Date(Date.now() - (5 - i) * 60000).toISOString(), // Ascending time
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        };
        await recordBuild(buildEntry, configPath);
      }

      const builds = await listBuilds(configPath);
      expect(builds).toHaveLength(5);
      expect(builds[0]?.id).toBe("build-5"); // Most recent first
      expect(builds[4]?.id).toBe("build-1"); // Oldest last
    });

    test("should filter builds by success status", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Record successful builds
      for (let i = 1; i <= 3; i++) {
        await recordBuild(
          {
            id: `success-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        );
      }

      // Record failed builds
      for (let i = 1; i <= 2; i++) {
        await recordBuild(
          {
            id: `failed-${i}`,
            timestamp: new Date(Date.now() + (i + 3) * 1000).toISOString(),
            duration: 500,
            success: false,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 0,
            totalPatchesApplied: 0,
            files: [],
            errors: [{ message: "Error", path: "", line: 0, column: 0, severity: "error" }],
            warnings: [],
          },
          configPath,
        );
      }

      const successBuilds = await listBuilds(configPath, { success: true });
      expect(successBuilds).toHaveLength(3);
      expect(successBuilds.every((b) => b.success)).toBe(true);

      const failedBuilds = await listBuilds(configPath, { success: false });
      expect(failedBuilds).toHaveLength(2);
      expect(failedBuilds.every((b) => !b.success)).toBe(true);
    });

    test("should filter builds by tags", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await recordBuild(
        {
          id: "build-1",
          timestamp: new Date().toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
          tags: ["production", "release"],
        },
        configPath,
      );

      await recordBuild(
        {
          id: "build-2",
          timestamp: new Date().toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
          tags: ["development"],
        },
        configPath,
      );

      const prodBuilds = await listBuilds(configPath, { tags: ["production"] });
      expect(prodBuilds).toHaveLength(1);
      expect(prodBuilds[0]?.id).toBe("build-1");
    });

    test("should filter builds by date range", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const now = Date.now();

      // Build from yesterday
      await recordBuild(
        {
          id: "build-yesterday",
          timestamp: new Date(now - 86400000).toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      // Build from today
      await recordBuild(
        {
          id: "build-today",
          timestamp: new Date(now).toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      const todayBuilds = await listBuilds(configPath, {
        after: new Date(now - 3600000).toISOString(), // 1 hour ago
      });
      expect(todayBuilds).toHaveLength(1);
      expect(todayBuilds[0]?.id).toBe("build-today");
    });

    test("should limit number of results", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      for (let i = 1; i <= 10; i++) {
        await recordBuild(
          {
            id: `build-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        );
      }

      const builds = await listBuilds(configPath, { limit: 5 });
      expect(builds).toHaveLength(5);
    });

    test("should return empty array when no builds exist", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const builds = await listBuilds(configPath);

      expect(builds).toEqual([]);
    });
  });

  describe("compareBuildHistory", () => {
    test("should compare two builds and detect file additions", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const build1: BuildHistoryEntry = {
        id: "build-baseline",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-01T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      const build2: BuildHistoryEntry = {
        id: "build-target",
        timestamp: "2024-01-02T12:00:00Z",
        duration: 1200,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 2,
        totalPatchesApplied: 4,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-02T12:00:01Z",
          },
          {
            path: "new-file.md",
            sourceHash: "hash3",
            outputHash: "hash4",
            patchesApplied: 2,
            sourceSize: 50,
            outputSize: 60,
            processedAt: "2024-01-02T12:00:02Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);
      await recordBuild(build2, configPath);

      const comparison = await compareBuildHistory("build-baseline", "build-target", configPath);

      expect(comparison.filesAdded).toEqual(["new-file.md"]);
      expect(comparison.filesRemoved).toHaveLength(0);
      expect(comparison.filesModified).toHaveLength(0);
      expect(comparison.differenceCount).toBe(1);
      expect(comparison.configChanged).toBe(false);
    });

    test("should detect file removals", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const build1: BuildHistoryEntry = {
        id: "build-with-files",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 2,
        totalPatchesApplied: 4,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-01T12:00:01Z",
          },
          {
            path: "removed.md",
            sourceHash: "hash3",
            outputHash: "hash4",
            patchesApplied: 2,
            sourceSize: 50,
            outputSize: 60,
            processedAt: "2024-01-01T12:00:02Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      const build2: BuildHistoryEntry = {
        id: "build-without-file",
        timestamp: "2024-01-02T12:00:00Z",
        duration: 800,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-02T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);
      await recordBuild(build2, configPath);

      const comparison = await compareBuildHistory("build-with-files", "build-without-file", configPath);

      expect(comparison.filesRemoved).toEqual(["removed.md"]);
      expect(comparison.filesAdded).toHaveLength(0);
      expect(comparison.differenceCount).toBe(1);
    });

    test("should detect file modifications", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const build1: BuildHistoryEntry = {
        id: "build-original",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-01T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      const build2: BuildHistoryEntry = {
        id: "build-modified",
        timestamp: "2024-01-02T12:00:00Z",
        duration: 1100,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 3,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1-modified",
            outputHash: "hash2-modified",
            patchesApplied: 3,
            sourceSize: 100,
            outputSize: 150,
            processedAt: "2024-01-02T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);
      await recordBuild(build2, configPath);

      const comparison = await compareBuildHistory("build-original", "build-modified", configPath);

      expect(comparison.filesModified).toHaveLength(1);
      const modified = comparison.filesModified[0];
      if (modified) {
        expect(modified.path).toBe("readme.md");
        expect(modified.baselineHash).toBe("hash2");
        expect(modified.targetHash).toBe("hash2-modified");
        expect(modified.sizeChange).toBe(30);
        expect(modified.patchCountChange).toBe(1);
      }
    });

    test("should detect config changes", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const build1: BuildHistoryEntry = {
        id: "build-config-1",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 0,
        totalPatchesApplied: 0,
        files: [],
        errors: [],
        warnings: [],
      };

      const build2: BuildHistoryEntry = {
        id: "build-config-2",
        timestamp: "2024-01-02T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "def456",
        version: "1.0.0",
        fileCount: 0,
        totalPatchesApplied: 0,
        files: [],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);
      await recordBuild(build2, configPath);

      const comparison = await compareBuildHistory("build-config-1", "build-config-2", configPath);

      expect(comparison.configChanged).toBe(true);
    });

    test("should calculate build duration change", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const build1: BuildHistoryEntry = {
        id: "build-slow",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 2000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [],
        errors: [],
        warnings: [],
      };

      const build2: BuildHistoryEntry = {
        id: "build-fast",
        timestamp: "2024-01-02T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);
      await recordBuild(build2, configPath);

      const comparison = await compareBuildHistory("build-slow", "build-fast", configPath);

      expect(comparison.summary.durationChange).toBe(-1000);
    });

    test("should throw error when baseline build not found", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await expect(compareBuildHistory("non-existent", "build-2", configPath)).rejects.toThrow(
        /baseline build.*not found/i,
      );
    });

    test("should throw error when target build not found", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const build1: BuildHistoryEntry = {
        id: "build-1",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 0,
        totalPatchesApplied: 0,
        files: [],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);

      await expect(compareBuildHistory("build-1", "non-existent", configPath)).rejects.toThrow(
        /target build.*not found/i,
      );
    });
  });

  describe("rollbackBuild", () => {
    test("should rollback to a previous build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const outputDir = join(TEST_DIR, "output");

      mkdirSync(outputDir, { recursive: true });

      const build1: BuildHistoryEntry = {
        id: "build-rollback-1",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [
          {
            path: "readme.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-01T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);

      // Save build output files
      const historyDir = getHistoryDirectory(configPath);
      const buildOutputDir = join(historyDir, "builds", build1.id, "output");
      mkdirSync(buildOutputDir, { recursive: true });
      writeFileSync(join(buildOutputDir, "readme.md"), "# Original content", "utf-8");

      // Perform rollback
      const result = await rollbackBuild("build-rollback-1", outputDir, configPath);

      expect(result.success).toBe(true);
      expect(result.filesRestored).toHaveLength(1);
      expect(result.filesRestored).toContain("readme.md");
      expect(existsSync(join(outputDir, "readme.md"))).toBe(true);
      expect(readFileSync(join(outputDir, "readme.md"), "utf-8")).toBe("# Original content");
    });

    test("should throw error when rolling back to non-existent build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const outputDir = join(TEST_DIR, "output");

      await expect(rollbackBuild("non-existent", outputDir, configPath)).rejects.toThrow(
        /build.*not found/i,
      );
    });

    test("should handle rollback when output files don't exist", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const outputDir = join(TEST_DIR, "output");

      const build1: BuildHistoryEntry = {
        id: "build-no-output",
        timestamp: "2024-01-01T12:00:00Z",
        duration: 1000,
        success: true,
        configHash: "abc123",
        version: "1.0.0",
        fileCount: 1,
        totalPatchesApplied: 2,
        files: [
          {
            path: "missing.md",
            sourceHash: "hash1",
            outputHash: "hash2",
            patchesApplied: 2,
            sourceSize: 100,
            outputSize: 120,
            processedAt: "2024-01-01T12:00:01Z",
          },
        ],
        errors: [],
        warnings: [],
      };

      await recordBuild(build1, configPath);

      const result = await rollbackBuild("build-no-output", outputDir, configPath);

      expect(result.success).toBe(false);
      expect(result.filesRestored).toHaveLength(0);
    });
  });

  describe("pruneHistory", () => {
    test("should prune old builds keeping only specified number", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Create 10 builds
      for (let i = 1; i <= 10; i++) {
        await recordBuild(
          {
            id: `build-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        );
      }

      // Prune to keep only 5 most recent
      const result = await pruneHistory(configPath, 5);

      expect(result.buildsPruned).toBe(5);
      expect(result.buildsRemaining).toBe(5);

      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(5);

      // Verify oldest builds were removed
      const build1 = await loadBuild("build-1", configPath);
      expect(build1).toBeNull();

      // Verify newest builds remain
      const build10 = await loadBuild("build-10", configPath);
      expect(build10).not.toBeNull();
    });

    test("should prune builds older than specified date", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const now = Date.now();

      // Old build
      await recordBuild(
        {
          id: "build-old",
          timestamp: new Date(now - 86400000 * 7).toISOString(), // 7 days ago
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      // Recent build
      await recordBuild(
        {
          id: "build-recent",
          timestamp: new Date(now).toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      const cutoffDate = new Date(now - 86400000 * 3).toISOString(); // 3 days ago
      const result = await pruneHistory(configPath, undefined, cutoffDate);

      expect(result.buildsPruned).toBe(1);

      const oldBuild = await loadBuild("build-old", configPath);
      expect(oldBuild).toBeNull();

      const recentBuild = await loadBuild("build-recent", configPath);
      expect(recentBuild).not.toBeNull();
    });

    test("should not prune if all builds are within retention", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      for (let i = 1; i <= 3; i++) {
        await recordBuild(
          {
            id: `build-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        );
      }

      const result = await pruneHistory(configPath, 10);

      expect(result.buildsPruned).toBe(0);
      expect(result.buildsRemaining).toBe(3);
    });

    test("should handle empty history during pruning", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const result = await pruneHistory(configPath, 5);

      expect(result.buildsPruned).toBe(0);
      expect(result.buildsRemaining).toBe(0);
    });
  });

  describe("clearHistory", () => {
    test("should clear all build history", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Create some builds
      for (let i = 1; i <= 5; i++) {
        await recordBuild(
          {
            id: `build-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        );
      }

      const result = await clearHistory(configPath);

      expect(result.buildsCleared).toBe(5);

      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(0);
      expect(manifest?.builds.size).toBe(0);
    });

    test("should handle clearing empty history", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const result = await clearHistory(configPath);

      expect(result.buildsCleared).toBe(0);
    });

    test("should remove history directory after clearing", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await recordBuild(
        {
          id: "build-1",
          timestamp: new Date().toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 0,
          totalPatchesApplied: 0,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      const historyDir = getHistoryDirectory(configPath);
      expect(existsSync(historyDir)).toBe(true);

      await clearHistory(configPath, { removeDirectory: true });

      expect(existsSync(historyDir)).toBe(false);
    });
  });

  describe("getBuildById and getLatestBuild", () => {
    test("should get build by ID", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await recordBuild(
        {
          id: "specific-build",
          timestamp: new Date().toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 2,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      const build = await getBuildById("specific-build", configPath);

      expect(build).not.toBeNull();
      expect(build?.id).toBe("specific-build");
    });

    test("should get latest build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      for (let i = 1; i <= 3; i++) {
        await recordBuild(
          {
            id: `build-${i}`,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        );
      }

      const latest = await getLatestBuild(configPath);

      expect(latest).not.toBeNull();
      expect(latest?.id).toBe("build-3");
    });

    test("should return null when no builds exist", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const latest = await getLatestBuild(configPath);

      expect(latest).toBeNull();
    });
  });

  describe("deleteBuild", () => {
    test("should delete a specific build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await recordBuild(
        {
          id: "build-to-delete",
          timestamp: new Date().toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      await recordBuild(
        {
          id: "build-to-keep",
          timestamp: new Date().toISOString(),
          duration: 1000,
          success: true,
          configHash: "abc123",
          version: "1.0.0",
          fileCount: 1,
          totalPatchesApplied: 1,
          files: [],
          errors: [],
          warnings: [],
        },
        configPath,
      );

      const result = await deleteBuild("build-to-delete", configPath);

      expect(result.success).toBe(true);

      const deletedBuild = await loadBuild("build-to-delete", configPath);
      expect(deletedBuild).toBeNull();

      const keptBuild = await loadBuild("build-to-keep", configPath);
      expect(keptBuild).not.toBeNull();

      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(1);
    });

    test("should handle deleting non-existent build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await expect(deleteBuild("non-existent", configPath)).rejects.toThrow(/build.*not found/i);
    });
  });

  describe("complete workflow integration", () => {
    test("should handle complete build history lifecycle", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // 1. Record multiple builds over time
      const buildIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const buildId = `integration-build-${i}`;
        buildIds.push(buildId);

        await recordBuild(
          {
            id: buildId,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            duration: 1000 + i * 100,
            success: i !== 3, // Build 3 fails
            configHash: `config-hash-${i}`,
            version: "1.0.0",
            fileCount: i,
            totalPatchesApplied: i * 2,
            files: Array.from({ length: i }, (_, j) => ({
              path: `file-${j + 1}.md`,
              sourceHash: `src-${j}`,
              outputHash: `out-${j}`,
              patchesApplied: 2,
              sourceSize: 100,
              outputSize: 120,
              processedAt: new Date(Date.now() + i * 1000 + j).toISOString(),
            })),
            errors: i === 3 ? [{ message: "Test error", path: "", line: 0, column: 0, severity: "error" }] : [],
            warnings: [],
            tags: i === 5 ? ["production"] : [],
          },
          configPath,
        );
      }

      // 2. Verify manifest reflects all builds
      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(5);
      expect(manifest?.latestBuildId).toBe("integration-build-5");

      // 3. List and filter builds
      const allBuilds = await listBuilds(configPath);
      expect(allBuilds).toHaveLength(5);

      const successfulBuilds = await listBuilds(configPath, { success: true });
      expect(successfulBuilds).toHaveLength(4);

      const productionBuilds = await listBuilds(configPath, { tags: ["production"] });
      expect(productionBuilds).toHaveLength(1);

      // 4. Compare builds
      const comparison = await compareBuildHistory("integration-build-1", "integration-build-5", configPath);
      expect(comparison.filesAdded).toHaveLength(4); // 5 files in build-5, 1 in build-1
      expect(comparison.configChanged).toBe(true);
      expect(comparison.summary.durationChange).toBe(400);

      // 5. Load specific build
      const build3 = await loadBuild("integration-build-3", configPath);
      expect(build3?.success).toBe(false);
      expect(build3?.errors).toHaveLength(1);

      // 6. Prune old builds
      const pruneResult = await pruneHistory(configPath, 3);
      expect(pruneResult.buildsPruned).toBe(2);
      expect(pruneResult.buildsRemaining).toBe(3);

      // 7. Verify pruning worked
      const build1 = await loadBuild("integration-build-1", configPath);
      expect(build1).toBeNull();

      const build5 = await loadBuild("integration-build-5", configPath);
      expect(build5).not.toBeNull();

      // 8. Get latest build
      const latest = await getLatestBuild(configPath);
      expect(latest?.id).toBe("integration-build-5");

      // 9. Delete a specific build
      await deleteBuild("integration-build-4", configPath);

      const updatedManifest = await loadManifest(configPath);
      expect(updatedManifest?.totalBuilds).toBe(2);

      // 10. Clear all history
      const clearResult = await clearHistory(configPath);
      expect(clearResult.buildsCleared).toBe(2);

      const finalManifest = await loadManifest(configPath);
      expect(finalManifest?.totalBuilds).toBe(0);
    });

    test("should handle concurrent build recordings", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Record multiple builds concurrently
      const buildPromises = Array.from({ length: 10 }, (_, i) =>
        recordBuild(
          {
            id: `concurrent-build-${i}`,
            timestamp: new Date(Date.now() + i * 100).toISOString(),
            duration: 1000,
            success: true,
            configHash: "abc123",
            version: "1.0.0",
            fileCount: 1,
            totalPatchesApplied: 1,
            files: [],
            errors: [],
            warnings: [],
          },
          configPath,
        ),
      );

      await Promise.all(buildPromises);

      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(10);
    });
  });
});
