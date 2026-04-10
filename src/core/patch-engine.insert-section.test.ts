/**
 * Tests for the insert-section patch operation
 */

import { describe, expect, test } from "bun:test";
import { validateConfig } from "./config-parser.js";
import { applyInsertSection, applyPatches } from "./patch-engine.js";
import type { KustomarkConfig } from "./types.js";

const DOC = `# Title

Intro paragraph.

## Installation

Install the package.

## Usage

Use the tool.

### Advanced Usage

Advanced stuff.

## Contributing

How to contribute.
`;

describe("applyInsertSection — insert after", () => {
  test("inserts a new section after the reference section", () => {
    const result = applyInsertSection(DOC, "installation", "## Quick Start");
    expect(result.count).toBe(1);
    const installIdx = result.content.indexOf("## Installation");
    const quickIdx = result.content.indexOf("## Quick Start");
    const usageIdx = result.content.indexOf("## Usage");
    expect(quickIdx).toBeGreaterThan(installIdx);
    expect(usageIdx).toBeGreaterThan(quickIdx);
  });

  test("inserts with body content", () => {
    const result = applyInsertSection(
      DOC,
      "installation",
      "## Quick Start",
      "after",
      "Run `npm install`.\n",
    );
    expect(result.count).toBe(1);
    expect(result.content).toContain("## Quick Start");
    expect(result.content).toContain("Run `npm install`.");
  });

  test("inserts after the last section", () => {
    const result = applyInsertSection(DOC, "contributing", "## License", "after", "MIT license.\n");
    expect(result.count).toBe(1);
    const contribIdx = result.content.indexOf("## Contributing");
    const licenseIdx = result.content.indexOf("## License");
    expect(licenseIdx).toBeGreaterThan(contribIdx);
    expect(result.content).toContain("MIT license.");
  });

  test("defaults position to 'after'", () => {
    const result = applyInsertSection(DOC, "installation", "## New Section");
    expect(result.count).toBe(1);
    const installIdx = result.content.indexOf("## Installation");
    const newIdx = result.content.indexOf("## New Section");
    const usageIdx = result.content.indexOf("## Usage");
    expect(newIdx).toBeGreaterThan(installIdx);
    expect(usageIdx).toBeGreaterThan(newIdx);
  });

  test("preserves other sections unchanged", () => {
    const result = applyInsertSection(DOC, "usage", "## FAQ");
    expect(result.content).toContain("## Installation");
    expect(result.content).toContain("## Usage");
    expect(result.content).toContain("## Contributing");
    expect(result.content).toContain("Install the package.");
    expect(result.content).toContain("Use the tool.");
    expect(result.content).toContain("How to contribute.");
  });

  test("inserts after a subsection", () => {
    const result = applyInsertSection(
      DOC,
      "advanced-usage",
      "#### Super Advanced",
      "after",
      "Even more advanced.\n",
    );
    expect(result.count).toBe(1);
    const advIdx = result.content.indexOf("### Advanced Usage");
    const superIdx = result.content.indexOf("#### Super Advanced");
    expect(superIdx).toBeGreaterThan(advIdx);
  });
});

describe("applyInsertSection — insert before", () => {
  test("inserts a new section before the reference section", () => {
    const result = applyInsertSection(DOC, "usage", "## Quick Start", "before");
    expect(result.count).toBe(1);
    const quickIdx = result.content.indexOf("## Quick Start");
    const usageIdx = result.content.indexOf("## Usage");
    expect(quickIdx).toBeLessThan(usageIdx);
  });

  test("inserts before with body content", () => {
    const result = applyInsertSection(
      DOC,
      "usage",
      "## Getting Started",
      "before",
      "Prerequisites here.\n",
    );
    expect(result.count).toBe(1);
    expect(result.content).toContain("## Getting Started");
    expect(result.content).toContain("Prerequisites here.");
    const gettingIdx = result.content.indexOf("## Getting Started");
    const usageIdx = result.content.indexOf("## Usage");
    expect(gettingIdx).toBeLessThan(usageIdx);
  });

  test("inserts before the first section", () => {
    const result = applyInsertSection(
      DOC,
      "installation",
      "## Overview",
      "before",
      "Overview content.\n",
    );
    expect(result.count).toBe(1);
    const overviewIdx = result.content.indexOf("## Overview");
    const installIdx = result.content.indexOf("## Installation");
    expect(overviewIdx).toBeLessThan(installIdx);
  });

  test("preserves other sections when inserting before", () => {
    const result = applyInsertSection(DOC, "contributing", "## Changelog", "before");
    expect(result.content).toContain("## Installation");
    expect(result.content).toContain("## Usage");
    expect(result.content).toContain("## Contributing");
    const changelogIdx = result.content.indexOf("## Changelog");
    const contribIdx = result.content.indexOf("## Contributing");
    expect(changelogIdx).toBeLessThan(contribIdx);
  });
});

describe("applyInsertSection — not found", () => {
  test("returns count 0 when reference section not found", () => {
    const result = applyInsertSection(DOC, "nonexistent-section", "## New Section");
    expect(result.count).toBe(0);
    expect(result.content).toBe(DOC);
  });

  test("returns original content unchanged when not found", () => {
    const result = applyInsertSection(DOC, "does-not-exist", "## Foo", "before");
    expect(result.content).toBe(DOC);
  });
});

describe("applyInsertSection — custom section IDs", () => {
  test("finds section by custom ID", () => {
    const content = `# Title

## Installation {#install}

Install it.

## Usage

Use it.
`;
    const result = applyInsertSection(content, "install", "## Quick Start");
    expect(result.count).toBe(1);
    const installIdx = result.content.indexOf("## Installation");
    const quickIdx = result.content.indexOf("## Quick Start");
    const usageIdx = result.content.indexOf("## Usage");
    expect(quickIdx).toBeGreaterThan(installIdx);
    expect(usageIdx).toBeGreaterThan(quickIdx);
  });
});

describe("applyInsertSection — content formatting", () => {
  test("header is on its own line", () => {
    const result = applyInsertSection(
      DOC,
      "installation",
      "## New Section",
      "after",
      "Body text.\n",
    );
    const lines = result.content.split("\n");
    const headerLine = lines.indexOf("## New Section");
    expect(headerLine).toBeGreaterThan(-1);
  });

  test("blank line separates new section from next section", () => {
    const result = applyInsertSection(DOC, "installation", "## New Section");
    const lines = result.content.split("\n");
    const headerLine = lines.indexOf("## New Section");
    expect(lines.slice(headerLine).some((l) => l === "## Usage")).toBe(true);
  });

  test("header-only insert (no content) works cleanly", () => {
    const result = applyInsertSection(DOC, "usage", "## FAQ");
    expect(result.count).toBe(1);
    expect(result.content).toContain("## FAQ");
  });
});

describe("applyInsertSection — integration with applyPatches", () => {
  test("inserts section via applyPatches", async () => {
    const result = await applyPatches(DOC, [
      {
        op: "insert-section",
        id: "installation",
        header: "## Quick Start",
        content: "Quick start steps.\n",
      },
    ]);
    expect(result.applied).toBe(1);
    expect(result.content).toContain("## Quick Start");
    expect(result.content).toContain("Quick start steps.");
    const installIdx = result.content.indexOf("## Installation");
    const quickIdx = result.content.indexOf("## Quick Start");
    expect(quickIdx).toBeGreaterThan(installIdx);
  });

  test("inserts before via applyPatches", async () => {
    const result = await applyPatches(DOC, [
      {
        op: "insert-section",
        id: "contributing",
        position: "before",
        header: "## License",
      },
    ]);
    expect(result.applied).toBe(1);
    const licenseIdx = result.content.indexOf("## License");
    const contribIdx = result.content.indexOf("## Contributing");
    expect(licenseIdx).toBeLessThan(contribIdx);
  });

  test("multiple insert-section patches chain correctly", async () => {
    const result = await applyPatches(DOC, [
      {
        op: "insert-section",
        id: "installation",
        header: "## Quick Start",
      },
      {
        op: "insert-section",
        id: "contributing",
        header: "## License",
        position: "after",
        content: "MIT\n",
      },
    ]);
    expect(result.applied).toBe(2);
    expect(result.content).toContain("## Quick Start");
    expect(result.content).toContain("## License");
  });

  test("warn (not error) when section not found", async () => {
    const result = await applyPatches(DOC, [
      {
        op: "insert-section",
        id: "nonexistent",
        header: "## New Section",
        onNoMatch: "warn",
      },
    ]);
    expect(result.applied).toBe(0);
    expect(result.warnings).toHaveLength(1);
  });
});

describe("validateConfig for insert-section", () => {
  const baseConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    output: "./out",
    resources: ["**/*.md"],
  };

  test("accepts valid insert-section patch", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", id: "installation", header: "## Quick Start" }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts insert-section with all optional fields", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [
        {
          op: "insert-section",
          id: "usage",
          position: "before",
          header: "## Getting Started",
          content: "Content here.\n",
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  test("rejects insert-section missing id", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", header: "## New Section" }],
    } as unknown as KustomarkConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => (e.field ?? "").includes("id"))).toBe(true);
  });

  test("rejects insert-section missing header", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", id: "installation" }],
    } as unknown as KustomarkConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => (e.field ?? "").includes("header"))).toBe(true);
  });

  test("rejects invalid position value", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", id: "installation", header: "## New", position: "middle" }],
    } as unknown as KustomarkConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => (e.field ?? "").includes("position"))).toBe(true);
  });

  test("rejects non-string content", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", id: "installation", header: "## New", content: 42 }],
    } as unknown as KustomarkConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => (e.field ?? "").includes("content"))).toBe(true);
  });

  test("accepts position before", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", id: "usage", position: "before", header: "## Prereqs" }],
    });
    expect(result.valid).toBe(true);
  });

  test("accepts position after", () => {
    const result = validateConfig({
      ...baseConfig,
      patches: [{ op: "insert-section", id: "usage", position: "after", header: "## FAQ" }],
    });
    expect(result.valid).toBe(true);
  });
});
