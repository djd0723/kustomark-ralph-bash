/**
 * LSP Code Actions Provider for Kustomark
 *
 * Provides quick-fix actions for diagnostics in kustomark.yaml files:
 * - Insert missing required fields (apiVersion, kind, resources)
 * - Fix wrong apiVersion / kind values
 * - Correct invalid patch operations (with fuzzy matching)
 * - Replace invalid onNoMatch values with valid options
 */

import {
  type CodeAction,
  CodeActionKind,
  type CodeActionParams,
  type Diagnostic,
  type TextEdit,
  type WorkspaceEdit,
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { findSimilarStrings } from "../core/utils/string-similarity.js";

// Valid patch operations — must stay in sync with validOps in config-parser.ts
const VALID_OPS = [
  "replace",
  "replace-regex",
  "remove-section",
  "replace-section",
  "prepend-to-section",
  "append-to-section",
  "set-frontmatter",
  "remove-frontmatter",
  "rename-frontmatter",
  "merge-frontmatter",
  "delete-between",
  "replace-between",
  "replace-line",
  "insert-after-line",
  "insert-before-line",
  "rename-header",
  "move-section",
  "change-section-level",
  "insert-section",
  "copy-file",
  "rename-file",
  "delete-file",
  "move-file",
  "replace-table-cell",
  "add-table-row",
  "remove-table-row",
  "add-table-column",
  "remove-table-column",
  "sort-table",
  "rename-table-column",
  "reorder-table-columns",
  "filter-table-rows",
  "deduplicate-table-rows",
  "exec",
  "plugin",
  "json-set",
  "json-delete",
  "json-merge",
  "add-list-item",
  "remove-list-item",
  "set-list-item",
  "sort-list",
  "filter-list-items",
  "deduplicate-list-items",
  "reorder-list-items",
  "modify-links",
  "update-toc",
  "replace-in-section",
  "prepend-to-file",
  "append-to-file",
];

/**
 * Provider for LSP code actions (quick fixes) in kustomark configuration files
 */
export class CodeActionsProvider {
  /**
   * Provides code actions for a set of diagnostics at the given position.
   *
   * @param document - The text document
   * @param params - Code action request parameters (includes context.diagnostics)
   * @returns Array of code actions (quick fixes)
   */
  provideCodeActions(document: TextDocument, params: CodeActionParams): CodeAction[] {
    const actions: CodeAction[] = [];
    const content = document.getText();
    const uri = document.uri;

    for (const diagnostic of params.context.diagnostics) {
      if (diagnostic.source !== "kustomark") {
        continue;
      }

      const message = diagnostic.message;

      // ── Required top-level fields ────────────────────────────────────────
      if (message.includes("apiVersion is required")) {
        actions.push(
          this.insertAtStart(uri, "apiVersion: kustomark/v1\n", "Add apiVersion: kustomark/v1", [
            diagnostic,
          ]),
        );
      }

      if (message.includes('apiVersion must be "kustomark/v1"')) {
        actions.push(
          this.replaceFieldValue(
            uri,
            content,
            diagnostic.range.start.line,
            "apiVersion",
            "kustomark/v1",
            'Fix apiVersion to "kustomark/v1"',
            [diagnostic],
          ),
        );
      }

      if (message.includes("kind is required")) {
        actions.push(
          this.insertAtStart(uri, "kind: Kustomization\n", "Add kind: Kustomization", [diagnostic]),
        );
      }

      if (message.includes('kind must be "Kustomization"')) {
        actions.push(
          this.replaceFieldValue(
            uri,
            content,
            diagnostic.range.start.line,
            "kind",
            "Kustomization",
            'Fix kind to "Kustomization"',
            [diagnostic],
          ),
        );
      }

      if (message.includes("resources is required")) {
        actions.push(
          this.insertAtEnd(uri, content, '\nresources:\n  - "**/*.md"\n', "Add resources section", [
            diagnostic,
          ]),
        );
      }

      // ── Invalid patch operation ──────────────────────────────────────────
      const invalidOpMatch = message.match(/Invalid operation "([^"]+)"/);
      if (invalidOpMatch) {
        const invalidOp = invalidOpMatch[1] ?? "";
        const suggestions = findSimilarStrings(invalidOp, VALID_OPS, {
          maxResults: 3,
          excludeExact: true,
        });

        for (const suggestion of suggestions) {
          actions.push(
            this.replaceFieldValue(
              uri,
              content,
              diagnostic.range.start.line,
              "op",
              suggestion.value,
              `Replace op with "${suggestion.value}"`,
              [diagnostic],
            ),
          );
        }
      }

      // ── Invalid onNoMatch value ──────────────────────────────────────────
      if (message.includes("onNoMatch must be one of: skip, warn, error")) {
        for (const value of ["skip", "warn", "error"]) {
          actions.push(
            this.replaceFieldValue(
              uri,
              content,
              diagnostic.range.start.line,
              "onNoMatch",
              value,
              `Set onNoMatch to "${value}"`,
              [diagnostic],
            ),
          );
        }
      }
    }

    return actions;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Creates a code action that inserts text at the beginning of the document.
   */
  private insertAtStart(
    uri: string,
    text: string,
    title: string,
    diagnostics: Diagnostic[],
  ): CodeAction {
    const edit: WorkspaceEdit = {
      changes: {
        [uri]: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            newText: text,
          } satisfies TextEdit,
        ],
      },
    };
    return { title, kind: CodeActionKind.QuickFix, diagnostics, edit };
  }

  /**
   * Creates a code action that appends text at the end of the document.
   */
  private insertAtEnd(
    uri: string,
    content: string,
    text: string,
    title: string,
    diagnostics: Diagnostic[],
  ): CodeAction {
    const lines = content.split("\n");
    const lastLine = lines.length - 1;
    const lastChar = lines[lastLine]?.length ?? 0;

    const edit: WorkspaceEdit = {
      changes: {
        [uri]: [
          {
            range: {
              start: { line: lastLine, character: lastChar },
              end: { line: lastLine, character: lastChar },
            },
            newText: text,
          } satisfies TextEdit,
        ],
      },
    };
    return { title, kind: CodeActionKind.QuickFix, diagnostics, edit };
  }

  /**
   * Creates a code action that replaces a field's value on its line.
   *
   * Searches from `startLine` forward (up to 10 lines) for a line matching
   * `fieldName:` and replaces the entire line with the corrected value.
   */
  private replaceFieldValue(
    uri: string,
    content: string,
    startLine: number,
    fieldName: string,
    newValue: string,
    title: string,
    diagnostics: Diagnostic[],
  ): CodeAction {
    const lines = content.split("\n");
    // Escape special regex chars in the field name
    const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fieldPattern = new RegExp(`^(\\s*(?:-\\s*)?)${escaped}\\s*:`);

    let targetLine = startLine;
    const searchEnd = Math.min(startLine + 10, lines.length);

    for (let i = startLine; i < searchEnd; i++) {
      if (fieldPattern.test(lines[i] ?? "")) {
        targetLine = i;
        break;
      }
    }

    const lineContent = lines[targetLine] ?? "";
    const match = fieldPattern.exec(lineContent);
    const prefix = match ? match[1] : "";
    const newLineContent = `${prefix}${fieldName}: ${newValue}`;

    const edit: WorkspaceEdit = {
      changes: {
        [uri]: [
          {
            range: {
              start: { line: targetLine, character: 0 },
              end: { line: targetLine, character: lineContent.length },
            },
            newText: newLineContent,
          } satisfies TextEdit,
        ],
      },
    };
    return { title, kind: CodeActionKind.QuickFix, diagnostics, edit };
  }
}
