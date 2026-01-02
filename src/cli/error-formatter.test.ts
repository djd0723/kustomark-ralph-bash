/**
 * Tests for error-formatter module
 */

import { describe, expect, test } from "bun:test";
import { type ErrorFormattingOptions, formatError } from "./error-formatter.js";

describe("formatError", () => {
  const defaultOptions: ErrorFormattingOptions = {
    format: "text",
    colors: false,
    verbose: false,
  };

  test("formats basic Error", () => {
    const error = new Error("Something went wrong");
    const result = formatError(error, defaultOptions);

    expect(result).toContain("✖ Error");
    expect(result).toContain("Something went wrong");
  });

  test("formats error with custom name", () => {
    const error = new Error("Custom error");
    error.name = "CustomError";
    const result = formatError(error, defaultOptions);

    expect(result).toContain("✖ CustomError");
    expect(result).toContain("Custom error");
  });

  test("formats KustomarkError with code", () => {
    const error = new Error("Config validation failed") as Error & { code: string };
    error.name = "ValidationError";
    error.code = "INVALID_CONFIG";

    const result = formatError(error, { ...defaultOptions, verbose: true });

    expect(result).toContain("✖ ValidationError");
    expect(result).toContain("Config validation failed");
    expect(result).toContain("Error code: INVALID_CONFIG");
  });

  test("formats KustomarkError with suggestions", () => {
    const error = new Error("Patch failed to apply") as Error & { suggestions: string[] };
    error.name = "PatchError";
    error.suggestions = [
      "Check if the target section exists",
      "Verify the patch syntax is correct",
    ];

    const result = formatError(error, defaultOptions);

    expect(result).toContain("Suggestions:");
    expect(result).toContain("• Check if the target section exists");
    expect(result).toContain("• Verify the patch syntax is correct");
  });

  test("formats PatchError with position and snippet", () => {
    const error = new Error("Match not found") as Error & {
      position: { line: number; column: number };
      snippet: string;
    };
    error.name = "PatchError";
    error.position = { line: 42, column: 10 };
    error.snippet = "## Header\nSome content\n## Another";

    const result = formatError(error, defaultOptions);

    expect(result).toContain("at line 42, column 10");
    expect(result).toContain("Code snippet:");
    expect(result).toContain("## Header");
    expect(result).toContain("Some content");
  });

  test("formats error with context in verbose mode", () => {
    const error = new Error("Resource not found") as Error & {
      context: Record<string, unknown>;
    };
    error.name = "ResourceError";
    error.context = {
      resource: "https://example.com/doc.md",
      statusCode: 404,
    };

    const result = formatError(error, { ...defaultOptions, verbose: true });

    expect(result).toContain("Context:");
    expect(result).toContain("resource: https://example.com/doc.md");
    expect(result).toContain("statusCode: 404");
  });

  test("formats error with cause chain in verbose mode", () => {
    const rootCause = new Error("Network timeout");
    rootCause.name = "NetworkError";

    const error = new Error("Failed to fetch resource") as Error & { cause: Error };
    error.name = "ResourceError";
    error.cause = rootCause;

    const result = formatError(error, { ...defaultOptions, verbose: true });

    expect(result).toContain("Failed to fetch resource");
    expect(result).toContain("Caused by:");
    expect(result).toContain("NetworkError: Network timeout");
  });

  test("formats error as JSON", () => {
    const error = new Error("Test error") as Error & {
      code: string;
      suggestions: string[];
    };
    error.name = "TestError";
    error.code = "TEST_CODE";
    error.suggestions = ["Fix it"];

    const result = formatError(error, { ...defaultOptions, format: "json" });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe(true);
    expect(parsed.name).toBe("TestError");
    expect(parsed.message).toBe("Test error");
    expect(parsed.code).toBe("TEST_CODE");
    expect(parsed.suggestions).toEqual(["Fix it"]);
  });

  test("formats PatchError as JSON with position and snippet", () => {
    const error = new Error("Syntax error") as Error & {
      position: { line: number };
      snippet: string;
    };
    error.name = "PatchError";
    error.position = { line: 10 };
    error.snippet = "bad code";

    const result = formatError(error, { ...defaultOptions, format: "json" });
    const parsed = JSON.parse(result);

    expect(parsed.position).toEqual({ line: 10 });
    expect(parsed.snippet).toBe("bad code");
  });

  test("includes stack trace in JSON when verbose", () => {
    const error = new Error("Stack trace test");
    const result = formatError(error, { ...defaultOptions, format: "json", verbose: true });
    const parsed = JSON.parse(result);

    expect(parsed.stack).toBeDefined();
    expect(Array.isArray(parsed.stack)).toBe(true);
  });

  test("does not apply colors when colors=false", () => {
    const error = new Error("No colors");
    const result = formatError(error, { ...defaultOptions, colors: false });

    // Should not contain ANSI escape codes
    expect(result).not.toContain("\x1b[");
  });

  test("applies colors when colors=true", () => {
    const error = new Error("With colors");
    const result = formatError(error, { ...defaultOptions, colors: true });

    // Should contain ANSI escape codes
    expect(result).toContain("\x1b[");
  });

  test("handles nested cause chain", () => {
    const level3 = new Error("Root cause");
    level3.name = "Level3Error";

    const level2 = new Error("Middle error") as Error & { cause: Error };
    level2.name = "Level2Error";
    level2.cause = level3;

    const level1 = new Error("Top error") as Error & { cause: Error };
    level1.name = "Level1Error";
    level1.cause = level2;

    const result = formatError(level1, { ...defaultOptions, verbose: true });

    expect(result).toContain("Top error");
    expect(result).toContain("Caused by:");
    expect(result).toContain("Level2Error: Middle error");
    expect(result).toContain("Level3Error: Root cause");
  });

  test("handles empty suggestions array", () => {
    const error = new Error("No suggestions") as Error & { suggestions: string[] };
    error.suggestions = [];
    const result = formatError(error, defaultOptions);

    expect(result).not.toContain("Suggestions:");
  });

  test("handles empty context object", () => {
    const error = new Error("No context") as Error & {
      context: Record<string, unknown>;
    };
    error.context = {};
    const result = formatError(error, { ...defaultOptions, verbose: true });

    expect(result).not.toContain("Context:");
  });
});
