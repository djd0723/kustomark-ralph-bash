/**
 * Comprehensive tests for the Error Recovery System
 *
 * Tests all 6 built-in recovery strategies, ErrorRecoveryEngine methods,
 * confidence scoring, sorting, and edge cases.
 */

import { describe, expect, test } from "bun:test";
import {
  ErrorRecoveryEngine,
  type ErrorRecoveryStrategy,
  type RecoveryResult,
} from "../../src/core/error-recovery.js";
import { PatchError } from "../../src/core/errors.js";
import type { PatchOperation } from "../../src/core/types.js";

describe("ErrorRecoveryEngine", () => {
  describe("registerStrategy", () => {
    test("registers a custom strategy successfully", () => {
      const engine = new ErrorRecoveryEngine();
      const customStrategy: ErrorRecoveryStrategy = {
        id: "custom-test",
        name: "Custom Test Strategy",
        description: "A test strategy",
        confidence: 0.7,
        canRecover: () => false,
        recover: () => ({
          success: false,
          message: "Test",
          confidence: 0,
        }),
      };

      expect(() => engine.registerStrategy(customStrategy)).not.toThrow();
    });

    test("throws error when registering duplicate strategy ID", () => {
      const engine = new ErrorRecoveryEngine();
      const strategy1: ErrorRecoveryStrategy = {
        id: "duplicate-id",
        name: "Strategy 1",
        description: "First strategy",
        confidence: 0.7,
        canRecover: () => false,
        recover: () => ({
          success: false,
          message: "Test",
          confidence: 0,
        }),
      };

      const strategy2: ErrorRecoveryStrategy = {
        id: "duplicate-id",
        name: "Strategy 2",
        description: "Second strategy",
        confidence: 0.8,
        canRecover: () => false,
        recover: () => ({
          success: false,
          message: "Test",
          confidence: 0,
        }),
      };

      engine.registerStrategy(strategy1);
      expect(() => engine.registerStrategy(strategy2)).toThrow(
        "Strategy with ID 'duplicate-id' is already registered"
      );
    });

    test("allows multiple different strategies to be registered", () => {
      const engine = new ErrorRecoveryEngine();
      const strategy1: ErrorRecoveryStrategy = {
        id: "strategy-1",
        name: "Strategy 1",
        description: "First strategy",
        confidence: 0.7,
        canRecover: () => false,
        recover: () => ({
          success: false,
          message: "Test",
          confidence: 0,
        }),
      };

      const strategy2: ErrorRecoveryStrategy = {
        id: "strategy-2",
        name: "Strategy 2",
        description: "Second strategy",
        confidence: 0.8,
        canRecover: () => false,
        recover: () => ({
          success: false,
          message: "Test",
          confidence: 0,
        }),
      };

      expect(() => {
        engine.registerStrategy(strategy1);
        engine.registerStrategy(strategy2);
      }).not.toThrow();
    });
  });

  describe("findRecoveries", () => {
    test("returns empty array when no strategies can recover", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("Test error", "TEST_ERROR");
      const content = "test content";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries).toEqual([]);
    });

    test("returns recoveries sorted by confidence (highest first)", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello World";
      const patch: PatchOperation = { op: "replace", old: "hello", new: "hi" };

      const recoveries = await engine.findRecoveries(error, content, patch);

      // Verify results are sorted by confidence
      for (let i = 0; i < recoveries.length - 1; i++) {
        expect(recoveries[i]!.confidence).toBeGreaterThanOrEqual(
          recoveries[i + 1]!.confidence
        );
      }
    });

    test("continues processing when a strategy throws an error", async () => {
      const engine = new ErrorRecoveryEngine();
      const faultyStrategy: ErrorRecoveryStrategy = {
        id: "faulty",
        name: "Faulty Strategy",
        description: "Throws an error",
        confidence: 0.9,
        canRecover: () => true,
        recover: () => {
          throw new Error("Strategy failed");
        },
      };

      engine.registerStrategy(faultyStrategy);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      // Should not throw, just log warning
      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(Array.isArray(recoveries)).toBe(true);
    });

    test("filters out unsuccessful recoveries", async () => {
      const engine = new ErrorRecoveryEngine();
      const failingStrategy: ErrorRecoveryStrategy = {
        id: "failing",
        name: "Failing Strategy",
        description: "Always fails",
        confidence: 0.9,
        canRecover: () => true,
        recover: () => ({
          success: false,
          message: "Failed to recover",
          confidence: 0,
        }),
      };

      engine.registerStrategy(failingStrategy);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(recoveries).toEqual([]);
    });

    test("handles async strategies", async () => {
      const engine = new ErrorRecoveryEngine();
      const asyncStrategy: ErrorRecoveryStrategy = {
        id: "async",
        name: "Async Strategy",
        description: "Uses async operations",
        confidence: 0.8,
        canRecover: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return true;
        },
        recover: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            success: true,
            message: "Async recovery",
            confidence: 0.8,
            fixedPatch: { op: "replace", old: "fixed", new: "bar" } as PatchOperation,
          };
        },
      };

      engine.registerStrategy(asyncStrategy);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(recoveries.length).toBe(1);
      expect(recoveries[0]?.message).toBe("Async recovery");
    });
  });

  describe("recoverAutomatically", () => {
    test("returns null when no recoveries are available", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("Test error", "TEST_ERROR");
      const content = "test content";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const result = await engine.recoverAutomatically(error, content, patch);

      expect(result).toBeNull();
    });

    test("returns null when confidence is below threshold", async () => {
      const engine = new ErrorRecoveryEngine();
      const lowConfidenceStrategy: ErrorRecoveryStrategy = {
        id: "low-confidence",
        name: "Low Confidence Strategy",
        description: "Low confidence recovery",
        confidence: 0.5,
        canRecover: () => true,
        recover: () => ({
          success: true,
          message: "Low confidence fix",
          confidence: 0.5,
          fixedPatch: { op: "replace", old: "fixed", new: "bar" } as PatchOperation,
        }),
      };

      engine.registerStrategy(lowConfidenceStrategy);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const result = await engine.recoverAutomatically(error, content, patch);

      expect(result).toBeNull();
    });

    test("returns recovery when confidence meets threshold", async () => {
      const engine = new ErrorRecoveryEngine();
      const highConfidenceStrategy: ErrorRecoveryStrategy = {
        id: "high-confidence",
        name: "High Confidence Strategy",
        description: "High confidence recovery",
        confidence: 0.9,
        canRecover: () => true,
        recover: () => ({
          success: true,
          message: "High confidence fix",
          confidence: 0.9,
          fixedPatch: { op: "replace", old: "fixed", new: "bar" } as PatchOperation,
        }),
      };

      engine.registerStrategy(highConfidenceStrategy);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const result = await engine.recoverAutomatically(error, content, patch);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.9);
    });

    test("uses custom minimum confidence threshold", async () => {
      const engine = new ErrorRecoveryEngine();
      const strategy: ErrorRecoveryStrategy = {
        id: "medium-confidence",
        name: "Medium Confidence Strategy",
        description: "Medium confidence recovery",
        confidence: 0.7,
        canRecover: () => true,
        recover: () => ({
          success: true,
          message: "Medium confidence fix",
          confidence: 0.7,
          fixedPatch: { op: "replace", old: "fixed", new: "bar" } as PatchOperation,
        }),
      };

      engine.registerStrategy(strategy);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      // With default threshold (0.8), should return null
      const result1 = await engine.recoverAutomatically(error, content, patch);
      expect(result1).toBeNull();

      // With custom threshold (0.6), should return recovery
      const result2 = await engine.recoverAutomatically(error, content, patch, 0.6);
      expect(result2).not.toBeNull();
      expect(result2?.confidence).toBe(0.7);
    });

    test("returns highest confidence recovery when multiple available", async () => {
      const engine = new ErrorRecoveryEngine();
      const strategy1: ErrorRecoveryStrategy = {
        id: "strategy-1",
        name: "Strategy 1",
        description: "First strategy",
        confidence: 0.85,
        canRecover: () => true,
        recover: () => ({
          success: true,
          message: "Fix 1",
          confidence: 0.85,
          fixedPatch: { op: "replace", old: "fix1", new: "bar" } as PatchOperation,
        }),
      };

      const strategy2: ErrorRecoveryStrategy = {
        id: "strategy-2",
        name: "Strategy 2",
        description: "Second strategy",
        confidence: 0.95,
        canRecover: () => true,
        recover: () => ({
          success: true,
          message: "Fix 2",
          confidence: 0.95,
          fixedPatch: { op: "replace", old: "fix2", new: "bar" } as PatchOperation,
        }),
      };

      engine.registerStrategy(strategy1);
      engine.registerStrategy(strategy2);

      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = { op: "replace", old: "foo", new: "bar" };

      const result = await engine.recoverAutomatically(error, content, patch);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.95);
      expect(result?.message).toBe("Fix 2");
    });
  });

  describe("SectionIdTypoRecovery", () => {
    test("recovers from section ID typo", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `
# Installation

Content here

# Configuration

More content
`;
      const patch: PatchOperation = {
        op: "remove-section",
        id: "instalation", // Typo: missing 'l'
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.success).toBe(true);
      expect(recoveries[0]?.fixedPatch?.id).toBe("installation");
      expect(recoveries[0]?.message).toContain("installation");
    });

    test("calculates confidence based on Levenshtein distance", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `
# Installation
# Configuration
`;
      const patch: PatchOperation = {
        op: "remove-section",
        id: "instalation",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries[0]?.confidence).toBeGreaterThan(0);
      expect(recoveries[0]?.confidence).toBeLessThanOrEqual(1);
    });

    test("finds similar section among multiple candidates", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `
# Installation

Some content

# Configuration

More content
`;
      const patch: PatchOperation = {
        op: "remove-section",
        id: "instalation", // Typo: missing 'l'
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      // Should find "installation" as the closest match
      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.success).toBe(true);
      expect(recoveries[0]?.fixedPatch?.id).toBe("installation");
    });

    test("works with all section operations", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `# Installation\n\nContent`;

      const operations = [
        "remove-section",
        "replace-section",
        "prepend-to-section",
        "append-to-section",
        "rename-header",
        "move-section",
        "change-section-level",
      ];

      for (const op of operations) {
        const patch: PatchOperation = {
          op: op as any,
          id: "instalation",
        } as any;

        const recoveries = await engine.findRecoveries(error, content, patch);
        expect(recoveries.length).toBeGreaterThan(0);
      }
    });

    test("returns no recovery when no similar sections found", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `# Introduction\n# Getting Started`;
      const patch: PatchOperation = {
        op: "remove-section",
        id: "completely-different-section",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries).toEqual([]);
    });
  });

  describe("CaseMismatchRecovery", () => {
    test("recovers from case mismatch in replace operation", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello World";
      const patch: PatchOperation = {
        op: "replace",
        old: "hello world",
        new: "Hi there",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.success).toBe(true);
      expect(recoveries[0]?.fixedPatch?.old).toBe("Hello World");
    });

    test("recovers from case mismatch in replace-line operation", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "First Line\nSecond Line\nThird Line";
      const patch: PatchOperation = {
        op: "replace-line",
        match: "second line",
        replacement: "New Line",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.match).toBe("Second Line");
    });

    test("has high confidence (0.9)", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello World";
      const patch: PatchOperation = {
        op: "replace",
        old: "HELLO WORLD",
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries[0]?.confidence).toBe(0.9);
    });

    test("does not trigger when case matches", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello World";
      const patch: PatchOperation = {
        op: "replace",
        old: "Goodbye",
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      // Should not use case mismatch recovery
      const caseMismatchRecovery = recoveries.find((r) =>
        r.message.includes("case mismatch")
      );
      expect(caseMismatchRecovery).toBeUndefined();
    });

    test("handles substring matches with different casing", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "This is a Test String with Mixed Case";
      const patch: PatchOperation = {
        op: "replace",
        old: "test string",
        new: "sample text",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.old).toBe("Test String");
    });
  });

  describe("WhitespaceNormalizationRecovery", () => {
    test("recovers from extra spaces in replace operation", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello  World"; // Two spaces
      const patch: PatchOperation = {
        op: "replace",
        old: "Hello World", // One space
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.success).toBe(true);
      expect(recoveries[0]?.message).toContain("whitespace");
    });

    test("recovers from tabs vs spaces", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello\tWorld"; // Tab
      const patch: PatchOperation = {
        op: "replace",
        old: "Hello World", // Space
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
    });

    test("recovers from line whitespace in replace-line", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "First Line\nSecond  Line\nThird Line";
      const patch: PatchOperation = {
        op: "replace-line",
        match: "Second Line",
        replacement: "New Line",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.match).toBe("Second  Line");
    });

    test("has confidence of 0.88", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello  World";
      const patch: PatchOperation = {
        op: "replace",
        old: "Hello World",
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries[0]?.confidence).toBe(0.88);
    });

    test("does not trigger when whitespace matches exactly", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Different Content";
      const patch: PatchOperation = {
        op: "replace",
        old: "Hello World",
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      const whitespaceRecovery = recoveries.find((r) =>
        r.message.includes("whitespace")
      );
      expect(whitespaceRecovery).toBeUndefined();
    });
  });

  describe("FrontmatterKeyTypoRecovery", () => {
    test("recovers from frontmatter key typo in remove-frontmatter", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `---
title: My Document
author: John Doe
date: 2024-01-01
---

Content here`;
      const patch: PatchOperation = {
        op: "remove-frontmatter",
        key: "titel", // Typo
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.key).toBe("title");
    });

    test("recovers from frontmatter key typo in rename-frontmatter", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `---
author: John Doe
---

Content`;
      const patch: PatchOperation = {
        op: "rename-frontmatter",
        old: "athour", // Typo
        new: "writer",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.old).toBe("author");
    });

    test("provides alternatives for multiple similar keys", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `---
title: Document
author: John
date: 2024-01-01
---`;
      const patch: PatchOperation = {
        op: "remove-frontmatter",
        key: "titel", // Typo for "title"
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      // Should find "title" as similar key
      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.success).toBe(true);
      expect(recoveries[0]?.fixedPatch?.key).toBe("title");
    });

    test("returns no recovery when no similar keys found", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `---
title: Test
author: John
---`;
      const patch: PatchOperation = {
        op: "remove-frontmatter",
        key: "completely-different-key",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries).toEqual([]);
    });
  });

  describe("LineFuzzyMatchRecovery", () => {
    test("recovers from similar line with slight differences", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `import { foo } from 'bar';
export const test = 'value';
console.log('debug');`;
      const patch: PatchOperation = {
        op: "replace-line",
        match: "import { foo } from 'bar'", // Missing semicolon
        replacement: "import { baz } from 'qux';",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.match).toBe("import { foo } from 'bar';");
    });

    test("works with insert-after-line and insert-before-line", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Line one\nLine two\nLine three";

      const operations = ["insert-after-line", "insert-before-line"];

      for (const op of operations) {
        const patch: PatchOperation = {
          op: op as any,
          match: "Line to", // Typo
          content: "Inserted line",
        } as any;

        const recoveries = await engine.findRecoveries(error, content, patch);
        expect(recoveries.length).toBeGreaterThan(0);
      }
    });

    test("has lower confidence (0.75) than exact matches", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Line one\nLine two";
      const patch: PatchOperation = {
        op: "replace-line",
        match: "Lin one",
        replacement: "New line",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries[0]?.confidence).toBeLessThanOrEqual(0.75);
    });

    test("filters out empty lines", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Line one\n\n\nLine two\n\n";
      const patch: PatchOperation = {
        op: "replace-line",
        match: "Lin two",
        replacement: "New line",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.match).toBe("Line two");
    });
  });

  describe("MarkerOrderRecovery", () => {
    test("recovers from reversed start/end markers in delete-between", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `Before
<!-- END -->
Content to delete
<!-- START -->
After`;
      const patch: PatchOperation = {
        op: "delete-between",
        start: "<!-- START -->",
        end: "<!-- END -->",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.fixedPatch?.start).toBe("<!-- END -->");
      expect(recoveries[0]?.fixedPatch?.end).toBe("<!-- START -->");
    });

    test("recovers from reversed markers in replace-between", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = `Before
[END]
Old content
[START]
After`;
      const patch: PatchOperation = {
        op: "replace-between",
        start: "[START]",
        end: "[END]",
        content: "New content",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries.length).toBeGreaterThan(0);
      expect(recoveries[0]?.success).toBe(true);
    });

    test("has very high confidence (0.95)", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Before\n[END]\nContent\n[START]\nAfter";
      const patch: PatchOperation = {
        op: "delete-between",
        start: "[START]",
        end: "[END]",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      expect(recoveries[0]?.confidence).toBe(0.95);
    });

    test("does not trigger when markers are in correct order", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Before\n[START]\nContent\n[END]\nAfter";
      const patch: PatchOperation = {
        op: "delete-between",
        start: "[START]",
        end: "[END]",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      const markerRecovery = recoveries.find((r) => r.message.includes("marker order"));
      expect(markerRecovery).toBeUndefined();
    });

    test("does not trigger when one marker is missing", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Before\n[START]\nContent\nAfter";
      const patch: PatchOperation = {
        op: "delete-between",
        start: "[START]",
        end: "[END]",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      const markerRecovery = recoveries.find((r) => r.message.includes("marker order"));
      expect(markerRecovery).toBeUndefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    test("handles patch without required fields", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "test";
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(Array.isArray(recoveries)).toBe(true);
    });

    test("handles empty content", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "";
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(Array.isArray(recoveries)).toEqual(true);
    });

    test("handles content with only whitespace", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "   \n\n\t\t  \n";
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(Array.isArray(recoveries)).toBe(true);
    });

    test("handles non-PATCH_NO_MATCH errors", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("Different error", "DIFFERENT_ERROR");
      const content = "test";
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);
      expect(recoveries).toEqual([]);
    });

    test("multiple strategies can provide different recoveries for same error", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello World"; // Exact match but case difference
      const patch: PatchOperation = {
        op: "replace",
        old: "hello world",
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      // Should have case mismatch recovery
      expect(recoveries.length).toBeGreaterThan(0);
    });

    test("recoveries include all required fields", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "Hello World";
      const patch: PatchOperation = {
        op: "replace",
        old: "hello world",
        new: "Hi",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      if (recoveries.length > 0) {
        const recovery = recoveries[0]!;
        expect(recovery).toHaveProperty("success");
        expect(recovery).toHaveProperty("message");
        expect(recovery).toHaveProperty("confidence");
        expect(typeof recovery.success).toBe("boolean");
        expect(typeof recovery.message).toBe("string");
        expect(typeof recovery.confidence).toBe("number");
      }
    });

    test("confidence scores are between 0 and 1", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const content = "# Installation\n\nContent";
      const patch: PatchOperation = {
        op: "remove-section",
        id: "instalation",
      };

      const recoveries = await engine.findRecoveries(error, content, patch);

      for (const recovery of recoveries) {
        expect(recovery.confidence).toBeGreaterThanOrEqual(0);
        expect(recovery.confidence).toBeLessThanOrEqual(1);
      }
    });

    test("handles very long content efficiently", async () => {
      const engine = new ErrorRecoveryEngine();
      const error = new PatchError("matched 0 times", "PATCH_NO_MATCH");
      const longContent = "x".repeat(10000);
      const patch: PatchOperation = {
        op: "replace",
        old: "foo",
        new: "bar",
      };

      const startTime = Date.now();
      const recoveries = await engine.findRecoveries(error, longContent, patch);
      const duration = Date.now() - startTime;

      expect(Array.isArray(recoveries)).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });
});
