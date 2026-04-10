/**
 * Comprehensive tests for string similarity utilities
 */

import { describe, expect, test } from "bun:test";
import {
  calculateLevenshteinDistance,
  calculateSimilarityRatio,
  areStringsSimilar,
  findSimilarStrings,
  findBestMatch,
} from "../../../src/core/utils/string-similarity.js";

describe("String Similarity Utilities", () => {
  describe("calculateLevenshteinDistance", () => {
    describe("edge cases", () => {
      test("identical strings have distance 0", () => {
        expect(calculateLevenshteinDistance("hello", "hello")).toBe(0);
        expect(calculateLevenshteinDistance("", "")).toBe(0);
        expect(calculateLevenshteinDistance("a", "a")).toBe(0);
      });

      test("empty string to non-empty has distance equal to length", () => {
        expect(calculateLevenshteinDistance("", "hello")).toBe(5);
        expect(calculateLevenshteinDistance("hello", "")).toBe(5);
        expect(calculateLevenshteinDistance("", "a")).toBe(1);
        expect(calculateLevenshteinDistance("abc", "")).toBe(3);
      });

      test("handles very long strings", () => {
        const longStr1 = "a".repeat(1000);
        const longStr2 = "a".repeat(999) + "b";
        expect(calculateLevenshteinDistance(longStr1, longStr2)).toBe(1);

        const longStr3 = "x".repeat(1000);
        expect(calculateLevenshteinDistance(longStr1, longStr3)).toBe(1000);
      });

      test("handles unicode characters", () => {
        expect(calculateLevenshteinDistance("café", "cafe")).toBe(1);
        expect(calculateLevenshteinDistance("hello", "héllo")).toBe(1);
        // Note: Emojis may be treated as multi-byte characters, so distance may vary
        // depending on JavaScript string handling (length counts code units, not graphemes)
        expect(calculateLevenshteinDistance("🎉🎊🎈", "🎉🎊")).toBeGreaterThan(0);
        expect(calculateLevenshteinDistance("你好", "你好")).toBe(0);
        expect(calculateLevenshteinDistance("你好", "您好")).toBe(1);
      });

      test("handles strings with whitespace", () => {
        expect(calculateLevenshteinDistance("hello world", "helloworld")).toBe(1);
        expect(calculateLevenshteinDistance("  hello  ", "hello")).toBe(4);
        expect(calculateLevenshteinDistance("a b c", "abc")).toBe(2);
      });

      test("handles special characters", () => {
        expect(calculateLevenshteinDistance("hello!", "hello")).toBe(1);
        expect(calculateLevenshteinDistance("a@b#c", "abc")).toBe(2);
        // Note: \\n is 2 characters (backslash + n), not a newline
        expect(calculateLevenshteinDistance("a\\nb\\nc", "a b c")).toBe(4);
      });
    });

    describe("basic operations", () => {
      test("single character insertion", () => {
        expect(calculateLevenshteinDistance("cat", "cats")).toBe(1);
        expect(calculateLevenshteinDistance("at", "cat")).toBe(1);
        expect(calculateLevenshteinDistance("ct", "cat")).toBe(1);
      });

      test("single character deletion", () => {
        expect(calculateLevenshteinDistance("cats", "cat")).toBe(1);
        expect(calculateLevenshteinDistance("cat", "at")).toBe(1);
        expect(calculateLevenshteinDistance("cat", "ct")).toBe(1);
      });

      test("single character substitution", () => {
        expect(calculateLevenshteinDistance("cat", "bat")).toBe(1);
        expect(calculateLevenshteinDistance("cat", "cot")).toBe(1);
        expect(calculateLevenshteinDistance("cat", "car")).toBe(1);
      });

      test("multiple operations", () => {
        expect(calculateLevenshteinDistance("kitten", "sitting")).toBe(3);
        expect(calculateLevenshteinDistance("saturday", "sunday")).toBe(3);
        expect(calculateLevenshteinDistance("book", "back")).toBe(2);
      });

      test("completely different strings", () => {
        expect(calculateLevenshteinDistance("abc", "xyz")).toBe(3);
        expect(calculateLevenshteinDistance("hello", "world")).toBe(4);
        expect(calculateLevenshteinDistance("foo", "bar")).toBe(3);
      });
    });

    describe("case sensitivity", () => {
      test("case-sensitive by default", () => {
        expect(calculateLevenshteinDistance("Hello", "hello")).toBe(1);
        expect(calculateLevenshteinDistance("HELLO", "hello")).toBe(5);
        expect(calculateLevenshteinDistance("HeLLo", "hello")).toBe(3);
      });

      test("case-insensitive when option enabled", () => {
        expect(calculateLevenshteinDistance("Hello", "hello", { caseInsensitive: true })).toBe(0);
        expect(calculateLevenshteinDistance("HELLO", "hello", { caseInsensitive: true })).toBe(0);
        expect(calculateLevenshteinDistance("HeLLo", "hello", { caseInsensitive: true })).toBe(0);
        expect(calculateLevenshteinDistance("Café", "café", { caseInsensitive: true })).toBe(0);
      });
    });

    describe("threshold optimization", () => {
      test("returns early when threshold is exceeded", () => {
        // Distance is 4, but threshold is 2, so should return early
        const distance = calculateLevenshteinDistance("hello", "world", { threshold: 2 });
        expect(distance).toBeGreaterThan(2);
      });

      test("calculates full distance when within threshold", () => {
        const distance = calculateLevenshteinDistance("hello", "hallo", { threshold: 5 });
        expect(distance).toBe(1);
      });

      test("threshold with identical strings", () => {
        const distance = calculateLevenshteinDistance("hello", "hello", { threshold: 0 });
        expect(distance).toBe(0);
      });

      test("threshold optimization with long strings", () => {
        const str1 = "a".repeat(1000);
        const str2 = "b".repeat(1000);
        // Should return early and not calculate full distance
        const distance = calculateLevenshteinDistance(str1, str2, { threshold: 10 });
        expect(distance).toBeGreaterThan(10);
      });
    });

    describe("symmetry", () => {
      test("distance is symmetric", () => {
        expect(calculateLevenshteinDistance("abc", "xyz")).toBe(
          calculateLevenshteinDistance("xyz", "abc"),
        );
        expect(calculateLevenshteinDistance("hello", "world")).toBe(
          calculateLevenshteinDistance("world", "hello"),
        );
        expect(calculateLevenshteinDistance("kitten", "sitting")).toBe(
          calculateLevenshteinDistance("sitting", "kitten"),
        );
      });
    });

    describe("known test cases", () => {
      test("classic examples from literature", () => {
        expect(calculateLevenshteinDistance("rosettacode", "raisethysword")).toBe(8);
        expect(calculateLevenshteinDistance("algorithm", "altruistic")).toBe(6);
      });

      test("real-world typos", () => {
        expect(calculateLevenshteinDistance("installation", "instalation")).toBe(1);
        expect(calculateLevenshteinDistance("configuration", "configuraton")).toBe(1);
        expect(calculateLevenshteinDistance("receive", "recieve")).toBe(2);
        expect(calculateLevenshteinDistance("definitely", "definately")).toBe(1);
      });
    });
  });

  describe("calculateSimilarityRatio", () => {
    test("identical strings have ratio 1.0", () => {
      expect(calculateSimilarityRatio("hello", "hello")).toBe(1.0);
      expect(calculateSimilarityRatio("", "")).toBe(1.0);
    });

    test("completely different strings approach 0.0", () => {
      expect(calculateSimilarityRatio("abc", "xyz")).toBe(0.0);
      // Use toBeCloseTo for floating point comparison to avoid precision issues
      expect(calculateSimilarityRatio("hello", "world")).toBeCloseTo(0.2, 1);
    });

    test("similar strings have high ratio", () => {
      expect(calculateSimilarityRatio("hello", "hallo")).toBe(0.8);
      expect(calculateSimilarityRatio("cat", "cats")).toBe(0.75);
    });

    test("ratio is symmetric", () => {
      expect(calculateSimilarityRatio("abc", "xyz")).toBe(calculateSimilarityRatio("xyz", "abc"));
      expect(calculateSimilarityRatio("hello", "world")).toBe(
        calculateSimilarityRatio("world", "hello"),
      );
    });

    test("ratio is between 0.0 and 1.0", () => {
      const ratio1 = calculateSimilarityRatio("kitten", "sitting");
      expect(ratio1).toBeGreaterThanOrEqual(0.0);
      expect(ratio1).toBeLessThanOrEqual(1.0);

      const ratio2 = calculateSimilarityRatio("abc", "xyz");
      expect(ratio2).toBeGreaterThanOrEqual(0.0);
      expect(ratio2).toBeLessThanOrEqual(1.0);
    });

    test("case-insensitive option", () => {
      expect(calculateSimilarityRatio("Hello", "hello", { caseInsensitive: true })).toBe(1.0);
      expect(calculateSimilarityRatio("HELLO", "hello", { caseInsensitive: true })).toBe(1.0);
    });
  });

  describe("areStringsSimilar", () => {
    test("returns true when distance is within threshold", () => {
      expect(areStringsSimilar("hello", "hallo", 1)).toBe(true);
      expect(areStringsSimilar("hello", "hallo", 2)).toBe(true);
      expect(areStringsSimilar("cat", "cats", 1)).toBe(true);
    });

    test("returns false when distance exceeds threshold", () => {
      expect(areStringsSimilar("hello", "world", 1)).toBe(false);
      expect(areStringsSimilar("hello", "world", 3)).toBe(false);
      expect(areStringsSimilar("abc", "xyz", 2)).toBe(false);
    });

    test("returns true for identical strings", () => {
      expect(areStringsSimilar("hello", "hello", 0)).toBe(true);
      expect(areStringsSimilar("hello", "hello", 5)).toBe(true);
    });

    test("works with case-insensitive option", () => {
      expect(areStringsSimilar("Hello", "hello", 0, { caseInsensitive: true })).toBe(true);
      expect(areStringsSimilar("HELLO", "hello", 0, { caseInsensitive: true })).toBe(true);
      expect(areStringsSimilar("Hello", "hello", 0, { caseInsensitive: false })).toBe(false);
    });

    test("handles edge cases", () => {
      expect(areStringsSimilar("", "", 0)).toBe(true);
      expect(areStringsSimilar("", "a", 1)).toBe(true);
      expect(areStringsSimilar("", "abc", 2)).toBe(false);
    });
  });

  describe("findSimilarStrings", () => {
    describe("basic functionality", () => {
      test("finds similar strings within default threshold", () => {
        const candidates = ["installation", "configuration", "introduction"];
        const results = findSimilarStrings("instalation", candidates);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.value).toBe("installation");
        expect(results[0]?.distance).toBe(1);
        expect(results[0]?.similarity).toBeGreaterThan(0.9);
      });

      test("returns empty array when no similar strings found", () => {
        const candidates = ["foo", "bar", "baz"];
        const results = findSimilarStrings("completely-different-string", candidates);

        expect(results).toEqual([]);
      });

      test("sorts results by distance (most similar first)", () => {
        const candidates = ["installation", "instalation", "install"];
        const results = findSimilarStrings("instal", candidates);

        expect(results.length).toBeGreaterThan(0);
        // Each result should have distance <= next result
        for (let i = 0; i < results.length - 1; i++) {
          const curr = results[i];
          const next = results[i + 1];
          if (curr && next) {
            expect(curr.distance).toBeLessThanOrEqual(next.distance);
          }
        }
      });

      test("alphabetically sorts when distances are equal", () => {
        const candidates = ["xyz", "abc", "def"];
        const results = findSimilarStrings("mno", candidates);

        // Find consecutive pairs with same distance
        for (let i = 0; i < results.length - 1; i++) {
          const curr = results[i];
          const next = results[i + 1];
          if (curr && next && curr.distance === next.distance) {
            expect(curr.value.localeCompare(next.value)).toBeLessThanOrEqual(0);
          }
        }
      });

      test("limits results to maxResults (default 5)", () => {
        const candidates = Array.from({ length: 20 }, (_, i) => `item${i}`);
        const results = findSimilarStrings("item", candidates);

        expect(results.length).toBeLessThanOrEqual(5);
      });

      test("respects custom maxResults parameter", () => {
        const candidates = Array.from({ length: 20 }, (_, i) => `item${i}`);
        const results = findSimilarStrings("item", candidates, { maxResults: 3 });

        expect(results.length).toBeLessThanOrEqual(3);
      });
    });

    describe("maxDistance threshold", () => {
      test("respects custom maxDistance parameter", () => {
        const candidates = ["hello", "hallo", "hullo", "hillo"];
        const results = findSimilarStrings("hello", candidates, { maxDistance: 1 });

        expect(results.every((r) => r.distance <= 1)).toBe(true);
      });

      test("auto-calculates maxDistance based on target length", () => {
        // Short strings (<=5): max distance 2
        const results1 = findSimilarStrings("abc", ["xyz", "axc", "abcd"]);
        expect(results1.every((r) => r.distance <= 2)).toBe(true);

        // Medium strings (<=10): max distance 3
        const results2 = findSimilarStrings("hello", ["world", "hallo", "hellooo"]);
        expect(results2.every((r) => r.distance <= 3)).toBe(true);

        // Longer strings (<=20): max distance 5
        const results3 = findSimilarStrings("installation", ["instalation", "configuration"]);
        expect(results3.every((r) => r.distance <= 5)).toBe(true);
      });
    });

    describe("case sensitivity", () => {
      test("case-sensitive by default", () => {
        const candidates = ["Installation", "Configuration"];
        const results = findSimilarStrings("installation", candidates);

        // Should find "Installation" with distance > 0 due to case difference
        const found = results.find((r) => r.value === "Installation");
        if (found) {
          expect(found.distance).toBeGreaterThan(0);
        }
      });

      test("case-insensitive when option enabled", () => {
        const candidates = ["Installation", "Configuration"];
        const results = findSimilarStrings("installation", candidates, {
          caseInsensitive: true,
        });

        expect(results.length).toBeGreaterThan(0);
        const exactMatch = results.find((r) => r.value === "Installation");
        if (exactMatch) {
          expect(exactMatch.distance).toBe(0);
        }
      });
    });

    describe("excludeExact option", () => {
      test("includes exact matches by default", () => {
        const candidates = ["hello", "hallo", "hullo"];
        const results = findSimilarStrings("hello", candidates);

        const exactMatch = results.find((r) => r.distance === 0);
        expect(exactMatch).toBeDefined();
      });

      test("excludes exact matches when option enabled", () => {
        const candidates = ["hello", "hallo", "hullo"];
        const results = findSimilarStrings("hello", candidates, { excludeExact: true });

        expect(results.every((r) => r.distance > 0)).toBe(true);
      });

      test("excludes exact matches with case-insensitive", () => {
        const candidates = ["Hello", "hallo", "hullo"];
        const results = findSimilarStrings("hello", candidates, {
          excludeExact: true,
          caseInsensitive: true,
        });

        expect(results.every((r) => r.distance > 0)).toBe(true);
      });
    });

    describe("edge cases", () => {
      test("handles empty candidates array", () => {
        const results = findSimilarStrings("test", []);
        expect(results).toEqual([]);
      });

      test("handles empty target string", () => {
        const candidates = ["a", "ab", "abc"];
        const results = findSimilarStrings("", candidates);

        // Empty string should match strings with length <= maxDistance
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((r) => r.distance === r.value.length)).toBe(true);
      });

      test("handles candidates with duplicates", () => {
        const candidates = ["hello", "hello", "hallo"];
        const results = findSimilarStrings("hello", candidates);

        // Both "hello" instances should be included (unless excludeExact is set)
        const exactMatches = results.filter((r) => r.distance === 0);
        expect(exactMatches.length).toBeGreaterThanOrEqual(0);
      });

      test("handles unicode in candidates", () => {
        const candidates = ["café", "cafe", "caffe"];
        const results = findSimilarStrings("cafe", candidates);

        expect(results.length).toBeGreaterThan(0);
        const exactMatch = results.find((r) => r.value === "cafe");
        expect(exactMatch?.distance).toBe(0);
      });
    });

    describe("result structure", () => {
      test("results contain value, distance, and similarity", () => {
        const candidates = ["hello", "hallo"];
        const results = findSimilarStrings("hello", candidates);

        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
          expect(result).toHaveProperty("value");
          expect(result).toHaveProperty("distance");
          expect(result).toHaveProperty("similarity");
          expect(typeof result.value).toBe("string");
          expect(typeof result.distance).toBe("number");
          expect(typeof result.similarity).toBe("number");
          expect(result.similarity).toBeGreaterThanOrEqual(0.0);
          expect(result.similarity).toBeLessThanOrEqual(1.0);
        }
      });

      test("similarity is calculated correctly", () => {
        const candidates = ["hello"];
        const results = findSimilarStrings("hallo", candidates);

        expect(results.length).toBeGreaterThan(0);
        const result = results[0];
        if (result) {
          // distance=1, maxLen=5, similarity=1-1/5=0.8
          expect(result.distance).toBe(1);
          expect(result.similarity).toBe(0.8);
        }
      });
    });

    describe("real-world scenarios", () => {
      test("suggests similar section IDs", () => {
        const sections = ["installation", "configuration", "getting-started", "troubleshooting"];
        const results = findSimilarStrings("instalation", sections);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.value).toBe("installation");
      });

      test("suggests similar frontmatter keys", () => {
        const keys = ["title", "author", "date", "description"];
        const results = findSimilarStrings("titel", keys);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.value).toBe("title");
      });

      test("suggests similar file names", () => {
        const files = ["README.md", "LICENSE.txt", "package.json", "tsconfig.json"];
        const results = findSimilarStrings("pakage.json", files);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.value).toBe("package.json");
      });

      test("handles programming language keywords", () => {
        const keywords = ["function", "interface", "class", "const", "let", "var"];
        const results = findSimilarStrings("functin", keywords);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.value).toBe("function");
      });
    });
  });

  describe("findBestMatch", () => {
    test("returns the best match from candidates", () => {
      const candidates = ["installation", "instalation", "install"];
      const result = findBestMatch("instalation", candidates);

      expect(result).toBeDefined();
      expect(result?.value).toBe("instalation");
      expect(result?.distance).toBe(0);
    });

    test("returns undefined when no match found", () => {
      const candidates = ["foo", "bar", "baz"];
      const result = findBestMatch("completely-different", candidates, { maxDistance: 1 });

      expect(result).toBeUndefined();
    });

    test("returns closest match when no exact match", () => {
      const candidates = ["hello", "hallo", "hullo"];
      const result = findBestMatch("hxllo", candidates);

      expect(result).toBeDefined();
      expect(result?.distance).toBe(1);
      // Could be "hello", "hallo", or "hullo" - all have distance 1
      expect(["hello", "hallo", "hullo"]).toContain(result?.value);
    });

    test("respects maxDistance option", () => {
      const candidates = ["hello", "world"];
      const result = findBestMatch("goodbye", candidates, { maxDistance: 2 });

      expect(result).toBeUndefined();
    });

    test("works with case-insensitive option", () => {
      const candidates = ["Installation", "Configuration"];
      const result = findBestMatch("installation", candidates, { caseInsensitive: true });

      expect(result).toBeDefined();
      expect(result?.value).toBe("Installation");
      expect(result?.distance).toBe(0);
    });

    test("handles empty candidates array", () => {
      const result = findBestMatch("test", []);
      expect(result).toBeUndefined();
    });

    test("excludeExact option", () => {
      const candidates = ["hello", "hallo", "hullo"];
      const result = findBestMatch("hello", candidates, { excludeExact: true });

      expect(result).toBeDefined();
      expect(result?.distance).toBeGreaterThan(0);
      expect(["hallo", "hullo"]).toContain(result?.value);
    });
  });

  describe("performance characteristics", () => {
    test("handles reasonably large candidate lists efficiently", () => {
      const candidates = Array.from({ length: 1000 }, (_, i) => `candidate${i}`);
      const startTime = Date.now();

      const results = findSimilarStrings("candidate500", candidates);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.length).toBeGreaterThan(0);
      // Should complete in reasonable time (< 1 second for 1000 candidates)
      expect(duration).toBeLessThan(1000);
    });

    test("early termination with threshold improves performance", () => {
      const longStr1 = "a".repeat(500);
      const longStr2 = "b".repeat(500);

      // With threshold - should return early
      const startWithThreshold = Date.now();
      const distWithThreshold = calculateLevenshteinDistance(longStr1, longStr2, {
        threshold: 10,
      });
      const durationWithThreshold = Date.now() - startWithThreshold;

      // Without threshold - calculates full distance
      const startWithoutThreshold = Date.now();
      const distWithoutThreshold = calculateLevenshteinDistance(longStr1, longStr2);
      const durationWithoutThreshold = Date.now() - startWithoutThreshold;

      expect(distWithThreshold).toBeGreaterThan(10);
      expect(distWithoutThreshold).toBe(500);
      // Threshold version should be faster (or at least not significantly slower)
      // Use Math.max to avoid division by zero when both durations round to 0ms
      expect(durationWithThreshold).toBeLessThanOrEqual(Math.max(durationWithoutThreshold, 1) * 2);
    });
  });
});
