/**
 * Tests for LSP Document Symbols Provider
 *
 * Tests the document symbols extraction for kustomark.yaml files,
 * which provides outline/navigation support in IDEs.
 */

import { describe, expect, test } from 'bun:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentSymbol } from 'vscode-languageserver';
import { DocumentSymbolsProvider } from '../../src/lsp/document-symbols.js';

/**
 * Helper to create a TextDocument from YAML content
 */
function createDocument(content: string): TextDocument {
  return TextDocument.create(
    'file:///test/kustomark.yaml',
    'yaml',
    1,
    content
  );
}

/**
 * Helper to find a symbol by name in a flat list or hierarchy
 */
function findSymbol(symbols: DocumentSymbol[], name: string): DocumentSymbol | undefined {
  for (const symbol of symbols) {
    if (symbol.name === name) {
      return symbol;
    }
    if (symbol.children) {
      const found = findSymbol(symbol.children, name);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

describe('DocumentSymbolsProvider', () => {
  const provider = new DocumentSymbolsProvider();

  describe('root config structure', () => {
    test('extracts apiVersion field', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const apiVersionSymbol = findSymbol(symbols, 'apiVersion: kustomark/v1');
      expect(apiVersionSymbol).toBeDefined();
      expect(apiVersionSymbol?.kind).toBe(7); // Property
      expect(apiVersionSymbol?.range.start.line).toBe(0);
    });

    test('extracts kind field', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const kindSymbol = findSymbol(symbols, 'kind: Kustomization');
      expect(kindSymbol).toBeDefined();
      expect(kindSymbol?.kind).toBe(7); // Property
      expect(kindSymbol?.range.start.line).toBe(1);
    });

    test('extracts output field', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
output: dist/
resources:
  - docs/**/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const outputSymbol = findSymbol(symbols, 'output: dist/');
      expect(outputSymbol).toBeDefined();
      expect(outputSymbol?.kind).toBe(7); // Property
    });

    test('extracts all root fields in correct order', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
output: dist/
resources:
  - docs/**/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      // Should have apiVersion, kind, output, and resources
      expect(symbols.length).toBeGreaterThanOrEqual(4);

      const symbolNames = symbols.map(s => s.name);
      expect(symbolNames).toContain('apiVersion: kustomark/v1');
      expect(symbolNames).toContain('kind: Kustomization');
      expect(symbolNames).toContain('output: dist/');
    });
  });

  describe('resources array', () => {
    test('extracts resources as array symbol', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  - README.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (2)');
      expect(resourcesSymbol).toBeDefined();
      expect(resourcesSymbol?.kind).toBe(18); // Array
      expect(resourcesSymbol?.children).toBeDefined();
      expect(resourcesSymbol?.children?.length).toBe(2);
    });

    test('extracts individual resource items', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  - README.md
  - guides/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (3)');
      expect(resourcesSymbol).toBeDefined();
      expect(resourcesSymbol?.children).toBeDefined();
      expect(resourcesSymbol?.children?.length).toBe(3);

      const childNames = resourcesSymbol?.children?.map(c => c.name) || [];
      expect(childNames).toContain('docs/**/*.md');
      expect(childNames).toContain('README.md');
      expect(childNames).toContain('guides/*.md');
    });

    test('resource items have correct symbol kind', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (1)');
      const firstChild = resourcesSymbol?.children?.[0];
      expect(firstChild?.kind).toBe(15); // String
    });

    test('handles empty resources array', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources: []
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (0)');
      expect(resourcesSymbol).toBeDefined();
      expect(resourcesSymbol?.children).toBeDefined();
      expect(resourcesSymbol?.children?.length).toBe(0);
    });
  });

  describe('patches array', () => {
    test('extracts patches as array symbol', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      expect(patchesSymbol).toBeDefined();
      expect(patchesSymbol?.kind).toBe(18); // Array
      expect(patchesSymbol?.children).toBeDefined();
      expect(patchesSymbol?.children?.length).toBe(1);
    });

    test('extracts replace operation patch', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.name).toBe('replace');
      expect(patchSymbol?.kind).toBe(12); // Function
      expect(patchSymbol?.detail).toContain('foo');
    });

    test('extracts replace-regex operation patch', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace-regex
    old: 'foo.*bar'
    new: baz
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.name).toBe('replace-regex');
      expect(patchSymbol?.kind).toBe(12); // Function
    });

    test('extracts patch with id', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: remove-section
    id: introduction
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.name).toBe('remove-section (introduction)');
      expect(patchSymbol?.detail).toContain('#introduction');
    });

    test('extracts patch with group', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    group: branding
    old: foo
    new: bar
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.name).toBe('replace [branding]');
    });

    test('extracts patch with both id and group', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace-section
    id: overview
    group: content
    value: New content
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.name).toBe('replace-section (overview) [content]');
    });

    test('extracts section operation patches', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: remove-section
    id: old-section
  - op: replace-section
    id: main
    value: New content
  - op: prepend-to-section
    id: intro
    value: Prefix
  - op: append-to-section
    id: outro
    value: Suffix
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (4)');
      expect(patchesSymbol?.children?.length).toBe(4);

      const operations = patchesSymbol?.children?.map(c => c.name.split(' ')[0]) || [];
      expect(operations).toContain('remove-section');
      expect(operations).toContain('replace-section');
      expect(operations).toContain('prepend-to-section');
      expect(operations).toContain('append-to-section');
    });

    test('extracts frontmatter operation patches', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: set-frontmatter
    key: title
    value: New Title
  - op: remove-frontmatter
    key: draft
  - op: rename-frontmatter
    key: author
    newKey: authors
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (3)');
      expect(patchesSymbol?.children?.length).toBe(3);

      const firstPatch = patchesSymbol?.children?.[0];
      expect(firstPatch?.name).toBe('set-frontmatter');
      expect(firstPatch?.detail).toContain('key: title');
    });

    test('extracts patch with include filter', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    include:
      - docs/guide.md
      - docs/tutorial.md
    old: foo
    new: bar
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.detail).toContain('include: docs/guide.md, docs/tutorial.md');
    });

    test('extracts patch with exclude filter', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    exclude:
      - docs/private.md
    old: foo
    new: bar
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.detail).toContain('exclude: docs/private.md');
    });

    test('extracts multiple patches', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
  - op: remove-section
    id: deprecated
  - op: set-frontmatter
    key: version
    value: "1.0"
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (3)');
      expect(patchesSymbol?.children?.length).toBe(3);
    });

    test('truncates long old values in patch details', () => {
      const longValue = 'a'.repeat(50);
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: "${longValue}"
    new: bar
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (1)');
      const patchSymbol = patchesSymbol?.children?.[0];

      expect(patchSymbol?.detail).toBeDefined();
      expect(patchSymbol?.detail?.length).toBeLessThan(50);
      expect(patchSymbol?.detail).toContain('...');
    });
  });

  describe('validators array', () => {
    test('extracts validators as array symbol', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
validators:
  - type: schema
    schema: docs.schema.json
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const validatorsSymbol = findSymbol(symbols, 'validators (1)');
      expect(validatorsSymbol).toBeDefined();
      expect(validatorsSymbol?.kind).toBe(18); // Array
      expect(validatorsSymbol?.children).toBeDefined();
      expect(validatorsSymbol?.children?.length).toBe(1);
    });

    test('extracts validator type', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
validators:
  - type: schema
    schema: docs.schema.json
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const validatorsSymbol = findSymbol(symbols, 'validators (1)');
      const validatorSymbol = validatorsSymbol?.children?.[0];

      expect(validatorSymbol?.name).toBe('schema');
      expect(validatorSymbol?.kind).toBe(9); // Constructor
    });

    test('extracts multiple validators', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
validators:
  - type: schema
    schema: docs.schema.json
  - type: frontmatter-required
    keys:
      - title
      - author
  - type: custom
    script: validate.js
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const validatorsSymbol = findSymbol(symbols, 'validators (3)');
      expect(validatorsSymbol?.children?.length).toBe(3);

      const types = validatorsSymbol?.children?.map(c => c.name) || [];
      expect(types).toContain('schema');
      expect(types).toContain('frontmatter-required');
      expect(types).toContain('custom');
    });

    test('handles validators without type field', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
validators:
  - schema: docs.schema.json
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const validatorsSymbol = findSymbol(symbols, 'validators (1)');
      const validatorSymbol = validatorsSymbol?.children?.[0];

      expect(validatorSymbol?.name).toBe('unknown');
    });
  });

  describe('symbol ranges and hierarchy', () => {
    test('symbol ranges are valid', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      for (const symbol of symbols) {
        expect(symbol.range.start.line).toBeGreaterThanOrEqual(0);
        expect(symbol.range.end.line).toBeGreaterThanOrEqual(symbol.range.start.line);
        expect(symbol.range.start.character).toBeGreaterThanOrEqual(0);
        expect(symbol.range.end.character).toBeGreaterThanOrEqual(0);

        // selectionRange should be within range
        expect(symbol.selectionRange.start.line).toBeGreaterThanOrEqual(symbol.range.start.line);
        expect(symbol.selectionRange.end.line).toBeLessThanOrEqual(symbol.range.end.line);
      }
    });

    test('resources symbol contains all its items', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  - README.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (2)');
      expect(resourcesSymbol).toBeDefined();

      const resourcesRange = resourcesSymbol?.range;
      expect(resourcesRange?.start.line).toBe(2); // "resources:" line
      expect(resourcesRange?.end.line).toBeGreaterThan(2); // Should include array items
    });

    test('patches symbol contains all its items', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
  - op: remove-section
    id: test
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (2)');
      expect(patchesSymbol).toBeDefined();

      const patchesRange = patchesSymbol?.range;
      expect(patchesRange?.start.line).toBe(4); // "patches:" line
      expect(patchesRange?.end.line).toBeGreaterThan(4); // Should include all patches
    });

    test('array children are nested correctly', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  - README.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (2)');
      expect(resourcesSymbol?.children).toBeDefined();

      // Children should not be in the root symbols list
      const rootSymbolNames = symbols.map(s => s.name);
      expect(rootSymbolNames).not.toContain('docs/**/*.md');
      expect(rootSymbolNames).not.toContain('README.md');
    });
  });

  describe('outline view generation', () => {
    test('provides complete outline for typical config', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
output: dist/
resources:
  - docs/**/*.md
  - README.md
patches:
  - op: replace
    old: foo
    new: bar
  - op: set-frontmatter
    key: version
    value: "1.0"
validators:
  - type: schema
    schema: docs.schema.json
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      // Should have all major sections
      const symbolNames = symbols.map(s => s.name);
      expect(symbolNames).toContain('apiVersion: kustomark/v1');
      expect(symbolNames).toContain('kind: Kustomization');
      expect(symbolNames).toContain('output: dist/');
      expect(symbolNames).toContain('resources (2)');
      expect(symbolNames).toContain('patches (2)');
      expect(symbolNames).toContain('validators (1)');
    });

    test('outline is ordered correctly', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
output: dist/
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
validators:
  - type: schema
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const symbolNames = symbols.map(s => s.name);
      const apiVersionIndex = symbolNames.indexOf('apiVersion: kustomark/v1');
      const kindIndex = symbolNames.indexOf('kind: Kustomization');
      const resourcesIndex = symbolNames.findIndex(n => n.startsWith('resources'));
      const patchesIndex = symbolNames.findIndex(n => n.startsWith('patches'));

      expect(apiVersionIndex).toBeLessThan(kindIndex);
      expect(kindIndex).toBeLessThan(resourcesIndex);
      expect(resourcesIndex).toBeLessThan(patchesIndex);
    });

    test('provides navigable structure for large configs', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
  - op: replace
    old: baz
    new: qux
  - op: remove-section
    id: section1
  - op: remove-section
    id: section2
  - op: set-frontmatter
    key: title
    value: Test
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const patchesSymbol = findSymbol(symbols, 'patches (5)');
      expect(patchesSymbol?.children?.length).toBe(5);

      // Each patch should be independently navigable
      for (const patch of patchesSymbol?.children || []) {
        expect(patch.name).toBeDefined();
        expect(patch.range.start.line).toBeLessThanOrEqual(patch.range.end.line);
      }
    });
  });

  describe('empty document handling', () => {
    test('handles completely empty document', () => {
      const yaml = '';
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols).toBeDefined();
      expect(Array.isArray(symbols)).toBe(true);
      // Empty document should return empty array or basic structure
      expect(symbols.length).toBeGreaterThanOrEqual(0);
    });

    test('handles document with only whitespace', () => {
      const yaml = '   \n  \n  ';
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols).toBeDefined();
      expect(Array.isArray(symbols)).toBe(true);
    });

    test('handles document with only comments', () => {
      const yaml = `# This is a comment
# Another comment
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols).toBeDefined();
      expect(Array.isArray(symbols)).toBe(true);
    });

    test('handles minimal valid config', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBeGreaterThanOrEqual(2);
      const symbolNames = symbols.map(s => s.name);
      expect(symbolNames).toContain('apiVersion: kustomark/v1');
      expect(symbolNames).toContain('kind: Kustomization');
    });

    test('handles config with empty arrays', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources: []
patches: []
validators: []
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (0)');
      const patchesSymbol = findSymbol(symbols, 'patches (0)');
      const validatorsSymbol = findSymbol(symbols, 'validators (0)');

      expect(resourcesSymbol).toBeDefined();
      expect(patchesSymbol).toBeDefined();
      expect(validatorsSymbol).toBeDefined();
    });

    test('handles malformed YAML gracefully', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  this is not valid yaml
patches
`;
      const document = createDocument(yaml);

      // Should not throw, should fall back to basic parsing
      expect(() => provider.provideDocumentSymbols(document)).not.toThrow();

      const symbols = provider.provideDocumentSymbols(document);
      expect(symbols).toBeDefined();
      expect(Array.isArray(symbols)).toBe(true);
    });
  });

  describe('fallback basic YAML parsing', () => {
    test('falls back to basic parsing on parse error', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
invalid: [unclosed array
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      // Should still return some symbols via fallback parser
      expect(symbols).toBeDefined();
      expect(Array.isArray(symbols)).toBe(true);
    });

    test('basic parser handles simple fields', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
output: dist/
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      // Should extract basic field structure
      expect(symbols.length).toBeGreaterThan(0);
    });

    test('basic parser handles nested structures', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - item1
  - item2
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBeGreaterThan(0);
    });

    test('basic parser ignores comments', () => {
      const yaml = `# Comment at top
apiVersion: kustomark/v1
# Comment in middle
kind: Kustomization
# Comment at end
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      // Comments should not create symbols
      const symbolNames = symbols.map(s => s.name);
      expect(symbolNames.every(name => !name.includes('#'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles very long resource paths', () => {
      const longPath = 'a'.repeat(200) + '/**/*.md';
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - ${longPath}
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (1)');
      expect(resourcesSymbol?.children?.[0]?.name).toBe(longPath);
    });

    test('handles special characters in values', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "path with spaces/*.md"
  - "path-with-dashes/*.md"
  - "path_with_underscores/*.md"
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (3)');
      expect(resourcesSymbol?.children?.length).toBe(3);
    });

    test('handles unicode characters', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/日本語/*.md
  - guides/español/*.md
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      const resourcesSymbol = findSymbol(symbols, 'resources (2)');
      expect(resourcesSymbol?.children?.length).toBe(2);
    });

    test('handles deeply nested structures', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    include:
      - docs/guide.md
    old: foo
    new: bar
validators:
  - type: schema
    schema: docs.schema.json
`;
      const document = createDocument(yaml);
      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBeGreaterThan(0);
      // Should handle all nested levels without errors
      expect(() => {
        JSON.stringify(symbols); // Verify structure is serializable
      }).not.toThrow();
    });

    test('handles mixed indentation gracefully', () => {
      const yaml = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
    - README.md
`;
      const document = createDocument(yaml);

      // Should not throw even with inconsistent indentation
      expect(() => provider.provideDocumentSymbols(document)).not.toThrow();
    });
  });
});
