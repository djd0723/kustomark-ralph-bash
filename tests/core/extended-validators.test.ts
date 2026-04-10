/**
 * Tests for extended validator types:
 * - contains
 * - matchesRegex
 * - notMatchesRegex
 * - frontmatterRequired in per-patch PatchValidation
 */

import { describe, expect, test } from "bun:test";
import { parseConfig, validateConfig } from "../../src/core/config-parser.js";
import { applyPatches } from "../../src/core/patch-engine.js";
import {
  validateContains,
  validateMatchesRegex,
  validateNotMatchesRegex,
  runValidator,
  runValidators,
} from "../../src/core/validators.js";
import type { KustomarkConfig } from "../../src/core/types.js";

// ============================================================================
// Unit tests: validateContains
// ============================================================================

describe("validateContains", () => {
  test("returns true when content contains the pattern", () => {
    expect(validateContains("hello world", "world")).toBe(true);
  });

  test("returns false when content does not contain the pattern", () => {
    expect(validateContains("hello world", "foo")).toBe(false);
  });

  test("is case-sensitive", () => {
    expect(validateContains("Hello World", "hello")).toBe(false);
    expect(validateContains("Hello World", "Hello")).toBe(true);
  });

  test("works with empty pattern (always true)", () => {
    expect(validateContains("any content", "")).toBe(true);
  });

  test("works with empty content", () => {
    expect(validateContains("", "something")).toBe(false);
  });

  test("works with multiline content", () => {
    const content = "line one\nline two\nline three";
    expect(validateContains(content, "line two")).toBe(true);
    expect(validateContains(content, "line four")).toBe(false);
  });
});

// ============================================================================
// Unit tests: validateMatchesRegex
// ============================================================================

describe("validateMatchesRegex", () => {
  test("returns valid=true when content matches the pattern", () => {
    expect(validateMatchesRegex("hello world", "hello")).toEqual({ valid: true });
  });

  test("returns valid=false when content does not match", () => {
    expect(validateMatchesRegex("hello world", "^goodbye")).toEqual({ valid: false });
  });

  test("supports regex anchors", () => {
    expect(validateMatchesRegex("hello", "^hello$")).toEqual({ valid: true });
    expect(validateMatchesRegex("say hello", "^hello$")).toEqual({ valid: false });
  });

  test("supports character classes", () => {
    expect(validateMatchesRegex("version 3.2.1", "\\d+\\.\\d+\\.\\d+")).toEqual({ valid: true });
    expect(validateMatchesRegex("no version here", "\\d+\\.\\d+\\.\\d+")).toEqual({ valid: false });
  });

  test("matches content spanning multiple lines via dotall pattern", () => {
    const content = "line one\nline two";
    // Use [\s\S] for multiline matching since inline (?m) is not standard JS regex
    expect(validateMatchesRegex(content, "line one[\\s\\S]+line two")).toEqual({ valid: true });
  });

  test("returns error for invalid regex", () => {
    const result = validateMatchesRegex("content", "[invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid regex pattern");
  });
});

// ============================================================================
// Unit tests: validateNotMatchesRegex
// ============================================================================

describe("validateNotMatchesRegex", () => {
  test("returns valid=true when content does NOT match", () => {
    expect(validateNotMatchesRegex("hello world", "^goodbye")).toEqual({ valid: true });
  });

  test("returns valid=false when content matches the pattern", () => {
    expect(validateNotMatchesRegex("hello world", "hello")).toEqual({ valid: false });
  });

  test("supports anchors", () => {
    expect(validateNotMatchesRegex("say hello", "^hello$")).toEqual({ valid: true });
    expect(validateNotMatchesRegex("hello", "^hello$")).toEqual({ valid: false });
  });

  test("returns error for invalid regex", () => {
    const result = validateNotMatchesRegex("content", "[invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid regex pattern");
  });
});

// ============================================================================
// Unit tests: runValidator with new fields
// ============================================================================

describe("runValidator - contains", () => {
  test("passes when content contains required string", () => {
    const error = runValidator("This document has a version: 1.0", {
      name: "has-version",
      contains: "version:",
    });
    expect(error).toBeNull();
  });

  test("fails when content is missing required string", () => {
    const error = runValidator("This document has no version", {
      name: "has-version",
      contains: "version:",
    });
    expect(error).not.toBeNull();
    expect(error?.validator).toBe("has-version");
    expect(error?.message).toContain("missing required pattern");
    expect(error?.message).toContain("version:");
  });
});

describe("runValidator - matchesRegex", () => {
  test("passes when content matches the pattern", () => {
    const error = runValidator("version: 2.3.4", {
      name: "valid-version",
      matchesRegex: "version: \\d+\\.\\d+\\.\\d+",
    });
    expect(error).toBeNull();
  });

  test("fails when content does not match the pattern", () => {
    const error = runValidator("version: latest", {
      name: "valid-version",
      matchesRegex: "version: \\d+\\.\\d+\\.\\d+",
    });
    expect(error).not.toBeNull();
    expect(error?.validator).toBe("valid-version");
    expect(error?.message).toContain("does not match required pattern");
  });

  test("reports error message for invalid regex", () => {
    const error = runValidator("some content", {
      name: "bad-regex",
      matchesRegex: "[invalid",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Invalid regex pattern");
  });
});

describe("runValidator - notMatchesRegex", () => {
  test("passes when content does NOT match the pattern", () => {
    const error = runValidator("clean content", {
      name: "no-debug",
      notMatchesRegex: "console\\.(log|debug|warn)\\(",
    });
    expect(error).toBeNull();
  });

  test("fails when content matches the forbidden pattern", () => {
    const error = runValidator("some text console.log(x) more text", {
      name: "no-debug",
      notMatchesRegex: "console\\.(log|debug|warn)\\(",
    });
    expect(error).not.toBeNull();
    expect(error?.validator).toBe("no-debug");
    expect(error?.message).toContain("matches forbidden pattern");
  });
});

describe("runValidator - combined new fields", () => {
  test("runs all checks and returns first failure", () => {
    // notContains fails first since it's checked before contains
    const error = runValidator("this has forbidden content", {
      name: "combo",
      notContains: "forbidden",
      contains: "something-else",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("forbidden");
  });

  test("passes when all new checks pass", () => {
    const error = runValidator("required text here", {
      name: "combo",
      contains: "required text",
      notMatchesRegex: "forbidden",
      matchesRegex: "^required",
    });
    expect(error).toBeNull();
  });
});

describe("runValidators - multiple validators", () => {
  test("collects errors from all failing validators", () => {
    const errors = runValidators("some content", [
      { name: "v1", contains: "missing-string" },
      { name: "v2", notMatchesRegex: "some" },
      { name: "v3", notContains: "definitely-not-here" },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0]?.validator).toBe("v1");
    expect(errors[1]?.validator).toBe("v2");
  });

  test("returns empty array when all pass", () => {
    const errors = runValidators("hello world", [
      { name: "v1", contains: "hello" },
      { name: "v2", notMatchesRegex: "^goodbye" },
      { name: "v3", matchesRegex: "world$" },
    ]);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// Integration tests: per-patch validation with new fields
// ============================================================================

describe("per-patch validation - contains", () => {
  test("validation passes when patched content contains required string", async () => {
    const content = "old text here";
    const patches = [
      {
        op: "replace" as const,
        old: "old text",
        new: "new required-string text",
        validate: { contains: "required-string" },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(0);
  });

  test("validation fails when patched content is missing required string", async () => {
    const content = "old text here";
    const patches = [
      {
        op: "replace" as const,
        old: "old text",
        new: "new text",
        validate: { contains: "required-string" },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]?.message).toContain("missing required pattern");
  });
});

describe("per-patch validation - matchesRegex", () => {
  test("validation passes when patched content matches pattern", async () => {
    const content = "version: 1.0.0";
    const patches = [
      {
        op: "replace" as const,
        old: "1.0.0",
        new: "2.3.4",
        validate: { matchesRegex: "version: \\d+\\.\\d+\\.\\d+" },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(0);
  });

  test("validation fails when patched content does not match pattern", async () => {
    const content = "version: 1.0.0";
    const patches = [
      {
        op: "replace" as const,
        old: "version: 1.0.0",
        new: "version: latest",
        validate: { matchesRegex: "version: \\d+\\.\\d+\\.\\d+" },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]?.message).toContain("does not match required pattern");
  });
});

describe("per-patch validation - notMatchesRegex", () => {
  test("validation passes when patched content does not match forbidden pattern", async () => {
    const content = "old text here";
    const patches = [
      {
        op: "replace" as const,
        old: "old text",
        new: "new text",
        validate: { notMatchesRegex: "DRAFT|TODO" },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(0);
  });

  test("validation fails when patched content matches forbidden pattern", async () => {
    const content = "old text here";
    const patches = [
      {
        op: "replace" as const,
        old: "old text",
        new: "DRAFT new text",
        validate: { notMatchesRegex: "DRAFT|TODO" },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]?.message).toContain("matches forbidden pattern");
  });
});

describe("per-patch validation - frontmatterRequired", () => {
  test("validation passes when required frontmatter keys present", async () => {
    const content = "---\ntitle: My Doc\nauthor: Alice\n---\nContent here.";
    const patches = [
      {
        op: "replace" as const,
        old: "Content here",
        new: "Updated content",
        validate: { frontmatterRequired: ["title", "author"] },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(0);
  });

  test("validation fails when required frontmatter keys missing", async () => {
    const content = "---\ntitle: My Doc\n---\nContent here.";
    const patches = [
      {
        op: "replace" as const,
        old: "Content here",
        new: "Updated content",
        validate: { frontmatterRequired: ["title", "author", "date"] },
      },
    ];
    const result = await applyPatches(content, patches);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]?.message).toContain("missing required frontmatter keys");
    expect(result.validationErrors[0]?.message).toContain("author");
    expect(result.validationErrors[0]?.message).toContain("date");
  });
});

describe("per-patch validation - does not run when patch does not match", () => {
  test("validation is skipped if patch applied nothing", async () => {
    const content = "some content";
    const patches = [
      {
        op: "replace" as const,
        old: "NOT FOUND",
        new: "something",
        validate: { contains: "required-string" },
        onNoMatch: "skip" as const,
      },
    ];
    const result = await applyPatches(content, patches);
    // Validation should not run if count=0
    expect(result.validationErrors).toHaveLength(0);
  });
});

// ============================================================================
// Config validation tests
// ============================================================================

describe("validateConfig - validate field on patches", () => {
  const baseConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    resources: ["**/*.md"],
    patches: [],
  };

  test("accepts valid contains field", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace", old: "x", new: "y", validate: { contains: "something" } }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validateErrors = result.errors.filter((e) => e.field?.includes("validate"));
    expect(validateErrors).toHaveLength(0);
  });

  test("accepts valid matchesRegex field", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace", old: "x", new: "y", validate: { matchesRegex: "\\d+" } }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validateErrors = result.errors.filter((e) => e.field?.includes("validate"));
    expect(validateErrors).toHaveLength(0);
  });

  test("rejects invalid matchesRegex pattern", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace", old: "x", new: "y", validate: { matchesRegex: "[invalid" } }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validateErrors = result.errors.filter((e) => e.field?.includes("matchesRegex"));
    expect(validateErrors).toHaveLength(1);
    expect(validateErrors[0]?.message).toContain("Invalid regex pattern");
  });

  test("rejects invalid notMatchesRegex pattern", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace", old: "x", new: "y", validate: { notMatchesRegex: "[invalid" } }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validateErrors = result.errors.filter((e) => e.field?.includes("notMatchesRegex"));
    expect(validateErrors).toHaveLength(1);
    expect(validateErrors[0]?.message).toContain("Invalid regex pattern");
  });

  test("accepts valid frontmatterRequired field in validate", () => {
    const config = {
      ...baseConfig,
      patches: [{ op: "replace", old: "x", new: "y", validate: { frontmatterRequired: ["title", "author"] } }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validateErrors = result.errors.filter((e) => e.field?.includes("validate"));
    expect(validateErrors).toHaveLength(0);
  });
});

describe("validateConfig - global validators", () => {
  const baseConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    resources: ["**/*.md"],
  };

  test("accepts valid contains in global validators", () => {
    const config = {
      ...baseConfig,
      validators: [{ name: "v1", contains: "required" }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validatorErrors = result.errors.filter((e) => e.field?.includes("validators"));
    expect(validatorErrors).toHaveLength(0);
  });

  test("accepts valid matchesRegex in global validators", () => {
    const config = {
      ...baseConfig,
      validators: [{ name: "v1", matchesRegex: "^version:" }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validatorErrors = result.errors.filter((e) => e.field?.includes("validators"));
    expect(validatorErrors).toHaveLength(0);
  });

  test("rejects invalid matchesRegex in global validators", () => {
    const config = {
      ...baseConfig,
      validators: [{ name: "v1", matchesRegex: "[invalid" }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validatorErrors = result.errors.filter((e) => e.field?.includes("matchesRegex"));
    expect(validatorErrors).toHaveLength(1);
    expect(validatorErrors[0]?.message).toContain("Invalid regex pattern");
  });

  test("rejects invalid notMatchesRegex in global validators", () => {
    const config = {
      ...baseConfig,
      validators: [{ name: "v1", notMatchesRegex: "[bad" }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validatorErrors = result.errors.filter((e) => e.field?.includes("notMatchesRegex"));
    expect(validatorErrors).toHaveLength(1);
    expect(validatorErrors[0]?.message).toContain("Invalid regex pattern");
  });

  test("rejects global validator missing name", () => {
    const config = {
      ...baseConfig,
      validators: [{ contains: "something" }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const nameErrors = result.errors.filter((e) => e.field?.includes("validators[0].name"));
    expect(nameErrors).toHaveLength(1);
  });

  test("accepts validator with all new fields", () => {
    const config = {
      ...baseConfig,
      validators: [{
        name: "comprehensive",
        notContains: "DRAFT",
        contains: "version:",
        matchesRegex: "^#",
        notMatchesRegex: "TODO",
        frontmatterRequired: ["title"],
      }],
    };
    const result = validateConfig(config as unknown as KustomarkConfig);
    const validatorErrors = result.errors.filter((e) => e.field?.includes("validators"));
    expect(validatorErrors).toHaveLength(0);
  });
});

// ============================================================================
// Integration: global validators with new types via runValidators
// ============================================================================

describe("runValidators - global integration", () => {
  test("contains validator catches missing required text", () => {
    const content = "# My Document\n\nSome content without version.";
    const errors = runValidators(content, [
      { name: "must-have-version", contains: "version:" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.validator).toBe("must-have-version");
  });

  test("matchesRegex validator catches non-conforming content", () => {
    const content = "Some document without a proper heading";
    const errors = runValidators(content, [
      { name: "must-start-with-heading", matchesRegex: "^#" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("does not match required pattern");
  });

  test("notMatchesRegex validator catches forbidden patterns", () => {
    const content = "# Document\n\nTODO: fix this later.";
    const errors = runValidators(content, [
      { name: "no-todos", notMatchesRegex: "TODO:" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("matches forbidden pattern");
  });

  test("all new validators pass on conforming content", () => {
    const content = "# My Document\n\nversion: 1.0.0\n\nClean content.";
    const errors = runValidators(content, [
      { name: "has-version", contains: "version:" },
      { name: "starts-heading", matchesRegex: "^#" },
      { name: "no-todos", notMatchesRegex: "TODO" },
    ]);
    expect(errors).toHaveLength(0);
  });
});
