/**
 * Tests for word count and line count validators:
 * - validateMinWordCount / validateMaxWordCount
 * - validateMinLineCount / validateMaxLineCount
 * - runValidator integration for new fields
 * - runPatchValidation (per-patch) integration
 * - config-parser validation of new fields
 */

import { describe, expect, test } from "bun:test";
import { validateConfig } from "../../src/core/config-parser.js";
import { applyPatches } from "../../src/core/patch-engine.js";
import {
  validateMinWordCount,
  validateMaxWordCount,
  validateMinLineCount,
  validateMaxLineCount,
  runValidator,
  runValidators,
} from "../../src/core/validators.js";

// ============================================================================
// Unit tests: validateMinWordCount
// ============================================================================

describe("validateMinWordCount", () => {
  test("passes when word count meets minimum", () => {
    const result = validateMinWordCount("one two three", 3);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
  });

  test("passes when word count exceeds minimum", () => {
    const result = validateMinWordCount("one two three four five", 3);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(5);
  });

  test("fails when word count is below minimum", () => {
    const result = validateMinWordCount("one two", 3);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(2);
  });

  test("passes with minimum of 0", () => {
    const result = validateMinWordCount("", 0);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(0);
  });

  test("counts words across multiple lines", () => {
    const content = "line one\nline two\nline three";
    const result = validateMinWordCount(content, 6);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(6);
  });

  test("strips frontmatter before counting", () => {
    const content = `---
title: My Title
author: Someone
---
Hello world this is the content`;
    const result = validateMinWordCount(content, 6);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(6);
    // frontmatter words not counted
    const resultStrict = validateMinWordCount(content, 10);
    expect(resultStrict.valid).toBe(false);
  });

  test("handles empty content", () => {
    const result = validateMinWordCount("", 1);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(0);
  });

  test("handles whitespace-only content", () => {
    const result = validateMinWordCount("   \n   \t  ", 1);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(0);
  });
});

// ============================================================================
// Unit tests: validateMaxWordCount
// ============================================================================

describe("validateMaxWordCount", () => {
  test("passes when word count is within maximum", () => {
    const result = validateMaxWordCount("one two three", 5);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
  });

  test("passes when word count equals maximum", () => {
    const result = validateMaxWordCount("one two three", 3);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
  });

  test("fails when word count exceeds maximum", () => {
    const result = validateMaxWordCount("one two three four", 3);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(4);
  });

  test("passes with empty content and maximum 0", () => {
    const result = validateMaxWordCount("", 0);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(0);
  });

  test("strips frontmatter before counting", () => {
    const content = `---
title: My Title
---
one two three`;
    const result = validateMaxWordCount(content, 3);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
  });
});

// ============================================================================
// Unit tests: validateMinLineCount
// ============================================================================

describe("validateMinLineCount", () => {
  test("passes when line count meets minimum", () => {
    const result = validateMinLineCount("line1\nline2\nline3", 3);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
  });

  test("fails when line count is below minimum", () => {
    const result = validateMinLineCount("line1\nline2", 3);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(2);
  });

  test("passes with single line content", () => {
    const result = validateMinLineCount("just one line", 1);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(1);
  });

  test("returns 0 for empty content", () => {
    const result = validateMinLineCount("", 0);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(0);
  });

  test("fails for empty content with min > 0", () => {
    const result = validateMinLineCount("", 1);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(0);
  });

  test("counts blank lines", () => {
    const content = "line1\n\nline3\n";
    const result = validateMinLineCount(content, 4);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(4);
  });
});

// ============================================================================
// Unit tests: validateMaxLineCount
// ============================================================================

describe("validateMaxLineCount", () => {
  test("passes when line count is within maximum", () => {
    const result = validateMaxLineCount("line1\nline2", 5);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(2);
  });

  test("passes when line count equals maximum", () => {
    const result = validateMaxLineCount("line1\nline2\nline3", 3);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
  });

  test("fails when line count exceeds maximum", () => {
    const result = validateMaxLineCount("line1\nline2\nline3\nline4", 3);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(4);
  });

  test("passes with empty content and maximum 0", () => {
    const result = validateMaxLineCount("", 0);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(0);
  });
});

// ============================================================================
// runValidator integration: word/line count fields
// ============================================================================

describe("runValidator - minWordCount", () => {
  test("returns null when word count meets minimum", () => {
    const error = runValidator("one two three", { name: "wc", minWordCount: 3 });
    expect(error).toBeNull();
  });

  test("returns error when word count is too low", () => {
    const error = runValidator("one two", { name: "wc", minWordCount: 5 });
    expect(error).not.toBeNull();
    expect(error?.validator).toBe("wc");
    expect(error?.message).toContain("2 word(s)");
    expect(error?.message).toContain("at least 5");
  });
});

describe("runValidator - maxWordCount", () => {
  test("returns null when word count is within limit", () => {
    const error = runValidator("one two three", { name: "wc", maxWordCount: 10 });
    expect(error).toBeNull();
  });

  test("returns error when word count exceeds maximum", () => {
    const error = runValidator("one two three four five", { name: "wc", maxWordCount: 3 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("5 word(s)");
    expect(error?.message).toContain("maximum of 3");
  });
});

describe("runValidator - minLineCount", () => {
  test("returns null when line count meets minimum", () => {
    const error = runValidator("line1\nline2\nline3", { name: "lc", minLineCount: 3 });
    expect(error).toBeNull();
  });

  test("returns error when line count is too low", () => {
    const error = runValidator("line1\nline2", { name: "lc", minLineCount: 5 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("2 line(s)");
    expect(error?.message).toContain("at least 5");
  });
});

describe("runValidator - maxLineCount", () => {
  test("returns null when line count is within limit", () => {
    const error = runValidator("line1\nline2", { name: "lc", maxLineCount: 10 });
    expect(error).toBeNull();
  });

  test("returns error when line count exceeds maximum", () => {
    const error = runValidator("l1\nl2\nl3\nl4\nl5", { name: "lc", maxLineCount: 3 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("5 line(s)");
    expect(error?.message).toContain("maximum of 3");
  });
});

describe("runValidator - combined word/line count", () => {
  test("all pass when content is within all limits", () => {
    const content = "one two three\nfour five six";
    const error = runValidator(content, {
      name: "combined",
      minWordCount: 3,
      maxWordCount: 10,
      minLineCount: 2,
      maxLineCount: 5,
    });
    expect(error).toBeNull();
  });

  test("returns first failing check when multiple fail", () => {
    const error = runValidator("a", {
      name: "combined",
      minWordCount: 10,
      maxWordCount: 5, // also would fail, but minWordCount fails first
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("at least 10");
  });
});

describe("runValidators - word/line count", () => {
  test("collects errors from multiple validators", () => {
    const content = "just one line";
    const errors = runValidators(content, [
      { name: "min-words", minWordCount: 100 },
      { name: "max-lines", maxLineCount: 0 },
    ]);
    expect(errors.length).toBe(2);
    expect(errors[0].validator).toBe("min-words");
    expect(errors[1].validator).toBe("max-lines");
  });

  test("returns empty array when all validators pass", () => {
    const errors = runValidators("hello world\nbye world", [
      { name: "min-words", minWordCount: 2 },
      { name: "max-words", maxWordCount: 10 },
      { name: "min-lines", minLineCount: 2 },
      { name: "max-lines", maxLineCount: 5 },
    ]);
    expect(errors).toEqual([]);
  });
});

// ============================================================================
// Per-patch validation (applyPatches) integration
// ============================================================================

describe("per-patch minWordCount validation", () => {
  test("passes when patched content meets minimum word count", async () => {
    const result = await applyPatches("A placeholder for content", [
      {
        op: "replace" as const,
        old: "placeholder",
        new: "hello world this is some content",
        validate: { minWordCount: 5 },
      },
    ]);
    expect(result.validationErrors).toHaveLength(0);
  });

  test("reports validation error when patched content is below minimum word count", async () => {
    const result = await applyPatches("hello world", [
      {
        op: "replace" as const,
        old: "hello world",
        new: "hi",
        validate: { minWordCount: 10 },
      },
    ]);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.validationErrors[0]?.message).toContain("at least 10");
  });
});

describe("per-patch maxLineCount validation", () => {
  test("reports error when patched content exceeds max line count", async () => {
    const result = await applyPatches("short", [
      {
        op: "replace" as const,
        old: "short",
        new: "line1\nline2\nline3\nline4\nline5",
        validate: { maxLineCount: 3 },
      },
    ]);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.validationErrors[0]?.message).toContain("maximum of 3");
  });
});

// ============================================================================
// config-parser validation of new fields
// ============================================================================

describe("config-parser: global validator field validation", () => {
  test("accepts valid minWordCount", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      validators: [{ name: "wc", minWordCount: 100 }],
    };
    const result = validateConfig(config);
    expect(result.errors.filter((e) => e.field.includes("minWordCount"))).toHaveLength(0);
  });

  test("rejects non-integer minWordCount", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      validators: [{ name: "wc", minWordCount: "many" }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("minWordCount"))).toBe(true);
  });

  test("rejects negative maxWordCount", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      validators: [{ name: "wc", maxWordCount: -1 }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("maxWordCount"))).toBe(true);
  });

  test("accepts valid maxLineCount", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      validators: [{ name: "lc", maxLineCount: 200 }],
    };
    const result = validateConfig(config);
    expect(result.errors.filter((e) => e.field.includes("maxLineCount"))).toHaveLength(0);
  });

  test("rejects float minLineCount", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      validators: [{ name: "lc", minLineCount: 1.5 }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("minLineCount"))).toBe(true);
  });
});

describe("config-parser: per-patch validate field validation", () => {
  test("accepts valid minWordCount in validate block", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      patches: [{ op: "replace", old: "x", new: "y", validate: { minWordCount: 50 } }],
    };
    const result = validateConfig(config);
    expect(result.errors.filter((e) => e.field.includes("minWordCount"))).toHaveLength(0);
  });

  test("rejects string maxWordCount in validate block", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      patches: [{ op: "replace", old: "x", new: "y", validate: { maxWordCount: "lots" } }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("maxWordCount"))).toBe(true);
  });

  test("rejects negative maxLineCount in validate block", () => {
    const config = {
      apiVersion: "kustomark/v1",
      kind: "Kustomization",
      output: "out",
      resources: ["*.md"],
      patches: [{ op: "replace", old: "x", new: "y", validate: { maxLineCount: -5 } }],
    };
    const result = validateConfig(config);
    expect(result.errors.some((e) => e.field.includes("maxLineCount"))).toBe(true);
  });
});
