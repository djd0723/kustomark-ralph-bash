/**
 * Tests for table operations
 *
 * These tests verify the table manipulation operations:
 * - applyReplaceTableCell(): Replace content in specific cells
 * - applyAddTableRow(): Add new rows to tables
 * - applyRemoveTableRow(): Remove rows from tables
 * - applyAddTableColumn(): Add new columns to tables
 * - applyRemoveTableColumn(): Remove columns from tables
 */

import { describe, expect, test } from "bun:test";

// Mock types from table-parser
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

// Mock helper functions
function parseTables(content: string): ParsedTable[] {
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
      const rawLines = currentTable.rawLines!;
      if (rawLines.length >= 2) {
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
      currentTable = null;
    }
    lineIndex++;
  }

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
  return tables.find(
    (t) => t.sectionId === selector || t.headers[0] === selector,
  );
}

function serializeTable(table: ParsedTable): string {
  const lines: string[] = [];
  lines.push(`| ${table.headers.join(" | ")} |`);
  const alignmentRow = table.alignments
    .map((a) => {
      if (a.center) return ":---:";
      if (a.right) return "---:";
      return ":---";
    })
    .join(" | ");
  lines.push(`| ${alignmentRow} |`);
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

// Table operation implementations
function applyReplaceTableCell(
  content: string,
  tableSelector: number | string,
  rowSelector: number | { column: number | string; value: string },
  columnSelector: number | string,
  newContent: string,
): string {
  const tables = parseTables(content);
  const table = findTable(tables, tableSelector);

  if (!table) {
    throw new Error(`Table not found: ${tableSelector}`);
  }

  const rowIndex = findRowIndex(table, rowSelector);
  const colIndex = getColumnIndex(table, columnSelector);

  // Create modified table
  const modifiedTable = { ...table };
  modifiedTable.rows = table.rows.map((row, i) =>
    i === rowIndex
      ? row.map((cell, j) => (j === colIndex ? newContent : cell))
      : [...row],
  );

  // Rebuild content
  const lines = content.split("\n");
  const tableLines = serializeTable(modifiedTable).split("\n");
  const newLines = [
    ...lines.slice(0, table.startLine),
    ...tableLines,
    ...lines.slice(table.endLine + 1),
  ];

  return newLines.join("\n");
}

function applyAddTableRow(
  content: string,
  tableSelector: number | string,
  values: string[],
  position?: number,
): string {
  const tables = parseTables(content);
  const table = findTable(tables, tableSelector);

  if (!table) {
    throw new Error(`Table not found: ${tableSelector}`);
  }

  if (values.length !== table.headers.length) {
    throw new Error(
      `Row has ${values.length} cells but table has ${table.headers.length} columns`,
    );
  }

  const modifiedTable = { ...table };
  const insertPos =
    position !== undefined ? position : modifiedTable.rows.length;

  if (insertPos < 0 || insertPos > modifiedTable.rows.length) {
    throw new Error(`Position ${insertPos} out of bounds`);
  }

  modifiedTable.rows = [
    ...table.rows.slice(0, insertPos),
    values,
    ...table.rows.slice(insertPos),
  ];

  const lines = content.split("\n");
  const tableLines = serializeTable(modifiedTable).split("\n");
  const newLines = [
    ...lines.slice(0, table.startLine),
    ...tableLines,
    ...lines.slice(table.endLine + 1),
  ];

  return newLines.join("\n");
}

function applyRemoveTableRow(
  content: string,
  tableSelector: number | string,
  rowSelector: number | { column: number | string; value: string },
): string {
  const tables = parseTables(content);
  const table = findTable(tables, tableSelector);

  if (!table) {
    throw new Error(`Table not found: ${tableSelector}`);
  }

  const rowIndex = findRowIndex(table, rowSelector);

  const modifiedTable = { ...table };
  modifiedTable.rows = table.rows.filter((_, i) => i !== rowIndex);

  const lines = content.split("\n");
  const tableLines = serializeTable(modifiedTable).split("\n");
  const newLines = [
    ...lines.slice(0, table.startLine),
    ...tableLines,
    ...lines.slice(table.endLine + 1),
  ];

  return newLines.join("\n");
}

function applyAddTableColumn(
  content: string,
  tableSelector: number | string,
  header: string,
  defaultValue = "",
  position?: number,
): string {
  const tables = parseTables(content);
  const table = findTable(tables, tableSelector);

  if (!table) {
    throw new Error(`Table not found: ${tableSelector}`);
  }

  const insertPos =
    position !== undefined ? position : table.headers.length;

  if (insertPos < 0 || insertPos > table.headers.length) {
    throw new Error(`Position ${insertPos} out of bounds`);
  }

  const modifiedTable = { ...table };
  modifiedTable.headers = [
    ...table.headers.slice(0, insertPos),
    header,
    ...table.headers.slice(insertPos),
  ];
  modifiedTable.alignments = [
    ...table.alignments.slice(0, insertPos),
    { left: true, center: false, right: false },
    ...table.alignments.slice(insertPos),
  ];
  modifiedTable.rows = table.rows.map((row) => [
    ...row.slice(0, insertPos),
    defaultValue,
    ...row.slice(insertPos),
  ]);

  const lines = content.split("\n");
  const tableLines = serializeTable(modifiedTable).split("\n");
  const newLines = [
    ...lines.slice(0, table.startLine),
    ...tableLines,
    ...lines.slice(table.endLine + 1),
  ];

  return newLines.join("\n");
}

function applyRemoveTableColumn(
  content: string,
  tableSelector: number | string,
  columnSelector: number | string,
): string {
  const tables = parseTables(content);
  const table = findTable(tables, tableSelector);

  if (!table) {
    throw new Error(`Table not found: ${tableSelector}`);
  }

  const colIndex = getColumnIndex(table, columnSelector);

  if (table.headers.length === 1) {
    throw new Error("Cannot remove the last column from a table");
  }

  const modifiedTable = { ...table };
  modifiedTable.headers = table.headers.filter((_, i) => i !== colIndex);
  modifiedTable.alignments = table.alignments.filter((_, i) => i !== colIndex);
  modifiedTable.rows = table.rows.map((row) =>
    row.filter((_, i) => i !== colIndex),
  );

  const lines = content.split("\n");
  const tableLines = serializeTable(modifiedTable).split("\n");
  const newLines = [
    ...lines.slice(0, table.startLine),
    ...tableLines,
    ...lines.slice(table.endLine + 1),
  ];

  return newLines.join("\n");
}

describe("applyReplaceTableCell", () => {
  describe("basic replacement", () => {
    test("replaces cell by numeric row and column", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyReplaceTableCell(content, 0, 0, 0, "Charlie");
      expect(result).toContain("| Charlie | 30 |");
      expect(result).not.toContain("| Alice | 30 |");
    });

    test("replaces cell in middle of table", () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |`;

      const result = applyReplaceTableCell(content, 0, 1, 1, "X");
      expect(result).toContain("| 4 | X | 6 |");
    });

    test("replaces cell in last row", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyReplaceTableCell(content, 0, 1, 1, "99");
      expect(result).toContain("| Bob | 99 |");
    });

    test("replaces cell in last column", () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 | 2 | 3 |`;

      const result = applyReplaceTableCell(content, 0, 0, 2, "X");
      expect(result).toContain("| 1 | 2 | X |");
    });
  });

  describe("table selector variations", () => {
    test("selects table by numeric index", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`;

      const result = applyReplaceTableCell(content, 1, 0, 0, "X");
      expect(result).toContain("| X |");
      expect(result).toContain("| A |");
    });

    test("selects table by section ID", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const tables = parseTables(content);
      tables[0].sectionId = "team";

      // Note: Would need to reconstruct content with section ID
      // For now, test the table selection logic
      const table = findTable(tables, "team");
      expect(table).toBeDefined();
    });

    test("selects table by first header", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyReplaceTableCell(content, "Name", 0, 1, "35");
      expect(result).toContain("| Alice | 35 |");
    });

    test("throws when table not found by index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, 5, 0, 0, "X"),
      ).toThrow("Table not found");
    });

    test("throws when table not found by string", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, "NonExistent", 0, 0, "X"),
      ).toThrow("Table not found");
    });
  });

  describe("row selector variations", () => {
    test("selects row by numeric index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyReplaceTableCell(content, 0, 1, 0, "Charlie");
      expect(result).toContain("| Charlie | 25 |");
    });

    test("selects row by column name and value", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyReplaceTableCell(
        content,
        0,
        { column: "Name", value: "Bob" },
        1,
        "99",
      );
      expect(result).toContain("| Bob | 99 |");
    });

    test("selects row by column index and value", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyReplaceTableCell(
        content,
        0,
        { column: 0, value: "Alice" },
        1,
        "35",
      );
      expect(result).toContain("| Alice | 35 |");
    });

    test("throws when row not found by index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, 0, 5, 0, "X"),
      ).toThrow("out of bounds");
    });

    test("throws when row not found by value", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(
          content,
          0,
          { column: "Name", value: "Charlie" },
          0,
          "X",
        ),
      ).toThrow("No row found");
    });
  });

  describe("column selector variations", () => {
    test("selects column by numeric index", () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 | 2 | 3 |`;

      const result = applyReplaceTableCell(content, 0, 0, 2, "X");
      expect(result).toContain("| 1 | 2 | X |");
    });

    test("selects column by header name", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyReplaceTableCell(
        content,
        0,
        0,
        "Email",
        "new@example.com",
      );
      expect(result).toContain("| Alice | 30 | new@example.com |");
    });

    test("throws when column not found by index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, 0, 0, 5, "X"),
      ).toThrow("out of bounds");
    });

    test("throws when column not found by name", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, 0, 0, "Phone", "X"),
      ).toThrow("not found");
    });
  });

  describe("content variations", () => {
    test("replaces with empty string", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyReplaceTableCell(content, 0, 0, 1, "");
      expect(result).toContain("| Alice |  |");
    });

    test("replaces with multiword string", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyReplaceTableCell(content, 0, 0, 0, "Alice Smith");
      expect(result).toContain("| Alice Smith | 30 |");
    });

    test("replaces with special characters", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyReplaceTableCell(content, 0, 0, 0, "O'Brien");
      expect(result).toContain("| O'Brien | 30 |");
    });

    test("replaces with markdown formatting", () => {
      const content = `| Name | Status |
| :--- | :--- |
| Alice | Active |`;

      const result = applyReplaceTableCell(content, 0, 0, 1, "**Bold**");
      expect(result).toContain("| Alice | **Bold** |");
    });

    test("replaces with code formatting", () => {
      const content = `| Name | Code |
| :--- | :--- |
| Alice | foo |`;

      const result = applyReplaceTableCell(content, 0, 0, 1, "`bar()`");
      expect(result).toContain("| Alice | `bar()` |");
    });

    test("replaces with link", () => {
      const content = `| Name | Link |
| :--- | :--- |
| Alice | old |`;

      const result = applyReplaceTableCell(
        content,
        0,
        0,
        1,
        "[link](http://example.com)",
      );
      expect(result).toContain("| Alice | [link](http://example.com) |");
    });

    test("replaces with numeric value", () => {
      const content = `| Name | Count |
| :--- | ---: |
| Alice | 5 |`;

      const result = applyReplaceTableCell(content, 0, 0, 1, "123");
      expect(result).toContain("| Alice | 123 |");
    });
  });

  describe("complex selectors", () => {
    test("replaces using all string selectors", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |
| Bob | 25 | bob@example.com |`;

      const result = applyReplaceTableCell(
        content,
        "Name",
        { column: "Name", value: "Bob" },
        "Email",
        "robert@example.com",
      );
      expect(result).toContain("| Bob | 25 | robert@example.com |");
    });

    test("replaces using mixed numeric and string selectors", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |
| Bob | 25 | bob@example.com |`;

      const result = applyReplaceTableCell(
        content,
        0,
        { column: 0, value: "Alice" },
        "Age",
        "35",
      );
      expect(result).toContain("| Alice | 35 | alice@example.com |");
    });

    test("handles first matching row when duplicates exist", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Alice | 25 |`;

      const result = applyReplaceTableCell(
        content,
        0,
        { column: "Name", value: "Alice" },
        1,
        "99",
      );
      const lines = result.split("\n");
      expect(lines[2]).toContain("| Alice | 99 |");
      expect(lines[3]).toContain("| Alice | 25 |");
    });
  });

  describe("edge cases", () => {
    test("replaces in single-row table", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyReplaceTableCell(content, 0, 0, 0, "Bob");
      expect(result).toContain("| Bob | 30 |");
    });

    test("replaces in single-column table", () => {
      const content = `| Name |
| :--- |
| Alice |
| Bob |`;

      const result = applyReplaceTableCell(content, 0, 1, 0, "Charlie");
      expect(result).toContain("| Charlie |");
    });

    test("preserves surrounding content", () => {
      const content = `Before table

| Name | Age |
| :--- | ---: |
| Alice | 30 |

After table`;

      const result = applyReplaceTableCell(content, 0, 0, 0, "Bob");
      expect(result).toContain("Before table");
      expect(result).toContain("After table");
      expect(result).toContain("| Bob | 30 |");
    });

    test("works with multiple tables", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`;

      const result = applyReplaceTableCell(content, 1, 0, 0, "X");
      expect(result).toContain("| A |");
      expect(result).toContain("| X |");
    });
  });

  describe("error handling", () => {
    test("throws on negative row index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, 0, -1, 0, "X"),
      ).toThrow("out of bounds");
    });

    test("throws on negative column index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(content, 0, 0, -1, "X"),
      ).toThrow("out of bounds");
    });

    test("throws on invalid column in row selector", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyReplaceTableCell(
          content,
          0,
          { column: "Phone", value: "123" },
          0,
          "X",
        ),
      ).toThrow("not found");
    });
  });
});

describe("applyAddTableRow", () => {
  describe("basic row addition", () => {
    test("appends row to end by default", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableRow(content, 0, ["Bob", "25"]);
      expect(result).toContain("| Alice | 30 |");
      expect(result).toContain("| Bob | 25 |");
      const lines = result.split("\n");
      expect(lines[lines.length - 1]).toContain("| Bob | 25 |");
    });

    test("adds row to empty table", () => {
      const content = `| Name | Age |
| :--- | ---: |`;

      const result = applyAddTableRow(content, 0, ["Alice", "30"]);
      expect(result).toContain("| Alice | 30 |");
    });

    test("adds row with many columns", () => {
      const content = `| A | B | C | D | E |
| :--- | :--- | :--- | :--- | :--- |`;

      const result = applyAddTableRow(content, 0, ["1", "2", "3", "4", "5"]);
      expect(result).toContain("| 1 | 2 | 3 | 4 | 5 |");
    });
  });

  describe("position parameter", () => {
    test("inserts row at position 0 (beginning)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyAddTableRow(content, 0, ["Charlie", "35"], 0);
      const lines = result.split("\n");
      expect(lines[2]).toContain("| Charlie | 35 |");
      expect(lines[3]).toContain("| Alice | 30 |");
    });

    test("inserts row at position 1 (middle)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyAddTableRow(content, 0, ["Charlie", "35"], 1);
      const lines = result.split("\n");
      expect(lines[2]).toContain("| Alice | 30 |");
      expect(lines[3]).toContain("| Charlie | 35 |");
      expect(lines[4]).toContain("| Bob | 25 |");
    });

    test("inserts row at last position (same as append)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyAddTableRow(content, 0, ["Charlie", "35"], 2);
      const lines = result.split("\n");
      expect(lines[4]).toContain("| Charlie | 35 |");
    });

    test("throws on negative position", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableRow(content, 0, ["Bob", "25"], -1),
      ).toThrow("out of bounds");
    });

    test("throws on position too large", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableRow(content, 0, ["Bob", "25"], 5),
      ).toThrow("out of bounds");
    });
  });

  describe("table selector", () => {
    test("adds row to first table by index", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`;

      const result = applyAddTableRow(content, 0, ["C"]);
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(2);
      expect(tables[1].rows).toHaveLength(1);
    });

    test("adds row to second table by index", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`;

      const result = applyAddTableRow(content, 1, ["C"]);
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(1);
      expect(tables[1].rows).toHaveLength(2);
    });

    test("adds row to table by header name", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableRow(content, "Name", ["Bob", "25"]);
      expect(result).toContain("| Bob | 25 |");
    });

    test("throws when table not found", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableRow(content, 5, ["Bob", "25"]),
      ).toThrow("Table not found");
    });
  });

  describe("validation", () => {
    test("throws when row has too few cells", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      expect(() =>
        applyAddTableRow(content, 0, ["Bob", "25"]),
      ).toThrow("has 2 cells but table has 3 columns");
    });

    test("throws when row has too many cells", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableRow(content, 0, ["Bob", "25", "extra"]),
      ).toThrow("has 3 cells but table has 2 columns");
    });

    test("accepts row with exact column count", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyAddTableRow(content, 0, [
        "Bob",
        "25",
        "bob@example.com",
      ]);
      expect(result).toContain("| Bob | 25 | bob@example.com |");
    });
  });

  describe("cell content", () => {
    test("adds row with empty cells", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyAddTableRow(content, 0, ["Bob", "", ""]);
      expect(result).toContain("| Bob |  |  |");
    });

    test("adds row with special characters", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableRow(content, 0, ["O'Brien", "25"]);
      expect(result).toContain("| O'Brien | 25 |");
    });

    test("adds row with markdown formatting", () => {
      const content = `| Name | Status |
| :--- | :--- |
| Alice | Active |`;

      const result = applyAddTableRow(content, 0, ["Bob", "**Admin**"]);
      expect(result).toContain("| Bob | **Admin** |");
    });

    test("adds row with code formatting", () => {
      const content = `| Name | Command |
| :--- | :--- |
| Alice | foo |`;

      const result = applyAddTableRow(content, 0, ["Bob", "`bar()`"]);
      expect(result).toContain("| Bob | `bar()` |");
    });

    test("adds row with links", () => {
      const content = `| Name | Link |
| :--- | :--- |
| Alice | [A](http://a.com) |`;

      const result = applyAddTableRow(content, 0, [
        "Bob",
        "[B](http://b.com)",
      ]);
      expect(result).toContain("| Bob | [B](http://b.com) |");
    });

    test("adds row with whitespace in cells", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableRow(content, 0, ["Bob Smith", "25"]);
      expect(result).toContain("| Bob Smith | 25 |");
    });
  });

  describe("edge cases", () => {
    test("adds first row to empty table", () => {
      const content = `| Name | Age |
| :--- | ---: |`;

      const result = applyAddTableRow(content, 0, ["Alice", "30"]);
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(1);
    });

    test("adds to single-column table", () => {
      const content = `| Name |
| :--- |
| Alice |`;

      const result = applyAddTableRow(content, 0, ["Bob"]);
      expect(result).toContain("| Bob |");
    });

    test("preserves surrounding content", () => {
      const content = `Before

| Name | Age |
| :--- | ---: |
| Alice | 30 |

After`;

      const result = applyAddTableRow(content, 0, ["Bob", "25"]);
      expect(result).toContain("Before");
      expect(result).toContain("After");
      expect(result).toContain("| Bob | 25 |");
    });

    test("handles multiple sequential additions", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      let result = applyAddTableRow(content, 0, ["Bob", "25"]);
      result = applyAddTableRow(result, 0, ["Charlie", "35"]);

      expect(result).toContain("| Alice | 30 |");
      expect(result).toContain("| Bob | 25 |");
      expect(result).toContain("| Charlie | 35 |");
    });
  });
});

describe("applyRemoveTableRow", () => {
  describe("basic row removal", () => {
    test("removes row by numeric index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyRemoveTableRow(content, 0, 0);
      expect(result).not.toContain("| Alice | 30 |");
      expect(result).toContain("| Bob | 25 |");
    });

    test("removes second row", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyRemoveTableRow(content, 0, 1);
      expect(result).toContain("| Alice | 30 |");
      expect(result).not.toContain("| Bob | 25 |");
    });

    test("removes only row", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyRemoveTableRow(content, 0, 0);
      expect(result).not.toContain("| Alice | 30 |");
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(0);
    });

    test("removes middle row from three rows", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`;

      const result = applyRemoveTableRow(content, 0, 1);
      expect(result).toContain("| Alice | 30 |");
      expect(result).not.toContain("| Bob | 25 |");
      expect(result).toContain("| Charlie | 35 |");
    });
  });

  describe("row selector by value", () => {
    test("removes row by column name and value", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyRemoveTableRow(content, 0, {
        column: "Name",
        value: "Bob",
      });
      expect(result).toContain("| Alice | 30 |");
      expect(result).not.toContain("| Bob | 25 |");
    });

    test("removes row by column index and value", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyRemoveTableRow(content, 0, {
        column: 1,
        value: "30",
      });
      expect(result).not.toContain("| Alice | 30 |");
      expect(result).toContain("| Bob | 25 |");
    });

    test("removes first matching row when duplicates exist", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Alice | 25 |
| Bob | 35 |`;

      const result = applyRemoveTableRow(content, 0, {
        column: "Name",
        value: "Alice",
      });
      const lines = result.split("\n");
      expect(lines[2]).toContain("| Alice | 25 |");
      expect(result).toContain("| Bob | 35 |");
    });

    test("throws when no matching row found", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableRow(content, 0, {
          column: "Name",
          value: "Charlie",
        }),
      ).toThrow("No row found");
    });
  });

  describe("table selector", () => {
    test("removes from first table by index", () => {
      const content = `| T1 |
| :--- |
| A |
| B |

| T2 |
| :--- |
| C |`;

      const result = applyRemoveTableRow(content, 0, 0);
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(1);
      expect(tables[1].rows).toHaveLength(1);
    });

    test("removes from second table by index", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |
| C |`;

      const result = applyRemoveTableRow(content, 1, 0);
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(1);
      expect(tables[1].rows).toHaveLength(1);
    });

    test("removes from table by header name", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyRemoveTableRow(content, "Name", 0);
      expect(result).not.toContain("| Alice | 30 |");
    });

    test("throws when table not found", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableRow(content, 5, 0),
      ).toThrow("Table not found");
    });
  });

  describe("edge cases", () => {
    test("removes from single-column table", () => {
      const content = `| Name |
| :--- |
| Alice |
| Bob |`;

      const result = applyRemoveTableRow(content, 0, 0);
      expect(result).not.toContain("| Alice |");
      expect(result).toContain("| Bob |");
    });

    test("preserves surrounding content", () => {
      const content = `Before

| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |

After`;

      const result = applyRemoveTableRow(content, 0, 0);
      expect(result).toContain("Before");
      expect(result).toContain("After");
    });

    test("handles removing rows sequentially", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`;

      let result = applyRemoveTableRow(content, 0, 1);
      result = applyRemoveTableRow(result, 0, 0);

      expect(result).not.toContain("| Alice | 30 |");
      expect(result).not.toContain("| Bob | 25 |");
      expect(result).toContain("| Charlie | 35 |");
    });
  });

  describe("error handling", () => {
    test("throws on negative row index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableRow(content, 0, -1),
      ).toThrow("out of bounds");
    });

    test("throws on row index too large", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableRow(content, 0, 5),
      ).toThrow("out of bounds");
    });

    test("throws when column not found in selector", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableRow(content, 0, {
          column: "Phone",
          value: "123",
        }),
      ).toThrow("not found");
    });

    test("handles empty table gracefully", () => {
      const content = `| Name | Age |
| :--- | ---: |`;

      expect(() =>
        applyRemoveTableRow(content, 0, 0),
      ).toThrow("out of bounds");
    });
  });
});

describe("applyAddTableColumn", () => {
  describe("basic column addition", () => {
    test("appends column to end by default", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Email", "");
      expect(result).toContain("| Name | Age | Email |");
      expect(result).toContain("| Alice | 30 |  |");
    });

    test("adds column with default value", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const result = applyAddTableColumn(content, 0, "Status", "Active");
      expect(result).toContain("| Name | Age | Status |");
      expect(result).toContain("| Alice | 30 | Active |");
      expect(result).toContain("| Bob | 25 | Active |");
    });

    test("adds column to empty table", () => {
      const content = `| Name | Age |
| :--- | ---: |`;

      const result = applyAddTableColumn(content, 0, "Email");
      expect(result).toContain("| Name | Age | Email |");
    });

    test("adds column to table with single existing column", () => {
      const content = `| Name |
| :--- |
| Alice |`;

      const result = applyAddTableColumn(content, 0, "Age", "30");
      expect(result).toContain("| Name | Age |");
      expect(result).toContain("| Alice | 30 |");
    });
  });

  describe("position parameter", () => {
    test("inserts column at position 0 (beginning)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "ID", "1", 0);
      expect(result).toContain("| ID | Name | Age |");
      expect(result).toContain("| 1 | Alice | 30 |");
    });

    test("inserts column at position 1 (middle)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Email", "", 1);
      expect(result).toContain("| Name | Email | Age |");
      expect(result).toContain("| Alice |  | 30 |");
    });

    test("inserts column at last position (same as append)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Email", "", 2);
      expect(result).toContain("| Name | Age | Email |");
    });

    test("throws on negative position", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableColumn(content, 0, "Email", "", -1),
      ).toThrow("out of bounds");
    });

    test("throws on position too large", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableColumn(content, 0, "Email", "", 5),
      ).toThrow("out of bounds");
    });
  });

  describe("table selector", () => {
    test("adds column to first table by index", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`;

      const result = applyAddTableColumn(content, 0, "New");
      const tables = parseTables(result);
      expect(tables[0].headers).toHaveLength(2);
      expect(tables[1].headers).toHaveLength(1);
    });

    test("adds column to second table by index", () => {
      const content = `| T1 |
| :--- |
| A |

| T2 |
| :--- |
| B |`;

      const result = applyAddTableColumn(content, 1, "New");
      const tables = parseTables(result);
      expect(tables[0].headers).toHaveLength(1);
      expect(tables[1].headers).toHaveLength(2);
    });

    test("adds column to table by header name", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, "Name", "Email");
      expect(result).toContain("| Name | Age | Email |");
    });

    test("throws when table not found", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyAddTableColumn(content, 5, "Email"),
      ).toThrow("Table not found");
    });
  });

  describe("default values", () => {
    test("uses empty string when defaultValue omitted", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Email");
      expect(result).toContain("| Alice | 30 |  |");
    });

    test("applies default value to all rows", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`;

      const result = applyAddTableColumn(content, 0, "Country", "USA");
      expect(result).toContain("| Alice | 30 | USA |");
      expect(result).toContain("| Bob | 25 | USA |");
      expect(result).toContain("| Charlie | 35 | USA |");
    });

    test("handles default value with special characters", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Status", "N/A");
      expect(result).toContain("| Alice | 30 | N/A |");
    });

    test("handles default value with markdown", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Status", "**Active**");
      expect(result).toContain("| Alice | 30 | **Active** |");
    });
  });

  describe("edge cases", () => {
    test("adds column to table with no data rows", () => {
      const content = `| Name | Age |
| :--- | ---: |`;

      const result = applyAddTableColumn(content, 0, "Email", "");
      expect(result).toContain("| Name | Age | Email |");
      const tables = parseTables(result);
      expect(tables[0].rows).toHaveLength(0);
    });

    test("preserves surrounding content", () => {
      const content = `Before

| Name | Age |
| :--- | ---: |
| Alice | 30 |

After`;

      const result = applyAddTableColumn(content, 0, "Email");
      expect(result).toContain("Before");
      expect(result).toContain("After");
    });

    test("handles adding multiple columns sequentially", () => {
      const content = `| Name |
| :--- |
| Alice |`;

      let result = applyAddTableColumn(content, 0, "Age", "30");
      result = applyAddTableColumn(result, 0, "Email", "alice@example.com");

      expect(result).toContain("| Name | Age | Email |");
      expect(result).toContain("| Alice | 30 | alice@example.com |");
    });

    test("adds column with same header as existing (should allow)", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyAddTableColumn(content, 0, "Name", "");
      expect(result).toContain("| Name | Age | Name |");
    });
  });
});

describe("applyRemoveTableColumn", () => {
  describe("basic column removal", () => {
    test("removes column by numeric index", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyRemoveTableColumn(content, 0, 1);
      expect(result).toContain("| Name | Email |");
      expect(result).toContain("| Alice | alice@example.com |");
      expect(result).not.toContain("Age");
    });

    test("removes first column", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyRemoveTableColumn(content, 0, 0);
      expect(result).toContain("| Age | Email |");
      expect(result).not.toContain("Name");
    });

    test("removes last column", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyRemoveTableColumn(content, 0, 2);
      expect(result).toContain("| Name | Age |");
      expect(result).not.toContain("Email");
    });

    test("removes column by header name", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const result = applyRemoveTableColumn(content, 0, "Age");
      expect(result).toContain("| Name | Email |");
      expect(result).not.toContain("Age");
    });
  });

  describe("table selector", () => {
    test("removes from first table by index", () => {
      const content = `| A | B |
| :--- | :--- |
| 1 | 2 |

| C | D |
| :--- | :--- |
| 3 | 4 |`;

      const result = applyRemoveTableColumn(content, 0, 0);
      const tables = parseTables(result);
      expect(tables[0].headers).toHaveLength(1);
      expect(tables[1].headers).toHaveLength(2);
    });

    test("removes from second table by index", () => {
      const content = `| A | B |
| :--- | :--- |
| 1 | 2 |

| C | D |
| :--- | :--- |
| 3 | 4 |`;

      const result = applyRemoveTableColumn(content, 1, 0);
      const tables = parseTables(result);
      expect(tables[0].headers).toHaveLength(2);
      expect(tables[1].headers).toHaveLength(1);
    });

    test("removes from table by header name", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyRemoveTableColumn(content, "Name", "Age");
      expect(result).not.toContain("Age");
    });

    test("throws when table not found", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableColumn(content, 5, 0),
      ).toThrow("Table not found");
    });
  });

  describe("validation", () => {
    test("throws when removing last column", () => {
      const content = `| Name |
| :--- |
| Alice |`;

      expect(() =>
        applyRemoveTableColumn(content, 0, 0),
      ).toThrow("Cannot remove the last column");
    });

    test("allows removing down to one column", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const result = applyRemoveTableColumn(content, 0, 1);
      expect(result).toContain("| Name |");
      const tables = parseTables(result);
      expect(tables[0].headers).toHaveLength(1);
    });
  });

  describe("column selector", () => {
    test("removes by column index", () => {
      const content = `| A | B | C | D |
| :--- | :--- | :--- | :--- |
| 1 | 2 | 3 | 4 |`;

      const result = applyRemoveTableColumn(content, 0, 2);
      expect(result).toContain("| A | B | D |");
      expect(result).not.toContain("C");
    });

    test("removes by column name", () => {
      const content = `| Name | Age | Email | Phone |
| :--- | ---: | :--- | :--- |
| Alice | 30 | alice@example.com | 123 |`;

      const result = applyRemoveTableColumn(content, 0, "Email");
      expect(result).toContain("| Name | Age | Phone |");
      expect(result).not.toContain("Email");
    });

    test("throws when column index out of bounds", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableColumn(content, 0, 5),
      ).toThrow("out of bounds");
    });

    test("throws when column name not found", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableColumn(content, 0, "Phone"),
      ).toThrow("not found");
    });
  });

  describe("edge cases", () => {
    test("removes column from table with no data rows", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |`;

      const result = applyRemoveTableColumn(content, 0, 1);
      expect(result).toContain("| Name | Email |");
      const tables = parseTables(result);
      expect(tables[0].headers).toHaveLength(2);
    });

    test("removes column affecting multiple rows", () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |
| Bob | 25 | bob@example.com |
| Charlie | 35 | charlie@example.com |`;

      const result = applyRemoveTableColumn(content, 0, "Email");
      const lines = result.split("\n");
      expect(lines.length).toBe(5); // header + separator + 3 rows
      expect(result).not.toContain("alice@example.com");
      expect(result).not.toContain("bob@example.com");
      expect(result).not.toContain("charlie@example.com");
    });

    test("preserves surrounding content", () => {
      const content = `Before

| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |

After`;

      const result = applyRemoveTableColumn(content, 0, "Age");
      expect(result).toContain("Before");
      expect(result).toContain("After");
    });

    test("handles removing multiple columns sequentially", () => {
      const content = `| A | B | C | D |
| :--- | :--- | :--- | :--- |
| 1 | 2 | 3 | 4 |`;

      let result = applyRemoveTableColumn(content, 0, "B");
      result = applyRemoveTableColumn(result, 0, "C");

      expect(result).toContain("| A | D |");
      expect(result).not.toContain("B");
      expect(result).not.toContain("C");
    });
  });

  describe("error handling", () => {
    test("throws on negative column index", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableColumn(content, 0, -1),
      ).toThrow("out of bounds");
    });

    test("throws on empty column name", () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      expect(() =>
        applyRemoveTableColumn(content, 0, ""),
      ).toThrow("not found");
    });
  });
});
