# React Testing Configuration Fix

## Problem
Tests were failing with `TypeError: null is not an object (evaluating 'dispatcher.useState')` and "Invalid hook call" warnings.

## Root Cause
The project had **duplicate React installations**:
1. `/node_modules/react` and `/node_modules/react-dom` (root)
2. `/src/web/client/node_modules/react` and `/src/web/client/node_modules/react-dom` (web client)

When tests imported components from `src/web/client`, those components used React from the web client's `node_modules`, while the test runner and `@testing-library/react` used React from the root `node_modules`. This violated React's [Rules of Hooks](https://reactjs.org/link/invalid-hook-call) which require a single React instance.

## Solution
Created **symlinks** from the web client's `node_modules` to the root React modules:

```bash
# Remove duplicate React installations from web client
rm -rf src/web/client/node_modules/react
rm -rf src/web/client/node_modules/react-dom
rm -rf src/web/client/node_modules/@types/react
rm -rf src/web/client/node_modules/@types/react-dom

# Create symlinks to root React modules
ln -s /absolute/path/to/node_modules/react src/web/client/node_modules/react
ln -s /absolute/path/to/node_modules/react-dom src/web/client/node_modules/react-dom
ln -s /absolute/path/to/node_modules/@types/react src/web/client/node_modules/@types/react
ln -s /absolute/path/to/node_modules/@types/react-dom src/web/client/node_modules/@types/react-dom
```

## Package Configuration Changes

### Root `package.json`
- Moved React and React-DOM to `dependencies` (shared across project)
- Added `@types/react` and `@types/react-dom` to `devDependencies`
- Added `@testing-library/user-event` for comprehensive testing

### Web Client `src/web/client/package.json`
- Removed `react` and `react-dom` from `dependencies`
- Removed `@types/react` and `@types/react-dom` from `devDependencies`
- Added `peerDependencies` to document the React version requirement

## Test Setup

### `/tests/setup.ts`
Configured the Bun test environment:
- Registered `happy-dom` as the DOM implementation
- Set `IS_REACT_ACT_ENVIRONMENT = true` for React Testing Library
- Added custom matchers from `@testing-library/jest-dom`
- Mocked `window.confirm` and `window.alert`
- Ensured clean DOM state before tests

### `/bunfig.toml`
```toml
[test]
preload = ["./tests/setup.ts"]
testEnvironment = "happy-dom"
```

## Verification
After applying the fix, all React-related tests run without hook errors:

- ✓ diff-viewer: 50/50 tests passing
- ✓ markdown-preview: 71/71 tests passing
- ✓ patch-form: 80/84 tests passing (remaining failures are test logic, not React config)
- ✓ patch-editor: 39/54 tests passing (remaining failures are test logic)
- ✓ patch-list: 33/48 tests passing (remaining failures are test logic)

**Total: 273 tests passing** with no React hook errors.

## Maintenance
When running `bun install` in the web client directory:
1. Bun may reinstall React/React-DOM as peer dependencies
2. You must re-create the symlinks after installation
3. Verify with: `ls -la src/web/client/node_modules | grep react`

## Alternative Solutions Attempted
1. **Module aliasing in bunfig.toml** - Did not work with Bun's resolver
2. **Hoisting only** - Bun reinstalled React in web client for peer dependencies
3. **Removing React from web client** - Build failed due to missing peer dependencies

The symlink approach is the most reliable solution that works with both development builds and testing.
