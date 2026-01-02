/**
 * Condition evaluator for kustomark patch conditions
 *
 * Provides conditional patch application based on file content and frontmatter.
 * All functions are pure and deterministic.
 */

import { getNestedValue, parseFrontmatter } from "./frontmatter-parser.js";
import type { Condition } from "./types.js";

/**
 * Check if content contains a substring
 *
 * @param content - The file content to search
 * @param substring - The substring to find
 * @returns true if content contains the substring, false otherwise
 */
export function evaluateFileContains(content: string, substring: string): boolean {
  return content.includes(substring);
}

/**
 * Check if content matches a regex pattern
 *
 * Supports regex flags in the pattern (e.g., /pattern/i for case-insensitive).
 * If no flags are provided, defaults to no flags.
 *
 * @param content - The file content to test
 * @param pattern - The regex pattern (may include flags like /pattern/i)
 * @returns true if content matches the pattern, false if pattern is invalid or no match
 */
export function evaluateFileMatches(content: string, pattern: string): boolean {
  try {
    // Parse pattern with optional flags (e.g., /pattern/flags)
    const match = pattern.match(/^\/(.+)\/([gimsuvy]*)$/);

    let regex: RegExp;
    if (match) {
      // Pattern has /.../ format with optional flags
      const patternBody = match[1];
      const flags = match[2];
      if (!patternBody) {
        return false;
      }
      regex = new RegExp(patternBody, flags);
    } else {
      // Plain pattern without delimiters
      regex = new RegExp(pattern);
    }

    return regex.test(content);
  } catch {
    // Invalid regex pattern
    return false;
  }
}

/**
 * Check if frontmatter key equals a specific value
 *
 * Supports dot notation for nested keys (e.g., "metadata.author").
 * Uses deep equality comparison for values.
 *
 * @param content - The markdown content with frontmatter
 * @param key - The frontmatter key (supports dot notation)
 * @param value - The expected value
 * @returns true if the key exists and equals the value, false otherwise
 */
export function evaluateFrontmatterEquals(content: string, key: string, value: unknown): boolean {
  try {
    const frontmatter = parseFrontmatter(content);
    const actualValue = getNestedValue(frontmatter, key);

    // Deep equality check
    return deepEqual(actualValue, value);
  } catch {
    // Frontmatter parsing failed
    return false;
  }
}

/**
 * Check if frontmatter key exists
 *
 * Supports dot notation for nested keys (e.g., "metadata.author").
 *
 * @param content - The markdown content with frontmatter
 * @param key - The frontmatter key to check (supports dot notation)
 * @returns true if the key exists, false otherwise
 */
export function evaluateFrontmatterExists(content: string, key: string): boolean {
  try {
    const frontmatter = parseFrontmatter(content);
    const value = getNestedValue(frontmatter, key);
    return value !== undefined;
  } catch {
    // Frontmatter parsing failed
    return false;
  }
}

/**
 * Evaluate logical NOT of a condition
 *
 * @param content - The file content
 * @param condition - The condition to negate
 * @returns true if the condition is false, false if the condition is true
 */
export function evaluateNot(content: string, condition: Condition): boolean {
  return !evaluateCondition(content, condition);
}

/**
 * Evaluate logical OR of multiple conditions
 *
 * Returns true if at least one condition is true.
 * Returns false if the array is empty or all conditions are false.
 *
 * @param content - The file content
 * @param conditions - Array of conditions to evaluate
 * @returns true if any condition is true, false otherwise
 */
export function evaluateAnyOf(content: string, conditions: Condition[]): boolean {
  if (conditions.length === 0) {
    return false;
  }

  return conditions.some((condition) => evaluateCondition(content, condition));
}

/**
 * Evaluate logical AND of multiple conditions
 *
 * Returns true if all conditions are true.
 * Returns true if the array is empty (vacuous truth).
 *
 * @param content - The file content
 * @param conditions - Array of conditions to evaluate
 * @returns true if all conditions are true, false if any is false
 */
export function evaluateAllOf(content: string, conditions: Condition[]): boolean {
  if (conditions.length === 0) {
    return true;
  }

  return conditions.every((condition) => evaluateCondition(content, condition));
}

/**
 * Main condition evaluator - routes to specific evaluators
 *
 * Evaluates a condition against file content. This is the main entry point
 * for condition evaluation and dispatches to the appropriate evaluator.
 *
 * @param content - The file content to evaluate against
 * @param condition - The condition to evaluate
 * @returns true if the condition is met, false otherwise (including malformed conditions)
 */
export function evaluateCondition(content: string, condition: Condition): boolean {
  try {
    // Type discriminator dispatch
    switch (condition.type) {
      case "fileContains":
        return evaluateFileContains(content, condition.value);

      case "fileMatches":
        return evaluateFileMatches(content, condition.pattern);

      case "frontmatterEquals":
        return evaluateFrontmatterEquals(content, condition.key, condition.value);

      case "frontmatterExists":
        return evaluateFrontmatterExists(content, condition.key);

      case "not":
        return evaluateNot(content, condition.condition);

      case "anyOf":
        return evaluateAnyOf(content, condition.conditions);

      case "allOf":
        return evaluateAllOf(content, condition.conditions);

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = condition;
        throw new Error(`Unknown condition type: ${(_exhaustive as Condition).type}`);
      }
    }
  } catch {
    // Any error during evaluation returns false
    return false;
  }
}

/**
 * Deep equality comparison for values
 *
 * Handles primitives, arrays, and objects recursively.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are deeply equal, false otherwise
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference or both primitives with same value
  if (a === b) {
    return true;
  }

  // Handle null/undefined
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  // Different types
  if (typeof a !== typeof b) {
    return false;
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // One is array, other is not
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  // Objects
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  // Fallback for other types
  return false;
}
