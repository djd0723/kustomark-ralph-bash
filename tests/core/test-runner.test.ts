/**
 * Tests for the test runner functionality
 */

import { describe, expect, test } from "bun:test";
import { runPatchTest, runTestSuite } from "../../src/core/test-runner";
import type { PatchTest, PatchTestSuite } from "../../src/core/types";

describe("runPatchTest", () => {
  describe("basic functionality", () => {
    test("runs passing test with replace patch", () => {
      const patchTest: PatchTest = {
        name: "simple replace",
        input: "Hello world",
        patches: [
          {
            op: "replace",
            old: "world",
            new: "universe",
          },
        ],
        expected: "Hello universe",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
      expect(result.name).toBe("simple replace");
      expect(result.actual).toBe("Hello universe");
      expect(result.expected).toBe("Hello universe");
      expect(result.appliedPatches).toBe(1);
      expect(result.diff).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    test("runs failing test with incorrect expected output", () => {
      const patchTest: PatchTest = {
        name: "failing test",
        input: "Hello world",
        patches: [
          {
            op: "replace",
            old: "world",
            new: "universe",
          },
        ],
        expected: "Hello galaxy", // Wrong expected value
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(false);
      expect(result.name).toBe("failing test");
      expect(result.actual).toBe("Hello universe");
      expect(result.expected).toBe("Hello galaxy");
      expect(result.diff).toBeDefined();
      expect(result.appliedPatches).toBe(1);
    });

    test("runs test with multiple patches", () => {
      const patchTest: PatchTest = {
        name: "multiple patches",
        input: "# Title\n\nHello world\n\nGoodbye world",
        patches: [
          {
            op: "replace",
            old: "world",
            new: "universe",
          },
          {
            op: "replace",
            old: "Goodbye",
            new: "Farewell",
          },
        ],
        expected: "# Title\n\nHello universe\n\nFarewell universe",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
      expect(result.appliedPatches).toBe(2);
    });
  });

  describe("patch operations", () => {
    test("runs test with replace-regex patch", () => {
      const patchTest: PatchTest = {
        name: "regex replace",
        input: "Version 1.0.0 released",
        patches: [
          {
            op: "replace-regex",
            pattern: "\\d+\\.\\d+\\.\\d+",
            replacement: "2.0.0",
          },
        ],
        expected: "Version 2.0.0 released",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
      expect(result.appliedPatches).toBe(1);
    });

    test("runs test with set-frontmatter patch", () => {
      const patchTest: PatchTest = {
        name: "set frontmatter",
        input: "---\ntitle: Old Title\n---\n\nContent",
        patches: [
          {
            op: "set-frontmatter",
            key: "title",
            value: "New Title",
          },
        ],
        expected: "---\ntitle: New Title\n---\n\nContent",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with remove-section patch", () => {
      const patchTest: PatchTest = {
        name: "remove section",
        input: "# Title\n\n## Section 1\n\nContent 1\n\n## Section 2\n\nContent 2",
        patches: [
          {
            op: "remove-section",
            id: "section-1",
          },
        ],
        expected: "# Title\n\n## Section 2\n\nContent 2",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with replace-section patch", () => {
      const patchTest: PatchTest = {
        name: "replace section",
        input: "# Title\n\n## Section 1\n\nOld content",
        patches: [
          {
            op: "replace-section",
            id: "section-1",
            content: "New content",
          },
        ],
        expected: "# Title\n\n## Section 1\nNew content",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with prepend-to-section patch", () => {
      const patchTest: PatchTest = {
        name: "prepend to section",
        input: "# Title\n\n## Section\n\nOriginal content",
        patches: [
          {
            op: "prepend-to-section",
            id: "section",
            content: "Prepended content\n\n",
          },
        ],
        expected: "# Title\n\n## Section\nPrepended content\n\n\n\nOriginal content",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with append-to-section patch", () => {
      const patchTest: PatchTest = {
        name: "append to section",
        input: "# Title\n\n## Section\n\nOriginal content",
        patches: [
          {
            op: "append-to-section",
            id: "section",
            content: "\n\nAppended content",
          },
        ],
        expected: "# Title\n\n## Section\n\nOriginal content\n\n\nAppended content",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with delete-between patch", () => {
      const patchTest: PatchTest = {
        name: "delete between",
        input: "Start\n<!-- BEGIN -->\nRemove this\n<!-- END -->\nEnd",
        patches: [
          {
            op: "delete-between",
            start: "<!-- BEGIN -->",
            end: "<!-- END -->",
            inclusive: true,
          },
        ],
        expected: "Start\nEnd",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with replace-between patch", () => {
      const patchTest: PatchTest = {
        name: "replace between",
        input: "Start\n<!-- BEGIN -->\nOld content\n<!-- END -->\nEnd",
        patches: [
          {
            op: "replace-between",
            start: "<!-- BEGIN -->",
            end: "<!-- END -->",
            content: "<!-- BEGIN -->\nNew content\n<!-- END -->",
            inclusive: true,
          },
        ],
        expected: "Start\n<!-- BEGIN -->\nNew content\n<!-- END -->\nEnd",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with replace-line patch", () => {
      const patchTest: PatchTest = {
        name: "replace line",
        input: "Line 1\nOld line\nLine 3",
        patches: [
          {
            op: "replace-line",
            match: "Old line",
            replacement: "New line",
          },
        ],
        expected: "Line 1\nNew line\nLine 3",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with insert-after-line patch", () => {
      const patchTest: PatchTest = {
        name: "insert after line",
        input: "Line 1\nLine 2\nLine 3",
        patches: [
          {
            op: "insert-after-line",
            match: "Line 2",
            content: "Inserted line",
          },
        ],
        expected: "Line 1\nLine 2\nInserted line\nLine 3",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with insert-before-line patch", () => {
      const patchTest: PatchTest = {
        name: "insert before line",
        input: "Line 1\nLine 2\nLine 3",
        patches: [
          {
            op: "insert-before-line",
            match: "Line 2",
            content: "Inserted line",
          },
        ],
        expected: "Line 1\nInserted line\nLine 2\nLine 3",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with rename-header patch", () => {
      const patchTest: PatchTest = {
        name: "rename header",
        input: "# Title\n\n## Old Header\n\nContent",
        patches: [
          {
            op: "rename-header",
            id: "old-header",
            new: "New Header",
          },
        ],
        expected: "# Title\n\n## New Header\n\nContent",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with move-section patch", () => {
      const patchTest: PatchTest = {
        name: "move section",
        input: "# Title\n\n## Section A\n\nA content\n\n## Section B\n\nB content",
        patches: [
          {
            op: "move-section",
            id: "section-a",
            after: "section-b",
          },
        ],
        expected: "# Title\n\n## Section B\n\nB content\n## Section A\n\nA content\n",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with change-section-level patch", () => {
      const patchTest: PatchTest = {
        name: "change section level",
        input: "# Title\n\n## Section\n\nContent",
        patches: [
          {
            op: "change-section-level",
            id: "section",
            delta: 1,
          },
        ],
        expected: "# Title\n\n### Section\n\nContent",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with remove-frontmatter patch", () => {
      const patchTest: PatchTest = {
        name: "remove frontmatter",
        input: "---\ntitle: Title\nauthor: Author\n---\n\nContent",
        patches: [
          {
            op: "remove-frontmatter",
            key: "author",
          },
        ],
        expected: "---\ntitle: Title\n---\n\nContent",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with rename-frontmatter patch", () => {
      const patchTest: PatchTest = {
        name: "rename frontmatter",
        input: "---\noldKey: value\n---\n\nContent",
        patches: [
          {
            op: "rename-frontmatter",
            old: "oldKey",
            new: "newKey",
          },
        ],
        expected: "---\nnewKey: value\n---\n\nContent",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("runs test with merge-frontmatter patch", () => {
      const patchTest: PatchTest = {
        name: "merge frontmatter",
        input: "---\nexisting: value\n---\n\nContent",
        patches: [
          {
            op: "merge-frontmatter",
            values: {
              new: "field",
              another: 123,
            },
          },
        ],
        expected: "---\nexisting: value\nnew: field\nanother: 123\n---\n\nContent",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles test with empty input", () => {
      const patchTest: PatchTest = {
        name: "empty input",
        input: "",
        patches: [
          {
            op: "replace",
            old: "foo",
            new: "bar",
          },
        ],
        expected: "",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
      expect(result.actual).toBe("");
      expect(result.appliedPatches).toBe(0);
    });

    test("handles test with empty patches array", () => {
      const patchTest: PatchTest = {
        name: "no patches",
        input: "Hello world",
        patches: [],
        expected: "Hello world",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
      expect(result.actual).toBe("Hello world");
      expect(result.appliedPatches).toBe(0);
    });

    test("handles test with patch that doesn't match", () => {
      const patchTest: PatchTest = {
        name: "no match",
        input: "Hello world",
        patches: [
          {
            op: "replace",
            old: "nonexistent",
            new: "replacement",
          },
        ],
        expected: "Hello world",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
      expect(result.actual).toBe("Hello world");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test("handles test with invalid patch operation", () => {
      const patchTest: PatchTest = {
        name: "invalid patch",
        input: "Hello world",
        patches: [
          {
            op: "invalid-operation" as any,
          },
        ],
        expected: "Hello world",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("handles test with multiline input and expected", () => {
      const patchTest: PatchTest = {
        name: "multiline",
        input: "Line 1\nLine 2\nLine 3\nLine 4",
        patches: [
          {
            op: "replace",
            old: "Line 2",
            new: "Modified Line 2",
          },
        ],
        expected: "Line 1\nModified Line 2\nLine 3\nLine 4",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("handles test with special characters", () => {
      const patchTest: PatchTest = {
        name: "special chars",
        input: "Hello $world @foo #bar",
        patches: [
          {
            op: "replace",
            old: "$world",
            new: "$universe",
          },
        ],
        expected: "Hello $universe @foo #bar",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });

    test("handles test with unicode characters", () => {
      const patchTest: PatchTest = {
        name: "unicode",
        input: "Hello 世界 🌍",
        patches: [
          {
            op: "replace",
            old: "世界",
            new: "world",
          },
        ],
        expected: "Hello world 🌍",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(true);
    });
  });

  describe("validation and warnings", () => {
    test("includes validation errors when patch validation fails", () => {
      const patchTest: PatchTest = {
        name: "validation error",
        input: "Hello world",
        patches: [
          {
            op: "replace",
            old: "world",
            new: "forbidden",
            validate: {
              notContains: "forbidden",
            },
          },
        ],
        expected: "Hello forbidden",
      };

      const result = runPatchTest(patchTest);

      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    test("includes warnings array", () => {
      const patchTest: PatchTest = {
        name: "warnings",
        input: "Hello world",
        patches: [
          {
            op: "replace",
            old: "notfound",
            new: "replacement",
          },
        ],
        expected: "Hello world",
      };

      const result = runPatchTest(patchTest);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe("error handling", () => {
    test("catches errors and returns failed result", () => {
      const patchTest: PatchTest = {
        name: "error test",
        input: "Hello world",
        patches: [
          {
            op: "replace-regex",
            pattern: "[invalid(regex",
            replacement: "test",
          },
        ],
        expected: "Hello world",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    });

    test("handles patch with invalid field gracefully", () => {
      const patchTest: PatchTest = {
        name: "error with invalid field",
        input: "Hello world",
        patches: [
          {
            op: "replace-regex",
            pattern: "[invalid(regex", // Invalid regex
            replacement: "test",
          },
        ],
        expected: "Hello world",
      };

      const result = runPatchTest(patchTest);

      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe("runTestSuite", () => {
  describe("basic functionality", () => {
    test("runs suite with all passing tests", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test 1",
            input: "Hello",
            patches: [{ op: "replace", old: "Hello", new: "Hi" }],
            expected: "Hi",
          },
          {
            name: "test 2",
            input: "World",
            patches: [{ op: "replace", old: "World", new: "Universe" }],
            expected: "Universe",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(2);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(2);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(true);
    });

    test("runs suite with some failing tests", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "passing test",
            input: "Hello",
            patches: [{ op: "replace", old: "Hello", new: "Hi" }],
            expected: "Hi",
          },
          {
            name: "failing test",
            input: "World",
            patches: [{ op: "replace", old: "World", new: "Universe" }],
            expected: "Galaxy", // Wrong expected
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(2);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(false);
    });

    test("runs suite with all failing tests", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "fail 1",
            input: "A",
            patches: [{ op: "replace", old: "A", new: "B" }],
            expected: "C",
          },
          {
            name: "fail 2",
            input: "X",
            patches: [{ op: "replace", old: "X", new: "Y" }],
            expected: "Z",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(2);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(2);
    });

    test("runs suite with single test", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "single test",
            input: "Hello",
            patches: [{ op: "replace", old: "Hello", new: "Hi" }],
            expected: "Hi",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(1);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
    });

    test("runs suite with multiple patches per test", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "multi-patch test",
            input: "Hello world foo bar",
            patches: [
              { op: "replace", old: "Hello", new: "Hi" },
              { op: "replace", old: "world", new: "universe" },
              { op: "replace", old: "foo", new: "baz" },
            ],
            expected: "Hi universe baz bar",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(1);
      expect(result.passed).toBe(1);
      expect(result.results[0].appliedPatches).toBe(3);
    });
  });

  describe("edge cases", () => {
    test("handles empty test suite", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(0);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(0);
    });

    test("handles suite with tests containing errors", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "error test",
            input: "Hello",
            patches: [
              {
                op: "replace-regex",
                pattern: "[invalid",
                replacement: "test",
              },
            ],
            expected: "Hello",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(1);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBeDefined();
    });

    test("handles large test suite", () => {
      const tests = Array.from({ length: 100 }, (_, i) => ({
        name: `test ${i}`,
        input: `Value ${i}`,
        patches: [{ op: "replace" as const, old: `${i}`, new: `${i * 2}` }],
        expected: `Value ${i * 2}`,
      }));

      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests,
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(100);
      expect(result.passed).toBe(100);
      expect(result.failed).toBe(0);
    });
  });

  describe("result aggregation", () => {
    test("correctly counts passed and failed tests", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "pass 1",
            input: "A",
            patches: [{ op: "replace", old: "A", new: "B" }],
            expected: "B",
          },
          {
            name: "fail 1",
            input: "C",
            patches: [{ op: "replace", old: "C", new: "D" }],
            expected: "E",
          },
          {
            name: "pass 2",
            input: "F",
            patches: [{ op: "replace", old: "F", new: "G" }],
            expected: "G",
          },
          {
            name: "fail 2",
            input: "H",
            patches: [{ op: "replace", old: "H", new: "I" }],
            expected: "J",
          },
          {
            name: "pass 3",
            input: "K",
            patches: [{ op: "replace", old: "K", new: "L" }],
            expected: "L",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.total).toBe(5);
      expect(result.passed).toBe(3);
      expect(result.failed).toBe(2);
    });

    test("includes all test results in results array", () => {
      const suite: PatchTestSuite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test A",
            input: "A",
            patches: [{ op: "replace", old: "A", new: "B" }],
            expected: "B",
          },
          {
            name: "test B",
            input: "C",
            patches: [{ op: "replace", old: "C", new: "D" }],
            expected: "D",
          },
        ],
      };

      const result = runTestSuite(suite);

      expect(result.results.length).toBe(2);
      expect(result.results[0].name).toBe("test A");
      expect(result.results[1].name).toBe("test B");
    });
  });
});
