/**
 * Tests for change-section-level patch operation
 */

import { describe, expect, test } from "bun:test";
import { applyChangeSectionLevel, applyPatches } from "./patch-engine.js";
import type { PatchOperation } from "./types.js";

describe("applyChangeSectionLevel", () => {
  test("promotes section (negative delta)", () => {
    const content = `# Header 1
Content 1
### Header 3
Content 3
# Header 2`;
    const result = applyChangeSectionLevel(content, "header-3", -1);

    expect(result.content).toContain("## Header 3");
    expect(result.content).toMatch(/^## Header 3$/m);
    expect(result.content).not.toMatch(/^### Header 3$/m);
    expect(result.count).toBe(1);
  });

  test("demotes section (positive delta)", () => {
    const content = `# Header 1
Content 1
## Header 2
Content 2`;
    const result = applyChangeSectionLevel(content, "header-2", 1);

    expect(result.content).toContain("### Header 2");
    expect(result.content).toMatch(/^### Header 2$/m);
    expect(result.content).not.toMatch(/^## Header 2$/m);
    expect(result.count).toBe(1);
  });

  test("promotes by multiple levels", () => {
    const content = `# Header 1
Content 1
##### Header 5
Content 5`;
    const result = applyChangeSectionLevel(content, "header-5", -3);

    expect(result.content).toContain("## Header 5");
    expect(result.content).toMatch(/^## Header 5$/m);
    expect(result.content).not.toMatch(/^##### Header 5$/m);
    expect(result.count).toBe(1);
  });

  test("demotes by multiple levels", () => {
    const content = `# Header 1
Content 1
## Header 2
Content 2`;
    const result = applyChangeSectionLevel(content, "header-2", 3);

    expect(result.content).toContain("##### Header 2");
    expect(result.content).toMatch(/^##### Header 2$/m);
    expect(result.content).not.toMatch(/^## Header 2$/m);
    expect(result.count).toBe(1);
  });

  test("clamps at level 1 (cannot promote below level 1)", () => {
    const content = `# Header 1
Content 1`;
    const result = applyChangeSectionLevel(content, "header-1", -5);

    // Should stay at level 1 due to clamping
    expect(result.content).toContain("# Header 1");
    expect(result.count).toBe(1);
  });

  test("clamps at level 6 (cannot demote above level 6)", () => {
    const content = `###### Header 6
Content 6`;
    const result = applyChangeSectionLevel(content, "header-6", 5);

    // Should stay at level 6 due to clamping
    expect(result.content).toContain("###### Header 6");
    expect(result.count).toBe(1);
  });

  test("clamping from level 2 to level 1", () => {
    const content = `# Top
## Header 2
Content`;
    const result = applyChangeSectionLevel(content, "header-2", -2);

    // Should clamp to level 1
    expect(result.content).toContain("# Header 2");
    expect(result.count).toBe(1);
  });

  test("clamping from level 5 to level 6", () => {
    const content = `##### Header 5
Content`;
    const result = applyChangeSectionLevel(content, "header-5", 3);

    // Should clamp to level 6
    expect(result.content).toContain("###### Header 5");
    expect(result.count).toBe(1);
  });

  test("returns zero count when section not found", () => {
    const content = `# Header 1
Content 1`;
    const result = applyChangeSectionLevel(content, "nonexistent", -1);

    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test("zero delta (no change but counts as success)", () => {
    const content = `# Header 1
## Header 2
Content`;
    const result = applyChangeSectionLevel(content, "header-2", 0);

    // Should remain unchanged but count as successful operation
    expect(result.content).toContain("## Header 2");
    expect(result.count).toBe(1);
  });

  test("preserves header text and custom ID", () => {
    const content = `# Main
## My Section {#custom-id}
Content here`;
    const result = applyChangeSectionLevel(content, "custom-id", 1);

    expect(result.content).toContain("### My Section {#custom-id}");
    expect(result.content).toMatch(/^### My Section \{#custom-id\}$/m);
    expect(result.content).not.toMatch(/^## My Section \{#custom-id\}$/m);
    expect(result.count).toBe(1);
  });

  test("works with custom IDs", () => {
    const content = `# Header 1
## Special Header {#my-special-id}
Content`;
    const result = applyChangeSectionLevel(content, "my-special-id", -1);

    expect(result.content).toContain("# Special Header {#my-special-id}");
    expect(result.count).toBe(1);
  });

  test("preserves content below header", () => {
    const content = `# Header 1
Some content here
More content
## Header 2
Different content
# Header 3`;
    const result = applyChangeSectionLevel(content, "header-2", 1);

    expect(result.content).toContain("### Header 2");
    expect(result.content).toContain("Different content");
    expect(result.content).toContain("Some content here");
    expect(result.content).toContain("More content");
    expect(result.count).toBe(1);
  });

  test("handles header with special characters", () => {
    const content = `# Main
## Header with $pecial Ch@rs! & Symbols?
Content`;
    const result = applyChangeSectionLevel(content, "header-with-pecial-chrs-symbols", 1);

    expect(result.content).toContain("### Header with $pecial Ch@rs! & Symbols?");
    expect(result.count).toBe(1);
  });

  test("handles multiple sections with same operation applied separately", () => {
    const content = `# Header 1
## Header 2
### Header 3`;

    let result = applyChangeSectionLevel(content, "header-2", 1);
    expect(result.content).toContain("### Header 2");

    result = applyChangeSectionLevel(result.content, "header-3", -1);
    expect(result.content).toContain("## Header 3");
  });

  test("level change near boundaries", () => {
    const content = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6`;

    // Promote level 2 to level 1
    let result = applyChangeSectionLevel(content, "level-2", -1);
    expect(result.content).toContain("# Level 2");

    // Demote level 5 to level 6
    result = applyChangeSectionLevel(content, "level-5", 1);
    expect(result.content).toContain("###### Level 5");
  });
});

describe("change-section-level with applyPatches", () => {
  test("applies change-section-level patch", () => {
    const content = `# Introduction
Welcome text

## Getting Started
Setup instructions

### Installation
Install steps`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "installation", delta: -1 },
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain("## Installation");
    expect(result.content).not.toContain("### Installation");
  });

  test("applies multiple change-section-level patches", () => {
    const content = `# Main
## Section A
### Section B
#### Section C`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "section-a", delta: 1 },
      { op: "change-section-level", id: "section-c", delta: -2 },
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(2);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain("### Section A");
    expect(result.content).toContain("## Section C");
  });

  test("generates warning for non-existent section with onNoMatch=warn", () => {
    const content = `# Header 1
## Header 2`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "nonexistent", delta: -1 },
    ];

    const result = applyPatches(content, patches, "warn");

    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("matched 0 times");
  });

  test("throws error for non-existent section with onNoMatch=error", () => {
    const content = `# Header 1
## Header 2`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "nonexistent", delta: -1 },
    ];

    expect(() => applyPatches(content, patches, "error")).toThrow("matched 0 times");
  });

  test("skips non-existent section with onNoMatch=skip", () => {
    const content = `# Header 1
## Header 2`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "nonexistent", delta: -1, onNoMatch: "skip" },
      { op: "change-section-level", id: "header-2", delta: 1 },
    ];

    const result = applyPatches(content, patches, "warn");

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain("### Header 2");
  });

  test("combines with other section operations", () => {
    const content = `# Introduction
Old intro

# Details
Old details

## Subsection
Content`;

    const patches: PatchOperation[] = [
      { op: "replace-section", id: "introduction", content: "New intro text" },
      { op: "change-section-level", id: "subsection", delta: -1 },
      { op: "append-to-section", id: "details", content: "\nAppended content" },
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(3);
    expect(result.content).toContain("New intro text");
    expect(result.content).toContain("# Subsection");
    expect(result.content).toContain("Appended content");
  });

  test("respects per-patch onNoMatch override", () => {
    const content = `# Header 1
## Header 2`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "missing1", delta: -1, onNoMatch: "skip" },
      { op: "change-section-level", id: "missing2", delta: 1, onNoMatch: "warn" },
      { op: "change-section-level", id: "header-2", delta: 1 },
    ];

    const result = applyPatches(content, patches, "error");

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("missing2");
    expect(result.content).toContain("### Header 2");
  });

  test("sequential level changes", () => {
    const content = `# Main
## Section
Content`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "section", delta: 1 },
      { op: "change-section-level", id: "section", delta: 1 },
      { op: "change-section-level", id: "section", delta: -1 },
    ];

    const result = applyPatches(content, patches);

    // Start at ##, add 1 -> ###, add 1 -> ####, subtract 1 -> ###
    expect(result.applied).toBe(3);
    expect(result.content).toContain("### Section");
  });

  test("promoting and demoting in same patch set", () => {
    const content = `# Title
## Section A
### Section B
## Section C`;

    const patches: PatchOperation[] = [
      { op: "change-section-level", id: "section-a", delta: -1 }, // ## -> #
      { op: "change-section-level", id: "section-b", delta: 1 }, // ### -> ####
      { op: "change-section-level", id: "section-c", delta: 2 }, // ## -> ####
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(3);
    expect(result.content).toContain("# Section A");
    expect(result.content).toContain("#### Section B");
    expect(result.content).toContain("#### Section C");
  });

  test("preserves frontmatter when changing section levels", () => {
    const content = `---
title: Test Document
version: 1.0
---
# Introduction
Content

## Details
More content`;

    const patches: PatchOperation[] = [{ op: "change-section-level", id: "details", delta: -1 }];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.content).toContain("title: Test Document");
    // js-yaml serializes numeric values without quotes
    expect(result.content).toMatch(/version: ['"]?1\.0['"]?/);
    expect(result.content).toContain("# Details");
  });
});
