# Web Component Tests

This directory contains tests for the Kustomark web UI components.

## Test Files

### patch-editor.test.tsx

**NEW** - Comprehensive tests for the PatchEditor component (`/src/web/client/src/components/editor/PatchEditor.tsx`).

**Coverage includes (70+ test cases):**
1. **Initial Render and Empty State** (3 tests): Empty lists, no selection state, container structure
2. **Adding Patches** (5 tests): Creating patches, default values, auto-selection, sequential additions
3. **Patch Selection** (6 tests): Click selection, highlighting, custom IDs, navigation between patches
4. **Updating Patches** (6 tests): Field updates, preserving state, updating correct patch in array
5. **Deleting Patches** (7 tests): Deletion with confirmation, cancellation, index adjustments, empty list handling
6. **Moving Patches** (8 tests): Move up/down, boundary handling, selected index updates, long lists
7. **PatchForm Integration** (8 tests): Form display, operation type changes, field visibility
8. **PatchList Integration** (6 tests): Rendering all patches, descriptions, groups, keyboard navigation
9. **Edge Cases** (15 tests): Rapid operations, missing fields, long lists, special characters, unicode
10. **Validation and Error Handling** (5 tests): Empty fields, null values, callback errors
11. **Complex Workflows** (3 tests): Complete CRUD operations, reordering workflows, state consistency

### patch-form.test.tsx

Comprehensive tests for the PatchForm component (`/src/web/client/src/components/editor/PatchForm.tsx`).

**Coverage includes:**
1. **Rendering States**: Empty state, form rendering, all 18 operation types
2. **Common Fields**: id, extends, include, exclude, onNoMatch, group, validate
3. **Operation-Specific Fields**: All 18 patch operation types with their unique fields
4. **Operation Type Switching**: Field reset and default values
5. **Edge Cases**: Array handling, JSON parsing, multiline text, state persistence
6. **Accessibility**: Labels, ARIA attributes, required fields, helper text

### patch-list.test.tsx

Tests for the PatchList component with patch selection, deletion, and reordering.

## Setup

These test files use React Testing Library and vitest. To run these tests, you'll need to install the required dependencies:

### Install Dependencies

```bash
# In the web client directory
cd src/web/client

# Install testing dependencies
bun add -d vitest @vitejs/plugin-react
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom
bun add -d happy-dom # or jsdom
```

### Configure Vitest

Create or update `src/web/client/vite.config.ts` to include the test configuration:

```typescript
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],

  // ... existing config ...

  test: {
    globals: true,
    environment: "happy-dom", // or "jsdom"
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

### Create Test Setup File

Create `src/web/client/src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom";
```

### Update Package Scripts

Add test scripts to `src/web/client/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Running Tests

```bash
# Run all tests
cd src/web/client
bun test

# Run tests in watch mode
bun test:watch

# Run with UI
bun test:ui

# Run with coverage
bun test:coverage
```

Alternatively, from project root:

```bash
# Run specific test file
bun test tests/web/patch-form.test.tsx

# Run all web tests
bun test tests/web/
```

## PatchForm Component Tests Details

### Test Structure

Each test follows this pattern:
1. **Arrange**: Set up component with initial props
2. **Act**: Simulate user interactions (typing, clicking, selecting)
3. **Assert**: Verify expected behavior and state changes

Example:

```typescript
test("should update patch ID field", () => {
  const patch: PatchOperation = {
    op: "replace",
    old: "",
    new: "",
  };

  render(<PatchForm patch={patch} onChange={mockOnChange} />);

  const idInput = screen.getByLabelText(/Patch ID/) as HTMLInputElement;
  fireEvent.change(idInput, { target: { value: "my-patch-id" } });

  expect(mockOnChange).toHaveBeenCalledWith(
    expect.objectContaining({
      op: "replace",
      id: "my-patch-id",
    })
  );
});
```

### Operation Types Tested

All 18 patch operation types are thoroughly tested:
- `replace` - Simple string replacement
- `replace-regex` - Regex-based replacement
- `remove-section` - Remove markdown section
- `replace-section` - Replace section content
- `prepend-to-section` - Add content at section start
- `append-to-section` - Add content at section end
- `set-frontmatter` - Set frontmatter field
- `remove-frontmatter` - Remove frontmatter field
- `rename-frontmatter` - Rename frontmatter field
- `merge-frontmatter` - Merge multiple frontmatter fields
- `delete-between` - Delete content between markers
- `replace-between` - Replace content between markers
- `replace-line` - Replace entire lines
- `insert-after-line` - Insert content after line match
- `insert-before-line` - Insert content before line match
- `move-section` - Move section to new location
- `rename-header` - Rename section header
- `change-section-level` - Change heading level

## PatchEditor Component Tests Details

The PatchEditor tests provide integration testing for the complete patch editing workflow:

### Test Structure
- **Helper Functions**: `createReplacePatch()`, `createReplaceRegexPatch()`, `createRemoveSectionPatch()`, `createSetFrontmatterPatch()`
- **Mock Setup**: Uses Bun's `mock()` for callback functions
- **React Testing Library**: Follows best practices with `render()`, `screen` queries, `fireEvent()`, `rerender()`

### Key Test Scenarios

1. **State Management**: Tests verify that the component correctly manages selection state, especially during add/delete operations
2. **Parent-Child Communication**: Tests ensure proper callbacks to `onPatchesChange` with correct patch arrays
3. **User Experience**: Tests cover keyboard navigation, button states, confirmation dialogs
4. **Error Resilience**: Tests verify graceful handling of edge cases like missing fields and invalid operations

### Example Test Pattern

```typescript
test("should delete patch and deselect", () => {
  const patches = [createReplacePatch("old1", "new1"), createReplacePatch("old2", "new2")];
  global.confirm = mock(() => true);

  const { rerender } = render(<PatchEditor patches={patches} onPatchesChange={mockOnChange} />);

  // Select first patch
  const patchItems = screen.getAllByRole("button", { name: /#\d+ replace/i });
  fireEvent.click(patchItems[0]);

  // Delete it
  const deleteButtons = screen.getAllByTitle("Delete");
  fireEvent.click(deleteButtons[0]);

  // Verify callback and state
  const remainingPatches = mockOnChange.mock.calls[0][0];
  expect(remainingPatches).toHaveLength(1);

  // Re-render and verify deselection
  rerender(<PatchEditor patches={remainingPatches} onPatchesChange={mockOnChange} />);
  expect(screen.getByText("No patch selected")).toBeInTheDocument();
});
```

## PatchList Component Tests Details

The PatchList tests cover:
1. **Rendering**: Empty states, patch lists, labels, descriptions, groups
2. **Patch Selection**: Click and keyboard interactions
3. **Add Patch Button**: Button functionality
4. **Patch Deletion**: Confirmation dialogs and deletion flow
5. **Patch Reordering**: Move up/down with proper disabled states
6. **Edge Cases**: Long IDs, rapid changes, out-of-range indices
7. **Accessibility**: ARIA labels, keyboard navigation

## Notes

- The tests use `vitest` as specified, but can be adapted for Bun's native test runner if preferred
- All tests follow React Testing Library best practices
- Mock handlers are reset between tests using `beforeEach`
- Window.confirm is mocked for delete confirmation tests
- The tests cover both user interactions and component state management

## Troubleshooting

**Issue**: Tests fail with "Cannot find module '@testing-library/react'"
- **Solution**: Run `bun add -D @testing-library/react @testing-library/jest-dom` in the web client directory

**Issue**: Tests fail with "ReferenceError: document is not defined"
- **Solution**: Ensure jsdom/happy-dom is installed and environment is set in vitest config

**Issue**: Tests timeout or hang
- **Solution**: Check that all async operations use `await` and proper test utilities

## Best Practices

1. **Use semantic queries**: Prefer `getByLabelText`, `getByRole` over `getByTestId`
2. **Test user behavior**: Focus on what users do, not implementation details
3. **Keep tests isolated**: Each test should be independent
4. **Use descriptive test names**: Clearly state what is being tested
5. **Clean up**: Use `beforeEach` to reset mocks and state
