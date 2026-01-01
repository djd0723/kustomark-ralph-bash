/**
 * Tests for the move-section patch operation
 */

import { describe, expect, test } from "bun:test";
import { applyMoveSection, applyPatches } from "./patch-engine.js";
import type { PatchOperation } from "./types.js";

describe("applyMoveSection", () => {
  test("moves a section after another section (basic move)", () => {
    const content = `# Section A
Content A

# Section B
Content B

# Section C
Content C`;

    const result = applyMoveSection(content, "section-a", "section-c");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# Section B");
    expect(result.content).toContain("# Section C");
    expect(result.content).toContain("# Section A");

    // Verify order: B, C, A
    const lines = result.content.split("\n");
    const bIndex = lines.findIndex((line) => line === "# Section B");
    const cIndex = lines.findIndex((line) => line === "# Section C");
    const aIndex = lines.findIndex((line) => line === "# Section A");

    expect(bIndex).toBeLessThan(cIndex);
    expect(cIndex).toBeLessThan(aIndex);
  });

  test("moves a section with children", () => {
    const content = `# Section A
Content A
## Child A1
Child content A1
## Child A2
Child content A2

# Section B
Content B

# Section C
Content C`;

    const result = applyMoveSection(content, "section-a", "section-c");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# Section A");
    expect(result.content).toContain("## Child A1");
    expect(result.content).toContain("## Child A2");
    expect(result.content).toContain("Child content A1");
    expect(result.content).toContain("Child content A2");

    // Verify order: B, C, A (with all children)
    const lines = result.content.split("\n");
    const bIndex = lines.findIndex((line) => line === "# Section B");
    const cIndex = lines.findIndex((line) => line === "# Section C");
    const aIndex = lines.findIndex((line) => line === "# Section A");
    const a1Index = lines.findIndex((line) => line === "## Child A1");
    const a2Index = lines.findIndex((line) => line === "## Child A2");

    expect(bIndex).toBeLessThan(cIndex);
    expect(cIndex).toBeLessThan(aIndex);
    expect(aIndex).toBeLessThan(a1Index);
    expect(a1Index).toBeLessThan(a2Index);
  });

  test("moves a section backward (from later to earlier position)", () => {
    const content = `# Section A
Content A

# Section B
Content B

# Section C
Content C`;

    const result = applyMoveSection(content, "section-c", "section-a");

    expect(result.count).toBe(1);

    // Verify order: A, C, B
    const lines = result.content.split("\n");
    const aIndex = lines.findIndex((line) => line === "# Section A");
    const bIndex = lines.findIndex((line) => line === "# Section B");
    const cIndex = lines.findIndex((line) => line === "# Section C");

    expect(aIndex).toBeLessThan(cIndex);
    expect(cIndex).toBeLessThan(bIndex);
  });

  test("moves a section forward (from earlier to later position)", () => {
    const content = `# Section A
Content A

# Section B
Content B

# Section C
Content C`;

    const result = applyMoveSection(content, "section-a", "section-b");

    expect(result.count).toBe(1);

    // Verify order: B, A, C
    const lines = result.content.split("\n");
    const aIndex = lines.findIndex((line) => line === "# Section A");
    const bIndex = lines.findIndex((line) => line === "# Section B");
    const cIndex = lines.findIndex((line) => line === "# Section C");

    expect(bIndex).toBeLessThan(aIndex);
    expect(aIndex).toBeLessThan(cIndex);
  });

  test("returns zero count when source section not found", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const result = applyMoveSection(content, "non-existent", "section-b");

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns zero count when target section not found", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const result = applyMoveSection(content, "section-a", "non-existent");

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns zero count when both sections not found", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const result = applyMoveSection(content, "missing-1", "missing-2");

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns zero count when trying to move a section after itself", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const result = applyMoveSection(content, "section-a", "section-a");

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns zero count when trying to move a section after its own child", () => {
    const content = `# Parent
Parent content
## Child
Child content

# Other
Other content`;

    const result = applyMoveSection(content, "parent", "child");

    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("moves section with custom IDs", () => {
    const content = `# First Section {#custom-1}
Content 1

# Second Section {#custom-2}
Content 2

# Third Section {#custom-3}
Content 3`;

    const result = applyMoveSection(content, "custom-1", "custom-3");

    expect(result.count).toBe(1);

    // Verify order: custom-2, custom-3, custom-1
    const lines = result.content.split("\n");
    const idx1 = lines.findIndex((line) => line.includes("{#custom-1}"));
    const idx2 = lines.findIndex((line) => line.includes("{#custom-2}"));
    const idx3 = lines.findIndex((line) => line.includes("{#custom-3}"));

    expect(idx2).toBeLessThan(idx3);
    expect(idx3).toBeLessThan(idx1);
  });

  test("handles multiple sections in document", () => {
    const content = `# Section 1
Content 1

# Section 2
Content 2

# Section 3
Content 3

# Section 4
Content 4

# Section 5
Content 5`;

    const result = applyMoveSection(content, "section-2", "section-4");

    expect(result.count).toBe(1);

    // Verify section 2 is now after section 4
    const lines = result.content.split("\n");
    const idx2 = lines.findIndex((line) => line === "# Section 2");
    const idx4 = lines.findIndex((line) => line === "# Section 4");

    expect(idx4).toBeLessThan(idx2);
  });

  test("preserves content and formatting when moving", () => {
    const content = `# Section A
This is **bold** text.
- List item 1
- List item 2

# Section B
Normal content.

# Section C
\`\`\`code
block
\`\`\``;

    const result = applyMoveSection(content, "section-a", "section-c");

    expect(result.count).toBe(1);
    expect(result.content).toContain("This is **bold** text.");
    expect(result.content).toContain("- List item 1");
    expect(result.content).toContain("- List item 2");
    expect(result.content).toContain("```code");
  });

  test("moves deeply nested sections with all descendants", () => {
    const content = `# Level 1A
Content 1A
## Level 2A
Content 2A
### Level 3A
Content 3A

# Level 1B
Content 1B

# Level 1C
Content 1C`;

    const result = applyMoveSection(content, "level-1a", "level-1c");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# Level 1A");
    expect(result.content).toContain("## Level 2A");
    expect(result.content).toContain("### Level 3A");

    // All levels should stay together
    const lines = result.content.split("\n");
    const idx1a = lines.findIndex((line) => line === "# Level 1A");
    const idx2a = lines.findIndex((line) => line === "## Level 2A");
    const idx3a = lines.findIndex((line) => line === "### Level 3A");
    const idx1c = lines.findIndex((line) => line === "# Level 1C");

    expect(idx1c).toBeLessThan(idx1a);
    expect(idx1a).toBeLessThan(idx2a);
    expect(idx2a).toBeLessThan(idx3a);
  });

  test("moves adjacent sections", () => {
    const content = `# Section A
Content A

# Section B
Content B

# Section C
Content C`;

    // Move A after B (they are adjacent)
    const result = applyMoveSection(content, "section-a", "section-b");

    expect(result.count).toBe(1);

    const lines = result.content.split("\n");
    const aIndex = lines.findIndex((line) => line === "# Section A");
    const bIndex = lines.findIndex((line) => line === "# Section B");

    expect(bIndex).toBeLessThan(aIndex);
  });

  test("handles sections with varying levels", () => {
    const content = `# Top Level
Content

## Second Level
More content

### Third Level
Deep content

# Another Top
Other content`;

    const result = applyMoveSection(content, "top-level", "another-top");

    expect(result.count).toBe(1);

    // Top Level and all its children should move
    const lines = result.content.split("\n");
    const topIndex = lines.findIndex((line) => line === "# Top Level");
    const secondIndex = lines.findIndex((line) => line === "## Second Level");
    const thirdIndex = lines.findIndex((line) => line === "### Third Level");
    const anotherIndex = lines.findIndex((line) => line === "# Another Top");

    expect(anotherIndex).toBeLessThan(topIndex);
    expect(topIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });
});

describe("move-section with applyPatches", () => {
  test("applies move-section patch", () => {
    const content = `# Introduction
Welcome

# Details
More info

# Conclusion
The end`;

    const patches: PatchOperation[] = [
      { op: "move-section", id: "introduction", after: "conclusion" },
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);

    const lines = result.content.split("\n");
    const introIndex = lines.findIndex((line) => line === "# Introduction");
    const conclusionIndex = lines.findIndex((line) => line === "# Conclusion");

    expect(conclusionIndex).toBeLessThan(introIndex);
  });

  test("generates warning when source section not found with onNoMatch=warn", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const patches: PatchOperation[] = [{ op: "move-section", id: "missing", after: "section-b" }];

    const result = applyPatches(content, patches, "warn");

    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("move-section 'missing' after 'section-b'");
    expect(result.warnings[0]).toContain("matched 0 times");
  });

  test("throws error when section not found with onNoMatch=error", () => {
    const content = `# Section A
Content A`;

    const patches: PatchOperation[] = [{ op: "move-section", id: "section-a", after: "missing" }];

    expect(() => applyPatches(content, patches, "error")).toThrow("matched 0 times");
  });

  test("skips non-matching move-section with onNoMatch=skip", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const patches: PatchOperation[] = [
      { op: "move-section", id: "missing", after: "section-b", onNoMatch: "skip" },
      { op: "replace", old: "Content A", new: "Modified A" },
    ];

    const result = applyPatches(content, patches, "warn");

    expect(result.applied).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.content).toContain("Modified A");
  });

  test("applies multiple move-section operations in sequence", () => {
    const content = `# A
Content A

# B
Content B

# C
Content C

# D
Content D`;

    const patches: PatchOperation[] = [
      { op: "move-section", id: "a", after: "c" }, // Order: B, C, A, D
      { op: "move-section", id: "d", after: "b" }, // Order: B, D, C, A
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(2);
    expect(result.warnings).toHaveLength(0);

    const lines = result.content.split("\n");
    const aIndex = lines.findIndex((line) => line === "# A");
    const bIndex = lines.findIndex((line) => line === "# B");
    const cIndex = lines.findIndex((line) => line === "# C");
    const dIndex = lines.findIndex((line) => line === "# D");

    expect(bIndex).toBeLessThan(dIndex);
    expect(dIndex).toBeLessThan(cIndex);
    expect(cIndex).toBeLessThan(aIndex);
  });

  test("combines move-section with other patch operations", () => {
    const content = `# Introduction
Old intro text

# Details
Details content

# Conclusion
The end`;

    const patches: PatchOperation[] = [
      { op: "replace-section", id: "introduction", content: "New intro text" },
      { op: "move-section", id: "conclusion", after: "introduction" },
      { op: "append-to-section", id: "details", content: "\nAppended details" },
    ];

    const result = applyPatches(content, patches);

    expect(result.applied).toBe(3);
    expect(result.content).toContain("New intro text");
    expect(result.content).toContain("Appended details");

    // Conclusion should be after Introduction
    const lines = result.content.split("\n");
    const introIndex = lines.findIndex((line) => line === "# Introduction");
    const conclusionIndex = lines.findIndex((line) => line === "# Conclusion");

    expect(introIndex).toBeLessThan(conclusionIndex);
  });

  test("handles edge case: moving section after itself returns count 0", () => {
    const content = `# Section A
Content`;

    const patches: PatchOperation[] = [{ op: "move-section", id: "section-a", after: "section-a" }];

    const result = applyPatches(content, patches, "warn");

    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
  });

  test("respects per-patch onNoMatch override", () => {
    const content = `# Section A
Content A

# Section B
Content B`;

    const patches: PatchOperation[] = [
      { op: "move-section", id: "missing1", after: "section-b", onNoMatch: "skip" },
      { op: "move-section", id: "missing2", after: "section-b", onNoMatch: "warn" },
    ];

    const result = applyPatches(content, patches, "error");

    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("missing2");
  });
});
