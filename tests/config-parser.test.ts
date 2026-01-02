/**
 * Tests for the config parser
 */

import { describe, expect, test } from 'bun:test';
import { parseConfig, validateConfig } from '../src/core/config-parser.js';
import type { KustomarkConfig } from '../src/core/types.js';

describe('parseConfig', () => {
  describe('valid YAML parsing', () => {
    test('parses valid minimal config', () => {
      const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - docs/**/*.md
`;
      const config = parseConfig(yaml);

      expect(config.apiVersion).toBe('kustomark/v1');
      expect(config.kind).toBe('Kustomization');
      expect(config.resources).toEqual(['docs/**/*.md']);
    });

    test('parses config with all fields', () => {
      const yaml = `
apiVersion: kustomark/v1
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
`;
      const config = parseConfig(yaml);

      expect(config.apiVersion).toBe('kustomark/v1');
      expect(config.kind).toBe('Kustomization');
      expect(config.output).toBe('dist/');
      expect(config.resources).toHaveLength(2);
      expect(config.onNoMatch).toBe('warn');
      expect(config.patches).toHaveLength(1);
    });

    test('parses config with multiple patches', () => {
      const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
patches:
  - op: replace
    old: foo
    new: bar
  - op: replace-regex
    pattern: 'test (\\w+)'
    replacement: 'example $1'
    flags: gi
  - op: remove-section
    id: obsolete-section
`;
      const config = parseConfig(yaml);

      expect(config.patches).toHaveLength(3);
      expect(config.patches?.[0]?.op).toBe('replace');
      expect(config.patches?.[1]?.op).toBe('replace-regex');
      expect(config.patches?.[2]?.op).toBe('remove-section');
    });
  });

  describe('invalid YAML handling', () => {
    test('throws error for malformed YAML', () => {
      const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources: [unclosed
`;
      expect(() => parseConfig(yaml)).toThrow('YAML parsing error');
    });

    test('throws error for invalid YAML syntax', () => {
      const yaml = `{invalid: yaml: syntax:}`;
      expect(() => parseConfig(yaml)).toThrow('YAML parsing error');
    });

    test('throws error for unclosed quotes', () => {
      const yaml = `
apiVersion: "kustomark/v1
kind: Kustomization
`;
      expect(() => parseConfig(yaml)).toThrow('YAML parsing error');
    });

    test('throws error for invalid tab characters', () => {
      const yaml = "apiVersion: kustomark/v1\n\tkind: Kustomization";
      expect(() => parseConfig(yaml)).toThrow('YAML parsing error');
    });
  });

  describe('empty/null handling', () => {
    test('throws error for empty string', () => {
      expect(() => parseConfig('')).toThrow('Config must be a YAML object');
    });

    test('throws error for whitespace-only string', () => {
      expect(() => parseConfig('   \n  \n  ')).toThrow('Config must be a YAML object');
    });

    test('throws error for YAML null', () => {
      expect(() => parseConfig('null')).toThrow('Config must be a YAML object');
    });

    test('throws error for YAML primitive', () => {
      expect(() => parseConfig('just a string')).toThrow('Config must be a YAML object');
    });

    test('throws error for YAML array', () => {
      const yaml = '- item1\n- item2';
      const config = parseConfig(yaml);
      // Even though parseConfig accepts it, validateConfig will fail on missing required fields
      const result = validateConfig(config as unknown as KustomarkConfig);
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateConfig', () => {
  describe('valid configs with all required fields', () => {
    test('validates minimal valid config', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['docs/**/*.md'],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('validates config with optional fields', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        output: 'dist/',
        resources: ['*.md', 'docs/**/*.md'],
        onNoMatch: 'warn',
        patches: [
          { op: 'replace', old: 'foo', new: 'bar' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates config with all onNoMatch strategies', () => {
      const strategies: Array<'skip' | 'warn' | 'error'> = ['skip', 'warn', 'error'];

      strategies.forEach(strategy => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          onNoMatch: strategy,
        };

        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('apiVersion validation', () => {
    test('fails when apiVersion is missing', () => {
      const config = {
        kind: 'Kustomization',
        resources: ['*.md'],
      } as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('apiVersion');
      expect(result.errors[0]?.message).toContain('required');
    });

    test('fails when apiVersion has wrong value', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v2',
        kind: 'Kustomization',
        resources: ['*.md'],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('apiVersion');
      expect(result.errors[0]?.message).toContain('kustomark/v1');
      expect(result.errors[0]?.message).toContain('kustomark/v2');
    });

    test('fails for empty apiVersion', () => {
      const config: KustomarkConfig = {
        apiVersion: '',
        kind: 'Kustomization',
        resources: ['*.md'],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'apiVersion')).toBe(true);
    });
  });

  describe('kind validation', () => {
    test('fails when kind is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        resources: ['*.md'],
      } as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'kind',
        message: 'kind is required',
      });
    });

    test('fails when kind has wrong value', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'WrongKind',
        resources: ['*.md'],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'kind' && e.message.includes('Kustomization')
      )).toBe(true);
    });

    test('fails for empty kind', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: '',
        resources: ['*.md'],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'kind')).toBe(true);
    });
  });

  describe('resources validation', () => {
    test('fails when resources is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
      } as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'resources',
        message: 'resources is required',
      });
    });

    test('fails when resources is not an array', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: 'not-an-array',
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'resources',
        message: 'resources must be an array',
      });
    });

    test('fails when resources is empty array', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: [],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'resources',
        message: 'resources array cannot be empty',
      });
    });

    test('fails when resource item is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['valid.md', 123, 'another.md'],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'resources[1]',
        message: 'resource must be a string',
      });
    });

    test('fails for multiple non-string resources', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: [null, 'valid.md', { path: 'invalid' }, true],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.filter(e => e.field.startsWith('resources['))).toHaveLength(3);
    });
  });

  describe('output validation', () => {
    test('fails when output is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        output: 123,
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'output',
        message: 'output must be a string',
      });
    });

    test('passes when output is a valid string', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        output: 'dist/',
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('passes when output is undefined', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('onNoMatch validation', () => {
    test('fails for invalid onNoMatch value', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        onNoMatch: 'invalid',
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'onNoMatch' && e.message.includes('skip, warn, error')
      )).toBe(true);
    });

    test('fails for numeric onNoMatch', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        onNoMatch: 1,
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'onNoMatch')).toBe(true);
    });
  });

  describe('patch validation - replace operation', () => {
    test('passes for valid replace patch', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when old field is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', new: 'bar' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].old',
        message: "replace operation requires 'old' field",
      });
    });

    test('fails when new field is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].new',
        message: "replace operation requires 'new' field",
      });
    });

    test('fails when old is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 123, new: 'bar' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].old',
        message: "'old' must be a string",
      });
    });

    test('fails when new is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 123 },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].new',
        message: "'new' must be a string",
      });
    });

    test('passes when old and new are empty strings', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: '', new: '' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('patch validation - replace-regex operation', () => {
    test('passes for valid replace-regex patch', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 'foo (\\w+)', replacement: 'bar $1', flags: 'gi' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when pattern is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', replacement: 'bar' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].pattern',
        message: "replace-regex operation requires 'pattern' field",
      });
    });

    test('fails when replacement is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 'foo' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].replacement',
        message: "replace-regex operation requires 'replacement' field",
      });
    });

    test('fails when pattern is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 123, replacement: 'bar' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].pattern',
        message: "'pattern' must be a string",
      });
    });

    test('fails when replacement is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 'foo', replacement: ['array'] },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].replacement',
        message: "'replacement' must be a string",
      });
    });

    test('fails for invalid regex pattern', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: '[invalid(regex', replacement: 'bar' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'patches[0].pattern' && e.message.includes('Invalid regex')
      )).toBe(true);
    });

    test('fails for invalid regex flags', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 'foo', replacement: 'bar', flags: 'x' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'patches[0].pattern' && e.message.includes('Invalid regex')
      )).toBe(true);
    });

    test('fails when flags is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 'foo', replacement: 'bar', flags: 123 },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].flags',
        message: "'flags' must be a string",
      });
    });

    test('passes when replacement is empty string', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-regex', pattern: 'foo', replacement: '' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('patch validation - remove-section operation', () => {
    test('passes for valid remove-section patch', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'remove-section', id: 'section-id', includeChildren: true },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when id is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'remove-section' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "remove-section operation requires 'id' field",
      });
    });

    test('fails when id is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'remove-section', id: 123 },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "'id' must be a string",
      });
    });

    test('fails when includeChildren is not a boolean', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'remove-section', id: 'section-id', includeChildren: 'yes' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].includeChildren',
        message: "'includeChildren' must be a boolean",
      });
    });

    test('passes when includeChildren is false', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'remove-section', id: 'section-id', includeChildren: false },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('patch validation - replace-section operation', () => {
    test('passes for valid replace-section patch', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-section', id: 'section-id', content: 'New content' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when id is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-section', content: 'New content' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "replace-section operation requires 'id' field",
      });
    });

    test('fails when content is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-section', id: 'section-id' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].content',
        message: "replace-section operation requires 'content' field",
      });
    });

    test('fails when id is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-section', id: 123, content: 'New content' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "'id' must be a string",
      });
    });

    test('fails when content is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-section', id: 'section-id', content: { text: 'invalid' } },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].content',
        message: "'content' must be a string",
      });
    });

    test('passes when content is empty string', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace-section', id: 'section-id', content: '' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('patch validation - prepend-to-section operation', () => {
    test('passes for valid prepend-to-section patch', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'prepend-to-section', id: 'section-id', content: 'Prepended content' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when id is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'prepend-to-section', content: 'Prepended content' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "prepend-to-section operation requires 'id' field",
      });
    });

    test('fails when content is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'prepend-to-section', id: 'section-id' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].content',
        message: "prepend-to-section operation requires 'content' field",
      });
    });

    test('fails when id is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'prepend-to-section', id: 123, content: 'Prepended content' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "'id' must be a string",
      });
    });

    test('fails when content is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'prepend-to-section', id: 'section-id', content: true },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].content',
        message: "'content' must be a string",
      });
    });
  });

  describe('patch validation - append-to-section operation', () => {
    test('passes for valid append-to-section patch', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'append-to-section', id: 'section-id', content: 'Appended content' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when id is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'append-to-section', content: 'Appended content' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "append-to-section operation requires 'id' field",
      });
    });

    test('fails when content is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'append-to-section', id: 'section-id' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].content',
        message: "append-to-section operation requires 'content' field",
      });
    });

    test('fails when id is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'append-to-section', id: { name: 'invalid' }, content: 'Appended content' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].id',
        message: "'id' must be a string",
      });
    });

    test('fails when content is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'append-to-section', id: 'section-id', content: 123 },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].content',
        message: "'content' must be a string",
      });
    });
  });

  describe('patch validation - include/exclude patterns', () => {
    test('passes for single string include pattern', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', include: 'docs/*.md' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('passes for array of include patterns', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', include: ['docs/*.md', 'README.md'] },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when include is not string or array', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', include: 123 },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].include',
        message: 'include must be a string or array of strings',
      });
    });

    test('fails when include array contains non-string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', include: ['valid.md', 123, 'another.md'] },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].include[1]',
        message: 'include pattern must be a string',
      });
    });

    test('passes for single string exclude pattern', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', exclude: 'test/*.md' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('passes for array of exclude patterns', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', exclude: ['test/*.md', 'draft.md'] },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when exclude is not string or array', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', exclude: { pattern: '*.md' } },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].exclude',
        message: 'exclude must be a string or array of strings',
      });
    });

    test('fails when exclude array contains non-string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', exclude: ['valid.md', null] },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].exclude[1]',
        message: 'exclude pattern must be a string',
      });
    });

    test('passes with both include and exclude', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          {
            op: 'replace',
            old: 'foo',
            new: 'bar',
            include: ['docs/**/*.md'],
            exclude: ['docs/draft/*.md'],
          },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('patch validation - per-patch onNoMatch', () => {
    test('passes for valid patch onNoMatch override', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        onNoMatch: 'error',
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', onNoMatch: 'skip' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails for invalid patch onNoMatch value', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', onNoMatch: 'ignore' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'patches[0].onNoMatch' && e.message.includes('skip, warn, error')
      )).toBe(true);
    });

    test('passes for all valid onNoMatch values in patches', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', onNoMatch: 'skip' },
          { op: 'replace', old: 'baz', new: 'qux', onNoMatch: 'warn' },
          { op: 'replace', old: 'test', new: 'example', onNoMatch: 'error' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('patch validation - general patch errors', () => {
    test('fails when patches is not an array', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: 'not-an-array',
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches',
        message: 'patches must be an array',
      });
    });

    test('fails when patch is not an object', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: ['string-patch', 123],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'patches[0]' && e.message === 'patch must be an object'
      )).toBe(true);
    });

    test('fails when patch op is missing', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { old: 'foo', new: 'bar' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].op',
        message: 'patch operation (op) is required',
      });
    });

    test('fails for invalid operation type', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'invalid-op', data: 'test' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.field === 'patches[0].op' && e.message.includes('Invalid operation')
      )).toBe(true);
    });

    test('accumulates errors from multiple patches', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo' }, // missing new
          { op: 'replace-regex', pattern: 'bar' }, // missing replacement
          { op: 'remove-section' }, // missing id
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('patch validation - group field', () => {
    test('passes for valid group name with alphanumeric characters', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'group123' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('passes for valid group name with hyphens', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'my-group' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('passes for valid group name with underscores', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'my_group' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('passes for valid group name with mixed alphanumeric, hyphens, and underscores', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'my-group_v2' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    test('fails when group is an empty string', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: '' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' cannot be an empty string",
      });
    });

    test('fails when group is whitespace only', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: '   ' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' cannot be an empty string",
      });
    });

    test('fails when group contains special characters', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'my-group!' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must contain only alphanumeric characters, hyphens, and underscores",
      });
    });

    test('fails when group contains spaces', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'my group' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must contain only alphanumeric characters, hyphens, and underscores",
      });
    });

    test('fails when group contains dots', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'my.group' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must contain only alphanumeric characters, hyphens, and underscores",
      });
    });

    test('fails when group is not a string', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 123 },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must be a string",
      });
    });

    test('fails when group is a boolean', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: true },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must be a string",
      });
    });

    test('fails when group is an array', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: ['group1', 'group2'] },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must be a string",
      });
    });

    test('fails when group is an object', () => {
      const config = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: { name: 'mygroup' } },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'patches[0].group',
        message: "'group' must be a string",
      });
    });

    test('passes when group field is not present', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('passes when group is undefined', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: undefined },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates group field for multiple patch types', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          { op: 'replace', old: 'foo', new: 'bar', group: 'text-replacements' },
          { op: 'replace-regex', pattern: 'test', replacement: 'example', group: 'regex-ops' },
          { op: 'remove-section', id: 'section-id', group: 'section-ops' },
          { op: 'replace-section', id: 'section-id', content: 'New content', group: 'section-ops' },
          { op: 'prepend-to-section', id: 'section-id', content: 'Prepend', group: 'section-ops' },
          { op: 'append-to-section', id: 'section-id', content: 'Append', group: 'section-ops' },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates group alongside other patch fields', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        patches: [
          {
            op: 'replace',
            old: 'foo',
            new: 'bar',
            group: 'my-group',
            include: 'docs/**/*.md',
            exclude: 'docs/draft/*.md',
            onNoMatch: 'skip',
          },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('complex validation scenarios', () => {
    test('accumulates multiple errors across different fields', () => {
      const config = {
        apiVersion: 'kustomark/v2',
        kind: 'WrongKind',
        resources: [],
        output: 123,
        onNoMatch: 'invalid',
        patches: [
          { op: 'replace' },
        ],
      } as unknown as KustomarkConfig;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
      expect(result.errors.some(e => e.field === 'apiVersion')).toBe(true);
      expect(result.errors.some(e => e.field === 'kind')).toBe(true);
      expect(result.errors.some(e => e.field === 'resources')).toBe(true);
      expect(result.errors.some(e => e.field === 'output')).toBe(true);
      expect(result.errors.some(e => e.field === 'onNoMatch')).toBe(true);
      expect(result.errors.some(e => e.field.startsWith('patches'))).toBe(true);
    });

    test('validates complex real-world config', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        output: 'dist/',
        resources: [
          'docs/**/*.md',
          'README.md',
          '../shared/common.md',
        ],
        onNoMatch: 'warn',
        patches: [
          {
            op: 'replace',
            old: 'rpi',
            new: 'thoughts',
            include: 'docs/**/*.md',
          },
          {
            op: 'replace-regex',
            pattern: '\\[\\[([^\\]]+)\\]\\]',
            replacement: '[$1]($1.md)',
            flags: 'g',
          },
          {
            op: 'remove-section',
            id: 'draft-section',
            includeChildren: true,
            exclude: 'docs/final/*.md',
          },
          {
            op: 'replace-section',
            id: 'getting-started',
            content: 'Updated getting started guide\n\nStep 1: Install\nStep 2: Configure',
            onNoMatch: 'skip',
          },
          {
            op: 'prepend-to-section',
            id: 'api-reference',
            content: '> **Warning**: This API is experimental\n',
          },
          {
            op: 'append-to-section',
            id: 'changelog',
            content: '\n## Version 2.0.0\n- New features\n- Bug fixes',
          },
        ],
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('handles missing optional fields gracefully', () => {
      const config: KustomarkConfig = {
        apiVersion: 'kustomark/v1',
        kind: 'Kustomization',
        resources: ['*.md'],
        // output, onNoMatch, and patches are all optional
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Patch Inheritance Validation', () => {
    describe('ID Validation', () => {
      test('accepts valid patch IDs', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'patch-1', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'patch_2', op: 'replace', old: 'baz', new: 'qux' },
            { id: 'PatchABC123', op: 'replace', old: 'a', new: 'b' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('rejects duplicate patch IDs', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'duplicate', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'duplicate', op: 'replace', old: 'baz', new: 'qux' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[1].id',
            message: expect.stringContaining('duplicate patch id'),
          })
        );
      });

      test('rejects invalid ID characters', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'has spaces', op: 'replace', old: 'foo', new: 'bar' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[0].id',
            message: expect.stringContaining('invalid characters'),
          })
        );
      });

      test('rejects empty patch ID', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: '', op: 'replace', old: 'foo', new: 'bar' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[0].id',
            message: expect.stringContaining('cannot be empty'),
          })
        );
      });

      test('rejects non-string patch ID', () => {
        const config = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 123, op: 'replace', old: 'foo', new: 'bar' },
          ],
        } as unknown as KustomarkConfig;

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[0].id',
            message: expect.stringContaining('must be a string'),
          })
        );
      });
    });

    describe('Extends Validation', () => {
      test('accepts valid extends reference', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'base', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'child', extends: 'base', op: 'replace', old: 'baz', new: 'qux' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('accepts multiple extends as array', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'base1', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'base2', op: 'replace', old: 'baz', new: 'qux' },
            { id: 'child', extends: ['base1', 'base2'], op: 'replace', old: 'x', new: 'y' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('rejects extends to non-existent ID', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'child', extends: 'non-existent', op: 'replace', old: 'foo', new: 'bar' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[0].extends',
            message: expect.stringContaining('non-existent id'),
          })
        );
      });

      test('rejects forward references', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'child', extends: 'parent', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'parent', op: 'replace', old: 'baz', new: 'qux' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[0].extends',
            message: expect.stringContaining('defined later'),
          })
        );
      });

      test('rejects self-reference', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'self', extends: 'self', op: 'replace', old: 'foo', new: 'bar' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        // Can get either "cannot extend itself" or "circular inheritance" error
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e =>
          e.field === 'patches[0].extends' &&
          (e.message.includes('cannot extend itself') || e.message.includes('circular'))
        )).toBe(true);
      });

      test('rejects non-string extends', () => {
        const config = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'base', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'child', extends: 123, op: 'replace' },
          ],
        } as unknown as KustomarkConfig;

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'patches[1].extends',
            message: expect.stringContaining('must be a string or array of strings'),
          })
        );
      });
    });

    describe('Circular Reference Detection', () => {
      test('detects direct circular reference (two patches)', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'patch-a', extends: 'patch-b', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'patch-b', extends: 'patch-a', op: 'replace', old: 'baz', new: 'qux' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining('circular inheritance'),
          })
        );
      });

      test('detects indirect circular reference (three patches)', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'patch-a', extends: 'patch-b', op: 'replace', old: 'foo', new: 'bar' },
            { id: 'patch-b', extends: 'patch-c', op: 'replace', old: 'baz', new: 'qux' },
            { id: 'patch-c', extends: 'patch-a', op: 'replace', old: 'x', new: 'y' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining('circular inheritance'),
          })
        );
      });

      test('allows long non-circular chains', () => {
        const config: KustomarkConfig = {
          apiVersion: 'kustomark/v1',
          kind: 'Kustomization',
          resources: ['*.md'],
          patches: [
            { id: 'level-1', op: 'replace', old: 'a', new: 'b' },
            { id: 'level-2', extends: 'level-1', op: 'replace', old: 'c', new: 'd' },
            { id: 'level-3', extends: 'level-2', op: 'replace', old: 'e', new: 'f' },
            { id: 'level-4', extends: 'level-3', op: 'replace', old: 'g', new: 'h' },
            { id: 'level-5', extends: 'level-4', op: 'replace', old: 'i', new: 'j' },
          ],
        };

        const result = validateConfig(config);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});
