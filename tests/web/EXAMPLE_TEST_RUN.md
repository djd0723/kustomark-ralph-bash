# Example Test Run - PatchForm Component

## Quick Test Example

Here's a quick example of how to run and verify the PatchForm tests.

### Step 1: Install Dependencies

```bash
cd /home/dex/kustomark-ralph-bash/src/web/client

# Install testing dependencies
bun add -D vitest @vitejs/plugin-react
bun add -D @testing-library/react @testing-library/jest-dom
bun add -D happy-dom
```

### Step 2: Configure Vitest

Update or create `src/web/client/vite.config.ts`:

```typescript
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: "localhost",
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        ws: true,
      },
    },
  },

  build: {
    outDir: resolve(__dirname, "../../../dist/web/client"),
    emptyOutDir: true,
    sourcemap: true,
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },

  // Add test configuration
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

### Step 3: Create Test Setup File

```bash
mkdir -p src/web/client/src/test
cat > src/web/client/src/test/setup.ts << 'SETUP'
import "@testing-library/jest-dom";
SETUP
```

### Step 4: Run the Tests

```bash
# From project root
cd /home/dex/kustomark-ralph-bash
bun test tests/web/patch-form.test.tsx

# Or run a specific test
bun test tests/web/patch-form.test.tsx -t "should render empty state"

# Run with coverage
bun test --coverage tests/web/patch-form.test.tsx

# Run in watch mode
bun test --watch tests/web/patch-form.test.tsx
```

## Example Test Output

When you run the tests successfully, you should see output like:

```
 ✓ tests/web/patch-form.test.tsx (70)
   ✓ PatchForm Component (70)
     ✓ Rendering States (3)
       ✓ should render empty state when patch is null
       ✓ should render form when patch is provided
       ✓ should display all 18 operation types in dropdown
     ✓ Common Fields (13)
       ✓ should render and update patch ID field
       ✓ should clear patch ID when empty
       ✓ should handle extends as single string
       ✓ should handle extends as array when comma-separated
       ... (and so on)

 Test Files  1 passed (1)
      Tests  70 passed (70)
   Start at  13:48:00
   Duration  2.34s
```

## Testing Individual Operations

You can test specific operations by using the test name filter:

```bash
# Test only the replace operation
bun test tests/web/patch-form.test.tsx -t "Operation Type: replace"

# Test only frontmatter operations
bun test tests/web/patch-form.test.tsx -t "frontmatter"

# Test only edge cases
bun test tests/web/patch-form.test.tsx -t "Edge Cases"
```

## Debugging Tests

### Enable Verbose Output

```bash
bun test tests/web/patch-form.test.tsx --reporter=verbose
```

### Debug Individual Test

```bash
bun test tests/web/patch-form.test.tsx -t "should update patch ID field" --reporter=verbose
```

### Check Test Coverage

```bash
bun test --coverage tests/web/patch-form.test.tsx --coverage.reporter=html
```

This will generate an HTML coverage report you can view in your browser.

## Common Issues and Solutions

### Issue: "Cannot find module '@testing-library/react'"

**Solution:**
```bash
cd src/web/client
bun add -D @testing-library/react @testing-library/jest-dom
```

### Issue: "document is not defined"

**Solution:** Ensure your vite.config.ts has:
```typescript
test: {
  environment: "happy-dom",
}
```

### Issue: Tests timeout

**Solution:** Increase timeout in vite.config.ts:
```typescript
test: {
  testTimeout: 10000,
}
```

## Example: Adding a New Test

Here's how to add a new test for a new field:

```typescript
test("should handle new field", () => {
  const patch: PatchOperation = {
    op: "replace",
    old: "",
    new: "",
  };

  render(<PatchForm patch={patch} onChange={mockOnChange} />);

  const newInput = screen.getByLabelText(/New Field/) as HTMLInputElement;
  fireEvent.change(newInput, { target: { value: "test value" } });

  expect(mockOnChange).toHaveBeenCalledWith(
    expect.objectContaining({
      newField: "test value",
    })
  );
});
```

## Continuous Integration

To run tests in CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: cd src/web/client && bun install
      - run: bun test tests/web/patch-form.test.tsx
```

## Next Steps

1. Run the tests to verify everything works
2. Add more tests as you develop new features
3. Maintain high test coverage (aim for >80%)
4. Run tests before committing changes
5. Use watch mode during development

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
