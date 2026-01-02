/**
 * Test runner for Kustomark patch testing
 *
 * Executes patch tests against sample markdown content and validates
 * the output matches expected results. Supports both individual tests
 * and full test suites.
 */

import { generateDiff } from "./diff-generator.js";
import { applyPatches } from "./patch-engine.js";
import type { PatchTest, PatchTestSuite, TestResult, TestSuiteResult } from "./types.js";

/**
 * Run a single patch test
 *
 * Applies the patches to the input and compares the result with expected output.
 * Returns detailed test results including pass/fail status and diffs.
 *
 * @param test - The test case to run
 * @returns TestResult with detailed information about the test execution
 */
export function runPatchTest(test: PatchTest): TestResult {
  const { name, input, patches, expected } = test;

  try {
    // Apply patches to the input content
    const patchResult = applyPatches(input, patches, "warn");

    const actual = patchResult.content;
    const passed = actual === expected;

    // Generate diff if test failed
    let diff: string | undefined;
    if (!passed) {
      diff = generateDiff(expected, actual, `test: ${name}`);
    }

    return {
      name,
      passed,
      actual,
      expected,
      diff,
      appliedPatches: patchResult.applied,
      warnings: patchResult.warnings,
      validationErrors: patchResult.validationErrors,
    };
  } catch (error) {
    // Test execution failed with an error
    return {
      name,
      passed: false,
      actual: "",
      expected,
      error: error instanceof Error ? error.message : String(error),
      appliedPatches: 0,
      warnings: [],
      validationErrors: [],
    };
  }
}

/**
 * Run multiple patch tests from a test suite
 *
 * Executes all tests in the suite and returns aggregated results with
 * summary statistics.
 *
 * @param suite - The test suite to run
 * @returns TestSuiteResult with summary stats and individual test results
 */
export function runTestSuite(suite: PatchTestSuite): TestSuiteResult {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  // Run each test in the suite
  for (const test of suite.tests) {
    const result = runPatchTest(test);
    results.push(result);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  return {
    total: suite.tests.length,
    passed,
    failed,
    results,
  };
}
