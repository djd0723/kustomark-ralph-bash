/**
 * Test suite parser for Kustomark test files
 *
 * Parses and validates PatchTestSuite YAML files for testing patches
 * against sample markdown content.
 */

import * as yaml from "js-yaml";
import type { PatchTestSuite, ValidationError, ValidationResult } from "./types.js";

/**
 * Parses a YAML string into a PatchTestSuite object
 *
 * @param yamlContent - YAML content as string
 * @returns Parsed PatchTestSuite object
 * @throws Error if YAML is malformed
 */
export function parseTestSuite(yamlContent: string): PatchTestSuite {
  try {
    const parsed = yaml.load(yamlContent);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Test suite must be a YAML object");
    }

    // Cast to unknown first, then to PatchTestSuite
    // The validation step will check the actual structure
    return parsed as PatchTestSuite;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates a parsed PatchTestSuite object
 *
 * @param suite - The test suite object to validate
 * @returns ValidationResult with errors and warnings
 */
export function validateTestSuite(suite: PatchTestSuite): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate apiVersion
  if (!suite.apiVersion) {
    errors.push({
      field: "apiVersion",
      message: "apiVersion is required",
    });
  } else if (suite.apiVersion !== "kustomark/v1") {
    errors.push({
      field: "apiVersion",
      message: `apiVersion must be "kustomark/v1", got "${suite.apiVersion}"`,
    });
  }

  // Validate kind
  if (!suite.kind) {
    errors.push({
      field: "kind",
      message: "kind is required",
    });
  } else if (suite.kind !== "PatchTestSuite") {
    errors.push({
      field: "kind",
      message: `kind must be "PatchTestSuite", got "${suite.kind}"`,
    });
  }

  // Validate tests array
  if (!suite.tests) {
    errors.push({
      field: "tests",
      message: "tests is required",
    });
  } else if (!Array.isArray(suite.tests)) {
    errors.push({
      field: "tests",
      message: "tests must be an array",
    });
  } else if (suite.tests.length === 0) {
    errors.push({
      field: "tests",
      message: "tests array cannot be empty",
    });
  } else {
    // Validate each test
    suite.tests.forEach((test, index) => {
      const testErrors = validateTest(test, index);
      errors.push(...testErrors);
    });

    // Validate test names are unique
    const nameErrors = validateTestNames(suite.tests);
    errors.push(...nameErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validates a single test case
 *
 * @param test - The test to validate
 * @param index - Index of the test in the tests array
 * @returns Array of validation errors
 */
function validateTest(test: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `tests[${index}]`;

  if (!test || typeof test !== "object") {
    errors.push({
      field: prefix,
      message: "test must be an object",
    });
    return errors;
  }

  // Type assertion after validation
  const t = test as Record<string, unknown>;

  // Validate name
  if (!t.name) {
    errors.push({
      field: `${prefix}.name`,
      message: "test name is required",
    });
  } else if (typeof t.name !== "string") {
    errors.push({
      field: `${prefix}.name`,
      message: "test name must be a string",
    });
  } else if (t.name.trim() === "") {
    errors.push({
      field: `${prefix}.name`,
      message: "test name cannot be empty",
    });
  }

  // Validate input
  if (t.input === undefined) {
    errors.push({
      field: `${prefix}.input`,
      message: "test input is required",
    });
  } else if (typeof t.input !== "string") {
    errors.push({
      field: `${prefix}.input`,
      message: "test input must be a string",
    });
  }

  // Validate patches
  if (!t.patches) {
    errors.push({
      field: `${prefix}.patches`,
      message: "test patches is required",
    });
  } else if (!Array.isArray(t.patches)) {
    errors.push({
      field: `${prefix}.patches`,
      message: "test patches must be an array",
    });
  } else if (t.patches.length === 0) {
    errors.push({
      field: `${prefix}.patches`,
      message: "test patches array cannot be empty",
    });
  } else {
    // Validate each patch has an 'op' field (detailed validation happens during execution)
    t.patches.forEach((patch: unknown, patchIndex: number) => {
      if (!patch || typeof patch !== "object") {
        errors.push({
          field: `${prefix}.patches[${patchIndex}]`,
          message: "patch must be an object",
        });
      } else {
        const p = patch as Record<string, unknown>;
        if (!p.op) {
          errors.push({
            field: `${prefix}.patches[${patchIndex}].op`,
            message: "patch operation (op) is required",
          });
        } else if (typeof p.op !== "string") {
          errors.push({
            field: `${prefix}.patches[${patchIndex}].op`,
            message: "patch operation (op) must be a string",
          });
        }
      }
    });
  }

  // Validate expected
  if (t.expected === undefined) {
    errors.push({
      field: `${prefix}.expected`,
      message: "test expected output is required",
    });
  } else if (typeof t.expected !== "string") {
    errors.push({
      field: `${prefix}.expected`,
      message: "test expected output must be a string",
    });
  }

  return errors;
}

/**
 * Validate test names are unique within the suite
 *
 * @param tests - Array of test cases
 * @returns Array of validation errors
 */
function validateTestNames(tests: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenNames = new Set<string>();

  tests.forEach((test, index) => {
    if (!test || typeof test !== "object") {
      return;
    }

    const t = test as Record<string, unknown>;

    if (t.name && typeof t.name === "string") {
      if (seenNames.has(t.name)) {
        errors.push({
          field: `tests[${index}].name`,
          message: `duplicate test name "${t.name}" (test names must be unique within a suite)`,
        });
      } else {
        seenNames.add(t.name);
      }
    }
  });

  return errors;
}
