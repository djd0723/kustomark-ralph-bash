/**
 * LSP Diagnostics Provider for Kustomark
 *
 * Provides real-time validation and error reporting for kustomark.yaml files
 */

import * as yaml from "js-yaml";
import { type Diagnostic, DiagnosticSeverity, type Range } from "vscode-languageserver";
import { parseConfig, validateConfig } from "../core/config-parser.js";
import type { ValidationError, ValidationWarning } from "../core/types.js";

/**
 * Provider for LSP diagnostics in kustomark configuration files
 */
export class DiagnosticsProvider {
  /**
   * Provides diagnostics for a kustomark configuration file
   *
   * @param uri - The URI of the document (unused, reserved for future features)
   * @param content - The document content as a string
   * @returns Array of LSP Diagnostic objects
   */
  provideDiagnostics(_uri: string, content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    try {
      // First, try to parse the YAML content
      const config = parseConfig(content);

      // Then validate the parsed configuration
      const validationResult = validateConfig(config);

      // Convert validation errors to diagnostics
      for (const error of validationResult.errors) {
        diagnostics.push(this.createDiagnostic(error, content, DiagnosticSeverity.Error));
      }

      // Convert validation warnings to diagnostics
      for (const warning of validationResult.warnings) {
        diagnostics.push(this.createDiagnostic(warning, content, DiagnosticSeverity.Warning));
      }
    } catch (error) {
      // Handle YAML parsing errors
      if (error instanceof yaml.YAMLException) {
        diagnostics.push(this.createYamlErrorDiagnostic(error));
      } else if (error instanceof Error) {
        // Handle other errors (e.g., "Config must be a YAML object")
        diagnostics.push(this.createGenericErrorDiagnostic(error.message));
      } else {
        // Handle unknown errors
        diagnostics.push(this.createGenericErrorDiagnostic("Unknown error occurred"));
      }
    }

    return diagnostics;
  }

  /**
   * Creates a diagnostic from a validation error or warning
   *
   * @param issue - The validation error or warning
   * @param content - The document content for position mapping
   * @param severity - The diagnostic severity level
   * @returns LSP Diagnostic object
   */
  private createDiagnostic(
    issue: ValidationError | ValidationWarning,
    content: string,
    severity: DiagnosticSeverity,
  ): Diagnostic {
    const range = this.getFieldRange(issue.field, content);

    return {
      severity,
      range,
      message: issue.message,
      source: "kustomark",
    };
  }

  /**
   * Creates a diagnostic from a YAML parsing error
   *
   * @param error - The YAML exception
   * @returns LSP Diagnostic object
   */
  private createYamlErrorDiagnostic(error: yaml.YAMLException): Diagnostic {
    // Extract line and column from the error mark if available
    let line = 0;
    let column = 0;

    if (error.mark) {
      line = error.mark.line;
      column = error.mark.column;
    }

    const range: Range = {
      start: { line, character: column },
      end: { line, character: column + 1 },
    };

    return {
      severity: DiagnosticSeverity.Error,
      range,
      message: `YAML parsing error: ${error.message}`,
      source: "kustomark",
    };
  }

  /**
   * Creates a generic error diagnostic when specific position is unknown
   *
   * @param message - The error message
   * @returns LSP Diagnostic object
   */
  private createGenericErrorDiagnostic(message: string): Diagnostic {
    const range: Range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    };

    return {
      severity: DiagnosticSeverity.Error,
      range,
      message,
      source: "kustommark",
    };
  }

  /**
   * Attempts to find the range of a field in the YAML content
   *
   * Uses simple heuristics to locate the field:
   * - For top-level fields (e.g., "apiVersion"), finds the line with that key
   * - For array indices (e.g., "resources[0]"), finds the array and estimates position
   * - For nested fields (e.g., "patches[0].op"), navigates the path
   *
   * @param field - The field path (e.g., "resources[0]", "patches[1].op")
   * @param content - The document content
   * @returns Range for the field, defaults to line 0 if not found
   */
  private getFieldRange(field: string | undefined, content: string): Range {
    if (!field) {
      // No field specified, default to start of document
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      };
    }

    const lines = content.split("\n");

    // Parse the field path to extract components
    // Examples: "apiVersion", "resources", "resources[0]", "patches[1].op"
    const pathMatch = field.match(/^([^.[]+)(?:\[(\d+)\])?(?:\.(.+))?$/);

    if (!pathMatch) {
      // Can't parse the field path, default to line 0
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      };
    }

    const [, rootField = "", arrayIndex, subField] = pathMatch;

    // Find the root field in the content
    const rootLineIndex = this.findFieldLine(lines, rootField);

    if (rootLineIndex === -1) {
      // Field not found, default to line 0
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      };
    }

    // If this is just a simple field (no array index or subfield)
    if (!arrayIndex && !subField) {
      return this.createFieldRange(lines, rootLineIndex);
    }

    // If there's an array index, try to find the specific array item
    if (arrayIndex) {
      const itemLineIndex = this.findArrayItemLine(
        lines,
        rootLineIndex,
        Number.parseInt(arrayIndex, 10),
      );

      if (itemLineIndex === -1) {
        // Couldn't find the specific item, use the array field line
        return this.createFieldRange(lines, rootLineIndex);
      }

      // If there's also a subfield, try to find it within the array item
      if (subField) {
        const subFieldLineIndex = this.findFieldLine(lines, subField, itemLineIndex);

        if (subFieldLineIndex !== -1) {
          return this.createFieldRange(lines, subFieldLineIndex);
        }
      }

      // Return the array item line
      return this.createFieldRange(lines, itemLineIndex);
    }

    // If there's a subfield but no array index
    if (subField) {
      const subFieldLineIndex = this.findFieldLine(lines, subField, rootLineIndex);

      if (subFieldLineIndex !== -1) {
        return this.createFieldRange(lines, subFieldLineIndex);
      }
    }

    // Default to the root field line
    return this.createFieldRange(lines, rootLineIndex);
  }

  /**
   * Finds the line number where a field is defined
   *
   * @param lines - Array of content lines
   * @param fieldName - The field name to search for
   * @param startLine - Optional line to start searching from (default: 0)
   * @returns Line index where the field is found, or -1 if not found
   */
  private findFieldLine(lines: string[], fieldName: string, startLine = 0): number {
    const fieldPattern = new RegExp(`^\\s*${this.escapeRegex(fieldName)}\\s*:`);

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (line && fieldPattern.test(line)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Finds the line number for a specific item in an array
   *
   * @param lines - Array of content lines
   * @param arrayLineIndex - Line index where the array field is defined
   * @param itemIndex - Index of the item to find (0-based)
   * @returns Line index where the array item is found, or -1 if not found
   */
  private findArrayItemLine(lines: string[], arrayLineIndex: number, itemIndex: number): number {
    // Get the indentation of the array field
    const arrayLine = lines[arrayLineIndex];
    if (!arrayLine) {
      return -1;
    }

    const arrayIndent = arrayLine.match(/^\s*/)?.[0].length ?? 0;

    // Look for array items (lines starting with "-" at correct indentation)
    let currentIndex = 0;

    for (let i = arrayLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      const lineIndent = line.match(/^\s*/)?.[0].length ?? 0;

      // If we've moved to a different section (same or less indentation), stop
      if (lineIndent <= arrayIndent && line.trim() !== "") {
        break;
      }

      // Check if this is an array item (starts with "-")
      if (line.trim().startsWith("-")) {
        if (currentIndex === itemIndex) {
          return i;
        }
        currentIndex++;
      }
    }

    return -1;
  }

  /**
   * Creates a range for a field based on its line
   *
   * @param lines - Array of content lines
   * @param lineIndex - Line index where the field is located
   * @returns Range spanning the field
   */
  private createFieldRange(lines: string[], lineIndex: number): Range {
    const line = lines[lineIndex];
    if (!line) {
      return {
        start: { line: lineIndex, character: 0 },
        end: { line: lineIndex, character: 1 },
      };
    }

    const trimmedStart = line.length - line.trimStart().length;
    const trimmedEnd = line.trimEnd().length;

    return {
      start: { line: lineIndex, character: trimmedStart },
      end: { line: lineIndex, character: Math.max(trimmedEnd, trimmedStart + 1) },
    };
  }

  /**
   * Escapes special regex characters in a string
   *
   * @param str - String to escape
   * @returns Escaped string safe for use in regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
