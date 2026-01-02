# Kustomark Test Examples

This directory contains examples demonstrating the test functionality.

## Files

- **`test-suite-example.yaml`** - Sample test suite with 5 different test cases
- **`run-test-example.ts`** - Executable script demonstrating programmatic test execution

## Running the Example

```bash
bun examples/run-test-example.ts
```

This will:
1. Load the test suite from `test-suite-example.yaml`
2. Validate the test suite structure
3. Run all 5 tests
4. Display results with pass/fail indicators
5. Exit with code 0 (all tests pass) or 1 (some tests fail)

## Test Cases Included

1. **Simple string replacement** - Basic replace operation
2. **Section manipulation** - Removing markdown sections
3. **Frontmatter updates** - Setting multiple frontmatter fields
4. **Regex replacement** - Pattern-based replacements
5. **Multiple sequential patches** - Chaining multiple patch operations

## Creating Your Own Tests

Create a YAML file with this structure:

```yaml
apiVersion: kustomark/v1
kind: PatchTestSuite
tests:
  - name: your test name
    input: |
      Input markdown here
    patches:
      - op: patch-operation
        # operation-specific fields
    expected: |
      Expected output here
```

Then run it programmatically:

```typescript
import { readFileSync } from "fs";
import { parseTestSuite, validateTestSuite, runTestSuite } from "kustomark";

const yaml = readFileSync("your-tests.yaml", "utf-8");
const suite = parseTestSuite(yaml);

const validation = validateTestSuite(suite);
if (!validation.valid) {
  console.error(validation.errors);
  process.exit(1);
}

const results = runTestSuite(suite);
console.log(`Passed: ${results.passed}/${results.total}`);
```

## See Also

- [Test Command Documentation](../docs/test-command.md)
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md)
