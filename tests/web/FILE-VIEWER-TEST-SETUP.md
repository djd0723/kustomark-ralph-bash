# FileViewer Test Setup Guide

This document provides instructions for setting up and running the FileViewer component tests.

## Required Dependencies

To run the FileViewer tests, you need to install the following dependencies:

### Testing Framework
```bash
bun add -d vitest @vitest/ui
```

### React Testing Library
```bash
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

### JSDOM (for browser environment simulation)
```bash
bun add -d jsdom happy-dom
```

## Configuration

### 1. Create Vitest Configuration

Create a `vitest.config.ts` file in the project root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 2. Create Test Setup File

Create a `tests/setup.ts` file:

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

Add the following scripts to your root `package.json`:

```json
{
  "scripts": {
    "test:web": "vitest run tests/web/",
    "test:web:watch": "vitest watch tests/web/",
    "test:web:ui": "vitest --ui tests/web/",
    "test:web:coverage": "vitest run tests/web/ --coverage"
  }
}
```

## Running the Tests

### Run all web tests
```bash
bun run test:web
```

### Run tests in watch mode
```bash
bun run test:web:watch
```

### Run specific test file
```bash
bun vitest tests/web/file-viewer.test.tsx
```

### Run with UI
```bash
bun run test:web:ui
```

### Run with coverage
```bash
bun run test:web:coverage
```

## Test Coverage

The FileViewer test suite covers:

1. **File Content Display**
   - Rendering file content after successful API fetch
   - Displaying file path in header
   - Handling multiline content
   - Empty file rendering

2. **Syntax Highlighting**
   - Language class application for different file types (TypeScript, JavaScript, JSON, Markdown, YAML, Python, etc.)
   - Fallback to plaintext for unknown extensions

3. **Line Numbers and Formatting**
   - Monospace font application
   - Proper font size and line height
   - Code block structure

4. **Error Handling**
   - API failure error messages
   - Network errors
   - 404 errors
   - Error recovery when switching files

5. **Empty File Handling**
   - Empty file rendering
   - Whitespace-only files
   - Copy button availability

6. **Loading States**
   - Loading spinner display
   - Loading message
   - Animation classes

7. **No File Selected State**
   - Empty state message
   - File icon display

8. **Copy to Clipboard**
   - Clipboard API integration
   - Success feedback
   - Timeout behavior
   - Error handling

9. **File Path Changes**
   - Fetching new files on prop changes
   - Clearing content when filePath becomes null
   - Avoiding unnecessary API calls

10. **Component Structure**
    - Container styling
    - Header layout
    - Content area overflow handling

## Troubleshooting

### Issue: "Cannot find module '@testing-library/react'"
**Solution:** Make sure you've installed all required dependencies:
```bash
bun add -d @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

### Issue: "ReferenceError: document is not defined"
**Solution:** Ensure your vitest config has `environment: 'jsdom'` set.

### Issue: "Cannot read property 'clipboard' of undefined"
**Solution:** This is handled by mocking navigator.clipboard in the test. Make sure the mock is set up in the beforeEach hook.

### Issue: Tests fail with "vi is not defined"
**Solution:** Add `globals: true` to your vitest config or import `vi` from 'vitest'.

## Alternative: Running with Bun Test

If you prefer to use Bun's built-in test runner instead of vitest, you can convert the tests by:

1. Replace `vitest` imports with `bun:test`
2. Replace `@testing-library/react` with a compatible React testing solution for Bun
3. Update the test setup accordingly

Note: The current tests are designed for vitest as requested.
