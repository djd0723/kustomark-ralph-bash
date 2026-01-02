/**
 * Tests for the rename-header patch operation
 */

import { describe, expect, test } from "bun:test";
import { applyRenameHeader, generateSlug, parseSections } from "./patch-engine.js";

describe("applyRenameHeader", () => {
  test("renames a basic header", async () => {
    const content = `# Old Header
Content here

## Another Section
More content`;

    const result = applyRenameHeader(content, "old-header", "New Header");

    expect(result.count).toBe(1);
    expect(result.content).toBe(`# New Header
Content here

## Another Section
More content`);
  });

  test("renames header with custom ID", async () => {
    const content = `# My Header {#custom-id}
Content here`;

    const result = applyRenameHeader(content, "custom-id", "Updated Header");

    expect(result.count).toBe(1);
    expect(result.content).toBe(`# Updated Header
Content here`);
  });

  test("renames header found by GitHub slug", async () => {
    const content = `## Getting Started
Instructions here

### Advanced Topics
More details`;

    const result = applyRenameHeader(content, "getting-started", "Quick Start");

    expect(result.count).toBe(1);
    expect(result.content).toBe(`## Quick Start
Instructions here

### Advanced Topics
More details`);
  });

  test("returns count 0 when section not found", async () => {
    const content = `# Header One
Content`;

    const result = applyRenameHeader(content, "non-existent", "New Name");

    expect(result.count).toBe(0);
    expect(result.content).toBe(content); // Content unchanged
  });

  test("preserves header level when renaming level 1", async () => {
    const content = `# Original Title
Content`;

    const result = applyRenameHeader(content, "original-title", "New Title");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# New Title");
    expect(result.content).not.toContain("## New Title");
  });

  test("preserves header level when renaming level 2", async () => {
    const content = `# Main
## Subsection
Content`;

    const result = applyRenameHeader(content, "subsection", "Updated Subsection");

    expect(result.count).toBe(1);
    expect(result.content).toContain("## Updated Subsection");
    expect(result.content).toMatch(/^## Updated Subsection$/m);
    expect(result.content).not.toMatch(/^# Updated Subsection$/m);
  });

  test("preserves header level when renaming level 3", async () => {
    const content = `# Main
## Sub
### Details
Content`;

    const result = applyRenameHeader(content, "details", "New Details");

    expect(result.count).toBe(1);
    expect(result.content).toContain("### New Details");
  });

  test("preserves header level when renaming level 4", async () => {
    const content = `#### Fourth Level Header
Content`;

    const result = applyRenameHeader(content, "fourth-level-header", "Renamed");

    expect(result.count).toBe(1);
    expect(result.content).toContain("#### Renamed");
  });

  test("preserves header level when renaming level 5", async () => {
    const content = `##### Fifth Level
Content`;

    const result = applyRenameHeader(content, "fifth-level", "New Fifth");

    expect(result.count).toBe(1);
    expect(result.content).toContain("##### New Fifth");
  });

  test("preserves header level when renaming level 6", async () => {
    const content = `###### Sixth Level
Content`;

    const result = applyRenameHeader(content, "sixth-level", "New Sixth");

    expect(result.count).toBe(1);
    expect(result.content).toContain("###### New Sixth");
  });

  test("handles multiple sections with different names", async () => {
    const content = `# Introduction
Intro content

## Setup
Setup content

## Usage
Usage content`;

    // Rename the middle section
    const result = applyRenameHeader(content, "setup", "Installation");

    expect(result.count).toBe(1);
    expect(result.content).toBe(`# Introduction
Intro content

## Installation
Setup content

## Usage
Usage content`);
  });

  test("only renames the first section when multiple sections have the same slug", async () => {
    // Note: In practice, this shouldn't happen in well-formed markdown,
    // but we test the behavior anyway
    const content = `# Section
Content 1

# Section
Content 2`;

    const sections = parseSections(content);
    // Both will have the same slug "section"
    expect(sections[0]?.id).toBe("section");
    expect(sections[1]?.id).toBe("section");

    const result = applyRenameHeader(content, "section", "New Section");

    // findSection returns the first match
    expect(result.count).toBe(1);
    expect(result.content).toBe(`# New Section
Content 1

# Section
Content 2`);
  });

  test("handles header with special characters in new name", async () => {
    const content = `# Simple Header
Content`;

    const result = applyRenameHeader(
      content,
      "simple-header",
      "New Header: With Special! Characters?",
    );

    expect(result.count).toBe(1);
    expect(result.content).toBe(`# New Header: With Special! Characters?
Content`);
  });

  test("handles renaming to empty string", async () => {
    const content = `## Old Name
Content`;

    const result = applyRenameHeader(content, "old-name", "");

    expect(result.count).toBe(1);
    expect(result.content).toBe(`##
Content`);
  });

  test("handles header followed immediately by another header", async () => {
    const content = `# First
## Second
### Third`;

    const result = applyRenameHeader(content, "second", "Updated Second");

    expect(result.count).toBe(1);
    expect(result.content).toBe(`# First
## Updated Second
### Third`);
  });

  test("preserves content after the header", async () => {
    const content = `# Original
Line 1
Line 2

Paragraph here.

- List item
- Another item

## Next Section`;

    const result = applyRenameHeader(content, "original", "Updated");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# Updated\n");
    expect(result.content).toContain("Line 1\nLine 2");
    expect(result.content).toContain("Paragraph here.");
    expect(result.content).toContain("- List item");
  });

  test("handles complex slug generation", async () => {
    const content = `## Hello! World?
Content`;

    // GitHub slug would be "hello-world"
    const slug = generateSlug("Hello! World?");
    expect(slug).toBe("hello-world");

    const result = applyRenameHeader(content, "hello-world", "Goodbye World");

    expect(result.count).toBe(1);
    expect(result.content).toContain("## Goodbye World");
  });

  test("renames header with custom ID without adding ID to new header", async () => {
    const content = `### Configuration {#config}
Details here`;

    const result = applyRenameHeader(content, "config", "Settings");

    expect(result.count).toBe(1);
    // The new header should NOT include the custom ID
    expect(result.content).toBe(`### Settings
Details here`);
    expect(result.content).not.toContain("{#config}");
  });

  test("handles document with frontmatter", async () => {
    const content = `---
title: My Doc
---

# Main Header
Content here`;

    const result = applyRenameHeader(content, "main-header", "Primary Header");

    expect(result.count).toBe(1);
    expect(result.content).toContain("---\ntitle: My Doc\n---");
    expect(result.content).toContain("# Primary Header");
  });

  test("renames header in document with code blocks", async () => {
    const content = `# Code Example

\`\`\`javascript
// Some code
function test() {}
\`\`\`

## Next Section
More content`;

    const result = applyRenameHeader(content, "code-example", "JavaScript Example");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# JavaScript Example");
    expect(result.content).toContain("```javascript");
  });

  test("handles headers with trailing whitespace", async () => {
    const content = `## Test Header
Content`;

    const result = applyRenameHeader(content, "test-header", "New Header");

    expect(result.count).toBe(1);
    expect(result.content).toContain("## New Header");
  });

  test("preserves nested sections when renaming parent", async () => {
    const content = `# Parent
Parent content

## Child 1
Child content 1

### Grandchild
Grandchild content

## Child 2
Child content 2`;

    const result = applyRenameHeader(content, "parent", "New Parent");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# New Parent");
    expect(result.content).toContain("## Child 1");
    expect(result.content).toContain("### Grandchild");
    expect(result.content).toContain("## Child 2");
  });

  test("handles Unicode characters in new header", async () => {
    const content = `# Simple
Content`;

    const result = applyRenameHeader(content, "simple", "Unicode: 日本語 🎉");

    expect(result.count).toBe(1);
    expect(result.content).toContain("# Unicode: 日本語 🎉");
  });

  test("handles numbers and underscores in slug matching", async () => {
    const content = `## Test_Section_123
Content`;

    const slug = generateSlug("Test_Section_123");
    expect(slug).toBe("test_section_123");

    const result = applyRenameHeader(content, "test_section_123", "New Section");

    expect(result.count).toBe(1);
    expect(result.content).toContain("## New Section");
  });
});
