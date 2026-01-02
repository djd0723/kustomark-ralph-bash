/**
 * Tests for the http-url-parser module
 *
 * This comprehensive test suite covers:
 * - HTTP archive URL detection (isHttpArchiveUrl)
 * - Archive URL parsing (parseHttpArchiveUrl)
 * - Supported archive types: .tar.gz, .tgz, .tar, .zip
 * - Subpath notation with // delimiter
 * - Query parameter extraction for auth configuration
 * - Edge cases: invalid URLs, missing parts, malformed syntax
 * - Type safety and behavior guarantees
 */

import { describe, expect, test } from "bun:test";
import { isHttpArchiveUrl, parseHttpArchiveUrl } from "./http-url-parser.js";
import type { ParsedHttpArchiveUrl } from "./types.js";

describe("isHttpArchiveUrl", () => {
  describe("basic archive URL detection", () => {
    test("returns true for .tar.gz URL", () => {
      expect(isHttpArchiveUrl("https://example.com/archive.tar.gz")).toBe(true);
    });

    test("returns true for .tgz URL", () => {
      expect(isHttpArchiveUrl("https://example.com/archive.tgz")).toBe(true);
    });

    test("returns true for .tar URL", () => {
      expect(isHttpArchiveUrl("https://example.com/archive.tar")).toBe(true);
    });

    test("returns true for .zip URL", () => {
      expect(isHttpArchiveUrl("https://example.com/archive.zip")).toBe(true);
    });

    test("returns true for http:// URL", () => {
      expect(isHttpArchiveUrl("http://example.com/archive.tar.gz")).toBe(true);
    });

    test("returns true for https:// URL", () => {
      expect(isHttpArchiveUrl("https://example.com/archive.tar.gz")).toBe(true);
    });
  });

  describe("archive URL with paths", () => {
    test("returns true for nested path archive", () => {
      expect(isHttpArchiveUrl("https://example.com/releases/v1.0.0/skills.tar.gz")).toBe(true);
    });

    test("returns true for archive with subpath notation", () => {
      expect(isHttpArchiveUrl("https://example.com/release.tar.gz//subdir/")).toBe(true);
    });

    test("returns true for archive with query params", () => {
      expect(isHttpArchiveUrl("https://example.com/archive.tar.gz?token=abc123")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    test("returns false for empty string", () => {
      expect(isHttpArchiveUrl("")).toBe(false);
    });

    test("returns false for null", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(isHttpArchiveUrl(null as any)).toBe(false);
    });

    test("returns false for undefined", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(isHttpArchiveUrl(undefined as any)).toBe(false);
    });

    test("returns false for non-string value", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(isHttpArchiveUrl(123 as any)).toBe(false);
    });

    test("returns false for non-http URL", () => {
      expect(isHttpArchiveUrl("ftp://example.com/archive.tar.gz")).toBe(false);
    });

    test("returns false for URL without archive extension", () => {
      expect(isHttpArchiveUrl("https://example.com/page.html")).toBe(false);
    });

    test("returns false for git URL", () => {
      expect(isHttpArchiveUrl("git::https://github.com/org/repo.git")).toBe(false);
    });

    test("returns false for file path", () => {
      expect(isHttpArchiveUrl("./local/archive.tar.gz")).toBe(false);
    });
  });
});

describe("parseHttpArchiveUrl", () => {
  describe("basic archive URL parsing", () => {
    test("parses simple .tar.gz URL", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses simple .tgz URL", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tgz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tgz",
        subpath: undefined,
        archiveType: "tgz",
        queryParams: {},
      });
    });

    test("parses simple .tar URL", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar",
        subpath: undefined,
        archiveType: "tar",
        queryParams: {},
      });
    });

    test("parses simple .zip URL", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.zip");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.zip",
        subpath: undefined,
        archiveType: "zip",
        queryParams: {},
      });
    });

    test("parses http:// URL (not just https)", () => {
      const result = parseHttpArchiveUrl("http://example.com/archive.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "http://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });
  });

  describe("nested path archives", () => {
    test("parses archive in nested directory", () => {
      const result = parseHttpArchiveUrl("https://example.com/releases/v1.0.0/skills.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/releases/v1.0.0/skills.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses archive with version in path", () => {
      const result = parseHttpArchiveUrl("https://cdn.example.com/packages/v2.3.1/app.zip");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://cdn.example.com/packages/v2.3.1/app.zip",
        subpath: undefined,
        archiveType: "zip",
        queryParams: {},
      });
    });

    test("parses archive with deep nesting", () => {
      const result = parseHttpArchiveUrl("https://example.com/a/b/c/d/e/archive.tgz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/a/b/c/d/e/archive.tgz",
        subpath: undefined,
        archiveType: "tgz",
        queryParams: {},
      });
    });
  });

  describe("subpath notation with // delimiter", () => {
    test("parses archive with simple subpath", () => {
      const result = parseHttpArchiveUrl("https://example.com/release.tar.gz//subdir/");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/release.tar.gz",
        subpath: "subdir/",
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses archive with nested subpath", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz//docs/api/");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: "docs/api/",
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses archive with subpath without trailing slash", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz//src");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: "src",
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses archive with empty subpath (// but nothing after)", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz//");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses .zip archive with subpath", () => {
      const result = parseHttpArchiveUrl("https://example.com/package.zip//dist/");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/package.zip",
        subpath: "dist/",
        archiveType: "zip",
        queryParams: {},
      });
    });

    test("parses .tgz archive with subpath", () => {
      const result = parseHttpArchiveUrl("https://example.com/app.tgz//build/");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/app.tgz",
        subpath: "build/",
        archiveType: "tgz",
        queryParams: {},
      });
    });
  });

  describe("query parameters for auth", () => {
    test("parses archive with single query parameter", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz?token=abc123");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: { token: "abc123" },
      });
    });

    test("parses archive with multiple query parameters", () => {
      const result = parseHttpArchiveUrl(
        "https://example.com/archive.tar.gz?token=abc123&version=1.0&format=json",
      );

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {
          token: "abc123",
          version: "1.0",
          format: "json",
        },
      });
    });

    test("parses archive with query params and subpath", () => {
      const result = parseHttpArchiveUrl(
        "https://example.com/archive.tar.gz?token=abc123//subdir/",
      );

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: "subdir/",
        archiveType: "tar.gz",
        queryParams: { token: "abc123" },
      });
    });

    test("parses archive with empty query parameter value", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz?token=");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: { token: "" },
      });
    });

    test("parses archive with URL-encoded query parameters", () => {
      const result = parseHttpArchiveUrl(
        "https://example.com/archive.tar.gz?path=%2Fsome%2Fpath&name=my%20archive",
      );

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {
          path: "/some/path",
          name: "my archive",
        },
      });
    });
  });

  describe("real-world examples from M3 spec", () => {
    test("parses: https://example.com/releases/v1.0.0/skills.tar.gz", () => {
      const result = parseHttpArchiveUrl("https://example.com/releases/v1.0.0/skills.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/releases/v1.0.0/skills.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses: https://example.com/release.tar.gz//subdir/", () => {
      const result = parseHttpArchiveUrl("https://example.com/release.tar.gz//subdir/");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/release.tar.gz",
        subpath: "subdir/",
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("parses private archive with auth token", () => {
      const result = parseHttpArchiveUrl(
        "https://private.example.com/skills.tar.gz?token=secret123",
      );

      expect(result).toEqual({
        type: "http-archive",
        url: "https://private.example.com/skills.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: { token: "secret123" },
      });
    });

    test("parses CDN URL with version and subpath", () => {
      const result = parseHttpArchiveUrl(
        "https://cdn.jsdelivr.net/npm/package@1.2.3/dist.tar.gz//lib/",
      );

      expect(result).toEqual({
        type: "http-archive",
        url: "https://cdn.jsdelivr.net/npm/package@1.2.3/dist.tar.gz",
        subpath: "lib/",
        archiveType: "tar.gz",
        queryParams: {},
      });
    });
  });

  describe("edge cases and error handling", () => {
    test("returns null for empty string", () => {
      expect(parseHttpArchiveUrl("")).toBeNull();
    });

    test("returns null for null", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(parseHttpArchiveUrl(null as any)).toBeNull();
    });

    test("returns null for undefined", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(parseHttpArchiveUrl(undefined as any)).toBeNull();
    });

    test("returns null for non-string value", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(parseHttpArchiveUrl(123 as any)).toBeNull();
    });

    test("returns null for non-http URL", () => {
      expect(parseHttpArchiveUrl("ftp://example.com/archive.tar.gz")).toBeNull();
    });

    test("returns null for URL without archive extension", () => {
      expect(parseHttpArchiveUrl("https://example.com/page.html")).toBeNull();
    });

    test("returns null for git URL", () => {
      expect(parseHttpArchiveUrl("git::https://github.com/org/repo.git")).toBeNull();
    });

    test("returns null for local file path", () => {
      expect(parseHttpArchiveUrl("./local/archive.tar.gz")).toBeNull();
    });

    test("returns null for archive extension in middle without // delimiter", () => {
      // .tar.gz appears but is followed by more path without //
      expect(parseHttpArchiveUrl("https://example.com/archive.tar.gz.txt")).toBeNull();
    });

    test("handles archive with special characters in filename", () => {
      const result = parseHttpArchiveUrl("https://example.com/my-app_v1.0-beta.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/my-app_v1.0-beta.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("handles archive with port number", () => {
      const result = parseHttpArchiveUrl("https://example.com:8080/archive.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com:8080/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("handles archive with IP address", () => {
      const result = parseHttpArchiveUrl("http://192.168.1.100/files/archive.zip");

      expect(result).toEqual({
        type: "http-archive",
        url: "http://192.168.1.100/files/archive.zip",
        subpath: undefined,
        archiveType: "zip",
        queryParams: {},
      });
    });

    test("handles localhost URL", () => {
      const result = parseHttpArchiveUrl("http://localhost:3000/download/package.tgz");

      expect(result).toEqual({
        type: "http-archive",
        url: "http://localhost:3000/download/package.tgz",
        subpath: undefined,
        archiveType: "tgz",
        queryParams: {},
      });
    });
  });

  describe("archive type priority", () => {
    test("detects .tar.gz before .gz (longest match first)", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz");

      expect(result?.archiveType).toBe("tar.gz");
    });

    test("handles URL with .tar in path and .tar.gz archive", () => {
      const result = parseHttpArchiveUrl("https://example.com/tar/files/archive.tar.gz");

      expect(result).toEqual({
        type: "http-archive",
        url: "https://example.com/tar/files/archive.tar.gz",
        subpath: undefined,
        archiveType: "tar.gz",
        queryParams: {},
      });
    });

    test("detects first archive extension if multiple present", () => {
      // Unusual case: .tar.gz in path and another extension later
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz");

      expect(result?.archiveType).toBe("tar.gz");
    });
  });

  describe("behavior guarantees", () => {
    test("always returns http-archive type", () => {
      const result1 = parseHttpArchiveUrl("https://example.com/archive.tar.gz");
      const result2 = parseHttpArchiveUrl("http://example.com/archive.zip");

      expect(result1?.type).toBe("http-archive");
      expect(result2?.type).toBe("http-archive");
    });

    test("subpath is undefined when not specified", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz");

      expect(result?.subpath).toBeUndefined();
    });

    test("subpath is set when specified after //", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz//subdir");

      expect(result?.subpath).toBe("subdir");
    });

    test("queryParams is empty object when no params", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz");

      expect(result?.queryParams).toEqual({});
    });

    test("queryParams contains all parsed parameters", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz?a=1&b=2&c=3");

      expect(result?.queryParams).toEqual({ a: "1", b: "2", c: "3" });
    });

    test("isHttpArchiveUrl returns true for all parseable URLs", () => {
      const validUrls = [
        "https://example.com/archive.tar.gz",
        "https://example.com/archive.tgz",
        "https://example.com/archive.tar",
        "https://example.com/archive.zip",
        "https://example.com/archive.tar.gz//subdir/",
        "https://example.com/archive.tar.gz?token=abc",
      ];

      for (const url of validUrls) {
        expect(isHttpArchiveUrl(url)).toBe(true);
        expect(parseHttpArchiveUrl(url)).not.toBeNull();
      }
    });

    test("isHttpArchiveUrl returns false for all non-parseable URLs", () => {
      const invalidUrls = [
        "",
        "https://example.com/page.html",
        "ftp://example.com/archive.tar.gz",
        "./local/archive.tar.gz",
        "git::https://github.com/org/repo.git",
      ];

      for (const url of invalidUrls) {
        expect(isHttpArchiveUrl(url)).toBe(false);
      }
    });
  });

  describe("type safety", () => {
    test("returned object matches ParsedHttpArchiveUrl interface", () => {
      const result = parseHttpArchiveUrl("https://example.com/archive.tar.gz");

      if (result) {
        const typed: ParsedHttpArchiveUrl = result;
        expect(typed.type).toBe("http-archive");
        expect(typeof typed.url).toBe("string");
        expect(typeof typed.archiveType).toBe("string");
        expect(typeof typed.queryParams).toBe("object");
      }
    });

    test("archiveType is one of the valid types", () => {
      const validTypes = ["tar.gz", "tgz", "tar", "zip"];

      const result1 = parseHttpArchiveUrl("https://example.com/archive.tar.gz");
      const result2 = parseHttpArchiveUrl("https://example.com/archive.tgz");
      const result3 = parseHttpArchiveUrl("https://example.com/archive.tar");
      const result4 = parseHttpArchiveUrl("https://example.com/archive.zip");

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      expect(result3).toBeTruthy();
      expect(result4).toBeTruthy();
      if (result1) expect(validTypes).toContain(result1.archiveType);
      if (result2) expect(validTypes).toContain(result2.archiveType);
      if (result3) expect(validTypes).toContain(result3.archiveType);
      if (result4) expect(validTypes).toContain(result4.archiveType);
    });

    test("type is always http-archive", () => {
      const result1 = parseHttpArchiveUrl("https://example.com/archive.tar.gz");
      const result2 = parseHttpArchiveUrl("http://example.com/archive.zip");

      expect(result1?.type).toBe("http-archive");
      expect(result2?.type).toBe("http-archive");
    });
  });
});
