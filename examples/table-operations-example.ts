/**
 * Example usage of table operations in kustomark
 *
 * This example demonstrates all 5 new table operation functions:
 * - applyReplaceTableCell
 * - applyAddTableRow
 * - applyRemoveTableRow
 * - applyAddTableColumn
 * - applyRemoveTableColumn
 */

import {
  applyReplaceTableCell,
  applyAddTableRow,
  applyRemoveTableRow,
  applyAddTableColumn,
  applyRemoveTableColumn,
  applyPatches,
} from "../src/core/patch-engine.js";
import type { PatchOperation } from "../src/core/types.js";

// Sample markdown with a table
const markdown = `# Employee Data

## Staff List

| Name  | Age | City      | Department |
|-------|-----|-----------|------------|
| Alice | 30  | NYC       | Engineering |
| Bob   | 25  | LA        | Marketing   |
| Carol | 28  | SF        | Design      |
| David | 35  | Austin    | Engineering |

## Summary

Total employees: 4
`;

console.log("Original Markdown:");
console.log(markdown);
console.log("\n" + "=".repeat(60) + "\n");

// Example 1: Replace a table cell
console.log("Example 1: Replace Alice's age from 30 to 31");
const result1 = applyReplaceTableCell(
  markdown,
  0,           // First table (0-based index)
  0,           // First row (0-based index)
  "Age",       // Column named "Age"
  "31"         // New value
);
console.log(`Applied: ${result1.count} change(s)`);
console.log(result1.content.split('\n').slice(0, 15).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

// Example 2: Add a new row
console.log("Example 2: Add a new employee row");
const result2 = applyAddTableRow(
  markdown,
  0,                                          // First table
  ["Eve", "27", "Seattle", "Engineering"],    // New row data
  -1                                          // Append to end
);
console.log(`Applied: ${result2.count} change(s)`);
console.log(result2.content.split('\n').slice(0, 18).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

// Example 3: Remove a row by search criteria
console.log("Example 3: Remove Bob's row (by name search)");
const result3 = applyRemoveTableRow(
  markdown,
  0,                              // First table
  { column: "Name", value: "Bob" }  // Find row where Name = Bob
);
console.log(`Applied: ${result3.count} change(s)`);
console.log(result3.content.split('\n').slice(0, 15).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

// Example 4: Add a new column
console.log("Example 4: Add a 'Salary' column");
const result4 = applyAddTableColumn(
  markdown,
  0,            // First table
  "Salary",     // Column header
  "$0",         // Default value for existing rows
  -1            // Append to end
);
console.log(`Applied: ${result4.count} change(s)`);
console.log(result4.content.split('\n').slice(0, 15).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

// Example 5: Remove a column
console.log("Example 5: Remove the 'City' column");
const result5 = applyRemoveTableColumn(
  markdown,
  0,        // First table
  "City"    // Column to remove (by name)
);
console.log(`Applied: ${result5.count} change(s)`);
console.log(result5.content.split('\n').slice(0, 15).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

// Example 6: Using applyPatches with multiple table operations
console.log("Example 6: Apply multiple table operations using applyPatches");
const patches: PatchOperation[] = [
  {
    op: "replace-table-cell",
    table: 0,
    row: 0,
    column: "Age",
    content: "31"
  },
  {
    op: "add-table-row",
    table: 0,
    values: ["Frank", "29", "Portland", "Sales"],
    position: -1
  },
  {
    op: "add-table-column",
    table: 0,
    header: "Email",
    defaultValue: "N/A"
  },
  {
    op: "remove-table-row",
    table: 0,
    row: { column: "Name", value: "Bob" }
  }
];

const result6 = applyPatches(markdown, patches);
console.log(`Applied: ${result6.applied} patch(es)`);
console.log(`Warnings: ${result6.warnings.length}`);
console.log(`Validation Errors: ${result6.validationErrors.length}`);
console.log(result6.content.split('\n').slice(0, 18).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

// Example 7: Error handling - table not found
console.log("Example 7: Error handling - table not found");
const result7 = applyReplaceTableCell(
  markdown,
  999,      // Non-existent table
  0,
  "Age",
  "99"
);
console.log(`Applied: ${result7.count} change(s) (expected 0)`);
console.log(`Content unchanged: ${result7.content === markdown}`);
console.log("\n" + "=".repeat(60) + "\n");

// Example 8: Working with table by section ID
const markdownWithSections = `# Report

## Financial Data {#finance}

| Quarter | Revenue | Expenses |
|---------|---------|----------|
| Q1      | 100k    | 80k      |
| Q2      | 120k    | 90k      |

## Employee Data {#employees}

| Name  | Department |
|-------|------------|
| Alice | Eng        |
| Bob   | Marketing  |
`;

console.log("Example 8: Find table by section ID");
const result8 = applyReplaceTableCell(
  markdownWithSections,
  "finance",     // Section ID (instead of table index)
  0,             // First row
  "Revenue",     // Column
  "105k"         // New value
);
console.log(`Applied: ${result8.count} change(s)`);
console.log(result8.content.split('\n').slice(0, 12).join('\n'));
console.log("\n" + "=".repeat(60) + "\n");

console.log("All examples completed!");
