/**
 * Core error hierarchy for Kustomark
 *
 * This module provides a structured error hierarchy for all Kustomark operations.
 * All errors extend from KustomarkError which provides common fields like error codes,
 * context, and helpful suggestions.
 */

import { calculateLevenshteinDistance } from "./utils/string-similarity.js";

/**
 * Base error class for all Kustomark errors.
 *
 * Provides common fields for error handling:
 * - code: A machine-readable error code (e.g., 'PATCH_FAILED', 'CONFIG_INVALID')
 * - context: Additional structured data about the error
 * - suggestions: Helpful suggestions for fixing the error
 * - cause: The underlying error that caused this error
 *
 * @example
 * ```typescript
 * throw new KustomarkError(
 *   'Failed to process file',
 *   'FILE_PROCESS_ERROR',
 *   { filePath: '/path/to/file.md' },
 *   ['Check if file exists', 'Verify file permissions'],
 *   originalError
 * );
 * ```
 */
export class KustomarkError extends Error {
  /**
   * Machine-readable error code for programmatic error handling
   */
  public readonly code: string;

  /**
   * Additional structured context about the error
   */
  public readonly context?: Record<string, unknown>;

  /**
   * Helpful suggestions for resolving the error
   */
  public readonly suggestions?: string[];

  /**
   * The underlying error that caused this error, if any
   */
  public override readonly cause?: Error;

  /**
   * Creates a new KustomarkError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param code - A machine-readable error code (e.g., 'PATCH_FAILED')
   * @param context - Optional additional context about the error
   * @param suggestions - Optional helpful suggestions for fixing the error
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message);
    this.name = "KustomarkError";
    this.code = code;
    this.context = context;
    this.suggestions = suggestions;
    this.cause = cause;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when configuration parsing or validation fails.
 *
 * Used for errors related to:
 * - Invalid YAML syntax
 * - Schema validation failures
 * - Missing required fields
 * - Invalid field values
 *
 * @example
 * ```typescript
 * throw new ConfigurationError(
 *   'Invalid configuration: missing required field "output"',
 *   'CONFIG_MISSING_FIELD',
 *   { field: 'output', configPath: '/path/to/kustomark.yaml' },
 *   ['Add the "output" field to your configuration']
 * );
 * ```
 */
export class ConfigurationError extends KustomarkError {
  /**
   * Path to the configuration file that failed
   */
  public readonly configPath?: string;

  /**
   * Field path where the error occurred (dot-notation, e.g., 'patches.0.op')
   */
  public readonly field?: string;

  /**
   * Creates a new ConfigurationError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param code - A machine-readable error code (e.g., 'CONFIG_INVALID_FIELD')
   * @param context - Optional additional context about the error
   * @param suggestions - Optional helpful suggestions for fixing the error
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message, code, context, suggestions, cause);
    this.name = "ConfigurationError";
    this.configPath = context?.configPath as string | undefined;
    this.field = context?.field as string | undefined;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when patch application fails.
 *
 * Used for errors related to:
 * - Patch operation failures
 * - Invalid patch syntax
 * - Section not found
 * - Table not found
 * - Validation failures
 *
 * @example
 * ```typescript
 * throw new PatchError(
 *   'Failed to apply replace patch: "old text" not found',
 *   'PATCH_NO_MATCH',
 *   {
 *     patchIndex: 0,
 *     operation: 'replace',
 *     filePath: '/path/to/file.md',
 *     position: 42,
 *     snippet: 'line 42: Some content here'
 *   },
 *   ['Check if the old text exists in the file', 'Use onNoMatch: "skip" to ignore']
 * );
 * ```
 */
export class PatchError extends KustomarkError {
  /**
   * Index of the patch that failed (0-based)
   */
  public readonly patchIndex?: number;

  /**
   * Patch operation type (e.g., 'replace', 'remove-section')
   */
  public readonly operation?: string;

  /**
   * File path where the patch failed
   */
  public readonly filePath?: string;

  /**
   * Line number or position where the error occurred
   */
  public readonly position?: number;

  /**
   * Code snippet showing the context where the error occurred
   */
  public readonly snippet?: string;

  /**
   * Creates a new PatchError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param code - A machine-readable error code (e.g., 'PATCH_NO_MATCH')
   * @param context - Optional additional context about the error
   * @param suggestions - Optional helpful suggestions for fixing the error
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message, code, context, suggestions, cause);
    this.name = "PatchError";
    this.patchIndex = context?.patchIndex as number | undefined;
    this.operation = context?.operation as string | undefined;
    this.filePath = context?.filePath as string | undefined;
    this.position = context?.position as number | undefined;
    this.snippet = context?.snippet as string | undefined;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when resource resolution fails.
 *
 * Used for errors related to:
 * - Resource not found
 * - Invalid resource URL
 * - Network failures
 * - Authentication failures
 * - Checksum mismatches
 *
 * @example
 * ```typescript
 * throw new ResourceError(
 *   'Failed to fetch remote resource',
 *   'RESOURCE_FETCH_FAILED',
 *   { resource: 'https://example.com/file.md', statusCode: 404 },
 *   ['Check if the URL is correct', 'Verify network connectivity'],
 *   originalError
 * );
 * ```
 */
export class ResourceError extends KustomarkError {
  /**
   * The resource pattern or URL that failed to resolve
   */
  public readonly resource?: string;

  /**
   * HTTP status code (for HTTP resources)
   */
  public readonly statusCode?: number;

  /**
   * Creates a new ResourceError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param code - A machine-readable error code (e.g., 'RESOURCE_NOT_FOUND')
   * @param context - Optional additional context about the error
   * @param suggestions - Optional helpful suggestions for fixing the error
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message, code, context, suggestions, cause);
    this.name = "ResourceError";
    this.resource = context?.resource as string | undefined;
    this.statusCode = context?.statusCode as number | undefined;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when file system operations fail.
 *
 * Used for errors related to:
 * - File not found
 * - Permission denied
 * - Directory creation failures
 * - File read/write failures
 * - Path resolution errors
 *
 * @example
 * ```typescript
 * throw new FileSystemError(
 *   'Failed to read file: permission denied',
 *   'FS_PERMISSION_DENIED',
 *   { filePath: '/path/to/file.md', operation: 'read' },
 *   ['Check file permissions', 'Run with appropriate privileges'],
 *   originalError
 * );
 * ```
 */
export class FileSystemError extends KustomarkError {
  /**
   * File or directory path where the error occurred
   */
  public readonly path?: string;

  /**
   * File system operation that failed (e.g., 'read', 'write', 'mkdir')
   */
  public readonly operation?: string;

  /**
   * System error code (e.g., 'ENOENT', 'EACCES')
   */
  public readonly syscall?: string;

  /**
   * Creates a new FileSystemError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param code - A machine-readable error code (e.g., 'FS_NOT_FOUND')
   * @param context - Optional additional context about the error
   * @param suggestions - Optional helpful suggestions for fixing the error
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message, code, context, suggestions, cause);
    this.name = "FileSystemError";
    this.path = context?.path as string | undefined;
    this.operation = context?.operation as string | undefined;
    this.syscall = context?.syscall as string | undefined;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when validation fails.
 *
 * Used for errors related to:
 * - Content validation failures (notContains, etc.)
 * - Frontmatter validation failures
 * - Custom validator failures
 * - Schema validation failures
 *
 * Note: This is different from the ValidationError interface in types.ts,
 * which is a simple data structure for validation results.
 *
 * @example
 * ```typescript
 * throw new PatchValidationError(
 *   'Validation failed: content contains forbidden string',
 *   'VALIDATION_FAILED',
 *   {
 *     validator: 'no-secrets',
 *     filePath: '/path/to/file.md',
 *     rule: 'notContains',
 *     value: 'secret-key'
 *   },
 *   ['Remove the forbidden string from the file', 'Update the validator rules']
 * );
 * ```
 */
export class PatchValidationError extends KustomarkError {
  /**
   * Name of the validator that failed
   */
  public readonly validator?: string;

  /**
   * File path where the validation failed
   */
  public readonly filePath?: string;

  /**
   * Validation rule that failed (e.g., 'notContains', 'frontmatterRequired')
   */
  public readonly rule?: string;

  /**
   * Value that caused the validation failure
   */
  public readonly value?: unknown;

  /**
   * Creates a new PatchValidationError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param code - A machine-readable error code (e.g., 'VALIDATION_FAILED')
   * @param context - Optional additional context about the error
   * @param suggestions - Optional helpful suggestions for fixing the error
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[],
    cause?: Error,
  ) {
    super(message, code, context, suggestions, cause);
    this.name = "PatchValidationError";
    this.validator = context?.validator as string | undefined;
    this.filePath = context?.filePath as string | undefined;
    this.rule = context?.rule as string | undefined;
    this.value = context?.value;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Helper functions for patch error context
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for finding similar content when exact matches fail
 *
 * @deprecated Use calculateLevenshteinDistance from utils/string-similarity.js instead
 * This function is kept for backward compatibility and delegates to the optimized implementation
 */
export function levenshteinDistance(str1: string, str2: string): number {
  return calculateLevenshteinDistance(str1, str2);
}

/**
 * Find similar content in the file using Levenshtein distance
 * Returns the most similar lines with their positions
 */
export function findSimilarContent(
  content: string,
  searchText: string,
  maxResults = 3,
  maxDistance = 10,
): Array<{ line: number; text: string; distance: number }> {
  const lines = content.split("\n");
  const results: Array<{ line: number; text: string; distance: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const distance = levenshteinDistance(searchText.trim(), line.trim());

    // Only consider lines that are somewhat similar
    if (distance <= maxDistance && distance > 0) {
      results.push({ line: i + 1, text: line, distance });
    }
  }

  // Sort by distance (most similar first) and limit results
  return results.sort((a, b) => a.distance - b.distance).slice(0, maxResults);
}

/**
 * Extract a code snippet with context around a specific line
 * Shows 2-3 lines before and after the specified line
 */
export function extractSnippet(
  content: string,
  targetLine: number,
  contextLines = 2,
): string | undefined {
  const lines = content.split("\n");

  if (targetLine < 1 || targetLine > lines.length) {
    return undefined;
  }

  const startLine = Math.max(1, targetLine - contextLines);
  const endLine = Math.min(lines.length, targetLine + contextLines);

  const snippetLines: string[] = [];
  for (let i = startLine - 1; i < endLine; i++) {
    const lineNum = i + 1;
    const line = lines[i] ?? "";
    const marker = lineNum === targetLine ? ">" : " ";
    snippetLines.push(`${marker} ${lineNum.toString().padStart(4)} | ${line}`);
  }

  return snippetLines.join("\n");
}

/**
 * Find the position (line number) where a patch operation tried to match
 * Returns the line number where the failure likely occurred
 */
export function findFailurePosition(content: string, searchText: string): number {
  const lines = content.split("\n");

  // Try to find a line that contains part of the search text
  const searchStart = searchText.substring(0, Math.min(30, searchText.length)).trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.includes(searchStart)) {
      return i + 1;
    }
  }

  // If not found, try to find similar content
  const similar = findSimilarContent(content, searchText, 1, 20);
  if (similar.length > 0) {
    return similar[0]?.line ?? 1;
  }

  // Default to first line
  return 1;
}
