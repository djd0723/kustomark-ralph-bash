/**
 * Template Variable Substitution Module
 *
 * Handles variable substitution for templates using {{VARIABLE_NAME}} syntax.
 * Supports validation of required variables and detection of unused variables.
 */

import type { ValidationError, ValidationWarning } from "../types.js";
import type { TemplateValues, TemplateVariable } from "./types.js";

/**
 * Regular expression for matching template variables
 * Matches {{VARIABLE_NAME}} where VARIABLE_NAME is all caps with underscores
 */
const VARIABLE_PATTERN = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

/**
 * Regular expression for matching escaped variables
 * Matches \{{VARIABLE_NAME}} to prevent substitution
 */
const ESCAPED_VARIABLE_PATTERN = /\\\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

/**
 * Substitute template variables in content
 *
 * Variables are in the format {{VARIABLE_NAME}} where VARIABLE_NAME is
 * all caps with underscores (snake case). Variables can be escaped with
 * a backslash: \{{VARIABLE_NAME}} to prevent substitution.
 *
 * @param content - Content with variable placeholders
 * @param variables - Variable substitution map
 * @returns Substituted content with escaped variables unescaped
 *
 * @example
 * ```typescript
 * const content = "Hello {{NAME}}, welcome to {{ORG}}!";
 * const variables = { NAME: "Alice", ORG: "Acme Corp" };
 * const result = substituteVariables(content, variables);
 * // Returns: "Hello Alice, welcome to Acme Corp!"
 * ```
 */
export function substituteVariables(content: string, variables: TemplateValues): string {
  // First, protect escaped variables by temporarily replacing them
  const escapedVars: Array<{ placeholder: string; original: string }> = [];
  let result = content.replace(ESCAPED_VARIABLE_PATTERN, (_, varName) => {
    const placeholder = `__ESCAPED_${escapedVars.length}__`;
    escapedVars.push({ placeholder, original: `{{${varName}}}` });
    return placeholder;
  });

  // Replace each variable with its value
  for (const [key, value] of Object.entries(variables)) {
    // Convert value to string if it's not already
    const stringValue = convertToString(value);

    // Create a regex to match this specific variable
    const placeholder = `{{${key}}}`;
    // Escape special regex characters in the placeholder
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedPlaceholder, "g");

    result = result.replace(regex, stringValue);
  }

  // Restore escaped variables (without the backslash)
  for (const { placeholder, original } of escapedVars) {
    result = result.replace(placeholder, original);
  }

  return result;
}

/**
 * Convert a template value to a string for substitution
 *
 * @param value - Value to convert
 * @returns String representation of the value
 */
function convertToString(value: string | boolean | number | string[]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

/**
 * Extract all variable names from content
 *
 * Finds all {{VARIABLE_NAME}} patterns and returns unique variable names.
 * Ignores escaped variables (\{{VARIABLE_NAME}}).
 *
 * @param content - Content to search for variables
 * @returns Array of unique variable names (sorted alphabetically)
 *
 * @example
 * ```typescript
 * const content = "Hello {{NAME}}, your {{ROLE}} is {{ROLE}}. \{{ESCAPED}} won't be extracted.";
 * const variables = extractVariableNames(content);
 * // Returns: ["NAME", "ROLE"]
 * ```
 */
export function extractVariableNames(content: string): string[] {
  // First, remove escaped variables temporarily so they don't get matched
  const contentWithoutEscaped = content.replace(ESCAPED_VARIABLE_PATTERN, "");

  const variables = new Set<string>();
  const regex = new RegExp(VARIABLE_PATTERN);

  let match = regex.exec(contentWithoutEscaped);
  while (match !== null) {
    if (match[1]) {
      variables.add(match[1]);
    }
    match = regex.exec(contentWithoutEscaped);
  }

  // Return sorted array for consistent output
  return Array.from(variables).sort();
}

/**
 * Validate that all required variables are provided
 *
 * Checks that each required variable has a value in the provided variables map.
 * Returns validation errors for any missing required variables.
 *
 * @param requiredVariables - Array of required template variables
 * @param providedVariables - Variables provided by user
 * @returns Array of validation errors (empty if all required variables are provided)
 *
 * @example
 * ```typescript
 * const required = [
 *   { name: "NAME", required: true, type: "string", description: "User name" },
 *   { name: "ORG", required: true, type: "string", description: "Organization" }
 * ];
 * const provided = { NAME: "Alice" };
 * const errors = validateRequiredVariables(required, provided);
 * // Returns: [{ variable: "ORG", message: "Required variable 'ORG' not provided..." }]
 * ```
 */
export function validateRequiredVariables(
  requiredVariables: TemplateVariable[],
  providedVariables: TemplateValues,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const variable of requiredVariables) {
    // Skip if not required
    if (!variable.required) {
      continue;
    }

    // Check if variable is provided
    const value = providedVariables[variable.name];
    if (value === undefined || value === null || value === "") {
      errors.push({
        field: `variables.${variable.name}`,
        message: `Required variable '${variable.name}' not provided. ${variable.description}`,
      });
    } else {
      // Validate type if provided
      const typeError = validateVariableType(variable, value);
      if (typeError) {
        errors.push(typeError);
      }

      // Validate pattern if provided
      if (variable.pattern && variable.type === "string" && typeof value === "string") {
        const patternError = validateVariablePattern(variable, value);
        if (patternError) {
          errors.push(patternError);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate that a variable value matches its expected type
 *
 * @param variable - Template variable definition
 * @param value - Value to validate
 * @returns ValidationError if type doesn't match, null otherwise
 */
function validateVariableType(
  variable: TemplateVariable,
  value: string | boolean | number | string[],
): ValidationError | null {
  const actualType = Array.isArray(value) ? "array" : typeof value;

  // Type mapping
  const expectedType = variable.type;
  let isValid = false;

  switch (expectedType) {
    case "string":
      isValid = typeof value === "string";
      break;
    case "boolean":
      isValid = typeof value === "boolean";
      break;
    case "number":
      isValid = typeof value === "number";
      break;
    case "array":
      isValid = Array.isArray(value);
      break;
  }

  if (!isValid) {
    return {
      field: `variables.${variable.name}`,
      message: `Variable '${variable.name}' must be of type '${expectedType}', got '${actualType}'`,
    };
  }

  return null;
}

/**
 * Validate that a string variable value matches its pattern
 *
 * @param variable - Template variable definition
 * @param value - String value to validate
 * @returns ValidationError if pattern doesn't match, null otherwise
 */
function validateVariablePattern(
  variable: TemplateVariable,
  value: string,
): ValidationError | null {
  if (!variable.pattern) {
    return null;
  }

  try {
    const regex = new RegExp(variable.pattern);
    if (!regex.test(value)) {
      return {
        field: `variables.${variable.name}`,
        message: `Variable '${variable.name}' value '${value}' does not match required pattern: ${variable.pattern}`,
      };
    }
  } catch (error) {
    // Invalid regex pattern in template definition
    return {
      field: `variables.${variable.name}`,
      message: `Invalid pattern for variable '${variable.name}': ${variable.pattern}`,
    };
  }

  return null;
}

/**
 * Detect unused variables
 *
 * Compares provided variables against variables found in content.
 * Returns warnings for variables that were provided but not used.
 *
 * @param providedVariables - Variables provided by user
 * @param contentVariables - Variables found in content (from extractVariableNames)
 * @returns Array of warnings for unused variables (empty if all variables are used)
 *
 * @example
 * ```typescript
 * const provided = { NAME: "Alice", ORG: "Acme", EXTRA: "unused" };
 * const found = ["NAME", "ORG"];
 * const warnings = detectUnusedVariables(provided, found);
 * // Returns: [{ field: "variables.EXTRA", message: "Variable 'EXTRA' provided but not used..." }]
 * ```
 */
export function detectUnusedVariables(
  providedVariables: TemplateValues,
  contentVariables: string[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const usedVariables = new Set(contentVariables);

  for (const variableName of Object.keys(providedVariables)) {
    if (!usedVariables.has(variableName)) {
      warnings.push({
        field: `variables.${variableName}`,
        message: `Variable '${variableName}' provided but not used in any template files`,
      });
    }
  }

  return warnings;
}

/**
 * Apply defaults to variables that weren't provided
 *
 * For any variable that has a default value and wasn't provided,
 * adds the default value to the variables map.
 *
 * @param templateVariables - Array of template variable definitions
 * @param providedVariables - Variables provided by user
 * @returns New variables map with defaults applied
 *
 * @example
 * ```typescript
 * const template = [
 *   { name: "NAME", required: true, type: "string", description: "Name" },
 *   { name: "VERSION", required: false, type: "string", description: "Version", default: "1.0.0" }
 * ];
 * const provided = { NAME: "Alice" };
 * const withDefaults = applyDefaultValues(template, provided);
 * // Returns: { NAME: "Alice", VERSION: "1.0.0" }
 * ```
 */
export function applyDefaultValues(
  templateVariables: TemplateVariable[],
  providedVariables: TemplateValues,
): TemplateValues {
  const result: TemplateValues = { ...providedVariables };

  for (const variable of templateVariables) {
    // If variable not provided and has a default, use the default
    if (
      (result[variable.name] === undefined ||
        result[variable.name] === null ||
        result[variable.name] === "") &&
      variable.default !== undefined
    ) {
      result[variable.name] = variable.default;
    }
  }

  return result;
}

/**
 * Validate variables in file path
 *
 * Validates that all variables in a destination file path are provided.
 * File paths can contain variables like "{{ORG}}/{{REPO}}/README.md".
 *
 * @param destPath - Destination file path (may contain variables)
 * @param providedVariables - Variables provided by user
 * @returns Array of validation errors for missing variables in path
 *
 * @example
 * ```typescript
 * const path = "{{ORG}}/{{REPO}}/README.md";
 * const provided = { ORG: "acme" };
 * const errors = validatePathVariables(path, provided);
 * // Returns: [{ file: path, message: "Required variable 'REPO' not provided in file path..." }]
 * ```
 */
export function validatePathVariables(
  destPath: string,
  providedVariables: TemplateValues,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const variablesInPath = extractVariableNames(destPath);

  for (const variable of variablesInPath) {
    const value = providedVariables[variable];
    if (value === undefined || value === null || value === "") {
      errors.push({
        file: destPath,
        message: `Required variable '${variable}' not provided in file path: ${destPath}`,
      });
    }
  }

  return errors;
}

/**
 * Substitute variables in a file path
 *
 * Replaces {{VARIABLE_NAME}} placeholders in a destination path with actual values.
 * This is used to generate dynamic file paths based on template variables.
 *
 * @param destPath - Destination file path (may contain variables)
 * @param variables - Variable substitution map
 * @returns Path with all variables substituted
 *
 * @example
 * ```typescript
 * const path = "{{ORG}}/{{REPO}}/README.md";
 * const variables = { ORG: "acme", REPO: "widget" };
 * const result = substitutePathVariables(path, variables);
 * // Returns: "acme/widget/README.md"
 * ```
 */
export function substitutePathVariables(destPath: string, variables: TemplateValues): string {
  return substituteVariables(destPath, variables);
}
