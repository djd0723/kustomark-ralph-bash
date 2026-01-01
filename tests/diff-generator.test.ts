import { describe, expect, test } from "bun:test";
import {
  generateDiff,
  generateFileDiff,
  type DiffResult,
  type FileDiff,
} from "../src/core/diff-generator";

describe("generateDiff", () => {
  test("generates empty diff for identical content", () => {
    const original = "line 1\nline 2\nline 3";
    const modified = "line 1\nline 2\nline 3";
    const result = generateDiff(original, modified, "test.md");
    expect(result).toBe("");
  });

  test("generates diff for added lines", () => {
    const original = "line 1\nline 2";
    const modified = "line 1\nline 2\nline 3";
    const result = generateDiff(original, modified, "test.md");

    expect(result).toContain("--- a/test.md");
    expect(result).toContain("+++ b/test.md");
    expect(result).toContain("+line 3");
  });

  test("generates diff for removed lines", () => {
    const original = "line 1\nline 2\nline 3";
    const modified = "line 1\nline 3";
    const result = generateDiff(original, modified, "test.md");

    expect(result).toContain("--- a/test.md");
    expect(result).toContain("+++ b/test.md");
    expect(result).toContain("-line 2");
  });

  test("generates diff for modified lines", () => {
    const original = "line 1\nline 2\nline 3";
    const modified = "line 1\nline 2 modified\nline 3";
    const result = generateDiff(original, modified, "test.md");

    expect(result).toContain("--- a/test.md");
    expect(result).toContain("+++ b/test.md");
    expect(result).toContain("-line 2");
    expect(result).toContain("+line 2 modified");
  });

  test("includes context lines around changes", () => {
    const original = "line 1\nline 2\nline 3\nline 4\nline 5";
    const modified = "line 1\nline 2\nline 3 modified\nline 4\nline 5";
    const result = generateDiff(original, modified, "test.md");

    // Should include context lines
    expect(result).toContain(" line 1");
    expect(result).toContain(" line 2");
    expect(result).toContain("-line 3");
    expect(result).toContain("+line 3 modified");
    expect(result).toContain(" line 4");
    expect(result).toContain(" line 5");
  });

  test("handles empty strings", () => {
    const result = generateDiff("", "", "test.md");
    expect(result).toBe("");
  });

  test("handles completely different content", () => {
    const original = "foo\nbar";
    const modified = "baz\nqux";
    const result = generateDiff(original, modified, "test.md");

    expect(result).toContain("-foo");
    expect(result).toContain("-bar");
    expect(result).toContain("+baz");
    expect(result).toContain("+qux");
  });
});

describe("generateFileDiff", () => {
  test("detects new file", () => {
    const files = [
      {
        path: "new.md",
        modified: "new content",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.status).toBe("added");
    expect(result.files[0]?.path).toBe("new.md");
    expect(result.files[0]?.diff).toContain("--- /dev/null");
    expect(result.files[0]?.diff).toContain("+++ b/new.md");
    expect(result.files[0]?.diff).toContain("+new content");
  });

  test("detects deleted file", () => {
    const files = [
      {
        path: "deleted.md",
        original: "old content",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.status).toBe("deleted");
    expect(result.files[0]?.path).toBe("deleted.md");
    expect(result.files[0]?.diff).toContain("--- a/deleted.md");
    expect(result.files[0]?.diff).toContain("+++ /dev/null");
    expect(result.files[0]?.diff).toContain("-old content");
  });

  test("detects modified file", () => {
    const files = [
      {
        path: "modified.md",
        original: "old content",
        modified: "new content",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.status).toBe("modified");
    expect(result.files[0]?.path).toBe("modified.md");
    expect(result.files[0]?.diff).toContain("--- a/modified.md");
    expect(result.files[0]?.diff).toContain("+++ b/modified.md");
    expect(result.files[0]?.diff).toContain("-old content");
    expect(result.files[0]?.diff).toContain("+new content");
  });

  test("skips files with no changes", () => {
    const files = [
      {
        path: "unchanged.md",
        original: "same content",
        modified: "same content",
      },
      {
        path: "changed.md",
        original: "old",
        modified: "new",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe("changed.md");
  });

  test("handles multiple files with different statuses", () => {
    const files = [
      {
        path: "added.md",
        modified: "new",
      },
      {
        path: "deleted.md",
        original: "old",
      },
      {
        path: "modified.md",
        original: "before",
        modified: "after",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(true);
    expect(result.files).toHaveLength(3);

    const addedFile = result.files.find((f) => f.path === "added.md");
    expect(addedFile?.status).toBe("added");

    const deletedFile = result.files.find((f) => f.path === "deleted.md");
    expect(deletedFile?.status).toBe("deleted");

    const modifiedFile = result.files.find((f) => f.path === "modified.md");
    expect(modifiedFile?.status).toBe("modified");
  });

  test("returns no changes when no files differ", () => {
    const files = [
      {
        path: "same.md",
        original: "content",
        modified: "content",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(false);
    expect(result.files).toHaveLength(0);
  });

  test("handles empty file array", () => {
    const result: DiffResult = generateFileDiff([]);

    expect(result.hasChanges).toBe(false);
    expect(result.files).toHaveLength(0);
  });

  test("skips files with both original and modified undefined", () => {
    const files = [
      {
        path: "invalid.md",
      },
    ];

    const result: DiffResult = generateFileDiff(files);

    expect(result.hasChanges).toBe(false);
    expect(result.files).toHaveLength(0);
  });
});

describe("unified diff format", () => {
  test("produces git-like diff output", () => {
    const original = "# Title\n\nOld content\n\nMore text";
    const modified = "# Title\n\nNew content\n\nMore text";
    const result = generateDiff(original, modified, "doc.md");

    // Check header format
    expect(result).toMatch(/^--- a\/doc\.md$/m);
    expect(result).toMatch(/^\+\+\+ b\/doc\.md$/m);

    // Check hunk header format (@@)
    expect(result).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/m);

    // Check line prefixes
    expect(result).toMatch(/^ # Title$/m); // context line
    expect(result).toMatch(/^-Old content$/m); // removed line
    expect(result).toMatch(/^\+New content$/m); // added line
  });

  test("handles multiline changes correctly", () => {
    const original = "line 1\nline 2\nline 3\nline 4";
    const modified = "line 1\ninserted\nline 2\nline 3\nline 4";
    const result = generateDiff(original, modified, "file.md");

    expect(result).toContain("--- a/file.md");
    expect(result).toContain("+++ b/file.md");
    expect(result).toContain("+inserted");
    expect(result).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });
});
