/**
 * Validation functions for kustomark
 *
 * Implements both per-patch validation and global validators for markdown content.
 * Validation happens AFTER patches are applied to check the resulting content.
 */

import { getNestedValue } from "./nested-values.js";
import { parseFrontmatter } from "./patch-engine.js";
import type { ValidationError, Validator } from "./types.js";

/**
 * Validate that content does not contain a specific pattern
 *
 * @param content - The content to validate
 * @param pattern - The pattern that should not be present
 * @returns true if content does NOT contain the pattern, false otherwise
 */
export function validateNotContains(content: string, pattern: string): boolean {
  return !content.includes(pattern);
}

/**
 * Validate that frontmatter contains all required keys
 *
 * @param content - The content to validate
 * @param requiredKeys - Array of required frontmatter keys (supports dot notation)
 * @returns Object with valid flag and array of missing keys
 */
export function validateFrontmatterRequired(
  content: string,
  requiredKeys: string[],
): { valid: boolean; missing: string[] } {
  const { data, hasFrontmatter } = parseFrontmatter(content);

  if (!hasFrontmatter) {
    // If no frontmatter exists, all keys are missing
    return { valid: false, missing: requiredKeys };
  }

  const missing: string[] = [];

  for (const key of requiredKeys) {
    const value = getNestedValue(data, key);
    if (value === undefined) {
      missing.push(key);
    }
  }

  return { valid: missing.length === 0, missing };
}

// getNestedValue is now imported from nested-values.ts

/**
 * Run a single validator on content
 *
 * @param content - The content to validate
 * @param validator - The validator configuration
 * @returns ValidationError if validation fails, null otherwise
 */
export function runValidator(content: string, validator: Validator): ValidationError | null {
  // Check notContains validation
  if (validator.notContains !== undefined) {
    const isValid = validateNotContains(content, validator.notContains);
    if (!isValid) {
      return {
        validator: validator.name,
        message: `Content contains forbidden pattern: '${validator.notContains}'`,
      };
    }
  }

  // Check frontmatterRequired validation
  if (validator.frontmatterRequired !== undefined && validator.frontmatterRequired.length > 0) {
    const result = validateFrontmatterRequired(content, validator.frontmatterRequired);
    if (!result.valid) {
      return {
        validator: validator.name,
        message: `Missing required frontmatter keys: ${result.missing.join(", ")}`,
      };
    }
  }

  return null;
}

/**
 * Run all global validators on content
 *
 * @param content - The content to validate
 * @param validators - Array of validator configurations
 * @returns Array of validation errors (empty if all validations pass)
 */
export function runValidators(content: string, validators: Validator[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const validator of validators) {
    const error = runValidator(content, validator);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}
