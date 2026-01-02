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
 * Checks whether the given content contains a forbidden pattern. This is useful
 * for ensuring certain strings or patterns are not present in the final output,
 * such as placeholder text or sensitive information markers.
 *
 * @param {string} content - The content to validate
 * @param {string} pattern - The pattern that should not be present in the content
 * @returns {boolean} true if content does NOT contain the pattern, false if it does
 *
 * @example
 * ```typescript
 * // Check that content doesn't contain TODO markers
 * const isValid = validateNotContains(content, 'TODO');
 * console.log(isValid); // true if no TODOs found
 * ```
 *
 * @example
 * ```typescript
 * // Ensure placeholder text was replaced
 * const isValid = validateNotContains(content, '{{PLACEHOLDER}}');
 * if (!isValid) {
 *   console.error('Content still contains placeholder text');
 * }
 * ```
 */
export function validateNotContains(content: string, pattern: string): boolean {
  return !content.includes(pattern);
}

/**
 * Validate that frontmatter contains all required keys
 *
 * Checks whether the content's YAML frontmatter includes all specified required
 * keys. Supports dot notation for nested keys (e.g., 'author.name'). This is
 * useful for ensuring that markdown files have all necessary metadata fields.
 *
 * @param {string} content - The content to validate (must include YAML frontmatter)
 * @param {string[]} requiredKeys - Array of required frontmatter keys. Supports dot notation
 *   for nested keys (e.g., ['title', 'author.name', 'date'])
 * @returns {{valid: boolean; missing: string[]}} Object containing:
 *   - valid: true if all required keys are present, false otherwise
 *   - missing: Array of missing key names
 *
 * @example
 * ```typescript
 * const content = `---
 * title: My Post
 * author:
 *   name: John Doe
 * ---
 * Content here...`;
 *
 * const result = validateFrontmatterRequired(content, ['title', 'author.name', 'date']);
 * console.log(result.valid); // false
 * console.log(result.missing); // ['date']
 * ```
 *
 * @example
 * ```typescript
 * // Validate simple frontmatter keys
 * const result = validateFrontmatterRequired(content, ['title', 'description']);
 * if (!result.valid) {
 *   console.error(`Missing required fields: ${result.missing.join(', ')}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Content without frontmatter - all keys are missing
 * const result = validateFrontmatterRequired('Just content', ['title']);
 * console.log(result.valid); // false
 * console.log(result.missing); // ['title']
 * ```
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
 * Executes a single validator against the provided content, checking all configured
 * validation rules (notContains, frontmatterRequired). Returns an error if any
 * validation rule fails.
 *
 * @param {string} content - The content to validate
 * @param {Validator} validator - The validator configuration object containing:
 *   - name: Name of the validator (used in error messages)
 *   - notContains: Optional pattern that should not appear in content
 *   - frontmatterRequired: Optional array of required frontmatter keys
 * @returns {ValidationError | null} ValidationError object if validation fails, null if all checks pass.
 *   The error contains the validator name and a descriptive message.
 *
 * @example
 * ```typescript
 * // Validate content doesn't contain TODOs
 * const validator = {
 *   name: 'no-todos',
 *   notContains: 'TODO'
 * };
 * const error = runValidator(content, validator);
 * if (error) {
 *   console.error(`${error.validator}: ${error.message}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Validate required frontmatter fields
 * const validator = {
 *   name: 'required-metadata',
 *   frontmatterRequired: ['title', 'author', 'date']
 * };
 * const error = runValidator(content, validator);
 * if (error) {
 *   console.error(error.message); // "Missing required frontmatter keys: date"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Combined validation
 * const validator = {
 *   name: 'content-quality',
 *   notContains: 'DRAFT',
 *   frontmatterRequired: ['title', 'status']
 * };
 * const error = runValidator(content, validator);
 * ```
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
 * Executes multiple validators against the provided content and collects all
 * validation errors. This is useful for running a complete validation suite
 * and reporting all issues at once.
 *
 * @param {string} content - The content to validate
 * @param {Validator[]} validators - Array of validator configurations to run
 * @returns {ValidationError[]} Array of validation errors. Empty array if all validations pass.
 *   Each error contains the validator name and a descriptive message.
 *
 * @example
 * ```typescript
 * // Run multiple validators
 * const validators = [
 *   { name: 'no-todos', notContains: 'TODO' },
 *   { name: 'required-fields', frontmatterRequired: ['title', 'date'] },
 *   { name: 'no-drafts', notContains: 'DRAFT' }
 * ];
 *
 * const errors = runValidators(content, validators);
 * if (errors.length > 0) {
 *   console.error('Validation failed:');
 *   errors.forEach(err => {
 *     console.error(`  ${err.validator}: ${err.message}`);
 *   });
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Validate with custom validators from config
 * const config = {
 *   validators: [
 *     { name: 'metadata-check', frontmatterRequired: ['title', 'author'] },
 *     { name: 'content-check', notContains: 'placeholder' }
 *   ]
 * };
 *
 * const errors = runValidators(processedContent, config.validators);
 * const isValid = errors.length === 0;
 * ```
 *
 * @example
 * ```typescript
 * // Empty validators array - always passes
 * const errors = runValidators(content, []);
 * console.log(errors.length); // 0
 * ```
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
