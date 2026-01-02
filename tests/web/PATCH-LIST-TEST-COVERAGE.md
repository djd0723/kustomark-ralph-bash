# PatchList Component Test Coverage

## Overview

Comprehensive test suite for the PatchList component with **48 test cases** organized into **10 test suites**.

**Test File**: `/home/dex/kustomark-ralph-bash/tests/web/patch-list.test.tsx`
**Lines of Code**: 1,223
**Component Under Test**: `/home/dex/kustomark-ralph-bash/src/web/client/src/components/editor/PatchList.tsx`

## Test Suites

### 1. Rendering (9 tests)
- Empty state when no patches exist
- Add Patch button presence
- All patches rendered in the list
- Patch labels with operation types and indices
- Patch descriptions for each operation type
- Custom patch IDs displayed when provided
- Group badges for patches with groups
- Selected patch highlighting with proper CSS classes
- Truncation of long replacement text

### 2. Patch Selection (4 tests)
- Mouse click selection with `onSelect` callback
- Keyboard selection with Enter key
- Keyboard selection with Space key
- Sequential selection of different patches

### 3. Add Patch Button (2 tests)
- Single click triggering `onAdd` callback
- Multiple sequential clicks support

### 4. Patch Deletion (4 tests)
- Confirmation dialog display using `window.confirm`
- Deletion when confirmation is accepted
- Cancellation when confirmation is rejected
- Event propagation prevention (no selection on delete click)

### 5. Patch Reordering (7 tests)
- Move up and move down buttons rendered for each patch
- Move up button disabled for first patch
- Move down button disabled for last patch
- `onMoveUp` callback triggered correctly
- `onMoveDown` callback triggered correctly
- Event propagation prevention (no selection on reorder clicks)
- Single patch edge case (both buttons disabled)

### 6. Various Patch Types (9 tests)
Tests correct rendering and description for all patch operation types:
- `replace-section` - Shows section ID
- `delete-between` - Shows start and end markers
- `rename-frontmatter` - Shows old → new mapping
- `move-section` - Shows move operation details
- `merge-frontmatter` - Shows field count
- `insert-after-line` - Shows match parameter
- `insert-before-line` - Shows pattern parameter
- `rename-header` - Shows section ID
- `change-section-level` - Shows section ID

### 7. Edge Cases (6 tests)
- Very long patch IDs handling
- Empty group names
- Rapid selection changes
- Null selectedIndex
- Out-of-range selectedIndex values
- Scroll container presence for many patches

### 8. Accessibility (4 tests)
- ARIA labels on action buttons (move up, move down, delete)
- Focus management after reordering operations
- Keyboard navigation support
- Semantic HTML structure (proper use of list and listitem roles)

### 9. Integration Scenarios (3 tests)
- Complete workflow: add → select → reorder → delete
- State transition from empty to populated
- Updates when patches prop changes

## Mock Setup

All tests use properly isolated mock functions:
- `mockOnSelect` - Patch selection handler
- `mockOnAdd` - Add patch handler
- `mockOnDelete` - Delete patch handler
- `mockOnMoveUp` - Move up handler
- `mockOnMoveDown` - Move down handler
- `window.confirm` - Mocked for deletion confirmation tests

Mocks are reset in `beforeEach` and restored in `afterEach` hooks.

## Sample Test Data

The test suite uses realistic patch operation examples:
- **Replace**: Text substitution operations
- **Replace-Regex**: Pattern-based replacements with flags
- **Remove-Section**: Section deletion by ID
- **Set-Frontmatter**: Metadata key-value pairs
- And 14+ more operation types

## Coverage Areas

✅ **User Interactions**
- Click events
- Keyboard events (Enter, Space)
- Button interactions

✅ **Visual Rendering**
- Empty states
- Populated lists
- Selected states
- Disabled states
- Group badges
- Text truncation

✅ **Business Logic**
- Patch selection
- Patch deletion with confirmation
- Patch reordering with boundary checks
- Event propagation handling

✅ **Accessibility**
- ARIA labels
- Keyboard navigation
- Semantic HTML
- Focus management

✅ **Edge Cases**
- Empty lists
- Single item lists
- Long content
- Invalid indices
- Rapid interactions

## Running the Tests

See `/home/dex/kustomark-ralph-bash/tests/web/README.md` for setup instructions.

```bash
cd src/web/client
bun test patch-list.test.tsx
```

## Notes

- All tests follow React Testing Library best practices
- Tests use `userEvent` for realistic user interactions
- Tests use `screen` queries with accessible selectors
- No implementation details are tested (only user-visible behavior)
- Tests are isolated and can run in any order
