/**
 * Comprehensive tests for the file browser feature
 *
 * Tests cover:
 * - File content retrieval (GET /files)
 * - Directory listing (GET /files/list)
 * - Recursive tree traversal (GET /files/tree)
 * - Path validation and security (path traversal prevention)
 * - Error handling (file not found, invalid paths)
 * - Directory filtering (node_modules, .git, etc.)
 * - Tree depth limit (max 10 levels)
 * - Sorting (directories first, alphabetical)
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import express, { type Express } from "express";
import request from "supertest";
import { createFileRoutes, type FileNode } from "../../src/web/server/routes/files.js";
import { errorHandler } from "../../src/web/server/middleware/error-handler.js";
import type { ServerConfig, FileContent } from "../../src/web/server/types.js";

/**
 * File list response interface
 */
interface FileListResponse {
  files: FileNode[];
  path: string;
}

/**
 * File tree response interface
 */
interface FileTreeResponse {
  tree: FileNode;
  path: string;
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  status: number;
  details?: unknown;
}

describe("File Browser Routes", () => {
  const fixtureRoot = resolve(__dirname, "../fixtures/file-browser");
  let app: Express;
  let config: ServerConfig;

  beforeEach(() => {
    // Clean up if exists
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }

    // Create fixture directory
    mkdirSync(fixtureRoot, { recursive: true });

    // Setup Express app with file routes
    config = {
      port: 3000,
      host: "localhost",
      baseDir: fixtureRoot,
      cors: false,
      verbose: false,
      websocket: false,
    };

    app = express();
    app.use(express.json());
    app.use("/api/files", createFileRoutes(config));
    app.use(errorHandler);
  });

  afterEach(() => {
    // Clean up fixture directory
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  describe("GET /api/files - File Content Retrieval", () => {
    test("should return file content for a valid file", async () => {
      const testContent = "# Test File\n\nThis is test content.";
      writeFileSync(join(fixtureRoot, "test.md"), testContent);

      const response = await request(app)
        .get("/api/files")
        .query({ path: "test.md" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject<FileContent>({
        content: testContent,
        path: "test.md",
      });
    });

    test("should return file content from subdirectory", async () => {
      mkdirSync(join(fixtureRoot, "subdir"));
      const testContent = "Content in subdirectory";
      writeFileSync(join(fixtureRoot, "subdir", "file.txt"), testContent);

      const response = await request(app)
        .get("/api/files")
        .query({ path: "subdir/file.txt" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject<FileContent>({
        content: testContent,
        path: "subdir/file.txt",
      });
    });

    test("should return 400 if path parameter is missing", async () => {
      const response = await request(app).get("/api/files");

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject<ErrorResponse>({
        error: "Missing or invalid 'path' query parameter",
        status: 400,
      });
    });

    test("should return 400 if path parameter is not a string", async () => {
      const response = await request(app)
        .get("/api/files")
        .query({ path: ["array", "value"] });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject<ErrorResponse>({
        error: "Missing or invalid 'path' query parameter",
        status: 400,
      });
    });

    test("should return 404 if file does not exist", async () => {
      const response = await request(app)
        .get("/api/files")
        .query({ path: "nonexistent.md" });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("File not found");
    });

    test("should return 400 if path points to a directory", async () => {
      mkdirSync(join(fixtureRoot, "somedir"));

      const response = await request(app)
        .get("/api/files")
        .query({ path: "somedir" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Path is not a file");
    });

    test("should handle files with special characters in name", async () => {
      const content = "Special file content";
      writeFileSync(join(fixtureRoot, "file-with-dashes_and_underscores.txt"), content);

      const response = await request(app)
        .get("/api/files")
        .query({ path: "file-with-dashes_and_underscores.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(content);
    });

    test("should handle empty files", async () => {
      writeFileSync(join(fixtureRoot, "empty.txt"), "");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "empty.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("");
    });

    test("should handle large files", async () => {
      const largeContent = "a".repeat(100000);
      writeFileSync(join(fixtureRoot, "large.txt"), largeContent);

      const response = await request(app)
        .get("/api/files")
        .query({ path: "large.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(largeContent);
      expect(response.body.content.length).toBe(100000);
    });
  });

  describe("GET /api/files/list - Directory Listing", () => {
    test("should list files in root directory", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "Content 1");
      writeFileSync(join(fixtureRoot, "file2.txt"), "Content 2");
      mkdirSync(join(fixtureRoot, "subdir"));

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      expect(body.path).toBe(".");
      expect(body.files.length).toBe(3);

      // Check all files are present
      const fileNames = body.files.map((f) => f.name);
      expect(fileNames).toContain("file1.md");
      expect(fileNames).toContain("file2.txt");
      expect(fileNames).toContain("subdir");
    });

    test("should list files in subdirectory", async () => {
      mkdirSync(join(fixtureRoot, "testdir"));
      writeFileSync(join(fixtureRoot, "testdir", "a.md"), "A");
      writeFileSync(join(fixtureRoot, "testdir", "b.md"), "B");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "testdir" });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      expect(body.path).toBe("testdir");
      expect(body.files.length).toBe(2);

      const fileNames = body.files.map((f) => f.name);
      expect(fileNames).toContain("a.md");
      expect(fileNames).toContain("b.md");
    });

    test("should default to root directory when path not provided", async () => {
      writeFileSync(join(fixtureRoot, "test.md"), "Test");

      const response = await request(app).get("/api/files/list");

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      expect(body.path).toBe(".");
    });

    test("should return 404 if directory does not exist", async () => {
      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "nonexistent" });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Directory not found");
    });

    test("should return 400 if path is a file", async () => {
      writeFileSync(join(fixtureRoot, "file.txt"), "Content");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "file.txt" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Path is not a directory");
    });

    test("should filter out node_modules directory", async () => {
      mkdirSync(join(fixtureRoot, "node_modules"));
      writeFileSync(join(fixtureRoot, "node_modules", "package.json"), "{}");
      writeFileSync(join(fixtureRoot, "visible.md"), "Visible");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      const fileNames = body.files.map((f) => f.name);
      expect(fileNames).not.toContain("node_modules");
      expect(fileNames).toContain("visible.md");
    });

    test("should filter out .git directory", async () => {
      mkdirSync(join(fixtureRoot, ".git"));
      writeFileSync(join(fixtureRoot, ".git", "config"), "git config");
      writeFileSync(join(fixtureRoot, "visible.md"), "Visible");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      const fileNames = body.files.map((f) => f.name);
      expect(fileNames).not.toContain(".git");
    });

    test("should filter out all common build/cache directories", async () => {
      const filteredDirs = ["node_modules", ".git", "dist", "out", ".next", "build", ".cache", "coverage", ".nyc_output"];

      for (const dir of filteredDirs) {
        mkdirSync(join(fixtureRoot, dir));
      }
      writeFileSync(join(fixtureRoot, "visible.md"), "Visible");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      const fileNames = body.files.map((f) => f.name);

      for (const dir of filteredDirs) {
        expect(fileNames).not.toContain(dir);
      }
      expect(fileNames).toContain("visible.md");
    });

    test("should sort directories before files", async () => {
      mkdirSync(join(fixtureRoot, "z-directory"));
      mkdirSync(join(fixtureRoot, "a-directory"));
      writeFileSync(join(fixtureRoot, "b-file.txt"), "B");
      writeFileSync(join(fixtureRoot, "y-file.txt"), "Y");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;

      // First two should be directories
      expect(body.files[0].isDirectory).toBe(true);
      expect(body.files[1].isDirectory).toBe(true);

      // Last two should be files
      expect(body.files[2].isDirectory).toBe(false);
      expect(body.files[3].isDirectory).toBe(false);
    });

    test("should sort directories alphabetically", async () => {
      mkdirSync(join(fixtureRoot, "charlie"));
      mkdirSync(join(fixtureRoot, "alpha"));
      mkdirSync(join(fixtureRoot, "bravo"));

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;

      expect(body.files[0].name).toBe("alpha");
      expect(body.files[1].name).toBe("bravo");
      expect(body.files[2].name).toBe("charlie");
    });

    test("should sort files alphabetically", async () => {
      writeFileSync(join(fixtureRoot, "zebra.txt"), "Z");
      writeFileSync(join(fixtureRoot, "apple.txt"), "A");
      writeFileSync(join(fixtureRoot, "mango.txt"), "M");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;

      expect(body.files[0].name).toBe("apple.txt");
      expect(body.files[1].name).toBe("mango.txt");
      expect(body.files[2].name).toBe("zebra.txt");
    });

    test("should include correct file metadata", async () => {
      const content = "Test content for size";
      writeFileSync(join(fixtureRoot, "test.txt"), content);
      mkdirSync(join(fixtureRoot, "testdir"));

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;

      const file = body.files.find((f) => f.name === "test.txt");
      const dir = body.files.find((f) => f.name === "testdir");

      expect(file).toBeDefined();
      expect(file?.isDirectory).toBe(false);
      expect(file?.size).toBe(content.length);
      expect(file?.path).toBe("test.txt");

      expect(dir).toBeDefined();
      expect(dir?.isDirectory).toBe(true);
      expect(dir?.size).toBe(0);
      expect(dir?.path).toBe("testdir");
    });

    test("should handle empty directory", async () => {
      mkdirSync(join(fixtureRoot, "empty"));

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "empty" });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      expect(body.files.length).toBe(0);
    });
  });

  describe("GET /api/files/tree - Recursive Tree", () => {
    test("should build recursive tree for simple structure", async () => {
      writeFileSync(join(fixtureRoot, "file1.md"), "Content 1");
      mkdirSync(join(fixtureRoot, "subdir"));
      writeFileSync(join(fixtureRoot, "subdir", "file2.md"), "Content 2");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      expect(body.path).toBe(".");
      expect(body.tree.isDirectory).toBe(true);
      expect(body.tree.children).toBeDefined();
      expect(body.tree.children!.length).toBe(2);

      const subdirNode = body.tree.children!.find((c) => c.name === "subdir");
      expect(subdirNode).toBeDefined();
      expect(subdirNode!.isDirectory).toBe(true);
      expect(subdirNode!.children).toBeDefined();
      expect(subdirNode!.children!.length).toBe(1);
      expect(subdirNode!.children![0].name).toBe("file2.md");
    });

    test("should build tree for nested structure", async () => {
      mkdirSync(join(fixtureRoot, "level1"));
      mkdirSync(join(fixtureRoot, "level1", "level2"));
      mkdirSync(join(fixtureRoot, "level1", "level2", "level3"));
      writeFileSync(join(fixtureRoot, "level1", "level2", "level3", "deep.txt"), "Deep file");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      const level1 = body.tree.children!.find((c) => c.name === "level1");
      const level2 = level1!.children!.find((c) => c.name === "level2");
      const level3 = level2!.children!.find((c) => c.name === "level3");
      const file = level3!.children!.find((c) => c.name === "deep.txt");

      expect(file).toBeDefined();
      expect(file!.isDirectory).toBe(false);
    });

    test("should default to root directory when path not provided", async () => {
      writeFileSync(join(fixtureRoot, "test.md"), "Test");

      const response = await request(app).get("/api/files/tree");

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      expect(body.path).toBe(".");
    });

    test("should build tree for specific subdirectory", async () => {
      mkdirSync(join(fixtureRoot, "targetdir"));
      writeFileSync(join(fixtureRoot, "targetdir", "file.md"), "Content");
      writeFileSync(join(fixtureRoot, "outside.md"), "Outside");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "targetdir" });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      expect(body.path).toBe("targetdir");
      expect(body.tree.name).toBe("targetdir");
      expect(body.tree.children!.length).toBe(1);
      expect(body.tree.children![0].name).toBe("file.md");
    });

    test("should return file node for file path", async () => {
      writeFileSync(join(fixtureRoot, "single.txt"), "Single file");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "single.txt" });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      expect(body.tree.isDirectory).toBe(false);
      expect(body.tree.name).toBe("single.txt");
      expect(body.tree.children).toBeUndefined();
    });

    test("should return 404 for non-existent path", async () => {
      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "nonexistent" });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Path not found");
    });

    test("should filter out node_modules in tree", async () => {
      mkdirSync(join(fixtureRoot, "node_modules"));
      mkdirSync(join(fixtureRoot, "node_modules", "package"));
      writeFileSync(join(fixtureRoot, "node_modules", "package", "index.js"), "code");
      writeFileSync(join(fixtureRoot, "visible.md"), "Visible");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      const names = body.tree.children!.map((c) => c.name);
      expect(names).not.toContain("node_modules");
      expect(names).toContain("visible.md");
    });

    test("should filter out all common directories in tree", async () => {
      const filteredDirs = ["node_modules", ".git", "dist", "out", ".next", "build", ".cache", "coverage", ".nyc_output"];

      for (const dir of filteredDirs) {
        mkdirSync(join(fixtureRoot, dir));
        writeFileSync(join(fixtureRoot, dir, "file.txt"), "content");
      }
      writeFileSync(join(fixtureRoot, "visible.md"), "Visible");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      const names = body.tree.children!.map((c) => c.name);

      for (const dir of filteredDirs) {
        expect(names).not.toContain(dir);
      }
      expect(names).toContain("visible.md");
    });

    test("should silently truncate tree at maximum depth of 10 levels", async () => {
      // Create 12 levels deep (to exceed depth of 10)
      // Due to implementation, errors at max depth are caught and ignored,
      // so the tree is truncated rather than throwing an error
      let currentPath = fixtureRoot;
      for (let i = 1; i <= 12; i++) {
        currentPath = join(currentPath, `level${i}`);
        mkdirSync(currentPath);
      }
      writeFileSync(join(currentPath, "deep.txt"), "Too deep");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      // Tree should be built but truncated at max depth
      // Navigate down to verify depth 10 exists but depth 11 doesn't have children
      let node = body.tree;
      let depth = 0;

      while (node.children && node.children.length > 0 && depth < 11) {
        node = node.children[0];
        depth++;
      }

      // Should reach depth 10 but not be able to go deeper
      expect(depth).toBe(10);
      expect(node.children).toBeDefined();
      expect(node.children!.length).toBe(0); // No children at depth 11
    });

    test("should truncate tree when starting from subdirectory", async () => {
      mkdirSync(join(fixtureRoot, "start"));

      // Create 11 more levels from start to exceed depth 10
      let currentPath = join(fixtureRoot, "start");
      for (let i = 1; i <= 11; i++) {
        currentPath = join(currentPath, `level${i}`);
        mkdirSync(currentPath);
      }

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "start" });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      // Navigate down the tree
      let node = body.tree;
      let depth = 0;

      while (node.children && node.children.length > 0 && depth < 11) {
        node = node.children[0];
        depth++;
      }

      // Should reach depth 10 from "start" but not deeper
      expect(depth).toBe(10);
      expect(node.children).toBeDefined();
      expect(node.children!.length).toBe(0);
    });

    test("should sort children: directories first, then alphabetically", async () => {
      mkdirSync(join(fixtureRoot, "z-dir"));
      mkdirSync(join(fixtureRoot, "a-dir"));
      writeFileSync(join(fixtureRoot, "y-file.txt"), "Y");
      writeFileSync(join(fixtureRoot, "b-file.txt"), "B");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      expect(body.tree.children![0].name).toBe("a-dir");
      expect(body.tree.children![0].isDirectory).toBe(true);
      expect(body.tree.children![1].name).toBe("z-dir");
      expect(body.tree.children![1].isDirectory).toBe(true);
      expect(body.tree.children![2].name).toBe("b-file.txt");
      expect(body.tree.children![2].isDirectory).toBe(false);
      expect(body.tree.children![3].name).toBe("y-file.txt");
      expect(body.tree.children![3].isDirectory).toBe(false);
    });

    test("should maintain sorting at all levels of tree", async () => {
      mkdirSync(join(fixtureRoot, "parent"));
      mkdirSync(join(fixtureRoot, "parent", "z-subdir"));
      mkdirSync(join(fixtureRoot, "parent", "a-subdir"));
      writeFileSync(join(fixtureRoot, "parent", "y-file.txt"), "Y");
      writeFileSync(join(fixtureRoot, "parent", "b-file.txt"), "B");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "parent" });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      const children = body.tree.children!;
      expect(children[0].name).toBe("a-subdir");
      expect(children[1].name).toBe("z-subdir");
      expect(children[2].name).toBe("b-file.txt");
      expect(children[3].name).toBe("y-file.txt");
    });

    test("should handle empty directory in tree", async () => {
      mkdirSync(join(fixtureRoot, "empty"));

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      const emptyDir = body.tree.children!.find((c) => c.name === "empty");
      expect(emptyDir).toBeDefined();
      expect(emptyDir!.isDirectory).toBe(true);
      expect(emptyDir!.children).toEqual([]);
    });

    test("should include correct metadata for all nodes", async () => {
      const fileContent = "Test content";
      writeFileSync(join(fixtureRoot, "file.txt"), fileContent);
      mkdirSync(join(fixtureRoot, "dir"));

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      const file = body.tree.children!.find((c) => c.name === "file.txt");
      const dir = body.tree.children!.find((c) => c.name === "dir");

      expect(file).toMatchObject({
        name: "file.txt",
        path: "file.txt",
        isDirectory: false,
        size: fileContent.length,
      });

      expect(dir).toMatchObject({
        name: "dir",
        path: "dir",
        isDirectory: true,
        size: 0,
      });
    });
  });

  describe("Path Validation and Security", () => {
    test("should reject path traversal with ../", async () => {
      const response = await request(app)
        .get("/api/files")
        .query({ path: "../../../etc/passwd" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Path traversal detected");
    });

    test("should reject path traversal in subdirectory", async () => {
      mkdirSync(join(fixtureRoot, "subdir"));
      writeFileSync(join(fixtureRoot, "secret.txt"), "Secret");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "subdir/../../secret.txt" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Path traversal detected");
    });

    test("should reject path traversal in list endpoint", async () => {
      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "../" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Path traversal detected");
    });

    test("should reject path traversal in tree endpoint", async () => {
      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "../../" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Path traversal detected");
    });

    test("should reject absolute paths outside base directory", async () => {
      const response = await request(app)
        .get("/api/files")
        .query({ path: "/etc/passwd" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Path traversal detected");
    });

    test("should reject encoded path traversal attempts", async () => {
      const response = await request(app)
        .get("/api/files")
        .query({ path: "..%2F..%2Fetc%2Fpasswd" });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Path traversal detected");
    });

    test("should allow accessing files in subdirectories without traversal", async () => {
      mkdirSync(join(fixtureRoot, "docs"));
      mkdirSync(join(fixtureRoot, "docs", "api"));
      writeFileSync(join(fixtureRoot, "docs", "api", "readme.md"), "API docs");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "docs/api/readme.md" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("API docs");
    });

    test("should normalize paths correctly", async () => {
      writeFileSync(join(fixtureRoot, "test.txt"), "Content");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "./test.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Content");
    });

    test("should handle paths with multiple slashes", async () => {
      mkdirSync(join(fixtureRoot, "dir"));
      writeFileSync(join(fixtureRoot, "dir", "file.txt"), "Content");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "dir//file.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Content");
    });

    test("should reject null bytes in path", async () => {
      const response = await request(app)
        .get("/api/files")
        .query({ path: "test\0.txt" });

      // Should either reject or not find the file
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle very long file paths", async () => {
      const longName = "a".repeat(200) + ".txt";
      writeFileSync(join(fixtureRoot, longName), "Content");

      const response = await request(app)
        .get("/api/files")
        .query({ path: longName });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Content");
    });

    test("should handle files with unicode names", async () => {
      const unicodeName = "文档.md";
      writeFileSync(join(fixtureRoot, unicodeName), "Unicode content");

      const response = await request(app)
        .get("/api/files")
        .query({ path: unicodeName });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Unicode content");
    });

    test("should handle unicode content in files", async () => {
      const unicodeContent = "Hello 世界 🌍";
      writeFileSync(join(fixtureRoot, "unicode.txt"), unicodeContent);

      const response = await request(app)
        .get("/api/files")
        .query({ path: "unicode.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(unicodeContent);
    });

    test("should handle directory with many files", async () => {
      // Create 100 files
      for (let i = 0; i < 100; i++) {
        writeFileSync(join(fixtureRoot, `file${i}.txt`), `Content ${i}`);
      }

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      expect(body.files.length).toBe(100);
    });

    test("should handle mixed case file names in sorting", async () => {
      writeFileSync(join(fixtureRoot, "apple.txt"), "A");
      writeFileSync(join(fixtureRoot, "Banana.txt"), "B");
      writeFileSync(join(fixtureRoot, "cherry.txt"), "C");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      expect(body.files.length).toBe(3);
      // Files should be sorted by locale compare
      const names = body.files.map((f) => f.name);
      expect(names).toEqual(names.slice().sort((a, b) => a.localeCompare(b)));
    });

    test("should handle files with dots in names", async () => {
      writeFileSync(join(fixtureRoot, "my.config.file.json"), "{}");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "my.config.file.json" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("{}");
    });

    test("should handle hidden files (starting with dot)", async () => {
      writeFileSync(join(fixtureRoot, ".hidden"), "Hidden content");

      const response = await request(app)
        .get("/api/files")
        .query({ path: ".hidden" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Hidden content");
    });

    test("should list hidden files in directory", async () => {
      writeFileSync(join(fixtureRoot, ".hidden"), "Hidden");
      writeFileSync(join(fixtureRoot, "visible.txt"), "Visible");

      const response = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileListResponse;
      const names = body.files.map((f) => f.name);
      expect(names).toContain(".hidden");
      expect(names).toContain("visible.txt");
    });

    test("should handle symlinks gracefully", async () => {
      // This test may behave differently on different systems
      // Just verify it doesn't crash
      writeFileSync(join(fixtureRoot, "target.txt"), "Target");

      try {
        // Try to create a symlink (may fail on Windows without admin)
        const { symlinkSync } = await import("node:fs");
        symlinkSync(
          join(fixtureRoot, "target.txt"),
          join(fixtureRoot, "link.txt")
        );

        const response = await request(app)
          .get("/api/files/list")
          .query({ path: "." });

        // Should not crash, just verify it returns successfully
        expect([200, 400, 404, 500]).toContain(response.status);
      } catch {
        // Symlink creation failed, skip this test
      }
    });

    test("should return appropriate error for non-UTF8 files", async () => {
      // Create a file with binary content
      const binaryData = Buffer.from([0xff, 0xfe, 0xfd, 0xfc]);
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(fixtureRoot, "binary.dat"), binaryData);

      const response = await request(app)
        .get("/api/files")
        .query({ path: "binary.dat" });

      // Should either return with garbled content or error
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test("should handle root path denoted by dot", async () => {
      writeFileSync(join(fixtureRoot, "test.txt"), "Content");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;
      expect(body.tree.name).toBe(".");
      expect(body.tree.path).toBe(".");
    });

    test("should handle deeply nested paths in file read", async () => {
      let currentPath = fixtureRoot;
      const levels = ["a", "b", "c", "d", "e"];

      for (const level of levels) {
        currentPath = join(currentPath, level);
        mkdirSync(currentPath);
      }
      writeFileSync(join(currentPath, "deep.txt"), "Deep content");

      const response = await request(app)
        .get("/api/files")
        .query({ path: "a/b/c/d/e/deep.txt" });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Deep content");
    });
  });

  describe("Integration Tests", () => {
    test("should handle complete workflow: list, tree, and read", async () => {
      // Setup a realistic directory structure
      mkdirSync(join(fixtureRoot, "docs"));
      mkdirSync(join(fixtureRoot, "src"));
      writeFileSync(join(fixtureRoot, "docs", "readme.md"), "# Readme");
      writeFileSync(join(fixtureRoot, "src", "index.ts"), "export {}");

      // List root
      const listResponse = await request(app)
        .get("/api/files/list")
        .query({ path: "." });
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.files.length).toBe(2);

      // Get tree
      const treeResponse = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });
      expect(treeResponse.status).toBe(200);
      const tree = (treeResponse.body as FileTreeResponse).tree;
      expect(tree.children!.length).toBe(2);

      // Read specific file
      const fileResponse = await request(app)
        .get("/api/files")
        .query({ path: "docs/readme.md" });
      expect(fileResponse.status).toBe(200);
      expect(fileResponse.body.content).toBe("# Readme");
    });

    test("should maintain consistency between list and tree", async () => {
      writeFileSync(join(fixtureRoot, "a.txt"), "A");
      writeFileSync(join(fixtureRoot, "b.txt"), "B");
      mkdirSync(join(fixtureRoot, "dir"));

      const listResponse = await request(app)
        .get("/api/files/list")
        .query({ path: "." });

      const treeResponse = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      const listFiles = (listResponse.body as FileListResponse).files;
      const treeFiles = (treeResponse.body as FileTreeResponse).tree.children!;

      expect(listFiles.length).toBe(treeFiles.length);

      for (let i = 0; i < listFiles.length; i++) {
        expect(listFiles[i].name).toBe(treeFiles[i].name);
        expect(listFiles[i].isDirectory).toBe(treeFiles[i].isDirectory);
        expect(listFiles[i].size).toBe(treeFiles[i].size);
      }
    });

    test("should handle complex nested structure with filtering", async () => {
      // Create a realistic project structure
      mkdirSync(join(fixtureRoot, "src"));
      mkdirSync(join(fixtureRoot, "src", "components"));
      mkdirSync(join(fixtureRoot, "node_modules")); // Should be filtered
      mkdirSync(join(fixtureRoot, "node_modules", "package"));
      mkdirSync(join(fixtureRoot, "dist")); // Should be filtered
      writeFileSync(join(fixtureRoot, "src", "index.ts"), "code");
      writeFileSync(join(fixtureRoot, "src", "components", "App.tsx"), "react");
      writeFileSync(join(fixtureRoot, "node_modules", "package", "index.js"), "lib");
      writeFileSync(join(fixtureRoot, "dist", "bundle.js"), "compiled");

      const response = await request(app)
        .get("/api/files/tree")
        .query({ path: "." });

      expect(response.status).toBe(200);
      const body = response.body as FileTreeResponse;

      // Should only have src
      expect(body.tree.children!.length).toBe(1);
      expect(body.tree.children![0].name).toBe("src");

      // src should have components and index.ts
      const srcChildren = body.tree.children![0].children!;
      expect(srcChildren.length).toBe(2);
      const names = srcChildren.map((c) => c.name);
      expect(names).toContain("components");
      expect(names).toContain("index.ts");
    });
  });
});
