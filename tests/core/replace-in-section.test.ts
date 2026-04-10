import { describe, expect, test } from "bun:test";
import { validateConfig } from "../../src/core/config-parser.js";
import { applyPatches, applyReplaceInSection } from "../../src/core/patch-engine.js";

// ──────────────────────────────────────────────────────────────────
// applyReplaceInSection
// ──────────────────────────────────────────────────────────────────

const DOC = [
  "# Installation\n\nRun npm install to get started.\n\nAlso run npm audit.",
  "# Usage\n\nRun npm start to launch.\n\nSee npm run build for production.",
  "# Contributing\n\nRead npm docs first.",
].join("\n\n");

describe("applyReplaceInSection", () => {
  test("replaces text only within the target section", () => {
    const result = applyReplaceInSection(DOC, "installation", "npm", "bun");
    expect(result.count).toBe(2); // "npm install" and "npm audit" in Installation
    expect(result.content).toContain("Run bun install to get started.");
    expect(result.content).toContain("Also run bun audit.");
    // Other sections untouched
    expect(result.content).toContain("Run npm start to launch.");
    expect(result.content).toContain("See npm run build for production.");
    expect(result.content).toContain("Read npm docs first.");
  });

  test("returns count=0 when section is not found", () => {
    const result = applyReplaceInSection(DOC, "nonexistent-section", "npm", "bun");
    expect(result.count).toBe(0);
    expect(result.content).toBe(DOC);
  });

  test("returns count=0 when old text is not in the section", () => {
    const result = applyReplaceInSection(DOC, "installation", "yarn", "bun");
    expect(result.count).toBe(0);
    expect(result.content).toBe(DOC);
  });

  test("replaces all occurrences within section (global)", () => {
    const content = "## Steps\n\nfoo and foo and foo\n\n## Other\n\nfoo stays";
    const result = applyReplaceInSection(content, "steps", "foo", "bar");
    expect(result.count).toBe(3);
    expect(result.content).toContain("bar and bar and bar");
    expect(result.content).toContain("foo stays");
  });

  test("preserves section header line", () => {
    const content = "## Installation\n\nRun npm install.\n\n## Usage\n\nRun npm start.";
    const result = applyReplaceInSection(content, "installation", "npm", "bun");
    expect(result.content).toContain("## Installation");
    expect(result.content).toContain("## Usage");
  });

  test("replacement can be empty string (deletion)", () => {
    const content = "## Notes\n\nKeep this. Remove this.\n\n## Other\n\nRemove this stays.";
    const result = applyReplaceInSection(content, "notes", " Remove this.", "");
    expect(result.count).toBe(1);
    expect(result.content).toContain("Keep this.");
    expect(result.content).toContain("Remove this stays.");
  });

  test("works with custom section ID", () => {
    const content = "## My Section {#custom-id}\n\nold text here\n\n## Other\n\nold text stays";
    const result = applyReplaceInSection(content, "custom-id", "old text", "new text");
    expect(result.count).toBe(1);
    expect(result.content).toContain("new text here");
    expect(result.content).toContain("old text stays");
  });

  test("does not affect sibling sections at same level", () => {
    const content =
      "# Parent\n\nparent text\n\n## Child\n\nchild text and parent text\n\n# Sibling\n\nparent text";
    const result = applyReplaceInSection(content, "child", "parent text", "REPLACED");
    expect(result.count).toBe(1);
    expect(result.content).toContain("child text and REPLACED");
    // Parent section body not touched
    expect(result.content).toContain("# Parent\n\nparent text");
    // Sibling not touched
    expect(result.content).toContain("# Sibling\n\nparent text");
  });

  test("content before and after document is preserved", () => {
    const content = "preamble\n\n## Section\n\nfoo\n\npostamble";
    const result = applyReplaceInSection(content, "section", "foo", "bar");
    expect(result.count).toBe(1);
    expect(result.content).toContain("preamble");
    expect(result.content).toContain("postamble");
    expect(result.content).toContain("bar");
  });

  test("empty section body returns count=0", () => {
    const content = "## Empty\n\n## Next\n\nsome text";
    const result = applyReplaceInSection(content, "empty", "anything", "else");
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("section at end of document (no following section) works", () => {
    const content = "## First\n\nsome text\n\n## Last\n\nreplace me here";
    const result = applyReplaceInSection(content, "last", "replace me", "done");
    expect(result.count).toBe(1);
    expect(result.content).toContain("done here");
    expect(result.content).toContain("some text");
  });

  test("case-sensitive matching", () => {
    const content = "## Section\n\nHello hello HELLO";
    const result = applyReplaceInSection(content, "section", "hello", "hi");
    expect(result.count).toBe(1);
    expect(result.content).toContain("Hello hi HELLO");
  });
});

// ──────────────────────────────────────────────────────────────────
// Integration via applyPatches
// ──────────────────────────────────────────────────────────────────

describe("replace-in-section via applyPatches", () => {
  test("works end-to-end", async () => {
    const content = "# Intro\n\nHello world.\n\n# Details\n\nHello from details.";
    const result = await applyPatches(content, [
      { op: "replace-in-section", id: "intro", old: "Hello", new: "Hi" },
    ]);
    expect(result.applied).toBe(1);
    expect(result.content).toContain("# Intro\n\nHi world.");
    expect(result.content).toContain("# Details\n\nHello from details.");
  });

  test("count=0 triggers onNoMatch warning by default", async () => {
    const content = "# Section\n\nsome text";
    const result = await applyPatches(content, [
      { op: "replace-in-section", id: "missing-section", old: "foo", new: "bar" },
    ]);
    expect(result.applied).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("multiple replace-in-section patches on same doc", async () => {
    const content =
      "# Install\n\nnpm install\n\n# Run\n\nnpm start\n\n# Build\n\nnpm run build";
    const result = await applyPatches(content, [
      { op: "replace-in-section", id: "install", old: "npm", new: "bun" },
      { op: "replace-in-section", id: "run", old: "npm", new: "bun" },
    ]);
    expect(result.applied).toBe(2);
    expect(result.content).toContain("# Install\n\nbun install");
    expect(result.content).toContain("# Run\n\nbun start");
    expect(result.content).toContain("# Build\n\nnpm run build"); // untouched
  });
});

// ──────────────────────────────────────────────────────────────────
// Config validation
// ──────────────────────────────────────────────────────────────────

const baseConfig = {
  apiVersion: "kustomark/v1",
  kind: "Kustomization",
  resources: ["**/*.md"],
};

describe("replace-in-section config validation", () => {
  test("requires id, old, and new fields", () => {
    const result = validateConfig({ ...baseConfig, patches: [{ op: "replace-in-section" }] });
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields.some((f) => f.includes(".id"))).toBe(true);
    expect(fields.some((f) => f.includes(".old"))).toBe(true);
    expect(fields.some((f) => f.includes(".new"))).toBe(true);
  });

  test("valid patch passes validation", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "replace-in-section", id: "installation", old: "npm", new: "bun" }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing new field", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "replace-in-section", id: "installation", old: "npm" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes(".new"))).toBe(true);
  });
});
