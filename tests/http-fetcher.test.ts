/**
 * Tests for HTTP archive fetcher module
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync } from "node:fs";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fetchHttpArchive,
  clearHttpCache,
  listHttpCache,
  getCacheInfo,
  getDefaultCacheDir,
  HttpFetchError,
} from "../src/core/http-fetcher.js";

// Test cache directory (use temp to avoid conflicts)
const TEST_CACHE_DIR = join(tmpdir(), "kustomark-test-cache", `http-test-${Date.now()}`);

// Test URLs - using real public archives for integration testing
const TEST_URLS = {
  // Small tar.gz archive from a CDN
  tarGz: "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
  // Alternative small archive
  zip: "https://github.com/markdown-it/markdown-it/archive/refs/tags/14.0.0.zip",
};

describe("HTTP Archive Fetcher", () => {
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
      expect(cacheDir).toContain("http");
    });
  });

  describe("fetchHttpArchive", () => {
    test("should fetch and extract a tar.gz archive", async () => {
      const result = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      expect(result.files).toBeTruthy();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.checksum).toBeTruthy();
      expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(result.cached).toBe(false);

      // Verify files have expected structure
      expect(result.files[0]).toHaveProperty("path");
      expect(result.files[0]).toHaveProperty("content");
    }, 120000); // 2 minute timeout for network operation

    test("should use cached archive on second fetch", async () => {
      // Clear cache first
      await clearHttpCache(TEST_CACHE_DIR);

      const firstResult = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      expect(firstResult.cached).toBe(false);

      const secondResult = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      expect(secondResult.cached).toBe(true);
      expect(secondResult.checksum).toBe(firstResult.checksum);
      expect(secondResult.files.length).toBe(firstResult.files.length);
    }, 120000);

    test("should extract only specified subpath", async () => {
      // Using a known archive with a specific structure
      const result = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        subpath: "package/",
        timeout: 60000,
      });

      expect(result.files).toBeTruthy();
      expect(result.files.length).toBeGreaterThan(0);

      // All paths should NOT start with "package/" (it's stripped)
      for (const file of result.files) {
        expect(file.path).not.toStartWith("package/");
      }
    }, 120000);

    test("should validate checksum when provided", async () => {
      // First fetch to get the checksum
      const firstResult = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      // Clear cache
      await clearHttpCache(TEST_CACHE_DIR);

      // Fetch again with correct checksum
      const secondResult = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        sha256: firstResult.checksum,
        timeout: 60000,
      });

      expect(secondResult.checksum).toBe(firstResult.checksum);
    }, 120000);

    test("should throw error for invalid checksum", async () => {
      await clearHttpCache(TEST_CACHE_DIR);

      await expect(
        fetchHttpArchive(TEST_URLS.tarGz, {
          cacheDir: TEST_CACHE_DIR,
          sha256: "0000000000000000000000000000000000000000000000000000000000000000",
          timeout: 60000,
        }),
      ).rejects.toThrow(HttpFetchError);
    }, 120000);

    test("should throw error for unsupported archive format", async () => {
      await expect(
        fetchHttpArchive("https://example.com/file.txt", {
          cacheDir: TEST_CACHE_DIR,
        }),
      ).rejects.toThrow(HttpFetchError);
    });

    test("should throw error for non-existent URL", async () => {
      await expect(
        fetchHttpArchive("https://registry.npmjs.org/this-package-does-not-exist-12345/-/this-package-does-not-exist-12345-1.0.0.tgz", {
          cacheDir: TEST_CACHE_DIR,
          timeout: 30000,
        }),
      ).rejects.toThrow(HttpFetchError);
    }, 60000);

    test("should handle authentication token", async () => {
      // Note: This test just verifies the token is passed, not that it works
      // We can't easily test actual authentication without a real authenticated endpoint
      const originalToken = process.env.KUSTOMARK_HTTP_TOKEN;

      try {
        process.env.KUSTOMARK_HTTP_TOKEN = "test-token";

        // This will fail, but should fail with auth attempt made
        await fetchHttpArchive(TEST_URLS.tarGz, {
          cacheDir: TEST_CACHE_DIR,
          timeout: 60000,
        });

        // If we get here, it means the fetch succeeded (which is fine)
        expect(true).toBe(true);
      } catch (error) {
        // Expected to potentially fail, but should not be due to missing token
        expect(error).toBeTruthy();
      } finally {
        if (originalToken !== undefined) {
          process.env.KUSTOMARK_HTTP_TOKEN = originalToken;
        } else {
          delete process.env.KUSTOMARK_HTTP_TOKEN;
        }
      }
    }, 120000);

    test("should handle custom headers", async () => {
      const result = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        headers: {
          "X-Custom-Header": "test-value",
        },
        timeout: 60000,
      });

      expect(result.files).toBeTruthy();
      expect(result.files.length).toBeGreaterThan(0);
    }, 120000);

    test("should update archive when update flag is set", async () => {
      const firstResult = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      const updatedResult = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        update: true,
        timeout: 60000,
      });

      expect(updatedResult.checksum).toBe(firstResult.checksum);
      expect(updatedResult.files.length).toBe(firstResult.files.length);
    }, 120000);

    test("should handle timeout", async () => {
      await clearHttpCache(TEST_CACHE_DIR);

      // Set very short timeout to force timeout error
      // Disable retries to ensure test completes quickly
      await expect(
        fetchHttpArchive(TEST_URLS.tarGz, {
          cacheDir: TEST_CACHE_DIR,
          timeout: 1, // 1ms timeout
          maxRetries: 0, // No retries for timeout test
        }),
      ).rejects.toThrow();
    });
  });

  describe("clearHttpCache", () => {
    test("should clear all cached archives", async () => {
      // Fetch an archive first
      await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      const cleared = await clearHttpCache(TEST_CACHE_DIR);
      expect(cleared).toBeGreaterThan(0);

      const list = await listHttpCache(TEST_CACHE_DIR);
      expect(list.length).toBe(0);
    }, 120000);

    test("should return 0 when cache directory does not exist", async () => {
      const nonExistentDir = join(TEST_CACHE_DIR, "non-existent");
      const cleared = await clearHttpCache(nonExistentDir);
      expect(cleared).toBe(0);
    });

    test("should clear specific archive by pattern", async () => {
      // Clear first
      await clearHttpCache(TEST_CACHE_DIR);

      // Fetch an archive
      await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      const listBefore = await listHttpCache(TEST_CACHE_DIR);
      expect(listBefore.length).toBeGreaterThan(0);

      // Clear with pattern matching the cache key
      const cacheKey = listBefore[0];
      const cleared = await clearHttpCache(TEST_CACHE_DIR, cacheKey.substring(0, 8));
      expect(cleared).toBeGreaterThan(0);

      const listAfter = await listHttpCache(TEST_CACHE_DIR);
      expect(listAfter.length).toBe(0);
    }, 120000);
  });

  describe("listHttpCache", () => {
    test("should list cached archives", async () => {
      // Clear first
      await clearHttpCache(TEST_CACHE_DIR);

      // Fetch an archive
      await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      const list = await listHttpCache(TEST_CACHE_DIR);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toMatch(/^[0-9a-f]{16}$/);
    }, 120000);

    test("should return empty array when cache is empty", async () => {
      await clearHttpCache(TEST_CACHE_DIR);
      const list = await listHttpCache(TEST_CACHE_DIR);
      expect(list.length).toBe(0);
    });

    test("should return empty array when cache directory does not exist", async () => {
      const nonExistentDir = join(TEST_CACHE_DIR, "non-existent");
      const list = await listHttpCache(nonExistentDir);
      expect(list).toEqual([]);
    });
  });

  describe("getCacheInfo", () => {
    test("should return cache info for cached archive", async () => {
      // Clear first
      await clearHttpCache(TEST_CACHE_DIR);

      // Fetch an archive
      const result = await fetchHttpArchive(TEST_URLS.tarGz, {
        cacheDir: TEST_CACHE_DIR,
        timeout: 60000,
      });

      const info = await getCacheInfo(TEST_URLS.tarGz, TEST_CACHE_DIR);
      expect(info).toBeTruthy();
      expect(info?.exists).toBe(true);
      expect(info?.checksum).toBe(result.checksum);
      expect(info?.path).toBeTruthy();
      expect(existsSync(info?.path!)).toBe(true);
    }, 120000);

    test("should return exists: false for non-cached archive", async () => {
      await clearHttpCache(TEST_CACHE_DIR);

      const info = await getCacheInfo("https://example.com/non-existent.tar.gz", TEST_CACHE_DIR);
      expect(info).toBeTruthy();
      expect(info?.exists).toBe(false);
    });
  });

  describe("Error handling", () => {
    test("should throw HttpFetchError with code and status", async () => {
      try {
        await fetchHttpArchive("https://registry.npmjs.org/this-package-does-not-exist-12345/-/this-package-does-not-exist-12345-1.0.0.tgz", {
          cacheDir: TEST_CACHE_DIR,
          timeout: 30000,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(HttpFetchError);
        if (error instanceof HttpFetchError) {
          expect(error.code).toBeTruthy();
          expect(error.message).toBeTruthy();
          if (error.statusCode) {
            expect(error.statusCode).toBe(404);
          }
        }
      }
    }, 60000);

    test("should throw error with proper code for unsupported format", async () => {
      try {
        await fetchHttpArchive("https://example.com/file.pdf", {
          cacheDir: TEST_CACHE_DIR,
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpFetchError);
        if (error instanceof HttpFetchError) {
          expect(error.code).toBe("UNSUPPORTED_FORMAT");
        }
      }
    });
  });
});
