/**
 * Plugin loader for kustomark
 *
 * Handles discovery, loading, and registry creation for plugins.
 * Supports both ESM and CommonJS modules via dynamic import().
 *
 * @module plugin-loader
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  createPluginLoadErrorMessage,
  PluginChecksumError,
  PluginValidationError,
  validatePluginInterface,
} from "./plugin-errors.js";
import type { LoadedPlugin, Plugin, PluginConfig, PluginRegistry } from "./plugin-types.js";

/**
 * Resolve a plugin source path to an absolute path
 *
 * Handles:
 * - Relative file paths (./plugins/my-plugin.js)
 * - Absolute file paths (/path/to/plugin.js)
 * - npm package names (kustomark-plugin-toc)
 *
 * @param source - Plugin source from config
 * @param configDir - Directory containing the kustomark config file
 * @returns Absolute path to plugin file or npm package name
 *
 * @example
 * ```typescript
 * // Relative path
 * resolvePluginSource('./plugins/toc.js', '/project')
 * // Returns: '/project/plugins/toc.js'
 *
 * // npm package
 * resolvePluginSource('kustomark-plugin-toc', '/project')
 * // Returns: 'kustomark-plugin-toc'
 * ```
 */
export function resolvePluginSource(source: string, configDir: string): string {
  // If it's a file path (relative or absolute), resolve it
  if (source.startsWith("./") || source.startsWith("../") || isAbsolute(source)) {
    return resolve(configDir, source);
  }

  // Otherwise, treat it as an npm package name
  // The dynamic import() will handle node_modules resolution
  return source;
}

/**
 * Calculate SHA256 hash of plugin source code
 *
 * Used for cache invalidation - if the plugin source changes,
 * the hash changes and cached results are invalidated.
 *
 * @param pluginPath - Absolute path to plugin file
 * @returns SHA256 hash as hex string
 *
 * @throws {Error} If file cannot be read
 *
 * @example
 * ```typescript
 * const hash = calculatePluginHash('/project/plugins/toc.js');
 * console.log(hash); // 'a1b2c3d4e5f6...'
 * ```
 */
export function calculatePluginHash(pluginPath: string): string {
  try {
    const content = readFileSync(pluginPath, "utf-8");
    return createHash("sha256").update(content).digest("hex");
  } catch (error) {
    throw new Error(
      `Failed to read plugin file for hashing: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load a plugin module and validate its interface
 *
 * Supports both ESM and CommonJS modules via dynamic import().
 * Validates that the plugin exports the required fields.
 *
 * @param config - Plugin configuration
 * @param pluginPath - Absolute path to plugin file or npm package name
 * @returns Loaded and validated plugin
 *
 * @throws {PluginLoadError} If plugin cannot be loaded
 * @throws {PluginValidationError} If plugin doesn't implement required interface
 * @throws {PluginChecksumError} If checksum verification fails
 *
 * @example
 * ```typescript
 * const config = {
 *   name: 'toc-generator',
 *   source: './plugins/toc.js'
 * };
 * const plugin = await loadPlugin(config, '/project/plugins/toc.js');
 * console.log(plugin.name); // 'toc-generator'
 * ```
 */
export async function loadPlugin(config: PluginConfig, pluginPath: string): Promise<LoadedPlugin> {
  try {
    // Dynamic import - works with both ESM and CommonJS
    // Bun's import() handles both module types transparently
    const module = await import(pluginPath);

    // Extract the plugin object
    // ESM: named exports OR default export
    // CommonJS: module.exports
    let pluginObj: unknown;

    if (module.default) {
      // Default export (ESM) or entire CommonJS module.exports
      pluginObj = module.default;
    } else {
      // Named exports (ESM) - construct plugin from individual exports
      pluginObj = {
        name: module.name,
        version: module.version,
        apply: module.apply,
        validate: module.validate,
        description: module.description,
        params: module.params,
      };
    }

    // Validate plugin interface
    const violations = validatePluginInterface(pluginObj, config.name);
    if (violations.length > 0) {
      throw new PluginValidationError(config.name, config.source, violations);
    }

    const plugin = pluginObj as Plugin;

    // Calculate source hash (only for file paths, not npm packages)
    let sourceHash = "";
    if (existsSync(pluginPath)) {
      sourceHash = calculatePluginHash(pluginPath);

      // Verify checksum if provided
      if (config.checksum) {
        // Extract hash from checksum (supports 'sha256:hash' or just 'hash')
        const expectedHash = config.checksum.replace(/^sha256:/, "");
        if (sourceHash !== expectedHash) {
          throw new PluginChecksumError(config.name, config.source, expectedHash, sourceHash);
        }
      }
    }

    return {
      plugin,
      path: pluginPath,
      config,
      sourceHash,
    };
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof PluginValidationError || error instanceof PluginChecksumError) {
      throw error;
    }

    // Wrap other errors in PluginLoadError
    throw createPluginLoadErrorMessage(config.name, config.source, error);
  }
}

/**
 * Create a plugin registry from plugin configurations
 *
 * Loads all plugins and creates a Map for O(1) lookup by plugin name.
 * Validates that plugin names are unique.
 *
 * @param plugins - Array of plugin configurations
 * @param configDir - Directory containing the kustomark config file
 * @returns Plugin registry (Map of name -> LoadedPlugin)
 *
 * @throws {PluginLoadError} If any plugin fails to load
 * @throws {PluginValidationError} If any plugin is invalid
 * @throws {Error} If duplicate plugin names are found
 *
 * @example
 * ```typescript
 * const plugins = [
 *   { name: 'toc', source: './plugins/toc.js' },
 *   { name: 'analytics', source: 'kustomark-plugin-analytics' }
 * ];
 * const registry = await createPluginRegistry(plugins, '/project');
 * console.log(registry.size); // 2
 * console.log(registry.has('toc')); // true
 * ```
 */
export async function createPluginRegistry(
  plugins: PluginConfig[],
  configDir: string,
): Promise<PluginRegistry> {
  const registry: PluginRegistry = new Map();

  // Check for duplicate names
  const names = new Set<string>();
  for (const config of plugins) {
    if (names.has(config.name)) {
      throw new Error(`Duplicate plugin name '${config.name}'. Plugin names must be unique.`);
    }
    names.add(config.name);
  }

  // Load all plugins
  for (const config of plugins) {
    const pluginPath = resolvePluginSource(config.source, configDir);
    const loadedPlugin = await loadPlugin(config, pluginPath);
    registry.set(config.name, loadedPlugin);
  }

  return registry;
}
