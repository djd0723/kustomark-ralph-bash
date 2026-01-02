import { describe, expect, test } from "bun:test";
import { analyzeDiff, scorePatches, suggestPatches } from "../../src/core/patch-suggester.js";

describe("patch-suggester", () => {
  describe("analyzeDiff", () => {
    test("detects added lines", () => {
      const source = "Line 1\nLine 2";
      const target = "Line 1\nLine 2\nLine 3";

      const analysis = analyzeDiff(source, target);

      expect(analysis.addedLines.length).toBeGreaterThan(0);
      expect(analysis.addedLines.some((l) => l.content === "Line 3")).toBe(true);
    });

    test("detects removed lines", () => {
      const source = "Line 1\nLine 2\nLine 3";
      const target = "Line 1\nLine 2";

      const analysis = analyzeDiff(source, target);

      expect(analysis.removedLines.length).toBeGreaterThan(0);
      expect(analysis.removedLines.some((l) => l.content === "Line 3")).toBe(true);
    });

    test("detects frontmatter changes", () => {
      const source = "---\ntitle: Old Title\nauthor: John\n---\nContent";
      const target = "---\ntitle: New Title\nauthor: John\ndate: 2024-01-01\n---\nContent";

      const analysis = analyzeDiff(source, target);

      expect(analysis.hasFrontmatter).toBe(true);
      expect(analysis.frontmatterChanges.modified).toHaveProperty("title");
      expect(analysis.frontmatterChanges.added).toHaveProperty("date");
    });

    test("detects section removal", () => {
      const source = "# Header 1\nContent\n## Header 2\nMore content";
      const target = "# Header 1\nContent";

      const analysis = analyzeDiff(source, target);

      expect(analysis.sectionChanges.length).toBeGreaterThan(0);
      expect(analysis.sectionChanges.some((c) => c.type === "removed")).toBe(true);
    });

    test("detects header rename", () => {
      const source = "# Old Header\nContent";
      const target = "# New Header\nContent";

      const analysis = analyzeDiff(source, target);

      expect(analysis.sectionChanges.length).toBeGreaterThan(0);
      expect(analysis.sectionChanges.some((c) => c.type === "renamed")).toBe(true);
    });
  });

  describe("suggestPatches", () => {
    test("suggests frontmatter patches for added fields", () => {
      const source = "---\ntitle: Test\n---\nContent";
      const target = "---\ntitle: Test\nauthor: John\n---\nContent";

      const patches = suggestPatches(source, target);

      const frontmatterPatch = patches.find((p) => p.op === "set-frontmatter");
      expect(frontmatterPatch).toBeDefined();
      if (frontmatterPatch?.op === "set-frontmatter") {
        expect(frontmatterPatch.key).toBe("author");
        expect(frontmatterPatch.value).toBe("John");
      }
    });

    test("suggests frontmatter removal patches", () => {
      const source = "---\ntitle: Test\nauthor: John\n---\nContent";
      const target = "---\ntitle: Test\n---\nContent";

      const patches = suggestPatches(source, target);

      const removePatch = patches.find((p) => p.op === "remove-frontmatter");
      expect(removePatch).toBeDefined();
      if (removePatch?.op === "remove-frontmatter") {
        expect(removePatch.key).toBe("author");
      }
    });

    test("suggests section removal patches", () => {
      const source = "# Header 1\nContent\n## Subheader\nMore content";
      const target = "# Header 1\nContent";

      const patches = suggestPatches(source, target);

      const removePatch = patches.find((p) => p.op === "remove-section");
      expect(removePatch).toBeDefined();
    });

    test("suggests rename-header patches", () => {
      const source = "# Old Header\nContent";
      const target = "# New Header\nContent";

      const patches = suggestPatches(source, target);

      const renamePatch = patches.find((p) => p.op === "rename-header");
      expect(renamePatch).toBeDefined();
      if (renamePatch?.op === "rename-header") {
        expect(renamePatch.new).toBe("New Header");
      }
    });

    test("suggests replace patches for repeated changes", () => {
      const source = "foo bar foo bar foo";
      const target = "baz bar baz bar baz";

      const patches = suggestPatches(source, target);

      const replacePatch = patches.find((p) => p.op === "replace");
      expect(replacePatch).toBeDefined();
      if (replacePatch?.op === "replace") {
        expect(replacePatch.old).toBe("foo");
        expect(replacePatch.new).toBe("baz");
      }
    });

    test("suggests replace-section patches for modified sections", () => {
      const source = "## Introduction\nOld intro text\n## Next Section\nContent";
      const target = "## Introduction\nNew intro text\n## Next Section\nContent";

      const patches = suggestPatches(source, target);

      const replaceSectionPatch = patches.find((p) => p.op === "replace-section");
      expect(replaceSectionPatch).toBeDefined();
    });
  });

  describe("scorePatches", () => {
    test("assigns higher scores to frontmatter operations", () => {
      const source = "---\ntitle: Test\n---\nContent";
      const target = "---\ntitle: Test\nauthor: John\n---\nContent";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const frontmatterPatch = scored.find((s) => s.patch.op === "set-frontmatter");
      expect(frontmatterPatch).toBeDefined();
      expect(frontmatterPatch!.score).toBeGreaterThan(0.9);
    });

    test("assigns higher scores to section operations", () => {
      const source = "# Header 1\nContent\n## Subheader\nMore";
      const target = "# Header 1\nContent";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const sectionPatch = scored.find((s) => s.patch.op === "remove-section");
      expect(sectionPatch).toBeDefined();
      expect(sectionPatch!.score).toBeGreaterThan(0.8);
    });

    test("assigns higher scores to frequent replacements", () => {
      const source = "foo bar foo bar foo bar";
      const target = "baz bar baz bar baz bar";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const replacePatch = scored.find((s) => s.patch.op === "replace");
      if (replacePatch) {
        expect(replacePatch.score).toBeGreaterThan(0.7);
      }
    });

    test("provides human-readable descriptions", () => {
      const source = "---\ntitle: Test\n---\nContent";
      const target = "---\ntitle: Test\nauthor: John\n---\nContent";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      expect(scored.length).toBeGreaterThan(0);
      for (const scoredPatch of scored) {
        expect(scoredPatch.description).toBeTruthy();
        expect(typeof scoredPatch.description).toBe("string");
      }
    });

    test("sorts patches by score (highest first)", () => {
      const source = "---\ntitle: Old\n---\n# Header\nfoo bar foo";
      const target = "---\ntitle: New\n---\n# New Header\nbaz bar baz";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      // Verify scores are in descending order
      for (let i = 1; i < scored.length; i++) {
        const prev = scored[i - 1];
        const curr = scored[i];
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    });
  });

  describe("complex scenarios", () => {
    test("handles multiple types of changes simultaneously", () => {
      const source = `---
title: Original Document
version: 1.0.0
---

# Introduction

This is the original introduction.

## Features

- Feature A
- Feature B

## Conclusion

Original conclusion.`;

      const target = `---
title: Updated Document
version: 2.0.0
author: Jane Doe
---

# Introduction

This is the updated introduction.

## Features

- Feature A
- Feature B
- Feature C

## Summary

Updated summary.`;

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      // Should suggest various types of patches
      expect(patches.some((p) => p.op === "set-frontmatter")).toBe(true);
      expect(patches.some((p) => p.op === "remove-section" || p.op === "rename-header")).toBe(
        true,
      );

      // All patches should have scores
      expect(scored.length).toBe(patches.length);
      expect(scored.every((s) => s.score > 0 && s.score <= 1)).toBe(true);
    });
  });
});
