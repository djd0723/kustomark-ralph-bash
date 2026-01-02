/**
 * Tests for snapshot manager
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  type BuildResult,
  calculateFileHash,
  createSnapshot,
  loadSnapshot,
  updateSnapshot,
  verifySnapshot,
} from "./snapshot-manager.js";

const TEST_SNAPSHOT_DIR = join(import.meta.dir, ".test-snapshots");

beforeEach(() => {
  // Clean up any existing test snapshots
  if (existsSync(TEST_SNAPSHOT_DIR)) {
    rmSync(TEST_SNAPSHOT_DIR, { recursive: true, force: true });
  }
});

afterEach(() => {
  // Clean up test snapshots after each test
  if (existsSync(TEST_SNAPSHOT_DIR)) {
    rmSync(TEST_SNAPSHOT_DIR, { recursive: true, force: true });
  }
});

describe("calculateFileHash", () => {
  test("calculates SHA256 hash of content", () => {
    const content = "Hello, World!";
    const hash = calculateFileHash(content);

    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // SHA256 hex digest is 64 characters
  });

  test("produces consistent hashes for same content", () => {
    const content = "# Test\n\nSome markdown content";
    const hash1 = calculateFileHash(content);
    const hash2 = calculateFileHash(content);

    expect(hash1).toBe(hash2);
  });

  test("produces different hashes for different content", () => {
    const content1 = "Content A";
    const content2 = "Content B";
    const hash1 = calculateFileHash(content1);
    const hash2 = calculateFileHash(content2);

    expect(hash1).not.toBe(hash2);
  });

  test("is sensitive to whitespace changes", () => {
    const content1 = "Hello\nWorld";
    const content2 = "Hello\n\nWorld";
    const hash1 = calculateFileHash(content1);
    const hash2 = calculateFileHash(content2);

    expect(hash1).not.toBe(hash2);
  });
});

describe("createSnapshot", () => {
  test("creates a snapshot with manifest and files", async () => {
    const buildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README\n\nHello world"],
        ["docs/api.md", "# API\n\nDocumentation"],
      ]),
      success: true,
    };

    const manifest = await createSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    // Verify manifest properties
    expect(manifest.fileCount).toBe(2);
    expect(manifest.timestamp).toBeTruthy();
    expect(new Date(manifest.timestamp).getTime()).toBeTruthy(); // Valid ISO timestamp
    expect(manifest.version).toBeTruthy();
    expect(Object.keys(manifest.fileHashes)).toHaveLength(2);
    expect(manifest.fileHashes["readme.md"]).toBeTruthy();
    expect(manifest.fileHashes["docs/api.md"]).toBeTruthy();

    // Verify manifest file exists
    const manifestPath = join(TEST_SNAPSHOT_DIR, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    // Verify snapshot files exist
    expect(existsSync(join(TEST_SNAPSHOT_DIR, "readme.md"))).toBe(true);
    expect(existsSync(join(TEST_SNAPSHOT_DIR, "docs/api.md"))).toBe(true);

    // Verify file content is preserved
    const readmeContent = readFileSync(join(TEST_SNAPSHOT_DIR, "readme.md"), "utf-8");
    expect(readmeContent).toBe("# README\n\nHello world");
  });

  test("creates snapshot directory if it doesn't exist", async () => {
    const buildResult: BuildResult = {
      files: new Map([["test.md", "# Test"]]),
      success: true,
    };

    expect(existsSync(TEST_SNAPSHOT_DIR)).toBe(false);

    await createSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    expect(existsSync(TEST_SNAPSHOT_DIR)).toBe(true);
  });

  test("creates nested directories for files", async () => {
    const buildResult: BuildResult = {
      files: new Map([["deep/nested/path/file.md", "# Deep file"]]),
      success: true,
    };

    await createSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    const filePath = join(TEST_SNAPSHOT_DIR, "deep/nested/path/file.md");
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf-8")).toBe("# Deep file");
  });

  test("handles empty build result", async () => {
    const buildResult: BuildResult = {
      files: new Map(),
      success: true,
    };

    const manifest = await createSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    expect(manifest.fileCount).toBe(0);
    expect(Object.keys(manifest.fileHashes)).toHaveLength(0);
  });
});

describe("loadSnapshot", () => {
  test("loads existing snapshot manifest", async () => {
    // Create a snapshot first
    const buildResult: BuildResult = {
      files: new Map([["test.md", "# Test content"]]),
      success: true,
    };

    const createdManifest = await createSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    // Load it back
    const loadedManifest = await loadSnapshot(TEST_SNAPSHOT_DIR);

    expect(loadedManifest).not.toBeNull();
    if (loadedManifest) {
      expect(loadedManifest.fileCount).toBe(createdManifest.fileCount);
      expect(loadedManifest.timestamp).toBe(createdManifest.timestamp);
      expect(loadedManifest.version).toBe(createdManifest.version);
      expect(loadedManifest.fileHashes).toEqual(createdManifest.fileHashes);
    }
  });

  test("returns null if manifest doesn't exist", async () => {
    const manifest = await loadSnapshot(TEST_SNAPSHOT_DIR);
    expect(manifest).toBeNull();
  });

  test("returns null for invalid manifest (not JSON)", async () => {
    mkdirSync(TEST_SNAPSHOT_DIR, { recursive: true });
    const manifestPath = join(TEST_SNAPSHOT_DIR, "manifest.json");

    // Write invalid JSON
    const fs = await import("node:fs");
    fs.writeFileSync(manifestPath, "not valid json{", "utf-8");

    const manifest = await loadSnapshot(TEST_SNAPSHOT_DIR);
    expect(manifest).toBeNull();
  });

  test("returns null for manifest with missing fields", async () => {
    mkdirSync(TEST_SNAPSHOT_DIR, { recursive: true });
    const manifestPath = join(TEST_SNAPSHOT_DIR, "manifest.json");

    // Write incomplete manifest
    const fs = await import("node:fs");
    fs.writeFileSync(manifestPath, JSON.stringify({ timestamp: "2024-01-01T00:00:00Z" }), "utf-8");

    const manifest = await loadSnapshot(TEST_SNAPSHOT_DIR);
    expect(manifest).toBeNull();
  });
});

describe("verifySnapshot", () => {
  test("verifies matching build result", async () => {
    const buildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README\n\nHello world"],
        ["docs/api.md", "# API\n\nDocumentation"],
      ]),
      success: true,
    };

    // Create snapshot
    await createSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    // Verify against same content
    const result = await verifySnapshot(buildResult, TEST_SNAPSHOT_DIR);

    expect(result.matches).toBe(true);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  test("detects added files", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([["readme.md", "# README"]]),
      success: true,
    };

    await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    const newBuildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README"],
        ["new-file.md", "# New File"],
      ]),
      success: true,
    };

    const result = await verifySnapshot(newBuildResult, TEST_SNAPSHOT_DIR);

    expect(result.matches).toBe(false);
    expect(result.added).toEqual(["new-file.md"]);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  test("detects removed files", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README"],
        ["removed-file.md", "# Removed"],
      ]),
      success: true,
    };

    await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    const newBuildResult: BuildResult = {
      files: new Map([["readme.md", "# README"]]),
      success: true,
    };

    const result = await verifySnapshot(newBuildResult, TEST_SNAPSHOT_DIR);

    expect(result.matches).toBe(false);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toEqual(["removed-file.md"]);
    expect(result.modified).toHaveLength(0);
  });

  test("detects modified files", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([["readme.md", "# README\n\nOriginal content"]]),
      success: true,
    };

    await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    const newBuildResult: BuildResult = {
      files: new Map([["readme.md", "# README\n\nModified content"]]),
      success: true,
    };

    const result = await verifySnapshot(newBuildResult, TEST_SNAPSHOT_DIR);

    expect(result.matches).toBe(false);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(1);
    const modifiedFile = result.modified[0];
    if (modifiedFile) {
      expect(modifiedFile.file).toBe("readme.md");
      expect(modifiedFile.expectedHash).toBeTruthy();
      expect(modifiedFile.actualHash).toBeTruthy();
      expect(modifiedFile.expectedHash).not.toBe(modifiedFile.actualHash);
    }
  });

  test("detects multiple types of changes", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README"],
        ["modified.md", "Original"],
        ["removed.md", "Will be removed"],
      ]),
      success: true,
    };

    await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    const newBuildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README"], // Unchanged
        ["modified.md", "Modified"], // Modified
        ["added.md", "New file"], // Added
        // removed.md is missing
      ]),
      success: true,
    };

    const result = await verifySnapshot(newBuildResult, TEST_SNAPSHOT_DIR);

    expect(result.matches).toBe(false);
    expect(result.added).toEqual(["added.md"]);
    expect(result.removed).toEqual(["removed.md"]);
    expect(result.modified).toHaveLength(1);
    const modifiedFile = result.modified[0];
    if (modifiedFile) {
      expect(modifiedFile.file).toBe("modified.md");
    }
  });

  test("throws error if snapshot doesn't exist", async () => {
    const buildResult: BuildResult = {
      files: new Map([["test.md", "# Test"]]),
      success: true,
    };

    await expect(verifySnapshot(buildResult, TEST_SNAPSHOT_DIR)).rejects.toThrow(
      /No snapshot found/,
    );
  });

  test("results are sorted alphabetically", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([
        ["b.md", "B"],
        ["c.md", "C"],
        ["a.md", "A"],
      ]),
      success: true,
    };

    await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    const newBuildResult: BuildResult = {
      files: new Map([
        ["z.md", "Z"],
        ["a.md", "Modified A"],
        ["x.md", "X"],
      ]),
      success: true,
    };

    const result = await verifySnapshot(newBuildResult, TEST_SNAPSHOT_DIR);

    expect(result.added).toEqual(["x.md", "z.md"]); // Sorted
    expect(result.removed).toEqual(["b.md", "c.md"]); // Sorted
    const modifiedFile = result.modified[0];
    if (modifiedFile) {
      expect(modifiedFile.file).toBe("a.md");
    }
  });
});

describe("updateSnapshot", () => {
  test("updates existing snapshot with new content", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([["readme.md", "# Original"]]),
      success: true,
    };

    const originalManifest = await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    // Wait a tiny bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updatedBuildResult: BuildResult = {
      files: new Map([["readme.md", "# Updated"]]),
      success: true,
    };

    const updatedManifest = await updateSnapshot(updatedBuildResult, TEST_SNAPSHOT_DIR);

    // Verify manifest was updated
    expect(updatedManifest.timestamp).not.toBe(originalManifest.timestamp);
    const updatedHash = updatedManifest.fileHashes["readme.md"];
    const originalHash = originalManifest.fileHashes["readme.md"];
    expect(updatedHash).toBeDefined();
    expect(originalHash).toBeDefined();
    expect(updatedHash).not.toBe(originalHash);

    // Verify file content was updated
    const content = readFileSync(join(TEST_SNAPSHOT_DIR, "readme.md"), "utf-8");
    expect(content).toBe("# Updated");

    // Verify new content matches snapshot
    const verifyResult = await verifySnapshot(updatedBuildResult, TEST_SNAPSHOT_DIR);
    expect(verifyResult.matches).toBe(true);
  });

  test("can add files when updating", async () => {
    const originalBuildResult: BuildResult = {
      files: new Map([["readme.md", "# README"]]),
      success: true,
    };

    await createSnapshot(originalBuildResult, TEST_SNAPSHOT_DIR);

    const updatedBuildResult: BuildResult = {
      files: new Map([
        ["readme.md", "# README"],
        ["new-file.md", "# New"],
      ]),
      success: true,
    };

    const updatedManifest = await updateSnapshot(updatedBuildResult, TEST_SNAPSHOT_DIR);

    expect(updatedManifest.fileCount).toBe(2);
    const newFileHash = updatedManifest.fileHashes["new-file.md"];
    expect(newFileHash).toBeDefined();
    expect(newFileHash).toBeTruthy();
  });

  test("creates snapshot if it doesn't exist", async () => {
    const buildResult: BuildResult = {
      files: new Map([["readme.md", "# README"]]),
      success: true,
    };

    // Update without creating first
    const manifest = await updateSnapshot(buildResult, TEST_SNAPSHOT_DIR);

    expect(manifest.fileCount).toBe(1);
    expect(existsSync(join(TEST_SNAPSHOT_DIR, "manifest.json"))).toBe(true);
  });
});

describe("snapshot workflow integration", () => {
  test("complete workflow: create, verify, modify, detect changes, update", async () => {
    // 1. Create initial snapshot
    const initialBuild: BuildResult = {
      files: new Map([
        ["readme.md", "# My Project\n\nVersion 1.0"],
        ["docs/guide.md", "# Guide\n\nStep 1: Install"],
      ]),
      success: true,
    };

    const initialManifest = await createSnapshot(initialBuild, TEST_SNAPSHOT_DIR);
    expect(initialManifest.fileCount).toBe(2);

    // 2. Verify snapshot matches
    const verifyInitial = await verifySnapshot(initialBuild, TEST_SNAPSHOT_DIR);
    expect(verifyInitial.matches).toBe(true);

    // 3. Make some changes
    const modifiedBuild: BuildResult = {
      files: new Map([
        ["readme.md", "# My Project\n\nVersion 2.0"], // Modified
        ["docs/guide.md", "# Guide\n\nStep 1: Install"], // Unchanged
        ["docs/api.md", "# API\n\nNew documentation"], // Added
      ]),
      success: true,
    };

    // 4. Verify detects the changes
    const verifyModified = await verifySnapshot(modifiedBuild, TEST_SNAPSHOT_DIR);
    expect(verifyModified.matches).toBe(false);
    expect(verifyModified.modified).toHaveLength(1);
    const modifiedFile = verifyModified.modified[0];
    if (modifiedFile) {
      expect(modifiedFile.file).toBe("readme.md");
    }
    expect(verifyModified.added).toEqual(["docs/api.md"]);

    // 5. Update snapshot to accept changes
    const updatedManifest = await updateSnapshot(modifiedBuild, TEST_SNAPSHOT_DIR);
    expect(updatedManifest.fileCount).toBe(3);

    // 6. Verify new snapshot matches
    const verifyUpdated = await verifySnapshot(modifiedBuild, TEST_SNAPSHOT_DIR);
    expect(verifyUpdated.matches).toBe(true);

    // 7. Load and inspect final manifest
    const finalManifest = await loadSnapshot(TEST_SNAPSHOT_DIR);
    expect(finalManifest).not.toBeNull();
    if (finalManifest) {
      expect(finalManifest.fileCount).toBe(3);
      expect(Object.keys(finalManifest.fileHashes).sort()).toEqual([
        "docs/api.md",
        "docs/guide.md",
        "readme.md",
      ]);
    }
  });
});
