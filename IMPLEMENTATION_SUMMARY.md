# Kustomark Test Command Implementation Summary

## Overview

This implementation adds core functionality for the `kustomark test` command, which allows developers to test patches against sample markdown content without creating full configurations.

## Implementation Files

### 1. Type Definitions (`src/core/types.ts`)

Added the following type definitions:

- **`PatchTest`** - Individual patch test case
  - `name`: Test name
  - `input`: Input markdown content
  - `patches`: Array of patch operations to apply
  - `expected`: Expected output after applying patches

- **`PatchTestSuite`** - Test suite file structure
  - `apiVersion`: Must be "kustomark/v1"
  - `kind`: Must be "PatchTestSuite"
  - `tests`: Array of test cases

- **`TestResult`** - Result of running a single test
  - `name`: Test name
  - `passed`: Whether the test passed
  - `actual`: Actual output from applying patches
  - `expected`: Expected output
  - `diff`: Unified diff (if test failed)
  - `error`: Error message (if execution failed)
  - `appliedPatches`: Number of patches applied
  - `warnings`: Warnings from patch application
  - `validationErrors`: Validation errors from patches

- **`TestSuiteResult`** - Summary of test suite execution
  - `total`: Total number of tests
  - `passed`: Number of passed tests
  - `failed`: Number of failed tests
  - `results`: Individual test results

### 2. Test Suite Parser (`src/core/test-suite-parser.ts`)

Implements parsing and validation for test suite YAML files:

- **`parseTestSuite(yamlContent: string): PatchTestSuite`**
  - Parses YAML content into a PatchTestSuite object
  - Throws error for malformed YAML

- **`validateTestSuite(suite: PatchTestSuite): ValidationResult`**
  - Validates test suite structure
  - Checks required fields (apiVersion, kind, tests)
  - Validates each test case (name, input, patches, expected)
  - Detects duplicate test names
  - Ensures patches array is non-empty
  - Returns detailed validation errors

### 3. Test Runner (`src/core/test-runner.ts`)

Implements test execution logic:

- **`runPatchTest(test: PatchTest): TestResult`**
  - Applies patches to input content
  - Compares actual output with expected output
  - Generates unified diff for failures
  - Collects warnings and validation errors
  - Handles execution errors gracefully

- **`runTestSuite(suite: PatchTestSuite): TestSuiteResult`**
  - Executes all tests in a suite
  - Aggregates results with summary statistics
  - Returns individual test results and pass/fail counts

### 4. Module Exports (`src/core/index.ts`)

Updated to export:
- Test suite parser functions
- Test runner functions
- Test-related types

## Key Design Principles

### 1. Reuse Existing Patch Engine
- Uses `applyPatches()` from `patch-engine.ts`
- Leverages all existing patch operations
- Maintains consistency with build command behavior

### 2. Structured Results
- Returns detailed result objects (not just pass/fail)
- Includes diff generation for failed tests
- Captures warnings and validation errors
- Supports both text and JSON output formats

### 3. Comprehensive Validation
- Validates test suite structure before execution
- Checks for duplicate test names
- Ensures required fields are present
- Provides detailed error messages

### 4. Error Handling
- Gracefully handles patch execution errors
- Continues running remaining tests after failures
- Captures error messages in test results

### 5. Diff Generation
- Uses existing `generateDiff()` from `diff-generator.ts`
- Produces unified diff format (like git diff)
- Shows context around changes

## Usage Example

### Test Suite File (YAML)

```yaml
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: simple string replacement
    input: |
      Hello World
    patches:
      - op: replace
        old: World
        new: Universe
    expected: |
      Hello Universe

  - name: section removal
    input: |
      # Introduction
      Content here
      # Conclusion
      End
    patches:
      - op: remove-section
        id: conclusion
    expected: |
      # Introduction
      Content here
```

### Programmatic Usage

```typescript
import { parseTestSuite, validateTestSuite, runTestSuite } from "kustomark";

// Load and parse
const suite = parseTestSuite(yamlContent);

// Validate
const validation = validateTestSuite(suite);
if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
  process.exit(1);
}

// Run tests
const results = runTestSuite(suite);

console.log(`Passed: ${results.passed}/${results.total}`);
```

## Testing

The implementation includes comprehensive test coverage:

### Test Runner Tests (`tests/core/test-runner.test.ts`)
- Basic functionality (passing/failing tests)
- Multiple patch sequences
- All 22 patch operations
- Error handling
- Warning collection
- Test suite execution

### Test Suite Parser Tests (`tests/core/test-suite-parser.test.ts`)
- YAML parsing
- Validation of required fields
- Duplicate test name detection
- Invalid structure handling
- Edge cases

### Example Demonstration
- `examples/test-suite-example.yaml` - Sample test suite
- `examples/run-test-example.ts` - Executable demonstration

## Integration Points

### CLI Integration (Future)
The CLI already imports test functions (currently unused):
```typescript
import { parseTestSuite, validateTestSuite } from "../core/test-suite-parser.js";
import { runPatchTest, runTestSuite } from "../core/test-runner.js";
```

A future `kustomark test` command can use these functions directly.

### Documentation
- `docs/test-command.md` - Comprehensive documentation
- Usage examples
- Best practices
- API reference

## Supported Features

### All Patch Operations
The test runner supports all 22 Kustommark patch operations:

**String Operations:**
- replace, replace-regex, replace-line
- insert-after-line, insert-before-line

**Section Operations:**
- remove-section, replace-section
- prepend-to-section, append-to-section
- rename-header, move-section, change-section-level

**Frontmatter Operations:**
- set-frontmatter, remove-frontmatter
- rename-frontmatter, merge-frontmatter

**Marker-Based Operations:**
- delete-between, replace-between

**File Operations:**
- copy-file, rename-file, delete-file, move-file
  (Not applicable to content tests)

### Test Features
- Automatic diff generation
- Warning collection
- Validation error tracking
- Patch count reporting
- Error handling

## Files Modified/Created

### Core Implementation
- `src/core/types.ts` - Added test types
- `src/core/test-suite-parser.ts` - NEW
- `src/core/test-runner.ts` - NEW
- `src/core/index.ts` - Updated exports

### Documentation
- `docs/test-command.md` - NEW
- `IMPLEMENTATION_SUMMARY.md` - NEW (this file)

### Examples
- `examples/test-suite-example.yaml` - NEW
- `examples/run-test-example.ts` - NEW

### Tests
Existing test files already present:
- `tests/core/test-runner.test.ts`
- `tests/core/test-suite-parser.test.ts`

## Verification

Run the example to verify functionality:
```bash
bun examples/run-test-example.ts
```

Expected output:
```
Validating test suite...
Test suite is valid!

Running tests...

============================================================
TEST RESULTS
============================================================

✓ PASS: simple string replacement
✓ PASS: section manipulation
✓ PASS: frontmatter updates
✓ PASS: regex replacement
✓ PASS: multiple sequential patches

============================================================
Total: 5
Passed: 5
Failed: 0
============================================================
```

## Future Enhancements

The CLI command implementation will add:
1. Command-line interface for running tests
2. Watch mode for continuous testing
3. Test filtering by name pattern
4. JSON output format option
5. Colorized console output
6. Progress indicators
7. Test result caching

## Notes

- The implementation follows existing Kustomark patterns from `config-parser.ts` and `patch-engine.ts`
- All code passes TypeScript type checking and Biome linting
- Test suite validation mirrors the structure validation in `config-parser.ts`
- Diff generation reuses the existing `diff-generator.ts` module
- Error handling is consistent with other Kustomark core modules
