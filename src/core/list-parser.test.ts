/**
 * Tests for the list-parser module and list patch operations
 *
 * Covers:
 * - parseLists(): parse unordered, ordered, and task lists
 * - findList(): find by index and by section ID
 * - applyAddListItem(): add items at beginning, end, and specific position
 * - applyRemoveListItem(): remove by index and by text match
 * - applySetListItem(): replace by index and by text match; preserve task prefixes
 */

import { describe, expect, test } from "bun:test";
import { findList, parseLists } from "./list-parser.js";
import { applyAddListItem, applyRemoveListItem, applySetListItem } from "./patch-engine.js";

// ─── parseLists ──────────────────────────────────────────────────────────────

describe("parseLists", () => {
  describe("unordered lists", () => {
    test("parses a simple dash list", () => {
      const content = `- Alpha\n- Beta\n- Gamma`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      expect(lists[0]?.type).toBe("unordered");
      expect(lists[0]?.bullet).toBe("- ");
      expect(lists[0]?.items).toHaveLength(3);
      expect(lists[0]?.items[0]?.text).toBe("Alpha");
      expect(lists[0]?.items[1]?.text).toBe("Beta");
      expect(lists[0]?.items[2]?.text).toBe("Gamma");
    });

    test("parses a star list", () => {
      const content = `* One\n* Two`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      expect(lists[0]?.bullet).toBe("* ");
      expect(lists[0]?.items).toHaveLength(2);
    });

    test("parses a plus list", () => {
      const content = `+ A\n+ B`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      expect(lists[0]?.bullet).toBe("+ ");
    });

    test("blank line ends the list", () => {
      const content = `- First\n- Second\n\n- Other list`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(2);
      expect(lists[0]?.items).toHaveLength(2);
      expect(lists[1]?.items).toHaveLength(1);
    });

    test("header line ends the list", () => {
      const content = `- Item one\n# New Section\n- Item two`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(2);
      expect(lists[0]?.items).toHaveLength(1);
      expect(lists[0]?.items[0]?.text).toBe("Item one");
    });

    test("records correct startLine and endLine", () => {
      const content = `# Header\n- A\n- B\n- C`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      expect(lists[0]?.startLine).toBe(1);
      expect(lists[0]?.endLine).toBe(3);
    });
  });

  describe("ordered lists", () => {
    test("parses a numbered list", () => {
      const content = `1. First\n2. Second\n3. Third`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      expect(lists[0]?.type).toBe("ordered");
      expect(lists[0]?.items).toHaveLength(3);
      expect(lists[0]?.items[0]?.text).toBe("First");
      expect(lists[0]?.items[2]?.text).toBe("Third");
    });

    test("handles two-digit numbers", () => {
      const content = `10. Ten\n11. Eleven`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      expect(lists[0]?.items[0]?.text).toBe("Ten");
      expect(lists[0]?.items[1]?.text).toBe("Eleven");
    });
  });

  describe("task list items", () => {
    test("parses unchecked task items", () => {
      const content = `- [ ] Buy milk\n- [ ] Write tests`;
      const lists = parseLists(content);
      expect(lists[0]?.items[0]?.isTask).toBe(true);
      expect(lists[0]?.items[0]?.checked).toBe(false);
      expect(lists[0]?.items[0]?.text).toBe("Buy milk");
    });

    test("parses checked task items (lowercase x)", () => {
      const content = `- [x] Done\n- [ ] Not done`;
      const lists = parseLists(content);
      expect(lists[0]?.items[0]?.isTask).toBe(true);
      expect(lists[0]?.items[0]?.checked).toBe(true);
      expect(lists[0]?.items[0]?.text).toBe("Done");
    });

    test("parses checked task items (uppercase X)", () => {
      const content = `- [X] Also done`;
      const lists = parseLists(content);
      expect(lists[0]?.items[0]?.isTask).toBe(true);
      expect(lists[0]?.items[0]?.checked).toBe(true);
    });

    test("non-task items have isTask=false", () => {
      const content = `- Regular item`;
      const lists = parseLists(content);
      expect(lists[0]?.items[0]?.isTask).toBe(false);
      expect(lists[0]?.items[0]?.checked).toBe(false);
    });
  });

  describe("sub-items and continuations", () => {
    test("sub-items extend the parent item range", () => {
      const content = `- Parent\n  - Child one\n  - Child two\n- Next parent`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(1);
      // Top-level items: "Parent" and "Next parent"
      expect(lists[0]?.items).toHaveLength(2);
      // Parent item spans lines 0-2, next parent is line 3
      expect(lists[0]?.itemRanges[0]).toEqual({ startLine: 0, endLine: 2 });
      expect(lists[0]?.itemRanges[1]).toEqual({ startLine: 3, endLine: 3 });
    });
  });

  describe("multiple lists in a document", () => {
    test("parses two separated lists", () => {
      const content = `- A\n- B\n\n1. X\n2. Y`;
      const lists = parseLists(content);
      expect(lists).toHaveLength(2);
      expect(lists[0]?.type).toBe("unordered");
      expect(lists[1]?.type).toBe("ordered");
    });
  });

  describe("empty / edge cases", () => {
    test("returns empty array for content with no lists", () => {
      const content = `# Just a header\nsome paragraph text`;
      expect(parseLists(content)).toHaveLength(0);
    });

    test("returns empty array for empty content", () => {
      expect(parseLists("")).toHaveLength(0);
    });
  });
});

// ─── findList ─────────────────────────────────────────────────────────────────

describe("findList", () => {
  const content = `# Shopping\n\n- Apples\n- Bananas\n\n# Tasks\n\n1. Buy groceries\n2. Cook dinner`;

  test("finds list by zero-based index", () => {
    const list = findList(content, 0);
    expect(list).toBeDefined();
    expect(list?.items[0]?.text).toBe("Apples");
  });

  test("finds second list by index 1", () => {
    const list = findList(content, 1);
    expect(list).toBeDefined();
    expect(list?.type).toBe("ordered");
    expect(list?.items[0]?.text).toBe("Buy groceries");
  });

  test("returns undefined for out-of-range index", () => {
    expect(findList(content, 99)).toBeUndefined();
  });

  test("finds list by section ID", () => {
    const list = findList(content, "shopping");
    expect(list).toBeDefined();
    expect(list?.items[0]?.text).toBe("Apples");
  });

  test("finds list by second section ID", () => {
    const list = findList(content, "tasks");
    expect(list).toBeDefined();
    expect(list?.items[0]?.text).toBe("Buy groceries");
  });

  test("returns undefined for unknown section ID", () => {
    expect(findList(content, "nonexistent")).toBeUndefined();
  });
});

// ─── applyAddListItem ─────────────────────────────────────────────────────────

describe("applyAddListItem", () => {
  const baseContent = `- Alpha\n- Beta\n- Gamma`;

  test("appends to end by default", () => {
    const { content, count } = applyAddListItem(baseContent, 0, "Delta");
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items).toHaveLength(4);
    expect(lists[0]?.items[3]?.text).toBe("Delta");
  });

  test("appends to end with position -1", () => {
    const { content, count } = applyAddListItem(baseContent, 0, "Delta", -1);
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items[3]?.text).toBe("Delta");
  });

  test("prepends to beginning with position 0", () => {
    const { content, count } = applyAddListItem(baseContent, 0, "Zero", 0);
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items).toHaveLength(4);
    expect(lists[0]?.items[0]?.text).toBe("Zero");
    expect(lists[0]?.items[1]?.text).toBe("Alpha");
  });

  test("inserts after N-th item with position N", () => {
    const { content, count } = applyAddListItem(baseContent, 0, "AlphaBeta", 1);
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items).toHaveLength(4);
    expect(lists[0]?.items[1]?.text).toBe("AlphaBeta");
    expect(lists[0]?.items[2]?.text).toBe("Beta");
  });

  test("preserves bullet style", () => {
    const content = `* One\n* Two`;
    const { content: result } = applyAddListItem(content, 0, "Three");
    expect(result).toContain("* Three");
  });

  test("returns count 0 for non-existent list", () => {
    const { count } = applyAddListItem(baseContent, 99, "Item");
    expect(count).toBe(0);
  });

  test("finds list by section ID", () => {
    const content = `## My List\n\n- X\n- Y`;
    const { content: result, count } = applyAddListItem(content, "my-list", "Z");
    expect(count).toBe(1);
    expect(result).toContain("- Z");
  });
});

// ─── applyRemoveListItem ──────────────────────────────────────────────────────

describe("applyRemoveListItem", () => {
  const baseContent = `- Alpha\n- Beta\n- Gamma`;

  test("removes item by zero-based index", () => {
    const { content, count } = applyRemoveListItem(baseContent, 0, 1);
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items).toHaveLength(2);
    expect(lists[0]?.items[0]?.text).toBe("Alpha");
    expect(lists[0]?.items[1]?.text).toBe("Gamma");
  });

  test("removes first item by index 0", () => {
    const { content, count } = applyRemoveListItem(baseContent, 0, 0);
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items[0]?.text).toBe("Beta");
  });

  test("removes last item by index", () => {
    const { content, count } = applyRemoveListItem(baseContent, 0, 2);
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items).toHaveLength(2);
    expect(lists[0]?.items[1]?.text).toBe("Beta");
  });

  test("removes item by text match", () => {
    const { content, count } = applyRemoveListItem(baseContent, 0, "Beta");
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items).toHaveLength(2);
    expect(lists[0]?.items.map((i) => i.text)).not.toContain("Beta");
  });

  test("returns count 0 for non-existent text", () => {
    const { count } = applyRemoveListItem(baseContent, 0, "Nonexistent");
    expect(count).toBe(0);
  });

  test("returns count 0 for out-of-range index", () => {
    const { count } = applyRemoveListItem(baseContent, 0, 99);
    expect(count).toBe(0);
  });

  test("returns count 0 for non-existent list", () => {
    const { count } = applyRemoveListItem(baseContent, 99, 0);
    expect(count).toBe(0);
  });

  test("removes item including sub-items", () => {
    const content = `- Parent\n  - Child\n- Other`;
    const { content: result, count } = applyRemoveListItem(content, 0, 0);
    expect(count).toBe(1);
    const lists = parseLists(result);
    expect(lists[0]?.items).toHaveLength(1);
    expect(lists[0]?.items[0]?.text).toBe("Other");
  });
});

// ─── applySetListItem ─────────────────────────────────────────────────────────

describe("applySetListItem", () => {
  const baseContent = `- Alpha\n- Beta\n- Gamma`;

  test("replaces item by zero-based index", () => {
    const { content, count } = applySetListItem(baseContent, 0, 1, "Updated Beta");
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items[1]?.text).toBe("Updated Beta");
    expect(lists[0]?.items[0]?.text).toBe("Alpha");
    expect(lists[0]?.items[2]?.text).toBe("Gamma");
  });

  test("replaces item by text match", () => {
    const { content, count } = applySetListItem(baseContent, 0, "Beta", "New Beta");
    expect(count).toBe(1);
    const lists = parseLists(content);
    expect(lists[0]?.items[1]?.text).toBe("New Beta");
  });

  test("preserves bullet style", () => {
    const content = `* First\n* Second`;
    const { content: result } = applySetListItem(content, 0, 0, "Updated First");
    expect(result).toContain("* Updated First");
    expect(result).not.toContain("* First");
  });

  test("preserves unchecked task prefix", () => {
    const content = `- [ ] Buy milk\n- [ ] Write tests`;
    const { content: result } = applySetListItem(content, 0, 0, "Buy oat milk");
    expect(result).toContain("- [ ] Buy oat milk");
    expect(result).not.toContain("Buy milk\n");
  });

  test("preserves checked task prefix", () => {
    const content = `- [x] Done task\n- [ ] Pending task`;
    const { content: result } = applySetListItem(content, 0, 0, "Renamed done task");
    expect(result).toContain("- [x] Renamed done task");
  });

  test("returns count 0 for non-existent text", () => {
    const { count } = applySetListItem(baseContent, 0, "Nonexistent", "New");
    expect(count).toBe(0);
  });

  test("returns count 0 for out-of-range index", () => {
    const { count } = applySetListItem(baseContent, 0, 99, "New");
    expect(count).toBe(0);
  });

  test("returns count 0 for non-existent list", () => {
    const { count } = applySetListItem(baseContent, 99, 0, "New");
    expect(count).toBe(0);
  });

  test("preserves sub-item lines", () => {
    const content = `- Parent\n  - Child one\n  - Child two\n- Other`;
    const { content: result } = applySetListItem(content, 0, 0, "New Parent");
    expect(result).toContain("- New Parent");
    expect(result).toContain("  - Child one");
    expect(result).toContain("  - Child two");
    expect(result).toContain("- Other");
  });
});
