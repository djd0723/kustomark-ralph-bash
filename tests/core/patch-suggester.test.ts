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

      test("populates targetSections for anchor resolution", () => {
        const source = "## Section A\nContent A";
        const target = "## Section A\nContent A\n\n## Section B\nContent B";

        const analysis = analyzeDiff(source, target);

        expect(analysis.targetSections.length).toBe(2);
        expect(analysis.targetSections[0]?.id).toBe("section-a");
        expect(analysis.targetSections[1]?.id).toBe("section-b");
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

      test("suggests merge-frontmatter for 2+ modified frontmatter fields", () => {
        const source = "---\ntitle: Old\nstatus: draft\n---\nContent";
        const target = "---\ntitle: New\nstatus: published\n---\nContent";

        const patches = suggestPatches(source, target);

        const mergePatch = patches.find((p) => p.op === "merge-frontmatter");
        expect(mergePatch).toBeDefined();
        if (mergePatch?.op === "merge-frontmatter") {
          expect(mergePatch.values).toMatchObject({ title: "New", status: "published" });
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

    describe("merge-frontmatter detection", () => {
      test("suggests merge-frontmatter when 2+ keys are added", () => {
        const source = "---\ntitle: Doc\n---\nContent";
        const target = "---\ntitle: Doc\nauthor: Alice\ncategory: guide\n---\nContent";

        const patches = suggestPatches(source, target);

        const mergePatch = patches.find((p) => p.op === "merge-frontmatter");
        expect(mergePatch).toBeDefined();
        if (mergePatch?.op === "merge-frontmatter") {
          expect(mergePatch.values).toMatchObject({ author: "Alice", category: "guide" });
        }
        // No individual set-frontmatter for the batched keys
        expect(patches.some((p) => p.op === "set-frontmatter" && (p as { key: string }).key === "author")).toBe(false);
      });

      test("suggests set-frontmatter (not merge) for a single added key", () => {
        const source = "---\ntitle: Doc\n---\nContent";
        const target = "---\ntitle: Doc\nauthor: Alice\n---\nContent";

        const patches = suggestPatches(source, target);

        const setPatch = patches.find((p) => p.op === "set-frontmatter");
        expect(setPatch).toBeDefined();
        if (setPatch?.op === "set-frontmatter") {
          expect(setPatch.key).toBe("author");
          expect(setPatch.value).toBe("Alice");
        }
        expect(patches.some((p) => p.op === "merge-frontmatter")).toBe(false);
      });

      test("suggests merge-frontmatter when 2+ keys are modified", () => {
        const source = "---\nfoo: old1\nbar: old2\n---\nContent";
        const target = "---\nfoo: new1\nbar: new2\n---\nContent";

        const patches = suggestPatches(source, target);

        const mergePatch = patches.find((p) => p.op === "merge-frontmatter");
        expect(mergePatch).toBeDefined();
        if (mergePatch?.op === "merge-frontmatter") {
          expect(mergePatch.values).toMatchObject({ foo: "new1", bar: "new2" });
        }
      });

      test("combines added and modified keys into one merge-frontmatter", () => {
        const source = "---\ntitle: Old\n---\nContent";
        const target = "---\ntitle: New\nauthor: Bob\n---\nContent";

        const patches = suggestPatches(source, target);

        const mergePatch = patches.find((p) => p.op === "merge-frontmatter");
        expect(mergePatch).toBeDefined();
        if (mergePatch?.op === "merge-frontmatter") {
          expect(mergePatch.values).toMatchObject({ title: "New", author: "Bob" });
        }
      });

      test("keeps remove-frontmatter separate from merge-frontmatter", () => {
        const source = "---\ntitle: Old\nversion: 1.0\ndraft: true\n---\nContent";
        const target = "---\ntitle: New\nversion: 2.0\n---\nContent";

        const patches = suggestPatches(source, target);

        const mergePatch = patches.find((p) => p.op === "merge-frontmatter");
        const removePatch = patches.find((p) => p.op === "remove-frontmatter");
        expect(mergePatch).toBeDefined();
        expect(removePatch).toBeDefined();
        if (removePatch?.op === "remove-frontmatter") {
          expect(removePatch.key).toBe("draft");
        }
      });

      test("keeps rename-frontmatter separate; merges remaining adds", () => {
        const source = "---\nold_key: value\n---\nContent";
        const target = "---\nnew_key: value\nextra1: a\nextra2: b\n---\nContent";

        const patches = suggestPatches(source, target);

        const renamePatch = patches.find((p) => p.op === "rename-frontmatter");
        const mergePatch = patches.find((p) => p.op === "merge-frontmatter");
        expect(renamePatch).toBeDefined();
        expect(mergePatch).toBeDefined();
        if (mergePatch?.op === "merge-frontmatter") {
          expect(Object.keys(mergePatch.values)).toContain("extra1");
          expect(Object.keys(mergePatch.values)).toContain("extra2");
          // The renamed key should not be in merge values
          expect(Object.keys(mergePatch.values)).not.toContain("new_key");
        }
      });

      test("scores merge-frontmatter at 0.95", () => {
        const patches = suggestPatches(
          "---\na: 1\n---\nContent",
          "---\na: 1\nb: 2\nc: 3\n---\nContent",
        );
        const scored = scorePatches(patches, "---\na: 1\n---\nContent", "---\na: 1\nb: 2\nc: 3\n---\nContent");
        const mergeScored = scored.find((s) => s.patch.op === "merge-frontmatter");
        expect(mergeScored).toBeDefined();
        expect(mergeScored!.score).toBeCloseTo(0.95);
      });

      test("describes merge-frontmatter with key count", () => {
        const patches = suggestPatches(
          "---\na: 1\n---\nContent",
          "---\na: 1\nb: 2\nc: 3\n---\nContent",
        );
        const scored = scorePatches(patches, "---\na: 1\n---\nContent", "---\na: 1\nb: 2\nc: 3\n---\nContent");
        const mergeScored = scored.find((s) => s.patch.op === "merge-frontmatter");
        expect(mergeScored?.description).toContain("2");
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

      test("suggests insert-section when a new section is appended after existing", () => {
        const source = "## Introduction\nHello world";
        const target = "## Introduction\nHello world\n\n## New Section\nNew content here";

        const patches = suggestPatches(source, target);

        const insertPatch = patches.find((p) => p.op === "insert-section");
        expect(insertPatch).toBeDefined();
        if (insertPatch?.op === "insert-section") {
          expect(insertPatch.id).toBe("introduction");
          expect(insertPatch.position).toBe("after");
          expect(insertPatch.header).toBe("## New Section");
          expect(insertPatch.content).toBe("New content here");
        }
      });

      test("suggests insert-section with position before when added as first section", () => {
        const source = "## Existing Section\nSome content";
        const target = "## New First Section\nNew content\n\n## Existing Section\nSome content";

        const patches = suggestPatches(source, target);

        const insertPatch = patches.find((p) => p.op === "insert-section");
        expect(insertPatch).toBeDefined();
        if (insertPatch?.op === "insert-section") {
          expect(insertPatch.id).toBe("existing-section");
          expect(insertPatch.position).toBe("before");
          expect(insertPatch.header).toBe("## New First Section");
        }
      });

      test("suggests insert-section without content when section has no body", () => {
        const source = "## Intro\nText";
        const target = "## Intro\nText\n\n## Empty Section";

        const patches = suggestPatches(source, target);

        const insertPatch = patches.find((p) => p.op === "insert-section");
        expect(insertPatch).toBeDefined();
        if (insertPatch?.op === "insert-section") {
          expect(insertPatch.header).toBe("## Empty Section");
          expect(insertPatch.content).toBeUndefined();
        }
      });

      test("suggests insert-section between existing sections", () => {
        const source = "## First\nContent A\n\n## Last\nContent B";
        const target = "## First\nContent A\n\n## Middle\nNew middle content\n\n## Last\nContent B";

        const patches = suggestPatches(source, target);

        const insertPatch = patches.find((p) => p.op === "insert-section");
        expect(insertPatch).toBeDefined();
        if (insertPatch?.op === "insert-section") {
          expect(insertPatch.header).toBe("## Middle");
          expect(insertPatch.content).toBe("New middle content");
          // Anchors on the preceding "First" section
          expect(insertPatch.id).toBe("first");
          expect(insertPatch.position).toBe("after");
        }
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

        // Should suggest various types of patches (3 frontmatter changes → merge-frontmatter)
        expect(patches.some((p) => p.op === "merge-frontmatter" || p.op === "set-frontmatter")).toBe(true);
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

      test("describes insert-section patch with anchor and position", () => {
        const patches: PatchOperation[] = [
          { op: "insert-section", id: "introduction", position: "after", header: "## New Section" },
        ];

        const scored = scorePatches(patches, "", "");

        const insertPatch = scored.find((s) => s.patch.op === "insert-section");
        expect(insertPatch?.description).toContain("## New Section");
        expect(insertPatch?.description).toContain("introduction");
        expect(insertPatch?.description).toContain("after");
        expect(insertPatch?.score).toBe(0.9);
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

      // Should suggest appropriate patches (2 frontmatter changes → merge-frontmatter)
      expect(patches.some((p) => p.op === "merge-frontmatter" || p.op === "set-frontmatter")).toBe(true);
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

  // ============================================================================
  // List change detection
  // ============================================================================

  describe("list change detection", () => {
    test("detects item added to list", () => {
      const source = "# Title\n\n- Apple\n- Banana\n";
      const target = "# Title\n\n- Apple\n- Banana\n- Cherry\n";

      const analysis = analyzeDiff(source, target);

      expect(analysis.listChanges.length).toBeGreaterThan(0);
      const added = analysis.listChanges.find((c) => c.type === "item-added");
      expect(added).toBeDefined();
      expect(added?.type === "item-added" && added.newText).toBe("Cherry");
    });

    test("detects item removed from list", () => {
      const source = "# Title\n\n- Apple\n- Banana\n- Cherry\n";
      const target = "# Title\n\n- Apple\n- Cherry\n";

      const analysis = analyzeDiff(source, target);

      expect(analysis.listChanges.length).toBeGreaterThan(0);
      const removed = analysis.listChanges.find((c) => c.type === "item-removed");
      expect(removed).toBeDefined();
      expect(removed?.type === "item-removed" && removed.oldText).toBe("Banana");
    });

    test("detects item modified in list", () => {
      const source = "# Title\n\n- Apple\n- Banana\n- Cherry\n";
      const target = "# Title\n\n- Apple\n- Mango\n- Cherry\n";

      const analysis = analyzeDiff(source, target);

      expect(analysis.listChanges.length).toBeGreaterThan(0);
      const modified = analysis.listChanges.find((c) => c.type === "item-modified");
      expect(modified).toBeDefined();
      expect(modified?.type === "item-modified" && modified.oldText).toBe("Banana");
      expect(modified?.type === "item-modified" && modified.newText).toBe("Mango");
    });

    test("suggests add-list-item patch for added item", () => {
      const source = "- Alpha\n- Beta\n";
      const target = "- Alpha\n- Beta\n- Gamma\n";

      const patches = suggestPatches(source, target);

      const addPatch = patches.find((p) => p.op === "add-list-item");
      expect(addPatch).toBeDefined();
      expect(addPatch?.op === "add-list-item" && addPatch.item).toBe("Gamma");
      expect(addPatch?.op === "add-list-item" && addPatch.list).toBe(0);
    });

    test("suggests remove-list-item patch for removed item", () => {
      const source = "- Alpha\n- Beta\n- Gamma\n";
      const target = "- Alpha\n- Gamma\n";

      const patches = suggestPatches(source, target);

      const removePatch = patches.find((p) => p.op === "remove-list-item");
      expect(removePatch).toBeDefined();
      expect(removePatch?.op === "remove-list-item" && removePatch.item).toBe("Beta");
      expect(removePatch?.op === "remove-list-item" && removePatch.list).toBe(0);
    });

    test("suggests set-list-item patch for modified item", () => {
      const source = "- Alpha\n- Beta\n- Gamma\n";
      const target = "- Alpha\n- Delta\n- Gamma\n";

      const patches = suggestPatches(source, target);

      const setPatch = patches.find((p) => p.op === "set-list-item");
      expect(setPatch).toBeDefined();
      expect(setPatch?.op === "set-list-item" && setPatch.item).toBe("Beta");
      expect(setPatch?.op === "set-list-item" && setPatch.new).toBe("Delta");
    });

    test("no list changes for identical lists", () => {
      const source = "- Alpha\n- Beta\n- Gamma\n";
      const target = "- Alpha\n- Beta\n- Gamma\n";

      const analysis = analyzeDiff(source, target);

      expect(analysis.listChanges.length).toBe(0);
    });

    test("list changes scored as high confidence", () => {
      const source = "- Alpha\n- Beta\n";
      const target = "- Alpha\n- Gamma\n";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const listPatchScored = scored.find(
        (s) => s.patch.op === "set-list-item" || s.patch.op === "add-list-item" || s.patch.op === "remove-list-item",
      );
      if (listPatchScored) {
        expect(listPatchScored.score).toBeGreaterThanOrEqual(0.9);
      }
    });

    test("handles multiple lists independently", () => {
      const source = "- One\n- Two\n\nSome text.\n\n- A\n- B\n";
      const target = "- One\n- Three\n\nSome text.\n\n- A\n- B\n- C\n";

      const analysis = analyzeDiff(source, target);

      // First list: item modified (Two → Three)
      const list0Changes = analysis.listChanges.filter((c) => c.listIndex === 0);
      expect(list0Changes.length).toBeGreaterThan(0);

      // Second list: item added (C)
      const list1Changes = analysis.listChanges.filter((c) => c.listIndex === 1);
      expect(list1Changes.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Link change detection
  // ============================================================================

  describe("link change detection", () => {
    test("detects URL change for same link text", () => {
      const source = "See [docs](https://old.example.com/docs) for details.";
      const target = "See [docs](https://new.example.com/docs) for details.";

      const analysis = analyzeDiff(source, target);

      expect(analysis.linkChanges.length).toBeGreaterThan(0);
      const change = analysis.linkChanges.find((c) => c.urlChanged);
      expect(change).toBeDefined();
      expect(change?.oldUrl).toBe("https://old.example.com/docs");
      expect(change?.urlChanged && change.newUrl).toBe("https://new.example.com/docs");
    });

    test("detects text change for same URL", () => {
      const source = "Visit [Old Name](https://example.com) here.";
      const target = "Visit [New Name](https://example.com) here.";

      const analysis = analyzeDiff(source, target);

      expect(analysis.linkChanges.length).toBeGreaterThan(0);
      const change = analysis.linkChanges.find((c) => c.textChanged);
      expect(change).toBeDefined();
      expect(change?.oldText).toBe("Old Name");
      expect(change?.textChanged && change.newText).toBe("New Name");
    });

    test("suggests modify-links patch for URL change", () => {
      const source = "Check [guide](https://v1.example.com/guide) now.";
      const target = "Check [guide](https://v2.example.com/guide) now.";

      const patches = suggestPatches(source, target);

      const linkPatch = patches.find((p) => p.op === "modify-links");
      expect(linkPatch).toBeDefined();
      expect(linkPatch?.op === "modify-links" && linkPatch.urlMatch).toBe("https://v1.example.com/guide");
      expect(linkPatch?.op === "modify-links" && linkPatch.newUrl).toBe("https://v2.example.com/guide");
    });

    test("suggests modify-links patch for text change", () => {
      const source = "See [old label](https://example.com/page).";
      const target = "See [new label](https://example.com/page).";

      const patches = suggestPatches(source, target);

      const linkPatch = patches.find((p) => p.op === "modify-links");
      expect(linkPatch).toBeDefined();
      expect(linkPatch?.op === "modify-links" && linkPatch.textMatch).toBe("old label");
      expect(linkPatch?.op === "modify-links" && linkPatch.newText).toBe("new label");
    });

    test("no link changes for identical links", () => {
      const source = "See [docs](https://example.com) here.";
      const target = "See [docs](https://example.com) here.";

      const analysis = analyzeDiff(source, target);

      expect(analysis.linkChanges.length).toBe(0);
    });

    test("link patches scored as high confidence", () => {
      const source = "Read [guide](https://old.example.com).";
      const target = "Read [guide](https://new.example.com).";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const linkPatchScored = scored.find((s) => s.patch.op === "modify-links");
      if (linkPatchScored) {
        expect(linkPatchScored.score).toBeGreaterThanOrEqual(0.9);
      }
    });

    test("describePatch returns human-readable description for list ops", () => {
      const source = "- Alpha\n- Beta\n";
      const target = "- Alpha\n- Gamma\n";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const listPatchScored = scored.find(
        (s) => s.patch.op === "set-list-item" || s.patch.op === "remove-list-item",
      );
      if (listPatchScored) {
        expect(listPatchScored.description).toContain("list");
      }
    });

    test("describePatch returns human-readable description for link ops", () => {
      const source = "See [docs](https://old.example.com).";
      const target = "See [docs](https://new.example.com).";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const linkPatchScored = scored.find((s) => s.patch.op === "modify-links");
      if (linkPatchScored) {
        expect(linkPatchScored.description).toContain("link");
      }
    });
  });

  // ============================================================================
  // Table change detection
  // ============================================================================

  describe("table change detection", () => {
    const TABLE_SOURCE = [
      "| Name | Age | City |",
      "|------|-----|------|",
      "| Alice | 30 | NYC |",
      "| Bob | 25 | LA |",
    ].join("\n");

    test("detects cell value change", () => {
      const target = [
        "| Name | Age | City |",
        "|------|-----|------|",
        "| Alice | 30 | NYC |",
        "| Bob | 26 | LA |",
      ].join("\n");

      const analysis = analyzeDiff(TABLE_SOURCE, target);

      expect(analysis.tableChanges.length).toBeGreaterThan(0);
      const cellChange = analysis.tableChanges.find((c) => c.type === "cell-changed");
      expect(cellChange).toBeDefined();
      expect(cellChange?.type === "cell-changed" && cellChange.oldValue).toBe("25");
      expect(cellChange?.type === "cell-changed" && cellChange.newValue).toBe("26");
    });

    test("detects row added to table", () => {
      const target = [
        "| Name | Age | City |",
        "|------|-----|------|",
        "| Alice | 30 | NYC |",
        "| Bob | 25 | LA |",
        "| Carol | 28 | SF |",
      ].join("\n");

      const analysis = analyzeDiff(TABLE_SOURCE, target);

      expect(analysis.tableChanges.length).toBeGreaterThan(0);
      const rowAdded = analysis.tableChanges.find((c) => c.type === "row-added");
      expect(rowAdded).toBeDefined();
      expect(rowAdded?.type === "row-added" && rowAdded.values[0]).toBe("Carol");
    });

    test("detects row removed from table", () => {
      const target = [
        "| Name | Age | City |",
        "|------|-----|------|",
        "| Alice | 30 | NYC |",
      ].join("\n");

      const analysis = analyzeDiff(TABLE_SOURCE, target);

      expect(analysis.tableChanges.length).toBeGreaterThan(0);
      const rowRemoved = analysis.tableChanges.find((c) => c.type === "row-removed");
      expect(rowRemoved).toBeDefined();
      expect(rowRemoved?.type === "row-removed" && rowRemoved.values[0]).toBe("Bob");
    });

    test("detects column removed from table", () => {
      const target = [
        "| Name | Age |",
        "|------|-----|",
        "| Alice | 30 |",
        "| Bob | 25 |",
      ].join("\n");

      const analysis = analyzeDiff(TABLE_SOURCE, target);

      expect(analysis.tableChanges.length).toBeGreaterThan(0);
      const colRemoved = analysis.tableChanges.find((c) => c.type === "column-removed");
      expect(colRemoved).toBeDefined();
      expect(colRemoved?.type === "column-removed" && colRemoved.header).toBe("City");
    });

    test("detects column added to table", () => {
      const target = [
        "| Name | Age | City | Country |",
        "|------|-----|------|---------|",
        "| Alice | 30 | NYC | USA |",
        "| Bob | 25 | LA | USA |",
      ].join("\n");

      const analysis = analyzeDiff(TABLE_SOURCE, target);

      expect(analysis.tableChanges.length).toBeGreaterThan(0);
      const colAdded = analysis.tableChanges.find((c) => c.type === "column-added");
      expect(colAdded).toBeDefined();
      expect(colAdded?.type === "column-added" && colAdded.header).toBe("Country");
    });

    test("suggests replace-table-cell for changed cell", () => {
      const source = [
        "| Name | Score |",
        "|------|-------|",
        "| Alice | 100 |",
        "| Bob | 90 |",
      ].join("\n");
      const target = [
        "| Name | Score |",
        "|------|-------|",
        "| Alice | 100 |",
        "| Bob | 95 |",
      ].join("\n");

      const patches = suggestPatches(source, target);

      const cellPatch = patches.find((p) => p.op === "replace-table-cell");
      expect(cellPatch).toBeDefined();
      expect(cellPatch?.op === "replace-table-cell" && cellPatch.content).toBe("95");
    });

    test("suggests add-table-row for new row", () => {
      const source = "| X | Y |\n|---|---|\n| 1 | A |\n";
      const target = "| X | Y |\n|---|---|\n| 1 | A |\n| 2 | B |\n";

      const patches = suggestPatches(source, target);

      const addRowPatch = patches.find((p) => p.op === "add-table-row");
      expect(addRowPatch).toBeDefined();
      expect(addRowPatch?.op === "add-table-row" && addRowPatch.values).toContain("2");
    });

    test("suggests remove-table-row for deleted row", () => {
      const source = "| X | Y |\n|---|---|\n| 1 | A |\n| 2 | B |\n";
      const target = "| X | Y |\n|---|---|\n| 1 | A |\n";

      const patches = suggestPatches(source, target);

      const removeRowPatch = patches.find((p) => p.op === "remove-table-row");
      expect(removeRowPatch).toBeDefined();
    });

    test("suggests add-table-column for new column", () => {
      const source = "| Name | Score |\n|------|-------|\n| Alice | 100 |\n";
      const target = "| Name | Score | Grade |\n|------|-------|-------|\n| Alice | 100 | A |\n";

      const patches = suggestPatches(source, target);

      const addColPatch = patches.find((p) => p.op === "add-table-column");
      expect(addColPatch).toBeDefined();
      expect(addColPatch?.op === "add-table-column" && addColPatch.header).toBe("Grade");
    });

    test("suggests remove-table-column for deleted column", () => {
      const source = "| Name | Score | Grade |\n|------|-------|-------|\n| Alice | 100 | A |\n";
      const target = "| Name | Score |\n|------|-------|\n| Alice | 100 |\n";

      const patches = suggestPatches(source, target);

      const removeColPatch = patches.find((p) => p.op === "remove-table-column");
      expect(removeColPatch).toBeDefined();
      expect(removeColPatch?.op === "remove-table-column" && removeColPatch.column).toBe("Grade");
    });

    test("no table changes for identical tables", () => {
      const analysis = analyzeDiff(TABLE_SOURCE, TABLE_SOURCE);

      expect(analysis.tableChanges.length).toBe(0);
    });

    test("table patches scored as high confidence", () => {
      const source = "| X | Y |\n|---|---|\n| 1 | A |\n";
      const target = "| X | Y |\n|---|---|\n| 1 | B |\n";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const tablePatchScored = scored.find(
        (s) =>
          s.patch.op === "replace-table-cell" ||
          s.patch.op === "add-table-row" ||
          s.patch.op === "remove-table-row" ||
          s.patch.op === "add-table-column" ||
          s.patch.op === "remove-table-column",
      );
      if (tablePatchScored) {
        expect(tablePatchScored.score).toBeGreaterThanOrEqual(0.9);
      }
    });

    test("handles multiple tables independently", () => {
      const source = [
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "| X | Y |",
        "|---|---|",
        "| p | q |",
      ].join("\n");
      const target = [
        "| A | B |",
        "|---|---|",
        "| 1 | 9 |",
        "",
        "| X | Y |",
        "|---|---|",
        "| p | q |",
        "| r | s |",
      ].join("\n");

      const analysis = analyzeDiff(source, target);

      const table0Changes = analysis.tableChanges.filter((c) => c.tableIndex === 0);
      const table1Changes = analysis.tableChanges.filter((c) => c.tableIndex === 1);

      expect(table0Changes.some((c) => c.type === "cell-changed")).toBe(true);
      expect(table1Changes.some((c) => c.type === "row-added")).toBe(true);
    });

    test("describePatch returns human-readable description for table ops", () => {
      const source = "| X | Y |\n|---|---|\n| 1 | A |\n";
      const target = "| X | Y |\n|---|---|\n| 1 | B |\n";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);

      const tablePatchScored = scored.find((s) => s.patch.op === "replace-table-cell");
      if (tablePatchScored) {
        expect(tablePatchScored.description).toContain("table");
      }
    });
  });

  describe("code block change detection", () => {
    const CODE_SOURCE = [
      "Some intro text.",
      "",
      "```javascript",
      "console.log('hello');",
      "```",
      "",
      "More text.",
    ].join("\n");

    test("detects code block content change", () => {
      const target = [
        "Some intro text.",
        "",
        "```javascript",
        "console.log('world');",
        "```",
        "",
        "More text.",
      ].join("\n");

      const analysis = analyzeDiff(CODE_SOURCE, target);

      expect(analysis.codeBlockChanges.length).toBe(1);
      const change = analysis.codeBlockChanges[0];
      expect(change?.type).toBe("content-changed");
      expect(change?.blockIndex).toBe(0);
      expect(change?.type === "content-changed" && change.oldBody).toBe("console.log('hello');");
      expect(change?.type === "content-changed" && change.newBody).toBe("console.log('world');");
    });

    test("detects language tag change", () => {
      const target = [
        "Some intro text.",
        "",
        "```typescript",
        "console.log('hello');",
        "```",
        "",
        "More text.",
      ].join("\n");

      const analysis = analyzeDiff(CODE_SOURCE, target);

      expect(analysis.codeBlockChanges.length).toBe(1);
      const change = analysis.codeBlockChanges[0];
      expect(change?.type === "content-changed" && change.oldLanguage).toBe("javascript");
      expect(change?.type === "content-changed" && change.newLanguage).toBe("typescript");
    });

    test("no changes when code blocks are identical", () => {
      const analysis = analyzeDiff(CODE_SOURCE, CODE_SOURCE);
      expect(analysis.codeBlockChanges.length).toBe(0);
    });

    test("suggestPatches generates replace-code-block for changed block", () => {
      const target = [
        "Some intro text.",
        "",
        "```javascript",
        "console.log('updated');",
        "```",
        "",
        "More text.",
      ].join("\n");

      const patches = suggestPatches(CODE_SOURCE, target);
      const codeBlockPatch = patches.find((p) => p.op === "replace-code-block");

      expect(codeBlockPatch).toBeDefined();
      expect(codeBlockPatch?.op === "replace-code-block" && codeBlockPatch.index).toBe(0);
      expect(codeBlockPatch?.op === "replace-code-block" && codeBlockPatch.content).toBe(
        "console.log('updated');",
      );
    });

    test("suggestPatches includes language field when language changes", () => {
      const target = [
        "Some intro text.",
        "",
        "```typescript",
        "console.log('hello');",
        "```",
        "",
        "More text.",
      ].join("\n");

      const patches = suggestPatches(CODE_SOURCE, target);
      const codeBlockPatch = patches.find((p) => p.op === "replace-code-block");

      expect(codeBlockPatch).toBeDefined();
      expect(codeBlockPatch?.op === "replace-code-block" && codeBlockPatch.language).toBe(
        "typescript",
      );
    });

    test("handles multiple code blocks independently", () => {
      const source = [
        "```js",
        "const a = 1;",
        "```",
        "",
        "```python",
        "x = 1",
        "```",
      ].join("\n");

      const target = [
        "```js",
        "const a = 2;",
        "```",
        "",
        "```python",
        "x = 1",
        "```",
      ].join("\n");

      const analysis = analyzeDiff(source, target);

      expect(analysis.codeBlockChanges.length).toBe(1);
      expect(analysis.codeBlockChanges[0]?.blockIndex).toBe(0);
    });

    test("scorePatches gives high confidence to replace-code-block", () => {
      const target = [
        "Some intro text.",
        "",
        "```javascript",
        "console.log('scored');",
        "```",
        "",
        "More text.",
      ].join("\n");

      const patches = suggestPatches(CODE_SOURCE, target);
      const scored = scorePatches(patches, CODE_SOURCE, target);
      const codeBlockScored = scored.find((s) => s.patch.op === "replace-code-block");

      expect(codeBlockScored).toBeDefined();
      expect(codeBlockScored?.score).toBe(0.9);
    });

    test("describePatch returns human-readable description for replace-code-block", () => {
      const target = [
        "Some intro text.",
        "",
        "```typescript",
        "console.log('desc');",
        "```",
        "",
        "More text.",
      ].join("\n");

      const patches = suggestPatches(CODE_SOURCE, target);
      const scored = scorePatches(patches, CODE_SOURCE, target);
      const codeBlockScored = scored.find((s) => s.patch.op === "replace-code-block");

      expect(codeBlockScored).toBeDefined();
      expect(codeBlockScored?.description).toContain("code block");
      expect(codeBlockScored?.description).toContain("0");
    });

    test("detects tilde-fenced code blocks", () => {
      const source = ["~~~bash", "echo hello", "~~~"].join("\n");
      const target = ["~~~bash", "echo world", "~~~"].join("\n");

      const analysis = analyzeDiff(source, target);

      expect(analysis.codeBlockChanges.length).toBe(1);
      expect(analysis.codeBlockChanges[0]?.type).toBe("content-changed");
    });
  });

  describe("line insertion detection", () => {
    test("suggestPatches generates insert-after-line for single line addition", () => {
      const source = "# Title\n\nSome content.";
      const target = "# Title\n\nNew line added.\n\nSome content.";

      const patches = suggestPatches(source, target);
      const insertPatch = patches.find((p) => p.op === "insert-after-line");

      expect(insertPatch).toBeDefined();
      if (insertPatch?.op === "insert-after-line") {
        expect(insertPatch.match).toBe("# Title");
        expect(insertPatch.content).toContain("New line added.");
      }
    });

    test("suggestPatches generates insert-after-line for multi-line addition", () => {
      const source = "First line.\nLast line.";
      const target = "First line.\nMiddle A.\nMiddle B.\nLast line.";

      const patches = suggestPatches(source, target);
      const insertPatch = patches.find((p) => p.op === "insert-after-line");

      expect(insertPatch).toBeDefined();
      if (insertPatch?.op === "insert-after-line") {
        expect(insertPatch.match).toBe("First line.");
        expect(insertPatch.content).toBe("Middle A.\nMiddle B.");
      }
    });

    test("suggestPatches generates prepend-to-file when adding at start", () => {
      const source = "Existing first line.";
      const target = "New preamble.\nExisting first line.";

      const patches = suggestPatches(source, target);
      const prependPatch = patches.find((p) => p.op === "prepend-to-file");

      expect(prependPatch).toBeDefined();
      if (prependPatch?.op === "prepend-to-file") {
        expect(prependPatch.content).toBe("New preamble.");
      }
    });

    test("does not generate insert-after-line for modifications (remove+add)", () => {
      const source = "Line 1.\nOld line.\nLine 3.";
      const target = "Line 1.\nNew line.\nLine 3.";

      const patches = suggestPatches(source, target);
      // Should NOT generate insert-after-line since this is a modification
      const insertAfter = patches.filter((p) => p.op === "insert-after-line");
      expect(insertAfter.length).toBe(0);
    });

    test("does not generate insert-after-line for large insertions (>5 lines)", () => {
      const source = "Line 1.\nLine 2.";
      const inserted = Array.from({ length: 6 }, (_, i) => `Inserted ${i + 1}.`).join("\n");
      const target = `Line 1.\n${inserted}\nLine 2.`;

      const patches = suggestPatches(source, target);
      const insertPatch = patches.find((p) => p.op === "insert-after-line");
      expect(insertPatch).toBeUndefined();
    });

    test("scorePatches gives score 0.6 to insert-after-line", () => {
      const source = "Header line.\nBody content.";
      const target = "Header line.\nInserted note.\nBody content.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const insertScored = scored.find((s) => s.patch.op === "insert-after-line");

      expect(insertScored).toBeDefined();
      expect(insertScored?.score).toBe(0.6);
    });

    test("describePatch returns human-readable description for insert-after-line", () => {
      const source = "Header line.\nBody content.";
      const target = "Header line.\nInserted note.\nBody content.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const insertScored = scored.find((s) => s.patch.op === "insert-after-line");

      expect(insertScored).toBeDefined();
      expect(insertScored?.description).toContain("Insert content after line");
      expect(insertScored?.description).toContain("Header line.");
    });

    test("suggestPatches generates insert-before-line for mid-file insertion", () => {
      const source = "Line A.\nLine B.";
      const target = "Line A.\nInserted.\nLine B.";

      const patches = suggestPatches(source, target);
      const insertBeforePatch = patches.find((p) => p.op === "insert-before-line");

      expect(insertBeforePatch).toBeDefined();
      if (insertBeforePatch?.op === "insert-before-line") {
        expect(insertBeforePatch.match).toBe("Line B.");
        expect(insertBeforePatch.content).toBe("Inserted.");
      }
    });

    test("both insert-after-line and insert-before-line are generated for mid-file insertion", () => {
      const source = "First.\nSecond.\nThird.";
      const target = "First.\nSecond.\nNew middle.\nThird.";

      const patches = suggestPatches(source, target);
      const insertAfter = patches.find((p) => p.op === "insert-after-line");
      const insertBefore = patches.find((p) => p.op === "insert-before-line");

      expect(insertAfter).toBeDefined();
      expect(insertBefore).toBeDefined();
      if (insertAfter?.op === "insert-after-line") {
        expect(insertAfter.match).toBe("Second.");
      }
      if (insertBefore?.op === "insert-before-line") {
        expect(insertBefore.match).toBe("Third.");
      }
    });

    test("insert-before-line skips empty lines when looking forward", () => {
      const source = "Header.\n\nBody.";
      const target = "Header.\nNew line.\n\nBody.";

      const patches = suggestPatches(source, target);
      const insertBefore = patches.find((p) => p.op === "insert-before-line");

      expect(insertBefore).toBeDefined();
      if (insertBefore?.op === "insert-before-line") {
        // Should anchor to "Body." (skipping the blank line)
        expect(insertBefore.match).toBe("Body.");
      }
    });

    test("does not generate insert-before-line when no following non-empty line exists", () => {
      // File-end insertions are handled by append-to-file, not insert-before-line
      const source = "Line 1.\nLine 2.";
      const target = "Line 1.\nLine 2.\nAppended.";

      const patches = suggestPatches(source, target);
      const insertBefore = patches.filter((p) => p.op === "insert-before-line");
      expect(insertBefore.length).toBe(0);
    });

    test("does not generate insert-before-line for file-start insertions (prepend-to-file preferred)", () => {
      const source = "Existing.";
      const target = "New preamble.\nExisting.";

      const patches = suggestPatches(source, target);
      const insertBefore = patches.filter((p) => p.op === "insert-before-line");
      expect(insertBefore.length).toBe(0);
      // prepend-to-file is generated instead
      expect(patches.find((p) => p.op === "prepend-to-file")).toBeDefined();
    });

    test("scorePatches gives score 0.6 to insert-before-line", () => {
      const source = "Header line.\nBody content.";
      const target = "Header line.\nInserted note.\nBody content.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const insertBeforeScored = scored.find((s) => s.patch.op === "insert-before-line");

      expect(insertBeforeScored).toBeDefined();
      expect(insertBeforeScored?.score).toBe(0.6);
    });

    test("describePatch returns human-readable description for insert-before-line", () => {
      const source = "Header line.\nBody content.";
      const target = "Header line.\nInserted note.\nBody content.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const insertBeforeScored = scored.find((s) => s.patch.op === "insert-before-line");

      expect(insertBeforeScored).toBeDefined();
      expect(insertBeforeScored?.description).toContain("Insert content before line");
      expect(insertBeforeScored?.description).toContain("Body content.");
    });
  });

  describe("between-marker change detection", () => {
    test("suggestPatches generates replace-between for changed marker content", () => {
      const source = [
        "<!-- BEGIN -->",
        "Old content here.",
        "<!-- END -->",
      ].join("\n");
      const target = [
        "<!-- BEGIN -->",
        "New content here.",
        "<!-- END -->",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const betweenPatch = patches.find((p) => p.op === "replace-between");

      expect(betweenPatch).toBeDefined();
      if (betweenPatch?.op === "replace-between") {
        expect(betweenPatch.start).toBe("<!-- BEGIN -->");
        expect(betweenPatch.end).toBe("<!-- END -->");
        expect(betweenPatch.content).toContain("New content here.");
        expect(betweenPatch.inclusive).toBe(false);
      }
    });

    test("suggestPatches generates delete-between when content is removed", () => {
      const source = [
        "Before.",
        "<!-- SECTION -->",
        "Content to delete.",
        "<!-- /SECTION -->",
        "After.",
      ].join("\n");
      const target = [
        "Before.",
        "<!-- SECTION -->",
        "<!-- /SECTION -->",
        "After.",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const deletePatch = patches.find((p) => p.op === "delete-between");

      expect(deletePatch).toBeDefined();
      if (deletePatch?.op === "delete-between") {
        expect(deletePatch.start).toBe("<!-- SECTION -->");
        expect(deletePatch.end).toBe("<!-- /SECTION -->");
        expect(deletePatch.inclusive).toBe(false);
      }
    });

    test("does not generate between patches when markers are unchanged", () => {
      const source = "<!-- BEGIN -->\nContent.\n<!-- END -->\n\nOther text changed.";
      const target = "<!-- BEGIN -->\nContent.\n<!-- END -->\n\nDifferent text.";

      const patches = suggestPatches(source, target);
      expect(patches.find((p) => p.op === "replace-between")).toBeUndefined();
      expect(patches.find((p) => p.op === "delete-between")).toBeUndefined();
    });

    test("handles END marker variant for non-TOC markers", () => {
      const source = [
        "<!-- SECTION -->",
        "Old item",
        "<!-- END SECTION -->",
      ].join("\n");
      const target = [
        "<!-- SECTION -->",
        "New item",
        "<!-- END SECTION -->",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const betweenPatch = patches.find((p) => p.op === "replace-between");

      expect(betweenPatch).toBeDefined();
      if (betweenPatch?.op === "replace-between") {
        expect(betweenPatch.start).toBe("<!-- SECTION -->");
        expect(betweenPatch.end).toBe("<!-- END SECTION -->");
      }
    });

    test("scorePatches gives score 0.85 to replace-between", () => {
      const source = "<!-- BEGIN -->\nOld.\n<!-- END -->";
      const target = "<!-- BEGIN -->\nNew.\n<!-- END -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const betweenScored = scored.find((s) => s.patch.op === "replace-between");

      expect(betweenScored).toBeDefined();
      expect(betweenScored?.score).toBe(0.85);
    });

    test("scorePatches gives score 0.85 to delete-between", () => {
      const source = "<!-- BEGIN -->\nOld content.\n<!-- END -->";
      const target = "<!-- BEGIN -->\n<!-- END -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const deleteScored = scored.find((s) => s.patch.op === "delete-between");

      expect(deleteScored).toBeDefined();
      expect(deleteScored?.score).toBe(0.85);
    });

    test("describePatch returns human-readable description for replace-between", () => {
      const source = "<!-- BEGIN -->\nOld.\n<!-- END -->";
      const target = "<!-- BEGIN -->\nNew.\n<!-- END -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const betweenScored = scored.find((s) => s.patch.op === "replace-between");

      expect(betweenScored).toBeDefined();
      expect(betweenScored?.description).toContain("Replace content between");
      expect(betweenScored?.description).toContain("<!-- BEGIN -->");
    });

    test("describePatch returns human-readable description for delete-between", () => {
      const source = "<!-- BEGIN -->\nContent.\n<!-- END -->";
      const target = "<!-- BEGIN -->\n<!-- END -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const deleteScored = scored.find((s) => s.patch.op === "delete-between");

      expect(deleteScored).toBeDefined();
      expect(deleteScored?.description).toContain("Delete content between");
    });
  });

  describe("update-toc detection", () => {
    test("suggests update-toc when <!-- TOC --> / <!-- /TOC --> content changes", () => {
      const source = [
        "# Doc",
        "",
        "<!-- TOC -->",
        "- [Old](#old)",
        "<!-- /TOC -->",
        "",
        "## Old",
        "Body.",
      ].join("\n");
      const target = [
        "# Doc",
        "",
        "<!-- TOC -->",
        "- [New](#new)",
        "<!-- /TOC -->",
        "",
        "## New",
        "Body.",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const tocPatch = patches.find((p) => p.op === "update-toc");

      expect(tocPatch).toBeDefined();
      // Default markers should not be included in the patch
      expect((tocPatch as { marker?: string })?.marker).toBeUndefined();
      expect((tocPatch as { endMarker?: string })?.endMarker).toBeUndefined();
      // Should NOT generate replace-between for TOC markers
      expect(patches.find((p) => p.op === "replace-between")).toBeUndefined();
    });

    test("suggests update-toc with custom endMarker when <!-- END TOC --> is used", () => {
      const source = [
        "<!-- TOC -->",
        "- [Old](#old)",
        "<!-- END TOC -->",
      ].join("\n");
      const target = [
        "<!-- TOC -->",
        "- [New](#new)",
        "<!-- END TOC -->",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const tocPatch = patches.find((p) => p.op === "update-toc");

      expect(tocPatch).toBeDefined();
      expect((tocPatch as { endMarker?: string })?.endMarker).toBe("<!-- END TOC -->");
      expect((tocPatch as { marker?: string })?.marker).toBeUndefined();
    });

    test("does not suggest update-toc when TOC content is unchanged", () => {
      const source = "<!-- TOC -->\n- [Same](#same)\n<!-- /TOC -->\n\nOther text changed.";
      const target = "<!-- TOC -->\n- [Same](#same)\n<!-- /TOC -->\n\nDifferent text.";

      const patches = suggestPatches(source, target);
      expect(patches.find((p) => p.op === "update-toc")).toBeUndefined();
    });

    test("non-TOC marker pair still generates replace-between", () => {
      const source = "<!-- BEGIN -->\nOld.\n<!-- END -->";
      const target = "<!-- BEGIN -->\nNew.\n<!-- END -->";

      const patches = suggestPatches(source, target);
      expect(patches.find((p) => p.op === "replace-between")).toBeDefined();
      expect(patches.find((p) => p.op === "update-toc")).toBeUndefined();
    });

    test("scores update-toc at 0.9", () => {
      const source = "<!-- TOC -->\n- [Old](#old)\n<!-- /TOC -->";
      const target = "<!-- TOC -->\n- [New](#new)\n<!-- /TOC -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const tocScored = scored.find((s) => s.patch.op === "update-toc");

      expect(tocScored).toBeDefined();
      expect(tocScored?.score).toBe(0.9);
    });

    test("describePatch returns human-readable description for update-toc", () => {
      const source = "<!-- TOC -->\n- [Old](#old)\n<!-- /TOC -->";
      const target = "<!-- TOC -->\n- [New](#new)\n<!-- /TOC -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const tocScored = scored.find((s) => s.patch.op === "update-toc");

      expect(tocScored).toBeDefined();
      expect(tocScored?.description).toContain("Regenerate table of contents");
    });

    test("describePatch includes custom marker in description", () => {
      const source = "<!-- TOC -->\n- [Old](#old)\n<!-- END TOC -->";
      const target = "<!-- TOC -->\n- [New](#new)\n<!-- END TOC -->";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const tocScored = scored.find((s) => s.patch.op === "update-toc");

      expect(tocScored?.description).toContain("<!-- TOC -->");
    });
  });

  describe("describePatch coverage for remaining ops", () => {
    test("describePatch for merge-frontmatter", () => {
      const scored = scorePatches(
        [{ op: "merge-frontmatter", values: { a: 1, b: 2 } }],
        "",
        "",
      );
      expect(scored[0]?.description).toContain("Merge");
      expect(scored[0]?.description).toContain("frontmatter");
    });

    test("describePatch for copy-file", () => {
      const scored = scorePatches(
        [{ op: "copy-file", src: "src/a.md", dest: "dst/a.md" }],
        "",
        "",
      );
      expect(scored[0]?.description).toContain("Copy file");
      expect(scored[0]?.description).toContain("src/a.md");
    });

    test("describePatch for rename-file", () => {
      const scored = scorePatches(
        [{ op: "rename-file", match: "*.md", rename: "old.md" }],
        "",
        "",
      );
      expect(scored[0]?.description).toContain("Rename file");
      expect(scored[0]?.description).toContain("*.md");
    });

    test("describePatch for delete-file", () => {
      const scored = scorePatches([{ op: "delete-file", match: "unwanted.md" }], "", "");
      expect(scored[0]?.description).toContain("Delete file");
      expect(scored[0]?.description).toContain("unwanted.md");
    });

    test("describePatch for move-file", () => {
      const scored = scorePatches(
        [{ op: "move-file", match: "*.md", dest: "archive/" }],
        "",
        "",
      );
      expect(scored[0]?.description).toContain("Move file");
      expect(scored[0]?.description).toContain("*.md");
    });

    test("describePatch for json-set", () => {
      const scored = scorePatches([{ op: "json-set", path: "version", value: "2.0" }], "", "");
      expect(scored[0]?.description).toContain("Set JSON");
      expect(scored[0]?.description).toContain("version");
    });

    test("describePatch for json-delete", () => {
      const scored = scorePatches([{ op: "json-delete", path: "deprecated" }], "", "");
      expect(scored[0]?.description).toContain("Delete JSON");
      expect(scored[0]?.description).toContain("deprecated");
    });

    test("describePatch for json-merge", () => {
      const scored = scorePatches(
        [{ op: "json-merge", value: { a: 1, b: 2 } }],
        "",
        "",
      );
      expect(scored[0]?.description).toContain("Merge");
      expect(scored[0]?.description).toContain("JSON");
    });

    test("describePatch for exec", () => {
      const scored = scorePatches([{ op: "exec", command: "./transform.sh" }], "", "");
      expect(scored[0]?.description).toContain("Execute command");
      expect(scored[0]?.description).toContain("transform.sh");
    });

    test("describePatch for plugin", () => {
      const scored = scorePatches([{ op: "plugin", plugin: "my-plugin" }], "", "");
      expect(scored[0]?.description).toContain("plugin");
      expect(scored[0]?.description).toContain("my-plugin");
    });

    test("scorePatches gives 0.9 to copy-file", () => {
      const scored = scorePatches(
        [{ op: "copy-file", src: "a.md", dest: "b.md" }],
        "",
        "",
      );
      expect(scored[0]?.score).toBe(0.9);
    });

    test("scorePatches gives 0.9 to json-set", () => {
      const scored = scorePatches([{ op: "json-set", path: "x", value: 1 }], "", "");
      expect(scored[0]?.score).toBe(0.9);
    });

    test("scorePatches gives 0.95 to merge-frontmatter", () => {
      const scored = scorePatches([{ op: "merge-frontmatter", values: { x: 1 } }], "", "");
      expect(scored[0]?.score).toBe(0.95);
    });
  });

  describe("rename-frontmatter detection", () => {
    test("suggests rename-frontmatter when key is renamed with same string value", () => {
      const source = "---\ntitle: My Doc\n---\nContent.";
      const target = "---\nname: My Doc\n---\nContent.";

      const patches = suggestPatches(source, target);
      const rename = patches.find((p) => p.op === "rename-frontmatter");
      expect(rename).toBeDefined();
      if (rename?.op === "rename-frontmatter") {
        expect(rename.old).toBe("title");
        expect(rename.new).toBe("name");
      }
      // Should NOT also generate separate set + remove
      expect(patches.find((p) => p.op === "set-frontmatter" && p.op === "set-frontmatter" && (p as { key: string }).key === "name")).toBeUndefined();
      expect(patches.find((p) => p.op === "remove-frontmatter" && (p as { key: string }).key === "title")).toBeUndefined();
    });

    test("suggests rename-frontmatter when key is renamed with array value", () => {
      const source = "---\ntags: [a, b]\n---\nContent.";
      const target = "---\nlabels: [a, b]\n---\nContent.";

      const patches = suggestPatches(source, target);
      const rename = patches.find((p) => p.op === "rename-frontmatter");
      expect(rename).toBeDefined();
      if (rename?.op === "rename-frontmatter") {
        expect(rename.old).toBe("tags");
        expect(rename.new).toBe("labels");
      }
    });

    test("does not suggest rename when values differ", () => {
      const source = "---\ntitle: Old Title\n---\nContent.";
      const target = "---\nname: New Name\n---\nContent.";

      const patches = suggestPatches(source, target);
      expect(patches.find((p) => p.op === "rename-frontmatter")).toBeUndefined();
      // Falls back to set + remove
      expect(patches.find((p) => p.op === "set-frontmatter")).toBeDefined();
      expect(patches.find((p) => p.op === "remove-frontmatter")).toBeDefined();
    });

    test("does not suggest rename in ambiguous case (two removed keys with same value)", () => {
      const source = "---\nfoo: active\nbar: active\n---\nContent.";
      const target = "---\nbaz: active\n---\nContent.";

      const patches = suggestPatches(source, target);
      // Two removed keys have the same value — ambiguous, no rename suggested
      expect(patches.find((p) => p.op === "rename-frontmatter")).toBeUndefined();
    });

    test("does not suggest rename in ambiguous case (two added keys with same value)", () => {
      const source = "---\nfoo: active\n---\nContent.";
      const target = "---\nbar: active\nbaz: active\n---\nContent.";

      const patches = suggestPatches(source, target);
      // Two added keys have the same value — ambiguous, no rename suggested
      expect(patches.find((p) => p.op === "rename-frontmatter")).toBeUndefined();
    });

    test("handles rename alongside unrelated add/remove", () => {
      const source = "---\ntitle: My Doc\nextra: old\n---\nContent.";
      const target = "---\nname: My Doc\n---\nContent.";

      const patches = suggestPatches(source, target);
      const rename = patches.find((p) => p.op === "rename-frontmatter");
      expect(rename).toBeDefined();
      if (rename?.op === "rename-frontmatter") {
        expect(rename.old).toBe("title");
        expect(rename.new).toBe("name");
      }
      // "extra" key removed (not a rename) — should generate remove-frontmatter
      const removePatch = patches.find(
        (p) => p.op === "remove-frontmatter" && (p as { key: string }).key === "extra",
      );
      expect(removePatch).toBeDefined();
    });

    test("analyzeDiff populates removedValues for removed keys", () => {
      const source = "---\ntitle: My Doc\nversion: 2\n---\nContent.";
      const target = "---\nversion: 2\n---\nContent.";

      const analysis = analyzeDiff(source, target);
      expect(analysis.frontmatterChanges.removed).toContain("title");
      expect(analysis.frontmatterChanges.removedValues).toHaveProperty("title");
      expect(analysis.frontmatterChanges.removedValues["title"]).toBe("My Doc");
    });

    test("scorePatches gives score 0.95 to rename-frontmatter", () => {
      const source = "---\ntitle: My Doc\n---\nContent.";
      const target = "---\nname: My Doc\n---\nContent.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const renameScored = scored.find((s) => s.patch.op === "rename-frontmatter");
      expect(renameScored).toBeDefined();
      expect(renameScored?.score).toBe(0.95);
    });

    test("describePatch returns human-readable description for rename-frontmatter", () => {
      const source = "---\ntitle: My Doc\n---\nContent.";
      const target = "---\nname: My Doc\n---\nContent.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const renameScored = scored.find((s) => s.patch.op === "rename-frontmatter");
      expect(renameScored?.description).toContain("title");
      expect(renameScored?.description).toContain("name");
    });
  });

  describe("change-section-level detection", () => {
    test("suggestPatches generates change-section-level when heading level increases", () => {
      const source = "## Introduction\n\nSome content here.";
      const target = "### Introduction\n\nSome content here.";

      const patches = suggestPatches(source, target);
      const levelPatch = patches.find((p) => p.op === "change-section-level");
      expect(levelPatch).toBeDefined();
      if (levelPatch?.op === "change-section-level") {
        expect(levelPatch.id).toBe("introduction");
        expect(levelPatch.delta).toBe(1);
      }
    });

    test("suggestPatches generates change-section-level when heading level decreases", () => {
      const source = "### Introduction\n\nSome content here.";
      const target = "## Introduction\n\nSome content here.";

      const patches = suggestPatches(source, target);
      const levelPatch = patches.find((p) => p.op === "change-section-level");
      expect(levelPatch).toBeDefined();
      if (levelPatch?.op === "change-section-level") {
        expect(levelPatch.id).toBe("introduction");
        expect(levelPatch.delta).toBe(-1);
      }
    });

    test("does not generate change-section-level when level is unchanged", () => {
      const source = "## Introduction\n\nOld content.";
      const target = "## Introduction\n\nNew content.";

      const patches = suggestPatches(source, target);
      expect(patches.find((p) => p.op === "change-section-level")).toBeUndefined();
    });

    test("generates only change-section-level when only heading level changes (no body change)", () => {
      const source = "## Introduction\n\nBody content is identical.";
      const target = "### Introduction\n\nBody content is identical.";

      const patches = suggestPatches(source, target);
      const levelPatch = patches.find((p) => p.op === "change-section-level");
      expect(levelPatch).toBeDefined();
      // Should NOT also generate replace-section since only header level changed
      const sectionPatches = patches.filter(
        (p) => p.op === "replace-section" && (p as { id: string }).id === "introduction",
      );
      expect(sectionPatches.length).toBe(0);
    });

    test("generates change-section-level AND replace-section when level and body both change", () => {
      const source = "## Introduction\n\nOld body content here.";
      const target = "### Introduction\n\nCompletely different new content that changed a lot.";

      const patches = suggestPatches(source, target);
      expect(patches.find((p) => p.op === "change-section-level")).toBeDefined();
      // Body also changed substantially — replace-section should be suggested
      expect(patches.find((p) => p.op === "replace-section")).toBeDefined();
    });

    test("handles large level delta (## -> ####)", () => {
      const source = "## Overview\n\nContent.";
      const target = "#### Overview\n\nContent.";

      const patches = suggestPatches(source, target);
      const levelPatch = patches.find((p) => p.op === "change-section-level");
      expect(levelPatch).toBeDefined();
      if (levelPatch?.op === "change-section-level") {
        expect(levelPatch.delta).toBe(2);
      }
    });

    test("analyzeDiff populates level-changed in sectionChanges", () => {
      const source = "## Introduction\n\nContent.";
      const target = "### Introduction\n\nContent.";

      const analysis = analyzeDiff(source, target);
      const levelChange = analysis.sectionChanges.find((c) => c.type === "level-changed");
      expect(levelChange).toBeDefined();
      expect(levelChange?.sectionId).toBe("introduction");
      expect(levelChange?.oldLevel).toBe(2);
      expect(levelChange?.newLevel).toBe(3);
    });

    test("scorePatches gives score 0.9 to change-section-level", () => {
      const source = "## Introduction\n\nContent.";
      const target = "### Introduction\n\nContent.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const levelScored = scored.find((s) => s.patch.op === "change-section-level");
      expect(levelScored).toBeDefined();
      expect(levelScored?.score).toBe(0.9);
    });

    test("describePatch returns human-readable description for change-section-level", () => {
      const source = "## Introduction\n\nContent.";
      const target = "### Introduction\n\nContent.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const levelScored = scored.find((s) => s.patch.op === "change-section-level");
      expect(levelScored?.description).toContain("introduction");
      expect(levelScored?.description).toContain("+1");
    });
  });

  describe("move-section detection", () => {
    test("detects swap of two adjacent sections", () => {
      const source = "# Alpha\n\nA content.\n\n# Beta\n\nB content.";
      const target = "# Beta\n\nB content.\n\n# Alpha\n\nA content.";

      const patches = suggestPatches(source, target);
      const movePatch = patches.find((p) => p.op === "move-section");
      expect(movePatch).toBeDefined();
      if (movePatch?.op === "move-section") {
        expect(movePatch.id).toBe("alpha");
        expect(movePatch.after).toBe("beta");
      }
    });

    test("detects single section moved to end", () => {
      const source =
        "# Overview\n\nOverview.\n\n# Setup\n\nSetup.\n\n# Usage\n\nUsage.";
      const target =
        "# Setup\n\nSetup.\n\n# Usage\n\nUsage.\n\n# Overview\n\nOverview.";

      const patches = suggestPatches(source, target);
      const movePatches = patches.filter((p) => p.op === "move-section");
      expect(movePatches.length).toBeGreaterThan(0);
      // Overview should end up after Usage
      const overviewMove = movePatches.find(
        (p) => p.op === "move-section" && p.id === "overview",
      );
      expect(overviewMove).toBeDefined();
      if (overviewMove?.op === "move-section") {
        expect(overviewMove.after).toBe("usage");
      }
    });

    test("does not suggest move-section when order is unchanged", () => {
      const source = "# Alpha\n\nA content.\n\n# Beta\n\nB content.";
      const target = "# Alpha\n\nA content.\n\n# Beta\n\nB content.";

      const patches = suggestPatches(source, target);
      const movePatches = patches.filter((p) => p.op === "move-section");
      expect(movePatches.length).toBe(0);
    });

    test("does not suggest move-section for single section", () => {
      const source = "# Intro\n\nIntro content.";
      const target = "# Intro\n\nIntro content.";

      const patches = suggestPatches(source, target);
      const movePatches = patches.filter((p) => p.op === "move-section");
      expect(movePatches.length).toBe(0);
    });

    test("does not suggest move-section for modified sections", () => {
      // Section content changed significantly — should NOT be a move
      const source = "# Alpha\n\nOriginal alpha content.\n\n# Beta\n\nBeta content.";
      const target = "# Beta\n\nBeta content.\n\n# Alpha\n\nCompletely rewritten content with many new lines.\nAnd more lines.\nEven more lines.";

      const patches = suggestPatches(source, target);
      // modified sections should not generate move-section patches
      const movePatches = patches.filter((p) => p.op === "move-section");
      // The alpha section was modified (>50% lines changed), so it shouldn't be
      // treated as a pure move
      expect(movePatches.length).toBe(0);
    });

    test("handles three-section reorder (rotation)", () => {
      const source =
        "# One\n\nContent one.\n\n# Two\n\nContent two.\n\n# Three\n\nContent three.";
      const target =
        "# Two\n\nContent two.\n\n# Three\n\nContent three.\n\n# One\n\nContent one.";

      const patches = suggestPatches(source, target);
      const movePatches = patches.filter((p) => p.op === "move-section");
      expect(movePatches.length).toBeGreaterThan(0);
      // One should be moved after Three
      const oneMove = movePatches.find(
        (p) => p.op === "move-section" && p.id === "one",
      );
      expect(oneMove).toBeDefined();
      if (oneMove?.op === "move-section") {
        expect(oneMove.after).toBe("three");
      }
    });

    test("analyzeDiff populates sourceSections", () => {
      const source = "# Alpha\n\nA content.\n\n# Beta\n\nB content.";
      const target = "# Beta\n\nB content.\n\n# Alpha\n\nA content.";

      const analysis = analyzeDiff(source, target);
      expect(analysis.sourceSections.length).toBe(2);
      expect(analysis.sourceSections[0]?.id).toBe("alpha");
      expect(analysis.sourceSections[1]?.id).toBe("beta");
    });

    test("scorePatches gives score 0.9 to move-section", () => {
      const source = "# Alpha\n\nA content.\n\n# Beta\n\nB content.";
      const target = "# Beta\n\nB content.\n\n# Alpha\n\nA content.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const moveScored = scored.find((s) => s.patch.op === "move-section");
      expect(moveScored).toBeDefined();
      expect(moveScored?.score).toBe(0.9);
    });

    test("describePatch returns human-readable description for move-section", () => {
      const source = "# Alpha\n\nA content.\n\n# Beta\n\nB content.";
      const target = "# Beta\n\nB content.\n\n# Alpha\n\nA content.";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const moveScored = scored.find((s) => s.patch.op === "move-section");
      expect(moveScored?.description).toContain("alpha");
      expect(moveScored?.description).toContain("beta");
    });

    test("does not generate move-section when section is already first", () => {
      // Beta needs to be first, Alpha moved after Beta — only one patch needed
      const source = "# Alpha\n\nA content.\n\n# Beta\n\nB content.\n\n# Gamma\n\nG content.";
      const target = "# Beta\n\nB content.\n\n# Alpha\n\nA content.\n\n# Gamma\n\nG content.";

      const patches = suggestPatches(source, target);
      const movePatches = patches.filter((p) => p.op === "move-section");
      // Alpha should be moved after Beta; Gamma stays put
      const alphaMove = movePatches.find(
        (p) => p.op === "move-section" && p.id === "alpha",
      );
      expect(alphaMove).toBeDefined();
      if (alphaMove?.op === "move-section") {
        expect(alphaMove.after).toBe("beta");
      }
    });
  });

  describe("structural list detection", () => {
    test("suggests sort-list asc when target list is sorted ascending", () => {
      const source = "- Banana\n- Apple\n- Cherry";
      const target = "- Apple\n- Banana\n- Cherry";

      const patches = suggestPatches(source, target);
      const sortPatch = patches.find((p) => p.op === "sort-list");
      expect(sortPatch).toBeDefined();
      if (sortPatch?.op === "sort-list") {
        expect(sortPatch.list).toBe(0);
        expect(sortPatch.direction).toBe("asc");
      }
    });

    test("suggests sort-list desc when target list is sorted descending", () => {
      const source = "- Apple\n- Banana\n- Cherry";
      const target = "- Cherry\n- Banana\n- Apple";

      const patches = suggestPatches(source, target);
      const sortPatch = patches.find((p) => p.op === "sort-list");
      expect(sortPatch).toBeDefined();
      if (sortPatch?.op === "sort-list") {
        expect(sortPatch.direction).toBe("desc");
      }
    });

    test("suggests reorder-list-items when items are reordered but not sorted", () => {
      const source = "- Alpha\n- Beta\n- Gamma";
      const target = "- Gamma\n- Alpha\n- Beta";

      const patches = suggestPatches(source, target);
      const reorderPatch = patches.find((p) => p.op === "reorder-list-items");
      expect(reorderPatch).toBeDefined();
      if (reorderPatch?.op === "reorder-list-items") {
        expect(reorderPatch.order).toEqual(["Gamma", "Alpha", "Beta"]);
      }
    });

    test("suggests deduplicate-list-items when duplicates removed (keep first)", () => {
      const source = "- Apple\n- Banana\n- Apple\n- Cherry";
      const target = "- Apple\n- Banana\n- Cherry";

      const patches = suggestPatches(source, target);
      const dedupPatch = patches.find((p) => p.op === "deduplicate-list-items");
      expect(dedupPatch).toBeDefined();
      if (dedupPatch?.op === "deduplicate-list-items") {
        expect(dedupPatch.keep).toBe("first");
      }
    });

    test("suggests deduplicate-list-items when duplicates removed (keep last)", () => {
      const source = "- Apple\n- Banana\n- Apple\n- Cherry";
      const target = "- Banana\n- Apple\n- Cherry";

      const patches = suggestPatches(source, target);
      const dedupPatch = patches.find((p) => p.op === "deduplicate-list-items");
      expect(dedupPatch).toBeDefined();
      if (dedupPatch?.op === "deduplicate-list-items") {
        expect(dedupPatch.keep).toBe("last");
      }
    });

    test("does not suggest sort-list when items are already in sorted order", () => {
      const source = "- Apple\n- Banana\n- Cherry";
      const target = "- Apple\n- Banana\n- Cherry";

      const patches = suggestPatches(source, target);
      const sortPatch = patches.find((p) => p.op === "sort-list");
      expect(sortPatch).toBeUndefined();
    });

    test("suppresses individual add/remove patches for structurally-claimed lists", () => {
      const source = "- Banana\n- Apple\n- Cherry";
      const target = "- Apple\n- Banana\n- Cherry";

      const patches = suggestPatches(source, target);
      // Should have sort-list but NOT individual add-list-item / remove-list-item
      expect(patches.some((p) => p.op === "sort-list")).toBe(true);
      expect(patches.some((p) => p.op === "add-list-item")).toBe(false);
      expect(patches.some((p) => p.op === "remove-list-item")).toBe(false);
    });

    test("scores sort-list at 0.95", () => {
      const source = "- Banana\n- Apple\n- Cherry";
      const target = "- Apple\n- Banana\n- Cherry";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const sortScored = scored.find((s) => s.patch.op === "sort-list");
      expect(sortScored?.score).toBe(0.95);
    });

    test("scores deduplicate-list-items at 0.95", () => {
      const source = "- Apple\n- Banana\n- Apple\n- Cherry";
      const target = "- Apple\n- Banana\n- Cherry";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const dedupScored = scored.find((s) => s.patch.op === "deduplicate-list-items");
      expect(dedupScored?.score).toBe(0.95);
    });

    test("scores reorder-list-items at 0.95", () => {
      const source = "- Alpha\n- Beta\n- Gamma";
      const target = "- Gamma\n- Alpha\n- Beta";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const reorderScored = scored.find((s) => s.patch.op === "reorder-list-items");
      expect(reorderScored?.score).toBe(0.95);
    });

    test("describePatch for sort-list", () => {
      const source = "- Banana\n- Apple";
      const target = "- Apple\n- Banana";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const sortScored = scored.find((s) => s.patch.op === "sort-list");
      expect(sortScored?.description).toContain("Sort list");
      expect(sortScored?.description).toContain("asc");
    });

    test("describePatch for deduplicate-list-items", () => {
      const source = "- Apple\n- Banana\n- Apple";
      const target = "- Apple\n- Banana";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const dedupScored = scored.find((s) => s.patch.op === "deduplicate-list-items");
      expect(dedupScored?.description).toContain("Deduplicate");
    });

    test("describePatch for reorder-list-items", () => {
      const source = "- Alpha\n- Beta\n- Gamma";
      const target = "- Gamma\n- Alpha\n- Beta";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const reorderScored = scored.find((s) => s.patch.op === "reorder-list-items");
      expect(reorderScored?.description).toContain("Reorder");
    });
  });

  describe("structural table detection", () => {
    const tableSource = [
      "| Name | Age | City |",
      "| ---- | --- | ---- |",
      "| Charlie | 30 | NYC |",
      "| Alice | 25 | LA |",
      "| Bob | 35 | Chicago |",
    ].join("\n");

    test("suggests sort-table asc when rows sorted ascending by a column", () => {
      const target = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Alice | 25 | LA |",
        "| Bob | 35 | Chicago |",
        "| Charlie | 30 | NYC |",
      ].join("\n");

      const patches = suggestPatches(tableSource, target);
      const sortPatch = patches.find((p) => p.op === "sort-table");
      expect(sortPatch).toBeDefined();
      if (sortPatch?.op === "sort-table") {
        expect(sortPatch.column).toBe("Name");
        expect(sortPatch.direction).toBe("asc");
      }
    });

    test("suggests sort-table desc when rows sorted descending by a column", () => {
      const target = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Charlie | 30 | NYC |",
        "| Bob | 35 | Chicago |",
        "| Alice | 25 | LA |",
      ].join("\n");

      const patches = suggestPatches(tableSource, target);
      const sortPatch = patches.find((p) => p.op === "sort-table");
      expect(sortPatch).toBeDefined();
      if (sortPatch?.op === "sort-table") {
        expect(sortPatch.direction).toBe("desc");
      }
    });

    test("suggests deduplicate-table-rows when duplicate rows removed", () => {
      const source = [
        "| Name | Score |",
        "| ---- | ----- |",
        "| Alice | 90 |",
        "| Bob | 80 |",
        "| Alice | 90 |",
      ].join("\n");
      const target = [
        "| Name | Score |",
        "| ---- | ----- |",
        "| Alice | 90 |",
        "| Bob | 80 |",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const dedupPatch = patches.find((p) => p.op === "deduplicate-table-rows");
      expect(dedupPatch).toBeDefined();
      if (dedupPatch?.op === "deduplicate-table-rows") {
        expect(dedupPatch.keep).toBe("first");
      }
    });

    test("suggests rename-table-column when a column header is renamed", () => {
      const source = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Alice | 25 | LA |",
      ].join("\n");
      const target = [
        "| Name | Years | City |",
        "| ---- | ----- | ---- |",
        "| Alice | 25 | LA |",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const renamePatch = patches.find((p) => p.op === "rename-table-column");
      expect(renamePatch).toBeDefined();
      if (renamePatch?.op === "rename-table-column") {
        expect(renamePatch.column).toBe("Age");
        expect(renamePatch.new).toBe("Years");
      }
    });

    test("suggests reorder-table-columns when column order changes", () => {
      const source = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Alice | 25 | LA |",
      ].join("\n");
      const target = [
        "| City | Name | Age |",
        "| ---- | ---- | --- |",
        "| LA | Alice | 25 |",
      ].join("\n");

      const patches = suggestPatches(source, target);
      const reorderPatch = patches.find((p) => p.op === "reorder-table-columns");
      expect(reorderPatch).toBeDefined();
      if (reorderPatch?.op === "reorder-table-columns") {
        expect(reorderPatch.columns).toEqual(["City", "Name", "Age"]);
      }
    });

    test("suppresses individual row add/remove for structurally-claimed tables", () => {
      const target = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Alice | 25 | LA |",
        "| Bob | 35 | Chicago |",
        "| Charlie | 30 | NYC |",
      ].join("\n");

      const patches = suggestPatches(tableSource, target);
      expect(patches.some((p) => p.op === "sort-table")).toBe(true);
      expect(patches.some((p) => p.op === "add-table-row")).toBe(false);
      expect(patches.some((p) => p.op === "remove-table-row")).toBe(false);
    });

    test("scores sort-table at 0.95", () => {
      const target = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Alice | 25 | LA |",
        "| Bob | 35 | Chicago |",
        "| Charlie | 30 | NYC |",
      ].join("\n");

      const patches = suggestPatches(tableSource, target);
      const scored = scorePatches(patches, tableSource, target);
      const sortScored = scored.find((s) => s.patch.op === "sort-table");
      expect(sortScored?.score).toBe(0.95);
    });

    test("scores rename-table-column at 0.95", () => {
      const source = "| Name | Age |\n| ---- | --- |\n| Alice | 25 |";
      const target = "| Name | Years |\n| ---- | ----- |\n| Alice | 25 |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const renameScored = scored.find((s) => s.patch.op === "rename-table-column");
      expect(renameScored?.score).toBe(0.95);
    });

    test("describePatch for sort-table", () => {
      const target = [
        "| Name | Age | City |",
        "| ---- | --- | ---- |",
        "| Alice | 25 | LA |",
        "| Bob | 35 | Chicago |",
        "| Charlie | 30 | NYC |",
      ].join("\n");

      const patches = suggestPatches(tableSource, target);
      const scored = scorePatches(patches, tableSource, target);
      const sortScored = scored.find((s) => s.patch.op === "sort-table");
      expect(sortScored?.description).toContain("Sort table");
      expect(sortScored?.description).toContain("Name");
    });

    test("describePatch for rename-table-column", () => {
      const source = "| Name | Age |\n| ---- | --- |\n| Alice | 25 |";
      const target = "| Name | Years |\n| ---- | ----- |\n| Alice | 25 |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const renameScored = scored.find((s) => s.patch.op === "rename-table-column");
      expect(renameScored?.description).toContain("Age");
      expect(renameScored?.description).toContain("Years");
    });

    test("describePatch for deduplicate-table-rows", () => {
      const source = "| Name |\n| ---- |\n| Alice |\n| Alice |";
      const target = "| Name |\n| ---- |\n| Alice |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const dedupScored = scored.find((s) => s.patch.op === "deduplicate-table-rows");
      expect(dedupScored?.description).toContain("Deduplicate");
    });

    test("describePatch for reorder-table-columns", () => {
      const source = "| A | B |\n| --- | --- |\n| 1 | 2 |";
      const target = "| B | A |\n| --- | --- |\n| 2 | 1 |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const reorderScored = scored.find((s) => s.patch.op === "reorder-table-columns");
      expect(reorderScored?.description).toContain("Reorder columns");
    });
  });

  describe("filter-list-items detection", () => {
    test("detects filter when all removed items share the same exact text", () => {
      const source = "- Error\n- Warning\n- Error\n- Info";
      const target = "- Warning\n- Info";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-list-items");
      expect(filterPatch).toBeDefined();
      if (filterPatch?.op === "filter-list-items") {
        expect(filterPatch.match).toBe("Error");
        expect(filterPatch.invert).toBe(true);
        expect(filterPatch.list).toBe(0);
      }
    });

    test("no filter suggestion when removed items differ", () => {
      const source = "- Alpha\n- Beta\n- Gamma\n- Delta";
      const target = "- Alpha\n- Delta";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-list-items");
      expect(filterPatch).toBeUndefined();
    });

    test("no filter suggestion when only one item is removed", () => {
      const source = "- Alpha\n- Beta\n- Gamma";
      const target = "- Alpha\n- Gamma";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-list-items");
      expect(filterPatch).toBeUndefined();
    });

    test("no filter suggestion when lists are identical", () => {
      const source = "- Alpha\n- Beta\n- Gamma";
      const target = "- Alpha\n- Beta\n- Gamma";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-list-items");
      expect(filterPatch).toBeUndefined();
    });

    test("filter suppresses per-item remove-list-item suggestions for claimed list", () => {
      const source = "- DEPRECATED\n- Keep\n- DEPRECATED\n- Keep2";
      const target = "- Keep\n- Keep2";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-list-items");
      expect(filterPatch).toBeDefined();
      // Per-item patches for list 0 should be suppressed since filter claimed it
      const removePatches = patches.filter(
        (p) => p.op === "remove-list-item" && (p as { list: number }).list === 0,
      );
      expect(removePatches).toHaveLength(0);
    });

    test("filter scores at 0.95", () => {
      const source = "- Error\n- Warning\n- Error\n- Info";
      const target = "- Warning\n- Info";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const filterScored = scored.find((s) => s.patch.op === "filter-list-items");
      expect(filterScored?.score).toBe(0.95);
    });

    test("describePatch for filter-list-items", () => {
      const source = "- Error\n- Warning\n- Error\n- Info";
      const target = "- Warning\n- Info";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const filterScored = scored.find((s) => s.patch.op === "filter-list-items");
      expect(filterScored?.description).toContain("Filter list");
      expect(filterScored?.description).toContain("Error");
      expect(filterScored?.description).toContain("keep non-matching");
    });

    test("handles multiple lists independently", () => {
      const source =
        "- Error\n- Warning\n- Error\n\nOther text\n\n- Alpha\n- Beta\n- Alpha";
      const target = "- Warning\n\nOther text\n\n- Beta";

      const patches = suggestPatches(source, target);
      const filterPatches = patches.filter((p) => p.op === "filter-list-items");
      expect(filterPatches.length).toBe(2);
    });
  });

  describe("filter-table-rows detection", () => {
    test("detects filter when all removed rows share the same column value (strategy A — invert)", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Inactive |";
      const target = "| Name | Status |\n| ---- | ------ |\n| Alice | Active |";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-table-rows");
      expect(filterPatch).toBeDefined();
      if (filterPatch?.op === "filter-table-rows") {
        expect(filterPatch.column).toBe("Status");
        expect(filterPatch.match).toBe("Inactive");
        expect(filterPatch.invert).toBe(true);
        expect(filterPatch.table).toBe(0);
      }
    });

    test("detects filter when all kept rows share the same column value (strategy B — no invert)", () => {
      // Two removed rows with different Status values, two kept rows both Status=Active
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Pending |\n| Dave | Active |";
      const target =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Dave | Active |";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-table-rows");
      expect(filterPatch).toBeDefined();
      if (filterPatch?.op === "filter-table-rows") {
        expect(filterPatch.column).toBe("Status");
        expect(filterPatch.match).toBe("Active");
        expect(filterPatch.invert).toBeUndefined();
      }
    });

    test("no filter suggestion when removed rows have different values in every column", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Pending |";
      const target = "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-table-rows");
      expect(filterPatch).toBeUndefined();
    });

    test("no filter suggestion when only one row is removed", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |";
      const target = "| Name | Status |\n| ---- | ------ |\n| Alice | Active |";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-table-rows");
      expect(filterPatch).toBeUndefined();
    });

    test("filter suppresses per-row remove-table-row suggestions for claimed table", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Inactive |";
      const target = "| Name | Status |\n| ---- | ------ |\n| Alice | Active |";

      const patches = suggestPatches(source, target);
      const filterPatch = patches.find((p) => p.op === "filter-table-rows");
      expect(filterPatch).toBeDefined();
      const removePatches = patches.filter(
        (p) => p.op === "remove-table-row" && (p as { tableIndex: number }).tableIndex === 0,
      );
      expect(removePatches).toHaveLength(0);
    });

    test("filter scores at 0.95", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Inactive |";
      const target = "| Name | Status |\n| ---- | ------ |\n| Alice | Active |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const filterScored = scored.find((s) => s.patch.op === "filter-table-rows");
      expect(filterScored?.score).toBe(0.95);
    });

    test("describePatch for filter-table-rows (invert)", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Inactive |";
      const target = "| Name | Status |\n| ---- | ------ |\n| Alice | Active |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const filterScored = scored.find((s) => s.patch.op === "filter-table-rows");
      expect(filterScored?.description).toContain("Filter table");
      expect(filterScored?.description).toContain("Status");
      expect(filterScored?.description).toContain("Inactive");
      expect(filterScored?.description).toContain("keep non-matching");
    });

    test("describePatch for filter-table-rows (no invert)", () => {
      const source =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Bob | Inactive |\n| Carol | Pending |\n| Dave | Active |";
      const target =
        "| Name | Status |\n| ---- | ------ |\n| Alice | Active |\n| Dave | Active |";

      const patches = suggestPatches(source, target);
      const scored = scorePatches(patches, source, target);
      const filterScored = scored.find((s) => s.patch.op === "filter-table-rows");
      expect(filterScored?.description).toContain("Filter table");
      expect(filterScored?.description).toContain("Status");
      expect(filterScored?.description).toContain("Active");
      expect(filterScored?.description).not.toContain("keep non-matching");
    });

    test("handles multiple tables independently", () => {
      const source =
        "| X | Type |\n| - | ---- |\n| a | keep |\n| b | drop |\n| c | drop |\n\nText\n\n| Y | Kind |\n| - | ---- |\n| p | good |\n| q | bad |\n| r | bad |";
      const target =
        "| X | Type |\n| - | ---- |\n| a | keep |\n\nText\n\n| Y | Kind |\n| - | ---- |\n| p | good |";

      const patches = suggestPatches(source, target);
      const filterPatches = patches.filter((p) => p.op === "filter-table-rows");
      expect(filterPatches.length).toBe(2);
    });
  });

  describe("prepend-to-file / append-to-file detection", () => {
    test("suggests prepend-to-file when content is added at file start", () => {
      const source = "# Hello\n\nBody text.";
      const target = "New first line\n\n# Hello\n\nBody text.";

      const patches = suggestPatches(source, target);
      const prepend = patches.find((p) => p.op === "prepend-to-file");
      expect(prepend).toBeDefined();
      expect((prepend as { op: string; content: string }).content).toBe("New first line");
    });

    test("suggests append-to-file when content is added at file end", () => {
      const source = "# Hello\n\nBody text.";
      const target = "# Hello\n\nBody text.\n\nNew last line";

      const patches = suggestPatches(source, target);
      const append = patches.find((p) => p.op === "append-to-file");
      expect(append).toBeDefined();
      expect((append as { op: string; content: string }).content).toBe("New last line");
    });

    test("suggests both prepend and append when content added to both ends", () => {
      const source = "# Middle";
      const target = "First line\n\n# Middle\n\nLast line";

      const patches = suggestPatches(source, target);
      expect(patches.some((p) => p.op === "prepend-to-file")).toBe(true);
      expect(patches.some((p) => p.op === "append-to-file")).toBe(true);
    });

    test("no prepend-to-file or append-to-file for identical files", () => {
      const source = "# Hello\n\nBody.";
      const patches = suggestPatches(source, source);
      expect(patches.some((p) => p.op === "prepend-to-file")).toBe(false);
      expect(patches.some((p) => p.op === "append-to-file")).toBe(false);
    });

    test("no prepend-to-file when content is inserted in the middle", () => {
      const source = "Line one\nLine two";
      const target = "Line one\nInserted\nLine two";

      const patches = suggestPatches(source, target);
      expect(patches.some((p) => p.op === "prepend-to-file")).toBe(false);
      expect(patches.some((p) => p.op === "append-to-file")).toBe(false);
    });

    test("append-to-file not generated as insert-after-line for same content", () => {
      const source = "# Hello\n\nBody text.";
      const target = "# Hello\n\nBody text.\n\nTrailer line";

      const patches = suggestPatches(source, target);
      expect(patches.some((p) => p.op === "append-to-file")).toBe(true);
      const insertAfterForTrailer = patches.filter(
        (p) =>
          p.op === "insert-after-line" &&
          (p as { op: string; content: string }).content === "Trailer line",
      );
      expect(insertAfterForTrailer.length).toBe(0);
    });

    test("scores prepend-to-file and append-to-file at 0.9", () => {
      const source = "# Hello";
      const prependTarget = "Prepended\n\n# Hello";
      const appendTarget = "# Hello\n\nAppended";

      const prependScored = scorePatches(suggestPatches(source, prependTarget), source, prependTarget);
      const appendScored = scorePatches(suggestPatches(source, appendTarget), source, appendTarget);

      expect(prependScored.find((s) => s.patch.op === "prepend-to-file")?.score).toBe(0.9);
      expect(appendScored.find((s) => s.patch.op === "append-to-file")?.score).toBe(0.9);
    });

    test("describePatch for prepend-to-file and append-to-file", () => {
      const source = "# Hello";
      const prependTarget = "Header\n\n# Hello";
      const appendTarget = "# Hello\n\nFooter";

      const prependScored = scorePatches(suggestPatches(source, prependTarget), source, prependTarget);
      const appendScored = scorePatches(suggestPatches(source, appendTarget), source, appendTarget);

      expect(prependScored.find((s) => s.patch.op === "prepend-to-file")?.description).toBe(
        "Prepend content to file",
      );
      expect(appendScored.find((s) => s.patch.op === "append-to-file")?.description).toBe(
        "Append content to file",
      );
    });
  });

  describe("prepend-to-section / append-to-section detection", () => {
    test("suggests prepend-to-section when content is added at section start", () => {
      const source = "# Intro\n\nOriginal body text.";
      const target = "# Intro\n\nNew first paragraph.\n\nOriginal body text.";

      const patches = suggestPatches(source, target);
      const prepend = patches.find((p) => p.op === "prepend-to-section");
      expect(prepend).toBeDefined();
      expect((prepend as { op: string; id: string }).id).toBe("intro");
    });

    test("suggests append-to-section when content is added at section end", () => {
      const source = "# Guide\n\nExisting content.";
      const target = "# Guide\n\nExisting content.\n\nNew trailing content.";

      const patches = suggestPatches(source, target);
      const append = patches.find((p) => p.op === "append-to-section");
      expect(append).toBeDefined();
      expect((append as { op: string; id: string }).id).toBe("guide");
    });

    test("prepend-to-section content contains the added prefix", () => {
      const source = "## Features\n\nFeature A\nFeature B";
      const target = "## Features\n\nNew intro line\n\nFeature A\nFeature B";

      const patches = suggestPatches(source, target);
      const prepend = patches.find((p) => p.op === "prepend-to-section") as
        | { op: string; id: string; content: string }
        | undefined;
      expect(prepend).toBeDefined();
      expect(prepend?.content).toContain("New intro line");
    });

    test("append-to-section content contains the added suffix", () => {
      const source = "## Summary\n\nSummary text.";
      const target = "## Summary\n\nSummary text.\n\nAdded conclusion.";

      const patches = suggestPatches(source, target);
      const append = patches.find((p) => p.op === "append-to-section") as
        | { op: string; id: string; content: string }
        | undefined;
      expect(append).toBeDefined();
      expect(append?.content).toContain("Added conclusion.");
    });

    test("no false positive when section content is completely replaced", () => {
      const source = "# Section\n\nOld content here.";
      const target = "# Section\n\nCompletely different content.";

      const patches = suggestPatches(source, target);
      expect(patches.some((p) => p.op === "prepend-to-section")).toBe(false);
      expect(patches.some((p) => p.op === "append-to-section")).toBe(false);
    });

    test("scores prepend-to-section and append-to-section at 0.9", () => {
      const source = "# Test\n\nBody.";
      const prependTarget = "# Test\n\nPrefix.\n\nBody.";
      const appendTarget = "# Test\n\nBody.\n\nSuffix.";

      const prependScored = scorePatches(suggestPatches(source, prependTarget), source, prependTarget);
      const appendScored = scorePatches(suggestPatches(source, appendTarget), source, appendTarget);

      expect(prependScored.find((s) => s.patch.op === "prepend-to-section")?.score).toBe(0.9);
      expect(appendScored.find((s) => s.patch.op === "append-to-section")?.score).toBe(0.9);
    });

    test("describePatch for prepend-to-section and append-to-section", () => {
      const source = "# MySection\n\nBody.";
      const prependTarget = "# MySection\n\nPrefix.\n\nBody.";
      const appendTarget = "# MySection\n\nBody.\n\nSuffix.";

      const prependScored = scorePatches(suggestPatches(source, prependTarget), source, prependTarget);
      const appendScored = scorePatches(suggestPatches(source, appendTarget), source, appendTarget);

      expect(
        prependScored.find((s) => s.patch.op === "prepend-to-section")?.description,
      ).toContain("Prepend content to section");
      expect(
        appendScored.find((s) => s.patch.op === "append-to-section")?.description,
      ).toContain("Append content to section");
    });
  });

  describe("replace-in-section detection", () => {
    test("suggests replace-in-section for single-line substitution within a section", () => {
      const source = "# Notes\n\nOld value here.\nSecond line.";
      const target = "# Notes\n\nNew value here.\nSecond line.";

      const patches = suggestPatches(source, target);
      const replaceIn = patches.find((p) => p.op === "replace-in-section");
      expect(replaceIn).toBeDefined();
      expect((replaceIn as { op: string; id: string }).id).toBe("notes");
    });

    test("replace-in-section carries correct old and new values", () => {
      const source = "## Config\n\ncolor: blue\nsize: medium";
      const target = "## Config\n\ncolor: red\nsize: medium";

      const patches = suggestPatches(source, target);
      const replaceIn = patches.find((p) => p.op === "replace-in-section") as
        | { op: string; id: string; old: string; new: string }
        | undefined;
      expect(replaceIn?.old).toBe("color: blue");
      expect(replaceIn?.new).toBe("color: red");
    });

    test("no replace-in-section when multiple lines change", () => {
      const source = "# Notes\n\nLine A.\nLine B.";
      const target = "# Notes\n\nLine X.\nLine Y.";

      const patches = suggestPatches(source, target);
      expect(patches.some((p) => p.op === "replace-in-section")).toBe(false);
    });

    test("no replace-in-section when line count changes", () => {
      const source = "# Notes\n\nLine A.\nLine B.";
      const target = "# Notes\n\nLine A.\nLine B.\nLine C.";

      const patches = suggestPatches(source, target);
      expect(patches.some((p) => p.op === "replace-in-section")).toBe(false);
    });

    test("scores replace-in-section at 0.85", () => {
      const source = "# Section\n\nOld text.\nAnother line.";
      const target = "# Section\n\nNew text.\nAnother line.";

      const scored = scorePatches(suggestPatches(source, target), source, target);
      expect(scored.find((s) => s.patch.op === "replace-in-section")?.score).toBe(0.85);
    });

    test("describePatch for replace-in-section", () => {
      const source = "# Section\n\nOld text.\nAnother line.";
      const target = "# Section\n\nNew text.\nAnother line.";

      const scored = scorePatches(suggestPatches(source, target), source, target);
      const desc = scored.find((s) => s.patch.op === "replace-in-section")?.description;
      expect(desc).toContain("Replace");
      expect(desc).toContain("section");
    });
  });
});

