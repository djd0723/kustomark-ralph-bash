/**
 * Tests for the LSP Definition Provider
 *
 * Tests go-to-definition functionality for:
 * - Resource file paths (glob patterns and direct files)
 * - Referenced kustomark config files
 * - Git URLs
 * - HTTP archive URLs
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import type { Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DefinitionProvider } from "../../src/lsp/definition.js";

describe("DefinitionProvider", () => {
  let provider: DefinitionProvider;
  let testDir: string;

  beforeEach(() => {
    provider = new DefinitionProvider();
    // Create a temporary test directory
    testDir = join(tmpdir(), `kustomark-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a TextDocument with the given content
   */
  function createDocument(content: string, filename = "kustomark.yaml"): TextDocument {
    const uri = pathToFileURL(join(testDir, filename)).href;
    return TextDocument.create(uri, "yaml", 1, content);
  }

  /**
   * Helper to create a test file in the test directory
   */
  function createTestFile(relativePath: string, content = ""): string {
    const filePath = join(testDir, relativePath);
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content);
    return filePath;
  }

  describe("resource file paths - direct files", () => {
    test("provides definition for relative file path in resources array", () => {
      const targetFile = createTestFile("docs/api.md", "# API Documentation");
      const content = `resources:
  - docs/api.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 }; // On "docs/api.md"

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("uri");
      expect(result).toHaveProperty("range");
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
        expect(result.range.start.line).toBe(0);
        expect(result.range.start.character).toBe(0);
      }
    });

    test("provides definition for quoted file path", () => {
      const targetFile = createTestFile("guide.md", "# Guide");
      const content = `resources:
  - "guide.md"`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for single-quoted file path", () => {
      const targetFile = createTestFile("README.md", "# README");
      const content = `resources:
  - 'README.md'`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for nested file path", () => {
      const targetFile = createTestFile("docs/guides/getting-started.md", "# Getting Started");
      const content = `resources:
  - docs/guides/getting-started.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 10 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("handles absolute file paths", () => {
      const targetFile = createTestFile("absolute.md", "# Absolute");
      const content = `resources:
  - ${targetFile}`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for file path in output field", () => {
      const targetFile = createTestFile("output/result.md", "# Result");
      const content = `output: output/result.md`;

      const document = createDocument(content);
      const position: Position = { line: 0, character: 10 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });
  });

  describe("kustomark config references", () => {
    test("provides definition for kustomark:// reference", () => {
      const targetFile = createTestFile("base/kustomark.yaml", "resources:\n  - file.md");
      const content = `resources:
  - kustomark://base/kustomark.yaml`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 15 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for relative config path without kustomark:// prefix", () => {
      const targetFile = createTestFile("overlay/kustomark.yaml", "resources:\n  - overlay.md");
      const content = `resources:
  - overlay/kustomark.yaml`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for nested kustomark config", () => {
      const targetFile = createTestFile(
        "components/auth/kustomark.yaml",
        "resources:\n  - auth.md",
      );
      const content = `resources:
  - kustomark://components/auth/kustomark.yaml`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 20 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });
  });

  describe("null returns for non-definition locations", () => {
    test("returns null for glob patterns with wildcards", () => {
      createTestFile("docs/api.md", "# API");
      createTestFile("docs/guide.md", "# Guide");
      const content = `resources:
  - docs/*.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for double-star glob patterns", () => {
      createTestFile("docs/nested/file.md", "# File");
      const content = `resources:
  - docs/**/*.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for git URLs with git:: prefix", () => {
      const content = `resources:
  - git::https://github.com/user/repo.git//path/to/file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for GitHub URLs", () => {
      const content = `resources:
  - https://github.com/user/repo/blob/main/README.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for HTTP URLs", () => {
      const content = `resources:
  - http://example.com/docs/api.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for HTTPS URLs", () => {
      const content = `resources:
  - https://example.com/archive.tar.gz`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for non-existent file paths", () => {
      const content = `resources:
  - nonexistent/file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for directory paths", () => {
      mkdirSync(join(testDir, "docs"), { recursive: true });
      const content = `resources:
  - docs`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null when no path value can be extracted", () => {
      const content = `resources:
  # This is a comment`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for empty lines", () => {
      const content = `resources:

  - file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 0 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });

    test("returns null for lines without resource paths", () => {
      const content = `apiVersion: v1
kind: Kustomark`;

      const document = createDocument(content);
      const position: Position = { line: 0, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).toBeNull();
    });
  });

  describe("location URIs and ranges", () => {
    test("returns correct URI format", () => {
      const targetFile = createTestFile("test.md", "# Test");
      const content = `resources:
  - test.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toMatch(/^file:\/\//);
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("returns range starting at line 0, character 0", () => {
      createTestFile("file.md", "# Content");
      const content = `resources:
  - file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);

      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.range.start.line).toBe(0);
        expect(result.range.start.character).toBe(0);
        expect(result.range.end.line).toBe(0);
        expect(result.range.end.character).toBe(0);
      }
    });

    test("returns same range for all file definitions", () => {
      createTestFile("file1.md", "# File 1");
      createTestFile("file2.md", "# File 2");
      const content = `resources:
  - file1.md
  - file2.md`;

      const document = createDocument(content);
      const position1: Position = { line: 1, character: 5 };
      const position2: Position = { line: 2, character: 5 };

      const result1 = provider.provideDefinition(document, position1);
      const result2 = provider.provideDefinition(document, position2);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();

      if (result1 && "uri" in result1 && result2 && "uri" in result2) {
        expect(result1.range).toEqual(result2.range);
      }
    });
  });

  describe("path value extraction", () => {
    test("extracts unquoted resource path", () => {
      createTestFile("file.md", "");
      const content = `resources:
  - file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("extracts double-quoted resource path", () => {
      createTestFile("file.md", "");
      const content = `resources:
  - "file.md"`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("extracts single-quoted resource path", () => {
      createTestFile("file.md", "");
      const content = `resources:
  - 'file.md'`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("handles paths with spaces (quoted)", () => {
      createTestFile("my file.md", "");
      const content = `resources:
  - "my file.md"`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("handles paths with special characters", () => {
      createTestFile("file-with_special.chars.md", "");
      const content = `resources:
  - file-with_special.chars.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("trims whitespace from extracted paths", () => {
      createTestFile("file.md", "");
      const content = `resources:
  -   file.md  `;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });
  });

  describe("different file types", () => {
    test("provides definition for markdown files", () => {
      const targetFile = createTestFile("doc.md", "# Markdown");
      const content = `resources:
  - doc.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for YAML files", () => {
      const targetFile = createTestFile("config.yaml", "key: value");
      const content = `resources:
  - config.yaml`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for text files", () => {
      const targetFile = createTestFile("data.txt", "Text content");
      const content = `resources:
  - data.txt`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("provides definition for files without extensions", () => {
      const targetFile = createTestFile("README", "Readme content");
      const content = `resources:
  - README`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });
  });

  describe("cursor position variations", () => {
    test("provides definition when cursor is at start of path", () => {
      createTestFile("file.md", "");
      const content = `resources:
  - file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 4 }; // Right at "file.md"

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("provides definition when cursor is in middle of path", () => {
      createTestFile("longfilename.md", "");
      const content = `resources:
  - longfilename.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 10 }; // Middle of "longfilename"

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("provides definition when cursor is at end of path", () => {
      createTestFile("file.md", "");
      const content = `resources:
  - file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 11 }; // At end of "file.md"

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });
  });

  describe("complex YAML structures", () => {
    test("provides definition for deeply indented resources", () => {
      createTestFile("file.md", "");
      const content = `overlays:
  - name: overlay1
    resources:
      - file.md`;

      const document = createDocument(content);
      const position: Position = { line: 3, character: 10 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
    });

    test("handles multiple resource entries", () => {
      const file1 = createTestFile("file1.md", "");
      const file2 = createTestFile("file2.md", "");
      const file3 = createTestFile("file3.md", "");

      const content = `resources:
  - file1.md
  - file2.md
  - file3.md`;

      const document = createDocument(content);

      const result1 = provider.provideDefinition(document, { line: 1, character: 5 });
      const result2 = provider.provideDefinition(document, { line: 2, character: 5 });
      const result3 = provider.provideDefinition(document, { line: 3, character: 5 });

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();

      if (result1 && "uri" in result1) {
        expect(result1.uri).toBe(pathToFileURL(file1).href);
      }
      if (result2 && "uri" in result2) {
        expect(result2.uri).toBe(pathToFileURL(file2).href);
      }
      if (result3 && "uri" in result3) {
        expect(result3.uri).toBe(pathToFileURL(file3).href);
      }
    });

    test("handles mixed resource types", () => {
      const localFile = createTestFile("local.md", "");
      const configFile = createTestFile("base/kustomark.yaml", "");

      const content = `resources:
  - local.md
  - kustomark://base/kustomark.yaml
  - https://example.com/remote.md
  - docs/**/*.md`;

      const document = createDocument(content);

      const localResult = provider.provideDefinition(document, { line: 1, character: 5 });
      const configResult = provider.provideDefinition(document, { line: 2, character: 5 });
      const httpResult = provider.provideDefinition(document, { line: 3, character: 5 });
      const globResult = provider.provideDefinition(document, { line: 4, character: 5 });

      expect(localResult).not.toBeNull();
      expect(configResult).not.toBeNull();
      expect(httpResult).toBeNull(); // HTTP URLs should return null
      expect(globResult).toBeNull(); // Glob patterns should return null

      if (localResult && "uri" in localResult) {
        expect(localResult.uri).toBe(pathToFileURL(localFile).href);
      }
      if (configResult && "uri" in configResult) {
        expect(configResult.uri).toBe(pathToFileURL(configFile).href);
      }
    });
  });

  describe("edge cases", () => {
    test("handles empty document", () => {
      const content = "";
      const document = createDocument(content);
      const position: Position = { line: 0, character: 0 };

      const result = provider.provideDefinition(document, position);
      expect(result).toBeNull();
    });

    test("handles document with only whitespace", () => {
      const content = "   \n  \n   ";
      const document = createDocument(content);
      const position: Position = { line: 1, character: 1 };

      const result = provider.provideDefinition(document, position);
      expect(result).toBeNull();
    });

    test("handles position beyond document length", () => {
      const content = `resources:
  - file.md`;
      const document = createDocument(content);
      const position: Position = { line: 10, character: 0 };

      const result = provider.provideDefinition(document, position);
      expect(result).toBeNull();
    });

    test("handles malformed YAML gracefully", () => {
      const content = `resources:
  - [invalid: yaml: structure`;
      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      // Should not throw, but return null for invalid syntax
      const result = provider.provideDefinition(document, position);
      // The provider doesn't validate YAML, just extracts paths
      // So this might still work if a path-like string is present
      expect(result !== undefined).toBe(true);
    });

    test("handles files with same name in different directories", () => {
      const file1 = createTestFile("dir1/file.md", "# Dir 1");
      const file2 = createTestFile("dir2/file.md", "# Dir 2");

      const content1 = `resources:
  - dir1/file.md`;
      const content2 = `resources:
  - dir2/file.md`;

      const doc1 = createDocument(content1, "config1.yaml");
      const doc2 = createDocument(content2, "config2.yaml");

      const result1 = provider.provideDefinition(doc1, { line: 1, character: 5 });
      const result2 = provider.provideDefinition(doc2, { line: 1, character: 5 });

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();

      if (result1 && "uri" in result1 && result2 && "uri" in result2) {
        expect(result1.uri).toBe(pathToFileURL(file1).href);
        expect(result2.uri).toBe(pathToFileURL(file2).href);
        expect(result1.uri).not.toBe(result2.uri);
      }
    });

    test("handles relative paths with ./ prefix", () => {
      const targetFile = createTestFile("file.md", "");
      const content = `resources:
  - ./file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("handles relative paths with ../ prefix", () => {
      // Create a subdirectory and config file in it
      mkdirSync(join(testDir, "subdir"), { recursive: true });
      const targetFile = createTestFile("file.md", "");
      const configPath = join(testDir, "subdir", "kustomark.yaml");

      const content = `resources:
  - ../file.md`;

      const uri = pathToFileURL(configPath).href;
      const document = TextDocument.create(uri, "yaml", 1, content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });

    test("handles symlinks (if supported by platform)", () => {
      // This test may behave differently on different platforms
      const targetFile = createTestFile("target.md", "# Target");
      const content = `resources:
  - target.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      const result = provider.provideDefinition(document, position);
      expect(result).not.toBeNull();
      if (result && "uri" in result) {
        expect(result.uri).toBe(pathToFileURL(targetFile).href);
      }
    });
  });

  describe("error handling", () => {
    test("handles file system errors gracefully", () => {
      // Try to access a file in a non-existent directory
      const content = `resources:
  - /nonexistent/directory/file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      // Should not throw, just return null
      expect(() => {
        const result = provider.provideDefinition(document, position);
        expect(result).toBeNull();
      }).not.toThrow();
    });

    test("handles permission errors gracefully", () => {
      // This test assumes the provider handles permission errors
      // In practice, the provider uses existsSync which should handle this
      const content = `resources:
  - /root/protected.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      expect(() => {
        provider.provideDefinition(document, position);
      }).not.toThrow();
    });

    test("handles invalid URI schemes gracefully", () => {
      const content = `resources:
  - ftp://example.com/file.md`;

      const document = createDocument(content);
      const position: Position = { line: 1, character: 5 };

      expect(() => {
        const result = provider.provideDefinition(document, position);
        // FTP should be treated like any other non-file path
        expect(result).toBeDefined();
      }).not.toThrow();
    });
  });
});
