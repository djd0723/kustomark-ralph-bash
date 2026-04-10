/**
 * Tests for the LSP Code Actions Provider
 */

import { describe, expect, test } from "bun:test";
import { CodeActionKind, DiagnosticSeverity, type Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CodeActionsProvider } from "../../src/lsp/code-actions.js";

const URI = "file:///test/kustomark.yaml";

function makeDocument(content: string): TextDocument {
  return TextDocument.create(URI, "yaml", 1, content);
}

function makeDiagnostic(
  message: string,
  line = 0,
  character = 0,
  endLine = 0,
  endChar = 1,
  source = "kustomark",
): Diagnostic {
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line, character },
      end: { line: endLine, character: endChar },
    },
    message,
    source,
  };
}

describe("CodeActionsProvider", () => {
  const provider = new CodeActionsProvider();

  describe("no diagnostics", () => {
    test("returns empty array when there are no diagnostics", () => {
      const doc = makeDocument(`apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md`);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        context: { diagnostics: [] },
      });

      expect(actions).toHaveLength(0);
    });

    test("ignores diagnostics from other sources", () => {
      const doc = makeDocument("apiVersion: kustomark/v1");
      const diag = makeDiagnostic("apiVersion is required", 0, 0, 0, 1, "other-linter");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(0);
    });
  });

  describe("missing apiVersion", () => {
    test("offers to add apiVersion when missing", () => {
      const content = `kind: Kustomization
resources:
  - docs/**/*.md`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("apiVersion is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(1);
      expect(actions[0]?.kind).toBe(CodeActionKind.QuickFix);
      expect(actions[0]?.title).toContain("apiVersion");

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      expect(edit?.newText).toBe("apiVersion: kustomark/v1\n");
      expect(edit?.range.start.line).toBe(0);
      expect(edit?.range.start.character).toBe(0);
    });

    test("fix has the correct diagnostic attached", () => {
      const doc = makeDocument("kind: Kustomization");
      const diag = makeDiagnostic("apiVersion is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions[0]?.diagnostics).toEqual([diag]);
    });
  });

  describe("wrong apiVersion value", () => {
    test("offers to fix apiVersion to kustomark/v1", () => {
      const content = `apiVersion: wrong/v2
kind: Kustomization
resources:
  - docs/**/*.md`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic('apiVersion must be "kustomark/v1"', 0, 0, 0, 20);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(1);
      expect(actions[0]?.kind).toBe(CodeActionKind.QuickFix);

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      expect(edit?.newText).toBe("apiVersion: kustomark/v1");
      expect(edit?.range.start.line).toBe(0);
    });
  });

  describe("missing kind", () => {
    test("offers to add kind: Kustomization when missing", () => {
      const content = `apiVersion: kustomark/v1
resources:
  - docs/**/*.md`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("kind is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(1);
      expect(actions[0]?.kind).toBe(CodeActionKind.QuickFix);
      expect(actions[0]?.title).toContain("kind");

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      expect(edit?.newText).toBe("kind: Kustomization\n");
      expect(edit?.range.start.line).toBe(0);
    });
  });

  describe("wrong kind value", () => {
    test("offers to fix kind to Kustomization", () => {
      const content = `apiVersion: kustomark/v1
kind: WrongKind
resources:
  - docs/**/*.md`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic('kind must be "Kustomization"', 1, 0, 1, 15);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(1);

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      expect(edit?.newText).toBe("kind: Kustomization");
      expect(edit?.range.start.line).toBe(1);
    });
  });

  describe("missing resources", () => {
    test("offers to add resources section when missing", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("resources is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(1);
      expect(actions[0]?.kind).toBe(CodeActionKind.QuickFix);
      expect(actions[0]?.title).toContain("resources");

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      expect(edit?.newText).toContain("resources:");
      expect(edit?.newText).toContain("**/*.md");
    });

    test("inserts resources at end of document", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("resources is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      const lines = content.split("\n");
      const lastLine = lines.length - 1;
      expect(edit?.range.start.line).toBe(lastLine);
    });
  });

  describe("invalid patch operation", () => {
    test("offers typo correction for close op name", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replce
    old: foo
    new: bar`;
      const doc = makeDocument(content);
      // Diagnostic points to the "op:" line (line 5)
      const diag = makeDiagnostic('Invalid operation "replce". Must be one of: replace, ...', 5, 4, 5, 14);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions.length).toBeGreaterThan(0);
      // The closest match should be "replace"
      const titles = actions.map((a) => a.title);
      expect(titles.some((t) => t.includes("replace"))).toBe(true);

      // Each fix should be a QuickFix
      for (const action of actions) {
        expect(action.kind).toBe(CodeActionKind.QuickFix);
      }
    });

    test("replaces the op value on the correct line", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: rmve-section
    id: introduction`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic('Invalid operation "rmve-section". Must be one of: ...', 5, 4, 5, 20);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions.length).toBeGreaterThan(0);
      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      // Should target line 5 (the "- op: rmve-section" line)
      expect(edit?.range.start.line).toBe(5);
      // New text should contain "op:" with the suggested value
      expect(edit?.newText).toMatch(/op:\s+\S+/);
    });

    test("returns no op fix actions when op is completely unrecognizable", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: xxxxxxxxxxxxxxxxxxxxxxxxxxx
    old: foo`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic(
        'Invalid operation "xxxxxxxxxxxxxxxxxxxxxxxxxxx". Must be one of: ...',
        5,
        4,
        5,
        35,
      );

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      // No close matches for a completely invalid string — OK to have 0 actions
      expect(actions.length).toBeLessThanOrEqual(3);
    });

    test("op fix has correct diagnostics attached", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replce`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic('Invalid operation "replce". Must be one of: replace', 5, 4, 5, 14);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      for (const action of actions) {
        expect(action.diagnostics).toEqual([diag]);
      }
    });
  });

  describe("invalid onNoMatch value", () => {
    test("offers all three valid onNoMatch values", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
onNoMatch: invalid`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("onNoMatch must be one of: skip, warn, error", 4, 0, 4, 18);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(3);

      const titles = actions.map((a) => a.title);
      expect(titles.some((t) => t.includes('"skip"'))).toBe(true);
      expect(titles.some((t) => t.includes('"warn"'))).toBe(true);
      expect(titles.some((t) => t.includes('"error"'))).toBe(true);
    });

    test("each onNoMatch fix replaces the field on the correct line", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
onNoMatch: oops`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("onNoMatch must be one of: skip, warn, error", 4, 0, 4, 15);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      for (const action of actions) {
        const edit = action.edit?.changes?.[URI]?.[0];
        expect(edit?.range.start.line).toBe(4);
        expect(edit?.newText).toMatch(/^onNoMatch: (skip|warn|error)$/);
      }
    });

    test("onNoMatch fix at patch level replaces patch-level field", () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    onNoMatch: bad`;
      const doc = makeDocument(content);
      const diag = makeDiagnostic("onNoMatch must be one of: skip, warn, error", 8, 4, 8, 18);

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      expect(actions).toHaveLength(3);
      for (const action of actions) {
        const edit = action.edit?.changes?.[URI]?.[0];
        expect(edit?.range.start.line).toBe(8);
        expect(edit?.newText).toMatch(/onNoMatch: (skip|warn|error)/);
      }
    });

    test("all onNoMatch fixes are QuickFix kind", () => {
      const doc = makeDocument("onNoMatch: bad");
      const diag = makeDiagnostic("onNoMatch must be one of: skip, warn, error");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      for (const action of actions) {
        expect(action.kind).toBe(CodeActionKind.QuickFix);
      }
    });
  });

  describe("multiple diagnostics in one request", () => {
    test("generates fixes for multiple diagnostics at once", () => {
      const content = `kind: Kustomization`;
      const doc = makeDocument(content);

      const diag1 = makeDiagnostic("apiVersion is required");
      const diag2 = makeDiagnostic("resources is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        context: { diagnostics: [diag1, diag2] },
      });

      // Expect one action for apiVersion and one for resources
      expect(actions.length).toBeGreaterThanOrEqual(2);

      const titles = actions.map((a) => a.title);
      expect(titles.some((t) => t.includes("apiVersion"))).toBe(true);
      expect(titles.some((t) => t.includes("resources"))).toBe(true);
    });
  });

  describe("edit structure", () => {
    test("all actions target the correct document URI", () => {
      const doc = makeDocument("kind: Kustomization");
      const diag = makeDiagnostic("apiVersion is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      for (const action of actions) {
        const uris = Object.keys(action.edit?.changes ?? {});
        expect(uris).toContain(URI);
      }
    });

    test("insert-at-start actions have range starting at (0, 0)", () => {
      const doc = makeDocument("kind: Kustomization");
      const diag = makeDiagnostic("apiVersion is required");

      const actions = provider.provideCodeActions(doc, {
        textDocument: { uri: URI },
        range: diag.range,
        context: { diagnostics: [diag] },
      });

      const edit = actions[0]?.edit?.changes?.[URI]?.[0];
      expect(edit?.range.start).toEqual({ line: 0, character: 0 });
      expect(edit?.range.end).toEqual({ line: 0, character: 0 });
    });
  });
});
