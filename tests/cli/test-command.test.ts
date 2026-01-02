/**
 * Tests for the `kustomark test` command
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI_PATH = "src/cli/index.ts";
const FIXTURES_DIR = "tests/fixtures/test-command";

describe("kustomark test command", () => {
  // Setup and cleanup helpers
  const setupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });
  };

  const cleanupFixtures = () => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  };

  describe("--suite flag", () => {
    test("runs test suite with all passing tests", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "passing-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: simple replace
    input: "Hello world"
    patches:
      - op: replace
        old: world
        new: universe
    expected: "Hello universe"
  - name: multiple replaces
    input: "foo bar baz"
    patches:
      - op: replace
        old: foo
        new: FOO
      - op: replace
        old: bar
        new: BAR
    expected: "FOO BAR baz"
`,
        );

        const result = execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
          encoding: "utf-8",
        });

        expect(result).toContain("✓");
        expect(result).toContain("simple replace");
        expect(result).toContain("multiple replaces");
        expect(result).toContain("2 passed");
        expect(result).toContain("0 failed");
      } finally {
        cleanupFixtures();
      }
    });

    test("runs test suite with failing tests", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "failing-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: passing test
    input: "Hello world"
    patches:
      - op: replace
        old: world
        new: universe
    expected: "Hello universe"
  - name: failing test
    input: "foo bar"
    patches:
      - op: replace
        old: foo
        new: baz
    expected: "wrong expected"
`,
        );

        let exitCode = 0;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
            encoding: "utf-8",
          });
        } catch (error: any) {
          exitCode = error.status;
        }

        expect(exitCode).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("runs test suite with --format=json", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "json-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test 1
    input: "A"
    patches:
      - op: replace
        old: A
        new: B
    expected: "B"
`,
        );

        const output = execSync(`bun run ${CLI_PATH} test --suite ${suitePath} --format=json`, {
          encoding: "utf-8",
        });

        const result = JSON.parse(output);

        expect(result).toHaveProperty("success");
        expect(result.success).toBe(true);
        expect(result).toHaveProperty("total", 1);
        expect(result).toHaveProperty("passed", 1);
        expect(result).toHaveProperty("failed", 0);
        expect(result).toHaveProperty("results");
        expect(result.results.length).toBe(1);
        expect(result.results[0].name).toBe("test 1");
        expect(result.results[0].passed).toBe(true);
      } finally {
        cleanupFixtures();
      }
    });

    test("fails with missing test suite file", () => {
      setupFixtures();

      try {
        let error: any;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${join(FIXTURES_DIR, "nonexistent.yaml")}`, {
            encoding: "utf-8",
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
        expect(error.stderr.toString()).toContain("not found");
      } finally {
        cleanupFixtures();
      }
    });

    test("fails with invalid test suite YAML", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "invalid.yaml");
        writeFileSync(suitePath, "{ invalid yaml [[]");

        let error: any;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
            encoding: "utf-8",
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("fails with missing required fields in test suite", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "missing-fields.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: incomplete test
    input: "hello"
    # Missing patches and expected
`,
        );

        let error: any;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
            encoding: "utf-8",
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("runs suite with various patch operations", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "operations-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: replace
    input: "hello"
    patches:
      - op: replace
        old: hello
        new: hi
    expected: "hi"
  - name: replace-regex
    input: "Version 1.0.0"
    patches:
      - op: replace-regex
        pattern: "\\\\d+\\\\.\\\\d+\\\\.\\\\d+"
        replacement: "2.0.0"
    expected: "Version 2.0.0"
  - name: set-frontmatter
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
`,
        );

        const result = execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
          encoding: "utf-8",
        });

        expect(result).toContain("3 passed");
        expect(result).toContain("0 failed");
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("--patch flag with inline YAML", () => {
    test("runs single patch test with --input file", () => {
      setupFixtures();

      try {
        const inputPath = join(FIXTURES_DIR, "input.md");
        const patchPath = join(FIXTURES_DIR, "inline-patch.yaml");

        writeFileSync(inputPath, "Hello world");
        writeFileSync(patchPath, "op: replace\nold: world\nnew: universe");

        const output = execSync(
          `bun run ${CLI_PATH} test --patch-file ${patchPath} --input ${inputPath} --format=json`,
          {
            encoding: "utf-8",
          },
        );

        const result = JSON.parse(output);

        expect(result.success).toBe(true);
        expect(result.output).toBe("Hello universe");
      } finally {
        cleanupFixtures();
      }
    });

    test("runs single patch test with --content", () => {
      setupFixtures();

      try {
        const patchPath = join(FIXTURES_DIR, "patch.yaml");
        writeFileSync(patchPath, "op: replace\nold: foo\nnew: bar");

        const output = execSync(
          `bun run ${CLI_PATH} test --patch-file ${patchPath} --content "foo baz" --format=json`,
          {
            encoding: "utf-8",
          },
        );

        const result = JSON.parse(output);

        expect(result.success).toBe(true);
        expect(result.output).toBe("bar baz");
      } finally {
        cleanupFixtures();
      }
    });

    test("fails when missing --input or --content", () => {
      setupFixtures();

      try {
        const patchPath = join(FIXTURES_DIR, "patch.yaml");
        writeFileSync(patchPath, "op: replace\nold: foo\nnew: bar");

        let error: any;
        try {
          execSync(`bun run ${CLI_PATH} test --patch-file ${patchPath}`, {
            encoding: "utf-8",
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("fails with invalid patch YAML", () => {
      setupFixtures();

      try {
        const patchPath = join(FIXTURES_DIR, "invalid-patch.yaml");
        writeFileSync(patchPath, "invalid: [[]");

        let error: any;
        try {
          execSync(`bun run ${CLI_PATH} test --patch-file ${patchPath} --content "test"`, {
            encoding: "utf-8",
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("--patch-file flag", () => {
    test("runs patch from file with --input", () => {
      setupFixtures();

      try {
        const patchPath = join(FIXTURES_DIR, "patch.yaml");
        const inputPath = join(FIXTURES_DIR, "input.md");

        writeFileSync(
          patchPath,
          `op: replace
old: world
new: universe
`,
        );
        writeFileSync(inputPath, "Hello world");

        const output = execSync(
          `bun run ${CLI_PATH} test --patch-file ${patchPath} --input ${inputPath} --format=json`,
          {
            encoding: "utf-8",
          },
        );

        const result = JSON.parse(output);

        expect(result.success).toBe(true);
        expect(result.output).toBe("Hello universe");
      } finally {
        cleanupFixtures();
      }
    });

    test("fails with missing patch file", () => {
      setupFixtures();

      try {
        const inputPath = join(FIXTURES_DIR, "input.md");
        writeFileSync(inputPath, "Hello world");

        let error: any;
        try {
          execSync(
            `bun run ${CLI_PATH} test --patch-file ${join(FIXTURES_DIR, "nonexistent.yaml")} --input ${inputPath}`,
            {
              encoding: "utf-8",
            },
          );
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("runs multiple patches from file", () => {
      setupFixtures();

      try {
        const patchPath = join(FIXTURES_DIR, "multi-patch.yaml");
        const inputPath = join(FIXTURES_DIR, "input.md");

        writeFileSync(
          patchPath,
          `- op: replace
  old: foo
  new: FOO
- op: replace
  old: bar
  new: BAR
`,
        );
        writeFileSync(inputPath, "foo bar baz");

        const output = execSync(
          `bun run ${CLI_PATH} test --patch-file ${patchPath} --input ${inputPath} --format=json`,
          {
            encoding: "utf-8",
          },
        );

        const result = JSON.parse(output);

        expect(result.success).toBe(true);
        expect(result.output).toBe("FOO BAR baz");
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("--show-steps flag", () => {
    test("accepts --show-steps flag without errors", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "steps-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: multi-step test
    input: "A B C"
    patches:
      - op: replace
        old: A
        new: X
      - op: replace
        old: B
        new: Y
      - op: replace
        old: C
        new: Z
    expected: "X Y Z"
`,
        );

        const output = execSync(`bun run ${CLI_PATH} test --suite ${suitePath} --show-steps`, {
          encoding: "utf-8",
        });

        // Just verify it runs without error and shows the test passed
        expect(output).toContain("multi-step test");
        expect(output).toContain("1 passed");
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("exit codes", () => {
    test("exits with 0 when all tests pass", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "pass-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test
    input: "A"
    patches:
      - op: replace
        old: A
        new: B
    expected: "B"
`,
        );

        const result = execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
          encoding: "utf-8",
        });

        expect(result).toContain("1 passed");
      } finally {
        cleanupFixtures();
      }
    });

    test("exits with 1 when tests fail", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "fail-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test
    input: "A"
    patches:
      - op: replace
        old: A
        new: B
    expected: "wrong"
`,
        );

        let exitCode = 0;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
            encoding: "utf-8",
          });
        } catch (error: any) {
          exitCode = error.status;
        }

        expect(exitCode).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("exits with 1 on validation error", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "invalid-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test
    # Missing required fields
`,
        );

        let exitCode = 0;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
            encoding: "utf-8",
          });
        } catch (error: any) {
          exitCode = error.status;
        }

        expect(exitCode).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("exits with 1 when no test mode specified", () => {
      setupFixtures();

      try {
        let exitCode = 0;
        try {
          execSync(`bun run ${CLI_PATH} test`, {
            encoding: "utf-8",
          });
        } catch (error: any) {
          exitCode = error.status;
        }

        expect(exitCode).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("error handling", () => {
    test("handles missing input file gracefully", () => {
      setupFixtures();

      try {
        let error: any;
        try {
          execSync(
            `bun run ${CLI_PATH} test --patch "op: replace\\nold: a\\nnew: b" --input ${join(FIXTURES_DIR, "nonexistent.md")}`,
            {
              encoding: "utf-8",
            },
          );
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });

    test("handles invalid patch operation gracefully", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "invalid-op.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: invalid op
    input: "test"
    patches:
      - op: invalid-operation
    expected: "test"
`,
        );

        let output: string;
        try {
          output = execSync(`bun run ${CLI_PATH} test --suite ${suitePath} --format=json`, {
            encoding: "utf-8",
          });
        } catch (error: any) {
          // Command may exit with non-zero, capture stdout
          output = error.stdout?.toString() || "{}";
        }

        const result = JSON.parse(output);

        expect(result.success).toBe(false);
        expect(result.results[0].passed).toBe(false);
        expect(result.results[0].error).toBeDefined();
      } finally {
        cleanupFixtures();
      }
    });

    test("reports JSON errors in JSON format", () => {
      setupFixtures();

      try {
        let output: string;
        try {
          output = execSync(
            `bun run ${CLI_PATH} test --suite ${join(FIXTURES_DIR, "nonexistent.yaml")} --format=json`,
            {
              encoding: "utf-8",
            },
          );
        } catch (error: any) {
          // Command exits with non-zero, capture stdout
          output = error.stdout?.toString() || "{}";
        }

        const result = JSON.parse(output);

        expect(result.success).toBe(false);
        expect(result).toHaveProperty("error");
      } finally {
        cleanupFixtures();
      }
    });

    test("handles empty test suite", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "empty-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests: []
`,
        );

        let error: any;
        try {
          execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
            encoding: "utf-8",
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("complex scenarios", () => {
    test("runs large test suite with multiple operations", () => {
      setupFixtures();

      try {
        const tests = Array.from(
          { length: 10 },
          (_, i) => `  - name: test ${i}
    input: "Value ${i}"
    patches:
      - op: replace
        old: "${i}"
        new: "${i * 2}"
    expected: "Value ${i * 2}"`,
        ).join("\n");

        const suitePath = join(FIXTURES_DIR, "large-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
${tests}
`,
        );

        const result = execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
          encoding: "utf-8",
        });

        expect(result).toContain("10 passed");
        expect(result).toContain("0 failed");
      } finally {
        cleanupFixtures();
      }
    });

    test("handles multiline content correctly", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "multiline-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: multiline test
    input: |
      Line 1
      Line 2
      Line 3
    patches:
      - op: replace
        old: "Line 2"
        new: "Modified Line 2"
    expected: |
      Line 1
      Modified Line 2
      Line 3
`,
        );

        const result = execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
          encoding: "utf-8",
        });

        expect(result).toContain("1 passed");
      } finally {
        cleanupFixtures();
      }
    });

    test("handles special characters in content", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "special-chars-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: special chars
    input: "Hello $world @foo #bar"
    patches:
      - op: replace
        old: "$world"
        new: "$universe"
    expected: "Hello $universe @foo #bar"
`,
        );

        const result = execSync(`bun run ${CLI_PATH} test --suite ${suitePath}`, {
          encoding: "utf-8",
        });

        expect(result).toContain("1 passed");
      } finally {
        cleanupFixtures();
      }
    });

    test("combines multiple flags correctly", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "combined-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test
    input: "A"
    patches:
      - op: replace
        old: A
        new: B
    expected: "B"
`,
        );

        const output = execSync(`bun run ${CLI_PATH} test --suite ${suitePath} --format=json -v`, {
          encoding: "utf-8",
        });

        const result = JSON.parse(output);

        expect(result.success).toBe(true);
        expect(result.total).toBe(1);
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("test with validation errors", () => {
    test("reports patch validation errors", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "validation-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: validation error
    input: "Hello world"
    patches:
      - op: replace
        old: world
        new: forbidden
        validate:
          notContains: forbidden
    expected: "Hello forbidden"
`,
        );

        const output = execSync(`bun run ${CLI_PATH} test --suite ${suitePath} --format=json`, {
          encoding: "utf-8",
        });

        const result = JSON.parse(output);

        expect(result.results[0].validationErrors).toBeDefined();
        expect(result.results[0].validationErrors.length).toBeGreaterThan(0);
      } finally {
        cleanupFixtures();
      }
    });
  });

  describe("test with warnings", () => {
    test("shows warnings in verbose mode", () => {
      setupFixtures();

      try {
        const suitePath = join(FIXTURES_DIR, "warnings-suite.yaml");
        writeFileSync(
          suitePath,
          `apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: no match warning
    input: "Hello world"
    patches:
      - op: replace
        old: nonexistent
        new: replacement
    expected: "Hello world"
`,
        );

        const output = execSync(`bun run ${CLI_PATH} test --suite ${suitePath} -vv`, {
          encoding: "utf-8",
        });

        expect(output).toContain("Warning");
      } finally {
        cleanupFixtures();
      }
    });
  });
});
