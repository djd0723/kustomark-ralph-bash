# Error Formatter Examples

This directory contains examples demonstrating the `error-formatter` module located at `/home/dex/kustomark-ralph-bash/src/cli/error-formatter.ts`.

## Overview

The error formatter provides rich, colorful error display for CLI applications with support for:

- Basic Error formatting
- KustomarkError with suggestions, context, and error codes
- PatchError with position and code snippets
- Cause chain tracking
- JSON and text output formats
- Verbose mode with stack traces
- Color control for TTY and CI/log environments

## Running Examples

### Basic Usage Examples

```bash
bun run examples/error-formatter-usage.ts
```

This demonstrates:
- Basic error formatting
- KustomarkError with suggestions
- PatchError with position and snippet
- Error with context (verbose mode)
- Error with cause chain
- JSON format output
- Output without colors (CI-friendly)

### CLI Integration Example

```bash
bun run examples/cli-integration-example.ts
```

This demonstrates:
- How to integrate the formatter into a CLI command
- Error handling pattern used in kustomark CLI commands
- Different verbosity levels
- Format switching (text vs JSON)

## API Reference

### `formatError(error: Error, options: ErrorFormattingOptions): string`

Formats an error for CLI display.

**Parameters:**
- `error`: The error to format
- `options`: Formatting options
  - `format`: "text" or "json" - Output format
  - `colors`: boolean - Whether to use ANSI colors
  - `verbose`: boolean - Whether to include verbose information

**Returns:** Formatted error string

## Error Types

### KustomarkError

Errors with additional context beyond standard Error:

```typescript
interface KustomarkError extends Error {
  code?: string;
  context?: Record<string, unknown>;
  suggestions?: string[];
  cause?: Error;
}
```

### PatchError

Errors with code position and snippet:

```typescript
interface PatchError extends KustomarkError {
  position?: {
    line?: number;
    column?: number;
  };
  snippet?: string;
}
```

## Color Scheme

- **Red**: Error header and type
- **Yellow**: Code snippets and highlights
- **Cyan**: Suggestions
- **Gray**: Context, metadata, and cause chain
- **Dim**: Stack traces and position information

## Integration Pattern

```typescript
import { formatError } from "./error-formatter.js";

try {
  // Your CLI command logic
} catch (error) {
  const errorMessage = error instanceof Error
    ? formatError(error, {
        format: options.format,
        colors: process.stdout.isTTY && options.format === "text",
        verbose: options.verbosity >= 2,
      })
    : String(error);

  if (options.format === "json") {
    console.log(errorMessage);
  } else {
    console.error(errorMessage);
  }

  return 1;
}
```

## Notes

- The formatter uses ANSI color codes directly (not chalk) to match the project's existing patterns
- Colors are automatically disabled for non-TTY environments when `colors: false`
- Verbose mode includes stack traces and context information
- JSON mode includes all error properties in a structured format
- Cause chains are traversed up to 5 levels deep to prevent infinite loops
