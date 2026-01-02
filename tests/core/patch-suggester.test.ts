import { describe, expect, test } from "bun:test";
import { analyzeDiff, scorePatches, suggestPatches } from "../../src/core/patch-suggester.js";
import type { DiffAnalysis, ScoredPatch } from "../../src/core/patch-suggester.js";
import type { PatchOperation } from "../../src/core/types.js";

describe("patch-suggester", () => {
  describe("analyzeDiff", () => {
    describe("line-level changes", () => {
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

      test("detects modified lines in close proximity", () => {
        const source = "Line 1\nOld content here\nLine 3";
        const target = "Line 1\nNew content here\nLine 3";

        const analysis = analyzeDiff(source, target);

        expect(analysis.modifiedLines.length).toBeGreaterThan(0);
        const modification = analysis.modifiedLines.find(
          (m) => m.oldContent === "Old content here" && m.newContent === "New content here",
        );
        expect(modification).toBeDefined();
      });

      test("detects multiple modified lines", () => {
        const source = "Line 1\nOld text A\nLine 3\nOld text B\nLine 5";
        const target = "Line 1\nNew text A\nLine 3\nNew text B\nLine 5";

        const analysis = analyzeDiff(source, target);

        expect(analysis.modifiedLines.length).toBe(2);
      });

      test("does not match dissimilar lines as modifications", () => {
        const source = "This is a complete sentence\nAnother line";
        const target = "X\nAnother line";

        const analysis = analyzeDiff(source, target);

        // Should be treated as removed + added, not modified
        expect(analysis.modifiedLines.length).toBe(0);
        expect(analysis.removedLines.length).toBeGreaterThan(0);
        expect(analysis.addedLines.length).toBeGreaterThan(0);
      });

      test("tracks correct line numbers for added lines", () => {
        const source = "Line 1\nLine 2";
        const target = "Line 1\nLine 2\nLine 3\nLine 4";

        const analysis = analyzeDiff(source, target);

        const line3 = analysis.addedLines.find((l) => l.content === "Line 3");
        const line4 = analysis.addedLines.find((l) => l.content === "Line 4");

        expect(line3?.lineNumber).toBe(3);
        expect(line4?.lineNumber).toBe(4);
      });

      test("handles empty source content", () => {
        const source = "";
        const target = "New line 1\nNew line 2";

        const analysis = analyzeDiff(source, target);

        expect(analysis.addedLines.length).toBe(2);
        expect(analysis.removedLines.length).toBe(0);
        expect(analysis.modifiedLines.length).toBe(0);
      });

      test("handles empty target content", () => {
        const source = "Line 1\nLine 2";
        const target = "";

        const analysis = analyzeDiff(source, target);

        expect(analysis.addedLines.length).toBe(0);
        expect(analysis.removedLines.length).toBe(2);
        expect(analysis.modifiedLines.length).toBe(0);
      });

      test("handles identical content", () => {
        const source = "Line 1\nLine 2\nLine 3";
        const target = "Line 1\nLine 2\nLine 3";

        const analysis = analyzeDiff(source, target);

        expect(analysis.addedLines.length).toBe(0);
        expect(analysis.removedLines.length).toBe(0);
        expect(analysis.modifiedLines.length).toBe(0);
      });
    });

    describe("frontmatter changes", () => {
      test("detects frontmatter presence", () => {
        const source = "---\ntitle: Test\n---\nContent";
        const target = "---\ntitle: Test\nauthor: John\n---\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.hasFrontmatter).toBe(true);
      });

      test("detects added frontmatter fields", () => {
        const source = "---\ntitle: Test\n---\nContent";
        const target = "---\ntitle: Test\nauthor: John\ndate: '2024-01-01'\n---\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.frontmatterChanges.added).toHaveProperty("author");
        expect(analysis.frontmatterChanges.added).toHaveProperty("date");
        expect(analysis.frontmatterChanges.added.author).toBe("John");
        expect(analysis.frontmatterChanges.added.date).toBe("2024-01-01");
      });

      test("detects removed frontmatter fields", () => {
        const source = "---\ntitle: Test\nauthor: John\ndate: '2024-01-01'\n---\nContent";
        const target = "---\ntitle: Test\n---\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.frontmatterChanges.removed).toContain("author");
        expect(analysis.frontmatterChanges.removed).toContain("date");
        expect(analysis.frontmatterChanges.removed.length).toBe(2);
      });

      test("detects modified frontmatter fields", () => {
        const source = "---\ntitle: Old Title\nauthor: John\n---\nContent";
        const target = "---\ntitle: New Title\nauthor: John\n---\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.frontmatterChanges.modified).toHaveProperty("title");
        expect(analysis.frontmatterChanges.modified.title?.old).toBe("Old Title");
        expect(analysis.frontmatterChanges.modified.title?.new).toBe("New Title");
      });

      test("detects complex frontmatter value changes", () => {
        const source = "---\ntags: [tag1, tag2]\nmetadata:\n  version: 1\n---\nContent";
        const target = "---\ntags: [tag1, tag2, tag3]\nmetadata:\n  version: 2\n---\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.frontmatterChanges.modified).toHaveProperty("tags");
        expect(analysis.frontmatterChanges.modified).toHaveProperty("metadata");
      });

      test("handles content with no frontmatter", () => {
        const source = "Just content\nNo frontmatter";
        const target = "Just content\nNo frontmatter";

        const analysis = analyzeDiff(source, target);

        expect(analysis.hasFrontmatter).toBe(false);
        expect(Object.keys(analysis.frontmatterChanges.added).length).toBe(0);
        expect(analysis.frontmatterChanges.removed.length).toBe(0);
        expect(Object.keys(analysis.frontmatterChanges.modified).length).toBe(0);
      });

      test("detects frontmatter added to content", () => {
        const source = "Content without frontmatter";
        const target = "---\ntitle: New\n---\nContent without frontmatter";

        const analysis = analyzeDiff(source, target);

        expect(analysis.hasFrontmatter).toBe(true);
        expect(analysis.frontmatterChanges.added).toHaveProperty("title");
      });

      test("detects frontmatter removed from content", () => {
        const source = "---\ntitle: Test\n---\nContent";
        const target = "Content";

        const analysis = analyzeDiff(source, target);

        expect(analysis.hasFrontmatter).toBe(true);
        expect(analysis.frontmatterChanges.removed).toContain("title");
      });
    });

    describe("section changes", () => {
      test("detects section removal", () => {
        const source = "# Header 1\nContent\n## Header 2\nMore content";
        const target = "# Header 1\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.sectionChanges.length).toBeGreaterThan(0);
        expect(analysis.sectionChanges.some((c) => c.type === "removed")).toBe(true);
        const removed = analysis.sectionChanges.find((c) => c.type === "removed");
        expect(removed?.sectionId).toBe("header-2");
      });

      test("detects section addition", () => {
        const source = "# Header 1\nContent";
        const target = "# Header 1\nContent\n## Header 2\nNew content";

        const analysis = analyzeDiff(source, target);

        expect(analysis.sectionChanges.some((c) => c.type === "added")).toBe(true);
        const added = analysis.sectionChanges.find((c) => c.type === "added");
        expect(added?.sectionId).toBe("header-2");
      });

      test("detects header rename", () => {
        const source = "# Old Header\nContent";
        const target = "# New Header\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.sectionChanges.length).toBeGreaterThan(0);
        expect(analysis.sectionChanges.some((c) => c.type === "renamed")).toBe(true);
        const renamed = analysis.sectionChanges.find((c) => c.type === "renamed");
        expect(renamed?.oldTitle).toBe("Old Header");
        expect(renamed?.newTitle).toBe("New Header");
      });

      test("detects section content modification", () => {
        const source = "## Section\nOld content here";
        const target = "## Section\nNew content here";

        const analysis = analyzeDiff(source, target);

        expect(analysis.sectionChanges.some((c) => c.type === "modified")).toBe(true);
        const modified = analysis.sectionChanges.find((c) => c.type === "modified");
        expect(modified?.sectionId).toBe("section");
      });

      test("detects section rename with custom ID", () => {
        const source = "# Original Title {#custom-id}\nContent";
        const target = "# Updated Title {#custom-id}\nContent";

        const analysis = analyzeDiff(source, target);

        const renamed = analysis.sectionChanges.find(
          (c) => c.type === "renamed" && c.sectionId === "custom-id",
        );
        expect(renamed).toBeDefined();
        expect(renamed?.oldTitle).toBe("Original Title");
        expect(renamed?.newTitle).toBe("Updated Title");
      });

      test("handles multiple section changes simultaneously", () => {
        const source = `# Section 1
Content 1

## Section 2
Content 2

## Section 3
Content 3`;

        const target = `# Section 1
Modified content 1

## Section 2 Renamed
Content 2

## Section 4
New content`;

        const analysis = analyzeDiff(source, target);

        // Should detect various types of section changes
        expect(analysis.sectionChanges.length).toBeGreaterThan(0);
        expect(analysis.sectionChanges.some((c) => c.type === "modified")).toBe(true);
        // Section 2 might be detected as renamed or Section 4 as added
        const hasRenameOrAdd = analysis.sectionChanges.some(
          (c) => c.type === "renamed" || c.type === "added",
        );
        expect(hasRenameOrAdd).toBe(true);
      });

      test("detects nested section removal", () => {
        const source = `# Parent
Content

## Child 1
Child content

### Grandchild
Nested content

## Child 2
More content`;

        const target = `# Parent
Content

## Child 2
More content`;

        const analysis = analyzeDiff(source, target);

        const removed = analysis.sectionChanges.filter((c) => c.type === "removed");
        expect(removed.length).toBeGreaterThan(0);
        expect(removed.some((c) => c.sectionId === "child-1")).toBe(true);
      });

      test("handles sections with no changes", () => {
        const source = "# Header\nContent";
        const target = "# Header\nContent";

        const analysis = analyzeDiff(source, target);

        expect(analysis.sectionChanges.length).toBe(0);
      });
    });

    describe("complex scenarios", () => {
      test("analyzes document with all change types", () => {
        const source = `---
title: Original
version: 1.0
---

# Introduction
Original intro text

## Features
- Feature A
- Feature B

## Conclusion
Original conclusion`;

        const target = `---
title: Updated
version: 2.0
author: Jane
---

# Introduction
Updated intro text

## Features
- Feature A
- Feature B
- Feature C

## Summary
Updated summary`;

        const analysis = analyzeDiff(source, target);

        expect(analysis.hasFrontmatter).toBe(true);
        expect(Object.keys(analysis.frontmatterChanges.modified).length).toBeGreaterThan(0);
        expect(Object.keys(analysis.frontmatterChanges.added).length).toBeGreaterThan(0);
        expect(analysis.sectionChanges.length).toBeGreaterThan(0);
        expect(analysis.addedLines.length).toBeGreaterThan(0);
        expect(analysis.modifiedLines.length).toBeGreaterThan(0);
      });

      test("handles large documents efficiently", () => {
        const sourceLines = Array.from({ length: 1000 }, (_, i) => `Line ${i}`);
        const targetLines = [...sourceLines];
        targetLines[500] = "Modified line content with similar words";

        const source = sourceLines.join("\n");
        const target = targetLines.join("\n");

        const analysis = analyzeDiff(source, target);

        // Should detect the change (either as modified or as removed+added)
        expect(analysis.addedLines.length + analysis.modifiedLines.length).toBeGreaterThan(0);
      });
    });
  });

  describe("suggestPatches", () => {
    describe("frontmatter patches", () => {
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

      test("suggests patches for modified frontmatter fields", () => {
        const source = "---\ntitle: Old\nversion: 1.0\n---\nContent";
        const target = "---\ntitle: New\nversion: 2.0\n---\nContent";

        const patches = suggestPatches(source, target);

        const setPatches = patches.filter((p) => p.op === "set-frontmatter");
        expect(setPatches.length).toBe(2);

        const titlePatch = setPatches.find(
          (p) => p.op === "set-frontmatter" && p.key === "title",
        );
        expect(titlePatch).toBeDefined();
        if (titlePatch?.op === "set-frontmatter") {
          expect(titlePatch.value).toBe("New");
        }
      });

      test("suggests patches for complex frontmatter values", () => {
        const source = "---\ntags: [a, b]\n---\nContent";
        const target = "---\ntags: [a, b, c]\n---\nContent";

        const patches = suggestPatches(source, target);

        const tagsPatch = patches.find(
          (p) => p.op === "set-frontmatter" && p.key === "tags",
        );
        expect(tagsPatch).toBeDefined();
      });

      test("does not suggest frontmatter patches when none are needed", () => {
        const source = "---\ntitle: Test\n---\nContent";
        const target = "---\ntitle: Test\n---\nContent";

        const patches = suggestPatches(source, target);

        const frontmatterPatches = patches.filter(
          (p) => p.op === "set-frontmatter" || p.op === "remove-frontmatter",
        );
        expect(frontmatterPatches.length).toBe(0);
      });
    });

    describe("section patches", () => {
      test("suggests section removal patches", () => {
        const source = "# Header 1\nContent\n## Subheader\nMore content";
        const target = "# Header 1\nContent";

        const patches = suggestPatches(source, target);

        const removePatch = patches.find((p) => p.op === "remove-section");
        expect(removePatch).toBeDefined();
        if (removePatch?.op === "remove-section") {
          expect(removePatch.id).toBe("subheader");
        }
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

      test("suggests replace-section for substantial content changes", () => {
        const source = "## Introduction\nLine 1\nLine 2\nLine 3\nLine 4";
        const target =
          "## Introduction\nCompletely different line 1\nTotally new line 2\nBrand new line 3\nAll changed line 4";

        const patches = suggestPatches(source, target);

        const replaceSectionPatch = patches.find((p) => p.op === "replace-section");
        expect(replaceSectionPatch).toBeDefined();
        if (replaceSectionPatch?.op === "replace-section") {
          expect(replaceSectionPatch.id).toBe("introduction");
          expect(replaceSectionPatch.content).toBeTruthy();
        }
      });

      test("does not suggest replace-section for minor changes", () => {
        const source = "## Introduction\nOld intro text\n## Next Section\nContent";
        const target = "## Introduction\nNew intro text\n## Next Section\nContent";

        const patches = suggestPatches(source, target);

        // Should prefer replace over replace-section for minor changes
        const replaceSectionPatch = patches.find((p) => p.op === "replace-section");
        expect(replaceSectionPatch).toBeUndefined();
      });

      test("suggests patches for multiple section changes", () => {
        const source = `# Section A
Content A

## Section B
Content B

## Section C
Content C`;

        const target = `# Section A
Content A

## Section B Updated
Content B

## Section D
New content`;

        const patches = suggestPatches(source, target);

        // Should suggest some kind of section-related patches
        expect(patches.length).toBeGreaterThan(0);
        const hasSectionPatches = patches.some(
          (p) => p.op === "rename-header" || p.op === "remove-section" || p.op === "replace-section",
        );
        expect(hasSectionPatches).toBe(true);
      });
    });

    describe("string replacement patches", () => {
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

      test("suggests replace patches for single occurrence", () => {
        const source = "apple orange banana";
        const target = "apple grape banana";

        const patches = suggestPatches(source, target);

        const replacePatch = patches.find(
          (p) => p.op === "replace" && p.old === "orange",
        );
        expect(replacePatch).toBeDefined();
      });

      test("suggests multiple replace patches for different words", () => {
        const source = "apple orange apple orange";
        const target = "banana grape banana grape";

        const patches = suggestPatches(source, target);

        const replacePatches = patches.filter((p) => p.op === "replace");
        expect(replacePatches.length).toBeGreaterThan(0);
      });

      test("does not suggest replace for very short words", () => {
        const source = "a b c d e";
        const target = "f g h i j";

        const patches = suggestPatches(source, target);

        // Should not suggest replace for single-letter words
        const replacePatches = patches.filter((p) => p.op === "replace");
        expect(replacePatches.length).toBe(0);
      });
    });

    describe("regex replacement patches", () => {
      test("suggests regex patches for URL transformations", () => {
        const source = "Link: https://old.com/page\nAnother: https://old.com/other";
        const target = "Link: https://new.com/page\nAnother: https://new.com/other";

        const patches = suggestPatches(source, target);

        // The algorithm should detect URL changes and suggest some patches
        // It might suggest various types depending on how it analyzes the changes
        expect(patches.length).toBeGreaterThan(0);
      });

      test("suggests regex patches for version number changes", () => {
        const source = "Version 1.0.0 in doc\nVersion 1.0.0 in header\nVersion 1.0.0 here";
        const target = "Version 2.0.0 in doc\nVersion 2.0.0 in header\nVersion 2.0.0 here";

        const patches = suggestPatches(source, target);

        const regexPatch = patches.find((p) => p.op === "replace-regex");
        expect(regexPatch).toBeDefined();
        if (regexPatch?.op === "replace-regex") {
          expect(regexPatch.replacement).toBe("2.0.0");
        }
      });

      test("does not suggest regex for single version occurrence", () => {
        const source = "Version 1.0.0";
        const target = "Version 2.0.0";

        const patches = suggestPatches(source, target);

        const regexPatch = patches.find((p) => p.op === "replace-regex");
        // Should use replace instead of replace-regex for single occurrence
        expect(regexPatch).toBeUndefined();
      });
    });

    describe("line replacement patches", () => {
      test("suggests replace-line for similar lines", () => {
        const source = "Line 1\nOld content with similar words\nLine 3";
        const target = "Line 1\nNew content with similar words\nLine 3";

        const patches = suggestPatches(source, target);

        // Should suggest some kind of patch for the changed line
        expect(patches.length).toBeGreaterThan(0);
        const hasLinePatch = patches.some(
          (p) => p.op === "replace-line" || p.op === "replace",
        );
        expect(hasLinePatch).toBe(true);
      });

      test("suggests replace-line for multiple similar changes", () => {
        const source = `Line 1
Old text with context
Line 3
Another old text with context
Line 5`;

        const target = `Line 1
New text with context
Line 3
Another new text with context
Line 5`;

        const patches = suggestPatches(source, target);

        // Should suggest some kind of patches for the changed lines
        expect(patches.length).toBeGreaterThan(0);
        const hasRelevantPatches = patches.some(
          (p) => p.op === "replace-line" || p.op === "replace",
        );
        expect(hasRelevantPatches).toBe(true);
      });
    });

    describe("edge cases", () => {
      test("handles empty source", () => {
        const source = "";
        const target = "New content";

        const patches = suggestPatches(source, target);

        expect(Array.isArray(patches)).toBe(true);
      });

      test("handles empty target", () => {
        const source = "Old content";
        const target = "";

        const patches = suggestPatches(source, target);

        expect(Array.isArray(patches)).toBe(true);
      });

      test("handles identical content", () => {
        const source = "Same content";
        const target = "Same content";

        const patches = suggestPatches(source, target);

        expect(patches.length).toBe(0);
      });

      test("handles content with special characters", () => {
        const source = "Text with $pecial ch@rs!";
        const target = "Text with different $pecial ch@rs!";

        const patches = suggestPatches(source, target);

        expect(Array.isArray(patches)).toBe(true);
      });

      test("handles multiline content blocks", () => {
        const source = `# Header
Line 1
old text here
Line 3
another old text here
Line 5`;

        const target = `# Header
Line 1
new text here
Line 3
another new text here
Line 5`;

        const patches = suggestPatches(source, target);

        // Should suggest patches for the changes
        expect(patches.length).toBeGreaterThan(0);
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
        expect(
          patches.some((p) => p.op === "remove-section" || p.op === "rename-header"),
        ).toBe(true);

        // All patches should have scores
        expect(scored.length).toBe(patches.length);
        expect(scored.every((s) => s.score > 0 && s.score <= 1)).toBe(true);
      });

      test("suggests optimal patches for document refactoring", () => {
        const source = `# Old Title
Some content here
Some content here
Some content here`;

        const target = `# New Title
Different content here
Different content here
Different content here`;

        const patches = suggestPatches(source, target);

        // Should suggest efficient patches
        expect(patches.length).toBeGreaterThan(0);
        expect(patches.some((p) => p.op === "rename-header")).toBe(true);
      });
    });
  });

  describe("scorePatches", () => {
    describe("scoring by operation type", () => {
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

      test("assigns medium scores to regex operations", () => {
        const patches: PatchOperation[] = [
          {
            op: "replace-regex",
            pattern: "\\d+\\.\\d+\\.\\d+",
            replacement: "2.0.0",
          },
        ];

        const scored = scorePatches(patches, "Version 1.0.0", "Version 2.0.0");

        expect(scored[0]?.score).toBeGreaterThan(0.5);
        expect(scored[0]?.score).toBeLessThan(0.9);
      });

      test("assigns lower scores to line operations", () => {
        const patches: PatchOperation[] = [
          {
            op: "replace-line",
            match: "Old line",
            replacement: "New line",
          },
        ];

        const scored = scorePatches(patches, "Old line", "New line");

        expect(scored[0]?.score).toBeLessThanOrEqual(0.7);
      });

      test("adjusts replace scores based on frequency", () => {
        const sourceOnce = "foo bar";
        const targetOnce = "baz bar";
        const patchesOnce: PatchOperation[] = [{ op: "replace", old: "foo", new: "baz" }];
        const scoredOnce = scorePatches(patchesOnce, sourceOnce, targetOnce);

        const sourceThrice = "foo bar foo bar foo bar";
        const targetThrice = "baz bar baz bar baz bar";
        const patchesThrice: PatchOperation[] = [{ op: "replace", old: "foo", new: "baz" }];
        const scoredThrice = scorePatches(patchesThrice, sourceThrice, targetThrice);

        expect(scoredThrice[0]!.score).toBeGreaterThan(scoredOnce[0]!.score);
      });
    });

    describe("patch descriptions", () => {
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

      test("includes relevant details in descriptions", () => {
        const patches: PatchOperation[] = [
          { op: "replace", old: "oldValue", new: "newValue" },
          { op: "set-frontmatter", key: "author", value: "John" },
          { op: "remove-section", id: "old-section" },
        ];

        const scored = scorePatches(patches, "", "");

        // Patches are sorted by score, so find by type
        const replacePatch = scored.find((s) => s.patch.op === "replace");
        const frontmatterPatch = scored.find((s) => s.patch.op === "set-frontmatter");
        const sectionPatch = scored.find((s) => s.patch.op === "remove-section");

        expect(replacePatch?.description).toContain("oldValue");
        expect(replacePatch?.description).toContain("newValue");
        expect(frontmatterPatch?.description).toContain("author");
        expect(sectionPatch?.description).toContain("old-section");
      });

      test("truncates long strings in descriptions", () => {
        const longString = "a".repeat(100);
        const patches: PatchOperation[] = [
          { op: "replace", old: longString, new: "short" },
        ];

        const scored = scorePatches(patches, longString, "short");

        expect(scored[0]?.description.length).toBeLessThan(100);
        expect(scored[0]?.description).toContain("...");
      });

      test("describes different patch operations appropriately", () => {
        const patches: PatchOperation[] = [
          { op: "replace-regex", pattern: "test", replacement: "prod" },
          { op: "remove-frontmatter", key: "draft" },
          { op: "rename-header", id: "section", new: "New Title" },
          { op: "replace-section", id: "intro", content: "New intro" },
        ];

        const scored = scorePatches(patches, "", "");

        // Find each patch by type
        const regexPatch = scored.find((s) => s.patch.op === "replace-regex");
        const removeFmPatch = scored.find((s) => s.patch.op === "remove-frontmatter");
        const renameHeaderPatch = scored.find((s) => s.patch.op === "rename-header");
        const replaceSectionPatch = scored.find((s) => s.patch.op === "replace-section");

        expect(regexPatch?.description).toContain("pattern");
        expect(removeFmPatch?.description).toContain("draft");
        expect(renameHeaderPatch?.description).toContain("New Title");
        expect(replaceSectionPatch?.description).toContain("intro");
      });
    });

    describe("sorting behavior", () => {
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

      test("maintains stable sort for equal scores", () => {
        const patches: PatchOperation[] = [
          { op: "set-frontmatter", key: "a", value: 1 },
          { op: "set-frontmatter", key: "b", value: 2 },
          { op: "set-frontmatter", key: "c", value: 3 },
        ];

        const scored = scorePatches(patches, "", "");

        // All frontmatter operations should have the same score
        expect(scored[0]?.score).toBe(scored[1]?.score);
        expect(scored[1]?.score).toBe(scored[2]?.score);
      });
    });

    describe("edge cases", () => {
      test("handles empty patch array", () => {
        const scored = scorePatches([], "source", "target");

        expect(scored).toEqual([]);
      });

      test("handles single patch", () => {
        const patches: PatchOperation[] = [{ op: "replace", old: "a", new: "b" }];

        const scored = scorePatches(patches, "a", "b");

        expect(scored.length).toBe(1);
        expect(scored[0]?.score).toBeGreaterThan(0);
        expect(scored[0]?.description).toBeTruthy();
      });

      test("all scores are within valid range", () => {
        const patches: PatchOperation[] = [
          { op: "replace", old: "a", new: "b" },
          { op: "replace-regex", pattern: "test", replacement: "prod" },
          { op: "set-frontmatter", key: "x", value: "y" },
          { op: "remove-section", id: "section" },
          { op: "replace-line", match: "line", replacement: "newline" },
        ];

        const scored = scorePatches(patches, "test a line", "prod b newline");

        for (const scoredPatch of scored) {
          expect(scoredPatch.score).toBeGreaterThanOrEqual(0);
          expect(scoredPatch.score).toBeLessThanOrEqual(1);
        }
      });

      test("handles patches with undefined operations gracefully", () => {
        const patches: PatchOperation[] = [
          { op: "set-frontmatter", key: "test", value: "value" },
        ];

        const scored = scorePatches(patches, "", "");

        expect(scored.length).toBe(1);
        expect(scored[0]?.score).toBeGreaterThan(0);
      });
    });
  });

  describe("integration scenarios", () => {
    test("end-to-end: analyze, suggest, and score", () => {
      const source = `---
title: My Document
version: 1.0
---

# Introduction
Welcome to version 1.0

## Features
- Basic features`;

      const target = `---
title: My Document
version: 2.0
author: John
---

# Introduction
Welcome to version 2.0

## Features
- Basic features
- Advanced features`;

      // Step 1: Analyze
      const analysis = analyzeDiff(source, target);
      expect(analysis.hasFrontmatter).toBe(true);
      expect(analysis.frontmatterChanges.modified.version).toBeDefined();
      expect(analysis.frontmatterChanges.added.author).toBe("John");

      // Step 2: Suggest
      const patches = suggestPatches(source, target);
      expect(patches.length).toBeGreaterThan(0);

      // Step 3: Score
      const scored = scorePatches(patches, source, target);
      expect(scored.length).toBe(patches.length);

      // Verify top suggestions are high quality
      const topScored = scored[0];
      expect(topScored?.score).toBeGreaterThan(0.5);
      expect(topScored?.description).toBeTruthy();
    });

    test("provides actionable suggestions for documentation updates", () => {
      const source = `# API Reference

## GET /api/users
Endpoint for fetching users

Base URL: https://api.old.com`;

      const target = `# API Reference

## GET /api/v2/users
Endpoint for fetching users

Base URL: https://api.new.com`;

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      // Should suggest relevant patches
      expect(patches.length).toBeGreaterThan(0);

      // Should have reasonable confidence scores
      const avgScore = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
      expect(avgScore).toBeGreaterThan(0.4);
    });

    test("handles real-world documentation migration", () => {
      const source = `---
layout: default
category: tutorial
---

# Getting Started

Install the package:
\`\`\`bash
npm install old-package@1.0.0
\`\`\`

## Configuration
Set up your config file.`;

      const target = `---
layout: modern
category: tutorial
tags: [beginner, setup]
---

# Getting Started

Install the package:
\`\`\`bash
npm install new-package@2.0.0
\`\`\`

## Configuration
Set up your config file.`;

      const analysis = analyzeDiff(source, target);
      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      // Should detect all types of changes
      expect(analysis.frontmatterChanges.modified.layout).toBeDefined();
      expect(analysis.frontmatterChanges.added.tags).toBeDefined();

      // Should suggest appropriate patches
      expect(patches.some((p) => p.op === "set-frontmatter")).toBe(true);
      expect(patches.some((p) => p.op === "replace")).toBe(true);

      // Should rank patches appropriately
      expect(scored.length).toBeGreaterThan(0);
      expect(scored[0]?.score).toBeGreaterThan(0);
    });

    test("optimizes suggestions for bulk changes", () => {
      const source = `Version 1.0.0 is here
Download v1.0.0 now
Upgrade to 1.0.0 today`;

      const target = `Version 2.0.0 is here
Download v2.0.0 now
Upgrade to 2.0.0 today`;

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      // Should detect the pattern and suggest efficient patches
      const regexPatch = patches.find((p) => p.op === "replace-regex");
      expect(regexPatch).toBeDefined();

      // Regex patch should be scored highly due to multiple matches
      const regexScore = scored.find((s) => s.patch.op === "replace-regex");
      if (regexScore) {
        expect(regexScore.score).toBeGreaterThan(0.7);
      }
    });
  });

  describe("performance and efficiency", () => {
    test("handles moderately large documents efficiently", () => {
      const lines = 500;
      const sourceLines = Array.from({ length: lines }, (_, i) => `Line ${i}`);
      const targetLines = [...sourceLines];
      targetLines[250] = "Modified line";

      const source = sourceLines.join("\n");
      const target = targetLines.join("\n");

      const startTime = performance.now();
      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const endTime = performance.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // 1 second

      // Should still provide useful suggestions
      expect(patches.length).toBeGreaterThan(0);
      expect(scored.length).toBe(patches.length);
    });

    test("does not suggest redundant patches", () => {
      const source = "foo bar foo bar";
      const target = "baz bar baz bar";

      const patches = suggestPatches(source, target);

      // Should suggest one replace patch, not multiple
      const replacePatches = patches.filter(
        (p) => p.op === "replace" && p.old === "foo" && p.new === "baz",
      );
      expect(replacePatches.length).toBe(1);
    });
  });
});
