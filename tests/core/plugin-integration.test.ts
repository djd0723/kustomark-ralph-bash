/**
 * Integration tests for the plugin system
 *
 * Tests end-to-end plugin functionality including:
 * - Config parsing with plugins
 * - Plugin registry creation
 * - Plugin execution via patch engine
 * - Error propagation
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseConfig } from '../../src/core/config-parser.js';
import { createPluginRegistry } from '../../src/core/plugin-loader.js';
import { createPluginContext, executePlugin } from '../../src/core/plugin-executor.js';
import { PluginNotFoundError } from '../../src/core/plugin-errors.js';

const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/plugins');

describe('Plugin Integration', () => {
	describe('config parsing with plugins', () => {
		test('parses config with plugin declarations', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "**/*.md"
plugins:
  - name: toc-generator
    source: ./plugins/toc.js
  - name: word-counter
    source: ./plugins/word-counter.js
`;
			const config = parseConfig(yaml);

			expect(config.plugins).toHaveLength(2);
			expect(config.plugins?.[0]?.name).toBe('toc-generator');
			expect(config.plugins?.[1]?.name).toBe('word-counter');
		});

		test('parses plugin with checksum', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: toc-generator
    source: ./plugins/toc.js
    checksum: sha256:abc123...
`;
			const config = parseConfig(yaml);

			expect(config.plugins?.[0]?.checksum).toBe('sha256:abc123...');
		});

		test('parses plugin with timeout override', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: slow-plugin
    source: ./plugins/slow.js
    timeout: 60000
`;
			const config = parseConfig(yaml);

			expect(config.plugins?.[0]?.timeout).toBe(60000);
		});

		test('parses plugin with version constraint', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: toc-generator
    source: kustomark-plugin-toc
    version: ^1.0.0
`;
			const config = parseConfig(yaml);

			expect(config.plugins?.[0]?.version).toBe('^1.0.0');
		});
	});

	describe('config with patches using plugins', () => {
		test('parses exec patch with plugin reference', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "**/*.md"
plugins:
  - name: toc-generator
    source: ./plugins/toc.js
patches:
  - op: exec
    plugin: toc-generator
    params:
      maxDepth: 3
`;
			const config = parseConfig(yaml);

			expect(config.patches).toHaveLength(1);
			expect(config.patches?.[0]?.op).toBe('exec');
			expect(config.patches?.[0]?.plugin).toBe('toc-generator');
			expect(config.patches?.[0]?.params?.maxDepth).toBe(3);
		});

		test('parses multiple exec patches with different plugins', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "**/*.md"
plugins:
  - name: toc-generator
    source: ./plugins/toc.js
  - name: word-counter
    source: ./plugins/counter.js
patches:
  - op: exec
    plugin: toc-generator
    params:
      maxDepth: 2
  - op: exec
    plugin: word-counter
    params:
      showChars: false
`;
			const config = parseConfig(yaml);

			expect(config.patches).toHaveLength(2);
			expect(config.patches?.[0]?.plugin).toBe('toc-generator');
			expect(config.patches?.[1]?.plugin).toBe('word-counter');
		});

		test('parses exec patch with selector', () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "**/*.md"
plugins:
  - name: toc-generator
    source: ./plugins/toc.js
patches:
  - op: exec
    plugin: toc-generator
    selector:
      files:
        - "docs/**/*.md"
`;
			const config = parseConfig(yaml);

			expect(config.patches?.[0]?.selector?.files).toEqual(['docs/**/*.md']);
		});
	});

	describe('end-to-end plugin execution', () => {
		test('loads and executes simple plugin', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
`;
			const config = parseConfig(yaml);

			// Create registry
			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);

			// Get plugin
			const loaded = registry.get('simple-plugin');
			expect(loaded).toBeTruthy();

			// Execute plugin
			const context = createPluginContext('/project/test.md', config, 'test.md');
			const result = await executePlugin(
				loaded!,
				'# Test',
				{ footer: 'Test footer' },
				context,
			);

			expect(result).toContain('# Test');
			expect(result).toContain('Test footer');
		});

		test('chains multiple plugins in sequence', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
  - name: word-counter
    source: ./word-counter.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);

			const context = createPluginContext('/project/test.md', config, 'test.md');

			// Execute first plugin
			let content = '# Test Content';
			const plugin1 = registry.get('simple-plugin')!;
			content = await executePlugin(plugin1, content, { footer: 'Footer' }, context);

			// Execute second plugin
			const plugin2 = registry.get('word-counter')!;
			content = await executePlugin(plugin2, content, {}, context);

			expect(content).toContain('# Test Content');
			expect(content).toContain('Footer');
			expect(content).toContain('Words:');
		});

		test('plugin receives correct context', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
output: dist/
resources:
  - "docs/**/*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('simple-plugin')!;

			const context = createPluginContext('/project/docs/api.md', config, 'api.md');

			// Verify context properties
			expect(context.file).toBe('/project/docs/api.md');
			expect(context.relativePath).toBe('api.md');
			expect(context.config.output).toBe('dist/');

			// Execute to ensure context is passed correctly
			const result = await executePlugin(loaded, 'Content', {}, context);
			expect(result).toBeTruthy();
		});

		test('async plugins work correctly', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: async-plugin
    source: ./async-plugin.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('async-plugin')!;

			const context = createPluginContext('/project/test.md', config, 'test.md');
			const result = await executePlugin(
				loaded,
				'Content',
				{ delay: 10, prefix: '[ASYNC]' },
				context,
			);

			expect(result).toBe('[ASYNC] Content');
		});
	});

	describe('plugin registry lookup', () => {
		test('finds plugin in registry', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);

			expect(registry.has('simple-plugin')).toBe(true);
			expect(registry.get('simple-plugin')).toBeTruthy();
		});

		test('returns undefined for unknown plugin', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);

			expect(registry.has('unknown-plugin')).toBe(false);
			expect(registry.get('unknown-plugin')).toBeUndefined();
		});

		test('provides helpful error for missing plugin', async () => {
			const registry = await createPluginRegistry(
				[
					{ name: 'simple-plugin', source: './simple-plugin.js' },
					{ name: 'async-plugin', source: './async-plugin.js' },
				],
				FIXTURES_DIR,
			);

			const availablePlugins = Array.from(registry.keys());

			const error = new PluginNotFoundError('missing-plugin', availablePlugins);

			expect(error.message).toContain('missing-plugin');
			// Available plugins are in the suggestions array, not the message
			expect(error.suggestions).toBeDefined();
			expect(error.suggestions?.[0]).toContain('simple-plugin');
			expect(error.suggestions?.[0]).toContain('async-plugin');
		});
	});

	describe('validation and error propagation', () => {
		test('validation errors propagate correctly', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: toc-generator
    source: ./toc-generator.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('toc-generator')!;

			const context = createPluginContext('/project/test.md', config, 'test.md');

			await expect(
				executePlugin(loaded, 'Content', { maxDepth: 10 }, context),
			).rejects.toThrow('maxDepth must be between 1 and 6');
		});

		test('execution errors include context', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: error-plugin
    source: ./error-plugin.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('error-plugin')!;

			const context = createPluginContext('/project/docs/file.md', config, 'file.md');

			try {
				await executePlugin(loaded, 'Content', { errorType: 'runtime' }, context);
				expect.unreachable('Should have thrown');
			} catch (error) {
				expect(error).toBeTruthy();
				const errMsg = error instanceof Error ? error.message : String(error);
				expect(errMsg).toContain('error-plugin');
				expect(errMsg).toContain('/project/docs/file.md');
			}
		});

		test('checksum verification during registry creation', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
    checksum: sha256:invalid_checksum
`;
			const config = parseConfig(yaml);

			await expect(
				createPluginRegistry(config.plugins || [], FIXTURES_DIR),
			).rejects.toThrow('checksum verification failed');
		});
	});

	describe('complex workflows', () => {
		test('TOC generator with real content', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: toc-generator
    source: ./toc-generator.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('toc-generator')!;

			const context = createPluginContext('/project/README.md', config, 'README.md');

			const content = `
# Welcome to MyProject

## Getting Started

### Installation

### Configuration

## API Reference

### Core Functions

### Utilities

## Contributing
`;

			const result = await executePlugin(
				loaded,
				content,
				{ maxDepth: 3, title: 'Contents' },
				context,
			);

			expect(result).toContain('## Contents');
			expect(result).toContain('[Welcome to MyProject]');
			expect(result).toContain('[Getting Started]');
			expect(result).toContain('[Installation]');
			expect(result).toContain('[API Reference]');
			expect(result).toContain('[Contributing]');
		});

		test('plugins with conditional execution', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: word-counter
    source: ./word-counter.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('word-counter')!;

			const context = createPluginContext('/project/test.md', config, 'test.md');

			// With stats enabled
			const withStats = await executePlugin(
				loaded,
				'Hello world',
				{ showWords: true, showChars: true },
				context,
			);
			expect(withStats).toContain('Words:');
			expect(withStats).toContain('Characters:');

			// With stats disabled
			const noStats = await executePlugin(
				loaded,
				'Hello world',
				{ showWords: false, showChars: false },
				context,
			);
			expect(noStats).not.toContain('Statistics:');
		});

		test('multiple plugins modifying same content', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
  - name: async-plugin
    source: ./async-plugin.js
  - name: word-counter
    source: ./word-counter.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const context = createPluginContext('/project/test.md', config, 'test.md');

			let content = '# Original Content\n\nSome text here.';

			// Apply plugins in sequence
			const simplePlugin = registry.get('simple-plugin')!;
			content = await executePlugin(
				simplePlugin,
				content,
				{ footer: 'Generated' },
				context,
			);

			const asyncPlugin = registry.get('async-plugin')!;
			content = await executePlugin(
				asyncPlugin,
				content,
				{ delay: 5, prefix: '[PROCESSED]' },
				context,
			);

			const counterPlugin = registry.get('word-counter')!;
			content = await executePlugin(counterPlugin, content, {}, context);

			// Verify all plugins ran
			expect(content).toContain('[PROCESSED]');
			expect(content).toContain('# Original Content');
			expect(content).toContain('Generated');
			expect(content).toContain('Words:');
		});
	});

	describe('edge cases', () => {
		test('empty plugin list creates empty registry', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);

			expect(registry.size).toBe(0);
		});

		test('plugin with empty params', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: simple-plugin
    source: ./simple-plugin.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('simple-plugin')!;

			const context = createPluginContext('/project/test.md', config, 'test.md');
			const result = await executePlugin(loaded, 'Content', {}, context);

			expect(result).toBeTruthy();
		});

		test('plugin with no headers for TOC', async () => {
			const yaml = `
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
plugins:
  - name: toc-generator
    source: ./toc-generator.js
`;
			const config = parseConfig(yaml);

			const registry = await createPluginRegistry(config.plugins || [], FIXTURES_DIR);
			const loaded = registry.get('toc-generator')!;

			const context = createPluginContext('/project/test.md', config, 'test.md');
			const content = 'Just some text without any headers.';

			const result = await executePlugin(loaded, content, {}, context);

			// Should return original content when no headers found
			expect(result).toBe(content);
		});
	});
});
