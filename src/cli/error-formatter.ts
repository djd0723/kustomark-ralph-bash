/**
 * CLI error formatting utilities
 * Provides rich, colorful error display for the CLI with support for various error types
 */

// ============================================================================
// ANSI Color Codes
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/**
 * Apply color to text
 */
function colorize(text: string, color: keyof typeof colors, enabled: boolean): string {
  if (!enabled) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Options for formatting errors
 */
export interface ErrorFormattingOptions {
  /** Output format: text or JSON */
  format: "text" | "json";
  /** Whether to use colors in output */
  colors: boolean;
  /** Whether to include verbose information */
  verbose: boolean;
}

/**
 * Base interface for KustomarkError-like errors
 * These errors have additional context beyond standard Error
 */
interface KustomarkError extends Error {
  /** Error code or type identifier */
  code?: string;
  /** Additional context information */
  context?: Record<string, unknown>;
  /** Array of suggestions for fixing the error */
  suggestions?: string[];
  /** Underlying error that caused this error */
  cause?: Error;
}

/**
 * Patch error with code position and snippet
 */
interface PatchError extends KustomarkError {
  /** Position in the file where the error occurred */
  position?: {
    line?: number;
    column?: number;
  };
  /** Code snippet showing the error context */
  snippet?: string;
}

/**
 * Type guard to check if an error is a KustomarkError
 */
function isKustomarkError(error: Error): error is KustomarkError {
  return (
    "code" in error ||
    "context" in error ||
    "suggestions" in error ||
    ("cause" in error && error.cause instanceof Error)
  );
}

/**
 * Type guard to check if an error is a PatchError
 */
function isPatchError(error: Error): error is PatchError {
  return "position" in error || "snippet" in error;
}

// ============================================================================
// Text Formatting Functions
// ============================================================================

/**
 * Format error as text with colors and structure
 */
function formatAsText(error: Error, options: ErrorFormattingOptions): string {
  const lines: string[] = [];
  const { colors: useColors, verbose } = options;

  // Determine if this is a special error type
  const isKustomark = isKustomarkError(error);
  const isPatch = isPatchError(error);

  // Error header
  const errorIcon = "✖";
  const errorType = error.name || "Error";
  const header = `${errorIcon} ${errorType}`;
  lines.push(colorize(header, "red", useColors));
  lines.push("");

  // Error message
  lines.push(error.message);

  // For PatchError: show position and snippet
  if (isPatch) {
    const patchError = error as PatchError;

    if (patchError.position) {
      lines.push("");
      const { line, column } = patchError.position;
      const positionText =
        line !== undefined && column !== undefined
          ? `at line ${line}, column ${column}`
          : line !== undefined
            ? `at line ${line}`
            : "position unknown";
      lines.push(colorize(positionText, "dim", useColors));
    }

    if (patchError.snippet) {
      lines.push("");
      lines.push(colorize("Code snippet:", "yellow", useColors));
      const snippetLines = patchError.snippet.split("\n");
      for (const snippetLine of snippetLines) {
        lines.push(colorize(`  ${snippetLine}`, "yellow", useColors));
      }
    }
  }

  // For KustomarkError: show context and suggestions
  if (isKustomark) {
    const kustomarkError = error as KustomarkError;

    // Show code if available
    if (kustomarkError.code && verbose) {
      lines.push("");
      lines.push(colorize(`Error code: ${kustomarkError.code}`, "gray", useColors));
    }

    // Show context if available and verbose
    if (kustomarkError.context && verbose && Object.keys(kustomarkError.context).length > 0) {
      lines.push("");
      lines.push(colorize("Context:", "gray", useColors));
      for (const [key, value] of Object.entries(kustomarkError.context)) {
        const valueStr = typeof value === "string" ? value : JSON.stringify(value);
        lines.push(colorize(`  ${key}: ${valueStr}`, "gray", useColors));
      }
    }

    // Show suggestions if available
    if (kustomarkError.suggestions && kustomarkError.suggestions.length > 0) {
      lines.push("");
      lines.push(colorize("Suggestions:", "cyan", useColors));
      for (const suggestion of kustomarkError.suggestions) {
        lines.push(colorize(`  • ${suggestion}`, "cyan", useColors));
      }
    }

    // Show cause chain if verbose
    if (verbose && kustomarkError.cause) {
      lines.push("");
      lines.push(colorize("Caused by:", "gray", useColors));
      let currentCause: Error | undefined = kustomarkError.cause;
      let depth = 0;
      const maxDepth = 5; // Prevent infinite loops

      while (currentCause && depth < maxDepth) {
        const indent = "  ".repeat(depth + 1);
        lines.push(
          colorize(`${indent}${currentCause.name}: ${currentCause.message}`, "gray", useColors),
        );

        // Navigate to next cause if it exists
        currentCause = "cause" in currentCause ? (currentCause as KustomarkError).cause : undefined;
        depth++;
      }

      if (depth >= maxDepth && currentCause) {
        const indent = "  ".repeat(depth + 1);
        lines.push(colorize(`${indent}... (more causes)`, "dim", useColors));
      }
    }
  }

  // Stack trace for verbose mode
  if (verbose && error.stack) {
    lines.push("");
    lines.push(colorize("Stack trace:", "dim", useColors));
    const stackLines = error.stack.split("\n").slice(1); // Skip first line (error message)
    for (const stackLine of stackLines) {
      lines.push(colorize(`  ${stackLine.trim()}`, "dim", useColors));
    }
  }

  return lines.join("\n");
}

// ============================================================================
// JSON Formatting Functions
// ============================================================================

/**
 * Format error as JSON with all available properties
 */
function formatAsJson(error: Error, options: ErrorFormattingOptions): string {
  const { verbose } = options;

  // Build base error object
  const errorObj: Record<string, unknown> = {
    error: true,
    name: error.name || "Error",
    message: error.message,
  };

  // Add KustomarkError properties if available
  if (isKustomarkError(error)) {
    const kustomarkError = error as KustomarkError;

    if (kustomarkError.code) {
      errorObj.code = kustomarkError.code;
    }

    if (kustomarkError.context) {
      errorObj.context = kustomarkError.context;
    }

    if (kustomarkError.suggestions && kustomarkError.suggestions.length > 0) {
      errorObj.suggestions = kustomarkError.suggestions;
    }

    // Include cause chain
    if (kustomarkError.cause) {
      const causes: Array<{ name: string; message: string }> = [];
      let currentCause: Error | undefined = kustomarkError.cause;
      let depth = 0;
      const maxDepth = 5;

      while (currentCause && depth < maxDepth) {
        causes.push({
          name: currentCause.name || "Error",
          message: currentCause.message,
        });

        currentCause = "cause" in currentCause ? (currentCause as KustomarkError).cause : undefined;
        depth++;
      }

      if (causes.length > 0) {
        errorObj.causes = causes;
      }
    }
  }

  // Add PatchError properties if available
  if (isPatchError(error)) {
    const patchError = error as PatchError;

    if (patchError.position) {
      errorObj.position = patchError.position;
    }

    if (patchError.snippet) {
      errorObj.snippet = patchError.snippet;
    }
  }

  // Add stack trace if verbose
  if (verbose && error.stack) {
    errorObj.stack = error.stack
      .split("\n")
      .slice(1)
      .map((line) => line.trim());
  }

  return JSON.stringify(errorObj, null, 2);
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Format an error for CLI display
 *
 * @param error - The error to format
 * @param options - Formatting options
 * @returns Formatted error string
 */
export function formatError(error: Error, options: ErrorFormattingOptions): string {
  if (options.format === "json") {
    return formatAsJson(error, options);
  }

  return formatAsText(error, options);
}
