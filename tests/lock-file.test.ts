/**
 * Tests for lock file module
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync } from "node:fs";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseLockFile,
  serializeLockFile,
  getLockFilePath,
  loadLockFile,
  saveLockFile,
  findLockEntry,
  updateLockEntry,
  calculateContentHash,
} from "../src/core/lock-file.js";
import type { LockFile, LockFileEntry } from "../src/core/types.js";

// Test directory
const TEST_DIR = join(tmpdir(), "kustomark-test-lock", `lock-test-${Date.now()}`);

describe("Lock File Module", () => {
  beforeEach(async () => {
    // Ensure test directory exists
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("parseLockFile", () => {
    describe("valid lock files", () => {
      test("should parse minimal valid lock file", () => {
        const yaml = `version: 1
resources: []
`;
        const lockFile = parseLockFile(yaml);

        expect(lockFile.version).toBe(1);
        expect(lockFile.resources).toEqual([]);
      });

      test("should parse lock file with single entry", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo//path?ref=v1.0.0
    resolved: abc123def456
    integrity: sha256-1234567890abcdef
    fetched: '2025-01-15T10:30:00Z'
`;
        const lockFile = parseLockFile(yaml);

        expect(lockFile.version).toBe(1);
        expect(lockFile.resources).toHaveLength(1);
        expect(lockFile.resources[0]?.url).toBe("github.com/org/repo//path?ref=v1.0.0");
        expect(lockFile.resources[0]?.resolved).toBe("abc123def456");
        expect(lockFile.resources[0]?.integrity).toBe("sha256-1234567890abcdef");
        expect(lockFile.resources[0]?.fetched).toBe("2025-01-15T10:30:00Z");
      });

      test("should parse lock file with multiple entries", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo1//path?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: '2025-01-15T10:30:00Z'
  - url: https://example.com/archive.tar.gz
    resolved: https://example.com/archive.tar.gz
    integrity: sha256-def456
    fetched: '2025-01-15T10:35:00Z'
`;
        const lockFile = parseLockFile(yaml);

        expect(lockFile.version).toBe(1);
        expect(lockFile.resources).toHaveLength(2);
        expect(lockFile.resources[0]?.url).toBe("github.com/org/repo1//path?ref=v1.0.0");
        expect(lockFile.resources[1]?.url).toBe("https://example.com/archive.tar.gz");
      });

      test("should parse lock file with git and http entries", () => {
        const yaml = `version: 1
resources:
  - url: git::https://github.com/org/repo.git//subdir?ref=main
    resolved: abc123def456abc123def456abc123def456abc1
    integrity: sha256-abcdef1234567890
    fetched: '2025-01-15T10:30:00.000Z'
  - url: https://registry.npmjs.org/package/-/package-1.0.0.tgz
    resolved: https://registry.npmjs.org/package/-/package-1.0.0.tgz
    integrity: sha256-fedcba0987654321
    fetched: '2025-01-15T10:35:00.000Z'
`;
        const lockFile = parseLockFile(yaml);

        expect(lockFile.version).toBe(1);
        expect(lockFile.resources).toHaveLength(2);
      });

      test("should parse lock file with various timestamp formats", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo1?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: '2025-01-15T10:30:00Z'
  - url: github.com/org/repo2?ref=v1.0.0
    resolved: def456
    integrity: sha256-def456
    fetched: '2025-01-15T10:30:00.000Z'
  - url: github.com/org/repo3?ref=v1.0.0
    resolved: ghi789
    integrity: sha256-ghi789
    fetched: '2025-01-15T10:30:00+00:00'
`;
        const lockFile = parseLockFile(yaml);

        expect(lockFile.version).toBe(1);
        expect(lockFile.resources).toHaveLength(3);
      });
    });

    describe("invalid lock files", () => {
      test("should throw error for malformed YAML", () => {
        const yaml = `version: 1
resources: [unclosed
`;
        expect(() => parseLockFile(yaml)).toThrow("YAML parsing error");
      });

      test("should throw error for invalid YAML syntax", () => {
        const yaml = `{invalid: yaml: syntax:}`;
        expect(() => parseLockFile(yaml)).toThrow("YAML parsing error");
      });

      test("should throw error for empty string", () => {
        expect(() => parseLockFile("")).toThrow("Lock file must be a YAML object");
      });

      test("should throw error for whitespace-only string", () => {
        expect(() => parseLockFile("   \n  \n  ")).toThrow("Lock file must be a YAML object");
      });

      test("should throw error for YAML null", () => {
        expect(() => parseLockFile("null")).toThrow("Lock file must be a YAML object");
      });

      test("should throw error for YAML primitive", () => {
        expect(() => parseLockFile("just a string")).toThrow("Lock file must be a YAML object");
      });

      test("should throw error for YAML array", () => {
        const yaml = "- item1\n- item2";
        // YAML arrays are objects in JS, so will fail on missing version
        expect(() => parseLockFile(yaml)).toThrow("version");
      });

      test("should throw error for missing version", () => {
        const yaml = `resources: []`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file must have a numeric 'version' field");
      });

      test("should throw error for non-numeric version", () => {
        const yaml = `version: "1"
resources: []
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file must have a numeric 'version' field");
      });

      test("should throw error for missing resources", () => {
        const yaml = `version: 1`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file must have a 'resources' array");
      });

      test("should throw error for non-array resources", () => {
        const yaml = `version: 1
resources: "not-an-array"
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file must have a 'resources' array");
      });

      test("should throw error for resource entry not an object", () => {
        const yaml = `version: 1
resources:
  - "string-entry"
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must be an object");
      });

      test("should throw error for missing url field", () => {
        const yaml = `version: 1
resources:
  - resolved: abc123
    integrity: sha256-abc123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'url' field");
      });

      test("should throw error for non-string url", () => {
        const yaml = `version: 1
resources:
  - url: 123
    resolved: abc123
    integrity: sha256-abc123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'url' field");
      });

      test("should throw error for missing resolved field", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    integrity: sha256-abc123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'resolved' field");
      });

      test("should throw error for non-string resolved", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: 123
    integrity: sha256-abc123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'resolved' field");
      });

      test("should throw error for missing integrity field", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'integrity' field");
      });

      test("should throw error for non-string integrity", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: 123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'integrity' field");
      });

      test("should throw error for integrity without sha256- prefix", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: abc123
    fetched: 2025-01-15T10:30:00Z
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 integrity must start with 'sha256-'");
      });

      test("should throw error for missing fetched field", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'fetched' field");
      });

      test("should throw error for non-string fetched", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: 123
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 must have a string 'fetched' field");
      });

      test("should throw error for invalid ISO 8601 timestamp", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: not-a-timestamp
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 has invalid ISO 8601 timestamp in 'fetched' field");
      });

      test("should throw error for invalid date format", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: 'not-a-valid-date'
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 0 has invalid ISO 8601 timestamp in 'fetched' field");
      });

      test("should validate all entries and report first error", () => {
        const yaml = `version: 1
resources:
  - url: github.com/org/repo1?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: '2025-01-15T10:30:00Z'
  - url: github.com/org/repo2?ref=v1.0.0
    resolved: def456
    integrity: wrong-format
    fetched: '2025-01-15T10:30:00Z'
`;
        expect(() => parseLockFile(yaml)).toThrow("Lock file resource at index 1 integrity must start with 'sha256-'");
      });
    });
  });

  describe("serializeLockFile", () => {
    test("should serialize empty lock file", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [],
      };

      const yaml = serializeLockFile(lockFile);

      expect(yaml).toContain("version: 1");
      expect(yaml).toContain("resources: []");
    });

    test("should serialize lock file with single entry", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo//path?ref=v1.0.0",
            resolved: "abc123def456",
            integrity: "sha256-1234567890abcdef",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);

      expect(yaml).toContain("version: 1");
      expect(yaml).toContain("url: github.com/org/repo//path?ref=v1.0.0");
      expect(yaml).toContain("resolved: abc123def456");
      expect(yaml).toContain("integrity: sha256-1234567890abcdef");
      expect(yaml).toContain("fetched: '2025-01-15T10:30:00Z'");
    });

    test("should serialize lock file with multiple entries", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
          {
            url: "https://example.com/archive.tar.gz",
            resolved: "https://example.com/archive.tar.gz",
            integrity: "sha256-def456",
            fetched: "2025-01-15T10:35:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);

      expect(yaml).toContain("version: 1");
      expect(yaml).toContain("github.com/org/repo1?ref=v1.0.0");
      expect(yaml).toContain("https://example.com/archive.tar.gz");
    });

    test("should sort resources by URL", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "https://z-example.com/archive.tar.gz",
            resolved: "https://z-example.com/archive.tar.gz",
            integrity: "sha256-zzz",
            fetched: "2025-01-15T10:30:00Z",
          },
          {
            url: "github.com/a-org/repo?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-aaa",
            fetched: "2025-01-15T10:30:00Z",
          },
          {
            url: "github.com/m-org/repo?ref=v1.0.0",
            resolved: "mid123",
            integrity: "sha256-mmm",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);
      const lines = yaml.split("\n");

      const aIndex = lines.findIndex((line) => line.includes("github.com/a-org"));
      const mIndex = lines.findIndex((line) => line.includes("github.com/m-org"));
      const zIndex = lines.findIndex((line) => line.includes("https://z-example.com"));

      expect(aIndex).toBeLessThan(mIndex);
      expect(mIndex).toBeLessThan(zIndex);
    });

    test("should produce valid YAML that can be parsed back", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo?ref=v1.0.0",
            resolved: "abc123def456",
            integrity: "sha256-1234567890abcdef",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);
      const parsed = parseLockFile(yaml);

      expect(parsed).toEqual(lockFile);
    });
  });

  describe("round-trip serialization", () => {
    test("should maintain data integrity through parse-serialize-parse cycle", () => {
      const original: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
          {
            url: "https://example.com/archive.tar.gz",
            resolved: "https://example.com/archive.tar.gz",
            integrity: "sha256-def456",
            fetched: "2025-01-15T10:35:00Z",
          },
        ],
      };

      const serialized = serializeLockFile(original);
      const parsed = parseLockFile(serialized);
      const reserialized = serializeLockFile(parsed);

      expect(parsed.version).toBe(original.version);
      expect(parsed.resources).toHaveLength(original.resources.length);
      expect(serialized).toBe(reserialized);
    });

    test("should handle empty lock file through round trip", () => {
      const original: LockFile = {
        version: 1,
        resources: [],
      };

      const serialized = serializeLockFile(original);
      const parsed = parseLockFile(serialized);

      expect(parsed).toEqual(original);
    });

    test("should preserve all field values through round trip", () => {
      const original: LockFile = {
        version: 1,
        resources: [
          {
            url: "git::https://github.com/org/repo.git//subdir?ref=abc123def456abc123def456abc123def456abc1",
            resolved: "abc123def456abc123def456abc123def456abc123def456abc123def456abc12345",
            integrity: "sha256-fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
            fetched: "2025-01-15T10:30:00.123Z",
          },
        ],
      };

      const serialized = serializeLockFile(original);
      const parsed = parseLockFile(serialized);

      expect(parsed.resources[0]).toEqual(original.resources[0]);
    });
  });

  describe("getLockFilePath", () => {
    test("should return lock file path in same directory as config", () => {
      const configPath = "/path/to/kustomark.yaml";
      const lockPath = getLockFilePath(configPath);

      expect(lockPath).toBe("/path/to/kustomark.lock");
    });

    test("should handle config in current directory", () => {
      const configPath = "kustomark.yaml";
      const lockPath = getLockFilePath(configPath);

      expect(lockPath).toBe("kustomark.lock");
    });

    test("should handle config in nested directory", () => {
      const configPath = "/deep/nested/path/to/config/kustomark.yaml";
      const lockPath = getLockFilePath(configPath);

      expect(lockPath).toBe("/deep/nested/path/to/config/kustomark.lock");
    });

    test("should handle config with different name", () => {
      const configPath = "/path/to/custom-config.yaml";
      const lockPath = getLockFilePath(configPath);

      expect(lockPath).toBe("/path/to/kustomark.lock");
    });
  });

  describe("loadLockFile", () => {
    test("should return null for non-existent lock file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFile = loadLockFile(configPath);

      expect(lockFile).toBeNull();
    });

    test("should load valid lock file from filesystem", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      const yaml = `version: 1
resources:
  - url: github.com/org/repo?ref=v1.0.0
    resolved: abc123
    integrity: sha256-abc123
    fetched: '2025-01-15T10:30:00Z'
`;
      await writeFile(lockFilePath, yaml, "utf-8");

      const lockFile = loadLockFile(configPath);

      expect(lockFile).not.toBeNull();
      expect(lockFile?.version).toBe(1);
      expect(lockFile?.resources).toHaveLength(1);
      expect(lockFile?.resources[0]?.url).toBe("github.com/org/repo?ref=v1.0.0");
    });

    test("should return null for invalid lock file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      const yaml = `version: 1
resources: "invalid"
`;
      await writeFile(lockFilePath, yaml, "utf-8");

      const lockFile = loadLockFile(configPath);

      expect(lockFile).toBeNull();
    });

    test("should return null for malformed YAML", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      const yaml = `version: 1
resources: [unclosed
`;
      await writeFile(lockFilePath, yaml, "utf-8");

      const lockFile = loadLockFile(configPath);

      expect(lockFile).toBeNull();
    });

    test("should load empty lock file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      const yaml = `version: 1
resources: []
`;
      await writeFile(lockFilePath, yaml, "utf-8");

      const lockFile = loadLockFile(configPath);

      expect(lockFile).not.toBeNull();
      expect(lockFile?.resources).toEqual([]);
    });
  });

  describe("saveLockFile", () => {
    test("should save lock file to filesystem", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      saveLockFile(configPath, lockFile);

      expect(existsSync(lockFilePath)).toBe(true);

      const loaded = loadLockFile(configPath);
      expect(loaded).not.toBeNull();
      expect(loaded?.resources).toHaveLength(1);
      expect(loaded?.resources[0]?.url).toBe("github.com/org/repo?ref=v1.0.0");
    });

    test("should overwrite existing lock file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      // Save first version
      const lockFile1: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };
      saveLockFile(configPath, lockFile1);

      // Save second version
      const lockFile2: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo2?ref=v2.0.0",
            resolved: "def456",
            integrity: "sha256-def456",
            fetched: "2025-01-15T10:35:00Z",
          },
        ],
      };
      saveLockFile(configPath, lockFile2);

      const loaded = loadLockFile(configPath);
      expect(loaded?.resources).toHaveLength(1);
      expect(loaded?.resources[0]?.url).toBe("github.com/org/repo2?ref=v2.0.0");
    });

    test("should save empty lock file", async () => {
      const configPath = join(TEST_DIR, "kustomark.yaml");
      const lockFilePath = join(TEST_DIR, "kustomark.lock");

      const lockFile: LockFile = {
        version: 1,
        resources: [],
      };

      saveLockFile(configPath, lockFile);

      expect(existsSync(lockFilePath)).toBe(true);

      const loaded = loadLockFile(configPath);
      expect(loaded).not.toBeNull();
      expect(loaded?.resources).toEqual([]);
    });
  });

  describe("findLockEntry", () => {
    test("should find entry by exact URL match", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
          {
            url: "github.com/org/repo2?ref=v2.0.0",
            resolved: "def456",
            integrity: "sha256-def456",
            fetched: "2025-01-15T10:35:00Z",
          },
        ],
      };

      const entry = findLockEntry(lockFile, "github.com/org/repo2?ref=v2.0.0");

      expect(entry).not.toBeNull();
      expect(entry?.url).toBe("github.com/org/repo2?ref=v2.0.0");
      expect(entry?.resolved).toBe("def456");
    });

    test("should return null for non-existent URL", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const entry = findLockEntry(lockFile, "github.com/org/nonexistent?ref=v1.0.0");

      expect(entry).toBeNull();
    });

    test("should return null for empty lock file", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [],
      };

      const entry = findLockEntry(lockFile, "github.com/org/repo?ref=v1.0.0");

      expect(entry).toBeNull();
    });

    test("should match URL case-sensitively", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/Repo?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const entry1 = findLockEntry(lockFile, "github.com/org/Repo?ref=v1.0.0");
      const entry2 = findLockEntry(lockFile, "github.com/org/repo?ref=v1.0.0");

      expect(entry1).not.toBeNull();
      expect(entry2).toBeNull();
    });

    test("should find entry with complex URL", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "git::https://github.com/org/repo.git//subdir/path?ref=abc123def",
            resolved: "abc123def456abc123def456abc123def456abc1",
            integrity: "sha256-abcdef123456",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const entry = findLockEntry(lockFile, "git::https://github.com/org/repo.git//subdir/path?ref=abc123def");

      expect(entry).not.toBeNull();
      expect(entry?.resolved).toBe("abc123def456abc123def456abc123def456abc1");
    });
  });

  describe("updateLockEntry", () => {
    test("should add new entry to empty lock file", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [],
      };

      const entry: LockFileEntry = {
        url: "github.com/org/repo?ref=v1.0.0",
        resolved: "abc123",
        integrity: "sha256-abc123",
        fetched: "2025-01-15T10:30:00Z",
      };

      const updated = updateLockEntry(lockFile, entry);

      expect(updated.resources).toHaveLength(1);
      expect(updated.resources[0]).toEqual(entry);
    });

    test("should add new entry to existing lock file", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const entry: LockFileEntry = {
        url: "github.com/org/repo2?ref=v2.0.0",
        resolved: "def456",
        integrity: "sha256-def456",
        fetched: "2025-01-15T10:35:00Z",
      };

      const updated = updateLockEntry(lockFile, entry);

      expect(updated.resources).toHaveLength(2);
      expect(updated.resources[1]).toEqual(entry);
    });

    test("should update existing entry with same URL", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo?ref=v1.0.0",
            resolved: "old-sha",
            integrity: "sha256-old",
            fetched: "2025-01-15T10:00:00Z",
          },
        ],
      };

      const entry: LockFileEntry = {
        url: "github.com/org/repo?ref=v1.0.0",
        resolved: "new-sha",
        integrity: "sha256-new",
        fetched: "2025-01-15T10:30:00Z",
      };

      const updated = updateLockEntry(lockFile, entry);

      expect(updated.resources).toHaveLength(1);
      expect(updated.resources[0]?.resolved).toBe("new-sha");
      expect(updated.resources[0]?.integrity).toBe("sha256-new");
      expect(updated.resources[0]?.fetched).toBe("2025-01-15T10:30:00Z");
    });

    test("should update entry in middle of list", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo1?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
          {
            url: "github.com/org/repo2?ref=v2.0.0",
            resolved: "old-def456",
            integrity: "sha256-old-def456",
            fetched: "2025-01-15T10:00:00Z",
          },
          {
            url: "github.com/org/repo3?ref=v3.0.0",
            resolved: "ghi789",
            integrity: "sha256-ghi789",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const entry: LockFileEntry = {
        url: "github.com/org/repo2?ref=v2.0.0",
        resolved: "new-def456",
        integrity: "sha256-new-def456",
        fetched: "2025-01-15T10:35:00Z",
      };

      const updated = updateLockEntry(lockFile, entry);

      expect(updated.resources).toHaveLength(3);
      expect(updated.resources[0]?.url).toBe("github.com/org/repo1?ref=v1.0.0");
      expect(updated.resources[1]?.url).toBe("github.com/org/repo2?ref=v2.0.0");
      expect(updated.resources[1]?.resolved).toBe("new-def456");
      expect(updated.resources[2]?.url).toBe("github.com/org/repo3?ref=v3.0.0");
    });

    test("should not mutate original lock file", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo?ref=v1.0.0",
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const entry: LockFileEntry = {
        url: "github.com/org/repo2?ref=v2.0.0",
        resolved: "def456",
        integrity: "sha256-def456",
        fetched: "2025-01-15T10:35:00Z",
      };

      const updated = updateLockEntry(lockFile, entry);

      expect(lockFile.resources).toHaveLength(1);
      expect(updated.resources).toHaveLength(2);
    });
  });

  describe("calculateContentHash", () => {
    test("should calculate hash for string content", () => {
      const content = "Hello, World!";
      const hash = calculateContentHash(content);

      expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
      expect(hash).toContain("sha256-");
    });

    test("should calculate hash for empty string", () => {
      const content = "";
      const hash = calculateContentHash(content);

      expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
      expect(hash).toBe("sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    test("should calculate hash for Uint8Array content", () => {
      const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const hash = calculateContentHash(content);

      expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    });

    test("should return different hashes for different content", () => {
      const hash1 = calculateContentHash("content1");
      const hash2 = calculateContentHash("content2");

      expect(hash1).not.toBe(hash2);
    });

    test("should return same hash for same content", () => {
      const content = "consistent content";
      const hash1 = calculateContentHash(content);
      const hash2 = calculateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    test("should handle large content", () => {
      const content = "x".repeat(1000000); // 1MB of 'x'
      const hash = calculateContentHash(content);

      expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    });

    test("should handle binary content", () => {
      const content = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
      const hash = calculateContentHash(content);

      expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    });

    test("should handle UTF-8 content", () => {
      const content = "こんにちは世界 🌍";
      const hash = calculateContentHash(content);

      expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    });
  });

  describe("edge cases", () => {
    test("should handle lock file with duplicate URLs (keeps last)", () => {
      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo?ref=v1.0.0",
            resolved: "first",
            integrity: "sha256-first",
            fetched: "2025-01-15T10:00:00Z",
          },
        ],
      };

      const entry1: LockFileEntry = {
        url: "github.com/org/repo?ref=v1.0.0",
        resolved: "second",
        integrity: "sha256-second",
        fetched: "2025-01-15T10:10:00Z",
      };

      const entry2: LockFileEntry = {
        url: "github.com/org/repo?ref=v1.0.0",
        resolved: "third",
        integrity: "sha256-third",
        fetched: "2025-01-15T10:20:00Z",
      };

      const updated1 = updateLockEntry(lockFile, entry1);
      const updated2 = updateLockEntry(updated1, entry2);

      expect(updated2.resources).toHaveLength(1);
      expect(updated2.resources[0]?.resolved).toBe("third");
    });

    test("should handle very long URLs", () => {
      const longUrl = `github.com/org/repo//very/deep/nested/path/that/goes/on/and/on/and/on/file.md?ref=v1.0.0&param1=value1&param2=value2&param3=value3`;

      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: longUrl,
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);
      const parsed = parseLockFile(yaml);

      expect(parsed.resources[0]?.url).toBe(longUrl);
    });

    test("should handle special characters in URLs", () => {
      const specialUrl = "github.com/org/repo//path%20with%20spaces?ref=v1.0.0&key=value%3Dtest";

      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: specialUrl,
            resolved: "abc123",
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);
      const parsed = parseLockFile(yaml);

      expect(parsed.resources[0]?.url).toBe(specialUrl);
    });

    test("should handle very long SHA values", () => {
      const longSha = "abc123def456abc123def456abc123def456abc123def456abc123def456abc123def456abc123def456";

      const lockFile: LockFile = {
        version: 1,
        resources: [
          {
            url: "github.com/org/repo?ref=v1.0.0",
            resolved: longSha,
            integrity: "sha256-abc123",
            fetched: "2025-01-15T10:30:00Z",
          },
        ],
      };

      const yaml = serializeLockFile(lockFile);
      const parsed = parseLockFile(yaml);

      expect(parsed.resources[0]?.resolved).toBe(longSha);
    });

    test("should handle lock file with many entries", () => {
      const entries: LockFileEntry[] = [];
      for (let i = 0; i < 100; i++) {
        entries.push({
          url: `github.com/org/repo${i}?ref=v1.0.0`,
          resolved: `sha${i}`,
          integrity: `sha256-hash${i}`,
          fetched: "2025-01-15T10:30:00Z",
        });
      }

      const lockFile: LockFile = {
        version: 1,
        resources: entries,
      };

      const yaml = serializeLockFile(lockFile);
      const parsed = parseLockFile(yaml);

      expect(parsed.resources).toHaveLength(100);
    });
  });
});
