/**
 * Document Symbols Provider for LSP
 *
 * Provides outline/structure view for kustomark.yaml files in IDEs
 * Shows hierarchy of config fields, patches, validators, etc.
 */

import type { DocumentSymbol, Range } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { parseConfig } from "../core/config-parser.js";

/**
 * Symbol kinds for different YAML elements
 * Using numeric values from LSP SymbolKind enum
 */
const SymbolKindValue = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Package: 4,
  Class: 5,
  Method: 6,
  Property: 7,
  Field: 8,
  Constructor: 9,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Variable: 13,
  Constant: 14,
  String: 15,
  Number: 16,
  Boolean: 17,
  Array: 18,
  Object: 19,
  Key: 20,
  Null: 21,
  EnumMember: 22,
  Struct: 23,
  Event: 24,
  Operator: 25,
  TypeParameter: 26,
} as const;

/**
 * Document Symbols Provider
 * Analyzes kustomark.yaml files and provides structural information
 */
export class DocumentSymbolsProvider {
  /**
   * Provide document symbols for a kustomark.yaml file
   * Returns a hierarchical tree of symbols representing the config structure
   *
   * @param document - The text document to analyze
   * @returns Array of DocumentSymbol representing the structure
   */
  provideDocumentSymbols(document: TextDocument): DocumentSymbol[] {
    const content = document.getText();
    const lines = content.split("\n");

    try {
      // Try to parse the config to get structured data
      const config = parseConfig(content);

      // Build symbols from parsed config
      return this.buildSymbolsFromConfig(config, lines);
    } catch (_error) {
      // Fall back to basic structure parsing on any error
      return this.parseBasicYamlStructure(lines);
    }
  }

  /**
   * Build symbols from a successfully parsed config
   */
  private buildSymbolsFromConfig(config: unknown, lines: string[]): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    const configObj = config as Record<string, unknown>;

    // Add apiVersion
    if (configObj.apiVersion) {
      const range = this.findFieldRange("apiVersion", lines);
      if (range) {
        symbols.push({
          name: `apiVersion: ${configObj.apiVersion}`,
          kind: SymbolKindValue.Property,
          range,
          selectionRange: range,
        });
      }
    }

    // Add kind
    if (configObj.kind) {
      const range = this.findFieldRange("kind", lines);
      if (range) {
        symbols.push({
          name: `kind: ${configObj.kind}`,
          kind: SymbolKindValue.Property,
          range,
          selectionRange: range,
        });
      }
    }

    // Add output
    if (configObj.output) {
      const range = this.findFieldRange("output", lines);
      if (range) {
        symbols.push({
          name: `output: ${configObj.output}`,
          kind: SymbolKindValue.Property,
          range,
          selectionRange: range,
        });
      }
    }

    // Add resources (as array)
    if (Array.isArray(configObj.resources)) {
      const resourcesRange = this.findFieldRange("resources", lines);
      if (resourcesRange) {
        const resourceSymbols: DocumentSymbol[] = [];

        for (let i = 0; i < configObj.resources.length; i++) {
          const resource = configObj.resources[i];
          const itemRange = this.findArrayItemRange("resources", i, lines);
          if (itemRange) {
            resourceSymbols.push({
              name: String(resource),
              kind: SymbolKindValue.String,
              range: itemRange,
              selectionRange: itemRange,
            });
          }
        }

        symbols.push({
          name: `resources (${configObj.resources.length})`,
          kind: SymbolKindValue.Array,
          range: resourcesRange,
          selectionRange: resourcesRange,
          children: resourceSymbols,
        });
      }
    }

    // Add patches (as array with detailed children)
    if (Array.isArray(configObj.patches)) {
      const patchesRange = this.findFieldRange("patches", lines);
      if (patchesRange) {
        const patchSymbols: DocumentSymbol[] = [];

        for (let i = 0; i < configObj.patches.length; i++) {
          const patch = configObj.patches[i] as Record<string, unknown>;
          const patchRange = this.findArrayItemRange("patches", i, lines);

          if (patchRange) {
            // Create a descriptive name for the patch
            const op = patch.op || "unknown";
            const id = patch.id ? ` (${patch.id})` : "";
            const group = patch.group ? ` [${patch.group}]` : "";

            patchSymbols.push({
              name: `${op}${id}${group}`,
              kind: SymbolKindValue.Function,
              range: patchRange,
              selectionRange: patchRange,
              detail: this.getPatchDetail(patch),
            });
          }
        }

        symbols.push({
          name: `patches (${configObj.patches.length})`,
          kind: SymbolKindValue.Array,
          range: patchesRange,
          selectionRange: patchesRange,
          children: patchSymbols,
        });
      }
    }

    // Add validators
    if (Array.isArray(configObj.validators)) {
      const validatorsRange = this.findFieldRange("validators", lines);
      if (validatorsRange) {
        const validatorSymbols: DocumentSymbol[] = [];

        for (let i = 0; i < configObj.validators.length; i++) {
          const validator = configObj.validators[i] as Record<string, unknown>;
          const itemRange = this.findArrayItemRange("validators", i, lines);

          if (itemRange) {
            const type = validator.type || "unknown";
            validatorSymbols.push({
              name: String(type),
              kind: SymbolKindValue.Constructor,
              range: itemRange,
              selectionRange: itemRange,
            });
          }
        }

        symbols.push({
          name: `validators (${configObj.validators.length})`,
          kind: SymbolKindValue.Array,
          range: validatorsRange,
          selectionRange: validatorsRange,
          children: validatorSymbols,
        });
      }
    }

    return symbols;
  }

  /**
   * Get a detail string for a patch (shows key info)
   */
  private getPatchDetail(patch: Record<string, unknown>): string {
    const parts: string[] = [];

    // Add include/exclude info
    if (Array.isArray(patch.include) && patch.include.length > 0) {
      parts.push(`include: ${patch.include.join(", ")}`);
    }
    if (Array.isArray(patch.exclude) && patch.exclude.length > 0) {
      parts.push(`exclude: ${patch.exclude.join(", ")}`);
    }

    // Add operation-specific details
    const op = patch.op as string;
    switch (op) {
      case "replace":
      case "replace-regex":
        if (patch.old) {
          parts.push(
            `"${String(patch.old).substring(0, 30)}${String(patch.old).length > 30 ? "..." : ""}"`,
          );
        }
        break;
      case "remove-section":
      case "replace-section":
      case "prepend-to-section":
      case "append-to-section":
      case "rename-header":
      case "move-section":
      case "change-section-level":
        if (patch.id) {
          parts.push(`#${patch.id}`);
        }
        break;
      case "set-frontmatter":
      case "remove-frontmatter":
      case "rename-frontmatter":
        if (patch.key) {
          parts.push(`key: ${patch.key}`);
        }
        break;
    }

    return parts.join(" • ");
  }

  /**
   * Parse basic YAML structure when config parsing fails
   * Provides a fallback outline based on indentation
   */
  private parseBasicYamlStructure(lines: string[]): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    const stack: { symbol: DocumentSymbol; indent: number }[] = [];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      if (!line || !line.trim() || line.trim().startsWith("#")) {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      const trimmed = line.trim();

      // Match field: value or - item
      const fieldMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)?$/);
      const arrayMatch = trimmed.match(/^-\s+(.*)$/);

      if (fieldMatch) {
        const fieldName = fieldMatch[1] || "";
        const value = fieldMatch[2];

        const range: Range = {
          start: { line: lineNum, character: 0 },
          end: { line: lineNum, character: line.length },
        };

        const symbol: DocumentSymbol = {
          name: value !== undefined ? `${fieldName}: ${value}` : fieldName,
          kind: SymbolKindValue.Property,
          range,
          selectionRange: range,
          children: [],
        };

        // Pop stack until we find the parent at a lower indent
        while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= indent) {
          stack.pop();
        }

        // Add to parent or root
        if (stack.length > 0) {
          const parent = stack[stack.length - 1]?.symbol;
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(symbol);
          }
        } else {
          symbols.push(symbol);
        }

        // Push to stack if it might have children (no value means it's a parent)
        if (!value) {
          stack.push({ symbol, indent });
        }
      } else if (arrayMatch) {
        const value = arrayMatch[1];

        const range: Range = {
          start: { line: lineNum, character: 0 },
          end: { line: lineNum, character: line.length },
        };

        const symbol: DocumentSymbol = {
          name: value || "item",
          kind: SymbolKindValue.Object,
          range,
          selectionRange: range,
          children: [],
        };

        // Pop stack until we find the parent at a lower indent
        while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= indent) {
          stack.pop();
        }

        // Add to parent
        if (stack.length > 0) {
          const parent = stack[stack.length - 1]?.symbol;
          if (parent) {
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(symbol);
          }
        }

        // Array items might have children
        stack.push({ symbol, indent });
      }
    }

    return symbols;
  }

  /**
   * Find the line range for a top-level field
   */
  private findFieldRange(fieldName: string, lines: string[]): Range | null {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line?.match(new RegExp(`^${fieldName}:`))) {
        // Find the end of this field (next field at same level or EOF)
        let endLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (nextLine?.match(/^[a-zA-Z_]/)) {
            // Found next top-level field
            endLine = j - 1;
            break;
          }
          endLine = j;
        }

        return {
          start: { line: i, character: 0 },
          end: { line: endLine, character: lines[endLine]?.length || 0 },
        };
      }
    }
    return null;
  }

  /**
   * Find the line range for an array item
   */
  private findArrayItemRange(fieldName: string, index: number, lines: string[]): Range | null {
    // Find the field first
    let fieldLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      if (currentLine?.match(new RegExp(`^${fieldName}:`))) {
        fieldLine = i;
        break;
      }
    }

    if (fieldLine === -1) {
      return null;
    }

    // Count array items (lines starting with "  -")
    let itemCount = 0;
    for (let i = fieldLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      // Stop if we hit another top-level field
      if (line.match(/^[a-zA-Z_]/)) {
        break;
      }

      // Check if this is an array item
      if (line.match(/^\s+-\s/)) {
        if (itemCount === index) {
          // Found our item, now find its end
          let endLine = i;
          const itemIndent = line.length - line.trimStart().length;

          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            if (!nextLine || !nextLine.trim()) {
              endLine = j;
              continue;
            }

            const nextIndent = nextLine.length - nextLine.trimStart().length;

            // Stop if we hit another item at same level or less
            if (nextIndent <= itemIndent && nextLine.match(/^\s+-\s/)) {
              endLine = j - 1;
              break;
            }

            // Stop if we hit a top-level field
            if (nextLine.match(/^[a-zA-Z_]/)) {
              endLine = j - 1;
              break;
            }

            endLine = j;
          }

          return {
            start: { line: i, character: 0 },
            end: { line: endLine, character: lines[endLine]?.length || 0 },
          };
        }
        itemCount++;
      }
    }

    return null;
  }
}
