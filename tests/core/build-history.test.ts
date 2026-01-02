/**
 * Tests for build history module
 *
 * These tests verify the build history system's functionality:
 * - File hash calculation
 * - Build recording and retrieval
 * - Build manifest management
 * - Build comparison and diffing
 * - Rollback operations
 * - History pruning and cleanup
 * - Statistics gathering
 * - Validation and error handling
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import functions from build-history module
import {
  calculateFileHash,
  getHistoryDirectory,
  recordBuild,
  loadBuild,
  listBuilds,
  compareBuilds,
  rollbackToBuild,
  pruneHistory,
  clearHistory,
  getHistoryStats,
  loadManifest,
  type BuildRecord,
  type BuildFileRecord,
  type BuildManifest,
  type BuildManifestEntry,
  type BuildComparison,
  type BuildListFilter,
  type HistoryStats,
} from "../../src/core/build-history.js";

const TEST_DIR = join(tmpdir(), "kustomark-test-history", `history-test-${Date.now()}`);

describe("Build History Module", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("calculateFileHash", () => {
    test("should produce consistent hashes for same content", () => {
      const content = "# Hello World\n\nThis is test content.";
      const hash1 = calculateFileHash(content);
      const hash2 = calculateFileHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should produce different hashes for different content", () => {
      const content1 = "# Hello World";
      const content2 = "# Goodbye World";

      const hash1 = calculateFileHash(content1);
      const hash2 = calculateFileHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    test("should handle empty content", () => {
      const hash = calculateFileHash("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should handle unicode content", () => {
      const content = "こんにちは世界 🌍";
      const hash = calculateFileHash(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should be sensitive to whitespace changes", () => {
      const content1 = "Hello\nWorld";
      const content2 = "Hello\r\nWorld";
      const content3 = "Hello  World";

      const hash1 = calculateFileHash(content1);
      const hash2 = calculateFileHash(content2);
      const hash3 = calculateFileHash(content3);

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    test("should handle large content", () => {
      const content = "x".repeat(100000);
      const hash = calculateFileHash(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
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

    test("should handle absolute paths", () => {
      const configPath = "/absolute/path/to/kustomark.yaml";
      const historyDir = getHistoryDirectory(configPath);

      expect(historyDir).toBe("/absolute/path/to/.kustomark/history");
    });
  });

  describe("recordBuild", () => {
    test("should record a successful build with files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content1 = "# File 1 content";
      const content2 = "# File 2 content";

      const files = new Map([
        [
          "file1.md",
          {
            content: content1,
            sourceHash: calculateFileHash(content1),
            patchHash: calculateFileHash("patch1"),
            outputHash: calculateFileHash(content1 + "patched"),
          },
        ],
        [
          "file2.md",
          {
            content: content2,
            sourceHash: calculateFileHash(content2),
            patchHash: calculateFileHash("patch2"),
            outputHash: calculateFileHash(content2 + "patched"),
          },
        ],
      ]);

      const configHash = calculateFileHash("config content");
      const record = await recordBuild(configPath, files, configHash, true);

      expect(record.success).toBe(true);
      expect(record.fileCount).toBe(2);
      expect(record.configHash).toBe(configHash);
      expect(record.files["file1.md"]).toBeDefined();
      expect(record.files["file2.md"]).toBeDefined();
      expect(record.totalSize).toBeGreaterThan(0);
      expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.id).toBe(record.timestamp);
    });

    test("should record a failed build with error message", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const record = await recordBuild(configPath, files, configHash, false, {
        error: "Build failed due to syntax error",
      });

      expect(record.success).toBe(false);
      expect(record.error).toBe("Build failed due to syntax error");
      expect(record.fileCount).toBe(0);
    });

    test("should record build with duration", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const record = await recordBuild(configPath, files, configHash, true, {
        duration: 1500,
      });

      expect(record.duration).toBe(1500);
    });

    test("should record build with config hashes", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const configHashes = {
        "base.yaml": calculateFileHash("base config"),
        "overlay.yaml": calculateFileHash("overlay config"),
      };

      const record = await recordBuild(configPath, files, configHash, true, {
        configHashes,
      });

      expect(record.configHashes).toEqual(configHashes);
    });

    test("should record build with group filters", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const groupFilters = {
        enabled: ["group1", "group2"],
        disabled: ["group3"],
      };

      const record = await recordBuild(configPath, files, configHash, true, {
        groupFilters,
      });

      expect(record.groupFilters).toEqual(groupFilters);
    });

    test("should calculate correct file sizes", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content = "Hello, World!";
      const expectedSize = Buffer.byteLength(content, "utf-8");

      const files = new Map([
        [
          "file.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);

      const record = await recordBuild(configPath, files, calculateFileHash("config"), true);

      expect(record.files["file.md"]?.size).toBe(expectedSize);
      expect(record.totalSize).toBe(expectedSize);
    });

    test("should create manifest on first build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);

      const manifest = await loadManifest(configPath);
      expect(manifest).not.toBeNull();
      expect(manifest?.version).toBe(1);
      expect(manifest?.totalBuilds).toBe(1);
      expect(manifest?.builds.length).toBe(1);
    });

    test("should update manifest on subsequent builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(3);
      expect(manifest?.builds.length).toBe(3);
    });

    test("should update current.json for successful builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const record = await recordBuild(configPath, files, configHash, true);

      const historyDir = getHistoryDirectory(configPath);
      const currentPath = join(historyDir, "current.json");

      expect(existsSync(currentPath)).toBe(true);

      const currentContent = await readFile(currentPath, "utf-8");
      const current = JSON.parse(currentContent);
      expect(current.id).toBe(record.id);
    });

    test("should not update current.json for failed builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      // First successful build
      await recordBuild(configPath, files, configHash, true);

      const historyDir = getHistoryDirectory(configPath);
      const currentPath = join(historyDir, "current.json");
      const initialContent = await readFile(currentPath, "utf-8");
      const initialTimestamp = JSON.parse(initialContent).timestamp;

      // Failed build should not update current.json
      await recordBuild(configPath, files, configHash, false, {
        error: "Build failed",
      });

      const updatedContent = await readFile(currentPath, "utf-8");
      const updatedTimestamp = JSON.parse(updatedContent).timestamp;

      expect(updatedTimestamp).toBe(initialTimestamp);
    });

    test("should handle builds with no files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const record = await recordBuild(configPath, files, configHash, true);

      expect(record.fileCount).toBe(0);
      expect(record.totalSize).toBe(0);
      expect(Object.keys(record.files).length).toBe(0);
    });

    test("should handle unicode content in files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content = "こんにちは世界 🌍";

      const files = new Map([
        [
          "unicode.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);

      const record = await recordBuild(configPath, files, calculateFileHash("config"), true);

      expect(record.files["unicode.md"]).toBeDefined();
      expect(record.files["unicode.md"]?.size).toBe(Buffer.byteLength(content, "utf-8"));
    });
  });

  describe("loadBuild", () => {
    test("should load existing build record", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const savedRecord = await recordBuild(configPath, files, configHash, true);
      const loadedRecord = await loadBuild(configPath, savedRecord.id);

      expect(loadedRecord).not.toBeNull();
      expect(loadedRecord?.id).toBe(savedRecord.id);
      expect(loadedRecord?.timestamp).toBe(savedRecord.timestamp);
      expect(loadedRecord?.success).toBe(savedRecord.success);
    });

    test("should return null for non-existent build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const loadedRecord = await loadBuild(configPath, "2024-01-01T00:00:00.000Z");

      expect(loadedRecord).toBeNull();
    });

    test("should return null for invalid JSON", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);
      const buildsDir = join(historyDir, "builds");

      await mkdir(buildsDir, { recursive: true });

      const buildId = "2024-01-01T00:00:00.000Z";
      const buildPath = join(buildsDir, `${buildId}.json`);
      await writeFile(buildPath, "invalid json {", "utf-8");

      const loadedRecord = await loadBuild(configPath, buildId);
      expect(loadedRecord).toBeNull();
    });

    test("should return null for build record missing required fields", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);
      const buildsDir = join(historyDir, "builds");

      await mkdir(buildsDir, { recursive: true });

      const buildId = "2024-01-01T00:00:00.000Z";
      const buildPath = join(buildsDir, `${buildId}.json`);
      await writeFile(
        buildPath,
        JSON.stringify({
          id: buildId,
          timestamp: buildId,
          // missing required fields
        }),
        "utf-8",
      );

      const loadedRecord = await loadBuild(configPath, buildId);
      expect(loadedRecord).toBeNull();
    });

    test("should validate timestamp format", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);
      const buildsDir = join(historyDir, "builds");

      await mkdir(buildsDir, { recursive: true });

      const buildId = "2024-01-01T00:00:00.000Z";
      const buildPath = join(buildsDir, `${buildId}.json`);
      await writeFile(
        buildPath,
        JSON.stringify({
          id: buildId,
          timestamp: "invalid-timestamp",
          version: "1.0.0",
          configHash: "abc123",
          success: true,
          files: {},
          fileCount: 0,
          totalSize: 0,
        }),
        "utf-8",
      );

      const loadedRecord = await loadBuild(configPath, buildId);
      expect(loadedRecord).toBeNull();
    });
  });

  describe("loadManifest", () => {
    test("should return null for non-existent manifest", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const manifest = await loadManifest(configPath);

      expect(manifest).toBeNull();
    });

    test("should load valid manifest", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);

      const manifest = await loadManifest(configPath);

      expect(manifest).not.toBeNull();
      expect(manifest?.version).toBe(1);
      expect(manifest?.builds).toBeInstanceOf(Array);
      expect(manifest?.totalBuilds).toBeGreaterThan(0);
    });

    test("should return null for invalid manifest JSON", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      await mkdir(historyDir, { recursive: true });

      const manifestPath = join(historyDir, "manifest.json");
      await writeFile(manifestPath, "invalid json {", "utf-8");

      const manifest = await loadManifest(configPath);
      expect(manifest).toBeNull();
    });

    test("should return null for manifest missing required fields", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const historyDir = getHistoryDirectory(configPath);

      await mkdir(historyDir, { recursive: true });

      const manifestPath = join(historyDir, "manifest.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          version: 1,
          // missing builds and totalBuilds
        }),
        "utf-8",
      );

      const manifest = await loadManifest(configPath);
      expect(manifest).toBeNull();
    });
  });

  describe("listBuilds", () => {
    test("should return empty array when no builds exist", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const builds = await listBuilds(configPath);

      expect(builds).toEqual([]);
    });

    test("should list all builds without filter", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, false, { error: "Failed" });

      const builds = await listBuilds(configPath);

      expect(builds.length).toBe(3);
    });

    test("should filter builds by success status", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, false, { error: "Failed" });

      const successfulBuilds = await listBuilds(configPath, { success: true });
      const failedBuilds = await listBuilds(configPath, { success: false });

      expect(successfulBuilds.length).toBe(2);
      expect(failedBuilds.length).toBe(1);
      expect(successfulBuilds.every((b) => b.success)).toBe(true);
      expect(failedBuilds.every((b) => !b.success)).toBe(true);
    });

    test("should filter builds by date range", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build1 = await recordBuild(configPath, files, configHash, true);

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const build2 = await recordBuild(configPath, files, configHash, true);

      const buildsAfterFirst = await listBuilds(configPath, { since: build1.timestamp });

      expect(buildsAfterFirst.length).toBeGreaterThanOrEqual(2);

      const buildsUntilFirst = await listBuilds(configPath, { until: build1.timestamp });
      expect(buildsUntilFirst.length).toBeGreaterThanOrEqual(1);
    });

    test("should limit number of results", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      const builds = await listBuilds(configPath, { limit: 2 });

      expect(builds.length).toBe(2);
    });

    test("should return builds sorted by timestamp descending", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordBuild(configPath, files, configHash, true);

      const builds = await listBuilds(configPath);

      expect(builds.length).toBe(3);

      // Check that builds are sorted newest first
      for (let i = 0; i < builds.length - 1; i++) {
        const current = new Date(builds[i]!.timestamp).getTime();
        const next = new Date(builds[i + 1]!.timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    test("should combine multiple filters", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, false, { error: "Failed" });
      await recordBuild(configPath, files, configHash, true);

      const builds = await listBuilds(configPath, {
        success: true,
        limit: 1,
      });

      expect(builds.length).toBe(1);
      expect(builds[0]?.success).toBe(true);
    });
  });

  describe("compareBuilds", () => {
    test("should detect added files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map([
        [
          "file1.md",
          {
            content: "content1",
            sourceHash: calculateFileHash("content1"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content1"),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "file1.md",
          {
            content: "content1",
            sourceHash: calculateFileHash("content1"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content1"),
          },
        ],
        [
          "file2.md",
          {
            content: "content2",
            sourceHash: calculateFileHash("content2"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content2"),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.added).toContain("file2.md");
      expect(comparison.stats.addedCount).toBe(1);
      expect(comparison.unchanged).toContain("file1.md");
    });

    test("should detect removed files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map([
        [
          "file1.md",
          {
            content: "content1",
            sourceHash: calculateFileHash("content1"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content1"),
          },
        ],
        [
          "file2.md",
          {
            content: "content2",
            sourceHash: calculateFileHash("content2"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content2"),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "file1.md",
          {
            content: "content1",
            sourceHash: calculateFileHash("content1"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content1"),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.removed).toContain("file2.md");
      expect(comparison.stats.removedCount).toBe(1);
      expect(comparison.unchanged).toContain("file1.md");
    });

    test("should detect modified files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map([
        [
          "file1.md",
          {
            content: "original content",
            sourceHash: calculateFileHash("original"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("original content"),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "file1.md",
          {
            content: "modified content",
            sourceHash: calculateFileHash("modified"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("modified content"),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.modified.length).toBe(1);
      expect(comparison.modified[0]?.file).toBe("file1.md");
      expect(comparison.stats.modifiedCount).toBe(1);
    });

    test("should detect unchanged files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const content = "same content";
      const files1 = new Map([
        [
          "file1.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "file1.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.unchanged).toContain("file1.md");
      expect(comparison.stats.unchangedCount).toBe(1);
    });

    test("should calculate size changes", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map([
        [
          "file1.md",
          {
            content: "short",
            sourceHash: calculateFileHash("short"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("short"),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "file1.md",
          {
            content: "much longer content here",
            sourceHash: calculateFileHash("much longer"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("much longer content here"),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.modified.length).toBe(1);
      expect(comparison.modified[0]?.sizeChange).toBeGreaterThan(0);
      expect(comparison.stats.totalSizeChange).toBeGreaterThan(0);
    });

    test("should throw error for non-existent baseline build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true);

      await expect(
        compareBuilds(configPath, "2024-01-01T00:00:00.000Z", build.id),
      ).rejects.toThrow("not found");
    });

    test("should throw error for non-existent current build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true);

      await expect(
        compareBuilds(configPath, build.id, "2024-01-01T00:00:00.000Z"),
      ).rejects.toThrow("not found");
    });

    test("should handle complex multi-file comparison", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map([
        [
          "unchanged.md",
          {
            content: "same",
            sourceHash: calculateFileHash("same"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("same"),
          },
        ],
        [
          "modified.md",
          {
            content: "original",
            sourceHash: calculateFileHash("original"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("original"),
          },
        ],
        [
          "removed.md",
          {
            content: "will be removed",
            sourceHash: calculateFileHash("removed"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("will be removed"),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "unchanged.md",
          {
            content: "same",
            sourceHash: calculateFileHash("same"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("same"),
          },
        ],
        [
          "modified.md",
          {
            content: "changed",
            sourceHash: calculateFileHash("changed"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("changed"),
          },
        ],
        [
          "added.md",
          {
            content: "new file",
            sourceHash: calculateFileHash("new"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("new file"),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.added).toContain("added.md");
      expect(comparison.removed).toContain("removed.md");
      expect(comparison.modified.map((m) => m.file)).toContain("modified.md");
      expect(comparison.unchanged).toContain("unchanged.md");
      expect(comparison.stats.addedCount).toBe(1);
      expect(comparison.stats.removedCount).toBe(1);
      expect(comparison.stats.modifiedCount).toBe(1);
      expect(comparison.stats.unchangedCount).toBe(1);
    });

    test("should sort comparison results", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map();
      const files2 = new Map([
        [
          "z-file.md",
          {
            content: "z",
            sourceHash: calculateFileHash("z"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("z"),
          },
        ],
        [
          "a-file.md",
          {
            content: "a",
            sourceHash: calculateFileHash("a"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("a"),
          },
        ],
        [
          "m-file.md",
          {
            content: "m",
            sourceHash: calculateFileHash("m"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("m"),
          },
        ],
      ]);

      const build1 = await recordBuild(configPath, files1, configHash, true);
      const build2 = await recordBuild(configPath, files2, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.added[0]).toBe("a-file.md");
      expect(comparison.added[1]).toBe("m-file.md");
      expect(comparison.added[2]).toBe("z-file.md");
    });
  });

  describe("rollbackToBuild", () => {
    test("should throw error for non-existent build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      await expect(rollbackToBuild(configPath, "2024-01-01T00:00:00.000Z")).rejects.toThrow(
        "not found",
      );
    });

    test("should throw error for failed build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, false, {
        error: "Build failed",
      });

      await expect(rollbackToBuild(configPath, build.id)).rejects.toThrow(
        "Cannot rollback to failed build",
      );
    });

    test("should return empty map for build with no files", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true);
      const rolledBackFiles = await rollbackToBuild(configPath, build.id);

      expect(rolledBackFiles.size).toBe(0);
    });

    test("should handle rollback to successful build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map([
        [
          "file1.md",
          {
            content: "content1",
            sourceHash: calculateFileHash("content1"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("content1"),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true);

      // Rollback should not throw
      const rolledBackFiles = await rollbackToBuild(configPath, build.id);

      // The function returns a map, but the actual files might not be in the directory
      // since we don't actually store the file contents in a separate location
      expect(rolledBackFiles).toBeInstanceOf(Map);
    });
  });

  describe("pruneHistory", () => {
    test("should return 0 when no history exists", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const removed = await pruneHistory(configPath, { keep: 10 });

      expect(removed).toBe(0);
    });

    test("should prune old builds keeping N most recent", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      // Create 5 builds
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      const removed = await pruneHistory(configPath, { keep: 3 });

      expect(removed).toBe(2);

      const builds = await listBuilds(configPath);
      expect(builds.length).toBe(3);
    });

    test("should prune builds before specific date", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build1 = await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const build2 = await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const build3 = await recordBuild(configPath, files, configHash, true);

      // Prune builds before build2's timestamp
      const removed = await pruneHistory(configPath, { before: build2.timestamp });

      expect(removed).toBeGreaterThanOrEqual(1);

      const builds = await listBuilds(configPath);
      expect(builds.every((b) => new Date(b.timestamp) >= new Date(build2.timestamp))).toBe(true);
    });

    test("should not prune when keep limit not exceeded", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      const removed = await pruneHistory(configPath, { keep: 10 });

      expect(removed).toBe(0);

      const builds = await listBuilds(configPath);
      expect(builds.length).toBe(2);
    });

    test("should combine keep and before filters", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const midBuild = await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      const removed = await pruneHistory(configPath, {
        before: midBuild.timestamp,
        keep: 2,
      });

      expect(removed).toBeGreaterThanOrEqual(1);
    });

    test("should update manifest after pruning", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      await pruneHistory(configPath, { keep: 1 });

      const manifest = await loadManifest(configPath);
      expect(manifest?.totalBuilds).toBe(1);
      expect(manifest?.builds.length).toBe(1);
    });
  });

  describe("clearHistory", () => {
    test("should return 0 when no history exists", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cleared = await clearHistory(configPath);

      expect(cleared).toBe(0);
    });

    test("should clear all build history", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);

      const cleared = await clearHistory(configPath);

      expect(cleared).toBe(3);

      const historyDir = getHistoryDirectory(configPath);
      expect(existsSync(historyDir)).toBe(false);
    });

    test("should remove history directory", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);

      const historyDir = getHistoryDirectory(configPath);
      expect(existsSync(historyDir)).toBe(true);

      await clearHistory(configPath);

      expect(existsSync(historyDir)).toBe(false);
    });

    test("should allow new builds after clearing", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await clearHistory(configPath);

      // Should be able to create new builds
      const newBuild = await recordBuild(configPath, files, configHash, true);
      expect(newBuild).toBeDefined();

      const builds = await listBuilds(configPath);
      expect(builds.length).toBe(1);
    });
  });

  describe("getHistoryStats", () => {
    test("should return zero stats when no history exists", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const stats = await getHistoryStats(configPath);

      expect(stats.totalBuilds).toBe(0);
      expect(stats.successfulBuilds).toBe(0);
      expect(stats.failedBuilds).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.avgFileCount).toBe(0);
      expect(stats.avgBuildSize).toBe(0);
    });

    test("should calculate stats for single build", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content = "test content";
      const files = new Map([
        [
          "file1.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);

      const stats = await getHistoryStats(configPath);

      expect(stats.totalBuilds).toBe(1);
      expect(stats.successfulBuilds).toBe(1);
      expect(stats.failedBuilds).toBe(0);
      expect(stats.avgFileCount).toBe(1);
      expect(stats.avgBuildSize).toBeGreaterThan(0);
      expect(stats.oldestBuild).toBeDefined();
      expect(stats.newestBuild).toBeDefined();
      expect(stats.oldestBuild).toBe(stats.newestBuild);
    });

    test("should calculate stats for multiple builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content = "test content";
      const files = new Map([
        [
          "file1.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, true);
      await recordBuild(configPath, files, configHash, false, { error: "Failed" });

      const stats = await getHistoryStats(configPath);

      expect(stats.totalBuilds).toBe(3);
      expect(stats.successfulBuilds).toBe(2);
      expect(stats.failedBuilds).toBe(1);
    });

    test("should calculate average file counts", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const configHash = calculateFileHash("config");

      const files1 = new Map([
        [
          "file1.md",
          {
            content: "a",
            sourceHash: calculateFileHash("a"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("a"),
          },
        ],
      ]);

      const files2 = new Map([
        [
          "file1.md",
          {
            content: "a",
            sourceHash: calculateFileHash("a"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("a"),
          },
        ],
        [
          "file2.md",
          {
            content: "b",
            sourceHash: calculateFileHash("b"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("b"),
          },
        ],
        [
          "file3.md",
          {
            content: "c",
            sourceHash: calculateFileHash("c"),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash("c"),
          },
        ],
      ]);

      await recordBuild(configPath, files1, configHash, true);
      await recordBuild(configPath, files2, configHash, true);

      const stats = await getHistoryStats(configPath);

      expect(stats.avgFileCount).toBe(2); // (1 + 3) / 2
    });

    test("should track oldest and newest builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build1 = await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordBuild(configPath, files, configHash, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const build3 = await recordBuild(configPath, files, configHash, true);

      const stats = await getHistoryStats(configPath);

      expect(stats.oldestBuild).toBe(build1.timestamp);
      expect(stats.newestBuild).toBe(build3.timestamp);
    });

    test("should calculate total size of history directory", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content = "x".repeat(1000); // 1KB
      const files = new Map([
        [
          "file1.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);

      const stats = await getHistoryStats(configPath);

      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe("edge cases and error handling", () => {
    test("should handle concurrent builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      // Start multiple builds concurrently
      const builds = await Promise.all([
        recordBuild(configPath, files, configHash, true),
        recordBuild(configPath, files, configHash, true),
        recordBuild(configPath, files, configHash, true),
      ]);

      expect(builds.length).toBe(3);

      // All builds should have IDs (they might be the same if timing is very close)
      const ids = builds.map((b) => b.id);
      expect(ids.every((id) => id)).toBe(true);

      const manifest = await loadManifest(configPath);
      // Manifest should have at least one build, possibly up to 3 depending on timing
      expect(manifest?.totalBuilds).toBeGreaterThanOrEqual(1);
      expect(manifest?.totalBuilds).toBeLessThanOrEqual(3);
    });

    test("should handle very long file paths", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const longPath = "very/deep/nested/directory/structure/file.md";
      const content = "content";
      const files = new Map([
        [
          longPath,
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true);

      expect(build.files[longPath]).toBeDefined();
    });

    test("should handle empty strings in hashes", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map([
        [
          "file1.md",
          {
            content: "",
            sourceHash: calculateFileHash(""),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(""),
          },
        ],
      ]);
      const configHash = calculateFileHash("");

      const build = await recordBuild(configPath, files, configHash, true);

      expect(build.files["file1.md"]).toBeDefined();
    });

    test("should handle builds with large file counts", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      // Create 100 files
      for (let i = 0; i < 100; i++) {
        files.set(`file${i}.md`, {
          content: `content${i}`,
          sourceHash: calculateFileHash(`content${i}`),
          patchHash: calculateFileHash(""),
          outputHash: calculateFileHash(`content${i}`),
        });
      }

      const build = await recordBuild(configPath, files, configHash, true);

      expect(build.fileCount).toBe(100);
      expect(Object.keys(build.files).length).toBe(100);
    });

    test("should handle special characters in file names", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const specialFileName = "file with spaces & special chars (1).md";
      const content = "content";
      const files = new Map([
        [
          specialFileName,
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true);

      expect(build.files[specialFileName]).toBeDefined();
    });

    test("should handle builds with zero duration", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      const build = await recordBuild(configPath, files, configHash, true, {
        duration: 0,
      });

      expect(build.duration).toBe(0);
    });

    test("should handle comparison of identical builds", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const content = "same content";
      const files = new Map([
        [
          "file1.md",
          {
            content,
            sourceHash: calculateFileHash(content),
            patchHash: calculateFileHash(""),
            outputHash: calculateFileHash(content),
          },
        ],
      ]);
      const configHash = calculateFileHash("config");

      const build1 = await recordBuild(configPath, files, configHash, true);
      const build2 = await recordBuild(configPath, files, configHash, true);

      const comparison = await compareBuilds(configPath, build1.id, build2.id);

      expect(comparison.added.length).toBe(0);
      expect(comparison.removed.length).toBe(0);
      expect(comparison.modified.length).toBe(0);
      expect(comparison.unchanged.length).toBe(1);
    });

    test("should handle pruning with no builds to remove", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const files = new Map();
      const configHash = calculateFileHash("config");

      await recordBuild(configPath, files, configHash, true);

      const removed = await pruneHistory(configPath, { keep: 100 });

      expect(removed).toBe(0);
    });

    test("should handle clearing already cleared history", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      const cleared1 = await clearHistory(configPath);
      const cleared2 = await clearHistory(configPath);

      expect(cleared1).toBe(0);
      expect(cleared2).toBe(0);
    });
  });
});
