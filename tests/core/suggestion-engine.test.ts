/**
 * Tests for the suggestion engine
 */

import { describe, expect, test } from "bun:test";
import {
  calculateLevenshteinDistance,
  findSimilarStrings,
  generateSectionSuggestions,
  generateFrontmatterKeySuggestions,
  generatePatchSuggestions,
} from "../../src/core/suggestion-engine.js";
import type { PatchOperation } from "../../src/core/types.js";

describe("Suggestion Engine", () => {
  describe("calculateLevenshteinDistance", () => {
    test("identical strings have distance 0", () => {
      expect(calculateLevenshteinDistance("hello", "hello")).toBe(0);
    });

    test("empty string to non-empty has distance equal to length", () => {
      expect(calculateLevenshteinDistance("", "hello")).toBe(5);
      expect(calculateLevenshteinDistance("hello", "")).toBe(5);
    });

    test("single character difference", () => {
      expect(calculateLevenshteinDistance("hello", "hallo")).toBe(1);
    });

    test("insertion operation", () => {
      expect(calculateLevenshteinDistance("cat", "cats")).toBe(1);
    });

    test("deletion operation", () => {
      expect(calculateLevenshteinDistance("cats", "cat")).toBe(1);
    });

    test("substitution operation", () => {
      expect(calculateLevenshteinDistance("cat", "bat")).toBe(1);
    });

    test("multiple operations", () => {
      expect(calculateLevenshteinDistance("kitten", "sitting")).toBe(3);
    });

    test("completely different strings", () => {
      expect(calculateLevenshteinDistance("abc", "xyz")).toBe(3);
    });

    test("case sensitivity", () => {
      expect(calculateLevenshteinDistance("Hello", "hello")).toBe(1);
    });
  });

  describe("findSimilarStrings", () => {
    test("finds similar strings within default threshold", () => {
      const candidates = ["installation", "configuration", "introduction"];
      const result = findSimilarStrings("instalation", candidates);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.value).toBe("installation");
      expect(result[0]?.distance).toBe(1);
    });

    test("returns empty array when no similar strings found", () => {
      const candidates = ["foo", "bar", "baz"];
      const result = findSimilarStrings("completely-different-string", candidates);

      expect(result).toEqual([]);
    });

    test("sorts results by distance", () => {
      const candidates = ["installation", "instalation", "install"];
      const result = findSimilarStrings("instal", candidates);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.distance).toBeLessThanOrEqual(result[1]?.distance || Infinity);
    });

    test("limits results to 5 suggestions", () => {
      const candidates = Array.from({ length: 20 }, (_, i) => `item${i}`);
      const result = findSimilarStrings("item", candidates);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    test("respects custom maxDistance parameter", () => {
      const candidates = ["hello", "hallo", "hullo"];
      const result = findSimilarStrings("hello", candidates, 1);

      expect(result.every((r) => r.distance <= 1)).toBe(true);
    });

    test("excludes exact matches (distance 0)", () => {
      const candidates = ["hello", "hallo", "hello"];
      const result = findSimilarStrings("hello", candidates);

      expect(result.every((r) => r.distance > 0)).toBe(true);
    });

    test("handles case-insensitive matching", () => {
      const candidates = ["Installation", "Configuration"];
      const result = findSimilarStrings("instalation", candidates);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.value).toBe("Installation");
    });

    test("handles empty candidates array", () => {
      const result = findSimilarStrings("test", []);

      expect(result).toEqual([]);
    });

    test("alphabetically sorts when distances are equal", () => {
      const candidates = ["xyz", "abc"];
      const result = findSimilarStrings("def", candidates);

      if (result.length >= 2 && result[0]?.distance === result[1]?.distance) {
        expect(result[0]?.value).toBe("abc");
        expect(result[1]?.value).toBe("xyz");
      }
    });
  });

  describe("generateSectionSuggestions", () => {
    test("suggests similar section IDs for typos", () => {
      const content = `
# Installation

Some content

# Configuration

More content
`;
      const suggestions = generateSectionSuggestions("instalation", content);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("installation");
    });

    test("handles case differences", () => {
      const content = `
# Installation

Some content
`;
      const suggestions = generateSectionSuggestions("INSTALLATION", content);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("installation");
    });

    test("lists available sections when no similar ones found", () => {
      const content = `
# Introduction

# Getting Started

# Advanced Topics
`;
      const suggestions = generateSectionSuggestions("completely-different", content);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("Available sections:");
    });

    test("returns helpful message when no sections exist", () => {
      const content = "Just plain text with no sections";
      const suggestions = generateSectionSuggestions("anything", content);

      expect(suggestions).toEqual(["No sections found in the document"]);
    });

    test("handles custom section IDs", () => {
      const content = `
# Custom Section {#my-custom-id}

Content
`;
      const suggestions = generateSectionSuggestions("my-custom-i", content);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("my-custom-id");
    });

    test("suggests multiple similar sections", () => {
      const content = `
# Installation Guide

# Installation Steps

# Installation Troubleshooting
`;
      const suggestions = generateSectionSuggestions("instalation", content);

      // Should get at least one suggestion (possibly capped at 5)
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test("limits available sections list to 5 plus overflow", () => {
      const content = Array.from(
        { length: 10 },
        (_, i) => `# Section ${i}\n\nContent\n`,
      ).join("\n");
      const suggestions = generateSectionSuggestions("nonexistent", content);

      expect(suggestions[0]).toContain("... and");
    });
  });

  describe("generateFrontmatterKeySuggestions", () => {
    test("suggests similar frontmatter keys", () => {
      const frontmatter = {
        title: "My Document",
        author: "John Doe",
        date: "2024-01-01",
      };
      const suggestions = generateFrontmatterKeySuggestions("titel", frontmatter);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("title");
    });

    test("returns helpful message when no frontmatter exists", () => {
      const suggestions = generateFrontmatterKeySuggestions("anything", {});

      expect(suggestions).toEqual(["No frontmatter keys found in the document"]);
    });

    test("lists available keys when no similar ones found", () => {
      const frontmatter = {
        foo: "bar",
        baz: "qux",
      };
      const suggestions = generateFrontmatterKeySuggestions("completely-different", frontmatter);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("Available frontmatter keys:");
    });

    test("handles nested key paths", () => {
      const frontmatter = {
        metadata: { author: "John", date: "2024" },
      };
      const suggestions = generateFrontmatterKeySuggestions("metadat", frontmatter);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("metadata");
    });

    test("limits available keys list to 5 plus overflow", () => {
      const frontmatter = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`key${i}`, `value${i}`]),
      );
      const suggestions = generateFrontmatterKeySuggestions("nonexistent", frontmatter);

      expect(suggestions[0]).toContain("... and");
    });
  });

  describe("generatePatchSuggestions", () => {
    describe("section operations", () => {
      test("suggests similar sections for remove-section", () => {
        const patch: PatchOperation = {
          op: "remove-section",
          id: "instalation",
        };
        const content = `
# Installation

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("installation");
      });

      test("suggests similar sections for replace-section", () => {
        const patch: PatchOperation = {
          op: "replace-section",
          id: "configuraton",
          content: "new content",
        };
        const content = `
# Configuration

Old content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("configuration");
      });

      test("suggests similar sections for prepend-to-section", () => {
        const patch: PatchOperation = {
          op: "prepend-to-section",
          id: "introdution",
          content: "prepend this",
        };
        const content = `
# Introduction

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("introduction");
      });

      test("suggests similar sections for append-to-section", () => {
        const patch: PatchOperation = {
          op: "append-to-section",
          id: "getting-stared",
          content: "append this",
        };
        const content = `
# Getting Started

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("getting-started");
      });

      test("suggests similar sections for rename-header", () => {
        const patch: PatchOperation = {
          op: "rename-header",
          id: "troubleshoting",
          new: "FAQ",
        };
        const content = `
# Troubleshooting

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("troubleshooting");
      });

      test("suggests similar sections for move-section", () => {
        const patch: PatchOperation = {
          op: "move-section",
          id: "instalation",
          after: "introduction",
        };
        const content = `
# Introduction

# Installation

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("installation");
      });

      test("suggests similar sections for change-section-level", () => {
        const patch: PatchOperation = {
          op: "change-section-level",
          id: "sub-secion",
          delta: 1,
        };
        const content = `
# Sub Section

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("sub-section");
      });
    });

    describe("frontmatter operations", () => {
      test("suggests similar keys for remove-frontmatter", () => {
        const patch: PatchOperation = {
          op: "remove-frontmatter",
          key: "athour",
        };
        const content = `---
title: Test
author: John
---

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("author");
      });

      test("suggests similar keys for rename-frontmatter", () => {
        const patch: PatchOperation = {
          op: "rename-frontmatter",
          old: "titel",
          new: "heading",
        };
        const content = `---
title: Test
---

Content
`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("title");
      });
    });

    describe("string operations", () => {
      test("suggests case-insensitive match for replace", () => {
        const patch: PatchOperation = {
          op: "replace",
          old: "HELLO",
          new: "goodbye",
        };
        const content = "hello world";
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("different casing");
      });

      test("suggests pattern check for replace-regex", () => {
        const patch: PatchOperation = {
          op: "replace-regex",
          pattern: "[invalid",
          replacement: "test",
        };
        const content = "some content";
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("regex pattern");
      });
    });

    describe("marker operations", () => {
      test("identifies missing start marker for delete-between", () => {
        const patch: PatchOperation = {
          op: "delete-between",
          start: "<!-- START -->",
          end: "<!-- END -->",
        };
        const content = "content without markers";
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("Neither");
      });

      test("identifies missing end marker for replace-between", () => {
        const patch: PatchOperation = {
          op: "replace-between",
          start: "<!-- START -->",
          end: "<!-- END -->",
          content: "new content",
        };
        const content = "<!-- START -->\nsome content";
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("End marker");
      });
    });

    describe("line operations", () => {
      test("suggests similar lines for replace-line", () => {
        const patch: PatchOperation = {
          op: "replace-line",
          match: "import { foo } from 'bar'",
          replacement: "import { baz } from 'qux'",
        };
        const content = `import { foo } from 'bar';
export const test = 'value';`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
      });

      test("suggests similar lines for insert-after-line", () => {
        const patch: PatchOperation = {
          op: "insert-after-line",
          match: "console.log('test')",
          content: "console.log('inserted');",
        };
        const content = `console.log('test');
const x = 1;`;
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
      });

      test("suggests pattern check for insert-before-line with regex", () => {
        const patch: PatchOperation = {
          op: "insert-before-line",
          pattern: "^import",
          regex: true,
          content: "// imports below",
        };
        const content = "const x = 1;";
        const suggestions = generatePatchSuggestions(patch, content, "matched 0 times");

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toContain("regex pattern");
      });
    });

    test("returns empty array for non-zero-match errors", () => {
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };
      const suggestions = generatePatchSuggestions(patch, "content", "different error message");

      expect(suggestions).toEqual([]);
    });

    test("returns empty array for operations that always succeed", () => {
      const patch: PatchOperation = {
        op: "set-frontmatter",
        key: "title",
        value: "test",
      };
      const suggestions = generatePatchSuggestions(patch, "content", "matched 0 times");

      expect(suggestions).toEqual([]);
    });
  });
});
