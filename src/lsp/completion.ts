/**
 * Completion provider for Kustomark YAML files
 *
 * Provides intelligent autocomplete suggestions for:
 * - Root-level fields (apiVersion, kind, output, resources, patches, validators)
 * - Patch operation types (all 22 operations)
 * - Common patch fields (include, exclude, onNoMatch, group, id, extends, validate)
 * - Enum values (onNoMatch: skip/warn/error)
 */

import {
  type CompletionItem,
  CompletionItemKind,
  type Position,
  type TextDocument,
} from "vscode-languageserver";

/**
 * Context where the cursor is positioned
 */
type CompletionContext =
  | "root" // Root level of the document
  | "patches-array" // Inside the patches array
  | "patch-object" // Inside a patch object
  | "patch-op" // Completing the op field value
  | "patch-onNoMatch" // Completing onNoMatch value
  | "root-onNoMatch" // Completing root-level onNoMatch value
  | "unknown"; // Cannot determine context

/**
 * Provides completion suggestions for Kustomark YAML files
 */
export class CompletionProvider {
  /**
   * Provide completion items at the given position
   */
  provideCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const lines = text.split("\n");
    const currentLine = lines[position.line] || "";
    const linePrefix = currentLine.substring(0, position.character);

    // Detect context
    const context = this.detectContext(text, offset, lines, position.line);

    // Provide completions based on context
    switch (context) {
      case "root":
        return this.getRootCompletions(linePrefix);
      case "patch-op":
        return this.getPatchOperationCompletions();
      case "patch-onNoMatch":
      case "root-onNoMatch":
        return this.getOnNoMatchCompletions();
      case "patch-object":
        return this.getPatchFieldCompletions(linePrefix, text, offset);
      case "patches-array":
        return this.getPatchesArrayCompletions(linePrefix);
      default:
        return [];
    }
  }

  /**
   * Resolve additional information for a completion item
   * For MVP, we return the item unchanged as basic info is already provided
   */
  resolveCompletion(item: CompletionItem): CompletionItem {
    return item;
  }

  /**
   * Detect the context at the current cursor position
   */
  private detectContext(
    _text: string,
    _offset: number,
    lines: string[],
    lineNumber: number,
  ): CompletionContext {
    const currentLine = lines[lineNumber] || "";
    const trimmedLine = currentLine.trim();

    // Check if we're completing a value for onNoMatch
    if (/^\s*onNoMatch:\s*$/.test(currentLine) || /^\s*onNoMatch:\s+\w*$/.test(currentLine)) {
      // Determine if this is root or patch level
      const isInPatches = this.isInsidePatches(lines, lineNumber);
      return isInPatches ? "patch-onNoMatch" : "root-onNoMatch";
    }

    // Check if we're completing the op field value
    if (/^\s*op:\s*$/.test(currentLine) || /^\s*op:\s+[\w-]*$/.test(currentLine)) {
      return "patch-op";
    }

    // Check if we're inside patches array
    const isInPatches = this.isInsidePatches(lines, lineNumber);

    if (isInPatches) {
      // Check if we're at the start of a new patch item
      if (trimmedLine.startsWith("-") || /^\s*$/.test(trimmedLine)) {
        return "patches-array";
      }
      // Otherwise we're inside a patch object
      return "patch-object";
    }

    // Root level
    return "root";
  }

  /**
   * Check if the current line is inside the patches array
   */
  private isInsidePatches(lines: string[], currentLineNumber: number): boolean {
    let inPatches = false;
    let patchesIndent = -1;

    for (let i = 0; i <= currentLineNumber; i++) {
      const line = lines[i] || "";
      const trimmed = line.trim();

      if (trimmed.startsWith("patches:")) {
        inPatches = true;
        patchesIndent = line.search(/\S/);
        continue;
      }

      // If we find a root-level key after patches, we're out of patches
      if (inPatches && patchesIndent >= 0) {
        const currentIndent = line.search(/\S/);
        if (currentIndent >= 0 && currentIndent <= patchesIndent && trimmed !== "") {
          // Check if it's a root-level key
          if (/^(apiVersion|kind|output|resources|validators|onNoMatch):/.test(trimmed)) {
            inPatches = false;
          }
        }
      }
    }

    return inPatches;
  }

  /**
   * Get completions for root-level fields
   */
  private getRootCompletions(linePrefix: string): CompletionItem[] {
    // Don't suggest if we're already in the middle of a key
    if (/^\s*\w+$/.test(linePrefix) && !linePrefix.trim().endsWith(":")) {
      return [];
    }

    return [
      {
        label: "apiVersion",
        kind: CompletionItemKind.Field,
        detail: "API version (required)",
        documentation: 'Must be "kustomark/v1"',
        insertText: 'apiVersion: "kustomark/v1"',
      },
      {
        label: "kind",
        kind: CompletionItemKind.Field,
        detail: "Resource kind (required)",
        documentation: 'Must be "Kustomization"',
        insertText: 'kind: "Kustomization"',
      },
      {
        label: "output",
        kind: CompletionItemKind.Field,
        detail: "Output directory",
        documentation: "Directory where processed files will be written",
        insertText: "output: ",
      },
      {
        label: "resources",
        kind: CompletionItemKind.Field,
        detail: "Resource patterns (required)",
        documentation: "List of file patterns, paths, or kustomark configs to process",
        insertText: "resources:\n  - ",
      },
      {
        label: "patches",
        kind: CompletionItemKind.Field,
        detail: "Patch operations",
        documentation: "Ordered list of patches to apply to resources",
        insertText: "patches:\n  - op: ",
      },
      {
        label: "validators",
        kind: CompletionItemKind.Field,
        detail: "Global validators",
        documentation: "Validation rules to run on all resources",
        insertText: "validators:\n  - name: ",
      },
      {
        label: "onNoMatch",
        kind: CompletionItemKind.Field,
        detail: "Default strategy for patches that don't match",
        documentation: "Options: skip, warn, error",
        insertText: "onNoMatch: ",
      },
    ];
  }

  /**
   * Get completions for patch operation types
   */
  private getPatchOperationCompletions(): CompletionItem[] {
    return [
      {
        label: "replace",
        kind: CompletionItemKind.Value,
        detail: "Simple string replacement",
        documentation: "Replace old string with new string",
        insertText: "replace",
      },
      {
        label: "replace-regex",
        kind: CompletionItemKind.Value,
        detail: "Regex-based replacement",
        documentation: "Replace text using regular expressions",
        insertText: "replace-regex",
      },
      {
        label: "remove-section",
        kind: CompletionItemKind.Value,
        detail: "Remove markdown section",
        documentation: "Remove a section by ID (with optional children)",
        insertText: "remove-section",
      },
      {
        label: "replace-section",
        kind: CompletionItemKind.Value,
        detail: "Replace section content",
        documentation: "Replace entire section content by ID",
        insertText: "replace-section",
      },
      {
        label: "prepend-to-section",
        kind: CompletionItemKind.Value,
        detail: "Prepend to section",
        documentation: "Add content to the beginning of a section",
        insertText: "prepend-to-section",
      },
      {
        label: "append-to-section",
        kind: CompletionItemKind.Value,
        detail: "Append to section",
        documentation: "Add content to the end of a section",
        insertText: "append-to-section",
      },
      {
        label: "set-frontmatter",
        kind: CompletionItemKind.Value,
        detail: "Set frontmatter field",
        documentation: "Set or update a frontmatter field value",
        insertText: "set-frontmatter",
      },
      {
        label: "remove-frontmatter",
        kind: CompletionItemKind.Value,
        detail: "Remove frontmatter field",
        documentation: "Remove a field from frontmatter",
        insertText: "remove-frontmatter",
      },
      {
        label: "rename-frontmatter",
        kind: CompletionItemKind.Value,
        detail: "Rename frontmatter field",
        documentation: "Rename a frontmatter field key",
        insertText: "rename-frontmatter",
      },
      {
        label: "merge-frontmatter",
        kind: CompletionItemKind.Value,
        detail: "Merge frontmatter values",
        documentation: "Merge multiple key-value pairs into frontmatter",
        insertText: "merge-frontmatter",
      },
      {
        label: "delete-between",
        kind: CompletionItemKind.Value,
        detail: "Delete between markers",
        documentation: "Delete content between start and end markers",
        insertText: "delete-between",
      },
      {
        label: "replace-between",
        kind: CompletionItemKind.Value,
        detail: "Replace between markers",
        documentation: "Replace content between start and end markers",
        insertText: "replace-between",
      },
      {
        label: "replace-line",
        kind: CompletionItemKind.Value,
        detail: "Replace entire line",
        documentation: "Replace entire lines that match exactly",
        insertText: "replace-line",
      },
      {
        label: "insert-after-line",
        kind: CompletionItemKind.Value,
        detail: "Insert after line",
        documentation: "Insert content after a matching line",
        insertText: "insert-after-line",
      },
      {
        label: "insert-before-line",
        kind: CompletionItemKind.Value,
        detail: "Insert before line",
        documentation: "Insert content before a matching line",
        insertText: "insert-before-line",
      },
      {
        label: "move-section",
        kind: CompletionItemKind.Value,
        detail: "Move section",
        documentation: "Move a section to after another section",
        insertText: "move-section",
      },
      {
        label: "rename-header",
        kind: CompletionItemKind.Value,
        detail: "Rename section header",
        documentation: "Rename a section header while preserving level",
        insertText: "rename-header",
      },
      {
        label: "change-section-level",
        kind: CompletionItemKind.Value,
        detail: "Change section level",
        documentation: "Change the heading level of a section (promote/demote)",
        insertText: "change-section-level",
      },
      {
        label: "copy-file",
        kind: CompletionItemKind.Value,
        detail: "Copy a file from source to destination",
        documentation: "Copy a file from source to destination",
        insertText: "copy-file",
      },
      {
        label: "rename-file",
        kind: CompletionItemKind.Value,
        detail: "Rename files matching a pattern",
        documentation: "Rename files matching a pattern",
        insertText: "rename-file",
      },
      {
        label: "delete-file",
        kind: CompletionItemKind.Value,
        detail: "Delete files matching a pattern",
        documentation: "Delete files matching a pattern",
        insertText: "delete-file",
      },
      {
        label: "move-file",
        kind: CompletionItemKind.Value,
        detail: "Move files to a destination directory",
        documentation: "Move files to a destination directory",
        insertText: "move-file",
      },
    ];
  }

  /**
   * Get completions for onNoMatch values
   */
  private getOnNoMatchCompletions(): CompletionItem[] {
    return [
      {
        label: "skip",
        kind: CompletionItemKind.Value,
        detail: "Skip silently",
        documentation: "Skip patches that don't match without any notification",
        insertText: "skip",
      },
      {
        label: "warn",
        kind: CompletionItemKind.Value,
        detail: "Warn on no match",
        documentation: "Show a warning when patches don't match",
        insertText: "warn",
      },
      {
        label: "error",
        kind: CompletionItemKind.Value,
        detail: "Error on no match",
        documentation: "Fail the build when patches don't match",
        insertText: "error",
      },
    ];
  }

  /**
   * Get completions for fields inside a patch object
   */
  private getPatchFieldCompletions(
    linePrefix: string,
    _text: string,
    _offset: number,
  ): CompletionItem[] {
    // Don't suggest if we're already in the middle of a key
    if (/^\s*\w+$/.test(linePrefix) && !linePrefix.trim().endsWith(":")) {
      return [];
    }

    return [
      {
        label: "op",
        kind: CompletionItemKind.Field,
        detail: "Operation type (required)",
        documentation: "The type of patch operation to perform",
        insertText: "op: ",
      },
      {
        label: "id",
        kind: CompletionItemKind.Field,
        detail: "Unique identifier",
        documentation: "Unique ID for this patch (used for inheritance with extends)",
        insertText: "id: ",
      },
      {
        label: "extends",
        kind: CompletionItemKind.Field,
        detail: "Inherit from patch(es)",
        documentation: "Patch ID(s) to extend from (single ID or array of IDs)",
        insertText: "extends: ",
      },
      {
        label: "include",
        kind: CompletionItemKind.Field,
        detail: "Include patterns",
        documentation: "Glob pattern(s) to include specific files",
        insertText: "include: ",
      },
      {
        label: "exclude",
        kind: CompletionItemKind.Field,
        detail: "Exclude patterns",
        documentation: "Glob pattern(s) to exclude specific files",
        insertText: "exclude: ",
      },
      {
        label: "onNoMatch",
        kind: CompletionItemKind.Field,
        detail: "No match strategy",
        documentation: "Override default behavior when patch doesn't match (skip, warn, error)",
        insertText: "onNoMatch: ",
      },
      {
        label: "group",
        kind: CompletionItemKind.Field,
        detail: "Patch group name",
        documentation: "Optional group name for selective patch application",
        insertText: "group: ",
      },
      {
        label: "validate",
        kind: CompletionItemKind.Field,
        detail: "Validation rules",
        documentation: "Per-patch validation configuration",
        insertText: "validate:\n  notContains: ",
      },
    ];
  }

  /**
   * Get completions when inside the patches array
   */
  private getPatchesArrayCompletions(linePrefix: string): CompletionItem[] {
    // If line starts with -, suggest op field
    if (linePrefix.trim().startsWith("-")) {
      return [
        {
          label: "- op",
          kind: CompletionItemKind.Snippet,
          detail: "New patch operation",
          documentation: "Start a new patch operation",
          insertText: "- op: ",
        },
      ];
    }

    return [];
  }
}
