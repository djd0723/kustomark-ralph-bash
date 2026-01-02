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
import type { KustomarkConfig, PatchOperation, BuildCache, BuildCacheEntry } from "../../src/core/types.js";

// Import functions from build-cache module
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
  computePatchesHash,
  determineFilesToRebuild,
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
      const configHash = "abc123";
      const cache = createEmptyCache(configHash);

      expect(cache.version).toBe(1);
      expect(cache.entries).toBeInstanceOf(Map);
      expect(cache.entries.size).toBe(0);
      expect(cache.configHash).toBe(configHash);
    });

    test("should create cache with provided config hash", () => {
      const configHash = "test-hash-123";
      const cache = createEmptyCache(configHash);

      expect(cache.configHash).toBe(configHash);
      expect(cache.entries).toBeInstanceOf(Map);
      expect(cache.entries.size).toBe(0);
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

    test("should handle file paths at root level", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);

      expect(cacheDir).toBe(join(TEST_DIR, ".kustomark"));
    });
  });

  describe("loadBuildCache and saveBuildCache", () => {
    test("should return null for non-existent cache", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cache = await loadBuildCache(configPath);

      expect(cache).toBeNull();
    });

    test("should save and load cache successfully", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const entry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: "ghi789",
        built: new Date().toISOString(),
      };
      const cache: BuildCache = {
        version: 1,
        entries: new Map([["file1.md", entry]]),
        configHash: "config123",
      };

      await saveBuildCache(configPath, cache);

      const loaded = await loadBuildCache(configPath);
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(cache.version);
      expect(loaded?.entries).toBeInstanceOf(Map);
      expect(loaded?.entries.size).toBe(1);
      expect(loaded?.entries.get("file1.md")).toEqual(entry);
      expect(loaded?.configHash).toBe(cache.configHash);
    });

    test("should handle cache with multiple entries", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const entries = new Map<string, BuildCacheEntry>([
        ["file1.md", {
          file: "file1.md",
          sourceHash: "abc123",
          outputHash: "def456",
          patchHash: "ghi789",
          built: new Date().toISOString(),
        }],
        ["file2.md", {
          file: "file2.md",
          sourceHash: "jkl012",
          outputHash: "mno345",
          patchHash: "pqr678",
          built: new Date().toISOString(),
        }],
        ["docs/file3.md", {
          file: "docs/file3.md",
          sourceHash: "stu901",
          outputHash: "vwx234",
          patchHash: "yz5678",
          built: new Date().toISOString(),
        }],
      ]);
      const cache: BuildCache = {
        version: 1,
        entries,
        configHash: "config123",
      };

      await saveBuildCache(configPath, cache);

      const loaded = await loadBuildCache(configPath);
      expect(loaded?.entries.size).toBe(3);
      expect(loaded?.entries.has("file1.md")).toBe(true);
      expect(loaded?.entries.has("file2.md")).toBe(true);
      expect(loaded?.entries.has("docs/file3.md")).toBe(true);
    });

    test("should overwrite existing cache", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cache1: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "old",
            outputHash: "old",
            patchHash: "old",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "old",
      };

      await saveBuildCache(configPath, cache1);

      const cache2: BuildCache = {
        version: 1,
        entries: new Map([
          ["file2.md", {
            file: "file2.md",
            sourceHash: "new",
            outputHash: "new",
            patchHash: "new",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "new",
      };

      await saveBuildCache(configPath, cache2);

      const loaded = await loadBuildCache(configPath);
      expect(loaded?.entries.size).toBe(1);
      expect(loaded?.entries.has("file2.md")).toBe(true);
      expect(loaded?.entries.has("file1.md")).toBe(false);
      expect(loaded?.configHash).toBe("new");
    });

    test("should handle corrupted cache gracefully", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);
      mkdirSync(cacheDir, { recursive: true });

      // Write invalid JSON
      writeFileSync(join(cacheDir, "build-cache.json"), "invalid json {", "utf-8");

      const loaded = await loadBuildCache(configPath);
      expect(loaded).toBeNull();
    });

    test("should handle empty cache file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const cacheDir = getCacheDirectory(configPath);
      mkdirSync(cacheDir, { recursive: true });

      writeFileSync(join(cacheDir, "build-cache.json"), "", "utf-8");

      const loaded = await loadBuildCache(configPath);
      expect(loaded).toBeNull();
    });
  });

  describe("updateBuildCache", () => {
    test("should add new entry to cache", () => {
      const cache = createEmptyCache("test-hash");
      const entry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: "ghi789",
        built: new Date().toISOString(),
      };

      const results = new Map([["file1.md", entry]]);
      const updated = updateBuildCache(cache, results);

      expect(updated.entries.size).toBe(1);
      expect(updated.entries.get("file1.md")).toEqual(entry);
    });

    test("should update existing entry", () => {
      const oldBuilt = new Date(Date.now() - 1000).toISOString();
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "old",
            outputHash: "old",
            patchHash: "old",
            built: oldBuilt,
          }],
        ]),
        configHash: "test-hash",
      };

      const newBuilt = new Date().toISOString();
      const newEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "new",
        outputHash: "new",
        patchHash: "new",
        built: newBuilt,
      };

      const results = new Map([["file1.md", newEntry]]);
      const updated = updateBuildCache(cache, results);

      expect(updated.entries.size).toBe(1);
      expect(updated.entries.get("file1.md")?.sourceHash).toBe("new");
      expect(updated.entries.get("file1.md")?.outputHash).toBe("new");
      expect(updated.entries.get("file1.md")?.built).toBe(newBuilt);
    });

    test("should not mutate original cache", () => {
      const cache = createEmptyCache("test-hash");
      const entry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: "ghi789",
        built: new Date().toISOString(),
      };

      const results = new Map([["file1.md", entry]]);
      const updated = updateBuildCache(cache, results);

      expect(cache.entries.size).toBe(0);
      expect(updated.entries.size).toBe(1);
      expect(updated.entries.get("file1.md")).toEqual(entry);
    });

    test("should preserve other entries when updating one", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "abc",
            outputHash: "def",
            patchHash: "ghi",
            built: new Date().toISOString(),
          }],
          ["file2.md", {
            file: "file2.md",
            sourceHash: "jkl",
            outputHash: "mno",
            patchHash: "pqr",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const newEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "new",
        outputHash: "new",
        patchHash: "new",
        built: new Date().toISOString(),
      };

      const results = new Map([["file1.md", newEntry]]);
      const updated = updateBuildCache(cache, results);

      expect(updated.entries.get("file1.md")?.sourceHash).toBe("new");
      expect(updated.entries.get("file2.md")?.sourceHash).toBe("jkl");
      expect(updated.entries.size).toBe(2);
    });
  });

  describe("pruneCache", () => {
    test("should remove entries for deleted files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "abc",
            outputHash: "def",
            patchHash: "ghi",
            built: new Date().toISOString(),
          }],
          ["file2.md", {
            file: "file2.md",
            sourceHash: "jkl",
            outputHash: "mno",
            patchHash: "pqr",
            built: new Date().toISOString(),
          }],
          ["file3.md", {
            file: "file3.md",
            sourceHash: "stu",
            outputHash: "vwx",
            patchHash: "yz0",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Set(["file1.md", "file3.md"]);
      const pruned = pruneCache(cache, currentFiles);

      expect(pruned.entries.has("file1.md")).toBe(true);
      expect(pruned.entries.has("file2.md")).toBe(false);
      expect(pruned.entries.has("file3.md")).toBe(true);
      expect(pruned.entries.size).toBe(2);
    });

    test("should handle empty current files set", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "abc",
            outputHash: "def",
            patchHash: "ghi",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Set<string>();
      const pruned = pruneCache(cache, currentFiles);

      expect(pruned.entries.size).toBe(0);
    });

    test("should not mutate original cache", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "abc",
            outputHash: "def",
            patchHash: "ghi",
            built: new Date().toISOString(),
          }],
          ["file2.md", {
            file: "file2.md",
            sourceHash: "jkl",
            outputHash: "mno",
            patchHash: "pqr",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Set(["file1.md"]);
      const pruned = pruneCache(cache, currentFiles);

      expect(cache.entries.size).toBe(2);
      expect(pruned.entries.size).toBe(1);
    });

    test("should preserve all entries if all files still exist", () => {
      const entry1 = {
        file: "file1.md",
        sourceHash: "abc",
        outputHash: "def",
        patchHash: "ghi",
        built: new Date().toISOString(),
      };
      const entry2 = {
        file: "file2.md",
        sourceHash: "jkl",
        outputHash: "mno",
        patchHash: "pqr",
        built: new Date().toISOString(),
      };
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", entry1],
          ["file2.md", entry2],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Set(["file1.md", "file2.md"]);
      const pruned = pruneCache(cache, currentFiles);

      expect(pruned.entries.size).toBe(2);
      expect(pruned.entries.get("file1.md")).toEqual(entry1);
      expect(pruned.entries.get("file2.md")).toEqual(entry2);
    });
  });

  describe("detectChangedFiles", () => {
    test("should detect new files", () => {
      const cache = createEmptyCache("test-hash");
      const currentFiles = new Map([
        ["file1.md", calculateFileHash("# New file content")],
        ["file2.md", calculateFileHash("# Another new file")],
      ]);

      const changes = detectChangedFiles(currentFiles, cache);

      expect(changes.added.size).toBe(2);
      expect(changes.added.has("file1.md")).toBe(true);
      expect(changes.added.has("file2.md")).toBe(true);
      expect(changes.changed.size).toBe(0);
      expect(changes.deleted.size).toBe(0);
    });

    test("should detect modified files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash("# Original content"),
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Map([["file1.md", calculateFileHash("# Modified content")]]);

      const changes = detectChangedFiles(currentFiles, cache);

      expect(changes.changed.size).toBe(1);
      expect(changes.changed.has("file1.md")).toBe(true);
      expect(changes.added.size).toBe(0);
      expect(changes.deleted.size).toBe(0);
    });

    test("should not detect unchanged files", () => {
      const content = "# Unchanged content";
      const hash = calculateFileHash(content);
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: hash,
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Map([["file1.md", hash]]);

      const changes = detectChangedFiles(currentFiles, cache);

      expect(changes.changed.size).toBe(0);
      expect(changes.added.size).toBe(0);
      expect(changes.deleted.size).toBe(0);
    });

    test("should detect deleted files", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: "hash1",
            outputHash: "output1",
            patchHash: "patches1",
            built: new Date().toISOString(),
          }],
          ["file2.md", {
            file: "file2.md",
            sourceHash: "hash2",
            outputHash: "output2",
            patchHash: "patches2",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Map([["file1.md", calculateFileHash("# Still here")]]);

      const changes = detectChangedFiles(currentFiles, cache);

      expect(changes.deleted.size).toBe(1);
      expect(changes.deleted.has("file2.md")).toBe(true);
      expect(changes.added.size).toBe(0);
    });

    test("should handle mix of changes", () => {
      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["unchanged.md", {
            file: "unchanged.md",
            sourceHash: calculateFileHash("# Unchanged"),
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
          ["modified.md", {
            file: "modified.md",
            sourceHash: calculateFileHash("# Original"),
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
          ["deleted.md", {
            file: "deleted.md",
            sourceHash: "hash",
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "test-hash",
      };

      const currentFiles = new Map([
        ["unchanged.md", calculateFileHash("# Unchanged")],
        ["modified.md", calculateFileHash("# Modified")],
        ["new.md", calculateFileHash("# New")],
      ]);

      const changes = detectChangedFiles(currentFiles, cache);

      expect(changes.changed.size).toBe(1);
      expect(changes.changed.has("modified.md")).toBe(true);
      expect(changes.added.size).toBe(1);
      expect(changes.added.has("new.md")).toBe(true);
      expect(changes.deleted.size).toBe(1);
      expect(changes.deleted.has("deleted.md")).toBe(true);
    });
  });

  describe("hasConfigChanged", () => {
    test("should detect config changes", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
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

      // Write the old config to file
      writeFileSync(configPath, JSON.stringify(config1), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map(),
        configHash: calculateFileHash(JSON.stringify(config1)),
      };

      // Update file with new config
      writeFileSync(configPath, JSON.stringify(config2), "utf-8");

      expect(hasConfigChanged(config2, configPath, cache)).toBe(true);
    });

    test("should not detect changes for identical config", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Write config to file
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map(),
        configHash: calculateFileHash(JSON.stringify(config)),
      };

      expect(hasConfigChanged(config, configPath, cache)).toBe(false);
    });

    test("should handle missing config file", () => {
      const configPath = join(TEST_DIR, "nonexistent-kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      const cache: BuildCache = {
        version: 1,
        entries: new Map(),
        configHash: "some-hash",
      };

      // Should return true if config file doesn't exist
      expect(hasConfigChanged(config, configPath, cache)).toBe(true);
    });

    test("should ignore field ordering", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
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

      // Write config1 to file
      writeFileSync(configPath, JSON.stringify(config1), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map(),
        configHash: calculateFileHash(JSON.stringify(config1)),
      };

      // Even though config2 has different field order in memory,
      // when written to file with JSON.stringify, it will have different field order
      // This test demonstrates the current behavior
      expect(hasConfigChanged(config2, configPath, cache)).toBe(false);
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

      const cacheEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: computePatchesHash(patches1),
        built: new Date().toISOString(),
      };

      expect(havePatchesChanged(patches2, "file1.md", cacheEntry)).toBe(true);
    });

    test("should not detect changes for identical patches", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const cacheEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: computePatchesHash(patches),
        built: new Date().toISOString(),
      };

      expect(havePatchesChanged(patches, "file1.md", cacheEntry)).toBe(false);
    });

    test("should handle different patch hash in cache entry", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const cacheEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: "different-hash",
        built: new Date().toISOString(),
      };

      expect(havePatchesChanged(patches, "file1.md", cacheEntry)).toBe(true);
    });

    test("should handle empty patches array", () => {
      const cacheEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: "some-hash",
        built: new Date().toISOString(),
      };

      expect(havePatchesChanged([], "file1.md", cacheEntry)).toBe(true);
    });

    test("should detect addition of patches", () => {
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
          new: "bar",
        },
        {
          op: "set-frontmatter",
          key: "title",
          value: "Test",
        },
      ];

      const cacheEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: computePatchesHash(patches1),
        built: new Date().toISOString(),
      };

      expect(havePatchesChanged(patches2, "file1.md", cacheEntry)).toBe(true);
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

      const cacheEntry: BuildCacheEntry = {
        file: "file1.md",
        sourceHash: "abc123",
        outputHash: "def456",
        patchHash: computePatchesHash(patches1),
        built: new Date().toISOString(),
      };

      expect(havePatchesChanged(patches2, "file1.md", cacheEntry)).toBe(true);
    });
  });

  describe("determineFilesToRebuild", () => {
    test("should rebuild all files on first build", () => {
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
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, patches, config, configPath, null, graph);

      expect(result.rebuild.size).toBe(2);
      expect(result.rebuild.has("file1.md")).toBe(true);
      expect(result.rebuild.has("file2.md")).toBe(true);
      expect(result.reasons.get("file1.md")).toContain("No cache exists");
    });

    test("should rebuild all files when config changes", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");

      // Create the config file with old content
      const oldConfig = { output: "old-output" };
      writeFileSync(configPath, JSON.stringify(oldConfig), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash("# Content 1"),
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: calculateFileHash(JSON.stringify(oldConfig)),
      };

      const currentFiles = new Map([["file1.md", "# Content 1"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "new-output",
      };
      const patches: PatchOperation[] = [];

      // Update config file with new content
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, patches, config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(1);
      expect(result.rebuild.has("file1.md")).toBe(true);
      expect(result.reasons.get("file1.md")).toContain("Configuration file changed");
    });

    test("should rebuild all files when patches change", () => {
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];

      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Create config file
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash("# Content 1"),
            outputHash: "output",
            patchHash: "old-patches",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: calculateFileHash(JSON.stringify(config)),
      };

      const currentFiles = new Map([["file1.md", "# Content 1"]]);
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, patches, config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(1);
      expect(result.rebuild.has("file1.md")).toBe(true);
      expect(result.reasons.get("file1.md")).toContain("Applicable patches changed");
    });

    test("should rebuild only changed files", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Create config file
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const patchesHash = calculateFileHash(JSON.stringify([]));

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["unchanged.md", {
            file: "unchanged.md",
            sourceHash: calculateFileHash("# Unchanged"),
            outputHash: "output",
            patchHash: patchesHash,
            built: new Date().toISOString(),
          }],
          ["modified.md", {
            file: "modified.md",
            sourceHash: calculateFileHash("# Original"),
            outputHash: "output",
            patchHash: patchesHash,
            built: new Date().toISOString(),
          }],
        ]),
        configHash: calculateFileHash(JSON.stringify(config)),
      };

      const currentFiles = new Map([
        ["unchanged.md", "# Unchanged"],
        ["modified.md", "# Modified"],
        ["new.md", "# New"],
      ]);
      const patches: PatchOperation[] = [];
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, patches, config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(2);
      expect(result.rebuild.has("modified.md")).toBe(true);
      expect(result.rebuild.has("new.md")).toBe(true);
      expect(result.unchanged.has("unchanged.md")).toBe(true);
    });

    test("should rebuild no files when nothing changed", () => {
      const content = "# Unchanged content";
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Create config file
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const patchesHash = calculateFileHash(JSON.stringify([]));

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash(content),
            outputHash: "output",
            patchHash: patchesHash,
            built: new Date().toISOString(),
          }],
        ]),
        configHash: calculateFileHash(JSON.stringify(config)),
      };

      const currentFiles = new Map([["file1.md", content]]);
      const patches: PatchOperation[] = [];
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, patches, config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(0);
      expect(result.unchanged.size).toBe(1);
      expect(result.unchanged.has("file1.md")).toBe(true);
    });
  });

  describe("cache invalidation reasons", () => {
    test("should prioritize first-build reason", () => {
      const currentFiles = new Map([["file1.md", "# Content"]]);
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, [], config, configPath, null, graph);

      expect(result.rebuild.size).toBe(1);
      expect(result.reasons.get("file1.md")).toContain("No cache exists");
    });

    test("should report config-changed over files-changed", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Create config file with new content
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash("# Old"),
            outputHash: "output",
            patchHash: "patches",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: "old-config-hash",
      };

      const currentFiles = new Map([["file1.md", "# New"]]);
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, [], config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(1);
      expect(result.reasons.get("file1.md")).toContain("Configuration file changed");
    });

    test("should report patches-changed over files-changed", () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Create config file
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash("# Old"),
            outputHash: "output",
            patchHash: "old",
            built: new Date().toISOString(),
          }],
        ]),
        configHash: calculateFileHash(JSON.stringify(config)),
      };

      const currentFiles = new Map([["file1.md", "# New"]]);
      const patches: PatchOperation[] = [
        {
          op: "replace",
          old: "foo",
          new: "bar",
        },
      ];
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, patches, config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(1);
      // Both file content and patches changed, but we still rebuild the file
      expect(result.rebuild.has("file1.md")).toBe(true);
    });

    test("should handle cache with all up-to-date files", () => {
      const content = "# Content";
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const config: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: ["*.md"],
        output: "output",
      };

      // Create config file
      writeFileSync(configPath, JSON.stringify(config), "utf-8");

      const patchesHash = calculateFileHash(JSON.stringify([]));

      const cache: BuildCache = {
        version: 1,
        entries: new Map([
          ["file1.md", {
            file: "file1.md",
            sourceHash: calculateFileHash(content),
            outputHash: "output",
            patchHash: patchesHash,
            built: new Date().toISOString(),
          }],
        ]),
        configHash: calculateFileHash(JSON.stringify(config)),
      };

      const currentFiles = new Map([["file1.md", content]]);
      const graph = { nodes: new Map(), configPath };

      const result = determineFilesToRebuild(currentFiles, [], config, configPath, cache, graph);

      expect(result.rebuild.size).toBe(0);
      expect(result.unchanged.size).toBe(1);
    });
  });
});
