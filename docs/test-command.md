# Kustomark Test Command

The `kustomark test` command allows you to test patches against sample markdown content without creating full configurations. This is useful for:

- Developing and debugging patch operations
- Creating regression tests for patch behavior
- Validating patch logic before using in production
- Sharing reproducible examples of patch operations

## Core Functionality

### PatchTest Interface

A single test case with the following structure:

```typescript
interface PatchTest {
  name: string;           // Descriptive name for the test
  input: string;          // Input markdown content
  patches: PatchOperation[]; // Array of patches to apply
  expected: string;       // Expected output after applying patches
}
```

### PatchTestSuite Interface

A collection of test cases:

```typescript
interface PatchTestSuite {
  apiVersion: string;     // Must be "kustomark/v1"
  kind: string;           // Must be "PatchTestSuite"
  tests: PatchTest[];     // Array of test cases
}
```

### Test Result Types

Individual test result:

```typescript
interface TestResult {
  name: string;                      // Test name
  passed: boolean;                   // Whether the test passed
  actual: string;                    // Actual output
  expected: string;                  // Expected output
  diff?: string;                     // Unified diff (if failed)
  error?: string;                    // Error message (if execution failed)
  appliedPatches: number;            // Number of patches applied
  warnings: ValidationWarning[];     // Patch warnings
  validationErrors: ValidationError[]; // Validation errors
}
```

Test suite summary:

```typescript
interface TestSuiteResult {
  total: number;          // Total number of tests
  passed: number;         // Number of passed tests
  failed: number;         // Number of failed tests
  results: TestResult[];  // Individual test results
}
```

## Test Suite YAML Format

Create a test suite file with the following structure:

```yaml
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: test name
    input: |
      Input markdown content
    patches:
      - op: patch-operation
        # patch-specific fields
    expected: |
      Expected output content
```

### Example Test Suite

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

      Welcome.

      # Conclusion

      Thanks.
    patches:
      - op: remove-section
        id: conclusion
    expected: |
      # Introduction

      Welcome.

  - name: frontmatter update
    input: |
      ---
      title: Old Title
      ---

      Content
    patches:
      - op: set-frontmatter
        key: title
        value: New Title
    expected: |
      ---
      title: New Title
      ---

      Content

  - name: multiple patches
    input: |
      Hello World
      Version 1.0
    patches:
      - op: replace
        old: World
        new: Universe
      - op: replace
        old: "1.0"
        new: "2.0"
    expected: |
      Hello Universe
      Version 2.0
```

## Core API Usage

### Running a Single Test

```typescript
import { runPatchTest } from "kustomark";

const test = {
  name: "my test",
  input: "Hello World",
  patches: [
    { op: "replace", old: "World", new: "Universe" }
  ],
  expected: "Hello Universe"
};

const result = runPatchTest(test);

if (result.passed) {
  console.log(`✓ ${result.name} passed`);
} else {
  console.log(`✗ ${result.name} failed`);
  console.log(result.diff); // Show diff
}
```

### Running a Test Suite

```typescript
import { readFileSync } from "fs";
import { parseTestSuite, validateTestSuite, runTestSuite } from "kustomark";

// Load test suite
const yaml = readFileSync("tests.yaml", "utf-8");
const suite = parseTestSuite(yaml);

// Validate structure
const validation = validateTestSuite(suite);
if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
  process.exit(1);
}

// Run tests
const results = runTestSuite(suite);

console.log(`Total: ${results.total}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

// Display individual results
for (const result of results.results) {
  if (!result.passed) {
    console.log(`Failed: ${result.name}`);
    console.log(result.diff);
  }
}
```

## Test Features

### Automatic Diff Generation

When a test fails, the runner automatically generates a unified diff showing the difference between expected and actual output:

```diff
--- a/test: my test
+++ b/test: my test
@@ -1,2 +1,2 @@
 Hello
-World
+Universe
```

### Warning Collection

Tests collect warnings from patches that don't match:

```typescript
const result = runPatchTest({
  name: "warning test",
  input: "Hello World",
  patches: [
    { op: "replace", old: "NonExistent", new: "Replacement" }
  ],
  expected: "Hello World"
});

// result.warnings will contain:
// [{ message: "Patch 'replace 'NonExistent' with 'Replacement'' matched 0 times" }]
```

### Error Handling

Execution errors are captured in the result:

```typescript
const result = runPatchTest({
  name: "error test",
  input: "test",
  patches: [
    { op: "replace-regex", pattern: "[invalid", replacement: "x" }
  ],
  expected: "test"
});

// result.error will contain the error message
// result.passed will be false
```

## Test Suite Validation

The test suite parser performs comprehensive validation:

### Required Fields
- `apiVersion`: Must be "kustomark/v1"
- `kind`: Must be "PatchTestSuite"
- `tests`: Must be a non-empty array

### Test Validation
Each test must have:
- `name`: Non-empty string (must be unique within suite)
- `input`: String containing input content
- `patches`: Non-empty array of patch operations
- `expected`: String containing expected output

### Patch Validation
Each patch must have:
- `op`: Valid operation name
- Operation-specific fields (validated during execution)

### Example Validation Errors

```typescript
const validation = validateTestSuite(suite);

// Invalid apiVersion
// { field: "apiVersion", message: 'apiVersion must be "kustomark/v1"' }

// Duplicate test names
// { field: "tests[1].name", message: 'duplicate test name "my test"' }

// Missing patch operation
// { field: "tests[0].patches[0].op", message: "patch operation (op) is required" }
```

## Supported Patch Operations

All 22 Kustomark patch operations are supported in tests:

### String Operations
- `replace` - Simple string replacement
- `replace-regex` - Regex-based replacement
- `replace-line` - Replace entire lines
- `insert-after-line` - Insert content after matching line
- `insert-before-line` - Insert content before matching line

### Section Operations
- `remove-section` - Remove markdown sections
- `replace-section` - Replace section content
- `prepend-to-section` - Add content to section start
- `append-to-section` - Add content to section end
- `rename-header` - Rename section headers
- `move-section` - Move sections
- `change-section-level` - Change heading levels

### Frontmatter Operations
- `set-frontmatter` - Set frontmatter fields
- `remove-frontmatter` - Remove frontmatter fields
- `rename-frontmatter` - Rename frontmatter fields
- `merge-frontmatter` - Merge multiple frontmatter fields

### Marker-Based Operations
- `delete-between` - Delete content between markers
- `replace-between` - Replace content between markers

### File Operations (N/A in tests)
- `copy-file`, `rename-file`, `delete-file`, `move-file` - Not applicable to content tests

## Best Practices

### 1. Use Descriptive Test Names

```yaml
# Good
- name: replace environment variable references in deployment section

# Bad
- name: test1
```

### 2. Test One Concern Per Test

```yaml
# Good - separate tests for separate concerns
- name: update title in frontmatter
  # ...

- name: remove deprecated section
  # ...

# Bad - testing multiple unrelated things
- name: update everything
  # ...
```

### 3. Include Edge Cases

```yaml
tests:
  - name: replace when string exists
    # ...

  - name: replace when string does not exist
    # ...

  - name: replace with empty string
    # ...
```

### 4. Test Patch Sequences

```yaml
- name: multiple dependent patches
  input: |
    # Old Title
    Old content
  patches:
    - op: rename-header
      id: old-title
      new: New Title
    - op: replace
      old: Old content
      new: New content
  expected: |
    # New Title
    New content
```

### 5. Use Literal Block Scalars for Multi-line Content

```yaml
# Good - preserves formatting
input: |
  Line 1
  Line 2
  Line 3

# Bad - harder to read
input: "Line 1\nLine 2\nLine 3"
```

## Implementation Files

The test functionality is implemented in three core files:

1. **`src/core/types.ts`**
   - `PatchTest` - Individual test case interface
   - `PatchTestSuite` - Test suite structure
   - `TestResult` - Individual test result
   - `TestSuiteResult` - Suite execution summary

2. **`src/core/test-suite-parser.ts`**
   - `parseTestSuite()` - Parse YAML test files
   - `validateTestSuite()` - Validate test suite structure

3. **`src/core/test-runner.ts`**
   - `runPatchTest()` - Execute single test
   - `runTestSuite()` - Execute multiple tests

## Future CLI Integration

The `kustomark test` command will provide a CLI interface:

```bash
# Run a test suite
kustomark test my-tests.yaml

# Run with JSON output
kustomark test my-tests.yaml --json

# Watch mode (re-run on changes)
kustomark test my-tests.yaml --watch

# Run specific tests
kustomark test my-tests.yaml --filter "section*"
```

Example output:
```
Running test suite: my-tests.yaml

✓ PASS: simple string replacement
✓ PASS: section manipulation
✗ FAIL: frontmatter updates

  Expected:
  ---
  title: New Title
  ---

  Actual:
  ---
  title: Old Title
  ---

=================================
Total: 3
Passed: 2
Failed: 1
=================================
```
