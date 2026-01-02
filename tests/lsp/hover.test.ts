/**
 * Tests for the LSP hover provider
 */

import { describe, expect, test } from "bun:test";
import { HoverProvider } from "../../src/lsp/hover.js";
import { MarkupKind, type Position, type TextDocument } from "vscode-languageserver";

/**
 * Creates a mock TextDocument for testing
 */
function createMockDocument(content: string): TextDocument {
	return {
		uri: "file:///test.yaml",
		languageId: "yaml",
		version: 1,
		getText: () => content,
		positionAt: (offset: number) => {
			const lines = content.split("\n");
			let currentOffset = 0;
			for (let line = 0; line < lines.length; line++) {
				const lineLength = lines[line].length + 1; // +1 for newline
				if (currentOffset + lineLength > offset) {
					return { line, character: offset - currentOffset };
				}
				currentOffset += lineLength;
			}
			return { line: lines.length - 1, character: 0 };
		},
		offsetAt: (position: Position) => {
			const lines = content.split("\n");
			let offset = 0;
			for (let i = 0; i < position.line && i < lines.length; i++) {
				offset += lines[i].length + 1; // +1 for newline
			}
			offset += position.character;
			return offset;
		},
		lineCount: content.split("\n").length,
	} as TextDocument;
}

describe("HoverProvider", () => {
	const provider = new HoverProvider();

	describe("Root-level fields", () => {
		test("provides hover for apiVersion", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 3 }; // hovering over "apiVersion"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			expect(hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);
			expect(hover?.contents).toHaveProperty("value");
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# apiVersion");
			expect(value).toContain("API version");
			expect(value).toContain("kustomark/v1");
		});

		test("provides hover for kind", () => {
			const content = "kind: Kustomization";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 2 }; // hovering over "kind"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			expect(hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# kind");
			expect(value).toContain("kind of resource");
			expect(value).toContain("Kustomization");
		});

		test("provides hover for output", () => {
			const content = "output: ./dist";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "output"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# output");
			expect(value).toContain("directory where processed markdown files");
			expect(value).toContain("./dist");
		});

		test("provides hover for resources", () => {
			const content = "resources:\n  - docs/**/*.md";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "resources"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# resources");
			expect(value).toContain("resource patterns");
			expect(value).toContain("Glob patterns");
			expect(value).toContain("Git URLs");
		});

		test("provides hover for patches", () => {
			const content = "patches:\n  - op: replace";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "patches"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# patches");
			expect(value).toContain("patch operations");
			expect(value).toContain("applied in order");
		});

		test("provides hover for validators", () => {
			const content = "validators:\n  - name: test";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "validators"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# validators");
			expect(value).toContain("validation rules");
			expect(value).toContain("fail the build");
		});
	});

	describe("Patch operation types", () => {
		test("provides hover for replace operation", () => {
			const content = "- op: replace\n  old: foo\n  new: bar";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 8 }; // hovering over "replace"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# replace");
			expect(value).toContain("Simple string replacement");
			expect(value).toContain("old");
			expect(value).toContain("new");
		});

		test("provides hover for replace-regex operation", () => {
			const content = "- op: replace-regex";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 10 }; // hovering over "replace-regex"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# replace-regex");
			expect(value).toContain("Regex-based replacement");
			expect(value).toContain("pattern");
			expect(value).toContain("replacement");
			expect(value).toContain("flags");
		});

		test("provides hover for remove-section operation", () => {
			const content = "- op: remove-section";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "remove-section"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# remove-section");
			expect(value).toContain("Removes a markdown section");
			expect(value).toContain("id");
			expect(value).toContain("includeChildren");
		});

		test("provides hover for replace-section operation", () => {
			const content = "- op: replace-section";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "replace-section"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# replace-section");
			expect(value).toContain("Replaces the content");
			expect(value).toContain("id");
			expect(value).toContain("content");
		});

		test("provides hover for prepend-to-section operation", () => {
			const content = "- op: prepend-to-section";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "prepend-to-section"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# prepend-to-section");
			expect(value).toContain("beginning of a section");
			expect(value).toContain("after the header");
		});

		test("provides hover for append-to-section operation", () => {
			const content = "- op: append-to-section";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "append-to-section"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# append-to-section");
			expect(value).toContain("end of a section");
		});

		test("provides hover for set-frontmatter operation", () => {
			const content = "- op: set-frontmatter";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "set-frontmatter"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# set-frontmatter");
			expect(value).toContain("Sets or updates a frontmatter field");
			expect(value).toContain("key");
			expect(value).toContain("value");
		});

		test("provides hover for remove-frontmatter operation", () => {
			const content = "- op: remove-frontmatter";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "remove-frontmatter"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# remove-frontmatter");
			expect(value).toContain("Removes a field from frontmatter");
		});

		test("provides hover for rename-frontmatter operation", () => {
			const content = "- op: rename-frontmatter";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "rename-frontmatter"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# rename-frontmatter");
			expect(value).toContain("Renames a frontmatter field");
		});

		test("provides hover for merge-frontmatter operation", () => {
			const content = "- op: merge-frontmatter";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "merge-frontmatter"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# merge-frontmatter");
			expect(value).toContain("Merges multiple key-value pairs");
			expect(value).toContain("values");
		});

		test("provides hover for delete-between operation", () => {
			const content = "- op: delete-between";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "delete-between"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# delete-between");
			expect(value).toContain("Deletes content between two marker strings");
			expect(value).toContain("start");
			expect(value).toContain("end");
			expect(value).toContain("inclusive");
		});

		test("provides hover for replace-between operation", () => {
			const content = "- op: replace-between";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "replace-between"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# replace-between");
			expect(value).toContain("Replaces content between two marker strings");
			expect(value).toContain("start");
			expect(value).toContain("end");
			expect(value).toContain("content");
		});

		test("provides hover for replace-line operation", () => {
			const content = "- op: replace-line";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "replace-line"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# replace-line");
			expect(value).toContain("Replaces entire lines that match exactly");
			expect(value).toContain("match");
			expect(value).toContain("replacement");
		});

		test("provides hover for insert-after-line operation", () => {
			const content = "- op: insert-after-line";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "insert-after-line"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# insert-after-line");
			expect(value).toContain("Inserts content after a matching line");
			expect(value).toContain("match");
			expect(value).toContain("pattern");
		});

		test("provides hover for insert-before-line operation", () => {
			const content = "- op: insert-before-line";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "insert-before-line"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# insert-before-line");
			expect(value).toContain("Inserts content before a matching line");
		});

		test("provides hover for move-section operation", () => {
			const content = "- op: move-section";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "move-section"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# move-section");
			expect(value).toContain("Moves a markdown section");
			expect(value).toContain("id");
			expect(value).toContain("after");
		});

		test("provides hover for rename-header operation", () => {
			const content = "- op: rename-header";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "rename-header"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# rename-header");
			expect(value).toContain("Renames a section header");
			expect(value).toContain("preserving its level");
		});

		test("provides hover for change-section-level operation", () => {
			const content = "- op: change-section-level";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // hovering over "change-section-level"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# change-section-level");
			expect(value).toContain("Changes the heading level");
			expect(value).toContain("delta");
		});
	});

	describe("Common patch fields", () => {
		test("provides hover for op field", () => {
			const content = "- op: replace";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 3 }; // hovering over "op"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# op");
			expect(value).toContain("type of patch operation");
			expect(value).toContain("Available operations:");
			expect(value).toContain("replace");
			expect(value).toContain("replace-regex");
		});

		test("provides hover for id field", () => {
			const content = "- id: my-patch";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 3 }; // hovering over "id"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# id");
			expect(value).toContain("Unique identifier");
			expect(value).toContain("inheritance");
		});

		test("provides hover for extends field", () => {
			const content = "- extends: base-patch";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 3 }; // hovering over "extends"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# extends");
			expect(value).toContain("Inherit configuration");
			expect(value).toContain("inherit all fields");
		});

		test("provides hover for include field", () => {
			const content = "  include: '*.md'";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "include"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# include");
			expect(value).toContain("Glob pattern");
			expect(value).toContain("include specific files");
		});

		test("provides hover for exclude field", () => {
			const content = "  exclude: 'internal/**'";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "exclude"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# exclude");
			expect(value).toContain("exclude specific files");
		});

		test("provides hover for onNoMatch field", () => {
			const content = "  onNoMatch: warn";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "onNoMatch"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# onNoMatch");
			expect(value).toContain("strategy");
			expect(value).toContain("skip");
			expect(value).toContain("warn");
			expect(value).toContain("error");
		});

		test("provides hover for group field", () => {
			const content = "  group: production";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "group"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# group");
			expect(value).toContain("group name");
			expect(value).toContain("selective patch application");
		});

		test("provides hover for validate field", () => {
			const content = "  validate:\n    notContains: test";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // hovering over "validate"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# validate");
			expect(value).toContain("validation rules");
			expect(value).toContain("notContains");
		});
	});

	describe("Enum values", () => {
		test("provides hover for skip value", () => {
			const content = "onNoMatch: skip";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 13 }; // hovering over "skip"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# skip");
			expect(value).toContain("Skip patches that don't match");
			expect(value).toContain("without any notification");
		});

		test("provides hover for warn value", () => {
			const content = "onNoMatch: warn";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 13 }; // hovering over "warn"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# warn");
			expect(value).toContain("Show a warning");
			expect(value).toContain("build will continue");
		});

		test("provides hover for error value", () => {
			const content = "onNoMatch: error";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 13 }; // hovering over "error"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# error");
			expect(value).toContain("Fail the build");
			expect(value).toContain("stop with an error");
		});
	});

	describe("Markdown formatting verification", () => {
		test("hover content includes markdown headers", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 3 };

			const hover = provider.provideHover(doc, position);

			const value = (hover?.contents as { value: string }).value;
			expect(value).toMatch(/^# /m); // Contains markdown header
		});

		test("hover content includes code blocks", () => {
			const content = "- op: replace";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 8 }; // hovering over "replace"

			const hover = provider.provideHover(doc, position);

			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("```yaml"); // Contains YAML code block
			expect(value).toContain("```");
		});

		test("hover content includes field descriptions", () => {
			const content = "- op: replace-regex";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 10 };

			const hover = provider.provideHover(doc, position);

			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("**Fields:**"); // Contains bold text
			expect(value).toContain("required"); // Contains field info
		});

		test("hover returns MarkupKind.Markdown", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 3 };

			const hover = provider.provideHover(doc, position);

			expect(hover?.contents).toHaveProperty("kind", MarkupKind.Markdown);
		});
	});

	describe("Position handling", () => {
		test("provides hover at beginning of word", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 0 }; // first character

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# apiVersion");
		});

		test("provides hover at end of word", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 10 }; // end of "apiVersion"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# apiVersion");
		});

		test("provides hover at middle of word", () => {
			const content = "resources: []";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 4 }; // middle of "resources"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# resources");
		});

		test("provides hover for hyphenated words", () => {
			const content = "- op: replace-regex";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // in "replace-regex"

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# replace-regex");
		});

		test("handles multi-line YAML", () => {
			const content = "apiVersion: kustomark/v1\nkind: Kustomization\nresources:\n  - docs/**/*.md";
			const doc = createMockDocument(content);
			const position: Position = { line: 1, character: 2 }; // "kind" on line 2

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# kind");
		});

		test("handles indented YAML", () => {
			const content = "patches:\n  - op: replace\n    old: foo\n    new: bar";
			const doc = createMockDocument(content);
			const position: Position = { line: 1, character: 6 }; // "op" with indentation

			const hover = provider.provideHover(doc, position);

			expect(hover).not.toBeNull();
			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("# op");
		});
	});

	describe("Null returns", () => {
		test("returns null for whitespace", () => {
			const content = "apiVersion:    kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 12 }; // in whitespace

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for unknown field names", () => {
			const content = "unknownField: value";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 5 }; // in "unknownField"

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for unknown operation values", () => {
			const content = "- op: unknown-op";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 10 }; // in "unknown-op"

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for string values (not enums)", () => {
			const content = "output: ./dist";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 10 }; // in "./dist"

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for colons and special characters", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 11 }; // after the colon

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for empty line", () => {
			const content = "apiVersion: kustomark/v1\n\nkind: Kustomization";
			const doc = createMockDocument(content);
			const position: Position = { line: 1, character: 0 }; // empty line

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for comments", () => {
			const content = "# This is a comment\napiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 0, character: 5 }; // in comment

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});

		test("returns null for out of bounds position", () => {
			const content = "apiVersion: kustomark/v1";
			const doc = createMockDocument(content);
			const position: Position = { line: 10, character: 0 }; // beyond document end

			const hover = provider.provideHover(doc, position);

			expect(hover).toBeNull();
		});
	});

	describe("Integration tests", () => {
		test("provides correct hover for complete config file", () => {
			const content = `apiVersion: kustomark/v1
kind: Kustomization
output: ./dist
resources:
  - docs/**/*.md
onNoMatch: warn
patches:
  - id: base-replacement
    op: replace
    old: foo
    new: bar
    include: "*.md"
  - op: replace-regex
    pattern: "v\\\\d+\\\\.\\\\d+\\\\.\\\\d+"
    replacement: "v2.0.0"
    onNoMatch: error`;

			const doc = createMockDocument(content);

			// Test apiVersion
			let hover = provider.provideHover(doc, { line: 0, character: 3 });
			expect(hover).not.toBeNull();
			expect((hover?.contents as { value: string }).value).toContain("# apiVersion");

			// Test onNoMatch field
			hover = provider.provideHover(doc, { line: 5, character: 3 });
			expect(hover).not.toBeNull();
			expect((hover?.contents as { value: string }).value).toContain("# onNoMatch");

			// Test warn value
			hover = provider.provideHover(doc, { line: 5, character: 13 });
			expect(hover).not.toBeNull();
			expect((hover?.contents as { value: string }).value).toContain("# warn");

			// Test replace operation
			hover = provider.provideHover(doc, { line: 8, character: 9 });
			expect(hover).not.toBeNull();
			expect((hover?.contents as { value: string }).value).toContain("# replace");

			// Test include field
			hover = provider.provideHover(doc, { line: 11, character: 6 });
			expect(hover).not.toBeNull();
			expect((hover?.contents as { value: string }).value).toContain("# include");
		});

		test("handles complex nested YAML structure", () => {
			const content = `patches:
  - op: merge-frontmatter
    values:
      author: "John Doe"
      tags: ["test"]
    validate:
      notContains: "secret"`;

			const doc = createMockDocument(content);

			// Test merge-frontmatter
			const hover = provider.provideHover(doc, { line: 1, character: 10 });
			expect(hover).not.toBeNull();
			expect((hover?.contents as { value: string }).value).toContain("# merge-frontmatter");

			// Test validate field
			const hover2 = provider.provideHover(doc, { line: 5, character: 6 });
			expect(hover2).not.toBeNull();
			expect((hover2?.contents as { value: string }).value).toContain("# validate");
		});
	});

	describe("Documentation accuracy", () => {
		test("replace operation documentation is helpful", () => {
			const content = "- op: replace";
			const doc = createMockDocument(content);
			const hover = provider.provideHover(doc, { line: 0, character: 8 });

			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("Simple string replacement");
			expect(value).toContain("old");
			expect(value).toContain("new");
			expect(value).toContain("required");
			expect(value).toContain("Example:");
		});

		test("resources documentation explains all supported types", () => {
			const content = "resources: []";
			const doc = createMockDocument(content);
			const hover = provider.provideHover(doc, { line: 0, character: 3 });

			const value = (hover?.contents as { value: string }).value;
			expect(value).toContain("Glob patterns");
			expect(value).toContain("File paths");
			expect(value).toContain("Git URLs");
			expect(value).toContain("HTTP archive URLs");
		});

		test("onNoMatch documentation explains all options", () => {
			const content = "  onNoMatch: skip";
			const doc = createMockDocument(content);

			// Test field documentation
			let hover = provider.provideHover(doc, { line: 0, character: 4 });
			let value = (hover?.contents as { value: string }).value;
			expect(value).toContain("skip");
			expect(value).toContain("warn");
			expect(value).toContain("error");

			// Test skip value documentation
			hover = provider.provideHover(doc, { line: 0, character: 14 });
			value = (hover?.contents as { value: string }).value;
			expect(value).toContain("Skip patches that don't match");
		});

		test("patch operations include examples", () => {
			const operations = [
				"replace",
				"replace-regex",
				"remove-section",
				"set-frontmatter",
				"delete-between",
			];

			for (const op of operations) {
				const content = `- op: ${op}`;
				const doc = createMockDocument(content);
				const hover = provider.provideHover(doc, { line: 0, character: 8 });

				const value = (hover?.contents as { value: string }).value;
				expect(value).toContain("Example:");
				expect(value).toContain("```yaml");
			}
		});
	});
});
