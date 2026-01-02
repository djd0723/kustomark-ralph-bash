/**
 * Tests for progress reporting system
 */

import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { ProgressReporter, createProgressReporter } from "../../src/cli/progress.js";

/**
 * Mock writable stream that captures output
 */
class MockStream extends Writable {
  public output: string[] = [];
  public isTTY = false;

  _write(chunk: Buffer | string, _encoding: string, callback: () => void): void {
    this.output.push(chunk.toString());
    callback();
  }

  clear(): void {
    this.output = [];
  }

  getFullOutput(): string {
    return this.output.join("");
  }
}

describe("ProgressReporter", () => {
  describe("Basic functionality", () => {
    test("should not output anything when disabled", () => {
      const stream = new MockStream();
      const reporter = new ProgressReporter({
        enabled: false,
        quiet: false,
        stream,
      });

      reporter.start(10, "Test message");
      reporter.increment(5, "Progress");
      reporter.finish("Done");

      expect(stream.output).toEqual([]);
    });

    test("should not output anything when quiet", () => {
      const stream = new MockStream();
      const reporter = new ProgressReporter({
        enabled: true,
        quiet: true,
        stream,
      });

      reporter.start(10, "Test message");
      reporter.increment(5, "Progress");
      reporter.finish("Done");

      expect(stream.output).toEqual([]);
    });

    test("should output progress when enabled and not quiet", () => {
      const stream = new MockStream();
      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10, "Test message");
      expect(stream.output.length).toBeGreaterThan(0);
    });
  });

  describe("Non-TTY mode", () => {
    test("should output each update on a new line", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(5, "Starting");
      reporter.increment(1, "First");
      reporter.increment(1, "Second");
      reporter.finish("Done");

      const output = stream.output;

      // Each output should end with newline in non-TTY mode
      expect(output.length).toBeGreaterThan(0);
      for (const line of output) {
        expect(line).toContain("\n");
      }
    });

    test("should show correct percentage and counts", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10);
      reporter.increment(5);

      const output = stream.getFullOutput();
      expect(output).toContain("50%");
      expect(output).toContain("5/10");
    });

    test("should include optional message", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10, "Processing files");
      const output = stream.getFullOutput();
      expect(output).toContain("Processing files");
    });
  });

  describe("TTY mode", () => {
    test("should use carriage return for updates", () => {
      const stream = new MockStream();
      stream.isTTY = true;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(5, "Starting");
      reporter.increment(1, "First");

      const output = stream.getFullOutput();
      expect(output).toContain("\r");
    });

    test("should add newline on finish", () => {
      const stream = new MockStream();
      stream.isTTY = true;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(5);
      reporter.finish("Complete");

      const output = stream.output;
      expect(output[output.length - 1]).toBe("\n");
    });
  });

  describe("Progress tracking", () => {
    test("should track progress correctly with increment", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(100);
      stream.clear();

      reporter.increment(25);
      expect(stream.getFullOutput()).toContain("25%");
      expect(stream.getFullOutput()).toContain("25/100");

      stream.clear();
      reporter.increment(25);
      expect(stream.getFullOutput()).toContain("50%");
      expect(stream.getFullOutput()).toContain("50/100");
    });

    test("should track progress with setCurrent", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(100);
      stream.clear();

      reporter.setCurrent(30);
      expect(stream.getFullOutput()).toContain("30%");
      expect(stream.getFullOutput()).toContain("30/100");

      stream.clear();
      reporter.setCurrent(75);
      expect(stream.getFullOutput()).toContain("75%");
      expect(stream.getFullOutput()).toContain("75/100");
    });

    test("should update message without changing count", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10, "Initial");
      stream.clear();

      reporter.update("Updated message");
      const output = stream.getFullOutput();
      expect(output).toContain("Updated message");
      expect(output).toContain("0/10");
    });

    test("should handle increment with custom count", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(100);
      stream.clear();

      reporter.increment(10);
      expect(stream.getFullOutput()).toContain("10%");

      stream.clear();
      reporter.increment(5);
      expect(stream.getFullOutput()).toContain("15%");
    });

    test("should show 100% when finished", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(50);
      stream.clear();

      reporter.finish("Complete");
      const output = stream.getFullOutput();
      expect(output).toContain("100%");
      expect(output).toContain("50/50");
      expect(output).toContain("Complete");
    });
  });

  describe("Clear and reset", () => {
    test("should clear progress output in TTY mode", () => {
      const stream = new MockStream();
      stream.isTTY = true;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10, "Processing");
      stream.clear();

      reporter.clear();
      const output = stream.getFullOutput();
      expect(output).toContain("\r\x1b[K"); // Clear line escape sequence
    });

    test("should reset state", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10, "First");
      reporter.increment(5);
      reporter.reset();
      stream.clear();

      reporter.start(20, "Second");
      const output = stream.getFullOutput();
      expect(output).toContain("0/20");
      expect(output).toContain("Second");
    });
  });

  describe("Utility methods", () => {
    test("isEnabled should return correct value", () => {
      const stream = new MockStream();

      const enabledReporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });
      expect(enabledReporter.isEnabled()).toBe(true);

      const disabledReporter = new ProgressReporter({
        enabled: false,
        quiet: false,
        stream,
      });
      expect(disabledReporter.isEnabled()).toBe(false);

      const quietReporter = new ProgressReporter({
        enabled: true,
        quiet: true,
        stream,
      });
      expect(quietReporter.isEnabled()).toBe(false);
    });

    test("isInteractive should return correct value", () => {
      const ttyStream = new MockStream();
      ttyStream.isTTY = true;

      const nonTtyStream = new MockStream();
      nonTtyStream.isTTY = false;

      const ttyReporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream: ttyStream,
      });
      expect(ttyReporter.isInteractive()).toBe(true);

      const nonTtyReporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream: nonTtyStream,
      });
      expect(nonTtyReporter.isInteractive()).toBe(false);
    });
  });

  describe("Edge cases", () => {
    test("should handle zero total gracefully", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(0, "Empty");
      const output = stream.getFullOutput();
      expect(output).toContain("0%");
      expect(output).toContain("0/0");
    });

    test("should handle operations before start gracefully", () => {
      const stream = new MockStream();
      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      // These should not throw or output anything
      reporter.increment(5);
      reporter.update("Message");
      reporter.finish();

      expect(stream.output).toEqual([]);
    });

    test("should handle very large totals", () => {
      const stream = new MockStream();
      stream.isTTY = false;

      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(1000000);
      reporter.setCurrent(500000);

      const output = stream.getFullOutput();
      expect(output).toContain("50%");
      expect(output).toContain("500000/1000000");
    });

    test("should handle multiple finish calls", () => {
      const stream = new MockStream();
      const reporter = new ProgressReporter({
        enabled: true,
        quiet: false,
        stream,
      });

      reporter.start(10);
      reporter.finish("First");
      stream.clear();

      // Second finish should not output anything
      reporter.finish("Second");
      expect(stream.output).toEqual([]);
    });
  });
});

describe("createProgressReporter", () => {
  test("should create disabled reporter when progress is false", () => {
    const reporter = createProgressReporter({
      progress: false,
      verbosity: 1,
    });

    expect(reporter.isEnabled()).toBe(false);
  });

  test("should create enabled reporter when progress is true", () => {
    const reporter = createProgressReporter({
      progress: true,
      verbosity: 1,
    });

    expect(reporter.isEnabled()).toBe(true);
  });

  test("should respect quiet mode (verbosity 0)", () => {
    const reporter = createProgressReporter({
      progress: true,
      verbosity: 0,
    });

    expect(reporter.isEnabled()).toBe(false);
  });

  test("should work with JSON format", () => {
    const reporter = createProgressReporter({
      progress: true,
      verbosity: 1,
      format: "json",
    });

    // Progress should still work with JSON format
    // (it outputs to stderr, not stdout)
    expect(reporter.isEnabled()).toBe(true);
  });

  test("should default to disabled when progress not specified", () => {
    const reporter = createProgressReporter({
      verbosity: 1,
    });

    expect(reporter.isEnabled()).toBe(false);
  });
});
