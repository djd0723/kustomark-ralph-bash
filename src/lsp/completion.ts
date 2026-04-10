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
    const context = this.detectContext(text, offset, lines, position);

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
    position: Position,
  ): CompletionContext {
    const lineNumber = position.line;
    const currentLine = lines[lineNumber] || "";
    const trimmedLine = currentLine.trim();

    // Check if we're completing a value for onNoMatch
    if (/^\s*onNoMatch:\s*$/.test(currentLine) || /^\s*onNoMatch:\s+\w*$/.test(currentLine)) {
      // Determine if this is root or patch level
      const isInPatches = this.isInsidePatches(lines, lineNumber);
      return isInPatches ? "patch-onNoMatch" : "root-onNoMatch";
    }

    // Check if we're completing the op field value (including partial values)
    // This must come before the patches-array check because "- op: value" contains both
    // Match: optional dash, optional whitespace, then exactly "op:" (not part of another word)
    if (/^-?\s*op:\s*/.test(trimmedLine)) {
      return "patch-op";
    }

    // Special case: if current line is beyond document or empty, check previous line for op:
    if (currentLine === "" && lineNumber > 0) {
      const prevLine = lines[lineNumber - 1] || "";
      if (/^-?\s*op:\s*/.test(prevLine.trim())) {
        return "patch-op";
      }
    }

    // Check if we're inside resources array
    if (this.isInsideResources(lines, lineNumber)) {
      return "unknown";
    }

    // Check if we're inside patches array
    const isInPatches = this.isInsidePatches(lines, lineNumber);

    if (isInPatches) {
      // Check if we're at the start of a new patch item (line starts with -)
      // But NOT if it also contains op: (handled above)
      if (trimmedLine.startsWith("-") && !trimmedLine.includes("op:")) {
        return "patches-array";
      }

      // Get indentation context
      const patchItemIndent = this.getPatchItemIndent(lines, lineNumber);

      // If we can't find a patch item, assume we're at array level
      if (patchItemIndent === -1) {
        return "patches-array";
      }

      // For blank lines, use the cursor position (character) as the indentation hint
      // This handles both existing blank lines and new lines being typed
      if (/^\s*$/.test(trimmedLine)) {
        // For blank lines, the character position indicates where the user is typing
        // which tells us the intended indentation level
        const lineIndent = position.character;

        // If indentation is greater than patch item indent, we're inside the object
        if (lineIndent > patchItemIndent) {
          return "patch-object";
        }
        // Otherwise we're at the array level
        return "patches-array";
      }

      // For non-blank lines, check actual indentation
      const currentIndent = currentLine.search(/\S/);
      if (currentIndent > patchItemIndent) {
        return "patch-object";
      }

      // Otherwise we're at the array level
      return "patches-array";
    }

    // Root level
    return "root";
  }

  /**
   * Get the indentation level of the most recent patch item (line starting with "- ")
   * Returns -1 if no patch item is found before the current line
   */
  private getPatchItemIndent(lines: string[], currentLineNumber: number): number {
    // Search backwards from current line to find the most recent patch item
    for (let i = currentLineNumber; i >= 0; i--) {
      const line = lines[i] || "";
      const trimmed = line.trim();

      // Check if this line starts a patch item
      if (trimmed.startsWith("-")) {
        // Return the indentation level (position of the dash)
        return line.search(/\S/);
      }

      // Stop searching if we encounter the patches: key
      if (trimmed.startsWith("patches:")) {
        break;
      }

      // Stop if we encounter another root-level key
      const indent = line.search(/\S/);
      if (indent === 0 && trimmed !== "") {
        break;
      }
    }

    return -1;
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
          // Check if it's a root-level key (including output which was missing)
          if (/^(apiVersion|kind|output|resources|validators|onNoMatch):/.test(trimmed)) {
            inPatches = false;
          }
        }
      }
    }

    // Special case: if we're on an empty line, check if we're exiting patches
    const currentLine = lines[currentLineNumber];

    // Case 1: Current line is completely empty (length 0) - might be exiting patches
    if (
      inPatches &&
      currentLine !== undefined &&
      currentLine.length === 0 &&
      currentLineNumber > 0
    ) {
      // Completely empty line - check if previous content was patch content
      for (let i = currentLineNumber - 1; i >= 0; i--) {
        const prevLine = lines[i] || "";
        const prevTrimmed = prevLine.trim();
        if (prevTrimmed === "") continue;

        const prevIndent = prevLine.search(/\S/);
        if (prevIndent > patchesIndent) {
          // Previous line was indented patch content, so this empty line
          // indicates we're exiting the patches block
          inPatches = false;
        }
        break;
      }
    }

    // Case 2: Current line is beyond document (undefined) - check previous empty line
    if (inPatches && currentLine === undefined && currentLineNumber > 0) {
      const prevLine = lines[currentLineNumber - 1];
      // If previous line is completely empty, apply same logic as if we were on that line
      if (prevLine !== undefined && prevLine.length === 0) {
        for (let i = currentLineNumber - 2; i >= 0; i--) {
          const line = lines[i] || "";
          const trimmed = line.trim();
          if (trimmed === "") continue;

          const indent = line.search(/\S/);
          if (indent > patchesIndent) {
            inPatches = false;
          }
          break;
        }
      }
    }

    return inPatches;
  }

  /**
   * Check if the current line is inside the resources array
   */
  private isInsideResources(lines: string[], currentLineNumber: number): boolean {
    let inResources = false;
    let resourcesIndent = -1;

    for (let i = 0; i <= currentLineNumber; i++) {
      const line = lines[i] || "";
      const trimmed = line.trim();

      if (trimmed.startsWith("resources:")) {
        inResources = true;
        resourcesIndent = line.search(/\S/);
        continue;
      }

      // If we find a root-level key after resources, we're out of resources
      if (inResources && resourcesIndent >= 0) {
        const currentIndent = line.search(/\S/);
        if (currentIndent >= 0 && currentIndent <= resourcesIndent && trimmed !== "") {
          // Check if it's a root-level key
          if (/^(apiVersion|kind|output|patches|validators|onNoMatch):/.test(trimmed)) {
            inResources = false;
          }
        }
      }
    }

    // Special case: if we're on an empty line, check if we're exiting resources
    const currentLine = lines[currentLineNumber];

    // Case 1: Current line is completely empty (length 0) - might be exiting resources
    if (
      inResources &&
      currentLine !== undefined &&
      currentLine.length === 0 &&
      currentLineNumber > 0
    ) {
      // Completely empty line - check if previous content was resource content
      for (let i = currentLineNumber - 1; i >= 0; i--) {
        const prevLine = lines[i] || "";
        const prevTrimmed = prevLine.trim();
        if (prevTrimmed === "") continue;

        const prevIndent = prevLine.search(/\S/);
        if (prevIndent > resourcesIndent && prevTrimmed.startsWith("-")) {
          // Previous line was a resource item, so this empty line
          // indicates we're exiting the resources block
          inResources = false;
        }
        break;
      }
    }

    // Case 2: Current line is beyond document (undefined) - check previous empty line
    if (inResources && currentLine === undefined && currentLineNumber > 0) {
      const prevLine = lines[currentLineNumber - 1];
      // If previous line is completely empty, apply same logic as if we were on that line
      if (prevLine !== undefined && prevLine.length === 0) {
        for (let i = currentLineNumber - 2; i >= 0; i--) {
          const line = lines[i] || "";
          const trimmed = line.trim();
          if (trimmed === "") continue;

          const indent = line.search(/\S/);
          if (indent > resourcesIndent && trimmed.startsWith("-")) {
            inResources = false;
          }
          break;
        }
      }
    }

    return inResources;
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
        label: "insert-section",
        kind: CompletionItemKind.Value,
        detail: "Insert new section",
        documentation: "Insert a new section before or after a reference section",
        insertText: "insert-section",
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
      {
        label: "add-list-item",
        kind: CompletionItemKind.Value,
        detail: "Add an item to a markdown list",
        documentation: "Add an item to a markdown list",
        insertText: "add-list-item",
      },
      {
        label: "remove-list-item",
        kind: CompletionItemKind.Value,
        detail: "Remove an item from a markdown list",
        documentation: "Remove an item from a markdown list",
        insertText: "remove-list-item",
      },
      {
        label: "set-list-item",
        kind: CompletionItemKind.Value,
        detail: "Replace an item in a markdown list",
        documentation: "Replace an item in a markdown list",
        insertText: "set-list-item",
      },
      {
        label: "sort-list",
        kind: CompletionItemKind.Value,
        detail: "Sort items in a markdown list",
        documentation: "Sort items in a markdown list alphabetically or numerically",
        insertText: "sort-list",
      },
      {
        label: "filter-list-items",
        kind: CompletionItemKind.Value,
        detail: "Keep or remove list items matching a pattern",
        documentation: "Keep or remove list items matching an exact string or regex pattern",
        insertText: "filter-list-items",
      },
      {
        label: "deduplicate-list-items",
        kind: CompletionItemKind.Value,
        detail: "Remove duplicate items from a markdown list",
        documentation: "Remove duplicate items from a markdown list",
        insertText: "deduplicate-list-items",
      },
      {
        label: "reorder-list-items",
        kind: CompletionItemKind.Value,
        detail: "Reorder items in a markdown list to a specified order",
        documentation:
          "Put list items into a specific order using 0-based indices or exact item text",
        insertText: "reorder-list-items",
      },
      {
        label: "modify-links",
        kind: CompletionItemKind.Value,
        detail: "Find and modify inline markdown links",
        documentation: "Match links by URL or text pattern and replace their URL, text, or both",
        insertText: "modify-links",
      },
      {
        label: "update-toc",
        kind: CompletionItemKind.Value,
        detail: "Regenerate table of contents between markers",
        documentation:
          "Generate or update a TOC between <!-- TOC --> and <!-- /TOC --> comment markers",
        insertText: "update-toc",
      },
      {
        label: "replace-in-section",
        kind: CompletionItemKind.Value,
        detail: "Replace text within a specific section",
        documentation:
          "Like 'replace', but scoped to the content of one section — other sections are untouched",
        insertText: "replace-in-section",
      },
      {
        label: "prepend-to-file",
        kind: CompletionItemKind.Value,
        detail: "Add content to the beginning of a file",
        documentation:
          "Inserts content before the very first character of the file. Useful for headers, disclaimers, or watermarks.",
        insertText: "prepend-to-file",
      },
      {
        label: "append-to-file",
        kind: CompletionItemKind.Value,
        detail: "Add content to the end of a file",
        documentation:
          "Appends content after the very last character of the file. Useful for footers, signatures, or auto-generation notices.",
        insertText: "append-to-file",
      },
      {
        label: "replace-table-cell",
        kind: CompletionItemKind.Value,
        detail: "Replace a cell in a markdown table",
        documentation: "Replace the value of a specific cell by row index and column index or name",
        insertText: "replace-table-cell",
      },
      {
        label: "add-table-row",
        kind: CompletionItemKind.Value,
        detail: "Add a row to a markdown table",
        documentation: "Append or insert a new row into a markdown table",
        insertText: "add-table-row",
      },
      {
        label: "remove-table-row",
        kind: CompletionItemKind.Value,
        detail: "Remove a row from a markdown table",
        documentation: "Remove a row from a markdown table by 0-based index",
        insertText: "remove-table-row",
      },
      {
        label: "add-table-column",
        kind: CompletionItemKind.Value,
        detail: "Add a column to a markdown table",
        documentation: "Add a new column with a header and optional default value",
        insertText: "add-table-column",
      },
      {
        label: "remove-table-column",
        kind: CompletionItemKind.Value,
        detail: "Remove a column from a markdown table",
        documentation: "Remove a column by index or header name",
        insertText: "remove-table-column",
      },
      {
        label: "sort-table",
        kind: CompletionItemKind.Value,
        detail: "Sort rows in a markdown table",
        documentation: "Sort table rows by a column value, ascending or descending",
        insertText: "sort-table",
      },
      {
        label: "rename-table-column",
        kind: CompletionItemKind.Value,
        detail: "Rename a column header in a markdown table",
        documentation: "Change the header text of a column by current name or index",
        insertText: "rename-table-column",
      },
      {
        label: "reorder-table-columns",
        kind: CompletionItemKind.Value,
        detail: "Reorder columns in a markdown table",
        documentation: "Rearrange columns into a specified order using header names or indices",
        insertText: "reorder-table-columns",
      },
      {
        label: "filter-table-rows",
        kind: CompletionItemKind.Value,
        detail: "Keep or remove rows in a markdown table by column value",
        documentation: "Filter table rows by matching a column against an exact value or regex",
        insertText: "filter-table-rows",
      },
      {
        label: "deduplicate-table-rows",
        kind: CompletionItemKind.Value,
        detail: "Remove duplicate rows from a markdown table",
        documentation: "Remove duplicate rows, optionally scoped to a single column",
        insertText: "deduplicate-table-rows",
      },
      {
        label: "exec",
        kind: CompletionItemKind.Value,
        detail: "Execute a shell command",
        documentation: "Run an arbitrary shell command as a patch step",
        insertText: "exec",
      },
      {
        label: "plugin",
        kind: CompletionItemKind.Value,
        detail: "Invoke a named plugin",
        documentation: "Run a registered kustomark plugin with optional parameters",
        insertText: "plugin",
      },
      {
        label: "json-set",
        kind: CompletionItemKind.Value,
        detail: "Set a value in a JSON file",
        documentation: "Set a value at a dot-notation path in a JSON file",
        insertText: "json-set",
      },
      {
        label: "json-delete",
        kind: CompletionItemKind.Value,
        detail: "Delete a key from a JSON file",
        documentation: "Delete the key at a dot-notation path from a JSON file",
        insertText: "json-delete",
      },
      {
        label: "json-merge",
        kind: CompletionItemKind.Value,
        detail: "Merge an object into a JSON file",
        documentation: "Deep-merge a value object into a JSON file at an optional path",
        insertText: "json-merge",
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
    text: string,
    _offset: number,
  ): CompletionItem[] {
    // Don't suggest if we're already in the middle of a key
    if (/^\s*\w+$/.test(linePrefix) && !linePrefix.trim().endsWith(":")) {
      return [];
    }

    // Get the operation type from the current patch
    const lines = text.split("\n");
    const currentOp = this.getCurrentPatchOperation(lines, linePrefix);

    // Common fields for all patches
    const commonFields: CompletionItem[] = [
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
      {
        label: "when",
        kind: CompletionItemKind.Field,
        detail: "Conditional application",
        documentation:
          "Only apply this patch when the condition evaluates to true for the current file",
        insertText: "when:\n  type: fileContains\n  value: ",
      },
    ];

    // Add operation-specific fields
    const operationFields = this.getOperationSpecificFields(currentOp);
    return [...commonFields, ...operationFields];
  }

  /**
   * Get operation-specific fields for the current operation type
   */
  private getOperationSpecificFields(operation: string | null): CompletionItem[] {
    if (!operation) return [];

    const fieldMap: Record<string, CompletionItem[]> = {
      replace: [
        {
          label: "old",
          kind: CompletionItemKind.Field,
          detail: "String to find",
          documentation: "The string to search for and replace",
          insertText: "old: ",
        },
        {
          label: "new",
          kind: CompletionItemKind.Field,
          detail: "Replacement string",
          documentation: "The string to replace with",
          insertText: "new: ",
        },
      ],
      "replace-regex": [
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Regex pattern",
          documentation: "Regular expression pattern to match",
          insertText: "pattern: ",
        },
        {
          label: "replacement",
          kind: CompletionItemKind.Field,
          detail: "Replacement string",
          documentation: "Replacement string (can use capture groups like $1, $2)",
          insertText: "replacement: ",
        },
        {
          label: "flags",
          kind: CompletionItemKind.Field,
          detail: "Regex flags",
          documentation: "Regular expression flags (e.g., 'gi' for global case-insensitive)",
          insertText: "flags: ",
        },
      ],
      "remove-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID to remove",
          documentation: "The ID of the section to remove",
          insertText: "id: ",
        },
        {
          label: "removeChildren",
          kind: CompletionItemKind.Field,
          detail: "Remove child sections",
          documentation: "Whether to remove child sections as well (true/false)",
          insertText: "removeChildren: ",
        },
      ],
      "replace-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID",
          documentation: "The ID of the section to replace",
          insertText: "id: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "New content",
          documentation: "The new content for the section",
          insertText: "content: ",
        },
      ],
      "prepend-to-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID",
          documentation: "The ID of the section to prepend to",
          insertText: "id: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Content to prepend",
          documentation: "The content to add at the beginning",
          insertText: "content: ",
        },
      ],
      "append-to-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID",
          documentation: "The ID of the section to append to",
          insertText: "id: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Content to append",
          documentation: "The content to add at the end",
          insertText: "content: ",
        },
      ],
      "set-frontmatter": [
        {
          label: "field",
          kind: CompletionItemKind.Field,
          detail: "Frontmatter field name",
          documentation: "The name of the frontmatter field to set",
          insertText: "field: ",
        },
        {
          label: "value",
          kind: CompletionItemKind.Field,
          detail: "Field value",
          documentation: "The value to set for the field",
          insertText: "value: ",
        },
      ],
      "remove-frontmatter": [
        {
          label: "field",
          kind: CompletionItemKind.Field,
          detail: "Field to remove",
          documentation: "The name of the frontmatter field to remove",
          insertText: "field: ",
        },
      ],
      "rename-frontmatter": [
        {
          label: "oldField",
          kind: CompletionItemKind.Field,
          detail: "Current field name",
          documentation: "The current name of the field",
          insertText: "oldField: ",
        },
        {
          label: "newField",
          kind: CompletionItemKind.Field,
          detail: "New field name",
          documentation: "The new name for the field",
          insertText: "newField: ",
        },
      ],
      "merge-frontmatter": [
        {
          label: "fields",
          kind: CompletionItemKind.Field,
          detail: "Fields to merge",
          documentation: "Key-value pairs to merge into frontmatter",
          insertText: "fields: ",
        },
      ],
      "delete-between": [
        {
          label: "start",
          kind: CompletionItemKind.Field,
          detail: "Start marker",
          documentation: "The marker that indicates where deletion should start",
          insertText: "start: ",
        },
        {
          label: "end",
          kind: CompletionItemKind.Field,
          detail: "End marker",
          documentation: "The marker that indicates where deletion should end",
          insertText: "end: ",
        },
        {
          label: "inclusive",
          kind: CompletionItemKind.Field,
          detail: "Include markers",
          documentation: "Whether to delete the markers themselves (true/false)",
          insertText: "inclusive: ",
        },
      ],
      "replace-between": [
        {
          label: "start",
          kind: CompletionItemKind.Field,
          detail: "Start marker",
          documentation: "The marker that indicates where replacement should start",
          insertText: "start: ",
        },
        {
          label: "end",
          kind: CompletionItemKind.Field,
          detail: "End marker",
          documentation: "The marker that indicates where replacement should end",
          insertText: "end: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Replacement content",
          documentation: "The content to insert between the markers",
          insertText: "content: ",
        },
        {
          label: "inclusive",
          kind: CompletionItemKind.Field,
          detail: "Include markers",
          documentation: "Whether to replace the markers themselves (true/false)",
          insertText: "inclusive: ",
        },
      ],
      "replace-line": [
        {
          label: "old",
          kind: CompletionItemKind.Field,
          detail: "Line to find",
          documentation: "The exact line to find and replace",
          insertText: "old: ",
        },
        {
          label: "new",
          kind: CompletionItemKind.Field,
          detail: "Replacement line",
          documentation: "The new line content",
          insertText: "new: ",
        },
      ],
      "insert-after-line": [
        {
          label: "after",
          kind: CompletionItemKind.Field,
          detail: "Line to match",
          documentation: "Insert content after lines matching this text",
          insertText: "after: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Content to insert",
          documentation: "The content to insert after the matched line",
          insertText: "content: ",
        },
      ],
      "insert-before-line": [
        {
          label: "before",
          kind: CompletionItemKind.Field,
          detail: "Line to match",
          documentation: "Insert content before lines matching this text",
          insertText: "before: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Content to insert",
          documentation: "The content to insert before the matched line",
          insertText: "content: ",
        },
      ],
      "move-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section to move",
          documentation: "The ID of the section to move",
          insertText: "id: ",
        },
        {
          label: "after",
          kind: CompletionItemKind.Field,
          detail: "Target section",
          documentation: "The ID of the section to move after",
          insertText: "after: ",
        },
      ],
      "insert-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Reference section ID",
          documentation: "The ID of the section to insert before/after",
          insertText: "id: ",
        },
        {
          label: "position",
          kind: CompletionItemKind.Field,
          detail: "Insert position",
          documentation: 'Where to insert: "before" or "after" (default: "after")',
          insertText: "position: after",
        },
        {
          label: "header",
          kind: CompletionItemKind.Field,
          detail: "New section header",
          documentation: 'The header line for the new section (e.g. "## New Section")',
          insertText: "header: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Section body content",
          documentation: "Optional body content for the new section",
          insertText: "content: |\\n  ",
        },
      ],
      "rename-header": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID",
          documentation: "The ID of the section to rename",
          insertText: "id: ",
        },
        {
          label: "newTitle",
          kind: CompletionItemKind.Field,
          detail: "New header text",
          documentation: "The new title for the section header",
          insertText: "newTitle: ",
        },
      ],
      "change-section-level": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID",
          documentation: "The ID of the section to change",
          insertText: "id: ",
        },
        {
          label: "newLevel",
          kind: CompletionItemKind.Field,
          detail: "New heading level",
          documentation: "The new heading level (1-6)",
          insertText: "newLevel: ",
        },
      ],
      "copy-file": [
        {
          label: "source",
          kind: CompletionItemKind.Field,
          detail: "Source file path",
          documentation: "The path to the file to copy",
          insertText: "source: ",
        },
        {
          label: "destination",
          kind: CompletionItemKind.Field,
          detail: "Destination path",
          documentation: "Where to copy the file to",
          insertText: "destination: ",
        },
      ],
      "rename-file": [
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Pattern to match",
          documentation: "Glob pattern to match files to rename",
          insertText: "pattern: ",
        },
        {
          label: "newName",
          kind: CompletionItemKind.Field,
          detail: "New filename",
          documentation: "The new name for matched files",
          insertText: "newName: ",
        },
      ],
      "delete-file": [
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Pattern to match",
          documentation: "Glob pattern to match files to delete",
          insertText: "pattern: ",
        },
      ],
      "move-file": [
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Pattern to match",
          documentation: "Glob pattern to match files to move",
          insertText: "pattern: ",
        },
        {
          label: "destination",
          kind: CompletionItemKind.Field,
          detail: "Destination directory",
          documentation: "Directory to move files to",
          insertText: "destination: ",
        },
      ],
      "reorder-list-items": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation:
            "Zero-based list index (0 = first list in file) or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "order",
          kind: CompletionItemKind.Field,
          detail: "New item order",
          documentation:
            "Array of 0-based indices or exact item text strings specifying the new order",
          insertText: "order:\n  - ",
        },
      ],
      "modify-links": [
        {
          label: "urlMatch",
          kind: CompletionItemKind.Field,
          detail: "Exact URL to match",
          documentation: "Match links whose URL equals this string exactly",
          insertText: "urlMatch: ",
        },
        {
          label: "urlPattern",
          kind: CompletionItemKind.Field,
          detail: "Regex pattern for URL",
          documentation: "Match links whose URL matches this regex pattern",
          insertText: "urlPattern: ",
        },
        {
          label: "textMatch",
          kind: CompletionItemKind.Field,
          detail: "Exact link text to match",
          documentation: "Match links whose display text equals this string exactly",
          insertText: "textMatch: ",
        },
        {
          label: "textPattern",
          kind: CompletionItemKind.Field,
          detail: "Regex pattern for link text",
          documentation: "Match links whose display text matches this regex pattern",
          insertText: "textPattern: ",
        },
        {
          label: "newUrl",
          kind: CompletionItemKind.Field,
          detail: "Replacement URL",
          documentation: "Replace the matched link URL with this value",
          insertText: "newUrl: ",
        },
        {
          label: "urlReplacement",
          kind: CompletionItemKind.Field,
          detail: "Regex replacement for URL",
          documentation: "Regex replacement string for URL (supports $1, $2 capture groups)",
          insertText: "urlReplacement: ",
        },
        {
          label: "newText",
          kind: CompletionItemKind.Field,
          detail: "Replacement link text",
          documentation: "Replace the matched link display text with this value",
          insertText: "newText: ",
        },
        {
          label: "textReplacement",
          kind: CompletionItemKind.Field,
          detail: "Regex replacement for link text",
          documentation: "Regex replacement string for link text (supports $1, $2 capture groups)",
          insertText: "textReplacement: ",
        },
      ],
      "replace-in-section": [
        {
          label: "id",
          kind: CompletionItemKind.Field,
          detail: "Section ID",
          documentation: "Section slug or custom ID to scope the replacement to",
          insertText: "id: ",
        },
        {
          label: "old",
          kind: CompletionItemKind.Field,
          detail: "Text to find",
          documentation: "Exact text to find within the section",
          insertText: "old: ",
        },
        {
          label: "new",
          kind: CompletionItemKind.Field,
          detail: "Replacement text",
          documentation: "Text to replace with",
          insertText: "new: ",
        },
      ],
      "prepend-to-file": [
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Content to prepend",
          documentation: "Text to insert at the very beginning of the file",
          insertText: "content: |",
        },
      ],
      "append-to-file": [
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "Content to append",
          documentation: "Text to insert at the very end of the file",
          insertText: "content: |",
        },
      ],
      "update-toc": [
        {
          label: "marker",
          kind: CompletionItemKind.Field,
          detail: "Opening TOC marker",
          documentation: 'Opening HTML comment marker for TOC (default: "<!-- TOC -->")',
          insertText: "marker: ",
        },
        {
          label: "endMarker",
          kind: CompletionItemKind.Field,
          detail: "Closing TOC marker",
          documentation: 'Closing HTML comment marker for TOC (default: "<!-- /TOC -->")',
          insertText: "endMarker: ",
        },
        {
          label: "minLevel",
          kind: CompletionItemKind.Field,
          detail: "Minimum heading level",
          documentation: "Minimum heading level to include in TOC (default: 2)",
          insertText: "minLevel: ",
        },
        {
          label: "maxLevel",
          kind: CompletionItemKind.Field,
          detail: "Maximum heading level",
          documentation: "Maximum heading level to include in TOC (default: 4)",
          insertText: "maxLevel: ",
        },
        {
          label: "ordered",
          kind: CompletionItemKind.Field,
          detail: "Use ordered list",
          documentation: "Use numbered list instead of bullet list (default: false)",
          insertText: "ordered: ",
        },
        {
          label: "indent",
          kind: CompletionItemKind.Field,
          detail: "Indentation per level",
          documentation: 'Indentation string per heading level (default: "  ")',
          insertText: "indent: ",
        },
      ],
      "add-list-item": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation: "Zero-based list index or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "item",
          kind: CompletionItemKind.Field,
          detail: "Item text",
          documentation: "The text of the new list item to add",
          insertText: "item: ",
        },
        {
          label: "position",
          kind: CompletionItemKind.Field,
          detail: "Insert position",
          documentation: "Zero-based index at which to insert the item (default: end)",
          insertText: "position: ",
        },
      ],
      "remove-list-item": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation: "Zero-based list index or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "match",
          kind: CompletionItemKind.Field,
          detail: "Exact text to remove",
          documentation: "Remove the item whose text matches this exactly",
          insertText: "match: ",
        },
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Regex pattern to match",
          documentation: "Remove items whose text matches this regex pattern",
          insertText: "pattern: ",
        },
        {
          label: "index",
          kind: CompletionItemKind.Field,
          detail: "Item index",
          documentation: "Zero-based index of the item to remove",
          insertText: "index: ",
        },
      ],
      "set-list-item": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation: "Zero-based list index or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "index",
          kind: CompletionItemKind.Field,
          detail: "Item index",
          documentation: "Zero-based index of the item to replace",
          insertText: "index: ",
        },
        {
          label: "match",
          kind: CompletionItemKind.Field,
          detail: "Exact text to find",
          documentation: "Find the item with this exact text and replace it",
          insertText: "match: ",
        },
        {
          label: "new",
          kind: CompletionItemKind.Field,
          detail: "Replacement text",
          documentation: "The new text for the list item",
          insertText: "new: ",
        },
      ],
      "sort-list": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation: "Zero-based list index or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "direction",
          kind: CompletionItemKind.Field,
          detail: "Sort direction",
          documentation: 'Sort order: "asc" or "desc"',
          insertText: "direction: asc",
        },
        {
          label: "type",
          kind: CompletionItemKind.Field,
          detail: "Sort type",
          documentation: 'Value type for sorting: "string", "number", or "date"',
          insertText: "type: string",
        },
      ],
      "filter-list-items": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation: "Zero-based list index or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "match",
          kind: CompletionItemKind.Field,
          detail: "Exact text to match",
          documentation: "Keep (or remove) items whose text equals this exactly",
          insertText: "match: ",
        },
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Regex pattern to match",
          documentation: "Keep (or remove) items whose text matches this regex",
          insertText: "pattern: ",
        },
        {
          label: "invert",
          kind: CompletionItemKind.Field,
          detail: "Invert match",
          documentation: "When true, remove matching items instead of keeping them",
          insertText: "invert: ",
        },
      ],
      "deduplicate-list-items": [
        {
          label: "list",
          kind: CompletionItemKind.Field,
          detail: "List identifier",
          documentation: "Zero-based list index or section ID containing the list",
          insertText: "list: ",
        },
        {
          label: "keep",
          kind: CompletionItemKind.Field,
          detail: "Which duplicate to keep",
          documentation: 'Keep the "first" or "last" occurrence of each duplicate',
          insertText: "keep: first",
        },
      ],
      "replace-table-cell": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "row",
          kind: CompletionItemKind.Field,
          detail: "Row index",
          documentation: "Zero-based row index (not counting the header row)",
          insertText: "row: ",
        },
        {
          label: "column",
          kind: CompletionItemKind.Field,
          detail: "Column index or header name",
          documentation: "Zero-based column index or the column header name",
          insertText: "column: ",
        },
        {
          label: "content",
          kind: CompletionItemKind.Field,
          detail: "New cell value",
          documentation: "The new text content for the cell",
          insertText: "content: ",
        },
      ],
      "add-table-row": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "values",
          kind: CompletionItemKind.Field,
          detail: "Cell values",
          documentation: "Array of cell strings for the new row",
          insertText: "values:\n  - ",
        },
        {
          label: "position",
          kind: CompletionItemKind.Field,
          detail: "Insert position",
          documentation: "Zero-based index at which to insert the row (default: end)",
          insertText: "position: ",
        },
      ],
      "remove-table-row": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "row",
          kind: CompletionItemKind.Field,
          detail: "Row index",
          documentation: "Zero-based row index of the row to remove",
          insertText: "row: ",
        },
      ],
      "add-table-column": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "header",
          kind: CompletionItemKind.Field,
          detail: "Column header text",
          documentation: "The header text for the new column",
          insertText: "header: ",
        },
        {
          label: "defaultValue",
          kind: CompletionItemKind.Field,
          detail: "Default cell value",
          documentation: "Value to populate in existing rows for this column (optional)",
          insertText: "defaultValue: ",
        },
        {
          label: "position",
          kind: CompletionItemKind.Field,
          detail: "Column position",
          documentation: "Zero-based index at which to insert the column (default: end)",
          insertText: "position: ",
        },
      ],
      "remove-table-column": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "column",
          kind: CompletionItemKind.Field,
          detail: "Column index or header name",
          documentation: "Zero-based column index or the column header name to remove",
          insertText: "column: ",
        },
      ],
      "sort-table": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "column",
          kind: CompletionItemKind.Field,
          detail: "Column to sort by",
          documentation: "Zero-based column index or header name to sort by",
          insertText: "column: ",
        },
        {
          label: "direction",
          kind: CompletionItemKind.Field,
          detail: "Sort direction",
          documentation: 'Sort order: "asc" or "desc" (default: "asc")',
          insertText: "direction: asc",
        },
        {
          label: "type",
          kind: CompletionItemKind.Field,
          detail: "Sort type",
          documentation: 'Value type for sorting: "string", "number", or "date"',
          insertText: "type: string",
        },
      ],
      "rename-table-column": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "column",
          kind: CompletionItemKind.Field,
          detail: "Current column name or index",
          documentation: "The current header name or zero-based index of the column to rename",
          insertText: "column: ",
        },
        {
          label: "new",
          kind: CompletionItemKind.Field,
          detail: "New column header",
          documentation: "The new header text for the column",
          insertText: "new: ",
        },
      ],
      "reorder-table-columns": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "columns",
          kind: CompletionItemKind.Field,
          detail: "Column order",
          documentation: "Array of header names or zero-based indices in the desired order",
          insertText: "columns:\n  - ",
        },
      ],
      "filter-table-rows": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "column",
          kind: CompletionItemKind.Field,
          detail: "Column to filter by",
          documentation: "Zero-based column index or header name to filter on",
          insertText: "column: ",
        },
        {
          label: "match",
          kind: CompletionItemKind.Field,
          detail: "Exact value to match",
          documentation: "Keep rows where the column value equals this exactly",
          insertText: "match: ",
        },
        {
          label: "pattern",
          kind: CompletionItemKind.Field,
          detail: "Regex pattern to match",
          documentation: "Keep rows where the column value matches this regex",
          insertText: "pattern: ",
        },
        {
          label: "invert",
          kind: CompletionItemKind.Field,
          detail: "Invert match",
          documentation: "When true, remove matching rows instead of keeping them",
          insertText: "invert: ",
        },
      ],
      "deduplicate-table-rows": [
        {
          label: "table",
          kind: CompletionItemKind.Field,
          detail: "Table identifier",
          documentation: "Zero-based table index or section ID containing the table",
          insertText: "table: ",
        },
        {
          label: "column",
          kind: CompletionItemKind.Field,
          detail: "Column to deduplicate by",
          documentation: "Deduplicate based on this column only (optional; default: entire row)",
          insertText: "column: ",
        },
        {
          label: "keep",
          kind: CompletionItemKind.Field,
          detail: "Which duplicate to keep",
          documentation: 'Keep the "first" or "last" occurrence of each duplicate',
          insertText: "keep: first",
        },
      ],
      exec: [
        {
          label: "command",
          kind: CompletionItemKind.Field,
          detail: "Shell command",
          documentation: "The shell command to execute",
          insertText: "command: ",
        },
        {
          label: "timeout",
          kind: CompletionItemKind.Field,
          detail: "Timeout in ms",
          documentation: "Maximum execution time in milliseconds (default: 30000)",
          insertText: "timeout: ",
        },
      ],
      plugin: [
        {
          label: "plugin",
          kind: CompletionItemKind.Field,
          detail: "Plugin name",
          documentation: "The registered name of the plugin to invoke",
          insertText: "plugin: ",
        },
        {
          label: "params",
          kind: CompletionItemKind.Field,
          detail: "Plugin parameters",
          documentation: "Key-value map of parameters to pass to the plugin",
          insertText: "params:\n  ",
        },
      ],
      "json-set": [
        {
          label: "path",
          kind: CompletionItemKind.Field,
          detail: "Dot-notation path",
          documentation: "Dot-notation path to the key to set (e.g. config.version)",
          insertText: "path: ",
        },
        {
          label: "value",
          kind: CompletionItemKind.Field,
          detail: "Value to set",
          documentation: "The value to assign at the given path",
          insertText: "value: ",
        },
      ],
      "json-delete": [
        {
          label: "path",
          kind: CompletionItemKind.Field,
          detail: "Dot-notation path",
          documentation: "Dot-notation path to the key to delete (e.g. config.debug)",
          insertText: "path: ",
        },
      ],
      "json-merge": [
        {
          label: "value",
          kind: CompletionItemKind.Field,
          detail: "Object to merge",
          documentation: "Key-value object to deep-merge into the JSON file",
          insertText: "value:\n  ",
        },
        {
          label: "path",
          kind: CompletionItemKind.Field,
          detail: "Dot-notation path (optional)",
          documentation: "Merge into a sub-object at this path instead of root",
          insertText: "path: ",
        },
      ],
    };

    return fieldMap[operation] || [];
  }

  /**
   * Get the operation type from the current patch
   */
  private getCurrentPatchOperation(lines: string[], linePrefix: string): string | null {
    // Find the current line number by searching backwards from the end
    let currentLineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i]?.substring(0, linePrefix.length) === linePrefix) {
        currentLineIndex = i;
        break;
      }
    }

    if (currentLineIndex === -1) return null;

    // Search backwards from current line to find the op field
    for (let i = currentLineIndex; i >= 0; i--) {
      const line = lines[i] || "";
      const trimmed = line.trim();

      // Stop if we hit a patch array item marker (start of a different patch)
      if (trimmed.startsWith("-") && i !== currentLineIndex) {
        break;
      }

      // Stop if we hit the patches key
      if (trimmed.startsWith("patches:")) {
        break;
      }

      // Check for op field
      const opMatch = trimmed.match(/^\s*op:\s*(.+)$/);
      if (opMatch?.[1]) {
        return opMatch[1].trim();
      }
    }

    return null;
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
