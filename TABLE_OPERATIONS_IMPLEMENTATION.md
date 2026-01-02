# Table Operations Implementation Summary

This document summarizes the implementation of 5 new table operation functions in the kustomark patch engine.

## Files Modified

### 1. `/home/dex/kustomark-ralph-bash/src/core/types.ts`

Added 5 new patch operation type definitions:

- **ReplaceTableCellPatch**: Replace content in a specific table cell
  - Fields: `table`, `row`, `column`, `content`

- **AddTableRowPatch**: Add a new row to a table
  - Fields: `table`, `values`, `position` (optional)

- **RemoveTableRowPatch**: Remove a row from a table
  - Fields: `table`, `row`

- **AddTableColumnPatch**: Add a new column to a table
  - Fields: `table`, `header`, `defaultValue` (optional), `position` (optional)

- **RemoveTableColumnPatch**: Remove a column from a table
  - Fields: `table`, `column`

All types extend `PatchCommonFields` and were added to the `PatchOperation` union type.

### 2. `/home/dex/kustomark-ralph-bash/src/core/patch-engine.ts`

#### Imports Added
```typescript
import {
  findTable,
  getColumnIndex,
  findRowIndex,
  parseTables,
  serializeTable,
} from "./table-parser.js";
```

#### New Functions Implemented

1. **applyReplaceTableCell()**
   - Replaces content in a specific table cell
   - Parameters: content, tableIdentifier, rowIdentifier, columnIdentifier, newContent
   - Returns: {content: string, count: number}
   - Handles edge cases: table not found, column not found, row not found

2. **applyAddTableRow()**
   - Adds a row to a table at specified position
   - Parameters: content, tableIdentifier, values, position (optional)
   - Returns: {content: string, count: number}
   - Auto-normalizes row to match table column count

3. **applyRemoveTableRow()**
   - Removes a row from a table
   - Parameters: content, tableIdentifier, rowIdentifier
   - Returns: {content: string, count: number}
   - Supports row lookup by index or search criteria

4. **applyAddTableColumn()**
   - Adds a column to a table at specified position
   - Parameters: content, tableIdentifier, header, defaultValue, position (optional)
   - Returns: {content: string, count: number}
   - Adds header, alignment, and default values to all rows

5. **applyRemoveTableColumn()**
   - Removes a column from a table
   - Parameters: content, tableIdentifier, columnIdentifier
   - Returns: {content: string, count: number}
   - Removes header, alignment, and column data from all rows

#### Switch Statement Updates

Added 5 new cases to the switch statement in `applySinglePatch()`:

```typescript
case "replace-table-cell":
  result = applyReplaceTableCell(content, patch.table, patch.row, patch.column, patch.content);
  break;

case "add-table-row":
  result = applyAddTableRow(content, patch.table, patch.values, patch.position);
  break;

case "remove-table-row":
  result = applyRemoveTableRow(content, patch.table, patch.row);
  break;

case "add-table-column":
  result = applyAddTableColumn(
    content,
    patch.table,
    patch.header,
    patch.defaultValue,
    patch.position,
  );
  break;

case "remove-table-column":
  result = applyRemoveTableColumn(content, patch.table, patch.column);
  break;
```

#### getPatchDescription() Updates

Added descriptive text for all 5 new operations:

```typescript
case "replace-table-cell":
  return `replace-table-cell in table '${patch.table}' at row ${...} column '${patch.column}'`;
case "add-table-row":
  return `add-table-row to table '${patch.table}' at position ${patch.position ?? 'end'}`;
case "remove-table-row":
  return `remove-table-row from table '${patch.table}' at row ${...}`;
case "add-table-column":
  return `add-table-column '${patch.header}' to table '${patch.table}' at position ${patch.position ?? 'end'}`;
case "remove-table-column":
  return `remove-table-column '${patch.column}' from table '${patch.table}'`;
```

## Table Parser Module

The implementation leverages the existing `/home/dex/kustomark-ralph-bash/src/core/table-parser.ts` module which provides:

- `parseTables()`: Parse all tables from markdown content
- `findTable()`: Find a table by index or section ID
- `serializeTable()`: Convert table back to markdown format
- `getColumnIndex()`: Resolve column by name or index
- `findRowIndex()`: Resolve row by index or search criteria

## Key Features

1. **Flexible Table Identification**: Tables can be identified by:
   - Zero-based index (0, 1, 2, ...)
   - Section ID containing the table

2. **Flexible Row Identification**: Rows can be identified by:
   - Zero-based index
   - Search criteria: `{column: "Name", value: "Alice"}`

3. **Flexible Column Identification**: Columns can be identified by:
   - Zero-based index
   - Column header name

4. **Automatic Column Normalization**: When adding rows, the function automatically:
   - Pads with empty strings if too few cells provided
   - Truncates if too many cells provided

5. **Edge Case Handling**: All functions return count=0 when:
   - Table not found
   - Row/column not found
   - Invalid identifiers

6. **Table Serialization**: Modified tables are properly serialized back to GFM format with:
   - Proper alignment markers
   - Consistent spacing
   - Valid markdown structure

## Usage Examples

### Replace Table Cell
```yaml
patches:
  - op: replace-table-cell
    table: 0                    # First table in document
    row: 0                      # First data row
    column: "Age"               # Column named "Age"
    content: "31"
```

### Add Table Row
```yaml
patches:
  - op: add-table-row
    table: 0
    values: ["David", "35", "Boston"]
    position: -1                # Append to end (default)
```

### Remove Table Row
```yaml
patches:
  - op: remove-table-row
    table: 0
    row:
      column: "Name"
      value: "Bob"              # Find row where Name=Bob
```

### Add Table Column
```yaml
patches:
  - op: add-table-column
    table: 0
    header: "Email"
    defaultValue: "N/A"
    position: -1                # Append to end
```

### Remove Table Column
```yaml
patches:
  - op: remove-table-column
    table: 0
    column: 2                   # Third column (0-based)
```

## Testing Recommendations

1. Test with tables at different positions in the document
2. Test with tables in different sections
3. Test row/column lookup by name and index
4. Test edge cases (empty tables, missing tables, invalid indices)
5. Test with tables that have different alignments
6. Test serialization maintains proper GFM format

## Implementation Complete

All requested functionality has been implemented:
- ✅ 5 new table operation functions
- ✅ Integration with table parser module
- ✅ Return {content: string, count: number}
- ✅ Edge case handling
- ✅ Following existing patch operation patterns
- ✅ Switch statement updates in applySinglePatch()
- ✅ getPatchDescription() updates
- ✅ Table parser imports
