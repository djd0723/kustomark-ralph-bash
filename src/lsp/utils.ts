/**
 * LSP utility functions for position mapping and field extraction
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import type { Position, Range } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Position map that tracks field paths to their locations in the document
 * Maps field paths (e.g., "apiVersion", "patches[0].op") to their line/column positions
 */
export interface PositionMap {
  /** Map of field path to its position in the document */
  fields: Map<string, Range>;
  /** Map of line numbers to field paths (for quick lookups) */
  lines: Map<number, string[]>;
}

/**
 * Builds a position map from YAML content
 * Tracks the location of each field in the document for hover, completion, and validation
 *
 * @param content - YAML content as string
 * @returns PositionMap with field locations
 */
export function buildPositionMap(content: string): PositionMap {
  const fields = new Map<string, Range>();
  const lines = new Map<number, string[]>();

  const contentLines = content.split("\n");

  // Track current path in the YAML structure
  const pathStack: string[] = [];
  const indentStack: number[] = [];

  for (let lineNum = 0; lineNum < contentLines.length; lineNum++) {
    const line = contentLines[lineNum];
    if (!line) {
      continue;
    }

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    // Calculate indentation
    const indent = line.length - line.trimStart().length;

    // Pop stack if we've dedented
    while (indentStack.length > 0) {
      const lastIndent = indentStack[indentStack.length - 1];
      if (lastIndent === undefined || indent >= lastIndent) {
        break;
      }
      indentStack.pop();
      pathStack.pop();
    }

    // Check if this is a key-value line
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):/);
    if (keyMatch && keyMatch[1] !== undefined && keyMatch[2] !== undefined) {
      const key = keyMatch[2];
      const keyStartChar = keyMatch[1].length;

      // Update path
      const lastIndent = indentStack.length > 0 ? indentStack[indentStack.length - 1] : undefined;
      if (indentStack.length === 0 || (lastIndent !== undefined && indent > lastIndent)) {
        // Same level or new nested level
        if (indentStack.length > 0 && lastIndent !== undefined && indent === lastIndent) {
          pathStack.pop();
        }
        pathStack.push(key);
        indentStack.push(indent);
      } else {
        // Same level
        pathStack.pop();
        pathStack.push(key);
      }

      const fieldPath = pathStack.join(".");
      const range: Range = {
        start: { line: lineNum, character: keyStartChar },
        end: { line: lineNum, character: keyStartChar + key.length },
      };

      fields.set(fieldPath, range);

      // Add to line map
      if (!lines.has(lineNum)) {
        lines.set(lineNum, []);
      }
      const lineFields = lines.get(lineNum);
      if (lineFields) {
        lineFields.push(fieldPath);
      }
    }

    // Check if this is an array item
    const arrayMatch = line.match(/^(\s*)- /);
    if (arrayMatch && arrayMatch[1] !== undefined && pathStack.length > 0) {
      // Get the current parent array name
      const parentPath = pathStack[pathStack.length - 1];
      if (!parentPath) {
        continue;
      }

      // Count how many array items we've seen at this level
      let arrayIndex = 0;
      for (let i = 0; i < lineNum; i++) {
        const prevLine = contentLines[i];
        if (!prevLine) {
          continue;
        }
        const prevIndent = prevLine.length - prevLine.trimStart().length;
        if (prevIndent === indent && prevLine.trim().startsWith("-")) {
          arrayIndex++;
        }
      }

      const itemPath = `${pathStack.slice(0, -1).join(".")}.${parentPath}[${arrayIndex}]`;
      const itemStartChar = arrayMatch[1].length;

      const range: Range = {
        start: { line: lineNum, character: itemStartChar },
        end: { line: lineNum, character: line.length },
      };

      fields.set(itemPath, range);

      // Add to line map
      if (!lines.has(lineNum)) {
        lines.set(lineNum, []);
      }
      const lineFields = lines.get(lineNum);
      if (lineFields) {
        lineFields.push(itemPath);
      }
    }
  }

  return { fields, lines };
}

/**
 * Gets the field path at a specific position in the document
 *
 * @param document - The text document
 * @param position - The position to query
 * @returns The field path at that position, or null if no field found
 */
export function getFieldAtPosition(document: TextDocument, position: Position): string | null {
  const content = document.getText();
  const posMap = buildPositionMap(content);

  // Check if any field's range contains this position
  for (const [fieldPath, range] of posMap.fields.entries()) {
    if (isPositionInRange(position, range)) {
      return fieldPath;
    }
  }

  // Check line-based lookup as fallback
  const fieldsOnLine = posMap.lines.get(position.line);
  if (fieldsOnLine && fieldsOnLine.length > 0) {
    // Return the first field on this line
    const firstField = fieldsOnLine[0];
    return firstField ?? null;
  }

  return null;
}

/**
 * Gets the value of a field at a specific position in the document
 *
 * @param document - The text document
 * @param position - The position to query
 * @returns The field value as a string, or null if no value found
 */
export function getFieldValue(document: TextDocument, position: Position): string | null {
  const content = document.getText();
  const lines = content.split("\n");

  if (position.line >= lines.length) {
    return null;
  }

  const line = lines[position.line];
  if (!line) {
    return null;
  }

  // Check if this line has a key-value pair
  const kvMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.+)$/);
  if (kvMatch && kvMatch[3] !== undefined) {
    return kvMatch[3].trim();
  }

  // Check if this is an array item
  const arrayMatch = line.match(/^(\s*)- (.+)$/);
  if (arrayMatch && arrayMatch[2] !== undefined) {
    return arrayMatch[2].trim();
  }

  // Check if this is a continuation line (multi-line value)
  if (position.line > 0) {
    const prevLine = lines[position.line - 1];
    if (prevLine?.match(/:\s*$/)) {
      // Previous line ends with ':', this might be a multi-line value
      return line.trim();
    }
  }

  return null;
}

/**
 * Converts a file system path to a URI
 *
 * @param filePath - File system path
 * @returns URI string
 */
export function pathToUri(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Converts a URI to a file system path
 *
 * @param uri - URI string
 * @returns File system path
 */
export function uriToPath(uri: string): string {
  return fileURLToPath(uri);
}

/**
 * Helper function to check if a position is within a range
 *
 * @param position - Position to check
 * @param range - Range to check against
 * @returns True if position is within range
 */
function isPositionInRange(position: Position, range: Range): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }

  if (position.line === range.start.line && position.character < range.start.character) {
    return false;
  }

  if (position.line === range.end.line && position.character > range.end.character) {
    return false;
  }

  return true;
}
