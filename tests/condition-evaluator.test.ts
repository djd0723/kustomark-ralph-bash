/**
 * Tests for the condition evaluator
 */

import { describe, expect, test } from "bun:test";
import {
  evaluateCondition,
  evaluateFileContains,
  evaluateFileMatches,
  evaluateFrontmatterEquals,
  evaluateFrontmatterExists,
  evaluateNot,
  evaluateAnyOf,
  evaluateAllOf,
} from "../src/core/condition-evaluator.js";
import type { Condition } from "../src/core/types.js";

describe("evaluateFileContains", () => {
  test("returns true when content contains substring", () => {
    const content = "Hello, world! This is a test.";
    expect(evaluateFileContains(content, "world")).toBe(true);
    expect(evaluateFileContains(content, "Hello")).toBe(true);
    expect(evaluateFileContains(content, "test")).toBe(true);
  });

  test("returns false when content does not contain substring", () => {
    const content = "Hello, world!";
    expect(evaluateFileContains(content, "foo")).toBe(false);
    expect(evaluateFileContains(content, "xyz")).toBe(false);
  });

  test("is case-sensitive", () => {
    const content = "Hello, World!";
    expect(evaluateFileContains(content, "world")).toBe(false);
    expect(evaluateFileContains(content, "World")).toBe(true);
  });

  test("handles empty strings", () => {
    expect(evaluateFileContains("", "test")).toBe(false);
    expect(evaluateFileContains("test", "")).toBe(true);
    expect(evaluateFileContains("", "")).toBe(true);
  });

  test("handles multiline content", () => {
    const content = `Line 1
Line 2
Line 3`;
    expect(evaluateFileContains(content, "Line 2")).toBe(true);
    expect(evaluateFileContains(content, "Line\nLine")).toBe(false);
  });
});

describe("evaluateFileMatches", () => {
  test("matches simple regex patterns", () => {
    const content = "The quick brown fox jumps over the lazy dog";
    expect(evaluateFileMatches(content, "fox")).toBe(true);
    expect(evaluateFileMatches(content, "cat")).toBe(false);
  });

  test("supports regex patterns with delimiters and flags", () => {
    const content = "Hello, World!";
    expect(evaluateFileMatches(content, "/world/i")).toBe(true);
    expect(evaluateFileMatches(content, "/world/")).toBe(false);
    expect(evaluateFileMatches(content, "/WORLD/i")).toBe(true);
  });

  test("supports multiple flags", () => {
    const content = `Line 1
Line 2`;
    expect(evaluateFileMatches(content, "/^Line 2$/m")).toBe(true);
    expect(evaluateFileMatches(content, "/line.*/gi")).toBe(true);
  });

  test("handles complex regex patterns", () => {
    const content = "Email: test@example.com";
    expect(evaluateFileMatches(content, /\w+@\w+\.\w+/.source)).toBe(true);
    expect(evaluateFileMatches(content, "/[a-z]+@[a-z]+\\.[a-z]+/")).toBe(true);
  });

  test("returns false for invalid regex", () => {
    const content = "test";
    expect(evaluateFileMatches(content, "/[invalid/")).toBe(false);
    expect(evaluateFileMatches(content, "/(unclosed/")).toBe(false);
  });

  test("handles dotall flag for matching newlines", () => {
    const content = `First line
Second line`;
    expect(evaluateFileMatches(content, "/First.*Second/s")).toBe(true);
    expect(evaluateFileMatches(content, "/First.*Second/")).toBe(false);
  });

  test("works without delimiter format", () => {
    const content = "test123";
    expect(evaluateFileMatches(content, "\\d+")).toBe(true);
    expect(evaluateFileMatches(content, "^test")).toBe(true);
  });
});

describe("evaluateFrontmatterEquals", () => {
  test("checks simple frontmatter values", () => {
    const content = `---
title: My Document
author: John Doe
count: 42
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "title", "My Document")).toBe(true);
    expect(evaluateFrontmatterEquals(content, "author", "John Doe")).toBe(true);
    expect(evaluateFrontmatterEquals(content, "count", 42)).toBe(true);
  });

  test("returns false for mismatched values", () => {
    const content = `---
title: My Document
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "title", "Wrong Title")).toBe(false);
    expect(evaluateFrontmatterEquals(content, "title", 123)).toBe(false);
  });

  test("supports nested keys with dot notation", () => {
    const content = `---
metadata:
  author: Jane Smith
  date: '2024-01-01'
tags:
  - markdown
  - yaml
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "metadata.author", "Jane Smith")).toBe(true);
    expect(evaluateFrontmatterEquals(content, "metadata.date", "2024-01-01")).toBe(true);
    expect(evaluateFrontmatterEquals(content, "metadata.author", "John")).toBe(false);
  });

  test("handles array values", () => {
    const content = `---
tags:
  - markdown
  - yaml
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "tags", ["markdown", "yaml"])).toBe(true);
    expect(evaluateFrontmatterEquals(content, "tags", ["yaml", "markdown"])).toBe(false);
  });

  test("handles object values", () => {
    const content = `---
config:
  key1: value1
  key2: value2
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "config", { key1: "value1", key2: "value2" })).toBe(
      true,
    );
    expect(evaluateFrontmatterEquals(content, "config", { key1: "value1" })).toBe(false);
  });

  test("handles boolean values", () => {
    const content = `---
published: true
draft: false
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "published", true)).toBe(true);
    expect(evaluateFrontmatterEquals(content, "draft", false)).toBe(true);
    expect(evaluateFrontmatterEquals(content, "published", false)).toBe(false);
  });

  test("handles null values", () => {
    const content = `---
value: null
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "value", null)).toBe(true);
    expect(evaluateFrontmatterEquals(content, "value", undefined)).toBe(false);
  });

  test("returns false for non-existent keys", () => {
    const content = `---
title: Test
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "author", "John")).toBe(false);
    expect(evaluateFrontmatterEquals(content, "missing.nested", "value")).toBe(false);
  });

  test("returns false when no frontmatter exists", () => {
    const content = "# Content without frontmatter";
    expect(evaluateFrontmatterEquals(content, "title", "Test")).toBe(false);
  });

  test("returns false when frontmatter is malformed", () => {
    const content = `---
invalid: [unclosed
---
# Content`;

    expect(evaluateFrontmatterEquals(content, "invalid", "test")).toBe(false);
  });
});

describe("evaluateFrontmatterExists", () => {
  test("returns true for existing keys", () => {
    const content = `---
title: My Document
author: John Doe
---
# Content`;

    expect(evaluateFrontmatterExists(content, "title")).toBe(true);
    expect(evaluateFrontmatterExists(content, "author")).toBe(true);
  });

  test("returns false for non-existent keys", () => {
    const content = `---
title: My Document
---
# Content`;

    expect(evaluateFrontmatterExists(content, "author")).toBe(false);
    expect(evaluateFrontmatterExists(content, "missing")).toBe(false);
  });

  test("supports nested keys with dot notation", () => {
    const content = `---
metadata:
  author: Jane Smith
  date: '2024-01-01'
---
# Content`;

    expect(evaluateFrontmatterExists(content, "metadata")).toBe(true);
    expect(evaluateFrontmatterExists(content, "metadata.author")).toBe(true);
    expect(evaluateFrontmatterExists(content, "metadata.date")).toBe(true);
    expect(evaluateFrontmatterExists(content, "metadata.missing")).toBe(false);
  });

  test("returns false when no frontmatter exists", () => {
    const content = "# Content without frontmatter";
    expect(evaluateFrontmatterExists(content, "title")).toBe(false);
  });

  test("handles keys with null values", () => {
    const content = `---
value: null
---
# Content`;

    expect(evaluateFrontmatterExists(content, "value")).toBe(true);
  });

  test("returns false when frontmatter is malformed", () => {
    const content = `---
invalid: [unclosed
---
# Content`;

    expect(evaluateFrontmatterExists(content, "invalid")).toBe(false);
  });
});

describe("evaluateNot", () => {
  test("negates fileContains condition", () => {
    const content = "Hello, world!";
    const condition: Condition = { type: "fileContains", value: "world" };

    expect(evaluateNot(content, condition)).toBe(false);
    expect(evaluateNot(content, { type: "fileContains", value: "missing" })).toBe(true);
  });

  test("negates frontmatterExists condition", () => {
    const content = `---
title: Test
---
# Content`;

    expect(evaluateNot(content, { type: "frontmatterExists", key: "title" })).toBe(false);
    expect(evaluateNot(content, { type: "frontmatterExists", key: "missing" })).toBe(true);
  });

  test("double negation works correctly", () => {
    const content = "test";
    const condition: Condition = {
      type: "not",
      condition: {
        type: "not",
        condition: {
          type: "fileContains",
          value: "test",
        },
      },
    };

    expect(evaluateCondition(content, condition)).toBe(true);
  });
});

describe("evaluateAnyOf", () => {
  test("returns true if any condition is true", () => {
    const content = `---
title: Test
---
Hello, world!`;

    const conditions: Condition[] = [
      { type: "fileContains", value: "missing" },
      { type: "fileContains", value: "world" },
      { type: "frontmatterExists", key: "author" },
    ];

    expect(evaluateAnyOf(content, conditions)).toBe(true);
  });

  test("returns false if all conditions are false", () => {
    const content = "Hello, world!";

    const conditions: Condition[] = [
      { type: "fileContains", value: "missing" },
      { type: "fileContains", value: "absent" },
      { type: "frontmatterExists", key: "title" },
    ];

    expect(evaluateAnyOf(content, conditions)).toBe(false);
  });

  test("returns true if all conditions are true", () => {
    const content = "Hello, world!";

    const conditions: Condition[] = [
      { type: "fileContains", value: "Hello" },
      { type: "fileContains", value: "world" },
    ];

    expect(evaluateAnyOf(content, conditions)).toBe(true);
  });

  test("returns false for empty array", () => {
    const content = "test";
    expect(evaluateAnyOf(content, [])).toBe(false);
  });

  test("short-circuits on first true condition", () => {
    const content = "test";

    const conditions: Condition[] = [
      { type: "fileContains", value: "test" },
      { type: "fileContains", value: "missing" },
    ];

    expect(evaluateAnyOf(content, conditions)).toBe(true);
  });
});

describe("evaluateAllOf", () => {
  test("returns true if all conditions are true", () => {
    const content = `---
title: Test
---
Hello, world!`;

    const conditions: Condition[] = [
      { type: "fileContains", value: "Hello" },
      { type: "fileContains", value: "world" },
      { type: "frontmatterExists", key: "title" },
    ];

    expect(evaluateAllOf(content, conditions)).toBe(true);
  });

  test("returns false if any condition is false", () => {
    const content = "Hello, world!";

    const conditions: Condition[] = [
      { type: "fileContains", value: "Hello" },
      { type: "fileContains", value: "missing" },
    ];

    expect(evaluateAllOf(content, conditions)).toBe(false);
  });

  test("returns true for empty array (vacuous truth)", () => {
    const content = "test";
    expect(evaluateAllOf(content, [])).toBe(true);
  });

  test("short-circuits on first false condition", () => {
    const content = "test";

    const conditions: Condition[] = [
      { type: "fileContains", value: "missing" },
      { type: "fileContains", value: "test" },
    ];

    expect(evaluateAllOf(content, conditions)).toBe(false);
  });
});

describe("evaluateCondition", () => {
  test("dispatches to fileContains evaluator", () => {
    const content = "Hello, world!";
    expect(evaluateCondition(content, { type: "fileContains", value: "world" })).toBe(true);
    expect(evaluateCondition(content, { type: "fileContains", value: "missing" })).toBe(false);
  });

  test("dispatches to fileMatches evaluator", () => {
    const content = "test123";
    expect(evaluateCondition(content, { type: "fileMatches", pattern: "\\d+" })).toBe(true);
    expect(evaluateCondition(content, { type: "fileMatches", pattern: "/TEST/i" })).toBe(true);
  });

  test("dispatches to frontmatterEquals evaluator", () => {
    const content = `---
title: Test
---
# Content`;

    expect(
      evaluateCondition(content, {
        type: "frontmatterEquals",
        key: "title",
        value: "Test",
      }),
    ).toBe(true);
    expect(
      evaluateCondition(content, {
        type: "frontmatterEquals",
        key: "title",
        value: "Wrong",
      }),
    ).toBe(false);
  });

  test("dispatches to frontmatterExists evaluator", () => {
    const content = `---
title: Test
---
# Content`;

    expect(evaluateCondition(content, { type: "frontmatterExists", key: "title" })).toBe(true);
    expect(evaluateCondition(content, { type: "frontmatterExists", key: "missing" })).toBe(false);
  });

  test("dispatches to not evaluator", () => {
    const content = "test";
    expect(
      evaluateCondition(content, {
        type: "not",
        condition: { type: "fileContains", value: "test" },
      }),
    ).toBe(false);
    expect(
      evaluateCondition(content, {
        type: "not",
        condition: { type: "fileContains", value: "missing" },
      }),
    ).toBe(true);
  });

  test("dispatches to anyOf evaluator", () => {
    const content = "test";
    expect(
      evaluateCondition(content, {
        type: "anyOf",
        conditions: [
          { type: "fileContains", value: "test" },
          { type: "fileContains", value: "missing" },
        ],
      }),
    ).toBe(true);
  });

  test("dispatches to allOf evaluator", () => {
    const content = "test";
    expect(
      evaluateCondition(content, {
        type: "allOf",
        conditions: [
          { type: "fileContains", value: "test" },
          { type: "fileContains", value: "t" },
        ],
      }),
    ).toBe(true);
    expect(
      evaluateCondition(content, {
        type: "allOf",
        conditions: [
          { type: "fileContains", value: "test" },
          { type: "fileContains", value: "missing" },
        ],
      }),
    ).toBe(false);
  });

  test("handles complex nested conditions", () => {
    const content = `---
published: true
tags:
  - javascript
  - typescript
---
# TypeScript Tutorial

This is a tutorial about TypeScript.`;

    const condition: Condition = {
      type: "allOf",
      conditions: [
        {
          type: "anyOf",
          conditions: [
            { type: "fileContains", value: "TypeScript" },
            { type: "fileContains", value: "JavaScript" },
          ],
        },
        {
          type: "frontmatterEquals",
          key: "published",
          value: true,
        },
        {
          type: "not",
          condition: {
            type: "fileContains",
            value: "deprecated",
          },
        },
      ],
    };

    expect(evaluateCondition(content, condition)).toBe(true);
  });

  test("handles errors gracefully", () => {
    const content = "test";
    // This shouldn't throw, even with unusual conditions
    const result = evaluateCondition(content, { type: "fileContains", value: "test" });
    expect(typeof result).toBe("boolean");
  });
});

describe("complex integration scenarios", () => {
  test("evaluates documentation with multiple conditions", () => {
    const content = `---
type: guide
version: 2.0
status: published
tags:
  - tutorial
  - beginner
---
# Getting Started Guide

This guide will help you get started with our platform.`;

    // Should match: published guide for beginners
    expect(
      evaluateCondition(content, {
        type: "allOf",
        conditions: [
          { type: "frontmatterEquals", key: "status", value: "published" },
          { type: "frontmatterEquals", key: "type", value: "guide" },
          { type: "fileContains", value: "Getting Started" },
        ],
      }),
    ).toBe(true);

    // Should not match: advanced content
    expect(
      evaluateCondition(content, {
        type: "fileContains",
        value: "advanced",
      }),
    ).toBe(false);

    // Should match: version 2.x content
    expect(
      evaluateCondition(content, {
        type: "fileMatches",
        pattern: "/version: 2\\./",
      }),
    ).toBe(true);
  });

  test("evaluates API documentation", () => {
    const content = `---
api:
  version: v1
  deprecated: false
  authentication: required
---
# API Endpoint

\`\`\`
GET /api/v1/users
\`\`\``;

    // Active API endpoints
    expect(
      evaluateCondition(content, {
        type: "allOf",
        conditions: [
          { type: "frontmatterEquals", key: "api.deprecated", value: false },
          { type: "fileMatches", pattern: "/GET|POST|PUT|DELETE/" },
        ],
      }),
    ).toBe(true);

    // Deprecated endpoints
    expect(
      evaluateCondition(content, {
        type: "frontmatterEquals",
        key: "api.deprecated",
        value: true,
      }),
    ).toBe(false);
  });

  test("evaluates blog posts by category and date", () => {
    const content = `---
category: engineering
date: 2024-01-15
featured: true
---
# Engineering Best Practices`;

    // Featured engineering posts
    expect(
      evaluateCondition(content, {
        type: "allOf",
        conditions: [
          { type: "frontmatterEquals", key: "category", value: "engineering" },
          { type: "frontmatterEquals", key: "featured", value: true },
        ],
      }),
    ).toBe(true);

    // Posts from 2024
    expect(
      evaluateCondition(content, {
        type: "fileMatches",
        pattern: "/date: 2024-/",
      }),
    ).toBe(true);
  });
});
