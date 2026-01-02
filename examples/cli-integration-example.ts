/**
 * Example showing how to integrate error-formatter into CLI commands
 *
 * This demonstrates a typical pattern for using formatError in a CLI command
 */

import { formatError } from "../src/cli/error-formatter.js";

// Simulated CLI options interface (similar to what exists in other CLI commands)
interface CLIOptions {
  format: "text" | "json";
  verbosity: number;
  quiet?: boolean;
}

/**
 * Example CLI command function
 * This demonstrates the typical error handling pattern
 */
async function exampleCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    // Simulate some operation that might fail
    const shouldFail = true;

    if (shouldFail) {
      // Create a rich error with context
      const error = new Error("Failed to process configuration") as Error & {
        code: string;
        context: Record<string, unknown>;
        suggestions: string[];
      };
      error.name = "ConfigurationError";
      error.code = "INVALID_PATCH";
      error.context = {
        file: path,
        operation: "validate",
      };
      error.suggestions = [
        "Check that all patch operations are valid",
        "Ensure section IDs match document structure",
        "Run 'kustomark lint' to identify issues",
      ];

      throw error;
    }

    // Success case
    if (!options.quiet) {
      console.log("Operation completed successfully");
    }
    return 0;
  } catch (error) {
    // Use formatError to display the error
    const errorMessage =
      error instanceof Error
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
}

// Example usage with text output
console.log("=== Example 1: Text output (normal verbosity) ===");
await exampleCommand("kustomark.yaml", { format: "text", verbosity: 1 });
console.log();

// Example usage with verbose text output
console.log("=== Example 2: Text output (verbose) ===");
await exampleCommand("kustomark.yaml", { format: "text", verbosity: 2 });
console.log();

// Example usage with JSON output
console.log("=== Example 3: JSON output ===");
await exampleCommand("kustomark.yaml", { format: "json", verbosity: 1 });
