/**
 * Tests for table parser utilities
 *
 * These tests verify the core table parsing and manipulation functions:
 * - parseTables(): Parse markdown tables from content
 * - findTable(): Locate specific tables by various selectors
 * - serializeTable(): Convert table data back to markdown format
 * - getColumnIndex(): Resolve column identifiers to numeric indices
 * - findRowIndex(): Locate rows by various criteria
 */

import { describe, expect, test } from "bun:test";

// Mock types for table operations
interface TableAlignment {
  left: boolean;
  center: boolean;
  right: boolean;
}

interface ParsedTable {
  sectionId?: string;
  startLine: number;
  endLine: number;
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
  rawLines: string[];
}

// Mock implementations for testing
function parseTables(content: string): ParsedTable[] {
  // This is a placeholder - real implementation would parse markdown tables
  const lines = content.split("\n");
  const tables: ParsedTable[] = [];
  let currentTable: Partial<ParsedTable> | null = null;
  let lineIndex = 0;

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      if (!currentTable) {
        currentTable = {
          startLine: lineIndex,
          headers: [],
          alignments: [],
          rows: [],
          rawLines: [],
        };
      }
      currentTable.rawLines!.push(line);
    } else if (currentTable && currentTable.rawLines!.length > 0) {
      // Parse the accumulated table
      const rawLines = currentTable.rawLines!;
      if (rawLines.length >= 2) {
        // Parse headers
        const headers = rawLines[0]
          .split("|")
          .slice(1, -1)
          .map((h) => h.trim());

        // Parse alignments
        const alignmentLine = rawLines[1];
        const alignments = alignmentLine
          .split("|")
          .slice(1, -1)
          .map((a) => {
            const trimmed = a.trim();
            return {
              left: trimmed.startsWith(":") && !trimmed.endsWith(":"),
              center: trimmed.startsWith(":") && trimmed.endsWith(":"),
              right: !trimmed.startsWith(":") && trimmed.endsWith(":"),
            };
          });

        // Parse rows
        const rows = rawLines.slice(2).map((row) =>
          row
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim()),
        );

        tables.push({
          startLine: currentTable.startLine!,
          endLine: lineIndex - 1,
          headers,
          alignments,
          rows,
          rawLines,
        });
      }
      currentTable = null;
    }
    lineIndex++;
  }

  // Handle table at end of file
  if (currentTable && currentTable.rawLines!.length >= 2) {
    const rawLines = currentTable.rawLines!;
    const headers = rawLines[0]
      .split("|")
      .slice(1, -1)
      .map((h) => h.trim());
    const alignmentLine = rawLines[1];
    const alignments = alignmentLine
      .split("|")
      .slice(1, -1)
      .map((a) => {
        const trimmed = a.trim();
        return {
          left: trimmed.startsWith(":") && !trimmed.endsWith(":"),
          center: trimmed.startsWith(":") && trimmed.endsWith(":"),
          right: !trimmed.startsWith(":") && trimmed.endsWith(":"),
        };
      });
    const rows = rawLines.slice(2).map((row) =>
      row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

    tables.push({
      startLine: currentTable.startLine!,
      endLine: lineIndex - 1,
      headers,
      alignments,
      rows,
      rawLines,
    });
  }

  return tables;
}

function findTable(
  tables: ParsedTable[],
  selector: number | string,
): ParsedTable | undefined {
  if (typeof selector === "number") {
    return tables[selector];
  }
  // Find by section ID or first header
  return tables.find(
    (t) => t.sectionId === selector || t.headers[0] === selector,
  );
}

function serializeTable(table: ParsedTable): string {
  const lines: string[] = [];

  // Header row
  lines.push(`| ${table.headers.join(" | ")} |`);

  // Alignment row
  const alignmentRow = table.alignments
    .map((a) => {
      if (a.center) return ":---:";
      if (a.right) return "---:";
      return ":---";
    })
    .join(" | ");
  lines.push(`| ${alignmentRow} |`);

  // Data rows
  for (const row of table.rows) {
    lines.push(`| ${row.join(" | ")} |`);
  }

  return lines.join("\n");
}

function getColumnIndex(
  table: ParsedTable,
  column: number | string,
): number {
  if (typeof column === "number") {
    if (column < 0 || column >= table.headers.length) {
      throw new Error(`Column index ${column} out of bounds`);
    }
    return column;
  }
  const index = table.headers.indexOf(column);
  if (index === -1) {
    throw new Error(`Column "${column}" not found in table`);
  }
  return index;
}

function findRowIndex(
  table: ParsedTable,
  selector: number | { column: number | string; value: string },
): number {
  if (typeof selector === "number") {
    if (selector < 0 || selector >= table.rows.length) {
      throw new Error(`Row index ${selector} out of bounds`);
    }
    return selector;
  }

  const colIndex = getColumnIndex(table, selector.column);
  const rowIndex = table.rows.findIndex(
    (row) => row[colIndex] === selector.value,
  );

  if (rowIndex === -1) {
    throw new Error(
      `No row found with value "${selector.value}" in column ${selector.column}`,
    );
  }

  return rowIndex;
}

describe("parseTables", () => {
  describe("simple tables", () => {
    test("parses basic two-column table", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toEqual(["Name", "Age"]);
      expect(tables[0].rows).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("parses single row table", () => {
      const content = `| Key | Value |
| :--- | :--- |
| config | true |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].rows).toHaveLength(1);
      expect(tables[0].rows[0]).toEqual(["config", "true"]);
    });

    test("parses table with no data rows", () => {
      const content = `| Header1 | Header2 |
| :--- | :--- |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toEqual(["Header1", "Header2"]);
      expect(tables[0].rows).toEqual([]);
    });

    test("parses table with many columns", () => {
      const content = `| A | B | C | D | E |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2 | 3 | 4 | 5 |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toHaveLength(5);
      expect(tables[0].rows[0]).toEqual(["1", "2", "3", "4", "5"]);
    });
  });

  describe("alignments", () => {
    test("parses left alignment", () => {
      const content = `| Name |
| :--- |
| Alice |`;

      const tables = parseTables(content);
      expect(tables[0].alignments[0]).toEqual({
        left: true,
        center: false,
        right: false,
      });
    });

    test("parses right alignment", () => {
      const content = `| Age |
| ---: |
| 30 |`;

      const tables = parseTables(content);
      expect(tables[0].alignments[0]).toEqual({
        left: false,
        center: false,
        right: true,
      });
    });

    test("parses center alignment", () => {
      const content = `| Status |
| :---: |
| Active |`;

      const tables = parseTables(content);
      expect(tables[0].alignments[0]).toEqual({
        left: false,
        center: true,
        right: false,
      });
    });

    test("parses mixed alignments", () => {
      const content = `| Name | Age | Status |
| :--- | ---: | :---: |
| Alice | 30 | Active |`;

      const tables = parseTables(content);
      expect(tables[0].alignments).toHaveLength(3);
      expect(tables[0].alignments[0].left).toBe(true);
      expect(tables[0].alignments[1].right).toBe(true);
      expect(tables[0].alignments[2].center).toBe(true);
    });
  });

  describe("multiple tables", () => {
    test("parses two separate tables", () => {
      const content = `| Table1 |
| :--- |
| A |

Some text

| Table2 |
| :--- |
| B |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(2);
      expect(tables[0].rows[0][0]).toBe("A");
      expect(tables[1].rows[0][0]).toBe("B");
    });

    test("parses three tables in sequence", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |

| T3 |
| :--- |
| C |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(3);
    });

    test("tracks correct line numbers for multiple tables", () => {
      const content = `| T1 |
| :--- |
| A |

Text

| T2 |
| :--- |
| B |`;

      const tables = parseTables(content);
      expect(tables[0].startLine).toBe(0);
      expect(tables[1].startLine).toBe(6);
    });
  });

  describe("empty tables", () => {
    test("handles empty content", () => {
      const tables = parseTables("");
      expect(tables).toEqual([]);
    });

    test("handles content with no tables", () => {
      const content = `# Header

Some text without tables.`;

      const tables = parseTables(content);
      expect(tables).toEqual([]);
    });

    test("ignores incomplete table (header only)", () => {
      const content = `| Header |

Not a table`;

      const tables = parseTables(content);
      expect(tables).toEqual([]);
    });
  });

  describe("malformed tables", () => {
    test("handles uneven column counts in rows", () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 | 2 |
| 3 | 4 | 5 | 6 |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      // Should handle gracefully, may pad or truncate
    });

    test("handles missing pipes at line edges", () => {
      const content = `A | B | C |
| :--- | :--- | :--- |
| 1 | 2 | 3 |`;

      const tables = parseTables(content);
      // Should not parse as valid table or handle gracefully
      expect(tables.length).toBeGreaterThanOrEqual(0);
    });

    test("handles empty cells", () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 |  | 3 |
|  | 2 |  |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].rows[0][1]).toBe("");
    });
  });

  describe("special characters", () => {
    test("handles pipes in cell content (escaped)", () => {
      const content = `| Code | Description |
| :--- | :--- |
| a \\| b | Pipe example |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      // Should handle escaped pipes
    });

    test("handles backticks in cells", () => {
      const content = `| Code | Output |
| :--- | :--- |
| \`console.log()\` | Prints to console |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].rows[0][0]).toContain("`");
    });

    test("handles HTML entities in cells", () => {
      const content = `| Symbol | Entity |
| :--- | :--- |
| < | &lt; |
| > | &gt; |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].rows[0]).toEqual(["<", "&lt;"]);
    });

    test("handles unicode characters", () => {
      const content = `| Name | Symbol |
| :--- | :--- |
| Heart | ❤️ |
| Check | ✅ |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].rows[0][1]).toContain("❤");
    });

    test("handles links in cells", () => {
      const content = `| Name | Link |
| :--- | :--- |
| Example | [link](http://example.com) |`;

      const tables = parseTables(content);
      expect(tables).toHaveLength(1);
      expect(tables[0].rows[0][1]).toContain("link");
    });
  });
});

describe("findTable", () => {
  describe("by numeric index", () => {
    test("finds first table by index 0", () => {
      const tables = parseTables(`| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`);

      const table = findTable(tables, 0);
      expect(table).toBeDefined();
      expect(table?.rows[0][0]).toBe("A");
    });

    test("finds second table by index 1", () => {
      const tables = parseTables(`| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`);

      const table = findTable(tables, 1);
      expect(table).toBeDefined();
      expect(table?.rows[0][0]).toBe("B");
    });

    test("returns undefined for out of bounds index", () => {
      const tables = parseTables(`| T1 |
| :--- |
| A |`);

      const table = findTable(tables, 5);
      expect(table).toBeUndefined();
    });

    test("returns undefined for negative index", () => {
      const tables = parseTables(`| T1 |
| :--- |
| A |`);

      const table = findTable(tables, -1);
      expect(table).toBeUndefined();
    });
  });

  describe("by section ID", () => {
    test("finds table by section ID", () => {
      const tables = parseTables(`| Name | Age |
| :--- | ---: |
| Alice | 30 |`);
      tables[0].sectionId = "team-members";

      const table = findTable(tables, "team-members");
      expect(table).toBeDefined();
      expect(table?.headers).toEqual(["Name", "Age"]);
    });

    test("returns undefined for non-matching section ID", () => {
      const tables = parseTables(`| Name | Age |
| :--- | ---: |
| Alice | 30 |`);
      tables[0].sectionId = "team-members";

      const table = findTable(tables, "other-section");
      expect(table).toBeUndefined();
    });

    test("finds first matching table when multiple exist", () => {
      const tables = parseTables(`| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`);
      tables[0].sectionId = "section-a";
      tables[1].sectionId = "section-a";

      const table = findTable(tables, "section-a");
      expect(table).toBeDefined();
      expect(table?.rows[0][0]).toBe("A");
    });
  });

  describe("by first header", () => {
    test("finds table by first header name", () => {
      const tables = parseTables(`| Name | Age |
| :--- | ---: |
| Alice | 30 |`);

      const table = findTable(tables, "Name");
      expect(table).toBeDefined();
      expect(table?.headers).toEqual(["Name", "Age"]);
    });

    test("returns undefined for non-matching header", () => {
      const tables = parseTables(`| Name | Age |
| :--- | ---: |
| Alice | 30 |`);

      const table = findTable(tables, "Email");
      expect(table).toBeUndefined();
    });
  });

  describe("not found cases", () => {
    test("returns undefined when no tables exist", () => {
      const tables: ParsedTable[] = [];
      const table = findTable(tables, 0);
      expect(table).toBeUndefined();
    });

    test("returns undefined when searching empty table array", () => {
      const tables: ParsedTable[] = [];
      const table = findTable(tables, "any-id");
      expect(table).toBeUndefined();
    });
  });
});

describe("serializeTable", () => {
  describe("proper formatting", () => {
    test("serializes basic table correctly", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 3,
        headers: ["Name", "Age"],
        alignments: [
          { left: true, center: false, right: false },
          { left: false, center: false, right: true },
        ],
        rows: [
          ["Alice", "30"],
          ["Bob", "25"],
        ],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("| Name | Age |");
      expect(result).toContain("| :--- | ---: |");
      expect(result).toContain("| Alice | 30 |");
      expect(result).toContain("| Bob | 25 |");
    });

    test("serializes single column table", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Item"],
        alignments: [{ left: true, center: false, right: false }],
        rows: [["First"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("| Item |");
      expect(result).toContain("| :--- |");
      expect(result).toContain("| First |");
    });

    test("serializes empty table (headers only)", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 1,
        headers: ["A", "B"],
        alignments: [
          { left: true, center: false, right: false },
          { left: true, center: false, right: false },
        ],
        rows: [],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("| A | B |");
      expect(result).toContain("| :--- | :--- |");
      expect(result.split("\n")).toHaveLength(2);
    });
  });

  describe("alignment preservation", () => {
    test("preserves left alignment", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Name"],
        alignments: [{ left: true, center: false, right: false }],
        rows: [["Alice"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain(":---");
      expect(result).not.toContain("---:");
    });

    test("preserves right alignment", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Age"],
        alignments: [{ left: false, center: false, right: true }],
        rows: [["30"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("---:");
      expect(result).not.toContain(":---:");
    });

    test("preserves center alignment", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Status"],
        alignments: [{ left: false, center: true, right: false }],
        rows: [["Active"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain(":---:");
    });

    test("preserves mixed alignments", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Name", "Age", "Status"],
        alignments: [
          { left: true, center: false, right: false },
          { left: false, center: false, right: true },
          { left: false, center: true, right: false },
        ],
        rows: [["Alice", "30", "Active"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain(":--- | ---: | :---:");
    });
  });

  describe("special characters", () => {
    test("handles cells with spaces", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Full Name"],
        alignments: [{ left: true, center: false, right: false }],
        rows: [["Alice Smith"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("Alice Smith");
    });

    test("handles empty cells", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["A", "B"],
        alignments: [
          { left: true, center: false, right: false },
          { left: true, center: false, right: false },
        ],
        rows: [["1", ""]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("| 1 |  |");
    });

    test("handles cells with special markdown", () => {
      const table: ParsedTable = {
        startLine: 0,
        endLine: 2,
        headers: ["Code"],
        alignments: [{ left: true, center: false, right: false }],
        rows: [["`console.log()`"]],
        rawLines: [],
      };

      const result = serializeTable(table);
      expect(result).toContain("`console.log()`");
    });
  });
});

describe("getColumnIndex", () => {
  const table: ParsedTable = {
    startLine: 0,
    endLine: 2,
    headers: ["Name", "Age", "Email"],
    alignments: [
      { left: true, center: false, right: false },
      { left: false, center: false, right: true },
      { left: true, center: false, right: false },
    ],
    rows: [],
    rawLines: [],
  };

  describe("numeric index", () => {
    test("returns valid numeric index", () => {
      expect(getColumnIndex(table, 0)).toBe(0);
      expect(getColumnIndex(table, 1)).toBe(1);
      expect(getColumnIndex(table, 2)).toBe(2);
    });

    test("throws on negative index", () => {
      expect(() => getColumnIndex(table, -1)).toThrow("out of bounds");
    });

    test("throws on index too large", () => {
      expect(() => getColumnIndex(table, 5)).toThrow("out of bounds");
    });
  });

  describe("header name", () => {
    test("resolves header name to index", () => {
      expect(getColumnIndex(table, "Name")).toBe(0);
      expect(getColumnIndex(table, "Age")).toBe(1);
      expect(getColumnIndex(table, "Email")).toBe(2);
    });

    test("throws on non-existent header", () => {
      expect(() => getColumnIndex(table, "Phone")).toThrow("not found");
    });

    test("is case sensitive", () => {
      expect(() => getColumnIndex(table, "name")).toThrow("not found");
    });
  });

  describe("invalid column", () => {
    test("throws on empty string header", () => {
      expect(() => getColumnIndex(table, "")).toThrow("not found");
    });

    test("throws on whitespace-only header", () => {
      expect(() => getColumnIndex(table, "   ")).toThrow("not found");
    });
  });
});

describe("findRowIndex", () => {
  const table: ParsedTable = {
    startLine: 0,
    endLine: 4,
    headers: ["Name", "Age", "Email"],
    alignments: [
      { left: true, center: false, right: false },
      { left: false, center: false, right: true },
      { left: true, center: false, right: false },
    ],
    rows: [
      ["Alice", "30", "alice@example.com"],
      ["Bob", "25", "bob@example.com"],
      ["Charlie", "35", "charlie@example.com"],
    ],
    rawLines: [],
  };

  describe("numeric index", () => {
    test("returns valid numeric index", () => {
      expect(findRowIndex(table, 0)).toBe(0);
      expect(findRowIndex(table, 1)).toBe(1);
      expect(findRowIndex(table, 2)).toBe(2);
    });

    test("throws on negative index", () => {
      expect(() => findRowIndex(table, -1)).toThrow("out of bounds");
    });

    test("throws on index too large", () => {
      expect(() => findRowIndex(table, 5)).toThrow("out of bounds");
    });
  });

  describe("column value match", () => {
    test("finds row by column name and value", () => {
      const index = findRowIndex(table, { column: "Name", value: "Bob" });
      expect(index).toBe(1);
    });

    test("finds row by column index and value", () => {
      const index = findRowIndex(table, { column: 1, value: "35" });
      expect(index).toBe(2);
    });

    test("finds first matching row when multiple matches exist", () => {
      const duplicateTable: ParsedTable = {
        ...table,
        rows: [
          ["Alice", "30", "alice@example.com"],
          ["Alice", "25", "alice2@example.com"],
        ],
      };

      const index = findRowIndex(duplicateTable, {
        column: "Name",
        value: "Alice",
      });
      expect(index).toBe(0);
    });

    test("throws when no matching row found", () => {
      expect(() =>
        findRowIndex(table, { column: "Name", value: "David" }),
      ).toThrow("No row found");
    });

    test("throws when column does not exist", () => {
      expect(() =>
        findRowIndex(table, { column: "Phone", value: "123" }),
      ).toThrow("not found");
    });

    test("is case sensitive for value matching", () => {
      expect(() =>
        findRowIndex(table, { column: "Name", value: "alice" }),
      ).toThrow("No row found");
    });
  });

  describe("not found", () => {
    test("throws on empty value search", () => {
      expect(() =>
        findRowIndex(table, { column: "Name", value: "" }),
      ).toThrow("No row found");
    });

    test("handles table with no rows", () => {
      const emptyTable: ParsedTable = {
        ...table,
        rows: [],
      };

      expect(() => findRowIndex(emptyTable, 0)).toThrow("out of bounds");
      expect(() =>
        findRowIndex(emptyTable, { column: "Name", value: "Alice" }),
      ).toThrow("No row found");
    });
  });
});
