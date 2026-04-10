/**
 * Tests for the LSP completion provider
 */

import { describe, expect, test } from 'bun:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, type Position } from 'vscode-languageserver';
import { CompletionProvider } from '../../src/lsp/completion.js';

/**
 * Helper to create a TextDocument from YAML content
 */
function createDocument(content: string): TextDocument {
  return TextDocument.create('file:///test/kustomark.yaml', 'yaml', 1, content);
}

/**
 * Helper to create a Position object
 */
function createPosition(line: number, character: number): Position {
  return { line, character };
}

/**
 * Helper to get completion labels from completion items
 */
function getLabels(items: any[]): string[] {
  return items.map(item => item.label).sort();
}

describe('CompletionProvider', () => {
  const provider = new CompletionProvider();

  describe('root level completions', () => {
    test('provides all root fields at document start', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('apiVersion');
      expect(labels).toContain('kind');
      expect(labels).toContain('output');
      expect(labels).toContain('resources');
      expect(labels).toContain('patches');
      expect(labels).toContain('validators');
      expect(labels).toContain('onNoMatch');
    });

    test('provides root fields after existing root field', () => {
      const content = `apiVersion: "kustomark/v1"
`;
      const doc = createDocument(content);
      const position = createPosition(1, 0);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('kind');
      expect(labels).toContain('resources');
      expect(labels).toContain('patches');
    });

    test('includes correct insertText for apiVersion', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);
      const apiVersion = completions.find(c => c.label === 'apiVersion');

      expect(apiVersion).toBeDefined();
      expect(apiVersion?.insertText).toBe('apiVersion: "kustomark/v1"');
      expect(apiVersion?.kind).toBe(CompletionItemKind.Field);
    });

    test('includes correct insertText for kind', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);
      const kind = completions.find(c => c.label === 'kind');

      expect(kind).toBeDefined();
      expect(kind?.insertText).toBe('kind: "Kustomization"');
      expect(kind?.kind).toBe(CompletionItemKind.Field);
    });

    test('includes correct insertText for resources with array start', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);
      const resources = completions.find(c => c.label === 'resources');

      expect(resources).toBeDefined();
      expect(resources?.insertText).toBe('resources:\n  - ');
    });

    test('includes correct insertText for patches with op field', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);
      const patches = completions.find(c => c.label === 'patches');

      expect(patches).toBeDefined();
      expect(patches?.insertText).toBe('patches:\n  - op: ');
    });

    test('provides root-level onNoMatch completion', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
`;
      const doc = createDocument(content);
      const position = createPosition(4, 0);

      const completions = provider.provideCompletions(doc, position);
      const onNoMatch = completions.find(c => c.label === 'onNoMatch');

      expect(onNoMatch).toBeDefined();
      expect(onNoMatch?.detail).toContain('patches that don\'t match');
    });
  });

  describe('patches array completions', () => {
    test('suggests "- op" on line starting with dash', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  - `;
      const doc = createDocument(content);
      const position = createPosition(5, 4);

      const completions = provider.provideCompletions(doc, position);
      const opItem = completions.find(c => c.label === '- op');

      expect(opItem).toBeDefined();
      expect(opItem?.insertText).toBe('- op: ');
      expect(opItem?.kind).toBe(CompletionItemKind.Snippet);
    });

    test('suggests "- op" for new patch after existing patch', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  - op: replace
    old: foo
    new: bar
  - `;
      const doc = createDocument(content);
      const position = createPosition(8, 4);

      const completions = provider.provideCompletions(doc, position);
      const opItem = completions.find(c => c.label === '- op');

      expect(opItem).toBeDefined();
    });
  });

  describe('patch object field completions', () => {
    test('provides patch fields inside patch object on new line', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
    `;
      const doc = createDocument(content);
      const position = createPosition(9, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('op');
      expect(labels).toContain('id');
      expect(labels).toContain('extends');
      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
      expect(labels).toContain('onNoMatch');
      expect(labels).toContain('group');
      expect(labels).toContain('validate');
    });

    test('includes correct insertText for common patch fields', () => {
      const content = `patches:
  -
    op: replace
    old: foo
    new: bar
    `;
      const doc = createDocument(content);
      const position = createPosition(5, 4);

      const completions = provider.provideCompletions(doc, position);

      const include = completions.find(c => c.label === 'include');
      expect(include?.insertText).toBe('include: ');

      const exclude = completions.find(c => c.label === 'exclude');
      expect(exclude?.insertText).toBe('exclude: ');

      const id = completions.find(c => c.label === 'id');
      expect(id?.insertText).toBe('id: ');

      const group = completions.find(c => c.label === 'group');
      expect(group?.insertText).toBe('group: ');
    });

    test('provides validate field with nested structure', () => {
      const content = `patches:
  -
    op: replace
    old: foo
    new: bar
    `;
      const doc = createDocument(content);
      const position = createPosition(5, 4);

      const completions = provider.provideCompletions(doc, position);
      const validate = completions.find(c => c.label === 'validate');

      expect(validate).toBeDefined();
      expect(validate?.insertText).toContain('validate:');
      expect(validate?.insertText).toContain('notContains');
    });

    test('provides extends field for patch inheritance', () => {
      const content = `patches:
  -
    op: replace
    id: base-patch
    old: foo
    new: bar
  -
    op: replace
    old: test
    new: example
    `;
      const doc = createDocument(content);
      const position = createPosition(10, 4);

      const completions = provider.provideCompletions(doc, position);
      const extendsField = completions.find(c => c.label === 'extends');

      expect(extendsField).toBeDefined();
      expect(extendsField?.detail).toContain('Inherit');
      expect(extendsField?.documentation).toContain('extend from');
    });
  });

  describe('patch operation completions', () => {
    test('provides all patch operations when completing op field', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      // Core operations
      expect(labels).toContain('replace');
      expect(labels).toContain('replace-regex');
      expect(labels).toContain('remove-section');
      expect(labels).toContain('replace-section');
      expect(labels).toContain('prepend-to-section');
      expect(labels).toContain('append-to-section');
      expect(labels).toContain('set-frontmatter');
      expect(labels).toContain('remove-frontmatter');
      expect(labels).toContain('rename-frontmatter');
      expect(labels).toContain('merge-frontmatter');
      expect(labels).toContain('delete-between');
      expect(labels).toContain('replace-between');
      expect(labels).toContain('replace-line');
      expect(labels).toContain('insert-after-line');
      expect(labels).toContain('insert-before-line');
      expect(labels).toContain('move-section');
      expect(labels).toContain('rename-header');
      expect(labels).toContain('change-section-level');
      // File operations
      expect(labels).toContain('copy-file');
      expect(labels).toContain('rename-file');
      expect(labels).toContain('delete-file');
      expect(labels).toContain('move-file');
      // List operations
      expect(labels).toContain('add-list-item');
      expect(labels).toContain('remove-list-item');
      expect(labels).toContain('set-list-item');
      expect(labels).toContain('sort-list');
      expect(labels).toContain('filter-list-items');
      expect(labels).toContain('deduplicate-list-items');
      expect(labels).toContain('reorder-list-items');

      expect(labels).toHaveLength(29);
    });

    test('provides operations with partial input', () => {
      const content = `patches:
  -
    op: rep`;
      const doc = createDocument(content);
      const position = createPosition(2, 11);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      // Should still provide all operations for client-side filtering
      expect(labels).toContain('replace');
      expect(labels).toContain('replace-regex');
      expect(labels).toContain('replace-section');
      expect(labels).toContain('replace-between');
      expect(labels).toContain('replace-line');
    });

    test('includes documentation for replace operation', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);
      const replace = completions.find(c => c.label === 'replace');

      expect(replace).toBeDefined();
      expect(replace?.detail).toBe('Simple string replacement');
      expect(replace?.documentation).toContain('Replace old string with new string');
      expect(replace?.kind).toBe(CompletionItemKind.Value);
    });

    test('includes documentation for replace-regex operation', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);
      const replaceRegex = completions.find(c => c.label === 'replace-regex');

      expect(replaceRegex).toBeDefined();
      expect(replaceRegex?.detail).toBe('Regex-based replacement');
      expect(replaceRegex?.documentation).toContain('regular expressions');
    });

    test('includes documentation for section operations', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);

      const removeSection = completions.find(c => c.label === 'remove-section');
      expect(removeSection?.documentation).toContain('Remove a section by ID');

      const replaceSection = completions.find(c => c.label === 'replace-section');
      expect(replaceSection?.documentation).toContain('Replace entire section content');

      const prependToSection = completions.find(c => c.label === 'prepend-to-section');
      expect(prependToSection?.documentation).toContain('beginning of a section');

      const appendToSection = completions.find(c => c.label === 'append-to-section');
      expect(appendToSection?.documentation).toContain('end of a section');
    });

    test('includes documentation for frontmatter operations', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);

      const setFrontmatter = completions.find(c => c.label === 'set-frontmatter');
      expect(setFrontmatter?.documentation).toContain('Set or update a frontmatter field');

      const removeFrontmatter = completions.find(c => c.label === 'remove-frontmatter');
      expect(removeFrontmatter?.documentation).toContain('Remove a field from frontmatter');

      const renameFrontmatter = completions.find(c => c.label === 'rename-frontmatter');
      expect(renameFrontmatter?.documentation).toContain('Rename a frontmatter field');

      const mergeFrontmatter = completions.find(c => c.label === 'merge-frontmatter');
      expect(mergeFrontmatter?.documentation).toContain('Merge multiple key-value pairs');
    });

    test('includes documentation for line operations', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);

      const replaceLine = completions.find(c => c.label === 'replace-line');
      expect(replaceLine?.documentation).toContain('Replace entire lines');

      const insertAfterLine = completions.find(c => c.label === 'insert-after-line');
      expect(insertAfterLine?.documentation).toContain('Insert content after a matching line');

      const insertBeforeLine = completions.find(c => c.label === 'insert-before-line');
      expect(insertBeforeLine?.documentation).toContain('Insert content before a matching line');
    });

    test('includes documentation for advanced operations', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);

      const moveSection = completions.find(c => c.label === 'move-section');
      expect(moveSection?.documentation).toContain('Move a section to after another section');

      const renameHeader = completions.find(c => c.label === 'rename-header');
      expect(renameHeader?.documentation).toContain('Rename a section header');

      const changeSectionLevel = completions.find(c => c.label === 'change-section-level');
      expect(changeSectionLevel?.documentation).toContain('Change the heading level');
      expect(changeSectionLevel?.documentation).toContain('promote/demote');
    });

    test('includes documentation for delete and replace between operations', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);

      const deleteBetween = completions.find(c => c.label === 'delete-between');
      expect(deleteBetween?.documentation).toContain('Delete content between start and end markers');

      const replaceBetween = completions.find(c => c.label === 'replace-between');
      expect(replaceBetween?.documentation).toContain('Replace content between start and end markers');
    });
  });

  describe('onNoMatch value completions', () => {
    test('provides onNoMatch values at patch level', () => {
      const content = `patches:
  - op: replace
    old: foo
    new: bar
    onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(4, 14);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toEqual(['error', 'skip', 'warn']);
    });

    test('provides onNoMatch values at root level', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(4, 10);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toEqual(['error', 'skip', 'warn']);
    });

    test('includes documentation for skip value', () => {
      const content = `patches:
  - op: replace
    onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(2, 14);

      const completions = provider.provideCompletions(doc, position);
      const skip = completions.find(c => c.label === 'skip');

      expect(skip).toBeDefined();
      expect(skip?.detail).toBe('Skip silently');
      expect(skip?.documentation).toContain('without any notification');
      expect(skip?.kind).toBe(CompletionItemKind.Value);
    });

    test('includes documentation for warn value', () => {
      const content = `patches:
  - op: replace
    onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(2, 14);

      const completions = provider.provideCompletions(doc, position);
      const warn = completions.find(c => c.label === 'warn');

      expect(warn).toBeDefined();
      expect(warn?.detail).toBe('Warn on no match');
      expect(warn?.documentation).toContain('Show a warning');
    });

    test('includes documentation for error value', () => {
      const content = `patches:
  - op: replace
    onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(2, 14);

      const completions = provider.provideCompletions(doc, position);
      const error = completions.find(c => c.label === 'error');

      expect(error).toBeDefined();
      expect(error?.detail).toBe('Error on no match');
      expect(error?.documentation).toContain('Fail the build');
    });

    test('provides onNoMatch values with partial input', () => {
      const content = `patches:
  - op: replace
    onNoMatch: w`;
      const doc = createDocument(content);
      const position = createPosition(2, 16);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      // Should still provide all values for client-side filtering
      expect(labels).toContain('warn');
      expect(labels).toContain('skip');
      expect(labels).toContain('error');
    });
  });

  describe('context detection edge cases', () => {
    test('detects root context in empty document', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);

      expect(completions.length).toBeGreaterThan(0);
      expect(getLabels(completions)).toContain('apiVersion');
    });

    test('detects patch context with complex indentation', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
    include: "*.md"
  -
    op: replace-regex
    pattern: test
    replacement: example
    flags: gi
    `;
      const doc = createDocument(content);
      const position = createPosition(16, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
      expect(labels).toContain('onNoMatch');
    });

    test('handles position at end of line with op field', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('replace');
      expect(labels.length).toBe(29); // All operations (22 original + 7 list operations)
    });

    test('handles position at end of line with onNoMatch field', () => {
      const content = `patches:
  -
    op: replace
    onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(3, 14);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toEqual(['error', 'skip', 'warn']);
    });

    test('detects root context after patches block', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
`;
      const doc = createDocument(content);
      const position = createPosition(10, 0);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('validators');
      expect(labels).toContain('onNoMatch');
      expect(labels).toContain('output');
    });

    test('handles deeply nested patch structure', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
    validate:
      notContains:
        - error
        - warning
  -
    op: replace-regex
    pattern: test
    `;
      const doc = createDocument(content);
      const position = createPosition(17, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('pattern');
      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
    });

    test('handles cursor in middle of word', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  -
    op: rep`;
      const doc = createDocument(content);
      const position = createPosition(7, 11);

      const completions = provider.provideCompletions(doc, position);

      // Should still provide completions for client filtering
      expect(completions.length).toBe(29);
    });

    test('returns empty array for unknown context', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
  - docs/**/*.md
    `;
      const doc = createDocument(content);
      const position = createPosition(5, 4);

      const completions = provider.provideCompletions(doc, position);

      // In resources array, we don't provide completions
      expect(completions).toEqual([]);
    });
  });

  describe('position-based completion triggering', () => {
    test('triggers completions at line start', () => {
      const content = `apiVersion: "kustomark/v1"
`;
      const doc = createDocument(content);
      const position = createPosition(1, 0);

      const completions = provider.provideCompletions(doc, position);

      expect(completions.length).toBeGreaterThan(0);
    });

    test('triggers completions after colon and space', () => {
      const content = `patches:
  - op: `;
      const doc = createDocument(content);
      const position = createPosition(1, 8);

      const completions = provider.provideCompletions(doc, position);

      expect(completions.length).toBe(29);
    });

    test('triggers completions mid-line with indentation', () => {
      const content = `patches:
  - op: replace
    `;
      const doc = createDocument(content);
      const position = createPosition(2, 4);

      const completions = provider.provideCompletions(doc, position);

      expect(completions.length).toBeGreaterThan(0);
      expect(getLabels(completions)).toContain('include');
    });

    test('handles completion at various character positions', () => {
      const content = `patches:
  - op: replace`;

      // Test at different character positions
      for (let char = 8; char <= 15; char++) {
        const doc = createDocument(content);
        const position = createPosition(1, char);
        const completions = provider.provideCompletions(doc, position);

        // Should get operation completions (29 total: 22 original + 7 list operations)
        expect(completions.length).toBe(29);
      }
    });
  });

  describe('realistic YAML scenarios', () => {
    test('completes in minimal valid config', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
`;
      const doc = createDocument(content);
      const position = createPosition(4, 0);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('patches');
      expect(labels).toContain('validators');
      expect(labels).toContain('onNoMatch');
    });

    test('completes in config with multiple patches', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "**/*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
    include: "README.md"
  -
    op: replace-regex
    pattern: "test (\\w+)"
    replacement: "example $1"
    flags: gi
  -
    op: remove-section
    id: deprecated
    onNoMatch: skip
    `;
      const doc = createDocument(content);
      const position = createPosition(20, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
      expect(labels).toContain('group');
    });

    test('completes in config with validators', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "**/*.md"
validators:
  - name: no-todos
    notContains:
      - TODO
      - FIXME
`;
      const doc = createDocument(content);
      const position = createPosition(9, 0);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('patches');
      expect(labels).toContain('onNoMatch');
    });

    test('completes with output directory specified', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
output: dist/
resources:
  - "src/**/*.md"
patches:
  - `;
      const doc = createDocument(content);
      const position = createPosition(6, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('- op');
    });

    test('completes in config with patch inheritance', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "**/*.md"
patches:
  -
    id: base-replacement
    op: replace
    old: foo
    new: bar
  -
    extends: base-replacement
    old: test
    new: example
    `;
      const doc = createDocument(content);
      const position = createPosition(15, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
      expect(labels).toContain('op');
    });

    test('completes in config with groups', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "**/*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
    group: formatting
  -
    op: replace-regex
    pattern: test
    replacement: example
    group: content
    flags: gi
    `;
      const doc = createDocument(content);
      const position = createPosition(17, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
      expect(labels).toContain('onNoMatch');
    });

    test('completes in config with validation rules', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "**/*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
    validate:
      notContains:
        - error
        - warning
  -
    op: replace-regex
    pattern: test
    replacement: example
    `;
      const doc = createDocument(content);
      const position = createPosition(18, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('pattern');
      expect(labels).toContain('replacement');
      expect(labels).toContain('validate');
    });
  });

  describe('resolveCompletion', () => {
    test('returns completion item unchanged', () => {
      const item = {
        label: 'replace',
        kind: CompletionItemKind.Value,
        detail: 'Simple string replacement',
        documentation: 'Replace old string with new string',
        insertText: 'replace',
      };

      const resolved = provider.resolveCompletion(item);

      expect(resolved).toEqual(item);
    });

    test('preserves all properties of completion item', () => {
      const item = {
        label: 'apiVersion',
        kind: CompletionItemKind.Field,
        detail: 'API version (required)',
        documentation: 'Must be "kustomark/v1"',
        insertText: 'apiVersion: "kustomark/v1"',
        sortText: '0',
        filterText: 'apiVersion',
      };

      const resolved = provider.resolveCompletion(item);

      expect(resolved).toEqual(item);
      expect(resolved.sortText).toBe('0');
      expect(resolved.filterText).toBe('apiVersion');
    });
  });

  describe('error handling and edge cases', () => {
    test('handles document with only whitespace', () => {
      const content = '   \n  \n   ';
      const doc = createDocument(content);
      const position = createPosition(1, 2);

      const completions = provider.provideCompletions(doc, position);

      // Should provide root completions
      expect(getLabels(completions)).toContain('apiVersion');
    });

    test('handles document with comments', () => {
      const content = `# This is a comment
apiVersion: "kustomark/v1"
# Another comment
kind: "Kustomization"
resources:
  - "*.md"
# Comment before patches
patches:
  # Inline comment
  -
    op: replace
    old: foo
    new: bar
    `;
      const doc = createDocument(content);
      const position = createPosition(14, 4);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toContain('new');
      expect(labels).toContain('include');
      expect(labels).toContain('exclude');
    });

    test('handles malformed YAML gracefully', () => {
      const content = `apiVersion: "kustomark/v1"
kind: Kustomization
resources:
  - "*.md"
patches:
  -
    op: replace
    old: foo
    new: bar
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(10, 7);

      const completions = provider.provideCompletions(doc, position);

      // Should still provide operation completions
      expect(completions.length).toBe(29);
    });

    test('handles cursor at document end', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:
  - op: replace
    old: foo
    new: bar`;
      const doc = createDocument(content);
      const lastLine = content.split('\n').length - 1;
      const lastChar = content.split('\n')[lastLine]?.length || 0;
      const position = createPosition(lastLine, lastChar);

      const completions = provider.provideCompletions(doc, position);

      // At end of patch object line with value, should still get field completions
      expect(completions).toBeDefined();
    });

    test('handles position beyond document bounds gracefully', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"`;
      const doc = createDocument(content);
      const position = createPosition(100, 0);

      // Should not crash
      expect(() => {
        provider.provideCompletions(doc, position);
      }).not.toThrow();
    });

    test('handles empty patches array', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
patches:`;
      const doc = createDocument(content);
      const position = createPosition(4, 8);

      const completions = provider.provideCompletions(doc, position);

      // Should provide array item completion or no completions
      expect(completions).toBeDefined();
    });

    test('handles multiple root-level onNoMatch fields', () => {
      const content = `apiVersion: "kustomark/v1"
kind: "Kustomization"
resources:
  - "*.md"
onNoMatch: warn
patches:
  - op: replace
    old: foo
    new: bar
onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(9, 10);

      const completions = provider.provideCompletions(doc, position);
      const labels = getLabels(completions);

      expect(labels).toEqual(['error', 'skip', 'warn']);
    });
  });

  describe('all patch operations comprehensive test', () => {
    const allOperations = [
      'replace',
      'replace-regex',
      'remove-section',
      'replace-section',
      'prepend-to-section',
      'append-to-section',
      'set-frontmatter',
      'remove-frontmatter',
      'rename-frontmatter',
      'merge-frontmatter',
      'delete-between',
      'replace-between',
      'replace-line',
      'insert-after-line',
      'insert-before-line',
      'move-section',
      'rename-header',
      'change-section-level',
      'copy-file',
      'rename-file',
      'delete-file',
      'move-file',
    ];

    test('all operations are present exactly once', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);
      const labels = completions.map(c => c.label);

      for (const op of allOperations) {
        const count = labels.filter(l => l === op).length;
        expect(count).toBe(1);
      }
    });

    test('all operations have proper metadata', () => {
      const content = `patches:
  -
    op:`;
      const doc = createDocument(content);
      const position = createPosition(2, 7);

      const completions = provider.provideCompletions(doc, position);

      for (const op of allOperations) {
        const completion = completions.find(c => c.label === op);
        expect(completion).toBeDefined();
        expect(completion?.kind).toBe(CompletionItemKind.Value);
        expect(completion?.detail).toBeDefined();
        expect(completion?.detail?.length).toBeGreaterThan(0);
        expect(completion?.documentation).toBeDefined();
        expect(typeof completion?.documentation).toBe('string');
        expect(completion?.insertText).toBe(op);
      }
    });
  });

  describe('field completion documentation', () => {
    test('all root fields have documentation', () => {
      const content = '';
      const doc = createDocument(content);
      const position = createPosition(0, 0);

      const completions = provider.provideCompletions(doc, position);
      const rootFields = ['apiVersion', 'kind', 'output', 'resources', 'patches', 'validators', 'onNoMatch'];

      for (const field of rootFields) {
        const completion = completions.find(c => c.label === field);
        expect(completion).toBeDefined();
        expect(completion?.detail).toBeDefined();
        expect(completion?.documentation).toBeDefined();
      }
    });

    test('all patch fields have documentation', () => {
      const content = `patches:
  -
    op: replace
    old: foo
    new: bar
    `;
      const doc = createDocument(content);
      const position = createPosition(6, 4);

      const completions = provider.provideCompletions(doc, position);
      const patchFields = ['op', 'id', 'extends', 'include', 'exclude', 'onNoMatch', 'group', 'validate'];

      for (const field of patchFields) {
        const completion = completions.find(c => c.label === field);
        expect(completion).toBeDefined();
        expect(completion?.detail).toBeDefined();
        expect(completion?.documentation).toBeDefined();
      }
    });

    test('all onNoMatch values have documentation', () => {
      const content = `onNoMatch:`;
      const doc = createDocument(content);
      const position = createPosition(0, 10);

      const completions = provider.provideCompletions(doc, position);
      const values = ['skip', 'warn', 'error'];

      for (const value of values) {
        const completion = completions.find(c => c.label === value);
        expect(completion).toBeDefined();
        expect(completion?.detail).toBeDefined();
        expect(completion?.documentation).toBeDefined();
      }
    });
  });
});
