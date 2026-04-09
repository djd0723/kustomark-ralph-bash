/**
 * Integration tests for table operations with applyPatches
 *
 * These tests verify the complete integration of 6 table operations:
 * 1. replace-table-cell - Replace content in specific table cells
 * 2. add-table-row - Add new rows to tables
 * 3. remove-table-row - Remove rows from tables
 * 4. add-table-column - Add new columns to tables
 * 5. remove-table-column - Remove columns from tables
 *
 * All tests use the applyPatches function with PatchOperation objects,
 * testing realistic markdown content and edge cases.
 */

import { describe, expect, test } from "bun:test";
import { applyPatches } from "../../src/core/patch-engine.js";
import type { PatchOperation } from "../../src/core/types.js";

/**
 * Helper to create test markdown with a simple table
 */
function createSimpleTable(rows: string[][] = [["Alice", "30"], ["Bob", "25"]]): string {
  const content = [
    "| Name | Age |",
    "| :--- | ---: |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
  return content.join("\n");
}

/**
 * Helper to create markdown with multiple tables
 */
function createMultipleTables(): string {
  return `# Team

| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |

## Projects

| Project | Status |
| :--- | :--- |
| ProjectA | Active |
| ProjectB | Inactive |
`;
}

/**
 * Helper to create markdown with tables in different sections
 */
function createTablesInSections(): string {
  return `# Introduction

Some intro text

## Personnel

| Name | Role |
| :--- | :--- |
| Alice | Manager |
| Bob | Developer |

## Infrastructure

| Server | Status |
| :--- | :--- |
| Server1 | Running |
| Server2 | Stopped |

# Conclusion

Final text`;
}

describe("Table Operations Integration - replace-table-cell", () => {
  describe("basic replacement with index selectors", () => {
    test("replaces cell using all numeric indices", async () => {
      const content = createSimpleTable();
      // Table starts at line 0 (first line is the header)
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 0,
          content: "Charlie",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | 30 |");
      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.applied).toBe(1);
    });

    test("replaces cell in middle row and column", async () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |`;

      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 1,
          column: 1,
          content: "X",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| 4 | X | 6 |");
      expect(result.applied).toBe(1);
    });

    test("replaces multiple cells in sequence", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 0,
          content: "Charlie",
        },
        {
          op: "replace-table-cell",
          table: 0,
          row: 1,
          column: 1,
          content: "99",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | 30 |");
      expect(result.content).toContain("| Bob | 99 |");
      expect(result.applied).toBe(2);
    });
  });

  describe("replacement with column name selector", () => {
    test("replaces cell using column name and row index", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: "Age",
          content: "35",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 35 |");
      expect(result.applied).toBe(1);
    });

    test("replaces using row value selector with column name", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: { column: "Name", value: "Bob" },
          column: "Age",
          content: "99",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Bob | 99 |");
      expect(result.applied).toBe(1);
    });

    test("replaces using row value selector with column index", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: { column: 0, value: "Alice" },
          column: 1,
          content: "40",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 40 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("replacement with special content", () => {
    test("replaces cell with markdown formatting", async () => {
      const content = `| Name | Status |
| :--- | :--- |
| Alice | Active |`;

      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 1,
          content: "**Active**",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | **Active** |");
      expect(result.applied).toBe(1);
    });

    test("replaces cell with code formatting", async () => {
      const content = `| Name | Command |
| :--- | :--- |
| Alice | foo |`;

      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 1,
          content: "`bar()`",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | `bar()` |");
      expect(result.applied).toBe(1);
    });

    test("replaces cell with link", async () => {
      const content = `| Name | Link |
| :--- | :--- |
| Alice | old |`;

      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 1,
          content: "[link](http://example.com)",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | [link](http://example.com) |");
      expect(result.applied).toBe(1);
    });

    test("replaces cell with empty string", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 1,
          content: "",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice |  |");
      expect(result.applied).toBe(1);
    });
  });

  describe("table not found", () => {
    test("returns no match warning when table not found by index", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 5,
          row: 0,
          column: 0,
          content: "X",
          onNoMatch: "warn",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test("throws error when table not found with onNoMatch error", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 5,
          row: 0,
          column: 0,
          content: "X",
          onNoMatch: "error",
        },
      ];

      expect(applyPatches(content, patches)).rejects.toThrow();
    });
  });

  describe("multiple tables in same document", () => {
    test("replaces cell in first table by line number", async () => {
      const content = createMultipleTables();
      // First table starts at line 2
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 2,
          row: 0,
          column: 0,
          content: "Charlie",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | 30 |");
      expect(result.content).toContain("| ProjectA | Active |");
      expect(result.applied).toBe(1);
    });

    test("replaces cell in second table by line number", async () => {
      const content = createMultipleTables();
      // Second table starts at line 9
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 9,
          row: 0,
          column: 0,
          content: "ProjectX",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| ProjectX | Active |");
      expect(result.content).toContain("| Alice | 30 |");
      expect(result.applied).toBe(1);
    });

    test("replaces in tables in different sections", async () => {
      const content = createTablesInSections();
      // First table (Personnel) starts at line 6
      // Second table (Infrastructure) starts at line 13
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 6,
          row: 0,
          column: 1,
          content: "Director",
        },
        {
          op: "replace-table-cell",
          table: 13,
          row: 1,
          column: 1,
          content: "Running",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | Director |");
      expect(result.content).toContain("| Server2 | Running |");
      expect(result.applied).toBe(2);
    });
  });
});

describe("Table Operations Integration - add-table-row", () => {
  describe("basic row addition", () => {
    test("appends row to table by default", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Charlie", "35"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | 35 |");
      expect(result.content).toContain("| Alice | 30 |");
      expect(result.content).toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("adds row to table with single existing row", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "25"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("adds row with many columns", async () => {
      const content = `| A | B | C | D | E |
| :--- | :--- | :--- | :--- | :--- |
| a | b | c | d | e |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["1", "2", "3", "4", "5"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| 1 | 2 | 3 | 4 | 5 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("row position parameter", () => {
    test("inserts row at beginning", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Charlie", "35"],
          position: 0,
        },
      ];

      const result = await applyPatches(content, patches);
      const lines = result.content.split("\n");

      expect(lines[2]).toContain("| Charlie | 35 |");
      expect(lines[3]).toContain("| Alice | 30 |");
      expect(result.applied).toBe(1);
    });

    test("inserts row in middle", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Charlie", "35"],
          position: 1,
        },
      ];

      const result = await applyPatches(content, patches);
      const lines = result.content.split("\n");

      expect(lines[2]).toContain("| Alice | 30 |");
      expect(lines[3]).toContain("| Charlie | 35 |");
      expect(lines[4]).toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("appends row when position equals row count", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Charlie", "35"],
          position: 2,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | 35 |");
      const lines = result.content.split("\n");
      expect(lines[lines.length - 1]).toContain("| Charlie | 35 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("row content variations", () => {
    test("adds row with empty cells", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "", ""],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Bob |  |  |");
      expect(result.applied).toBe(1);
    });

    test("adds row with markdown formatting", async () => {
      const content = `| Name | Status |
| :--- | :--- |
| Alice | Active |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "**Admin**"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Bob | **Admin** |");
      expect(result.applied).toBe(1);
    });

    test("adds row with special characters", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["O'Brien", "25"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| O'Brien | 25 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("multiple row additions", () => {
    test("adds multiple rows in sequence", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Charlie", "35"],
        },
        {
          op: "add-table-row",
          table: 0,
          values: ["Diana", "28"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 |");
      expect(result.content).toContain("| Bob | 25 |");
      expect(result.content).toContain("| Charlie | 35 |");
      expect(result.content).toContain("| Diana | 28 |");
      expect(result.applied).toBe(2);
    });

    test("adds rows to each table independently", async () => {
      const teamContent = `# Team

| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |`;

      const projectsContent = `# Projects

| Project | Status |
| :--- | :--- |
| ProjectA | Active |
| ProjectB | Inactive |`;

      // Apply patches to each table separately
      const teamPatches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 2,
          values: ["Charlie", "35"],
        },
      ];

      const projectsPatches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 2,
          values: ["ProjectC", "Pending"],
        },
      ];

      const teamResult = await applyPatches(teamContent, teamPatches);
      const projectsResult = await applyPatches(projectsContent, projectsPatches);

      expect(teamResult.content).toContain("| Charlie | 35 |");
      expect(projectsResult.content).toContain("| ProjectC | Pending |");
      expect(teamResult.applied).toBe(1);
      expect(projectsResult.applied).toBe(1);
    });
  });

  describe("table not found", () => {
    test("returns warning when table not found", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 5,
          values: ["Charlie", "35"],
          onNoMatch: "warn",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("Table Operations Integration - remove-table-row", () => {
  describe("basic row removal", () => {
    test("removes row by numeric index", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: 0,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.content).toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("removes second row", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 |");
      expect(result.content).not.toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("removes only row leaving empty table", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: 0,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.applied).toBe(1);
    });

    test("removes middle row from three rows", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 |");
      expect(result.content).not.toContain("| Bob | 25 |");
      expect(result.content).toContain("| Charlie | 35 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("row removal by value", () => {
    test("removes row by column name and value", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: { column: "Name", value: "Bob" },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 |");
      expect(result.content).not.toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("removes row by column index and value", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: { column: 1, value: "30" },
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.content).toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("removes first matching row when duplicates exist", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Alice | 25 |
| Bob | 35 |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: { column: "Name", value: "Alice" },
        },
      ];

      const result = await applyPatches(content, patches);
      const lines = result.content.split("\n");

      expect(lines[2]).toContain("| Alice | 25 |");
      expect(result.content).toContain("| Bob | 35 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("multiple removals", () => {
    test("removes multiple rows in sequence", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 0,
          row: 1,
        },
        {
          op: "remove-table-row",
          table: 0,
          row: 0,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.content).not.toContain("| Bob | 25 |");
      expect(result.content).toContain("| Charlie | 35 |");
      expect(result.applied).toBe(2);
    });

    test("removes rows from multiple tables", async () => {
      const content = createMultipleTables();
      // First table at line 2, second table at line 9
      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 2,
          row: 0,
        },
        {
          op: "remove-table-row",
          table: 9,
          row: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.content).not.toContain("| ProjectB | Inactive |");
      expect(result.applied).toBe(2);
    });
  });

  describe("table not found", () => {
    test("returns warning when table not found", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "remove-table-row",
          table: 5,
          row: 0,
          onNoMatch: "warn",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("Table Operations Integration - add-table-column", () => {
  describe("basic column addition", () => {
    test("appends column to end by default", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Email |");
      expect(result.content).toContain("| Alice | 30 |  |");
      expect(result.applied).toBe(1);
    });

    test("adds column with default value", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Status",
          defaultValue: "Active",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Status |");
      expect(result.content).toContain("| Alice | 30 | Active |");
      expect(result.content).toContain("| Bob | 25 | Active |");
      expect(result.applied).toBe(1);
    });

    test("adds column to table with single row", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Email |");
      expect(result.applied).toBe(1);
    });

    test("adds column to single-column table", async () => {
      const content = `| Name |
| :--- |
| Alice |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Age",
          defaultValue: "30",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age |");
      expect(result.content).toContain("| Alice | 30 |");
      expect(result.applied).toBe(1);
    });
  });

  describe("column position parameter", () => {
    test("inserts column at beginning", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "ID",
          defaultValue: "1",
          position: 0,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| ID | Name | Age |");
      expect(result.content).toContain("| 1 | Alice | 30 |");
      expect(result.applied).toBe(1);
    });

    test("inserts column in middle", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
          position: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Email | Age |");
      expect(result.content).toContain("| Alice |  | 30 |");
      expect(result.applied).toBe(1);
    });

    test("appends column when position equals header count", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
          position: 2,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Email |");
      expect(result.applied).toBe(1);
    });
  });

  describe("default values", () => {
    test("uses empty string when defaultValue omitted", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 |  |");
      expect(result.applied).toBe(1);
    });

    test("applies default value to all rows", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Country",
          defaultValue: "USA",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 | USA |");
      expect(result.content).toContain("| Bob | 25 | USA |");
      expect(result.content).toContain("| Charlie | 35 | USA |");
      expect(result.applied).toBe(1);
    });

    test("applies markdown default value", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Status",
          defaultValue: "**Active**",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Alice | 30 | **Active** |");
      expect(result.applied).toBe(1);
    });
  });

  describe("multiple columns addition", () => {
    test("adds multiple columns in sequence", async () => {
      const content = `| Name |
| :--- |
| Alice |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Age",
          defaultValue: "30",
        },
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
          defaultValue: "alice@example.com",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Email |");
      expect(result.content).toContain("| Alice | 30 | alice@example.com |");
      expect(result.applied).toBe(2);
    });

    test("adds columns to multiple tables", async () => {
      const content = createMultipleTables();
      // First table at line 2, second table at line 9
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 2,
          header: "Email",
        },
        {
          op: "add-table-column",
          table: 9,
          header: "Owner",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Email |");
      expect(result.content).toContain("| Project | Status | Owner |");
      expect(result.applied).toBe(2);
    });
  });

  describe("table not found", () => {
    test("returns warning when table not found", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 5,
          header: "Email",
          onNoMatch: "warn",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("Table Operations Integration - remove-table-column", () => {
  describe("basic column removal", () => {
    test("removes column by numeric index", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Email |");
      expect(result.content).toContain("| Alice | alice@example.com |");
      expect(result.content).not.toContain("Age");
      expect(result.applied).toBe(1);
    });

    test("removes first column", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: 0,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Age | Email |");
      expect(result.content).not.toContain("Name");
      expect(result.applied).toBe(1);
    });

    test("removes last column", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: 2,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age |");
      expect(result.content).not.toContain("Email");
      expect(result.applied).toBe(1);
    });

    test("removes column by header name", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: "Age",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Email |");
      expect(result.content).not.toContain("Age");
      expect(result.applied).toBe(1);
    });
  });

  describe("multiple column removal", () => {
    test("removes multiple columns in sequence", async () => {
      const content = `| A | B | C | D |
| :--- | :--- | :--- | :--- |
| 1 | 2 | 3 | 4 |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: "B",
        },
        {
          op: "remove-table-column",
          table: 0,
          column: "C",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| A | D |");
      expect(result.content).not.toContain("B");
      expect(result.content).not.toContain("C");
      expect(result.applied).toBe(2);
    });

    test("removes columns from multiple tables", async () => {
      const content = createMultipleTables();
      // First table at line 2, second table at line 9
      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 2,
          column: 1,
        },
        {
          op: "remove-table-column",
          table: 9,
          column: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name |");
      expect(result.content).toContain("| Project |");
      expect(result.applied).toBe(2);
    });
  });

  describe("edge cases", () => {
    test("removes column from table with single data row", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: 1,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Email |");
      expect(result.applied).toBe(1);
    });

    test("removes column affecting multiple rows", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |
| Bob | 25 | bob@example.com |
| Charlie | 35 | charlie@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: "Email",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).not.toContain("alice@example.com");
      expect(result.content).not.toContain("bob@example.com");
      expect(result.content).not.toContain("charlie@example.com");
      expect(result.applied).toBe(1);
    });
  });

  describe("table not found", () => {
    test("returns warning when table not found", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 5,
          column: 0,
          onNoMatch: "warn",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("Combined Table Operations", () => {
  describe("mixing different operations", () => {
    test("adds row then replaces cell", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Charlie", "35"],
        },
        {
          op: "replace-table-cell",
          table: 0,
          row: 2,
          column: 1,
          content: "40",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | 40 |");
      expect(result.applied).toBe(2);
    });

    test("adds column then removes row", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 0,
          header: "Email",
        },
        {
          op: "remove-table-row",
          table: 0,
          row: 0,
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age | Email |");
      expect(result.content).not.toContain("| Alice | 30 |");
      expect(result.applied).toBe(2);
    });

    test("removes column then adds row", async () => {
      const content = `| Name | Age | Email |
| :--- | ---: | :--- |
| Alice | 30 | alice@example.com |`;

      const patches: PatchOperation[] = [
        {
          op: "remove-table-column",
          table: 0,
          column: 2,
        },
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "25"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Age |");
      expect(result.content).toContain("| Bob | 25 |");
      expect(result.applied).toBe(2);
    });
  });

  describe("complex realistic scenarios", () => {
    test("updates team table with multiple operations", async () => {
      const content = `# Team Members

| Name | Role | Active |
| :--- | :--- | :--- |
| Alice | Manager | Yes |
| Bob | Developer | Yes |`;

      // Table starts at line 2
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 2,
          header: "Start Date",
          defaultValue: "2024",
        },
        {
          op: "replace-table-cell",
          table: 2,
          row: { column: "Name", value: "Alice" },
          column: "Role",
          content: "Director",
        },
        {
          op: "add-table-row",
          table: 2,
          values: ["Charlie", "Designer", "Yes", "2024"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Name | Role | Active | Start Date |");
      expect(result.content).toContain("| Alice | Director | Yes | 2024 |");
      expect(result.content).toContain("| Charlie | Designer | Yes | 2024 |");
      expect(result.applied).toBe(3);
    });

    test("refactors project tracking table", async () => {
      const content = `# Projects

| Project | Status |
| :--- | :--- |
| ProjectA | Active |
| ProjectB | Inactive |
| ProjectC | Active |`;

      // Table starts at line 2
      const patches: PatchOperation[] = [
        {
          op: "add-table-column",
          table: 2,
          header: "Owner",
          defaultValue: "TBD",
        },
        {
          op: "remove-table-row",
          table: 2,
          row: { column: "Project", value: "ProjectB" },
        },
        {
          op: "replace-table-cell",
          table: 2,
          row: 0,
          column: "Owner",
          content: "Alice",
        },
        {
          op: "replace-table-cell",
          table: 2,
          row: 1,
          column: "Owner",
          content: "Bob",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Project | Status | Owner |");
      expect(result.content).not.toContain("| ProjectB | Inactive |");
      expect(result.content).toContain("| ProjectA | Active | Alice |");
      expect(result.content).toContain("| ProjectC | Active | Bob |");
      expect(result.applied).toBe(4);
    });
  });

  describe("onNoMatch strategy verification", () => {
    test("warn strategy produces warnings for missing tables", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 5,
          values: ["X", "Y"],
          onNoMatch: "warn",
        },
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 0,
          content: "Updated",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.content).toContain("| Updated | 30 |");
    });

    test("skip strategy silently ignores missing tables", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 5,
          values: ["X", "Y"],
          onNoMatch: "skip",
        },
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 0,
          content: "Updated",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
      expect(result.warnings.length).toBe(0);
      expect(result.content).toContain("| Updated | 30 |");
    });

    test("default onNoMatch applies to patch operations", async () => {
      const content = createSimpleTable();
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 5,
          values: ["X", "Y"],
        },
      ];

      const result = await applyPatches(content, patches, "warn");

      expect(result.applied).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("Edge Cases and Error Handling", () => {
  describe("table content preservation", () => {
    test("preserves surrounding markdown content", async () => {
      const content = `# Header

Some text before the table

| Name | Age |
| :--- | ---: |
| Alice | 30 |

Some text after the table`;

      // Table starts at line 4
      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 4,
          row: 0,
          column: 0,
          content: "Bob",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("# Header");
      expect(result.content).toContain("Some text before the table");
      expect(result.content).toContain("Some text after the table");
      expect(result.content).toContain("| Bob | 30 |");
    });

    test("works with tables in sections", async () => {
      const content = createTablesInSections();
      // First table (Personnel) starts at line 6
      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 6,
          values: ["Charlie", "Lead"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Charlie | Lead |");
      expect(result.content).toContain("# Introduction");
      expect(result.content).toContain("## Personnel");
      expect(result.applied).toBe(1);
    });
  });

  describe("empty and minimal tables", () => {
    test("works with tables containing single data row", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "25"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Bob | 25 |");
      expect(result.applied).toBe(1);
    });

    test("handles single-column tables", async () => {
      const content = `| Name |
| :--- |
| Alice |`;

      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 0,
          content: "Bob",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("| Bob |");
      expect(result.applied).toBe(1);
    });
  });

  describe("special characters and formatting", () => {
    test("preserves pipe characters in cells with escaping", async () => {
      const content = `| Name | Code |
| :--- | :--- |
| Alice | foo |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "bar\\|baz"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.applied).toBe(1);
    });

    test("handles cells with links and complex formatting", async () => {
      const content = `| Name | Link |
| :--- | :--- |
| Alice | [docs](http://example.com) |`;

      const patches: PatchOperation[] = [
        {
          op: "replace-table-cell",
          table: 0,
          row: 0,
          column: 1,
          content: "[new](http://newsite.com)",
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("[new](http://newsite.com)");
      expect(result.applied).toBe(1);
    });

    test("handles unicode characters in table cells", async () => {
      const content = `| Name | City |
| :--- | :--- |
| Alice | New York |`;

      const patches: PatchOperation[] = [
        {
          op: "add-table-row",
          table: 0,
          values: ["Bob", "São Paulo"],
        },
      ];

      const result = await applyPatches(content, patches);

      expect(result.content).toContain("São Paulo");
      expect(result.applied).toBe(1);
    });
  });

  describe("sort-table operation", () => {
    test("sorts rows ascending by string column (default)", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Charlie | 35 |
| Alice | 30 |
| Bob | 25 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "Name" },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(2);
      expect(rows[0]).toContain("Alice");
      expect(rows[1]).toContain("Bob");
      expect(rows[2]).toContain("Charlie");
      expect(result.applied).toBe(1);
    });

    test("sorts rows descending by string column", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |
| Charlie | 35 |
| Bob | 25 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "Name", direction: "desc" },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(2);
      expect(rows[0]).toContain("Charlie");
      expect(rows[1]).toContain("Bob");
      expect(rows[2]).toContain("Alice");
      expect(result.applied).toBe(1);
    });

    test("sorts rows by numeric column", async () => {
      const content = `| Name | Score |
| :--- | ---: |
| Bob | 100 |
| Alice | 5 |
| Charlie | 50 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "Score", type: "number" },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(2);
      expect(rows[0]).toContain("Alice");
      expect(rows[1]).toContain("Charlie");
      expect(rows[2]).toContain("Bob");
      expect(result.applied).toBe(1);
    });

    test("sorts rows by numeric column descending", async () => {
      const content = `| Name | Score |
| :--- | ---: |
| Alice | 5 |
| Bob | 100 |
| Charlie | 50 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "Score", type: "number", direction: "desc" },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(2);
      expect(rows[0]).toContain("Bob");
      expect(rows[1]).toContain("Charlie");
      expect(rows[2]).toContain("Alice");
      expect(result.applied).toBe(1);
    });

    test("sorts by column index instead of name", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Charlie | 35 |
| Alice | 30 |
| Bob | 25 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: 0 },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(2);
      expect(rows[0]).toContain("Alice");
      expect(rows[1]).toContain("Bob");
      expect(rows[2]).toContain("Charlie");
      expect(result.applied).toBe(1);
    });

    test("returns count 0 when table not found", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 99, column: "Name" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test("returns count 0 when column not found", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "NonExistent" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.applied).toBe(0);
    });

    test("sorts by date column", async () => {
      const content = `| Event | Date |
| :--- | :--- |
| Release | 2024-03-15 |
| Launch | 2023-01-01 |
| Update | 2024-01-10 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "Date", type: "date" },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(2);
      expect(rows[0]).toContain("Launch");
      expect(rows[1]).toContain("Update");
      expect(rows[2]).toContain("Release");
      expect(result.applied).toBe(1);
    });

    test("selects table by section heading", async () => {
      const content = `# Team

| Name | Role |
| :--- | :--- |
| Charlie | Dev |
| Alice | Lead |
| Bob | QA |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: "team", column: "Name" },
      ];

      const result = await applyPatches(content, patches);
      const rows = result.content.split("\n").slice(4);
      expect(rows[0]).toContain("Alice");
      expect(rows[1]).toContain("Bob");
      expect(rows[2]).toContain("Charlie");
      expect(result.applied).toBe(1);
    });

    test("preserves header and alignment row", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Bob | 25 |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        { op: "sort-table", table: 0, column: "Name" },
      ];

      const result = await applyPatches(content, patches);
      const lines = result.content.split("\n");
      expect(lines[0]).toContain("Name");
      expect(lines[0]).toContain("Age");
      expect(lines[1]).toContain(":---");
      expect(lines[1]).toContain("---:");
    });
  });

  describe("rename-table-column operation", () => {
    test("renames a column by header name", async () => {
      const content = `| Name | Age | City |
| :--- | ---: | :--- |
| Alice | 30 | NYC |
| Bob | 25 | LA |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 0, column: "Name", new: "Full Name" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.content).toContain("Full Name");
      expect(result.content).not.toContain("| Name |");
      expect(result.content).toContain("Age");
      expect(result.content).toContain("City");
      expect(result.applied).toBe(1);
    });

    test("renames a column by 0-based index", async () => {
      const content = `| Name | Age | City |
| :--- | ---: | :--- |
| Alice | 30 | NYC |
| Bob | 25 | LA |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 0, column: 1, new: "Years" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.content).toContain("Years");
      expect(result.content).not.toContain("| Age |");
      expect(result.content).toContain("Name");
      expect(result.content).toContain("City");
      expect(result.applied).toBe(1);
    });

    test("preserves all data rows unchanged", async () => {
      const content = `| Name | Score |
| :--- | ---: |
| Alice | 100 |
| Bob | 75 |
| Charlie | 90 |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 0, column: "Score", new: "Points" },
      ];

      const result = await applyPatches(content, patches);
      const lines = result.content.split("\n");
      expect(lines[2]).toContain("Alice");
      expect(lines[2]).toContain("100");
      expect(lines[3]).toContain("Bob");
      expect(lines[3]).toContain("75");
      expect(lines[4]).toContain("Charlie");
      expect(lines[4]).toContain("90");
    });

    test("preserves column alignment", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 0, column: "Age", new: "Years" },
      ];

      const result = await applyPatches(content, patches);
      const lines = result.content.split("\n");
      expect(lines[1]).toContain(":---");
      expect(lines[1]).toContain("---:");
    });

    test("returns count 0 when table not found", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 99, column: "Name", new: "Full Name" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test("returns count 0 when column not found", async () => {
      const content = `| Name | Age |
| :--- | ---: |
| Alice | 30 |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 0, column: "NonExistent", new: "Whatever" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.applied).toBe(0);
      expect(result.content).toBe(content);
    });

    test("renames column identified by section heading", async () => {
      const content = `## team

| Name | Role |
| :--- | :--- |
| Alice | Engineer |
| Bob | Designer |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: "team", column: "Role", new: "Position" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.content).toContain("Position");
      expect(result.content).not.toContain("| Role |");
      expect(result.content).toContain("Alice");
      expect(result.applied).toBe(1);
    });

    test("renames the last column", async () => {
      const content = `| A | B | C |
| :--- | :--- | :--- |
| 1 | 2 | 3 |`;

      const patches: PatchOperation[] = [
        { op: "rename-table-column", table: 0, column: 2, new: "Z" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.content).toContain("Z");
      expect(result.content).toContain("A");
      expect(result.content).toContain("B");
    });
  });
});

describe("Table Operations Integration - filter-table-rows", () => {
  const baseTable = `| Name | Status | Score |
| :--- | :--- | ---: |
| Alice | Active | 90 |
| Bob | Inactive | 75 |
| Charlie | Active | 85 |
| Diana | Inactive | 60 |`;

  describe("exact match filtering", () => {
    test("keeps only rows matching exact column value", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Status", match: "Active" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).toContain("Alice");
      expect(result.content).toContain("Charlie");
      expect(result.content).not.toContain("Bob");
      expect(result.content).not.toContain("Diana");
      expect(result.applied).toBe(1);
    });

    test("filters by numeric column index", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: 1, match: "Inactive" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).toContain("Bob");
      expect(result.content).toContain("Diana");
      expect(result.content).not.toContain("Alice");
      expect(result.content).not.toContain("Charlie");
      expect(result.applied).toBe(1);
    });

    test("preserves header and alignment rows", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Status", match: "Active" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).toContain("| Name | Status | Score |");
      expect(result.content).toContain("| :--- | :--- | ---: |");
    });

    test("removes all rows when no match", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Status", match: "Pending" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).not.toContain("Alice");
      expect(result.content).not.toContain("Bob");
      expect(result.content).not.toContain("Charlie");
      expect(result.content).not.toContain("Diana");
      expect(result.content).toContain("| Name | Status | Score |");
      expect(result.applied).toBe(1);
    });

    test("keeps all rows when all match", async () => {
      const allActive = `| Name | Status |
| :--- | :--- |
| Alice | Active |
| Charlie | Active |`;

      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Status", match: "Active" },
      ];

      const result = await applyPatches(allActive, patches);
      expect(result.content).toContain("Alice");
      expect(result.content).toContain("Charlie");
      expect(result.applied).toBe(1);
    });
  });

  describe("regex pattern filtering", () => {
    test("keeps rows matching regex pattern", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Name", pattern: "^A" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).toContain("Alice");
      expect(result.content).not.toContain("Bob");
      expect(result.content).not.toContain("Charlie");
      expect(result.content).not.toContain("Diana");
      expect(result.applied).toBe(1);
    });

    test("filters by numeric score pattern", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Score", pattern: "^[89]" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).toContain("Alice");
      expect(result.content).toContain("Charlie");
      expect(result.content).not.toContain("Bob");
      expect(result.content).not.toContain("Diana");
      expect(result.applied).toBe(1);
    });

    test("regex filter with alternation", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Status", pattern: "Active|Pending" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).toContain("Alice");
      expect(result.content).toContain("Charlie");
      expect(result.content).not.toContain("Bob");
      expect(result.content).not.toContain("Diana");
      expect(result.applied).toBe(1);
    });
  });

  describe("inverted filtering", () => {
    test("keeps rows NOT matching when invert is true", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Status", match: "Active", invert: true },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).not.toContain("Alice");
      expect(result.content).not.toContain("Charlie");
      expect(result.content).toContain("Bob");
      expect(result.content).toContain("Diana");
      expect(result.applied).toBe(1);
    });

    test("invert with regex pattern", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "Name", pattern: "^A", invert: true },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.content).not.toContain("Alice");
      expect(result.content).toContain("Bob");
      expect(result.content).toContain("Charlie");
      expect(result.content).toContain("Diana");
      expect(result.applied).toBe(1);
    });
  });

  describe("error handling", () => {
    test("returns count 0 when table not found", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 99, column: "Status", match: "Active" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.applied).toBe(0);
      expect(result.content).toBe(baseTable);
    });

    test("returns count 0 when column not found", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: "NonExistent", match: "Active" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.applied).toBe(0);
      expect(result.content).toBe(baseTable);
    });

    test("returns count 0 when column index out of bounds", async () => {
      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 0, column: 99, match: "Active" },
      ];

      const result = await applyPatches(baseTable, patches);
      expect(result.applied).toBe(0);
      expect(result.content).toBe(baseTable);
    });
  });

  describe("section heading lookup", () => {
    test("filters table identified by section heading", async () => {
      const content = `## team

| Name | Status |
| :--- | :--- |
| Alice | Active |
| Bob | Inactive |
| Charlie | Active |`;

      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: "team", column: "Status", match: "Active" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.content).toContain("Alice");
      expect(result.content).toContain("Charlie");
      expect(result.content).not.toContain("Bob");
      expect(result.applied).toBe(1);
    });
  });

  describe("content surrounding table is preserved", () => {
    test("text before and after table is unchanged", async () => {
      const content = `# Report

Some introduction text.

| Name | Status |
| :--- | :--- |
| Alice | Active |
| Bob | Inactive |

Conclusion text.`;

      const patches: PatchOperation[] = [
        { op: "filter-table-rows", table: 4, column: "Status", match: "Active" },
      ];

      const result = await applyPatches(content, patches);
      expect(result.content).toContain("# Report");
      expect(result.content).toContain("Some introduction text.");
      expect(result.content).toContain("Conclusion text.");
      expect(result.content).toContain("Alice");
      expect(result.content).not.toContain("Bob");
    });
  });
});
