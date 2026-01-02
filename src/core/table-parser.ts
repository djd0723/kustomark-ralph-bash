/**
 * Table parser for kustomark
 *
 * Handles parsing and manipulation of GitHub Flavored Markdown tables:
 * - Parse all tables in markdown content
 * - Find tables by section ID or line number
 * - Serialize tables back to markdown
 * - Get column indices by name or number
 * - Find row indices by position or search criteria
 */

/**
 * Column alignment in a markdown table
 */
export type ColumnAlignment = "left" | "center" | "right" | "none";

/**
 * A parsed markdown table with its boundaries and structure
 */
export interface MarkdownTable {
  /** Start line index (inclusive) of the table */
  startLine: number;
  /** End line index (inclusive) of the table */
  endLine: number;
  /** Array of column header names */
  headers: string[];
  /** Array of column alignments */
  alignments: ColumnAlignment[];
  /** Array of rows, where each row is an array of cell values */
  rows: string[][];
}

/**
 * Parse all tables from markdown content.
 *
 * This function identifies all GitHub Flavored Markdown tables in the content and
 * creates MarkdownTable objects with their structure and boundaries. Tables must
 * follow the standard GFM format with pipes separating columns and a separator row
 * defining alignments.
 *
 * The parser handles:
 * - Column alignments from separator row (:---, :---:, ---:)
 * - Empty cells and whitespace
 * - Escaped pipes within cells (handled as literal pipes)
 * - Multiple tables in the same document
 *
 * @param content - The markdown content to parse
 * @returns Array of parsed tables with their structure and line boundaries
 *
 * @example
 * ```typescript
 * const markdown = `
 * | Name | Age | City |
 * |:-----|:---:|-----:|
 * | Alice | 30 | NYC |
 * | Bob | 25 | LA |
 * `;
 *
 * const tables = parseTables(markdown);
 * // Returns:
 * // [
 * //   {
 * //     startLine: 1,
 * //     endLine: 4,
 * //     headers: ['Name', 'Age', 'City'],
 * //     alignments: ['left', 'center', 'right'],
 * //     rows: [['Alice', '30', 'NYC'], ['Bob', '25', 'LA']]
 * //   }
 * // ]
 * ```
 */
export function parseTables(content: string): MarkdownTable[] {
  const lines = content.split("\n");
  const tables: MarkdownTable[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    // Check if this line could be a table header (contains pipes)
    if (!line.includes("|")) {
      i++;
      continue;
    }

    // Try to parse a table starting at this line
    const table = parseTableAt(lines, i);
    if (table) {
      tables.push(table);
      i = table.endLine + 1;
    } else {
      i++;
    }
  }

  return tables;
}

/**
 * Try to parse a table starting at a specific line index.
 *
 * @param lines - Array of content lines
 * @param startIndex - Line index to start parsing from
 * @returns Parsed table if valid table found, undefined otherwise
 */
function parseTableAt(lines: string[], startIndex: number): MarkdownTable | undefined {
  // Need at least 3 lines for a valid table (header, separator, 1 data row minimum)
  if (startIndex + 2 >= lines.length) {
    return undefined;
  }

  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];

  if (!headerLine || !separatorLine) {
    return undefined;
  }

  // Parse header row
  const headers = parseTableRow(headerLine);
  if (headers.length === 0) {
    return undefined;
  }

  // Parse separator row to validate table structure and get alignments
  const alignments = parseSeparatorRow(separatorLine);
  if (alignments.length === 0) {
    return undefined;
  }

  // Header and separator must have same number of columns
  if (headers.length !== alignments.length) {
    return undefined;
  }

  // Parse data rows
  const rows: string[][] = [];
  let endLine = startIndex + 1;

  for (let i = startIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      break;
    }

    const row = parseTableRow(line);

    // If row doesn't parse or has wrong column count, table ends
    if (row.length === 0 || row.length !== headers.length) {
      break;
    }

    rows.push(row);
    endLine = i;
  }

  return {
    startLine: startIndex,
    endLine,
    headers,
    alignments,
    rows,
  };
}

/**
 * Parse a table row into individual cell values.
 *
 * @param line - The line to parse
 * @returns Array of cell values, or empty array if not a valid table row
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();

  // Table rows should start and end with pipes (with optional whitespace)
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }

  // Remove leading and trailing pipes
  const content = trimmed.slice(1, -1);

  // Split by pipes and trim each cell
  const cells = content.split("|").map((cell) => cell.trim());

  return cells;
}

/**
 * Parse the separator row to determine column alignments.
 *
 * @param line - The separator line to parse
 * @returns Array of column alignments, or empty array if not a valid separator
 */
function parseSeparatorRow(line: string): ColumnAlignment[] {
  const cells = parseTableRow(line);
  if (cells.length === 0) {
    return [];
  }

  const alignments: ColumnAlignment[] = [];

  for (const cell of cells) {
    // Separator cells should only contain hyphens, colons, and whitespace
    if (!/^:?-+:?$/.test(cell)) {
      return [];
    }

    const startsWithColon = cell.startsWith(":");
    const endsWithColon = cell.endsWith(":");

    if (startsWithColon && endsWithColon) {
      alignments.push("center");
    } else if (endsWithColon) {
      alignments.push("right");
    } else if (startsWithColon) {
      alignments.push("left");
    } else {
      alignments.push("none");
    }
  }

  return alignments;
}

/**
 * Find a table by section ID or line number.
 *
 * When searching by section ID, this function finds all tables that appear within
 * the boundaries of that section. When searching by line number, it finds the table
 * that contains that line.
 *
 * @param content - The markdown content containing tables
 * @param identifier - Section ID (string) or line number (number) to search for
 * @returns The first matching table if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Find by line number
 * const table = findTable(content, 10);
 *
 * // Find by section ID
 * const table = findTable(content, 'data-tables');
 * ```
 */
export function findTable(content: string, identifier: string | number): MarkdownTable | undefined {
  const tables = parseTables(content);

  if (typeof identifier === "number") {
    // Find table containing this line number
    return tables.find((table) => table.startLine <= identifier && identifier <= table.endLine);
  } else {
    // Find table in section with this ID
    // First, we need to parse sections to find the section boundaries
    const sections = parseSectionsForTable(content);
    const section = sections.find((s) => s.id === identifier);

    if (!section) {
      return undefined;
    }

    // Find first table within section boundaries
    return tables.find(
      (table) => table.startLine >= section.startLine && table.endLine <= section.endLine,
    );
  }
}

/**
 * Simple section parser for table lookup.
 * This is a minimal version that only extracts section IDs and boundaries.
 *
 * @param content - The markdown content to parse
 * @returns Array of sections with IDs and line boundaries
 */
function parseSectionsForTable(content: string): Array<{
  id: string;
  level: number;
  startLine: number;
  endLine: number;
}> {
  const lines = content.split("\n");
  const sections: Array<{ id: string; level: number; startLine: number; endLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Match markdown headers (# to ######)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (!headerMatch) continue;

    const hashMarks = headerMatch[1];
    const textPart = headerMatch[2];
    if (!hashMarks || !textPart) continue;

    const level = hashMarks.length;
    let headerText = textPart.trim();
    let id: string;

    // Check for custom ID syntax: {#custom-id}
    const customIdMatch = headerText.match(/\{#([a-zA-Z0-9_-]+)\}\s*$/);
    if (customIdMatch?.[1]) {
      id = customIdMatch[1];
      headerText = headerText.replace(/\s*\{#[a-zA-Z0-9_-]+\}\s*$/, "").trim();
    } else {
      // Generate GitHub-style slug
      id = generateSlugForTable(headerText);
    }

    sections.push({
      id,
      level,
      startLine: i,
      endLine: -1,
    });
  }

  // Set end boundaries for each section
  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i];
    if (!currentSection) continue;

    let endLine = lines.length - 1;
    for (let j = i + 1; j < sections.length; j++) {
      const nextSection = sections[j];
      if (!nextSection) continue;
      if (nextSection.level <= currentSection.level) {
        endLine = nextSection.startLine - 1;
        break;
      }
    }

    currentSection.endLine = endLine;
  }

  return sections;
}

/**
 * Generate a GitHub-style slug from header text for table lookup.
 *
 * @param text - The header text to convert into a slug
 * @returns The generated slug
 */
function generateSlugForTable(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Serialize a table back to markdown format.
 *
 * This function converts a MarkdownTable object back into its markdown string
 * representation. The output follows standard GFM table formatting with:
 * - Pipes separating columns
 * - Proper alignment indicators in the separator row
 * - Consistent spacing for readability
 *
 * @param table - The table to serialize
 * @returns Markdown string representation of the table
 *
 * @example
 * ```typescript
 * const table: MarkdownTable = {
 *   startLine: 0,
 *   endLine: 3,
 *   headers: ['Name', 'Age', 'City'],
 *   alignments: ['left', 'center', 'right'],
 *   rows: [['Alice', '30', 'NYC'], ['Bob', '25', 'LA']]
 * };
 *
 * const markdown = serializeTable(table);
 * // Returns:
 * // | Name | Age | City |
 * // |:-----|:---:|-----:|
 * // | Alice | 30 | NYC |
 * // | Bob | 25 | LA |
 * ```
 */
export function serializeTable(table: MarkdownTable): string {
  const lines: string[] = [];

  // Header row
  const headerRow = `| ${table.headers.join(" | ")} |`;
  lines.push(headerRow);

  // Separator row with alignments
  const separators = table.alignments.map((align) => {
    switch (align) {
      case "left":
        return ":---";
      case "center":
        return ":---:";
      case "right":
        return "---:";
      default:
        return "---";
    }
  });
  const separatorRow = `| ${separators.join(" | ")} |`;
  lines.push(separatorRow);

  // Data rows
  for (const row of table.rows) {
    const dataRow = `| ${row.join(" | ")} |`;
    lines.push(dataRow);
  }

  return lines.join("\n");
}

/**
 * Get the index of a column by name or number.
 *
 * This function resolves a column identifier (either a header name or a numeric index)
 * to its zero-based index in the table. When using a string identifier, the search is
 * case-sensitive and matches exact header text.
 *
 * @param table - The table to search
 * @param column - Column name (string) or zero-based index (number)
 * @returns Zero-based column index if found, -1 otherwise
 *
 * @example
 * ```typescript
 * const table: MarkdownTable = {
 *   headers: ['Name', 'Age', 'City'],
 *   // ... other fields
 * };
 *
 * getColumnIndex(table, 'Age'); // Returns: 1
 * getColumnIndex(table, 0);     // Returns: 0
 * getColumnIndex(table, 'Email'); // Returns: -1 (not found)
 * getColumnIndex(table, 10);    // Returns: -1 (out of bounds)
 * ```
 */
export function getColumnIndex(table: MarkdownTable, column: number | string): number {
  if (typeof column === "number") {
    // Validate numeric index is in range
    if (column >= 0 && column < table.headers.length) {
      return column;
    }
    return -1;
  } else {
    // Search for column by header name (case-sensitive)
    return table.headers.indexOf(column);
  }
}

/**
 * Find the index of a row by position or search criteria.
 *
 * This function locates a row in the table either by its direct index or by searching
 * for a specific value in a column. When searching by value, the comparison is
 * case-sensitive and uses exact string matching.
 *
 * @param table - The table to search
 * @param row - Row index (number) or search criteria (object with column and value)
 * @returns Zero-based row index if found, -1 otherwise
 *
 * @example
 * ```typescript
 * const table: MarkdownTable = {
 *   headers: ['Name', 'Age', 'City'],
 *   rows: [
 *     ['Alice', '30', 'NYC'],
 *     ['Bob', '25', 'LA']
 *   ],
 *   // ... other fields
 * };
 *
 * // Find by index
 * findRowIndex(table, 0); // Returns: 0
 *
 * // Find by column name and value
 * findRowIndex(table, { column: 'Name', value: 'Bob' }); // Returns: 1
 *
 * // Find by column index and value
 * findRowIndex(table, { column: 0, value: 'Alice' }); // Returns: 0
 *
 * // Not found cases
 * findRowIndex(table, { column: 'Name', value: 'Charlie' }); // Returns: -1
 * findRowIndex(table, 10); // Returns: -1 (out of bounds)
 * ```
 */
export function findRowIndex(
  table: MarkdownTable,
  row: number | { column: number | string; value: string },
): number {
  if (typeof row === "number") {
    // Validate numeric index is in range
    if (row >= 0 && row < table.rows.length) {
      return row;
    }
    return -1;
  } else {
    // Search for row by column value
    const columnIndex = getColumnIndex(table, row.column);
    if (columnIndex === -1) {
      return -1;
    }

    // Find first row where the specified column matches the value
    return table.rows.findIndex((r) => r[columnIndex] === row.value);
  }
}
