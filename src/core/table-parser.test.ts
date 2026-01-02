/**
 * Tests for the table-parser module
 *
 * This comprehensive test suite covers:
 * - Parsing tables with different column alignments
 * - Handling empty cells and whitespace
 * - Multiple tables in a document
 * - Finding tables by line number and section ID
 * - Serializing tables back to markdown
 * - Getting column indices by name or number
 * - Finding row indices by position or search criteria
 * - Edge cases: malformed tables, missing separators, inconsistent columns
 */

import { describe, expect, test } from "bun:test";
import {
  findRowIndex,
  findTable,
  getColumnIndex,
  type MarkdownTable,
  parseTables,
  serializeTable,
} from "./table-parser.js";

describe("parseTables", () => {
  describe("basic table parsing", () => {
    test("parses a simple table with three columns", () => {
      const markdown = `
| Name | Age | City |
|------|-----|------|
| Alice | 30 | NYC |
| Bob | 25 | LA |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      expect(tables[0]?.headers).toEqual(["Name", "Age", "City"]);
      expect(tables[0]?.rows).toHaveLength(2);
      expect(tables[0]?.rows[0]).toEqual(["Alice", "30", "NYC"]);
      expect(tables[0]?.rows[1]).toEqual(["Bob", "25", "LA"]);
    });

    test("parses table with single row", () => {
      const markdown = `
| Name | Value |
|------|-------|
| Test | 123 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      expect(tables[0]?.rows).toHaveLength(1);
      expect(tables[0]?.rows[0]).toEqual(["Test", "123"]);
    });

    test("parses table with empty cells", () => {
      const markdown = `
| Name | Age | City |
|------|-----|------|
| Alice |  | NYC |
| Bob | 25 |  |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      expect(tables[0]?.rows[0]).toEqual(["Alice", "", "NYC"]);
      expect(tables[0]?.rows[1]).toEqual(["Bob", "25", ""]);
    });

    test("handles whitespace in cells correctly", () => {
      const markdown = `
| Name | Value |
|------|-------|
|  Alice  |  30  |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      expect(tables[0]?.rows[0]).toEqual(["Alice", "30"]);
    });
  });

  describe("column alignments", () => {
    test("detects left alignment", () => {
      const markdown = `
| Name | Age |
|:-----|:----|
| Alice | 30 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.alignments).toEqual(["left", "left"]);
    });

    test("detects center alignment", () => {
      const markdown = `
| Name | Age |
|:----:|:---:|
| Alice | 30 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.alignments).toEqual(["center", "center"]);
    });

    test("detects right alignment", () => {
      const markdown = `
| Name | Age |
|-----:|----:|
| Alice | 30 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.alignments).toEqual(["right", "right"]);
    });

    test("detects no alignment (default)", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.alignments).toEqual(["none", "none"]);
    });

    test("detects mixed alignments", () => {
      const markdown = `
| Name | Age | Score | Status |
|:-----|:---:|------:|--------|
| Alice | 30 | 95 | Active |
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.alignments).toEqual(["left", "center", "right", "none"]);
    });
  });

  describe("line boundaries", () => {
    test("tracks correct start and end lines", () => {
      const markdown = `Some text before

| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |

Some text after`;

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      expect(tables[0]?.startLine).toBe(2);
      expect(tables[0]?.endLine).toBe(5);
    });

    test("handles table at start of document", () => {
      const markdown = `| Name | Age |
|------|-----|
| Alice | 30 |`;

      const tables = parseTables(markdown);
      expect(tables[0]?.startLine).toBe(0);
      expect(tables[0]?.endLine).toBe(2);
    });

    test("handles table at end of document", () => {
      const markdown = `Some text

| Name | Age |
|------|-----|
| Alice | 30 |`;

      const tables = parseTables(markdown);
      expect(tables[0]?.startLine).toBe(2);
      expect(tables[0]?.endLine).toBe(4);
    });
  });

  describe("multiple tables", () => {
    test("parses multiple tables in same document", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |

Some text between tables

| Product | Price |
|---------|-------|
| Apple | 1.00 |
| Banana | 0.50 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(2);
      expect(tables[0]?.headers).toEqual(["Name", "Age"]);
      expect(tables[1]?.headers).toEqual(["Product", "Price"]);
    });

    test("parses tables with no text between them", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |

| Product | Price |
|---------|-------|
| Apple | 1.00 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(2);
    });
  });

  describe("edge cases and invalid tables", () => {
    test("returns empty array for content with no tables", () => {
      const markdown = `# Just a heading

Some paragraph text
Another line`;

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(0);
    });

    test("ignores lines with pipes that are not tables", () => {
      const markdown = `This is not | a table
| Name | Age |
|------|-----|
| Alice | 30 |`;

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      expect(tables[0]?.startLine).toBe(1);
    });

    test("requires valid separator row", () => {
      const markdown = `
| Name | Age |
| Not | Separator |
| Alice | 30 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(0);
    });

    test("ignores table with mismatched column count", () => {
      const markdown = `
| Name | Age | City |
|------|-----|
| Alice | 30 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(0);
    });

    test("stops parsing when row has wrong column count", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 | Extra |
| Charlie | 35 |
`.trim();

      const tables = parseTables(markdown);
      expect(tables).toHaveLength(1);
      // Should only include rows before the mismatched one
      expect(tables[0]?.rows).toHaveLength(1);
      expect(tables[0]?.rows[0]).toEqual(["Alice", "30"]);
    });

    test("handles empty content", () => {
      const tables = parseTables("");
      expect(tables).toHaveLength(0);
    });

    test("handles content with only newlines", () => {
      const tables = parseTables("\n\n\n");
      expect(tables).toHaveLength(0);
    });
  });

  describe("table termination", () => {
    test("stops at blank line", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |

More text
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.rows).toHaveLength(1);
      expect(tables[0]?.endLine).toBe(2);
    });

    test("stops at non-table content", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
Not a table row
`.trim();

      const tables = parseTables(markdown);
      expect(tables[0]?.rows).toHaveLength(1);
    });
  });
});

describe("findTable", () => {
  describe("find by line number", () => {
    test("finds table containing specific line", () => {
      const markdown = `
Some text

| Name | Age |
|------|-----|
| Alice | 30 |

More text
`.trim();

      const table = findTable(markdown, 2);
      expect(table).toBeDefined();
      expect(table?.headers).toEqual(["Name", "Age"]);
    });

    test("finds table by header line", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
`.trim();

      const table = findTable(markdown, 0);
      expect(table).toBeDefined();
    });

    test("finds table by data row line", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |
`.trim();

      const table = findTable(markdown, 3);
      expect(table).toBeDefined();
    });

    test("returns undefined when line is outside table", () => {
      const markdown = `
Text before

| Name | Age |
|------|-----|
| Alice | 30 |

Text after
`.trim();

      const table = findTable(markdown, 0);
      expect(table).toBeUndefined();
    });

    test("returns undefined for invalid line number", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
`.trim();

      const table = findTable(markdown, 999);
      expect(table).toBeUndefined();
    });

    test("finds correct table when multiple tables exist", () => {
      const markdown = `
| Name | Age |
|------|-----|
| Alice | 30 |

| Product | Price |
|---------|-------|
| Apple | 1.00 |
`.trim();

      const table1 = findTable(markdown, 1);
      const table2 = findTable(markdown, 5);

      expect(table1?.headers).toEqual(["Name", "Age"]);
      expect(table2?.headers).toEqual(["Product", "Price"]);
    });
  });

  describe("find by section ID", () => {
    test("finds table in specific section", () => {
      const markdown = `
# Data Section {#data}

| Name | Age |
|------|-----|
| Alice | 30 |

# Other Section

Some text
`.trim();

      const table = findTable(markdown, "data");
      expect(table).toBeDefined();
      expect(table?.headers).toEqual(["Name", "Age"]);
    });

    test("finds table in section with generated slug", () => {
      const markdown = `
# User Data

| Name | Age |
|------|-----|
| Alice | 30 |
`.trim();

      const table = findTable(markdown, "user-data");
      expect(table).toBeDefined();
    });

    test("returns undefined when section has no table", () => {
      const markdown = `
# Section One

Just text here

# Section Two {#two}

| Name | Age |
|------|-----|
| Alice | 30 |
`.trim();

      const table = findTable(markdown, "section-one");
      expect(table).toBeUndefined();
    });

    test("returns undefined for non-existent section", () => {
      const markdown = `
# Existing Section

| Name | Age |
|------|-----|
| Alice | 30 |
`.trim();

      const table = findTable(markdown, "non-existent");
      expect(table).toBeUndefined();
    });

    test("finds first table when section has multiple tables", () => {
      const markdown = `
# Data Section {#data}

| Name | Age |
|------|-----|
| Alice | 30 |

| Product | Price |
|---------|-------|
| Apple | 1.00 |
`.trim();

      const table = findTable(markdown, "data");
      expect(table?.headers).toEqual(["Name", "Age"]);
    });

    test("respects section boundaries", () => {
      const markdown = `
# Section One {#one}

Some text

# Section Two {#two}

| Name | Age |
|------|-----|
| Alice | 30 |

# Section Three

More text
`.trim();

      const table = findTable(markdown, "two");
      expect(table).toBeDefined();
      expect(table?.headers).toEqual(["Name", "Age"]);
    });
  });
});

describe("serializeTable", () => {
  test("serializes simple table correctly", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 2,
      headers: ["Name", "Age"],
      alignments: ["none", "none"],
      rows: [["Alice", "30"]],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age |
| --- | --- |
| Alice | 30 |`);
  });

  test("serializes table with left alignment", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 2,
      headers: ["Name", "Age"],
      alignments: ["left", "left"],
      rows: [["Alice", "30"]],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age |
| :--- | :--- |
| Alice | 30 |`);
  });

  test("serializes table with center alignment", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 2,
      headers: ["Name", "Age"],
      alignments: ["center", "center"],
      rows: [["Alice", "30"]],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age |
| :---: | :---: |
| Alice | 30 |`);
  });

  test("serializes table with right alignment", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 2,
      headers: ["Name", "Age"],
      alignments: ["right", "right"],
      rows: [["Alice", "30"]],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age |
| ---: | ---: |
| Alice | 30 |`);
  });

  test("serializes table with mixed alignments", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 2,
      headers: ["Name", "Age", "Score"],
      alignments: ["left", "center", "right"],
      rows: [["Alice", "30", "95"]],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age | Score |
| :--- | :---: | ---: |
| Alice | 30 | 95 |`);
  });

  test("serializes table with multiple rows", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 3,
      headers: ["Name", "Age"],
      alignments: ["none", "none"],
      rows: [
        ["Alice", "30"],
        ["Bob", "25"],
        ["Charlie", "35"],
      ],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`);
  });

  test("serializes table with empty cells", () => {
    const table: MarkdownTable = {
      startLine: 0,
      endLine: 2,
      headers: ["Name", "Age", "City"],
      alignments: ["none", "none", "none"],
      rows: [
        ["Alice", "", "NYC"],
        ["Bob", "25", ""],
      ],
    };

    const result = serializeTable(table);
    expect(result).toBe(`| Name | Age | City |
| --- | --- | --- |
| Alice |  | NYC |
| Bob | 25 |  |`);
  });

  test("round-trip: parse and serialize produces equivalent table", () => {
    const original = `| Name | Age | City |
|:-----|:---:|-----:|
| Alice | 30 | NYC |
| Bob | 25 | LA |`;

    const tables = parseTables(original);
    expect(tables.length).toBeGreaterThan(0);
    const firstTable = tables[0];
    if (!firstTable) throw new Error("Expected at least one table");
    const serialized = serializeTable(firstTable);
    const reparsed = parseTables(serialized);

    expect(reparsed[0]?.headers).toEqual(tables[0]?.headers);
    expect(reparsed[0]?.alignments).toEqual(tables[0]?.alignments);
    expect(reparsed[0]?.rows).toEqual(tables[0]?.rows);
  });
});

describe("getColumnIndex", () => {
  const table: MarkdownTable = {
    startLine: 0,
    endLine: 2,
    headers: ["Name", "Age", "City"],
    alignments: ["none", "none", "none"],
    rows: [["Alice", "30", "NYC"]],
  };

  describe("by name", () => {
    test("finds column by exact name match", () => {
      expect(getColumnIndex(table, "Name")).toBe(0);
      expect(getColumnIndex(table, "Age")).toBe(1);
      expect(getColumnIndex(table, "City")).toBe(2);
    });

    test("returns -1 for non-existent column name", () => {
      expect(getColumnIndex(table, "Email")).toBe(-1);
    });

    test("is case-sensitive", () => {
      expect(getColumnIndex(table, "name")).toBe(-1);
      expect(getColumnIndex(table, "NAME")).toBe(-1);
    });

    test("returns -1 for empty string", () => {
      expect(getColumnIndex(table, "")).toBe(-1);
    });
  });

  describe("by index", () => {
    test("returns valid index unchanged", () => {
      expect(getColumnIndex(table, 0)).toBe(0);
      expect(getColumnIndex(table, 1)).toBe(1);
      expect(getColumnIndex(table, 2)).toBe(2);
    });

    test("returns -1 for out of bounds positive index", () => {
      expect(getColumnIndex(table, 3)).toBe(-1);
      expect(getColumnIndex(table, 10)).toBe(-1);
    });

    test("returns -1 for negative index", () => {
      expect(getColumnIndex(table, -1)).toBe(-1);
    });
  });
});

describe("findRowIndex", () => {
  const table: MarkdownTable = {
    startLine: 0,
    endLine: 3,
    headers: ["Name", "Age", "City"],
    alignments: ["none", "none", "none"],
    rows: [
      ["Alice", "30", "NYC"],
      ["Bob", "25", "LA"],
      ["Charlie", "35", "Chicago"],
    ],
  };

  describe("by index", () => {
    test("returns valid index unchanged", () => {
      expect(findRowIndex(table, 0)).toBe(0);
      expect(findRowIndex(table, 1)).toBe(1);
      expect(findRowIndex(table, 2)).toBe(2);
    });

    test("returns -1 for out of bounds positive index", () => {
      expect(findRowIndex(table, 3)).toBe(-1);
      expect(findRowIndex(table, 10)).toBe(-1);
    });

    test("returns -1 for negative index", () => {
      expect(findRowIndex(table, -1)).toBe(-1);
    });
  });

  describe("by column value search", () => {
    test("finds row by column name and value", () => {
      expect(findRowIndex(table, { column: "Name", value: "Alice" })).toBe(0);
      expect(findRowIndex(table, { column: "Name", value: "Bob" })).toBe(1);
      expect(findRowIndex(table, { column: "City", value: "Chicago" })).toBe(2);
    });

    test("finds row by column index and value", () => {
      expect(findRowIndex(table, { column: 0, value: "Alice" })).toBe(0);
      expect(findRowIndex(table, { column: 1, value: "25" })).toBe(1);
      expect(findRowIndex(table, { column: 2, value: "Chicago" })).toBe(2);
    });

    test("returns -1 for non-existent value", () => {
      expect(findRowIndex(table, { column: "Name", value: "David" })).toBe(-1);
    });

    test("returns -1 for non-existent column", () => {
      expect(findRowIndex(table, { column: "Email", value: "test@example.com" })).toBe(-1);
    });

    test("returns -1 for invalid column index", () => {
      expect(findRowIndex(table, { column: 10, value: "test" })).toBe(-1);
    });

    test("is case-sensitive for values", () => {
      expect(findRowIndex(table, { column: "Name", value: "alice" })).toBe(-1);
      expect(findRowIndex(table, { column: "City", value: "nyc" })).toBe(-1);
    });

    test("finds first matching row when multiple matches exist", () => {
      const tableWithDuplicates: MarkdownTable = {
        startLine: 0,
        endLine: 3,
        headers: ["Name", "Status"],
        alignments: ["none", "none"],
        rows: [
          ["Alice", "Active"],
          ["Bob", "Active"],
          ["Charlie", "Inactive"],
        ],
      };

      expect(findRowIndex(tableWithDuplicates, { column: "Status", value: "Active" })).toBe(0);
    });

    test("handles empty string value", () => {
      const tableWithEmpty: MarkdownTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Name", "Age"],
        alignments: ["none", "none"],
        rows: [
          ["Alice", ""],
          ["Bob", "25"],
        ],
      };

      expect(findRowIndex(tableWithEmpty, { column: "Age", value: "" })).toBe(0);
    });
  });
});
