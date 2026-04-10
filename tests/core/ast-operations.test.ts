import { describe, expect, test } from "bun:test";
import { applyModifyLinks, applyUpdateToc } from "../../src/core/patch-engine.js";

// ──────────────────────────────────────────────────────────────────
// applyModifyLinks
// ──────────────────────────────────────────────────────────────────

describe("applyModifyLinks", () => {
  test("replaces exact URL match", () => {
    const content = "See [docs](https://old.example.com/docs) for details.";
    const result = applyModifyLinks(
      content,
      "https://old.example.com/docs",
      undefined,
      undefined,
      undefined,
      "https://new.example.com/docs",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("See [docs](https://new.example.com/docs) for details.");
  });

  test("replaces URL via regex pattern", () => {
    const content = "[API v1](https://api.example.com/v1/users)";
    const result = applyModifyLinks(
      content,
      undefined,
      "/v1/",
      undefined,
      undefined,
      undefined,
      "/v2/",
      undefined,
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("[API v1](https://api.example.com/v2/users)");
  });

  test("replaces exact link text", () => {
    const content = "Click [Click Here](https://example.com) to continue.";
    const result = applyModifyLinks(
      content,
      undefined,
      undefined,
      "Click Here",
      undefined,
      undefined,
      undefined,
      "Click here",
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("Click [Click here](https://example.com) to continue.");
  });

  test("replaces link text via regex pattern", () => {
    const content = "[API v1 Reference](https://docs.example.com)";
    const result = applyModifyLinks(
      content,
      undefined,
      undefined,
      undefined,
      "API v1",
      undefined,
      undefined,
      undefined,
      "API v2",
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("[API v2 Reference](https://docs.example.com)");
  });

  test("replaces both URL and text in one pass", () => {
    const content = "[old text](https://old.example.com)";
    const result = applyModifyLinks(
      content,
      "https://old.example.com",
      undefined,
      "old text",
      undefined,
      "https://new.example.com",
      undefined,
      "new text",
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("[new text](https://new.example.com)");
  });

  test("returns count 0 when URL does not match", () => {
    const content = "[docs](https://example.com)";
    const result = applyModifyLinks(
      content,
      "https://other.com",
      undefined,
      undefined,
      undefined,
      "https://new.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns count 0 when text does not match", () => {
    const content = "[docs](https://example.com)";
    const result = applyModifyLinks(
      content,
      undefined,
      undefined,
      "nonexistent text",
      undefined,
      undefined,
      undefined,
      "replacement",
      undefined,
    );
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("replaces all matching links (global)", () => {
    const content =
      "[a](https://old.example.com) and [b](https://old.example.com) and [c](https://new.example.com)";
    const result = applyModifyLinks(
      content,
      "https://old.example.com",
      undefined,
      undefined,
      undefined,
      "https://new.example.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(2);
    expect(result.content).toBe(
      "[a](https://new.example.com) and [b](https://new.example.com) and [c](https://new.example.com)",
    );
  });

  test("only matches both criteria simultaneously (URL and text both must match)", () => {
    const content =
      "[docs](https://old.example.com) [other](https://old.example.com) [docs](https://other.com)";
    // Only link where BOTH text='docs' AND url='https://old.example.com'
    const result = applyModifyLinks(
      content,
      "https://old.example.com",
      undefined,
      "docs",
      undefined,
      "https://new.example.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe(
      "[docs](https://new.example.com) [other](https://old.example.com) [docs](https://other.com)",
    );
  });

  test("urlPattern with capture group replacement", () => {
    const content = "[link](https://old.example.com/path)";
    const result = applyModifyLinks(
      content,
      undefined,
      "(https://)(old\\.example\\.com)",
      undefined,
      undefined,
      undefined,
      "$1new.example.com",
      undefined,
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("[link](https://new.example.com/path)");
  });

  test("reference-style links are NOT matched", () => {
    const content = "See [docs][ref] and [inline](https://example.com).";
    const result = applyModifyLinks(
      content,
      "https://example.com",
      undefined,
      undefined,
      undefined,
      "https://new.example.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(1);
    // Only the inline link is changed; reference-style link is untouched
    expect(result.content).toBe("See [docs][ref] and [inline](https://new.example.com).");
  });

  test("returns count 0 and unchanged content when no match criteria given", () => {
    const content = "[link](https://example.com)";
    const result = applyModifyLinks(
      content,
      undefined,
      undefined,
      undefined,
      undefined,
      "https://new.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("empty document returns count 0", () => {
    const result = applyModifyLinks(
      "",
      "https://example.com",
      undefined,
      undefined,
      undefined,
      "https://new.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(0);
    expect(result.content).toBe("");
  });

  test("document with no links returns count 0", () => {
    const content = "Just plain text with no links at all.";
    const result = applyModifyLinks(
      content,
      undefined,
      undefined,
      undefined,
      "any text",
      undefined,
      undefined,
      "new text",
      undefined,
    );
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("preserves surrounding content unchanged", () => {
    const content = "Before [link](https://old.com) after.\n\nAnother paragraph.";
    const result = applyModifyLinks(
      content,
      "https://old.com",
      undefined,
      undefined,
      undefined,
      "https://new.com",
      undefined,
      undefined,
      undefined,
    );
    expect(result.count).toBe(1);
    expect(result.content).toBe("Before [link](https://new.com) after.\n\nAnother paragraph.");
  });
});

// ──────────────────────────────────────────────────────────────────
// applyUpdateToc
// ──────────────────────────────────────────────────────────────────

describe("applyUpdateToc", () => {
  const docWithToc = [
    "# Title",
    "",
    "<!-- TOC -->",
    "<!-- /TOC -->",
    "",
    "## Introduction",
    "",
    "Some content.",
    "",
    "## Reference",
    "",
    "### API",
    "",
    "### Configuration",
  ].join("\n");

  test("generates basic unordered TOC from H2/H3 headings", () => {
    const result = applyUpdateToc(docWithToc);
    expect(result.count).toBe(1);
    expect(result.content).toContain("- [Introduction](#introduction)");
    expect(result.content).toContain("- [Reference](#reference)");
    expect(result.content).toContain("  - [API](#api)");
    expect(result.content).toContain("  - [Configuration](#configuration)");
    // H1 excluded by default
    expect(result.content).not.toContain("- [Title](#title)");
  });

  test("TOC markers are preserved", () => {
    const result = applyUpdateToc(docWithToc);
    expect(result.content).toContain("<!-- TOC -->");
    expect(result.content).toContain("<!-- /TOC -->");
  });

  test("ordered list TOC", () => {
    const result = applyUpdateToc(docWithToc, "<!-- TOC -->", "<!-- /TOC -->", 2, 4, true);
    expect(result.count).toBe(1);
    expect(result.content).toContain("1. [Introduction](#introduction)");
    expect(result.content).toContain("2. [Reference](#reference)");
    expect(result.content).toContain("  1. [API](#api)");
    expect(result.content).toContain("  2. [Configuration](#configuration)");
  });

  test("custom markers", () => {
    const doc = "## Intro\n\n<!-- MY-TOC -->\n<!-- /MY-TOC -->\n\n## Guide";
    const result = applyUpdateToc(doc, "<!-- MY-TOC -->", "<!-- /MY-TOC -->");
    expect(result.count).toBe(1);
    expect(result.content).toContain("<!-- MY-TOC -->");
    expect(result.content).toContain("<!-- /MY-TOC -->");
    expect(result.content).toContain("- [Intro](#intro)");
    expect(result.content).toContain("- [Guide](#guide)");
  });

  test("minLevel and maxLevel filtering - H3 only", () => {
    const doc = "<!-- TOC -->\n<!-- /TOC -->\n\n## Skip\n\n### Keep\n\n#### SkipToo";
    const result = applyUpdateToc(doc, "<!-- TOC -->", "<!-- /TOC -->", 3, 3);
    expect(result.count).toBe(1);
    expect(result.content).toContain("- [Keep](#keep)");
    // The H2 and H4 headings are excluded from the TOC (document body still has them)
    expect(result.content).not.toContain("[Skip]");
    expect(result.content).not.toContain("[SkipToo]");
  });

  test("returns count 0 when opening marker is missing", () => {
    const doc = "## Heading\n\n<!-- /TOC -->\n\nContent";
    const result = applyUpdateToc(doc);
    expect(result.count).toBe(0);
    expect(result.content).toBe(doc);
  });

  test("returns count 0 when closing marker is missing", () => {
    const doc = "## Heading\n\n<!-- TOC -->\n\nContent";
    const result = applyUpdateToc(doc);
    expect(result.count).toBe(0);
    expect(result.content).toBe(doc);
  });

  test("idempotent - running twice produces same result", () => {
    const first = applyUpdateToc(docWithToc);
    const second = applyUpdateToc(first.content);
    expect(second.content).toBe(first.content);
    expect(second.count).toBe(1);
  });

  test("custom indent (4 spaces)", () => {
    const doc = "<!-- TOC -->\n<!-- /TOC -->\n\n## Top\n\n### Nested";
    const result = applyUpdateToc(doc, "<!-- TOC -->", "<!-- /TOC -->", 2, 4, false, "    ");
    expect(result.content).toContain("- [Top](#top)");
    expect(result.content).toContain("    - [Nested](#nested)");
  });

  test("no eligible headings clears interior but keeps markers", () => {
    // All headings are H1 but minLevel=2 excludes them
    const doc = "<!-- TOC -->\nstale content\n<!-- /TOC -->\n\n# Title Only";
    const result = applyUpdateToc(doc);
    expect(result.count).toBe(1);
    const lines = result.content.split("\n");
    const tocStart = lines.findIndex((l) => l.includes("<!-- TOC -->"));
    const tocEnd = lines.findIndex((l) => l.includes("<!-- /TOC -->"));
    // Markers are adjacent (nothing between them)
    expect(tocEnd).toBe(tocStart + 1);
  });

  test("H1 is excluded by default (minLevel=2)", () => {
    const doc = "<!-- TOC -->\n<!-- /TOC -->\n\n# Main Title\n\n## Section";
    const result = applyUpdateToc(doc);
    expect(result.content).toContain("- [Section](#section)");
    // H1 is excluded from the TOC (document body still has the heading)
    expect(result.content).not.toContain("[Main Title]");
  });

  test("existing stale TOC content is fully replaced", () => {
    const doc =
      "<!-- TOC -->\n- [Old Entry](#old)\n- [Another Old](#old2)\n<!-- /TOC -->\n\n## New Section";
    const result = applyUpdateToc(doc);
    expect(result.count).toBe(1);
    expect(result.content).not.toContain("Old Entry");
    expect(result.content).not.toContain("Another Old");
    expect(result.content).toContain("- [New Section](#new-section)");
  });

  test("headings with custom IDs use custom ID in anchor", () => {
    const doc = "<!-- TOC -->\n<!-- /TOC -->\n\n## Getting Started {#get-started}";
    const result = applyUpdateToc(doc);
    expect(result.count).toBe(1);
    // Should use custom ID in anchor
    expect(result.content).toContain("(#get-started)");
    // TOC entry display text should be clean (no {#...} marker)
    expect(result.content).toContain("[Getting Started]");
    // Verify the TOC entry is the clean form, not including the raw {#...}
    expect(result.content).not.toContain("[Getting Started {#get-started}]");
  });

  test("returns count 0 when document has no TOC markers", () => {
    const doc = "## Introduction\n\nSome content.\n\n## Reference";
    const result = applyUpdateToc(doc);
    expect(result.count).toBe(0);
    expect(result.content).toBe(doc);
  });

  test("ordered list resets counters when heading level decreases", () => {
    const doc =
      "<!-- TOC -->\n<!-- /TOC -->\n\n## A\n\n### A1\n\n### A2\n\n## B\n\n### B1";
    const result = applyUpdateToc(doc, "<!-- TOC -->", "<!-- /TOC -->", 2, 4, true);
    expect(result.count).toBe(1);
    // B should restart at 2, and B1 should restart at 1
    expect(result.content).toContain("2. [B](#b)");
    expect(result.content).toContain("  1. [B1](#b1)");
  });
});
