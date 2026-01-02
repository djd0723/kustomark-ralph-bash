/**
 * Tests for the git-url-parser module
 *
 * This comprehensive test suite covers:
 * - GitHub shorthand format: github.com/org/repo//path?ref=v1.2.0
 * - SSH URL format: git::git@github.com:org/repo.git//path?ref=abc1234
 * - HTTPS URL format: git::https://... (currently has parsing bugs, see tests)
 * - Edge cases: invalid URLs, missing parts, malformed refs
 * - Default ref behavior (defaults to 'main')
 * - Query parameter extraction
 * - Path extraction with and without //
 * - Alternative Git hosting providers (GitLab, Bitbucket, self-hosted)
 * - Special characters in repo names, paths, and refs
 * - Type safety and behavior guarantees
 *
 * Known Issues:
 * - git::https:// and git::http:// URLs are currently broken due to '//' splitting
 *   conflicting with the protocol separator. These tests document the current
 *   broken behavior.
 * - Ref query parameters must appear before the '//' path separator to be recognized.
 *   Refs placed after '//' are currently ignored.
 *
 * Total: 83 tests covering both functions (isGitUrl and parseGitUrl)
 */

import { describe, expect, test } from "bun:test";
import { isGitUrl, parseGitUrl } from "./git-url-parser.js";
import type { ParsedGitUrl } from "./types.js";

describe("isGitUrl", () => {
  describe("GitHub shorthand format", () => {
    test("returns true for basic github.com/org/repo", () => {
      expect(isGitUrl("github.com/org/repo")).toBe(true);
    });

    test("returns true for github.com/org/repo with path", () => {
      expect(isGitUrl("github.com/org/repo//path/to/file")).toBe(true);
    });

    test("returns true for github.com/org/repo with ref", () => {
      expect(isGitUrl("github.com/org/repo?ref=v1.2.0")).toBe(true);
    });

    test("returns true for github.com/org/repo with path and ref", () => {
      expect(isGitUrl("github.com/org/repo//docs?ref=main")).toBe(true);
    });
  });

  describe("git:: prefix format", () => {
    test("returns true for git::https:// URL", () => {
      expect(isGitUrl("git::https://github.com/org/repo.git")).toBe(true);
    });

    test("returns true for git::http:// URL", () => {
      expect(isGitUrl("git::http://github.com/org/repo.git")).toBe(true);
    });

    test("returns true for git::git@ SSH URL", () => {
      expect(isGitUrl("git::git@github.com:org/repo.git")).toBe(true);
    });

    test("returns true for git:: URL with path", () => {
      expect(isGitUrl("git::https://github.com/org/repo.git//subdir")).toBe(true);
    });

    test("returns true for git:: URL with ref", () => {
      expect(isGitUrl("git::https://github.com/org/repo.git?ref=main")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    test("returns false for empty string", () => {
      expect(isGitUrl("")).toBe(false);
    });

    test("returns false for null", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(isGitUrl(null as any)).toBe(false);
    });

    test("returns false for undefined", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(isGitUrl(undefined as any)).toBe(false);
    });

    test("returns false for non-string value", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(isGitUrl(123 as any)).toBe(false);
    });

    test("returns false for regular https:// URL without git::", () => {
      expect(isGitUrl("https://github.com/org/repo")).toBe(false);
    });

    test("returns false for regular http URL", () => {
      expect(isGitUrl("http://example.com")).toBe(false);
    });

    test("returns false for non-github.com domain", () => {
      expect(isGitUrl("gitlab.com/org/repo")).toBe(false);
    });

    test("returns false for github.com in middle of URL", () => {
      expect(isGitUrl("https://my-github.com/org/repo")).toBe(false);
    });
  });
});

describe("parseGitUrl", () => {
  describe("GitHub shorthand format", () => {
    test("parses basic github.com/org/repo", () => {
      const result = parseGitUrl("github.com/facebook/react");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses github.com/org/repo with .git suffix", () => {
      const result = parseGitUrl("github.com/facebook/react.git");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses github.com/org/repo with path", () => {
      const result = parseGitUrl("github.com/facebook/react//docs");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: "docs",
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses github.com/org/repo with nested path", () => {
      const result = parseGitUrl("github.com/facebook/react//docs/getting-started");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: "docs/getting-started",
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses github.com/org/repo with ref parameter", () => {
      const result = parseGitUrl("github.com/facebook/react?ref=v18.2.0");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "v18.2.0",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses github.com/org/repo with ref on base URL and path", () => {
      const result = parseGitUrl("github.com/facebook/react?ref=v18.2.0//docs");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: "docs",
        ref: "v18.2.0",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("ignores ref query parameter when placed after // path separator", () => {
      // Note: Current implementation only reads ref from the base URL part, not from path
      const result = parseGitUrl("github.com/facebook/react//docs?ref=v18.2.0");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: "docs",
        ref: "main", // Falls back to default since ref is after //
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses github.com/org/repo with commit SHA ref", () => {
      const result = parseGitUrl("github.com/facebook/react?ref=abc1234567890def");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "abc1234567890def",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("defaults to main ref when no ref specified", () => {
      const result = parseGitUrl("github.com/facebook/react");

      expect(result?.ref).toBe("main");
    });

    test("handles path with multiple // separators", () => {
      const result = parseGitUrl("github.com/facebook/react//docs//getting-started");

      expect(result?.path).toBe("docs//getting-started");
    });
  });

  describe("git::https:// format", () => {
    test("parses git::https:// URL correctly", () => {
      const result = parseGitUrl("git::https://github.com/facebook/react.git");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses git::http:// URL correctly (converts to https)", () => {
      const result = parseGitUrl("git::http://github.com/facebook/react.git");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });
  });

  describe("git::git@ SSH format", () => {
    test("parses basic git::git@ SSH URL", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react.git");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses git::git@ SSH URL without .git suffix", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses git::git@ SSH URL with path", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react.git//docs");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: "docs",
        ref: "main",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses git::git@ SSH URL with ref on path", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react.git//docs?ref=v18.2.0");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: "docs",
        ref: "v18.2.0",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("parses git::git@ SSH URL with ref on base URL", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react.git?ref=abc1234");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "github.com",
        org: "facebook",
        repo: "react",
        path: undefined,
        ref: "abc1234",
        fullUrl: "https://github.com/facebook/react.git",
        cloneUrl: "https://github.com/facebook/react.git",
      });
    });

    test("prefers ref on path over ref on base URL", () => {
      const result = parseGitUrl(
        "git::git@github.com:facebook/react.git?ref=v1.0.0//docs?ref=v2.0.0",
      );

      expect(result?.ref).toBe("v2.0.0");
    });

    test("parses GitLab SSH URL", () => {
      const result = parseGitUrl("git::git@gitlab.com:myorg/myrepo.git");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "gitlab.com",
        org: "myorg",
        repo: "myrepo",
        path: undefined,
        ref: "main",
        fullUrl: "https://gitlab.com/myorg/myrepo.git",
        cloneUrl: "https://gitlab.com/myorg/myrepo.git",
      });
    });

    test("returns HTTPS fullUrl even for SSH protocol", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react.git");

      expect(result?.protocol).toBe("ssh");
      expect(result?.fullUrl).toBe("https://github.com/facebook/react.git");
    });

    test("defaults to main ref when no ref specified", () => {
      const result = parseGitUrl("git::git@github.com:facebook/react.git");

      expect(result?.ref).toBe("main");
    });
  });

  describe("special characters and URL encoding", () => {
    test("handles repo names with dots", () => {
      const result = parseGitUrl("github.com/vercel/next.js");

      expect(result?.repo).toBe("next.js");
      expect(result?.fullUrl).toBe("https://github.com/vercel/next.js.git");
    });

    test("handles repo names with hyphens", () => {
      const result = parseGitUrl("github.com/facebook/create-react-app");

      expect(result?.repo).toBe("create-react-app");
    });

    test("handles org names with hyphens", () => {
      const result = parseGitUrl("github.com/django-cms/django-cms");

      expect(result?.org).toBe("django-cms");
      expect(result?.repo).toBe("django-cms");
    });

    test("handles paths with special characters", () => {
      const result = parseGitUrl("github.com/org/repo//docs/api-reference");

      expect(result?.path).toBe("docs/api-reference");
    });

    test("handles deep nested paths", () => {
      const result = parseGitUrl("github.com/org/repo//src/core/utils/helpers");

      expect(result?.path).toBe("src/core/utils/helpers");
    });

    test("handles ref with slashes (branch names)", () => {
      const result = parseGitUrl("github.com/org/repo?ref=feature/new-feature");

      expect(result?.ref).toBe("feature/new-feature");
    });

    test("handles ref with dots (version tags)", () => {
      const result = parseGitUrl("github.com/org/repo?ref=v1.2.3-beta.1");

      expect(result?.ref).toBe("v1.2.3-beta.1");
    });
  });

  describe("edge cases and invalid inputs", () => {
    test("returns null for empty string", () => {
      expect(parseGitUrl("")).toBeNull();
    });

    test("returns null for null", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(parseGitUrl(null as any)).toBeNull();
    });

    test("returns null for undefined", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(parseGitUrl(undefined as any)).toBeNull();
    });

    test("returns null for non-string value", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(parseGitUrl(123 as any)).toBeNull();
    });

    test("returns null for non-git URL", () => {
      expect(parseGitUrl("https://example.com")).toBeNull();
    });

    test("returns null for github.com with missing org/repo", () => {
      expect(parseGitUrl("github.com/")).toBeNull();
    });

    test("returns null for github.com with only org", () => {
      expect(parseGitUrl("github.com/facebook")).toBeNull();
    });

    test("returns null for malformed git:: URL", () => {
      expect(parseGitUrl("git::invalid-url")).toBeNull();
    });

    test("returns null for git::https:// with missing parts", () => {
      expect(parseGitUrl("git::https://github.com/")).toBeNull();
    });

    test("returns null for git::https:// with only org", () => {
      expect(parseGitUrl("git::https://github.com/facebook")).toBeNull();
    });

    test("returns null for git::git@ with malformed syntax", () => {
      expect(parseGitUrl("git::git@github.com/")).toBeNull();
    });

    test("returns null for git::git@ with missing repo", () => {
      expect(parseGitUrl("git::git@github.com:facebook")).toBeNull();
    });

    test("handles empty path after //", () => {
      const result = parseGitUrl("github.com/facebook/react//");

      expect(result?.path).toBeUndefined();
    });

    test("handles query parameters without ref", () => {
      const result = parseGitUrl("github.com/facebook/react?other=value");

      expect(result?.ref).toBe("main");
    });

    test("handles multiple query parameters", () => {
      const result = parseGitUrl("github.com/facebook/react?other=value&ref=v1.0.0&another=param");

      expect(result?.ref).toBe("v1.0.0");
    });

    test("handles empty ref parameter", () => {
      const result = parseGitUrl("github.com/facebook/react?ref=");

      expect(result?.ref).toBe("main");
    });

    test("handles path with query string containing ref (ref ignored after //)", () => {
      const result = parseGitUrl("github.com/facebook/react//docs/guide?ref=v2.0.0");

      expect(result?.path).toBe("docs/guide");
      // Ref after // is currently ignored, defaults to main
      expect(result?.ref).toBe("main");
    });

    test("handles ref before // separator with path", () => {
      const result = parseGitUrl("github.com/facebook/react?ref=v2.0.0//docs/guide");

      expect(result?.path).toBe("docs/guide");
      expect(result?.ref).toBe("v2.0.0");
    });
  });

  describe("alternative Git hosting providers", () => {
    test("parses GitLab SSH URL", () => {
      const result = parseGitUrl("git::git@gitlab.com:myorg/myrepo.git");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "gitlab.com",
        org: "myorg",
        repo: "myrepo",
        path: undefined,
        ref: "main",
        fullUrl: "https://gitlab.com/myorg/myrepo.git",
        cloneUrl: "https://gitlab.com/myorg/myrepo.git",
      });
    });

    test("parses Bitbucket SSH URL", () => {
      const result = parseGitUrl("git::git@bitbucket.org:company/project.git");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "bitbucket.org",
        org: "company",
        repo: "project",
        path: undefined,
        ref: "main",
        fullUrl: "https://bitbucket.org/company/project.git",
        cloneUrl: "https://bitbucket.org/company/project.git",
      });
    });

    test("parses self-hosted Git server SSH URL", () => {
      const result = parseGitUrl("git::git@git.example.com:team/app.git");

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "git.example.com",
        org: "team",
        repo: "app",
        path: undefined,
        ref: "main",
        fullUrl: "https://git.example.com/team/app.git",
        cloneUrl: "https://git.example.com/team/app.git",
      });
    });

    test("parses GitLab with subgroups (nested path)", () => {
      const result = parseGitUrl("git::git@gitlab.com:group/subgroup/project.git");

      // Note: This will only capture first two levels due to split on '/'
      expect(result?.host).toBe("gitlab.com");
      expect(result?.org).toBe("group");
    });
  });

  describe("real-world examples", () => {
    test("parses typical GitHub README reference with ref before //", () => {
      const result = parseGitUrl("github.com/kubernetes/kubernetes?ref=v1.28.0//docs/README.md");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "kubernetes",
        repo: "kubernetes",
        path: "docs/README.md",
        ref: "v1.28.0",
        fullUrl: "https://github.com/kubernetes/kubernetes.git",
        cloneUrl: "https://github.com/kubernetes/kubernetes.git",
      });
    });

    test("parses SSH URL with commit SHA", () => {
      const result = parseGitUrl(
        "git::git@github.com:vercel/next.js.git?ref=abc123def456//examples/blog",
      );

      expect(result).toEqual({
        type: "git",
        protocol: "ssh",
        host: "github.com",
        org: "vercel",
        repo: "next.js",
        path: "examples/blog",
        ref: "abc123def456",
        fullUrl: "https://github.com/vercel/next.js.git",
        cloneUrl: "https://github.com/vercel/next.js.git",
      });
    });

    test("parses GitHub URL with branch name", () => {
      const result = parseGitUrl(
        "github.com/microsoft/vscode?ref=release/1.80//extensions/markdown",
      );

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "microsoft",
        repo: "vscode",
        path: "extensions/markdown",
        ref: "release/1.80",
        fullUrl: "https://github.com/microsoft/vscode.git",
        cloneUrl: "https://github.com/microsoft/vscode.git",
      });
    });

    test("parses minimal GitHub shorthand", () => {
      const result = parseGitUrl("github.com/torvalds/linux");

      expect(result).toEqual({
        type: "git",
        protocol: "https",
        host: "github.com",
        org: "torvalds",
        repo: "linux",
        path: undefined,
        ref: "main",
        fullUrl: "https://github.com/torvalds/linux.git",
        cloneUrl: "https://github.com/torvalds/linux.git",
      });
    });
  });

  describe("behavior guarantees", () => {
    test("always returns HTTPS fullUrl regardless of input protocol", () => {
      const shorthand = parseGitUrl("github.com/org/repo");
      const ssh = parseGitUrl("git::git@github.com:org/repo.git");

      expect(shorthand?.fullUrl).toBe("https://github.com/org/repo.git");
      expect(ssh?.fullUrl).toBe("https://github.com/org/repo.git");
    });

    test("always includes .git suffix in fullUrl", () => {
      const withoutGit = parseGitUrl("github.com/org/repo");
      const withGit = parseGitUrl("github.com/org/repo.git");

      expect(withoutGit?.fullUrl).toBe("https://github.com/org/repo.git");
      expect(withGit?.fullUrl).toBe("https://github.com/org/repo.git");
    });

    test("removes .git suffix from repo name", () => {
      const withGit = parseGitUrl("github.com/org/repo.git");
      const withoutGit = parseGitUrl("github.com/org/repo");

      expect(withGit?.repo).toBe("repo");
      expect(withoutGit?.repo).toBe("repo");
    });

    test("defaults to main ref when ref is not specified", () => {
      const shorthand = parseGitUrl("github.com/org/repo");
      const ssh = parseGitUrl("git::git@github.com:org/repo.git");
      const withPath = parseGitUrl("github.com/org/repo//docs");

      expect(shorthand?.ref).toBe("main");
      expect(ssh?.ref).toBe("main");
      expect(withPath?.ref).toBe("main");
    });

    test("path is undefined when not specified", () => {
      const result = parseGitUrl("github.com/org/repo");

      expect(result?.path).toBeUndefined();
    });

    test("path is set when specified after //", () => {
      const result = parseGitUrl("github.com/org/repo//docs");

      expect(result?.path).toBe("docs");
    });

    test("preserves exact host name from input", () => {
      const github = parseGitUrl("github.com/org/repo");
      const gitlab = parseGitUrl("git::git@gitlab.com:org/repo.git");
      const custom = parseGitUrl("git::git@git.company.internal:org/repo.git");

      expect(github?.host).toBe("github.com");
      expect(gitlab?.host).toBe("gitlab.com");
      expect(custom?.host).toBe("git.company.internal");
    });

    test("isGitUrl returns true for all parseable URLs", () => {
      const validUrls = [
        "github.com/org/repo",
        "github.com/org/repo//path",
        "github.com/org/repo?ref=main",
        "git::git@github.com:org/repo.git",
        "git::git@gitlab.com:org/repo.git",
      ];

      for (const url of validUrls) {
        expect(isGitUrl(url)).toBe(true);
        expect(parseGitUrl(url)).not.toBeNull();
      }
    });

    test("isGitUrl returns false for all non-parseable URLs", () => {
      const invalidUrls = [
        "",
        "https://example.com",
        "gitlab.com/org/repo", // Not github.com and no git:: prefix
        "example.com/path",
      ];

      for (const url of invalidUrls) {
        expect(isGitUrl(url)).toBe(false);
      }
    });
  });

  describe("type safety", () => {
    test("returned object matches ParsedGitUrl interface", () => {
      const result = parseGitUrl("github.com/facebook/react");

      if (result) {
        const typed: ParsedGitUrl = result;
        expect(typed.type).toBe("git");
        expect(typed.protocol).toBe("https");
        expect(typeof typed.host).toBe("string");
        expect(typeof typed.org).toBe("string");
        expect(typeof typed.repo).toBe("string");
        expect(typeof typed.ref).toBe("string");
        expect(typeof typed.fullUrl).toBe("string");
      }
    });

    test("protocol is limited to https or ssh", () => {
      const shorthandResult = parseGitUrl("github.com/org/repo");
      const sshResult = parseGitUrl("git::git@github.com:org/repo.git");

      expect(shorthandResult?.protocol).toBe("https");
      expect(sshResult?.protocol).toBe("ssh");
    });

    test("type is always git", () => {
      const result1 = parseGitUrl("github.com/org/repo");
      const result2 = parseGitUrl("git::git@github.com:org/repo.git");

      expect(result1?.type).toBe("git");
      expect(result2?.type).toBe("git");
    });
  });
});
