/**
 * Tests for build cache module
 *
 * These tests verify the incremental build system's caching functionality:
 * - File and patch hash calculation
 * - Cache creation, loading, and saving
 * - Change detection (files, config, patches)
 * - Determining which files need rebuilding
 * - Cache pruning for deleted files
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { KustomarkConfig, PatchOperation } from "../../src/core/types.js";

// Import functions from build-cache module (to be implemented)
// These imports will fail until the module is created
import {
  calculateFileHash,
  calculatePatchHash,
  createEmptyCache,
  loadBuildCache,
  saveBuildCache,
  getCacheDirectory,
  updateBuildCache,
  pruneCache,
  detectChangedFiles,
  hasConfigChanged,
  havePatchesChanged,
  determineFilesToRebuild,
  type BuildCache,
  type CacheEntry,
  type ChangeReason,
} from "../../src/core/build-cache.js";

const TEST_DIR = join(tmpdir(), "kustomark-test-cache", `cache-test-${Date.now()}`);

describe("Build Cache Module", () => {
  beforeEach(async () => {
    await mkdirSync(TEST_DIR, { recursive: true });
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
  });

  describe("calculatePatchHash", () => {
    test("should produce consistent hashes for same patch", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const hash1 = calculatePatchHash(patch);
      const hash2 = calculatePatchHash(patch);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should handle field ordering consistently", () => {
      const patch1: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
        include: "*.md",
      };

      const patch2: PatchOperation = {
        include: "*.md",
        op: "replace",
        new: "bar",
        old: "foo",
      };

      const hash1 = calculatePatchHash(patch1);
      const hash2 = calculatePatchHash(patch2);

      // Should be same despite different field ordering
      expect(hash1).toBe(hash2);
    });

    test("should detect changes in operation type", () => {
      const patch1: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const patch2: PatchOperation = {
        op: "delete",
        pattern: "foo",
      };

      const hash1 = calculatePatchHash(patch1);
      const hash2 = calculatePatchHash(patch2);

      expect(hash1).not.toBe(hash2);
    });

    test("should detect changes in patch values", () => {
      const patch1: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const patch2: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "baz",
      };

      const hash1 = calculatePatchHash(patch1);
      const hash2 = calculatePatchHash(patch2);

      expect(hash1).not.toBe(hash2);
    });

    test("should handle complex patch operations", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "title",
        value: "My Title",
        include: ["*.md", "docs/**/*.md"],
        exclude: "README.md",
        validate: {
          contains: "title",
        },
      };

      const hash = calculatePatchHash(patch);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("should ignore undefined fields consistently", () => {
      const patch1: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const patch2: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
        include: undefined,
        exclude: undefined,
      };

      const hash1 = calculatePatchHash(patch1);
      const hash2 = calculatePatchHash(patch2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("createEmptyCache", () => {
    test("should create cache with correct structure", () => {
      const cache = createEmptyCache();

      expect(cache.version).toBe(1);
      expect(cache.entries).toEqual({});
      expect(cache.configHash).toBeUndefined();
      expect(cache.patchesHash).toBeUndefined();
      expect(cache.timestamp).toBeDefined();
      expect(typeof cache.timestamp).toBe("number");
    });

    test("should create cache with current timestamp", () => {
      const before = Date.now();
      const cache = createEmptyCache();
      const after = Date.now();

      expect(cache.timestamp).toBeGreaterThanOrEqual(before);
      expect(cache.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("getCacheDirectory", () => {
    test("should return .kustomark directory in config location", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);

      expect(cacheDir).toBe(join(TEST_DIR, ".kustomark"));
    });

    test("should handle nested config paths", () => {
      const configPath = join(TEST_DIR, "nested", "config", "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);

      expect(cacheDir).toBe(join(TEST_DIR, "nested", "config", ".kustomark"));
    });

    test("should handle directory paths", () => {
      const configPath = join(TEST_DIR, "project");
      const cacheDir = getCacheDirectory(configPath);

      expect(cacheDir).toBe(join(TEST_DIR, "project", ".kustomark"));
    });
  });

  describe("loadBuildCache and saveBuildCache", () => {
    test("should return null for non-existent cache", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cache = loadBuildCache(configPath);

      expect(cache).toBeNull();
    });

    test("should save and load cache successfully", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc123",
            outputHash: "def456",
            patchesHash: "ghi789",
            timestamp: Date.now(),
          },
        },
        configHash: "config123",
        patchesHash: "patches456",
        timestamp: Date.now(),
      };

      saveBuildCache(configPath, cache);

      const loaded = loadBuildCache(configPath);
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(cache.version);
      expect(loaded?.entries).toEqual(cache.entries);
      expect(loaded?.configHash).toBe(cache.configHash);
      expect(loaded?.patchesHash).toBe(cache.patchesHash);
    });

    test("should handle cache with multiple entries", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc123",
            outputHash: "def456",
            patchesHash: "ghi789",
            timestamp: Date.now(),
          },
          "file2.md": {
            sourceHash: "jkl012",
            outputHash: "mno345",
            patchesHash: "pqr678",
            timestamp: Date.now(),
          },
          "docs/file3.md": {
            sourceHash: "stu901",
            outputHash: "vwx234",
            patchesHash: "yz5678",
            timestamp: Date.now(),
          },
        },
        configHash: "config123",
        patchesHash: "patches456",
        timestamp: Date.now(),
      };

      saveBuildCache(configPath, cache);

      const loaded = loadBuildCache(configPath);
      expect(loaded?.entries).toHaveProperty("file1.md");
      expect(loaded?.entries).toHaveProperty("file2.md");
      expect(loaded?.entries).toHaveProperty("docs/file3.md");
    });

    test("should overwrite existing cache", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cache1: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "old",
            outputHash: "old",
            patchesHash: "old",
            timestamp: Date.now(),
          },
        },
        configHash: "old",
        patchesHash: "old",
        timestamp: Date.now(),
      };

      saveBuildCache(configPath, cache1);

      const cache2: BuildCache = {
        version: 1,
        entries: {
          "file2.md": {
            sourceHash: "new",
            outputHash: "new",
            patchesHash: "new",
            timestamp: Date.now(),
          },
        },
        configHash: "new",
        patchesHash: "new",
        timestamp: Date.now(),
      };

      saveBuildCache(configPath, cache2);

      const loaded = loadBuildCache(configPath);
      expect(loaded?.entries).toHaveProperty("file2.md");
      expect(loaded?.entries).not.toHaveProperty("file1.md");
      expect(loaded?.configHash).toBe("new");
    });

    test("should handle corrupted cache gracefully", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);
      mkdirSync(cacheDir, { recursive: true });

      // Write invalid JSON
      writeFileSync(join(cacheDir, "build-cache.json"), "invalid json {", "utf-8");

      const loaded = loadBuildCache(configPath);
      expect(loaded).toBeNull();
    });

    test("should handle empty cache file", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);
      mkdirSync(cacheDir, { recursive: true });

      writeFileSync(join(cacheDir, "build-cache.json"), "", "utf-8");

      const loaded = loadBuildCache(configPath);
      expect(loaded).toBeNull();
    });
  });

  describe("updateBuildCache", () => {
    test("should add new entry to cache", () => {
      const cache = createEmptyCache();
      const entry: CacheEntry = {
        sourceHash: "abc123",
        outputHash: "def456",
        patchesHash: "ghi789",
        timestamp: Date.now(),
      };

      const updated = updateBuildCache(cache, "file1.md", entry);

      expect(updated.entries["file1.md"]).toEqual(entry);
      expect(Object.keys(updated.entries)).toHaveLength(1);
    });

    test("should update existing entry", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "old",
            outputHash: "old",
            patchesHash: "old",
            timestamp: Date.now() - 1000,
          },
        },
        timestamp: Date.now(),
      };

      const newEntry: CacheEntry = {
        sourceHash: "new",
        outputHash: "new",
        patchesHash: "new",
        timestamp: Date.now(),
      };

      const updated = updateBuildCache(cache, "file1.md", newEntry);

      expect(updated.entries["file1.md"]?.sourceHash).toBe("new");
      expect(updated.entries["file1.md"]?.outputHash).toBe("new");
      expect(updated.entries["file1.md"]?.timestamp).toBeGreaterThan(
        cache.entries["file1.md"]!.timestamp,
      );
    });

    test("should not mutate original cache", () => {
      const cache = createEmptyCache();
      const entry: CacheEntry = {
        sourceHash: "abc123",
        outputHash: "def456",
        patchesHash: "ghi789",
        timestamp: Date.now(),
      };

      const updated = updateBuildCache(cache, "file1.md", entry);

      expect(cache.entries).toEqual({});
      expect(updated.entries["file1.md"]).toEqual(entry);
    });

    test("should preserve other entries when updating one", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc",
            outputHash: "def",
            patchesHash: "ghi",
            timestamp: Date.now(),
          },
          "file2.md": {
            sourceHash: "jkl",
            outputHash: "mno",
            patchesHash: "pqr",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const newEntry: CacheEntry = {
        sourceHash: "new",
        outputHash: "new",
        patchesHash: "new",
        timestamp: Date.now(),
      };

      const updated = updateBuildCache(cache, "file1.md", newEntry);

      expect(updated.entries["file1.md"]?.sourceHash).toBe("new");
      expect(updated.entries["file2.md"]?.sourceHash).toBe("jkl");
      expect(Object.keys(updated.entries)).toHaveLength(2);
    });
  });

  describe("pruneCache", () => {
    test("should remove entries for deleted files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc",
            outputHash: "def",
            patchesHash: "ghi",
            timestamp: Date.now(),
          },
          "file2.md": {
            sourceHash: "jkl",
            outputHash: "mno",
            patchesHash: "pqr",
            timestamp: Date.now(),
          },
          "file3.md": {
            sourceHash: "stu",
            outputHash: "vwx",
            patchesHash: "yz0",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Set(["file1.md", "file3.md"]);
      const pruned = pruneCache(cache, currentFiles);

      expect(pruned.entries).toHaveProperty("file1.md");
      expect(pruned.entries).not.toHaveProperty("file2.md");
      expect(pruned.entries).toHaveProperty("file3.md");
      expect(Object.keys(pruned.entries)).toHaveLength(2);
    });

    test("should handle empty current files set", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc",
            outputHash: "def",
            patchesHash: "ghi",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Set<string>();
      const pruned = pruneCache(cache, currentFiles);

      expect(pruned.entries).toEqual({});
    });

    test("should not mutate original cache", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc",
            outputHash: "def",
            patchesHash: "ghi",
            timestamp: Date.now(),
          },
          "file2.md": {
            sourceHash: "jkl",
            outputHash: "mno",
            patchesHash: "pqr",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Set(["file1.md"]);
      const pruned = pruneCache(cache, currentFiles);

      expect(Object.keys(cache.entries)).toHaveLength(2);
      expect(Object.keys(pruned.entries)).toHaveLength(1);
    });

    test("should preserve all entries if all files still exist", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "abc",
            outputHash: "def",
            patchesHash: "ghi",
            timestamp: Date.now(),
          },
          "file2.md": {
            sourceHash: "jkl",
            outputHash: "mno",
            patchesHash: "pqr",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Set(["file1.md", "file2.md"]);
      const pruned = pruneCache(cache, currentFiles);

      expect(pruned.entries).toEqual(cache.entries);
    });
  });

  describe("detectChangedFiles", () => {
    test("should detect new files", () => {
      const cache = createEmptyCache();
      const currentFiles = new Map([
        ["file1.md", "# New file content"],
        ["file2.md", "# Another new file"],
      ]);

      const changed = detectChangedFiles(cache, currentFiles);

      expect(changed.size).toBe(2);
      expect(changed.get("file1.md")).toBe("new");
      expect(changed.get("file2.md")).toBe("new");
    });

    test("should detect modified files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash("# Original content"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# Modified content"]]);

      const changed = detectChangedFiles(cache, currentFiles);

      expect(changed.size).toBe(1);
      expect(changed.get("file1.md")).toBe("modified");
    });

    test("should not detect unchanged files", () => {
      const content = "# Unchanged content";
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash(content),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", content]]);

      const changed = detectChangedFiles(cache, currentFiles);

      expect(changed.size).toBe(0);
    });

    test("should detect deleted files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: "hash1",
            outputHash: "output1",
            patchesHash: "patches1",
            timestamp: Date.now(),
          },
          "file2.md": {
            sourceHash: "hash2",
            outputHash: "output2",
            patchesHash: "patches2",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# Still here"]]);

      const changed = detectChangedFiles(cache, currentFiles);

      expect(changed.has("file2.md")).toBe(true);
      expect(changed.get("file2.md")).toBe("deleted");
    });

    test("should handle mix of changes", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "unchanged.md": {
            sourceHash: calculateFileHash("# Unchanged"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
          "modified.md": {
            sourceHash: calculateFileHash("# Original"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
          "deleted.md": {
            sourceHash: "hash",
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        timestamp: Date.now(),
      };

      const currentFiles = new Map([
        ["unchanged.md", "# Unchanged"],
        ["modified.md", "# Modified"],
        ["new.md", "# New"],
      ]);

      const changed = detectChangedFiles(cache, currentFiles);

      expect(changed.size).toBe(3);
      expect(changed.get("modified.md")).toBe("modified");
      expect(changed.get("new.md")).toBe("new");
      expect(changed.get("deleted.md")).toBe("deleted");
      expect(changed.has("unchanged.md")).toBe(false);
    });
  });

  describe("hasConfigChanged", () => {
    test("should detect config changes", () => {
      const config1: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const config2: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "different-output",
      };

      const cache: BuildCache = {
        version: 1,
        entries: {},
        configHash: calculateFileHash(JSON.stringify(config1)),
        timestamp: Date.now(),
      };

      expect(hasConfigChanged(cache, config2)).toBe(true);
    });

    test("should not detect changes for identical config", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const cache: BuildCache = {
        version: 1,
        entries: {},
        configHash: calculateFileHash(JSON.stringify(config)),
        timestamp: Date.now(),
      };

      expect(hasConfigChanged(cache, config)).toBe(false);
    });

    test("should handle missing config hash in cache", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const cache: BuildCache = {
        version: 1,
        entries: {},
        timestamp: Date.now(),
      };

      expect(hasConfigChanged(cache, config)).toBe(true);
    });

    test("should ignore field ordering", () => {
      const config1: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
        patches: [],
      };

      const config2: KustomarkConfig = {
        output: "output",
        kind: "Kustomization",
        apiVersion: "kustomark/v1",
        patches: [],
        resources: ["*.md"],
      };

      const cache: BuildCache = {
        version: 1,
        entries: {},
        configHash: calculateFileHash(JSON.stringify(config1)),
        timestamp: Date.now(),
      };

      // Should handle field ordering consistently
      expect(hasConfigChanged(cache, config2)).toBe(false);
    });
  });

  describe("havePatchesChanged", () => {
    test("should detect patch changes", () => {
      const patches1: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const patches2: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "baz",
        },
      ];

      const cache: BuildCache = {
        version: 1,
        entries: {},
        patchesHash: calculatePatchHash(patches1[0]!),
        timestamp: Date.now(),
      };

      expect(havePatchesChanged(cache, patches2)).toBe(true);
    });

    test("should not detect changes for identical patches", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const cache: BuildCache = {
        version: 1,
        entries: {},
        patchesHash: calculatePatchHash(patches[0]!),
        timestamp: Date.now(),
      };

      expect(havePatchesChanged(cache, patches)).toBe(false);
    });

    test("should handle missing patches hash in cache", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const cache: BuildCache = {
        version: 1,
        entries: {},
        timestamp: Date.now(),
      };

      expect(havePatchesChanged(cache, patches)).toBe(true);
    });

    test("should handle empty patches array", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {},
        patchesHash: "some-hash",
        timestamp: Date.now(),
      };

      expect(havePatchesChanged(cache, [])).toBe(true);
    });

    test("should detect addition of patches", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          op: "set-frontmatter",
          key: "title",
          value: "Test",
        },
      ];

      const cache: BuildCache = {
        version: 1,
        entries: {},
        patchesHash: calculatePatchHash(patches[0]!),
        timestamp: Date.now(),
      };

      expect(havePatchesChanged(cache, patches)).toBe(true);
    });

    test("should detect removal of patches", () => {
      const patches1: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
        {
          op: "set-frontmatter",
          key: "title",
          value: "Test",
        },
      ];

      const patches2: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      // Calculate combined hash for multiple patches
      const combinedHash = calculateFileHash(patches1.map((p) => calculatePatchHash(p)).join(""));

      const cache: BuildCache = {
        version: 1,
        entries: {},
        patchesHash: combinedHash,
        timestamp: Date.now(),
      };

      expect(havePatchesChanged(cache, patches2)).toBe(true);
    });
  });

  describe("determineFilesToRebuild", () => {
    test("should rebuild all files on first build", () => {
      const cache = createEmptyCache();
      const currentFiles = new Map([
        ["file1.md", "# Content 1"],
        ["file2.md", "# Content 2"],
      ]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };
      const patches: PatchOperation[] = [];

      const result = determineFilesToRebuild(cache, currentFiles, config, patches);

      expect(result.files.size).toBe(2);
      expect(result.files.has("file1.md")).toBe(true);
      expect(result.files.has("file2.md")).toBe(true);
      expect(result.reason).toBe("first-build");
    });

    test("should rebuild all files when config changes", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash("# Content 1"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        configHash: calculateFileHash(JSON.stringify({ output: "old-output" })),
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# Content 1"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "new-output",
      };
      const patches: PatchOperation[] = [];

      const result = determineFilesToRebuild(cache, currentFiles, config, patches);

      expect(result.files.size).toBe(1);
      expect(result.files.has("file1.md")).toBe(true);
      expect(result.reason).toBe("config-changed");
    });

    test("should rebuild all files when patches change", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash("# Content 1"),
            outputHash: "output",
            patchesHash: "old-patches",
            timestamp: Date.now(),
          },
        },
        patchesHash: "old-patches-hash",
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# Content 1"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const result = determineFilesToRebuild(cache, currentFiles, config, patches);

      expect(result.files.size).toBe(1);
      expect(result.files.has("file1.md")).toBe(true);
      expect(result.reason).toBe("patches-changed");
    });

    test("should rebuild only changed files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "unchanged.md": {
            sourceHash: calculateFileHash("# Unchanged"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
          "modified.md": {
            sourceHash: calculateFileHash("# Original"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        configHash: calculateFileHash(
          JSON.stringify({
            apiVersion: "kustomark/v1",
            kind: "Kustomization",
            resources: ["*.md"],
            output: "output",
          }),
        ),
        patchesHash: "",
        timestamp: Date.now(),
      };

      const currentFiles = new Map([
        ["unchanged.md", "# Unchanged"],
        ["modified.md", "# Modified"],
        ["new.md", "# New"],
      ]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };
      const patches: PatchOperation[] = [];

      const result = determineFilesToRebuild(cache, currentFiles, config, patches);

      expect(result.files.size).toBe(2);
      expect(result.files.has("modified.md")).toBe(true);
      expect(result.files.has("new.md")).toBe(true);
      expect(result.files.has("unchanged.md")).toBe(false);
      expect(result.reason).toBe("files-changed");
    });

    test("should rebuild no files when nothing changed", () => {
      const content = "# Unchanged content";
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash(content),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        configHash: calculateFileHash(
          JSON.stringify({
            apiVersion: "kustomark/v1",
            kind: "Kustomization",
            resources: ["*.md"],
            output: "output",
          }),
        ),
        patchesHash: "",
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", content]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };
      const patches: PatchOperation[] = [];

      const result = determineFilesToRebuild(cache, currentFiles, config, patches);

      expect(result.files.size).toBe(0);
      expect(result.reason).toBe("up-to-date");
    });
  });

  describe("cache invalidation reasons", () => {
    test("should prioritize first-build reason", () => {
      const cache = createEmptyCache();
      const currentFiles = new Map([["file1.md", "# Content"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const result = determineFilesToRebuild(cache, currentFiles, config, []);

      expect(result.reason).toBe("first-build");
    });

    test("should report config-changed over files-changed", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash("# Old"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        configHash: "old-config-hash",
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# New"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const result = determineFilesToRebuild(cache, currentFiles, config, []);

      expect(result.reason).toBe("config-changed");
    });

    test("should report patches-changed over files-changed", () => {
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash("# Old"),
            outputHash: "output",
            patchesHash: "old",
            timestamp: Date.now(),
          },
        },
        configHash: calculateFileHash(JSON.stringify(config)),
        patchesHash: "old-patches",
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# New"]]);
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const result = determineFilesToRebuild(cache, currentFiles, config, patches);

      expect(result.reason).toBe("patches-changed");
    });

    test("should report clean-cache when forced", () => {
      const cache: BuildCache = {
        version: 1,
        entries: {
          "file1.md": {
            sourceHash: calculateFileHash("# Content"),
            outputHash: "output",
            patchesHash: "patches",
            timestamp: Date.now(),
          },
        },
        configHash: "config",
        patchesHash: "patches",
        timestamp: Date.now(),
      };

      const currentFiles = new Map([["file1.md", "# Content"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // This would be called with force=true parameter
      const result = determineFilesToRebuild(cache, currentFiles, config, [], true);

      expect(result.reason).toBe("clean-cache");
      expect(result.files.size).toBe(1);
    });
  });
});
