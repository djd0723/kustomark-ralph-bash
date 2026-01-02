/**
 * Tests for file operations engine
 *
 * These tests verify the core file operation functions:
 * - copy-file: Adds a mapping from source to destination (changes output path)
 * - rename-file: Renames files using glob patterns (changes just the filename in destination)
 * - delete-file: Deletes files using glob patterns (removes from map)
 * - move-file: Moves files to new directories using glob patterns (changes directory in destination)
 *
 * File map structure: Map<sourcePath, destinationPath>
 * - Key: source file path (where the file comes from)
 * - Value: destination file path (where the file will be written in output)
 */

import { describe, expect, test } from "bun:test";
import {
  applyCopyFile,
  applyRenameFile,
  applyDeleteFile,
  applyMoveFile,
  validatePath,
} from "../../src/core/file-operations.js";

describe("File Operations", () => {
  describe("validatePath", () => {
    test("allows normal paths", () => {
      expect(() => validatePath("file.md", "/base")).not.toThrow();
      expect(() => validatePath("dir/file.md", "/base")).not.toThrow();
      expect(() => validatePath("a/b/c/file.md", "/base")).not.toThrow();
    });

    test("throws on path traversal with ..", () => {
      expect(() => validatePath("../file.md", "/base")).toThrow("Path traversal detected");
      expect(() => validatePath("../../etc/passwd", "/base")).toThrow("Path traversal detected");
      expect(() => validatePath("dir/../../file.md", "/base")).toThrow("Path traversal detected");
    });

    test("throws on absolute paths that escape base", () => {
      expect(() => validatePath("/etc/passwd", "/base")).toThrow("Path traversal detected");
      expect(() => validatePath("/tmp/file.md", "/base")).toThrow("Path traversal detected");
    });

    test("allows paths with .. that normalize within base", () => {
      // These are safe because they normalize to within the base
      expect(() => validatePath("a/../file.md", "/base")).not.toThrow();
      expect(() => validatePath("a/b/../c/file.md", "/base")).not.toThrow();
    });
  });

  describe("copy-file", () => {
    test("basic copy: changes output destination for source", () => {
      const fileMap = new Map([
        ["src/file1.md", "file1.md"],
        ["src/file2.md", "file2.md"],
      ]);

      const result = applyCopyFile(
        fileMap,
        "src/file1.md",
        "copy/file1-copy.md",
        "/project",
      );

      expect(result.count).toBe(1);
      expect(result.fileMap.size).toBe(2);
      // The source now maps to the new destination
      expect(result.fileMap.get("src/file1.md")).toBe("copy/file1-copy.md");
      expect(result.fileMap.get("src/file2.md")).toBe("file2.md");
    });

    test("copy with nested directories in destination", () => {
      const fileMap = new Map([
        ["README.md", "README.md"],
      ]);

      const result = applyCopyFile(
        fileMap,
        "README.md",
        "docs/backup/README.md",
        "/project",
      );

      expect(result.count).toBe(1);
      expect(result.fileMap.get("README.md")).toBe("docs/backup/README.md");
    });

    test("copy can overwrite existing destination mapping", () => {
      const fileMap = new Map([
        ["src/file1.md", "output/old.md"],
      ]);

      const result = applyCopyFile(
        fileMap,
        "src/file1.md",
        "output/new.md",
        "/project",
      );

      expect(result.count).toBe(1);
      expect(result.fileMap.get("src/file1.md")).toBe("output/new.md");
    });

    test("throws on path traversal in source", () => {
      const fileMap = new Map([["file.md", "file.md"]]);

      expect(() =>
        applyCopyFile(fileMap, "../etc/passwd", "copy.md", "/project"),
      ).toThrow("Path traversal detected");
    });

    test("throws on path traversal in destination", () => {
      const fileMap = new Map([["file.md", "file.md"]]);

      expect(() =>
        applyCopyFile(fileMap, "file.md", "../etc/passwd", "/project"),
      ).toThrow("Path traversal detected");
    });

    test("does not mutate original file map", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);
      const originalSize = fileMap.size;

      applyCopyFile(fileMap, "src/file.md", "copy.md", "/project");

      expect(fileMap.size).toBe(originalSize);
      expect(fileMap.get("src/file.md")).toBe("file.md");
    });
  });

  describe("rename-file", () => {
    test("basic rename: single file match with exact filename", () => {
      const fileMap = new Map([
        ["src/README.md", "README.md"],
        ["src/guide.md", "guide.md"],
      ]);

      // Rename just the filename part (glob matches source keys)
      const result = applyRenameFile(
        fileMap,
        "src/README.md",
        "INDEX.md",
        "/project",
      );

      expect(result.count).toBe(1);
      expect(result.fileMap.size).toBe(2);
      expect(result.fileMap.get("src/README.md")).toBe("INDEX.md");
      expect(result.fileMap.get("src/guide.md")).toBe("guide.md");
    });

    test("glob pattern matching: rename all .txt files", () => {
      const fileMap = new Map([
        ["src/file1.txt", "file1.txt"],
        ["src/file2.txt", "file2.txt"],
        ["src/file3.md", "file3.md"],
      ]);

      // Glob pattern matches against source keys (src/file*.txt)
      const result = applyRenameFile(
        fileMap,
        "src/*.txt",
        "renamed.txt",
        "/project",
      );

      expect(result.count).toBe(2);
      expect(result.fileMap.size).toBe(3);
      expect(result.fileMap.get("src/file1.txt")).toBe("renamed.txt");
      expect(result.fileMap.get("src/file2.txt")).toBe("renamed.txt");
      expect(result.fileMap.get("src/file3.md")).toBe("file3.md");
    });

    test("glob pattern with path: rename files in subdirectory", () => {
      const fileMap = new Map([
        ["src/docs/guide.md", "docs/guide.md"],
        ["src/docs/tutorial.md", "docs/tutorial.md"],
        ["src/README.md", "README.md"],
      ]);

      const result = applyRenameFile(
        fileMap,
        "src/docs/*.md",
        "INDEX.md",
        "/project",
      );

      expect(result.count).toBe(2);
      // Destination directory is preserved, only filename changes
      expect(result.fileMap.get("src/docs/guide.md")).toBe("docs/INDEX.md");
      expect(result.fileMap.get("src/docs/tutorial.md")).toBe("docs/INDEX.md");
      expect(result.fileMap.get("src/README.md")).toBe("README.md");
    });

    test("rename with path preservation: only filename changes", () => {
      const fileMap = new Map([
        ["src/a/b/file.md", "output/a/b/file.md"],
        ["src/x/y/file.md", "output/x/y/file.md"],
      ]);

      const result = applyRenameFile(
        fileMap,
        "**/*.md",
        "renamed.md",
        "/project",
      );

      expect(result.count).toBe(2);
      expect(result.fileMap.get("src/a/b/file.md")).toBe("output/a/b/renamed.md");
      expect(result.fileMap.get("src/x/y/file.md")).toBe("output/x/y/renamed.md");
    });

    test("no matches: returns unchanged map with count 0", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);

      const result = applyRenameFile(
        fileMap,
        "nonexistent.txt",
        "renamed.txt",
        "/project",
      );

      expect(result.count).toBe(0);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.get("src/file.md")).toBe("file.md");
    });

    test("throws on rename with path separator", () => {
      const fileMap = new Map([["file.md", "file.md"]]);

      expect(() =>
        applyRenameFile(fileMap, "*.md", "dir/renamed.md", "/project"),
      ).toThrow("must be a filename, not a path");
    });

    test("throws on rename with backslash", () => {
      const fileMap = new Map([["file.md", "file.md"]]);

      expect(() =>
        applyRenameFile(fileMap, "*.md", "dir\\renamed.md", "/project"),
      ).toThrow("must be a filename, not a path");
    });

    test("throws on rename with ..", () => {
      const fileMap = new Map([["file.md", "file.md"]]);

      expect(() =>
        applyRenameFile(fileMap, "*.md", "../renamed.md", "/project"),
      ).toThrow("must be a filename, not a path");
    });

    test("does not mutate original file map", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);
      const originalSize = fileMap.size;
      const originalDest = fileMap.get("src/file.md");

      applyRenameFile(fileMap, "*.md", "renamed.md", "/project");

      expect(fileMap.size).toBe(originalSize);
      expect(fileMap.get("src/file.md")).toBe(originalDest);
    });
  });

  describe("delete-file", () => {
    test("basic delete: single file", () => {
      const fileMap = new Map([
        ["src/file1.md", "file1.md"],
        ["src/file2.md", "file2.md"],
      ]);

      const result = applyDeleteFile(fileMap, "src/file1.md", "/project");

      expect(result.count).toBe(1);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.has("src/file1.md")).toBe(false);
      expect(result.fileMap.get("src/file2.md")).toBe("file2.md");
    });

    test("glob pattern matching: delete all .txt files", () => {
      const fileMap = new Map([
        ["src/file1.txt", "file1.txt"],
        ["src/file2.txt", "file2.txt"],
        ["src/file3.md", "file3.md"],
      ]);

      // Glob matches source keys
      const result = applyDeleteFile(fileMap, "src/*.txt", "/project");

      expect(result.count).toBe(2);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.has("src/file1.txt")).toBe(false);
      expect(result.fileMap.has("src/file2.txt")).toBe(false);
      expect(result.fileMap.get("src/file3.md")).toBe("file3.md");
    });

    test("glob pattern with path: delete files in subdirectory", () => {
      const fileMap = new Map([
        ["src/docs/guide.md", "docs/guide.md"],
        ["src/docs/tutorial.md", "docs/tutorial.md"],
        ["src/README.md", "README.md"],
      ]);

      const result = applyDeleteFile(fileMap, "src/docs/*.md", "/project");

      expect(result.count).toBe(2);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.has("src/docs/guide.md")).toBe(false);
      expect(result.fileMap.has("src/docs/tutorial.md")).toBe(false);
      expect(result.fileMap.get("src/README.md")).toBe("README.md");
    });

    test("delete multiple files with ** pattern", () => {
      const fileMap = new Map([
        ["src/a/file1.md", "a/file1.md"],
        ["src/b/file2.md", "b/file2.md"],
        ["src/c/file3.md", "c/file3.md"],
        ["src/x.txt", "x.txt"],
      ]);

      const result = applyDeleteFile(fileMap, "**/*.md", "/project");

      expect(result.count).toBe(3);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.get("src/x.txt")).toBe("x.txt");
    });

    test("no matches: returns unchanged map with count 0", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);

      const result = applyDeleteFile(fileMap, "nonexistent.txt", "/project");

      expect(result.count).toBe(0);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.get("src/file.md")).toBe("file.md");
    });

    test("delete all files with * pattern", () => {
      const fileMap = new Map([
        ["file1.md", "file1.md"],
        ["file2.md", "file2.md"],
        ["file3.md", "file3.md"],
      ]);

      const result = applyDeleteFile(fileMap, "*", "/project");

      expect(result.count).toBe(3);
      expect(result.fileMap.size).toBe(0);
    });

    test("does not mutate original file map", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);
      const originalSize = fileMap.size;

      applyDeleteFile(fileMap, "*.md", "/project");

      expect(fileMap.size).toBe(originalSize);
      expect(fileMap.has("src/file.md")).toBe(true);
    });
  });

  describe("move-file", () => {
    test("basic move: single file to new directory", () => {
      const fileMap = new Map([
        ["src/file1.md", "file1.md"],
        ["src/file2.md", "file2.md"],
      ]);

      const result = applyMoveFile(fileMap, "src/file1.md", "moved", "/project");

      expect(result.count).toBe(1);
      expect(result.fileMap.size).toBe(2);
      expect(result.fileMap.get("src/file1.md")).toBe("moved/file1.md");
      expect(result.fileMap.get("src/file2.md")).toBe("file2.md");
    });

    test("move to nested directory", () => {
      const fileMap = new Map([
        ["src/README.md", "README.md"],
      ]);

      const result = applyMoveFile(fileMap, "src/README.md", "docs/guides/intro", "/project");

      expect(result.count).toBe(1);
      expect(result.fileMap.get("src/README.md")).toBe("docs/guides/intro/README.md");
    });

    test("glob pattern matching: move all .md files", () => {
      const fileMap = new Map([
        ["src/file1.md", "file1.md"],
        ["src/file2.md", "file2.md"],
        ["src/file3.txt", "file3.txt"],
      ]);

      // Glob matches source keys
      const result = applyMoveFile(fileMap, "src/*.md", "docs", "/project");

      expect(result.count).toBe(2);
      expect(result.fileMap.size).toBe(3);
      expect(result.fileMap.get("src/file1.md")).toBe("docs/file1.md");
      expect(result.fileMap.get("src/file2.md")).toBe("docs/file2.md");
      expect(result.fileMap.get("src/file3.txt")).toBe("file3.txt");
    });

    test("move with glob patterns: preserves filename", () => {
      const fileMap = new Map([
        ["src/a/file1.md", "output/a/file1.md"],
        ["src/b/file2.md", "output/b/file2.md"],
        ["src/c/file3.md", "output/c/file3.md"],
      ]);

      const result = applyMoveFile(fileMap, "src/**/*.md", "consolidated", "/project");

      expect(result.count).toBe(3);
      expect(result.fileMap.get("src/a/file1.md")).toBe("consolidated/file1.md");
      expect(result.fileMap.get("src/b/file2.md")).toBe("consolidated/file2.md");
      expect(result.fileMap.get("src/c/file3.md")).toBe("consolidated/file3.md");
    });

    test("move to root directory (empty dest)", () => {
      const fileMap = new Map([
        ["src/docs/file.md", "docs/file.md"],
      ]);

      const result = applyMoveFile(fileMap, "src/docs/file.md", "", "/project");

      expect(result.count).toBe(1);
      expect(result.fileMap.get("src/docs/file.md")).toBe("file.md");
    });

    test("move with no matches: returns unchanged map with count 0", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);

      const result = applyMoveFile(fileMap, "nonexistent.txt", "dest", "/project");

      expect(result.count).toBe(0);
      expect(result.fileMap.size).toBe(1);
      expect(result.fileMap.get("src/file.md")).toBe("file.md");
    });

    test("throws on path traversal in destination", () => {
      const fileMap = new Map([["file.md", "file.md"]]);

      expect(() =>
        applyMoveFile(fileMap, "*.md", "../etc", "/project"),
      ).toThrow("Path traversal detected");
    });

    test("does not mutate original file map", () => {
      const fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);
      const originalSize = fileMap.size;
      const originalDest = fileMap.get("src/file.md");

      applyMoveFile(fileMap, "*.md", "moved", "/project");

      expect(fileMap.size).toBe(originalSize);
      expect(fileMap.get("src/file.md")).toBe(originalDest);
    });
  });

  describe("Combined operations", () => {
    test("copy changes destination path", () => {
      let fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);

      // Copy changes output dest
      let result = applyCopyFile(fileMap, "src/file.md", "copy.md", "/project");
      fileMap = result.fileMap;

      expect(fileMap.get("src/file.md")).toBe("copy.md");

      // Copy again to different location
      result = applyCopyFile(fileMap, "src/file.md", "another.md", "/project");
      fileMap = result.fileMap;

      expect(fileMap.get("src/file.md")).toBe("another.md");
    });

    test("copy then move", () => {
      let fileMap = new Map([
        ["src/original.md", "original.md"],
      ]);

      // Copy to new location
      let result = applyCopyFile(fileMap, "src/original.md", "backup.md", "/project");
      fileMap = result.fileMap;

      // Move to docs folder (glob matches source key)
      result = applyMoveFile(fileMap, "src/original.md", "docs", "/project");
      fileMap = result.fileMap;

      expect(fileMap.size).toBe(1);
      expect(fileMap.get("src/original.md")).toBe("docs/backup.md");
    });

    test("move then rename", () => {
      let fileMap = new Map([
        ["src/file.md", "file.md"],
      ]);

      // Move to docs (glob matches source key)
      let result = applyMoveFile(fileMap, "src/file.md", "docs", "/project");
      fileMap = result.fileMap;

      expect(fileMap.get("src/file.md")).toBe("docs/file.md");

      // Rename filename (glob matches source key, NOT dest)
      result = applyRenameFile(fileMap, "src/file.md", "README.md", "/project");
      fileMap = result.fileMap;

      expect(fileMap.get("src/file.md")).toBe("docs/README.md");
    });

    test("delete some files, move others", () => {
      let fileMap = new Map([
        ["src/delete-me.txt", "delete-me.txt"],
        ["src/keep.md", "keep.md"],
        ["src/also-delete.txt", "also-delete.txt"],
      ]);

      // Delete all .txt files (glob matches source keys)
      let result = applyDeleteFile(fileMap, "src/*.txt", "/project");
      fileMap = result.fileMap;

      expect(fileMap.size).toBe(1);

      // Move remaining file to docs
      result = applyMoveFile(fileMap, "src/keep.md", "docs", "/project");
      fileMap = result.fileMap;

      expect(fileMap.size).toBe(1);
      expect(fileMap.get("src/keep.md")).toBe("docs/keep.md");
    });

    test("complex sequence: move, rename, copy", () => {
      let fileMap = new Map([
        ["src/a.md", "a.md"],
        ["src/b.md", "b.md"],
      ]);

      // Move all .md to docs/ (glob matches source keys)
      let result = applyMoveFile(fileMap, "src/*.md", "docs", "/project");
      fileMap = result.fileMap;

      expect(fileMap.get("src/a.md")).toBe("docs/a.md");
      expect(fileMap.get("src/b.md")).toBe("docs/b.md");

      // Rename b.md to index.md (glob matches against source, NOT dest)
      result = applyRenameFile(fileMap, "src/b.md", "index.md", "/project");
      fileMap = result.fileMap;

      expect(fileMap.get("src/b.md")).toBe("docs/index.md");

      // Copy a.md to backup location
      result = applyCopyFile(fileMap, "src/a.md", "backup/a.md", "/project");
      fileMap = result.fileMap;

      expect(fileMap.size).toBe(2);
      expect(fileMap.get("src/a.md")).toBe("backup/a.md");
      expect(fileMap.get("src/b.md")).toBe("docs/index.md");
    });
  });
});
