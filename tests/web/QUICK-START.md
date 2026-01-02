# Quick Start: Running PatchList Component Tests

## Prerequisites

The test file requires React Testing Library and vitest. These dependencies need to be installed first.

## Installation Steps

### Option 1: Using Bun (Recommended for this project)

```bash
# Navigate to web client directory
cd /home/dex/kustomark-ralph-bash/src/web/client

# Install testing dependencies
bun add -d vitest@latest
bun add -d @vitest/ui@latest
bun add -d @testing-library/react@latest
bun add -d @testing-library/user-event@latest
bun add -d @testing-library/jest-dom@latest
bun add -d happy-dom@latest
```

### Option 2: Alternative Test Environment

If you prefer jsdom instead of happy-dom:

```bash
bun add -d jsdom@latest
```

## Configuration

### 1. Update vite.config.ts

Add the test configuration to `/home/dex/kustomark-ralph-bash/src/web/client/vite.config.ts`:

```typescript
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],

  server: {
    // ... existing server config ...
  },

  build: {
    // ... existing build config ...
  },

  resolve: {
    // ... existing resolve config ...
  },

  // Add this test configuration
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["**/*.test.{ts,tsx}", "../../../tests/web/**/*.test.{ts,tsx}"],
  },
});
```

### 2. Create Test Setup File

Create `/home/dex/kustomark-ralph-bash/src/web/client/src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom";

// Mock window.matchMedia if needed
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### 3. Update package.json Scripts

Add to `/home/dex/kustomark-ralph-bash/src/web/client/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

## Running Tests

### Run All Tests

```bash
cd /home/dex/kustomark-ralph-bash/src/web/client
bun test
```

### Run Specific Test File

```bash
bun test ../../../tests/web/patch-list.test.tsx
```

### Run in Watch Mode

```bash
bun test:watch
```

### Run with UI

```bash
bun test:ui
```

### Run with Coverage

```bash
# Install coverage package first
bun add -d @vitest/coverage-v8

# Run with coverage
bun test:coverage
```

## Expected Output

When tests run successfully, you should see output like:

```
✓ tests/web/patch-list.test.tsx (48)
  ✓ PatchList Component (48)
    ✓ Rendering (9)
      ✓ should render empty state when no patches exist
      ✓ should render Add Patch button
      ✓ should render all patches in the list
      ... (6 more)
    ✓ Patch Selection (4)
      ✓ should call onSelect when clicking a patch
      ... (3 more)
    ... (8 more suites)

Test Files  1 passed (1)
     Tests  48 passed (48)
  Start at  HH:MM:SS
  Duration  XXXms
```

## Troubleshooting

### Issue: Cannot find module '@testing-library/react'

**Solution**: Make sure you installed all dependencies in the correct directory:

```bash
cd /home/dex/kustomark-ralph-bash/src/web/client
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

### Issue: Module not found: PatchList component

**Solution**: The test file uses relative imports. Make sure the paths are correct:

- Component: `../../src/web/client/src/components/editor/PatchList`
- Types: `../../src/web/client/src/types/config`

### Issue: window is not defined

**Solution**: Ensure `happy-dom` or `jsdom` is installed and configured in vite.config.ts:

```typescript
test: {
  environment: "happy-dom", // or "jsdom"
}
```

### Issue: Tests timeout

**Solution**: Increase the test timeout in vite.config.ts:

```typescript
test: {
  testTimeout: 10000, // 10 seconds
}
```

## Alternative: Run with Bun's Native Test Runner

If you prefer to use Bun's built-in test runner instead of vitest:

1. Update imports from `vitest` to `bun:test`
2. Install React testing dependencies
3. Configure Bun's test environment

```bash
# Run with Bun
bun test tests/web/patch-list.test.tsx
```

Note: This would require modifying the test file imports.

## Next Steps

After setting up and running tests:

1. Review test coverage with `bun test:coverage`
2. Add tests for other components
3. Integrate tests into CI/CD pipeline
4. Set up pre-commit hooks to run tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
