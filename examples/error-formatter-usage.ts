/**
 * Example usage of the error-formatter module
 *
 * This demonstrates how to use formatError() with different error types
 * and formatting options.
 */

import { formatError } from "../src/cli/error-formatter.js";

// Example 1: Basic error
console.log("=== Example 1: Basic Error ===");
const basicError = new Error("File not found");
console.log(formatError(basicError, { format: "text", colors: true, verbose: false }));
console.log();

// Example 2: KustomarkError with suggestions
console.log("=== Example 2: KustomarkError with Suggestions ===");
const kustomarkError = new Error("Section 'introduction' not found") as Error & {
  code: string;
  suggestions: string[];
};
kustomarkError.name = "PatchError";
kustomarkError.code = "SECTION_NOT_FOUND";
kustomarkError.suggestions = [
  "Did you mean 'Introduction' (capital I)?",
  "Check if the section exists in the document",
  "Available sections: overview, installation, usage",
];
console.log(formatError(kustomarkError, { format: "text", colors: true, verbose: false }));
console.log();

// Example 3: PatchError with position and snippet
console.log("=== Example 3: PatchError with Position and Snippet ===");
const patchError = new Error("Invalid patch syntax") as Error & {
  position: { line: number; column: number };
  snippet: string;
  suggestions: string[];
};
patchError.name = "PatchError";
patchError.position = { line: 42, column: 15 };
patchError.snippet = `## Header

Some content here
  Bad indentation
More content`;
patchError.suggestions = [
  "Remove extra indentation from line 4",
  "Ensure all lines use consistent spacing",
];
console.log(formatError(patchError, { format: "text", colors: true, verbose: false }));
console.log();

// Example 4: Error with context (verbose mode)
console.log("=== Example 4: Error with Context (Verbose) ===");
const contextError = new Error("HTTP request failed") as Error & {
  code: string;
  context: Record<string, unknown>;
};
contextError.name = "HttpFetchError";
contextError.code = "HTTP_ERROR";
contextError.context = {
  url: "https://api.example.com/data",
  statusCode: 404,
  method: "GET",
  retries: 3,
};
console.log(formatError(contextError, { format: "text", colors: true, verbose: true }));
console.log();

// Example 5: Error with cause chain
console.log("=== Example 5: Error with Cause Chain (Verbose) ===");
const rootCause = new Error("Connection timeout");
rootCause.name = "NetworkError";

const middleError = new Error("Failed to download resource") as Error & { cause: Error };
middleError.name = "DownloadError";
middleError.cause = rootCause;

const topError = new Error("Resource resolution failed") as Error & {
  cause: Error;
  suggestions: string[];
};
topError.name = "ResourceResolutionError";
topError.cause = middleError;
topError.suggestions = [
  "Check your network connection",
  "Verify the resource URL is correct",
  "Try again later",
];
console.log(formatError(topError, { format: "text", colors: true, verbose: true }));
console.log();

// Example 6: JSON format
console.log("=== Example 6: JSON Format ===");
const jsonError = new Error("Configuration validation failed") as Error & {
  code: string;
  suggestions: string[];
  context: Record<string, unknown>;
};
jsonError.name = "ValidationError";
jsonError.code = "INVALID_CONFIG";
jsonError.suggestions = [
  "Check the YAML syntax",
  "Ensure all required fields are present",
];
jsonError.context = {
  file: "kustomark.yaml",
  field: "patches[0].op",
};
console.log(formatError(jsonError, { format: "json", colors: false, verbose: true }));
console.log();

// Example 7: Without colors (for CI/logs)
console.log("=== Example 7: Without Colors (CI/Log friendly) ===");
const ciError = new Error("Build failed") as Error & { suggestions: string[] };
ciError.name = "BuildError";
ciError.suggestions = [
  "Run 'npm install' to install dependencies",
  "Check the build logs for details",
];
console.log(formatError(ciError, { format: "text", colors: false, verbose: false }));
