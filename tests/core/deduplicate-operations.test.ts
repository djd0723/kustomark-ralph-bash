/**
 * Tests for deduplicate-table-rows and deduplicate-list-items operations
 */

import { describe, expect, test } from "bun:test";
import {
  applyDeduplicateListItems,
  applyDeduplicateTableRows,
} from "../../src/core/patch-engine.js";
import { applyPatches } from "../../src/core/patch-engine.js";
import type { PatchOperation } from "../../src/core/types.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeTable(rows: string[][]): string {
  return [
    "| Name | Status |",
    "| :--- | :--- |",
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function makeList(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

// ─── deduplicate-table-rows ───────────────────────────────────────────────────

describe("applyDeduplicateTableRows", () => {
  test("removes duplicate rows comparing all columns", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Bob", "Inactive"],
      ["Alice", "Active"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, undefined);
    expect(count).toBe(1);
    const lines = result.split("\n");
    // header + alignment + 2 unique rows
    expect(lines).toHaveLength(4);
    expect(result).toContain("| Alice | Active |");
    expect(result).toContain("| Bob | Inactive |");
  });

  test("removes duplicate rows by specific column name", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Alice", "Inactive"],
      ["Bob", "Active"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, "Name");
    expect(count).toBe(1);
    const lines = result.split("\n");
    expect(lines).toHaveLength(4); // header + align + 2 unique
    expect(result).toContain("| Alice | Active |");
    expect(result).toContain("| Bob | Active |");
  });

  test("removes duplicate rows by column index", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Bob", "Active"],
      ["Carol", "Active"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, 1);
    expect(count).toBe(2);
    const lines = result.split("\n");
    expect(lines).toHaveLength(3); // header + align + 1 unique
  });

  test("keep=last keeps last occurrence", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Alice", "Inactive"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, "Name", "last");
    expect(count).toBe(1);
    expect(result).toContain("| Alice | Inactive |");
    expect(result).not.toContain("| Alice | Active |");
  });

  test("keep=first (default) keeps first occurrence", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Alice", "Active"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, undefined, "first");
    expect(count).toBe(1);
    expect(result).toContain("| Alice | Active |");
    const lines = result.split("\n");
    // Only one data row remains
    expect(lines).toHaveLength(3);
  });

  test("returns count=0 when no duplicates exist", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Bob", "Inactive"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, undefined);
    expect(count).toBe(0);
    expect(result).toBe(content);
  });

  test("returns count=0 when table not found", () => {
    const content = makeTable([["Alice", "Active"]]);
    const { content: result, count } = applyDeduplicateTableRows(content, 5, undefined);
    expect(count).toBe(0);
    expect(result).toBe(content);
  });

  test("returns count=0 when column not found", () => {
    const content = makeTable([["Alice", "Active"]]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, "NonExistent");
    expect(count).toBe(0);
    expect(result).toBe(content);
  });

  test("identifies table by section heading", () => {
    const content = `## Team\n\n${makeTable([
      ["Alice", "Active"],
      ["Alice", "Active"],
    ])}`;
    const { content: result, count } = applyDeduplicateTableRows(content, "team", undefined);
    expect(count).toBe(1);
    expect(result).toContain("## Team");
  });

  test("preserves surrounding content", () => {
    const table = makeTable([
      ["Alice", "Active"],
      ["Alice", "Active"],
    ]);
    const content = `Before\n\n${table}\n\nAfter`;
    const { content: result } = applyDeduplicateTableRows(content, 0, undefined);
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  test("handles all-duplicate rows", () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Alice", "Active"],
      ["Alice", "Active"],
    ]);
    const { content: result, count } = applyDeduplicateTableRows(content, 0, undefined);
    expect(count).toBe(2);
    const lines = result.split("\n");
    expect(lines).toHaveLength(3); // header + align + 1 row
  });

  test("integrates via applyPatches", async () => {
    const content = makeTable([
      ["Alice", "Active"],
      ["Bob", "Inactive"],
      ["Alice", "Active"],
    ]);
    const patches: PatchOperation[] = [{ op: "deduplicate-table-rows", table: 0 }];
    const result = await applyPatches(content, patches);
    const lines = result.content.split("\n");
    expect(lines).toHaveLength(4); // header + align + 2 unique rows
    expect(result.applied).toBe(1);
  });
});

// ─── deduplicate-list-items ───────────────────────────────────────────────────

describe("applyDeduplicateListItems", () => {
  test("removes duplicate items", () => {
    const content = makeList(["apple", "banana", "apple"]);
    const { content: result, count } = applyDeduplicateListItems(content, 0);
    expect(count).toBe(1);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(result).toContain("- apple");
    expect(result).toContain("- banana");
  });

  test("keep=first keeps first occurrence (default)", () => {
    const content = makeList(["apple", "APPLE", "apple"]);
    const { content: result, count } = applyDeduplicateListItems(content, 0, "first");
    expect(count).toBe(1);
    const firstAppleLine = result.split("\n").find((l) => l === "- apple");
    expect(firstAppleLine).toBeDefined();
    expect(result).not.toMatch(/- apple\n- APPLE\n- apple/);
  });

  test("keep=last keeps last occurrence", () => {
    const content = makeList(["first apple", "second apple", "first apple"]);
    const { content: result } = applyDeduplicateListItems(content, 0, "last");
    const lines = result.split("\n");
    // "first apple" appears last, "second apple" appears only once
    expect(lines).toHaveLength(2);
    expect(lines[lines.length - 1]).toBe("- first apple");
  });

  test("returns count=0 when no duplicates", () => {
    const content = makeList(["apple", "banana", "cherry"]);
    const { content: result, count } = applyDeduplicateListItems(content, 0);
    expect(count).toBe(0);
    expect(result).toBe(content);
  });

  test("returns count=0 when list not found", () => {
    const content = makeList(["apple"]);
    const { content: result, count } = applyDeduplicateListItems(content, 99);
    expect(count).toBe(0);
    expect(result).toBe(content);
  });

  test("identifies list by section heading", () => {
    const content = `## Fruits\n\n${makeList(["apple", "banana", "apple"])}`;
    const { content: result, count } = applyDeduplicateListItems(content, "fruits");
    expect(count).toBe(1);
    expect(result).toContain("## Fruits");
  });

  test("handles all-duplicate items", () => {
    const content = makeList(["apple", "apple", "apple"]);
    const { content: result, count } = applyDeduplicateListItems(content, 0);
    expect(count).toBe(2);
    const lines = result.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("- apple");
  });

  test("preserves surrounding content", () => {
    const list = makeList(["apple", "banana", "apple"]);
    const content = `Before\n\n${list}\n\nAfter`;
    const { content: result } = applyDeduplicateListItems(content, 0);
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  test("is case-sensitive", () => {
    const content = makeList(["apple", "Apple", "APPLE"]);
    const { content: result, count } = applyDeduplicateListItems(content, 0);
    // All three are unique (case-sensitive)
    expect(count).toBe(0);
    expect(result).toBe(content);
  });

  test("deduplicates multiple distinct duplicates", () => {
    const content = makeList(["a", "b", "a", "b", "c"]);
    const { content: result, count } = applyDeduplicateListItems(content, 0);
    expect(count).toBe(2);
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
  });

  test("integrates via applyPatches", async () => {
    const content = makeList(["alpha", "beta", "alpha"]);
    const patches: PatchOperation[] = [{ op: "deduplicate-list-items", list: 0 }];
    const result = await applyPatches(content, patches);
    const lines = result.content.split("\n");
    expect(lines).toHaveLength(2);
    expect(result.applied).toBe(1);
  });

  test("integrates via applyPatches with keep=last", async () => {
    const content = makeList(["first", "second", "first"]);
    const patches: PatchOperation[] = [{ op: "deduplicate-list-items", list: 0, keep: "last" }];
    const result = await applyPatches(content, patches);
    const lines = result.content.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("- first");
  });
});
