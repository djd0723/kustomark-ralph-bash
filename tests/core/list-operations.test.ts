/**
 * Tests for filter-list-items patch operation
 *
 * Tests are integration-style, using applyPatches with real PatchOperation objects.
 */

import { describe, expect, test } from "bun:test";
import {
  applyFilterListItems,
  applyPatches,
  applyReorderListItems,
} from "../../src/core/patch-engine.js";

function makeList(items: string[], bullet = "-"): string {
  return items.map((item) => `${bullet} ${item}`).join("\n");
}

describe("applyFilterListItems (unit)", () => {
  test("keeps only items matching exact value", () => {
    const content = makeList(["apple", "banana", "apple", "cherry"]);
    const result = applyFilterListItems(content, 0, "apple", undefined);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.trim() === "- apple")).toBe(true);
    expect(result.count).toBe(2);
  });

  test("removes all items when none match", () => {
    const content = makeList(["apple", "banana", "cherry"]);
    const result = applyFilterListItems(content, 0, "mango", undefined);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(0);
    expect(result.count).toBe(3);
  });

  test("returns count 0 when all items match (nothing removed)", () => {
    const content = makeList(["apple", "apple"]);
    const result = applyFilterListItems(content, 0, "apple", undefined);
    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test("match is case-sensitive", () => {
    const content = makeList(["Apple", "apple", "APPLE"]);
    const result = applyFilterListItems(content, 0, "apple", undefined);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("- apple");
  });

  test("keeps items matching a regex pattern", () => {
    const content = makeList(["TODO: fix bug", "DONE: add tests", "TODO: write docs", "NOTE: readme"]);
    const result = applyFilterListItems(content, 0, undefined, "^TODO:");
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("- TODO: fix bug");
    expect(lines[1]).toBe("- TODO: write docs");
    expect(result.count).toBe(2);
  });

  test("regex pattern supports partial matches", () => {
    const content = makeList(["v1.0.0", "v2.0.0", "1.0.0", "v3.0.0"]);
    const result = applyFilterListItems(content, 0, undefined, "^v");
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.includes("v"))).toBe(true);
  });

  test("invert=true keeps items that do NOT match", () => {
    const content = makeList(["apple", "banana", "apple", "cherry"]);
    const result = applyFilterListItems(content, 0, "apple", undefined, true);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("- banana");
    expect(lines[1]).toBe("- cherry");
    expect(result.count).toBe(2);
  });

  test("invert=true with pattern removes matching items", () => {
    const content = makeList(["TODO: fix", "DONE: tests", "TODO: docs"]);
    const result = applyFilterListItems(content, 0, undefined, "^DONE:", true);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.includes("TODO:"))).toBe(true);
    expect(result.count).toBe(1);
  });

  test("no match or pattern keeps all items (count 0)", () => {
    const content = makeList(["apple", "banana"]);
    const result = applyFilterListItems(content, 0, undefined, undefined);
    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test("returns count 0 when list not found", () => {
    const content = makeList(["apple", "banana"]);
    const result = applyFilterListItems(content, 99, "apple", undefined);
    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });

  test("targets list by index (0-based)", () => {
    const content = `- alpha
- beta

- one
- two
- three`;
    const result = applyFilterListItems(content, 1, "two", undefined);
    // First list unchanged
    expect(result.content).toContain("- alpha");
    expect(result.content).toContain("- beta");
    // Second list filtered to only "two"
    expect(result.content).toContain("- two");
    expect(result.content).not.toContain("- one");
    expect(result.content).not.toContain("- three");
  });

  test("targets list by section heading ID (lowercase slug)", () => {
    const content = `# Fruits

- apple
- banana
- cherry

# Veggies

- carrot
- pea
`;
    // Section "Fruits" gets slug "fruits"
    const result = applyFilterListItems(content, "fruits", "banana", undefined);
    expect(result.content).toContain("- banana");
    expect(result.content).not.toContain("- apple");
    expect(result.content).not.toContain("- cherry");
    // Veggies list untouched
    expect(result.content).toContain("- carrot");
    expect(result.content).toContain("- pea");
  });

  test("preserves surrounding content outside the list", () => {
    const content = `# Header

Some text before.

- keep
- remove

Some text after.`;
    const result = applyFilterListItems(content, 0, "keep", undefined);
    expect(result.content).toContain("# Header");
    expect(result.content).toContain("Some text before.");
    expect(result.content).toContain("Some text after.");
    expect(result.content).toContain("- keep");
    expect(result.content).not.toContain("- remove");
  });

  test("preserves list bullet style (asterisk)", () => {
    const content = `* item-a
* item-b
* item-c`;
    const result = applyFilterListItems(content, 0, "item-b", undefined);
    expect(result.content).toBe("* item-b");
  });

  test("returns count 0 when list is empty", () => {
    const content = "No lists here.";
    const result = applyFilterListItems(content, 0, "apple", undefined);
    expect(result.content).toBe(content);
    expect(result.count).toBe(0);
  });
});

describe("filter-list-items (integration via applyPatches)", () => {
  test("wires up correctly through applyPatches", async () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = await applyPatches(content, [
      { op: "filter-list-items", list: 0, match: "beta" },
    ]);
    expect(result.content).toBe("- beta");
    expect(result.applied).toBe(1);
  });

  test("applied=0 when no items removed", async () => {
    const content = makeList(["alpha"]);
    const result = await applyPatches(content, [
      { op: "filter-list-items", list: 0, match: "alpha" },
    ]);
    expect(result.applied).toBe(0);
  });

  test("invert flag works through applyPatches", async () => {
    const content = makeList(["keep", "remove"]);
    const result = await applyPatches(content, [
      { op: "filter-list-items", list: 0, match: "remove", invert: true },
    ]);
    expect(result.content).toBe("- keep");
    expect(result.applied).toBe(1);
  });

  test("pattern field works through applyPatches", async () => {
    const content = makeList(["error: crash", "info: started", "error: timeout"]);
    const result = await applyPatches(content, [
      { op: "filter-list-items", list: 0, pattern: "^error" },
    ]);
    expect(result.content).not.toContain("info:");
    expect(result.applied).toBe(1);
  });
});

describe("applyReorderListItems (unit)", () => {
  test("reorders items by index", () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = applyReorderListItems(content, 0, [2, 0, 1]);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toEqual(["- gamma", "- alpha", "- beta"]);
    expect(result.count).toBe(1);
  });

  test("reorders items by exact text", () => {
    const content = makeList(["Step 1", "Step 2", "Step 3"]);
    const result = applyReorderListItems(content, 0, ["Step 3", "Step 1", "Step 2"]);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toEqual(["- Step 3", "- Step 1", "- Step 2"]);
    expect(result.count).toBe(1);
  });

  test("reorders with mixed index and text", () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = applyReorderListItems(content, 0, [2, "alpha", 1]);
    const lines = result.content.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toEqual(["- gamma", "- alpha", "- beta"]);
    expect(result.count).toBe(1);
  });

  test("returns count 0 when order length does not match item count", () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = applyReorderListItems(content, 0, [0, 1]);
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns count 0 when order contains duplicate indices", () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = applyReorderListItems(content, 0, [0, 0, 2]);
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns count 0 when text match not found", () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = applyReorderListItems(content, 0, ["alpha", "beta", "NOTFOUND"]);
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("returns count 0 when index out of range", () => {
    const content = makeList(["alpha", "beta"]);
    const result = applyReorderListItems(content, 0, [0, 5]);
    expect(result.count).toBe(0);
  });

  test("returns count 0 when list not found", () => {
    const content = makeList(["alpha", "beta"]);
    const result = applyReorderListItems(content, 99, [0, 1]);
    expect(result.count).toBe(0);
  });

  test("preserves surrounding content", () => {
    const content = "Before\n\n- alpha\n- beta\n- gamma\n\nAfter";
    const result = applyReorderListItems(content, 0, [2, 1, 0]);
    expect(result.content).toBe("Before\n\n- gamma\n- beta\n- alpha\n\nAfter");
    expect(result.count).toBe(1);
  });

  test("preserves sub-items when reordering", () => {
    const content = "- alpha\n  - sub-alpha\n- beta\n- gamma";
    const result = applyReorderListItems(content, 0, [1, 0, 2]);
    const lines = result.content.split("\n");
    expect(lines[0]).toBe("- beta");
    expect(lines[1]).toBe("- alpha");
    expect(lines[2]).toBe("  - sub-alpha");
    expect(lines[3]).toBe("- gamma");
  });

  test("targets list by section heading ID", () => {
    const content = "## Steps\n\n- alpha\n- beta\n- gamma";
    const result = applyReorderListItems(content, "steps", [2, 0, 1]);
    const lines = result.content.split("\n");
    expect(lines[2]).toBe("- gamma");
    expect(lines[3]).toBe("- alpha");
    expect(lines[4]).toBe("- beta");
    expect(result.count).toBe(1);
  });

  test("no-op when order is already correct (same order)", () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = applyReorderListItems(content, 0, [0, 1, 2]);
    expect(result.count).toBe(1);
    expect(result.content).toBe(content);
  });
});

describe("reorder-list-items (integration via applyPatches)", () => {
  test("wires up correctly through applyPatches with indices", async () => {
    const content = makeList(["alpha", "beta", "gamma"]);
    const result = await applyPatches(content, [
      { op: "reorder-list-items", list: 0, order: [2, 0, 1] },
    ]);
    expect(result.content).toBe(makeList(["gamma", "alpha", "beta"]));
    expect(result.applied).toBe(1);
  });

  test("wires up correctly through applyPatches with text", async () => {
    const content = makeList(["Step 1", "Step 2", "Step 3"]);
    const result = await applyPatches(content, [
      { op: "reorder-list-items", list: 0, order: ["Step 3", "Step 1", "Step 2"] },
    ]);
    expect(result.content).toBe(makeList(["Step 3", "Step 1", "Step 2"]));
    expect(result.applied).toBe(1);
  });

  test("applied=0 when order is invalid", async () => {
    const content = makeList(["alpha", "beta"]);
    const result = await applyPatches(content, [
      { op: "reorder-list-items", list: 0, order: [0] },
    ]);
    expect(result.applied).toBe(0);
    expect(result.content).toBe(content);
  });
});
