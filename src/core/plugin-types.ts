/**
 * Type definitions for the kustomark plugin system
 *
 * This module defines the core interfaces and types that plugins must implement.
 * Plugins are user-defined transformations that can be applied to markdown content
 * through the patch system.
 *
 * @module plugin-types
 */

import type { KustomarkConfig } from "./types.js";

/**
 * Context provided to plugin functions during execution.
 * Contains metadata about the current file being processed.
 */
export interface PluginContext {
  /**
   * Absolute path to the file currently being processed
   * @example '/project/docs/README.md'
   */
  file: string;

  /**
   * The complete kustomark configuration object
   * Allows plugins to access configuration settings
   */
  config: Readonly<KustomarkConfig>;

  /**
   * Environment variables available to the plugin
   * Filtered to only include safe, non-sensitive variables
   */
  env: Readonly<Record<string, string>>;

  /**
   * Relative path from the output directory to the current file
   * Useful for generating relative links
   * @example 'api/endpoints.md'
   */
  relativePath: string;
}

/**
 * Plugin function signature.
 * Transforms markdown content based on provided parameters.
 *
 * @param content - The current markdown content
 * @param params - User-provided parameters from the patch configuration
 * @param context - Execution context with file and config metadata
 * @returns Transformed content (synchronous or asynchronous)
 *
 * @example
 * ```typescript
 * export const apply: PluginFunction = (content, params, context) => {
 *   const { maxDepth = 3 } = params;
 *   return generateTableOfContents(content, maxDepth);
 * };
 * ```
 */
export type PluginFunction = (
  content: string,
  params: Record<string, unknown>,
  context: PluginContext,
) => string | Promise<string>;

/**
 * Validation error returned by plugin validate() function
 */
export interface PluginParamError {
  /**
   * Name of the invalid parameter
   */
  param: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Expected value or type
   */
  expected?: string;

  /**
   * Actual value received
   */
  actual?: string;
}

/**
 * Optional validation function for plugin parameters.
 * Validates params before the plugin is executed, allowing early error detection.
 *
 * @param params - Parameters to validate
 * @returns Array of validation errors, or empty array if valid
 *
 * @example
 * ```typescript
 * export const validate = (params: Record<string, unknown>) => {
 *   const errors: PluginValidationError[] = [];
 *   if (typeof params.maxDepth !== 'number') {
 *     errors.push({
 *       param: 'maxDepth',
 *       message: 'maxDepth must be a number',
 *       expected: 'number',
 *       actual: typeof params.maxDepth
 *     });
 *   }
 *   return errors;
 * };
 * ```
 */
export type PluginValidateFunction = (
  params: Record<string, unknown>,
) => PluginParamError[] | Promise<PluginParamError[]>;

/**
 * Main plugin interface that all plugins must implement.
 *
 * A plugin is a JavaScript/TypeScript module that exports an object
 * conforming to this interface.
 *
 * @example
 * ```typescript
 * // my-plugin.js
 * export const name = 'word-counter';
 * export const version = '1.0.0';
 *
 * export const apply = (content, params, context) => {
 *   const wordCount = content.split(/\s+/).length;
 *   return `${content}\n\nWord count: ${wordCount}`;
 * };
 * ```
 */
export interface Plugin {
  /**
   * Unique plugin identifier
   * Must be alphanumeric with hyphens/underscores
   * @example 'toc-generator'
   */
  name: string;

  /**
   * Semantic version of the plugin
   * Should follow semver specification
   * @example '1.2.3'
   */
  version: string;

  /**
   * Main transformation function
   * Receives content, params, and context, returns transformed content
   */
  apply: PluginFunction;

  /**
   * Optional parameter validation function
   * Called before apply() to validate user-provided params
   */
  validate?: PluginValidateFunction;

  /**
   * Optional plugin description for documentation
   */
  description?: string;

  /**
   * Optional parameter schema for documentation
   * Describes expected parameters and their types
   */
  params?: PluginParamSchema[];
}

/**
 * Parameter schema for documentation and validation
 */
export interface PluginParamSchema {
  /**
   * Parameter name
   */
  name: string;

  /**
   * Parameter type (for documentation)
   */
  type: string;

  /**
   * Whether this parameter is required
   */
  required?: boolean;

  /**
   * Default value if not provided
   */
  default?: unknown;

  /**
   * Parameter description
   */
  description?: string;
}

/**
 * Plugin configuration in kustomark.yaml
 *
 * Defines how to load and reference a plugin in the configuration.
 *
 * @example
 * ```yaml
 * plugins:
 *   - name: toc-generator
 *     source: ./plugins/toc.js
 *   - name: link-checker
 *     source: kustomark-plugin-link-checker
 *     version: ^1.0.0
 * ```
 */
export interface PluginConfig {
  /**
   * Unique name to reference this plugin in patches
   * Must match the plugin's exported name
   */
  name: string;

  /**
   * Plugin source - can be:
   * - Relative/absolute file path: './plugins/my-plugin.js'
   * - npm package name: 'kustomark-plugin-*'
   * - npm scoped package: '@org/kustomark-plugin-*'
   */
  source: string;

  /**
   * Optional version constraint for npm packages
   * Uses semver syntax: '^1.0.0', '~2.1.0', etc.
   * @example '^1.0.0'
   */
  version?: string;

  /**
   * Optional SHA256 checksum for plugin verification
   * Ensures plugin file hasn't been tampered with
   * @example 'sha256:abc123...'
   */
  checksum?: string;

  /**
   * Optional timeout for plugin execution in milliseconds
   * Overrides global plugin timeout for this specific plugin
   * @example 60000
   */
  timeout?: number;
}

/**
 * Plugin registry for efficient plugin lookup
 * Maps plugin names to loaded Plugin instances
 */
export type PluginRegistry = Map<string, LoadedPlugin>;

/**
 * A loaded plugin with additional metadata
 */
export interface LoadedPlugin {
  /**
   * The plugin instance
   */
  plugin: Plugin;

  /**
   * Absolute path to the plugin file
   */
  path: string;

  /**
   * Configuration used to load this plugin
   */
  config: PluginConfig;

  /**
   * SHA256 hash of the plugin source code
   * Used for cache invalidation
   */
  sourceHash: string;
}

/**
 * Options for plugin execution
 */
export interface PluginExecutionOptions {
  /**
   * Timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable sandboxing (future feature)
   * @default false
   */
  sandbox?: boolean;

  /**
   * Verbose logging
   * @default false
   */
  verbose?: boolean;
}
