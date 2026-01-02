/**
 * Tests for the LSP Diagnostics Provider
 */

import { describe, expect, test } from 'bun:test';
import { DiagnosticsProvider } from '../../src/lsp/diagnostics.js';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('DiagnosticsProvider', () => {
  const provider = new DiagnosticsProvider();

  describe('valid configurations', () => {
    test('returns no diagnostics for valid minimal config', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(0);
    });

    test('returns no diagnostics for valid config with patches', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(0);
    });

    test('returns no diagnostics for valid config with all fields', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
output: dist/
resources:
  - docs/**/*.md
  - README.md
onNoMatch: warn
patches:
  - op: replace
    old: foo
    new: bar
  - op: replace-regex
    pattern: 'test (\\w+)'
    replacement: 'example $1'
    flags: gi`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('missing required fields', () => {
    test('reports error for missing apiVersion', () => {
      const content = `kind: Kustomization
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('apiVersion is required');
      expect(diagnostics[0]?.source).toBe('kustomark');
    });

    test('reports error for missing kind', () => {
      const content = `apiVersion: kustomark/v1
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('kind is required');
      expect(diagnostics[0]?.source).toBe('kustomark');
    });

    test('reports error for missing resources', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('resources is required');
      expect(diagnostics[0]?.source).toBe('kustomark');
    });

    test('reports multiple errors for missing multiple required fields', () => {
      const content = `output: dist/`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      const messages = diagnostics.map(d => d.message);
      expect(messages).toContain('apiVersion is required');
      expect(messages).toContain('kind is required');
      expect(messages).toContain('resources is required');
    });
  });

  describe('invalid field values', () => {
    test('reports error for wrong apiVersion', () => {
      const content = `apiVersion: v2
kind: Kustomization
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('apiVersion must be "kustomark/v1"');
      expect(diagnostics[0]?.message).toContain('v2');
    });

    test('reports error for wrong kind', () => {
      const content = `apiVersion: kustomark/v1
kind: CustomResource
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('kind must be "Kustomization"');
      expect(diagnostics[0]?.message).toContain('CustomResource');
    });

    test('reports error for non-array resources', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources: not-an-array`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('resources must be an array');
    });

    test('reports error for empty resources array', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources: []`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('resources array cannot be empty');
    });

    test('reports error for invalid onNoMatch strategy', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
onNoMatch: invalid`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('onNoMatch must be one of: skip, warn, error');
      expect(diagnostics[0]?.message).toContain('invalid');
    });

    test('reports error for non-string output', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
output: 123
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('output must be a string');
    });
  });

  describe('invalid YAML syntax', () => {
    test('reports error for malformed YAML', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources: [unclosed`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('YAML parsing error');
    });

    test('reports error for invalid YAML syntax', () => {
      const content = `{invalid: yaml: syntax:}`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('YAML parsing error');
    });

    test('reports error for unclosed quotes', () => {
      const content = `apiVersion: "kustomark/v1
kind: Kustomization`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('YAML parsing error');
    });

    test('reports error for invalid tab characters', () => {
      const content = "apiVersion: kustomark/v1\n\tkind: Kustomization";

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('YAML parsing error');
    });

    test('sets position from YAML error mark when available', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - item1
  - item2: [unclosed`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.range).toBeDefined();
      expect(diagnostics[0]?.range.start.line).toBeGreaterThanOrEqual(0);
    });
  });

  describe('invalid patch operations', () => {
    test('reports error for missing op field', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - old: foo
    new: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('patch operation (op) is required');
    });

    test('reports error for invalid op value', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: invalid-operation
    old: foo
    new: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('Invalid operation "invalid-operation"');
    });

    test('reports error for replace without old field', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    new: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("replace operation requires 'old' field");
    });

    test('reports error for replace without new field', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("replace operation requires 'new' field");
    });

    test('reports error for replace-regex without pattern', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace-regex
    replacement: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("replace-regex operation requires 'pattern' field");
    });

    test('reports error for replace-regex with invalid regex pattern', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace-regex
    pattern: '[unclosed'
    replacement: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('Invalid regex pattern');
    });

    test('reports error for remove-section without id', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: remove-section`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("remove-section operation requires 'id' field");
    });

    test('reports error for replace-section without content', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace-section
    id: section-id`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("replace-section operation requires 'content' field");
    });

    test('reports error for non-array patches', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches: not-an-array`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('patches must be an array');
    });

    test('reports error for non-object patch', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - just-a-string`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('patch must be an object');
    });
  });

  describe('patch inheritance validation', () => {
    test('reports error for duplicate patch IDs', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: my-patch
    old: foo
    new: bar
  - op: replace
    id: my-patch
    old: baz
    new: qux`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('duplicate patch id "my-patch"');
    });

    test('reports error for extending non-existent patch ID', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: base-patch
    old: foo
    new: bar
  - op: replace
    extends: non-existent
    old: baz
    new: qux`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('extends non-existent id "non-existent"');
    });

    test('reports error for forward references in extends', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: patch-1
    extends: patch-2
    old: foo
    new: bar
  - op: replace
    id: patch-2
    old: baz
    new: qux`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('defined later');
      expect(diagnostics[0]?.message).toContain('forward references not allowed');
    });

    test('reports error for circular inheritance', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: patch-1
    extends: patch-3
    old: a
    new: b
  - op: replace
    id: patch-2
    extends: patch-1
    old: c
    new: d
  - op: replace
    id: patch-3
    extends: patch-2
    old: e
    new: f`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      const circularErrors = diagnostics.filter(d => d.message.includes('circular'));
      expect(circularErrors.length).toBeGreaterThan(0);
    });

    test('reports error for invalid patch ID format', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: 'invalid id with spaces'
    old: foo
    new: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('contains invalid characters');
    });

    test('reports error for empty patch ID', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    id: ''
    old: foo
    new: bar`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('id cannot be empty');
    });
  });

  describe('conditional patches validation', () => {
    test('reports error for invalid condition type', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: invalidType`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('Invalid condition type');
    });

    test('reports error for fileContains without value', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: fileContains`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("fileContains condition requires 'value' field");
    });

    test('reports error for fileMatches without pattern', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: fileMatches`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("fileMatches condition requires 'pattern' field");
    });

    test('reports error for fileMatches with invalid regex', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: fileMatches
      pattern: '[unclosed'`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('Invalid regex pattern');
    });

    test('reports error for frontmatterEquals without key', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: frontmatterEquals
      value: something`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("frontmatterEquals condition requires 'key' field");
    });

    test('reports error for anyOf with empty conditions array', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: anyOf
      conditions: []`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain("'conditions' array cannot be empty");
    });
  });

  describe('watch hooks validation', () => {
    test('reports error for non-object watch config', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
watch: not-an-object`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('watch must be an object');
    });

    test('reports error for non-array onBuild', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
watch:
  onBuild: not-an-array`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('onBuild must be an array');
    });

    test('reports error for non-string hook command', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
watch:
  onBuild:
    - echo "valid"
    - 123`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('hook command must be a string');
    });
  });

  describe('warning generation', () => {
    test('does not generate warnings for valid git URL resources', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - github.com/org/repo//path?ref=main`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      // Git URLs are fully supported, should not generate warnings
      const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
      expect(warnings).toHaveLength(0);
    });

    test('does not generate warnings for valid local resources', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  - README.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('diagnostic positions', () => {
    test('sets correct line for apiVersion error', () => {
      const content = `kind: Kustomization
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics[0]?.range).toBeDefined();
      expect(diagnostics[0]?.range.start.line).toBe(0);
      expect(diagnostics[0]?.range.start.character).toBe(0);
    });

    test('sets correct line for kind field error', () => {
      const content = `apiVersion: kustomark/v1
kind: WrongKind
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics[0]?.range).toBeDefined();
      expect(diagnostics[0]?.range.start.line).toBe(1);
    });

    test('sets correct line for resources field error', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - item1
  - 123`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      // Find the error about non-string/object resource
      const resourceError = diagnostics.find(d => d.message.includes('resource must be a string or an object'));
      expect(resourceError).toBeDefined();
      expect(resourceError?.range.start.line).toBeGreaterThanOrEqual(3);
    });

    test('sets correct line for patch error', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: invalid-op`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      const patchError = diagnostics.find(d => d.message.includes('Invalid operation'));
      expect(patchError).toBeDefined();
      expect(patchError?.range.start.line).toBeGreaterThanOrEqual(5);
    });

    test('includes field in range for simple fields', () => {
      const content = `apiVersion: wrong
kind: Kustomization
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics[0]?.range.start.character).toBeGreaterThanOrEqual(0);
      expect(diagnostics[0]?.range.end.character).toBeGreaterThan(diagnostics[0]?.range.start.character);
    });

    test('handles array index in field path', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
  - op: replace
    old: missing`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      const newFieldError = diagnostics.find(d => d.message.includes("requires 'new' field"));
      expect(newFieldError).toBeDefined();
      // Should point to the second patch
      expect(newFieldError?.range.start.line).toBeGreaterThanOrEqual(8);
    });
  });

  describe('severity levels', () => {
    test('uses Error severity for missing required fields', () => {
      const content = `kind: Kustomization`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics.every(d => d.severity === DiagnosticSeverity.Error)).toBe(true);
    });

    test('uses Error severity for invalid values', () => {
      const content = `apiVersion: wrong
kind: Kustomization
resources:
  - docs/**/*.md`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    test('uses Error severity for YAML syntax errors', () => {
      const content = `invalid: yaml: syntax:`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    test('uses Error severity for invalid resource patterns', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - 123`;  // Invalid resource format

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('patch group validation', () => {
    test('reports error for invalid group name format', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    group: "invalid group name"`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('must contain only alphanumeric characters');
    });

    test('reports error for empty group name', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    group: ""`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('cannot be an empty string');
    });

    test('accepts valid group names', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    group: valid-group_123`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('resource validation', () => {
    test('reports error for non-string resource', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
  - 123`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0]?.message).toContain('resource must be a string or an object');
    });

    test('reports error for invalid git URL format', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - git::invalid-git-url-format`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      // Should have an error for invalid git URL
      const gitErrors = diagnostics.filter(d => d.message.includes('Invalid git URL'));
      expect(gitErrors.length).toBeGreaterThan(0);
    });
  });

  describe('source attribution', () => {
    test('all diagnostics have kustomark as source', () => {
      const content = `apiVersion: wrong
kind: wrong
resources: []`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.every(d => d.source === 'kustomark')).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles empty file content', () => {
      const content = '';

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    test('handles whitespace-only content', () => {
      const content = '   \n  \n  ';

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    test('handles YAML null', () => {
      const content = 'null';

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.message).toContain('Config must be a YAML object');
    });

    test('handles very long files with multiple errors', () => {
      const content = `apiVersion: wrong
kind: wrong
resources: []
patches:
  - op: invalid
  - op: replace
  - op: replace-regex
  - op: remove-section
  - op: replace-section`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      // Should catch multiple errors
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    test('handles nested patch errors correctly', () => {
      const content = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
patches:
  - op: replace
    old: foo
    new: bar
    when:
      type: anyOf
      conditions:
        - type: fileContains
        - type: fileMatches`;

      const diagnostics = provider.provideDiagnostics('test.yaml', content);

      // Should have errors for missing fields in nested conditions
      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });
});
