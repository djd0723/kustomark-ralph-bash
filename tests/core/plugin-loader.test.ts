/**
 * Tests for plugin loader
 *
 * Tests plugin loading, resolution, validation, and registry creation
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
	resolvePluginSource,
	calculatePluginHash,
	loadPlugin,
	createPluginRegistry,
} from '../../src/core/plugin-loader.js';
import {
	PluginLoadError,
	PluginValidationError,
	PluginChecksumError,
} from '../../src/core/plugin-errors.js';
import type { PluginConfig } from '../../src/core/plugin-types.js';

const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/plugins');

describe('Plugin Loader', () => {
	describe('resolvePluginSource', () => {
		test('resolves relative paths', () => {
			const result = resolvePluginSource('./plugins/toc.js', '/project');
			expect(result).toBe('/project/plugins/toc.js');
		});

		test('resolves parent directory paths', () => {
			const result = resolvePluginSource('../plugins/toc.js', '/project/config');
			expect(result).toBe('/project/plugins/toc.js');
		});

		test('resolves absolute paths', () => {
			const result = resolvePluginSource('/absolute/path/plugin.js', '/project');
			expect(result).toBe('/absolute/path/plugin.js');
		});

		test('returns npm package names as-is', () => {
			const result = resolvePluginSource('kustomark-plugin-toc', '/project');
			expect(result).toBe('kustomark-plugin-toc');
		});

		test('returns scoped npm package names as-is', () => {
			const result = resolvePluginSource('@org/kustomark-plugin-toc', '/project');
			expect(result).toBe('@org/kustomark-plugin-toc');
		});
	});

	describe('calculatePluginHash', () => {
		test('calculates SHA256 hash of plugin file', () => {
			const pluginPath = join(FIXTURES_DIR, 'simple-plugin.js');
			const hash = calculatePluginHash(pluginPath);

			expect(hash).toBeTruthy();
			expect(hash).toBeTypeOf('string');
			expect(hash.length).toBe(64); // SHA256 hex is 64 chars
		});

		test('returns same hash for same file', () => {
			const pluginPath = join(FIXTURES_DIR, 'simple-plugin.js');
			const hash1 = calculatePluginHash(pluginPath);
			const hash2 = calculatePluginHash(pluginPath);

			expect(hash1).toBe(hash2);
		});

		test('throws error for non-existent file', () => {
			expect(() => {
				calculatePluginHash('/non/existent/file.js');
			}).toThrow();
		});
	});

	describe('loadPlugin', () => {
		test('loads simple synchronous plugin', async () => {
			const config: PluginConfig = {
				name: 'simple-plugin',
				source: join(FIXTURES_DIR, 'simple-plugin.js'),
			};

			const loaded = await loadPlugin(config, config.source);

			expect(loaded.plugin.name).toBe('simple-plugin');
			expect(loaded.plugin.version).toBe('1.0.0');
			expect(loaded.plugin.apply).toBeTypeOf('function');
			expect(loaded.path).toBe(config.source);
			expect(loaded.config).toBe(config);
			expect(loaded.sourceHash).toBeTruthy();
		});

		test('loads async plugin', async () => {
			const config: PluginConfig = {
				name: 'async-plugin',
				source: join(FIXTURES_DIR, 'async-plugin.js'),
			};

			const loaded = await loadPlugin(config, config.source);

			expect(loaded.plugin.name).toBe('async-plugin');
			expect(loaded.plugin.version).toBe('1.0.0');
			expect(loaded.plugin.apply).toBeTypeOf('function');
		});

		test('loads plugin with validation function', async () => {
			const config: PluginConfig = {
				name: 'toc-generator',
				source: join(FIXTURES_DIR, 'toc-generator.js'),
			};

			const loaded = await loadPlugin(config, config.source);

			expect(loaded.plugin.validate).toBeTypeOf('function');
		});

		test('loads plugin with optional metadata', async () => {
			const config: PluginConfig = {
				name: 'simple-plugin',
				source: join(FIXTURES_DIR, 'simple-plugin.js'),
			};

			const loaded = await loadPlugin(config, config.source);

			expect(loaded.plugin.description).toBeTruthy();
			expect(loaded.plugin.params).toBeArray();
		});

		test('throws PluginValidationError for invalid interface', async () => {
			const config: PluginConfig = {
				name: 'invalid-interface',
				source: join(FIXTURES_DIR, 'invalid-interface.js'),
			};

			await expect(loadPlugin(config, config.source)).rejects.toThrow(
				PluginValidationError,
			);
		});

		test('throws PluginLoadError for non-existent file', async () => {
			const config: PluginConfig = {
				name: 'missing',
				source: '/non/existent/plugin.js',
			};

			await expect(loadPlugin(config, config.source)).rejects.toThrow(
				PluginLoadError,
			);
		});

		test('verifies checksum when provided', async () => {
			const pluginPath = join(FIXTURES_DIR, 'simple-plugin.js');
			const correctHash = calculatePluginHash(pluginPath);

			const config: PluginConfig = {
				name: 'simple-plugin',
				source: pluginPath,
				checksum: `sha256:${correctHash}`,
			};

			// Should not throw
			const loaded = await loadPlugin(config, config.source);
			expect(loaded).toBeTruthy();
		});

		test('throws PluginChecksumError for invalid checksum', async () => {
			const config: PluginConfig = {
				name: 'simple-plugin',
				source: join(FIXTURES_DIR, 'simple-plugin.js'),
				checksum: 'sha256:invalid_hash',
			};

			await expect(loadPlugin(config, config.source)).rejects.toThrow(
				PluginChecksumError,
			);
		});

		test('supports checksum without sha256: prefix', async () => {
			const pluginPath = join(FIXTURES_DIR, 'simple-plugin.js');
			const correctHash = calculatePluginHash(pluginPath);

			const config: PluginConfig = {
				name: 'simple-plugin',
				source: pluginPath,
				checksum: correctHash, // No prefix
			};

			const loaded = await loadPlugin(config, config.source);
			expect(loaded).toBeTruthy();
		});

		test('validates plugin name matches config name', async () => {
			const config: PluginConfig = {
				name: 'wrong-name',
				source: join(FIXTURES_DIR, 'simple-plugin.js'),
			};

			await expect(loadPlugin(config, config.source)).rejects.toThrow(
				PluginValidationError,
			);
		});
	});

	describe('createPluginRegistry', () => {
		test('creates registry from single plugin', async () => {
			const plugins: PluginConfig[] = [
				{
					name: 'simple-plugin',
					source: './simple-plugin.js',
				},
			];

			const registry = await createPluginRegistry(plugins, FIXTURES_DIR);

			expect(registry.size).toBe(1);
			expect(registry.has('simple-plugin')).toBe(true);

			const loaded = registry.get('simple-plugin');
			expect(loaded?.plugin.name).toBe('simple-plugin');
		});

		test('creates registry from multiple plugins', async () => {
			const plugins: PluginConfig[] = [
				{
					name: 'simple-plugin',
					source: './simple-plugin.js',
				},
				{
					name: 'async-plugin',
					source: './async-plugin.js',
				},
				{
					name: 'word-counter',
					source: './word-counter.js',
				},
			];

			const registry = await createPluginRegistry(plugins, FIXTURES_DIR);

			expect(registry.size).toBe(3);
			expect(registry.has('simple-plugin')).toBe(true);
			expect(registry.has('async-plugin')).toBe(true);
			expect(registry.has('word-counter')).toBe(true);
		});

		test('creates empty registry for no plugins', async () => {
			const registry = await createPluginRegistry([], FIXTURES_DIR);

			expect(registry.size).toBe(0);
		});

		test('throws error for duplicate plugin names', async () => {
			const plugins: PluginConfig[] = [
				{
					name: 'simple-plugin',
					source: './simple-plugin.js',
				},
				{
					name: 'simple-plugin', // Duplicate
					source: './async-plugin.js',
				},
			];

			await expect(
				createPluginRegistry(plugins, FIXTURES_DIR),
			).rejects.toThrow('Duplicate plugin name');
		});

		test('fails fast if any plugin fails to load', async () => {
			const plugins: PluginConfig[] = [
				{
					name: 'simple-plugin',
					source: './simple-plugin.js',
				},
				{
					name: 'missing',
					source: './missing.js',
				},
			];

			await expect(
				createPluginRegistry(plugins, FIXTURES_DIR),
			).rejects.toThrow(PluginLoadError);
		});

		test('resolves plugin sources relative to config dir', async () => {
			const plugins: PluginConfig[] = [
				{
					name: 'simple-plugin',
					source: './simple-plugin.js',
				},
			];

			const registry = await createPluginRegistry(plugins, FIXTURES_DIR);

			const loaded = registry.get('simple-plugin');
			expect(loaded?.path).toContain('tests/fixtures/plugins');
		});

		test('preserves plugin config in loaded plugin', async () => {
			const plugins: PluginConfig[] = [
				{
					name: 'simple-plugin',
					source: './simple-plugin.js',
					timeout: 5000,
				},
			];

			const registry = await createPluginRegistry(plugins, FIXTURES_DIR);

			const loaded = registry.get('simple-plugin');
			expect(loaded?.config.timeout).toBe(5000);
		});
	});

	describe('interface validation', () => {
		test('validates name field', async () => {
			const config: PluginConfig = {
				name: 'invalid-interface',
				source: join(FIXTURES_DIR, 'invalid-interface.js'),
			};

			try {
				await loadPlugin(config, config.source);
				expect.unreachable('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(PluginValidationError);
				if (error instanceof PluginValidationError) {
					expect(error.violations.some(v => v.includes('name'))).toBe(true);
				}
			}
		});

		test('validates apply function', async () => {
			const config: PluginConfig = {
				name: 'invalid-interface',
				source: join(FIXTURES_DIR, 'invalid-interface.js'),
			};

			try {
				await loadPlugin(config, config.source);
				expect.unreachable('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(PluginValidationError);
				if (error instanceof PluginValidationError) {
					expect(error.violations.some(v => v.includes('apply'))).toBe(true);
				}
			}
		});
	});
});
