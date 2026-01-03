/**
 * Error classes for the plugin system
 *
 * Provides detailed, actionable error messages for plugin-related failures.
 *
 * @module plugin-errors
 */

import { KustomarkError } from "./errors.js";
import type { PluginParamError } from "./plugin-types.js";

/**
 * Base class for all plugin-related errors
 */
export class PluginError extends KustomarkError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message, code, context, suggestions, cause);
    this.name = "PluginError";
  }
}

/**
 * Error thrown when a plugin cannot be loaded
 */
export class PluginLoadError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly source: string,
    message: string,
    loadCause?: Error,
  ) {
    super(
      `Failed to load plugin '${pluginName}' from '${source}': ${message}`,
      "PLUGIN_LOAD_ERROR",
      {
        pluginName,
        source,
      },
      undefined,
      loadCause,
    );
    this.name = "PluginLoadError";
  }
}

/**
 * Error thrown when a plugin doesn't implement the required interface
 */
export class PluginValidationError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly source: string,
    public readonly violations: string[],
  ) {
    const violationList = violations.map((v) => `  - ${v}`).join("\n");
    super(
      `Plugin '${pluginName}' from '${source}' does not implement the required interface:\n${violationList}`,
      "PLUGIN_VALIDATION_ERROR",
      { pluginName, source, violations },
    );
    this.name = "PluginValidationError";
  }
}

/**
 * Error thrown when a plugin execution fails
 */
export class PluginExecutionError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly file: string,
    message: string,
    execCause?: Error,
  ) {
    super(
      `Plugin '${pluginName}' failed while processing '${file}': ${message}`,
      "PLUGIN_EXECUTION_ERROR",
      {
        pluginName,
        file,
      },
      undefined,
      execCause,
    );
    this.name = "PluginExecutionError";
  }
}

/**
 * Error thrown when a plugin exceeds its execution timeout
 */
export class PluginTimeoutError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly file: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `Plugin '${pluginName}' exceeded timeout of ${timeoutMs}ms while processing '${file}'`,
      "PLUGIN_TIMEOUT_ERROR",
      { pluginName, file, timeoutMs },
    );
    this.name = "PluginTimeoutError";
  }
}

/**
 * Error thrown when a referenced plugin is not found in the registry
 */
export class PluginNotFoundError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly availablePlugins: string[],
  ) {
    const suggestionText =
      availablePlugins.length > 0
        ? `Available plugins: ${availablePlugins.join(", ")}`
        : "No plugins are configured. Add plugins to the 'plugins' section in kustomark.yaml.";
    super(
      `Plugin '${pluginName}' not found in plugin registry.`,
      "PLUGIN_NOT_FOUND_ERROR",
      {
        pluginName,
        availablePlugins,
      },
      [suggestionText],
    );
    this.name = "PluginNotFoundError";
  }
}

/**
 * Error thrown when plugin parameter validation fails
 */
export class PluginParamValidationError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly errors: PluginParamError[],
  ) {
    const errorList = errors
      .map((e) => {
        let msg = `  - ${e.param}: ${e.message}`;
        if (e.expected && e.actual) {
          msg += `\n    Expected: ${e.expected}\n    Got: ${e.actual}`;
        }
        return msg;
      })
      .join("\n");
    super(
      `Plugin '${pluginName}' parameter validation failed:\n${errorList}`,
      "PLUGIN_PARAM_VALIDATION_ERROR",
      { pluginName, errors },
    );
    this.name = "PluginParamValidationError";
  }
}

/**
 * Error thrown when a plugin file has an invalid checksum
 */
export class PluginChecksumError extends PluginError {
  constructor(
    public readonly pluginName: string,
    public readonly source: string,
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(
      `Plugin '${pluginName}' checksum verification failed.\n` +
        `  Expected: ${expected}\n` +
        `  Got: ${actual}\n\n` +
        `The plugin file may have been modified or corrupted.`,
      "PLUGIN_CHECKSUM_ERROR",
      { pluginName, source, expected, actual },
    );
    this.name = "PluginChecksumError";
  }
}

/**
 * Helper function to create detailed error messages for plugin loading failures
 */
export function createPluginLoadErrorMessage(
  pluginName: string,
  source: string,
  error: unknown,
): PluginLoadError {
  if (error instanceof Error) {
    // Syntax errors
    if (error.message.includes("Unexpected token")) {
      return new PluginLoadError(
        pluginName,
        source,
        `Syntax error in plugin file. Check for JavaScript/TypeScript syntax errors.`,
        error,
      );
    }

    // Module not found
    if (error.message.includes("Cannot find module") || error.message.includes("ENOENT")) {
      return new PluginLoadError(
        pluginName,
        source,
        `Plugin file not found. Check that the source path is correct.`,
        error,
      );
    }

    // Import/export errors
    if (error.message.includes("export")) {
      return new PluginLoadError(
        pluginName,
        source,
        `Plugin does not export required fields. Ensure it exports 'name', 'version', and 'apply'.`,
        error,
      );
    }

    // Generic error
    return new PluginLoadError(pluginName, source, error.message, error);
  }

  // Unknown error type
  return new PluginLoadError(
    pluginName,
    source,
    String(error),
    error instanceof Error ? error : undefined,
  );
}

/**
 * Helper function to validate plugin interface and return violations
 */
export function validatePluginInterface(plugin: unknown, pluginName: string): string[] {
  const violations: string[] = [];

  if (!plugin || typeof plugin !== "object") {
    violations.push("Plugin must export an object");
    return violations;
  }

  const p = plugin as Record<string, unknown>;

  // Check required fields
  if (typeof p.name !== "string") {
    violations.push("Missing or invalid 'name' (must be a string)");
  } else if (p.name !== pluginName) {
    violations.push(
      `Plugin name mismatch: config says '${pluginName}', plugin exports '${p.name}'`,
    );
  }

  if (typeof p.version !== "string") {
    violations.push("Missing or invalid 'version' (must be a string)");
  }

  if (typeof p.apply !== "function") {
    violations.push("Missing or invalid 'apply' (must be a function)");
  }

  // Check optional fields
  if (p.validate !== undefined && typeof p.validate !== "function") {
    violations.push("Invalid 'validate' (must be a function if provided)");
  }

  if (p.description !== undefined && typeof p.description !== "string") {
    violations.push("Invalid 'description' (must be a string if provided)");
  }

  if (p.params !== undefined && !Array.isArray(p.params)) {
    violations.push("Invalid 'params' (must be an array if provided)");
  }

  return violations;
}
