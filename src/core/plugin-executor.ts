/**
 * Plugin executor for kustomark
 *
 * Handles plugin execution with timeout enforcement and parameter validation.
 *
 * @module plugin-executor
 */

import {
  PluginExecutionError,
  PluginParamValidationError,
  PluginTimeoutError,
} from "./plugin-errors.js";
import type { LoadedPlugin, PluginContext, PluginExecutionOptions } from "./plugin-types.js";
import type { KustomarkConfig } from "./types.js";

/**
 * Default timeout for plugin execution in milliseconds
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Create a plugin execution context from file information
 *
 * The context provides readonly access to:
 * - Current file path
 * - Kustomark configuration
 * - Environment variables (filtered for safety)
 * - Relative path from output directory
 *
 * @param file - Absolute path to the current file being processed
 * @param config - Kustomark configuration
 * @param relativePath - Relative path from output directory to file
 * @returns Immutable plugin context
 *
 * @example
 * ```typescript
 * const context = createPluginContext(
 *   '/project/docs/api.md',
 *   config,
 *   'api.md'
 * );
 * console.log(context.file); // '/project/docs/api.md'
 * console.log(context.relativePath); // 'api.md'
 * ```
 */
export function createPluginContext(
  file: string,
  config: Readonly<KustomarkConfig>,
  relativePath: string,
): Readonly<PluginContext> {
  // Filter environment variables to only include safe ones
  // Exclude sensitive variables like passwords, tokens, etc.
  const safeEnv: Record<string, string> = {};
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /auth/i,
    /credential/i,
    /api[_-]?key/i,
  ];

  for (const [key, value] of Object.entries(process.env)) {
    // Skip if key matches sensitive patterns
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      continue;
    }
    // Only include string values
    if (typeof value === "string") {
      safeEnv[key] = value;
    }
  }

  return Object.freeze({
    file,
    config,
    env: Object.freeze(safeEnv),
    relativePath,
  });
}

/**
 * Execute a plugin with timeout enforcement
 *
 * This function:
 * 1. Validates plugin parameters (if validate() is provided)
 * 2. Executes plugin.apply() with timeout enforcement
 * 3. Handles both sync and async plugins
 * 4. Returns transformed content
 *
 * @param loadedPlugin - The loaded plugin to execute
 * @param content - Markdown content to transform
 * @param params - User-provided parameters from patch configuration
 * @param context - Plugin execution context
 * @param options - Execution options (timeout, etc.)
 * @returns Transformed markdown content
 *
 * @throws {PluginParamValidationError} If parameter validation fails
 * @throws {PluginTimeoutError} If plugin exceeds timeout
 * @throws {PluginExecutionError} If plugin execution fails
 *
 * @example
 * ```typescript
 * const result = await executePlugin(
 *   loadedPlugin,
 *   '# Hello\n\nContent here',
 *   { maxDepth: 3 },
 *   context,
 *   { timeout: 5000 }
 * );
 * console.log(result); // Transformed content
 * ```
 */
export async function executePlugin(
  loadedPlugin: LoadedPlugin,
  content: string,
  params: Record<string, unknown>,
  context: Readonly<PluginContext>,
  options: PluginExecutionOptions = {},
): Promise<string> {
  const { plugin, config } = loadedPlugin;
  const timeout = config.timeout ?? options.timeout ?? DEFAULT_TIMEOUT;

  // Track timeout ID for cleanup
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    // Run parameter validation if plugin provides a validate function
    if (plugin.validate) {
      const validationResult = await plugin.validate(params);

      if (validationResult.length > 0) {
        throw new PluginParamValidationError(plugin.name, validationResult);
      }
    }

    // Create a promise for timeout with cleanup
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new PluginTimeoutError(plugin.name, context.file, timeout));
      }, timeout);
    });

    // Execute plugin with timeout race
    // plugin.apply() can return string or Promise<string>
    const executionPromise = Promise.resolve(plugin.apply(content, params, context));

    // Race between execution and timeout
    const result = await Promise.race([executionPromise, timeoutPromise]);

    // Clear timeout if execution completed first
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Validate result is a string
    if (typeof result !== "string") {
      throw new PluginExecutionError(
        plugin.name,
        context.file,
        `Plugin returned ${typeof result} instead of string`,
      );
    }

    return result;
  } catch (error) {
    // Always clear timeout on any error
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Re-throw our custom errors
    if (error instanceof PluginTimeoutError || error instanceof PluginParamValidationError) {
      throw error;
    }

    // Wrap other errors in PluginExecutionError
    if (error instanceof Error) {
      throw new PluginExecutionError(plugin.name, context.file, error.message, error);
    }

    // Handle unknown error types
    throw new PluginExecutionError(plugin.name, context.file, String(error));
  }
}
