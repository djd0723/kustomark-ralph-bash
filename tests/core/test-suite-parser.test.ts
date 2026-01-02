/**
 * Tests for the test suite parser
 */

import { describe, expect, test } from "bun:test";
import { parseTestSuite, validateTestSuite } from "../../src/core/test-suite-parser";

describe("parseTestSuite", () => {
  describe("valid YAML", () => {
    test("parses valid test suite YAML", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test 1
    input: "Hello world"
    patches:
      - op: replace
        old: world
        new: universe
    expected: "Hello universe"
`;

      const result = parseTestSuite(yaml);

      expect(result).toBeDefined();
      expect(result.apiVersion).toBe("kustomark/v1");
      expect(result.kind).toBe("PatchTestSuite");
      expect(result.tests).toBeDefined();
      expect(result.tests.length).toBe(1);
    });

    test("parses test suite with multiple tests", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test 1
    input: "A"
    patches:
      - op: replace
        old: A
        new: B
    expected: "B"
  - name: test 2
    input: "C"
    patches:
      - op: replace
        old: C
        new: D
    expected: "D"
`;

      const result = parseTestSuite(yaml);

      expect(result.tests.length).toBe(2);
      expect(result.tests[0].name).toBe("test 1");
      expect(result.tests[1].name).toBe("test 2");
    });

    test("parses test with multiple patches", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: multi-patch
    input: "Hello world foo"
    patches:
      - op: replace
        old: Hello
        new: Hi
      - op: replace
        old: world
        new: universe
      - op: replace
        old: foo
        new: bar
    expected: "Hi universe bar"
`;

      const result = parseTestSuite(yaml);

      expect(result.tests[0].patches.length).toBe(3);
    });

    test("parses test with various patch operations", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: regex test
    input: "Version 1.0.0"
    patches:
      - op: replace-regex
        pattern: "\\\\d+\\\\.\\\\d+\\\\.\\\\d+"
        replacement: "2.0.0"
    expected: "Version 2.0.0"
`;

      const result = parseTestSuite(yaml);

      expect(result.tests[0].patches[0].op).toBe("replace-regex");
    });

    test("parses test with frontmatter patches", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: frontmatter
    input: |
      ---
      title: Old
      ---
      Content
    patches:
      - op: set-frontmatter
        key: title
        value: New
    expected: |
      ---
      title: New
      ---
      Content
`;

      const result = parseTestSuite(yaml);

      expect(result.tests[0].patches[0].op).toBe("set-frontmatter");
    });

    test("parses test with multiline strings", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: multiline
    input: |
      Line 1
      Line 2
      Line 3
    patches:
      - op: replace
        old: Line 2
        new: Modified Line 2
    expected: |
      Line 1
      Modified Line 2
      Line 3
`;

      const result = parseTestSuite(yaml);

      expect(result.tests[0].input).toContain("Line 1");
      expect(result.tests[0].expected).toContain("Modified Line 2");
    });

    test("parses empty test suite", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests: []
`;

      const result = parseTestSuite(yaml);

      expect(result.tests).toEqual([]);
    });

    test("parses test with special characters in strings", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: "special: chars & symbols"
    input: "Hello $world @foo #bar"
    patches:
      - op: replace
        old: "$world"
        new: "$universe"
    expected: "Hello $universe @foo #bar"
`;

      const result = parseTestSuite(yaml);

      expect(result.tests[0].name).toBe("special: chars & symbols");
    });
  });

  describe("invalid YAML", () => {
    test("throws error on malformed YAML", () => {
      const yaml = `
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test
    invalid: [unclosed array
`;

      expect(() => parseTestSuite(yaml)).toThrow();
    });

    test("throws error on invalid YAML syntax", () => {
      const yaml = "{ invalid yaml syntax ][][";

      expect(() => parseTestSuite(yaml)).toThrow();
    });

    test("throws error on non-object YAML", () => {
      const yaml = "just a string";

      expect(() => parseTestSuite(yaml)).toThrow("Test suite must be a YAML object");
    });

    test("accepts array at top level (validation catches errors)", () => {
      const yaml = `
- item1
- item2
`;

      // parseTestSuite accepts arrays (they're objects in JS)
      // Validation will catch the structural issues
      const result = parseTestSuite(yaml);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("throws error on null YAML", () => {
      const yaml = "null";

      expect(() => parseTestSuite(yaml)).toThrow("Test suite must be a YAML object");
    });

    test("throws error on empty YAML", () => {
      const yaml = "";

      expect(() => parseTestSuite(yaml)).toThrow("Test suite must be a YAML object");
    });

    test("includes YAML error details in error message", () => {
      const yaml = `
apiVersion: kustomark/v1
tests:
  - name: test
    invalid syntax ][
`;

      let error: Error | undefined;
      try {
        parseTestSuite(yaml);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain("YAML parsing error");
    });
  });
});

describe("validateTestSuite", () => {
  describe("apiVersion validation", () => {
    test("validates correct apiVersion", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("rejects missing apiVersion", () => {
      const suite = {
        kind: "PatchTestSuite",
        tests: [],
      } as any;

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "apiVersion")).toBe(true);
      expect(result.errors.find(e => e.field === "apiVersion")?.message).toContain("required");
    });

    test("rejects wrong apiVersion", () => {
      const suite = {
        apiVersion: "kustomark/v2",
        kind: "PatchTestSuite",
        tests: [],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "apiVersion")).toBe(true);
      expect(result.errors.find(e => e.field === "apiVersion")?.message).toContain("kustomark/v1");
    });
  });

  describe("kind validation", () => {
    test("validates correct kind", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(true);
    });

    test("rejects missing kind", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        tests: [],
      } as any;

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "kind")).toBe(true);
    });

    test("rejects wrong kind", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "WrongKind",
        tests: [],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "kind")).toBe(true);
      expect(result.errors.find(e => e.field === "kind")?.message).toContain("PatchTestSuite");
    });
  });

  describe("tests array validation", () => {
    test("accepts valid tests array", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(true);
    });

    test("rejects missing tests", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
      } as any;

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "tests")).toBe(true);
    });

    test("rejects non-array tests", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: "not an array",
      } as any;

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("must be an array"))).toBe(true);
    });

    test("rejects empty tests array", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("cannot be empty"))).toBe(true);
    });
  });

  describe("individual test validation", () => {
    test("validates test name", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("name"))).toBe(true);
    });

    test("rejects non-string test name", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: 123,
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("must be a string"))).toBe(true);
    });

    test("rejects empty test name", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "   ",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("cannot be empty"))).toBe(true);
    });

    test("validates test input", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("input"))).toBe(true);
    });

    test("rejects non-string test input", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: 123,
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("input") && e.message.includes("must be a string"))).toBe(true);
    });

    test("allows empty string as input", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(true);
    });

    test("validates test patches", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("patches"))).toBe(true);
    });

    test("rejects non-array patches", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: "not an array",
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("must be an array"))).toBe(true);
    });

    test("rejects empty patches array", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [],
            expected: "hi",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("cannot be empty"))).toBe(true);
    });

    test("validates patch operation field", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ old: "hello", new: "hi" }],
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("op"))).toBe(true);
    });

    test("rejects non-string patch op", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: 123, old: "hello", new: "hi" }],
            expected: "hi",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("must be a string"))).toBe(true);
    });

    test("validates test expected", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("expected"))).toBe(true);
    });

    test("rejects non-string expected", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: 123,
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("expected") && e.message.includes("must be a string"))).toBe(true);
    });

    test("allows empty string as expected", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "" }],
            expected: "",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(true);
    });
  });

  describe("test name uniqueness", () => {
    test("rejects duplicate test names", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "duplicate",
            input: "a",
            patches: [{ op: "replace", old: "a", new: "b" }],
            expected: "b",
          },
          {
            name: "duplicate",
            input: "c",
            patches: [{ op: "replace", old: "c", new: "d" }],
            expected: "d",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes("duplicate"))).toBe(true);
    });

    test("allows unique test names", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test1",
            input: "a",
            patches: [{ op: "replace", old: "a", new: "b" }],
            expected: "b",
          },
          {
            name: "test2",
            input: "c",
            patches: [{ op: "replace", old: "c", new: "d" }],
            expected: "d",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(true);
    });

    test("detects multiple duplicates", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "dup1",
            input: "a",
            patches: [{ op: "replace", old: "a", new: "b" }],
            expected: "b",
          },
          {
            name: "dup1",
            input: "c",
            patches: [{ op: "replace", old: "c", new: "d" }],
            expected: "d",
          },
          {
            name: "dup2",
            input: "e",
            patches: [{ op: "replace", old: "e", new: "f" }],
            expected: "f",
          },
          {
            name: "dup2",
            input: "g",
            patches: [{ op: "replace", old: "g", new: "h" }],
            expected: "h",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      const duplicateErrors = result.errors.filter(e => e.message.includes("duplicate"));
      expect(duplicateErrors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("complex validation scenarios", () => {
    test("reports multiple validation errors", () => {
      const suite = {
        kind: "PatchTestSuite",
        tests: [
          {
            input: "hello",
            patches: [],
            expected: "hi",
          } as any,
        ],
      } as any;

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    test("validates all tests in suite", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "valid",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          },
          {
            input: "world",
            patches: [{ op: "replace", old: "world", new: "universe" }],
            expected: "universe",
          } as any,
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes("tests[1]"))).toBe(true);
    });

    test("returns empty warnings array", () => {
      const suite = {
        apiVersion: "kustomark/v1",
        kind: "PatchTestSuite",
        tests: [
          {
            name: "test",
            input: "hello",
            patches: [{ op: "replace", old: "hello", new: "hi" }],
            expected: "hi",
          },
        ],
      };

      const result = validateTestSuite(suite);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings.length).toBe(0);
    });
  });
});
