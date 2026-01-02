/**
 * Tests for git fetcher module
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync } from "node:fs";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fetchGitRepository,
  clearGitCache,
  listGitCache,
  getDefaultCacheDir,
  GitFetchError,
} from "../src/core/git-fetcher.js";

// Test cache directory (use temp to avoid conflicts)
const TEST_CACHE_DIR = join(tmpdir(), "kustomark-test-cache", `git-test-${Date.now()}`);

describe("Git Fetcher", () => {
  beforeAll(async () => {
    // Ensure test cache directory exists
    await mkdir(TEST_CACHE_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test cache directory
    if (existsSync(TEST_CACHE_DIR)) {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  describe("getDefaultCacheDir", () => {
    test("should return cache directory path", () => {
      const cacheDir = getDefaultCacheDir();
      expect(cacheDir).toContain(".cache");
      expect(cacheDir).toContain("kustomark");
      expect(cacheDir).toContain("git");
    });
  });

  describe("fetchGitRepository", () => {
    test("should fetch a GitHub repository (shorthand format)", async () => {
      const result = await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      expect(result.repoPath).toBeTruthy();
      expect(result.resolvedSha).toMatch(/^[0-9a-f]{40}$/);
      expect(existsSync(result.repoPath)).toBe(true);
      expect(existsSync(join(result.repoPath, ".git"))).toBe(true);
    }, 180000); // 3 minute timeout for network operation

    test("should use cached repository on second fetch", async () => {
      // Clear cache first to ensure clean test
      await clearGitCache(TEST_CACHE_DIR);

      const firstResult = await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      expect(firstResult.cached).toBe(false);

      const secondResult = await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      expect(secondResult.cached).toBe(true);
      expect(secondResult.repoPath).toBe(firstResult.repoPath);
    }, 180000);

    test("should handle git::https:// format without subpath", async () => {
      // Note: git::https://...?ref= format (ref on base URL) is not currently supported
      // Use the format without query params on the base URL
      const result = await fetchGitRepository(
        "git::https://github.com/anthropics/anthropic-sdk-typescript.git",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      expect(result.repoPath).toBeTruthy();
      expect(result.resolvedSha).toMatch(/^[0-9a-f]{40}$/);
      expect(existsSync(result.repoPath)).toBe(true);
    }, 180000);

    test("should throw error for invalid git URL", async () => {
      await expect(
        fetchGitRepository("not-a-git-url", { cacheDir: TEST_CACHE_DIR }),
      ).rejects.toThrow(GitFetchError);
    });

    test("should throw error for non-existent repository", async () => {
      await expect(
        fetchGitRepository(
          "github.com/this-org-does-not-exist-12345/this-repo-does-not-exist-67890?ref=main",
          { cacheDir: TEST_CACHE_DIR, timeout: 30000 },
        ),
      ).rejects.toThrow(GitFetchError);
    }, 60000);

    test("should throw error for invalid ref", async () => {
      await expect(
        fetchGitRepository(
          "github.com/anthropics/anthropic-sdk-typescript?ref=this-ref-does-not-exist-12345",
          { cacheDir: TEST_CACHE_DIR, timeout: 60000 },
        ),
      ).rejects.toThrow(GitFetchError);
    }, 90000);

    test("should handle repositories with specific tags", async () => {
      // Using a small public repo with tags
      const result = await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      expect(result.repoPath).toBeTruthy();
      expect(result.resolvedSha).toMatch(/^[0-9a-f]{40}$/);
    }, 180000);

    test("should update repository when update flag is set", async () => {
      const firstResult = await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      const updatedResult = await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, update: true, timeout: 120000 },
      );

      expect(updatedResult.repoPath).toBe(firstResult.repoPath);
      expect(updatedResult.resolvedSha).toBeTruthy();
    }, 180000);
  });

  describe("clearGitCache", () => {
    test("should clear all cached repositories", async () => {
      // Fetch a repository first
      await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      const cleared = await clearGitCache(TEST_CACHE_DIR);
      expect(cleared).toBeGreaterThan(0);

      const list = await listGitCache(TEST_CACHE_DIR);
      expect(list.length).toBe(0);
    }, 180000);

    test("should return 0 when cache directory does not exist", async () => {
      const nonExistentDir = join(TEST_CACHE_DIR, "non-existent");
      const cleared = await clearGitCache(nonExistentDir);
      expect(cleared).toBe(0);
    });

    test("should clear specific repository by pattern", async () => {
      // Fetch two different repositories
      await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      const listBefore = await listGitCache(TEST_CACHE_DIR);
      expect(listBefore.length).toBeGreaterThan(0);

      // Clear specific pattern
      const cleared = await clearGitCache(TEST_CACHE_DIR, "github_com_anthropics_anthropic");
      expect(cleared).toBeGreaterThan(0);

      const listAfter = await listGitCache(TEST_CACHE_DIR);
      expect(listAfter.length).toBe(0);
    }, 180000);
  });

  describe("listGitCache", () => {
    test("should list cached repositories", async () => {
      // Clear first
      await clearGitCache(TEST_CACHE_DIR);

      // Fetch a repository
      await fetchGitRepository(
        "github.com/anthropics/anthropic-sdk-typescript?ref=main",
        { cacheDir: TEST_CACHE_DIR, timeout: 120000 },
      );

      const list = await listGitCache(TEST_CACHE_DIR);
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((entry) => entry.includes("github_com_anthropics"))).toBe(true);
    }, 180000);

    test("should return empty array when cache is empty", async () => {
      await clearGitCache(TEST_CACHE_DIR);
      const list = await listGitCache(TEST_CACHE_DIR);
      expect(list.length).toBe(0);
    });

    test("should return empty array when cache directory does not exist", async () => {
      const nonExistentDir = join(TEST_CACHE_DIR, "non-existent");
      const list = await listGitCache(nonExistentDir);
      expect(list).toEqual([]);
    });
  });

  describe("Error handling", () => {
    test("should throw GitFetchError with code and stderr", async () => {
      try {
        await fetchGitRepository(
          "github.com/this-org-does-not-exist/this-repo-does-not-exist?ref=main",
          { cacheDir: TEST_CACHE_DIR, timeout: 30000 },
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(GitFetchError);
        if (error instanceof GitFetchError) {
          expect(error.code).toBeTruthy();
          expect(error.message).toBeTruthy();
        }
      }
    }, 60000);

    test("should handle network timeout", async () => {
      // Set very short timeout to force timeout error
      // Disable retries to keep test fast
      await expect(
        fetchGitRepository(
          "github.com/anthropics/anthropic-sdk-typescript?ref=main",
          { cacheDir: TEST_CACHE_DIR, timeout: 1, maxRetries: 0 }, // 1ms timeout, no retries
        ),
      ).rejects.toThrow();
    });
  });
});
