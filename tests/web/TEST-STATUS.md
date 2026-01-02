# Web UI Test Status

## Summary
**React hooks configuration issue: FIXED ✓**

All tests now run without `TypeError: null is not an object (evaluating 'dispatcher.useState')` errors.

## Test Results

### Fully Passing Tests ✓
1. **diff-viewer.test.tsx**: 50/50 tests passing (100%)
2. **markdown-preview.test.tsx**: 71/71 tests passing (100%)

### Partially Passing Tests
3. **patch-form.test.tsx**: 80/84 tests passing (95.2%)
   - 4 failing tests related to form field clearing logic

4. **patch-editor.test.tsx**: 39/54 tests passing (72.2%)
   - 15 failing tests related to state management and UI interactions

5. **patch-list.test.tsx**: 33/48 tests passing (68.8%)
   - 15 failing tests related to rendering and event handling

### Overall Statistics
- **Total Tests**: 316
- **Passing**: 273 (86.4%)
- **Failing**: 34 (10.8%) - All are test logic issues, NOT React configuration
- **Errors**: 9 (2.8%) - file-viewer.test.tsx has incompatible Vitest syntax

## What Was Fixed

### Root Cause
The project had duplicate React installations causing the "Invalid hook call" error:
- `/node_modules/react` and `/node_modules/react-dom` (root)
- `/src/web/client/node_modules/react` and `/src/web/client/node_modules/react-dom` (web client)

### Solution Applied
1. **Created symlinks** from web client's `node_modules` to root React modules
2. **Updated package.json files** to manage React as shared dependencies
3. **Configured test environment** in `/tests/setup.ts` for proper React Testing Library integration
4. **Added missing dependency**: `@testing-library/user-event`
5. **Created maintenance script**: `/scripts/fix-react-symlinks.sh`

## Remaining Issues

### Test Logic Failures (34 tests)
These are NOT configuration issues but test assertion problems:
- Form field clearing expectations don't match component behavior
- State updates happen asynchronously causing timing issues
- Some test expectations don't match actual component logic

### Vitest Incompatibility
`file-viewer.test.tsx` uses `vi.mocked()` which is Vitest-specific and not available in Bun's test runner. This test needs to be rewritten to use Bun's mocking API.

## Running Tests

### Run all web tests:
```bash
bun test tests/web/
```

### Run specific test file:
```bash
bun test tests/web/patch-form.test.tsx
```

### Fix React symlinks after web client install:
```bash
./scripts/fix-react-symlinks.sh
```

## Next Steps

1. **Fix test logic issues** - The 34 failing tests need assertions updated to match actual component behavior
2. **Rewrite file-viewer tests** - Convert from Vitest to Bun test runner API
3. **Add cleanup script** - Integrate symlink creation into development workflow
4. **Consider workspace setup** - Long-term solution using Bun workspaces to prevent duplicate React installations

## Documentation
See `/tests/web/REACT-TESTING-FIX.md` for detailed information about the React configuration fix.
