#!/usr/bin/env bun
/**
 * Example script demonstrating the test runner functionality
 *
 * Run with: bun examples/run-test-example.ts
 */

import { readFileSync } from "node:fs";
import { parseTestSuite, runTestSuite, validateTestSuite } from "../src/core/index.js";

// Load and parse the test suite
const yamlContent = readFileSync("examples/test-suite-example.yaml", "utf-8");
const suite = parseTestSuite(yamlContent);

// Validate the test suite
console.log("Validating test suite...");
const validation = validateTestSuite(suite);
if (!validation.valid) {
	console.error("Test suite validation failed:");
	for (const error of validation.errors) {
		console.error(`  - ${error.field}: ${error.message}`);
	}
	process.exit(1);
}
console.log("Test suite is valid!\n");

// Run the tests
console.log("Running tests...\n");
const results = runTestSuite(suite);

// Display results
console.log("=".repeat(60));
console.log("TEST RESULTS");
console.log("=".repeat(60));

for (const result of results.results) {
	const status = result.passed ? "PASS" : "FAIL";
	const icon = result.passed ? "✓" : "✗";
	console.log(`\n${icon} ${status}: ${result.name}`);

	if (!result.passed) {
		if (result.error) {
			console.log(`  Error: ${result.error}`);
		}
		if (result.diff) {
			console.log("\n  Diff:");
			for (const line of result.diff.split("\n")) {
				console.log(`  ${line}`);
			}
		}
	}

	if (result.warnings.length > 0) {
		console.log("\n  Warnings:");
		for (const warning of result.warnings) {
			console.log(`    - ${warning.message}`);
		}
	}
}

console.log("\n" + "=".repeat(60));
console.log(`Total: ${results.total}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log("=".repeat(60));

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);
