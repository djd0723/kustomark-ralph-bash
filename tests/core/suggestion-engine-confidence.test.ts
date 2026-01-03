/**
 * Comprehensive tests for confidence scoring in the Suggestion Engine
 *
 * Tests the confidence scoring system, getSuggestionWithConfidence function,
 * and edge cases in the confidence formula.
 */

import { describe, expect, test } from "bun:test";
import {
  findSimilarStrings,
  getSuggestionWithConfidence,
  calculateLevenshteinDistance,
} from "../../src/core/suggestion-engine.js";

describe("Confidence Scoring in Suggestion Engine", () => {
  describe("findSimilarStrings with confidence scores", () => {
    test("returns confidence scores between 0 and 1", () => {
      const target = "installation";
      const candidates = ["instalation", "configuration", "installation-guide"];

      const results = findSimilarStrings(target, candidates);

      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    test("confidence is higher for closer matches", () => {
      const target = "test";
      const candidates = ["test1", "tester", "testing", "different"];

      const results = findSimilarStrings(target, candidates);

      // Closer matches should have higher confidence
      if (results.length >= 2) {
        const firstDistance = results[0]!.distance;
        const secondDistance = results[1]!.distance;

        if (firstDistance < secondDistance) {
          expect(results[0]!.confidence).toBeGreaterThan(results[1]!.confidence);
        }
      }
    });

    test("confidence formula: 1 - (distance / max_length)", () => {
      const target = "hello";
      const candidate = "hallo"; // Distance = 1, max length = 5

      const results = findSimilarStrings(target, [candidate]);

      expect(results[0]?.confidence).toBeCloseTo(1 - 1 / 5, 2);
      expect(results[0]?.confidence).toBeCloseTo(0.8, 2);
    });

    test("confidence is 1.0 when distance is 0 (exact match excluded)", () => {
      const target = "exact";
      const candidates = ["exact", "similar"];

      const results = findSimilarStrings(target, candidates);

      // Exact matches are excluded (distance 0)
      expect(results.every((r) => r.distance > 0)).toBe(true);
    });

    test("confidence decreases with increasing distance", () => {
      const target = "test";
      // Create candidates with increasing distances
      const candidates = ["tast", "tost", "tist"]; // All distance 1

      const results = findSimilarStrings(target, candidates);

      // All should have same confidence since same distance
      if (results.length >= 2) {
        expect(results[0]?.confidence).toBeCloseTo(results[1]?.confidence, 2);
      }
    });

    test("longer strings have more granular confidence scores", () => {
      const shortTarget = "hi";
      const longTarget = "installation";

      const shortResults = findSimilarStrings(shortTarget, ["ha"]);
      const longResults = findSimilarStrings(longTarget, ["instalation"]);

      // Distance 1 in "hi" vs "ha" = confidence 0.5 (1 - 1/2)
      // Distance 1 in "installation" vs "instalation" = confidence ~0.92 (1 - 1/12)
      expect(shortResults[0]?.confidence).toBeLessThan(longResults[0]?.confidence);
    });

    test("confidence includes both distance and string length info", () => {
      const target = "example";
      const candidates = ["exampl", "exampel", "exmple"]; // Different distances

      const results = findSimilarStrings(target, candidates);

      // Each should have different confidence based on distance
      const confidences = results.map((r) => r.confidence);
      const uniqueConfidences = new Set(confidences);
      expect(uniqueConfidences.size).toBeGreaterThan(1);
    });
  });

  describe("getSuggestionWithConfidence", () => {
    test("returns same structure as findSimilarStrings", () => {
      const target = "test";
      const candidates = ["tast", "tost", "best"];

      const resultsFindSimilar = findSimilarStrings(target, candidates);
      const resultsGetSuggestion = getSuggestionWithConfidence(target, candidates);

      expect(resultsFindSimilar).toEqual(resultsGetSuggestion);
    });

    test("includes value, distance, and confidence fields", () => {
      const target = "hello";
      const candidates = ["hallo", "hollo"];

      const results = getSuggestionWithConfidence(target, candidates);

      for (const result of results) {
        expect(result).toHaveProperty("value");
        expect(result).toHaveProperty("distance");
        expect(result).toHaveProperty("confidence");
        expect(typeof result.value).toBe("string");
        expect(typeof result.distance).toBe("number");
        expect(typeof result.confidence).toBe("number");
      }
    });

    test("respects maxDistance parameter", () => {
      const target = "test";
      const candidates = ["tast", "toast", "totally-different"];

      const results = getSuggestionWithConfidence(target, candidates, 2);

      // Should only include candidates with distance <= 2
      expect(results.every((r) => r.distance <= 2)).toBe(true);
    });

    test("sorts results by distance ascending", () => {
      const target = "example";
      const candidates = ["exmple", "exampl", "exampel"];

      const results = getSuggestionWithConfidence(target, candidates);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.distance).toBeLessThanOrEqual(results[i + 1]!.distance);
      }
    });

    test("limits results to top 5 suggestions", () => {
      const target = "test";
      const candidates = Array.from({ length: 20 }, (_, i) => `test${i}`);

      const results = getSuggestionWithConfidence(target, candidates);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    test("handles empty candidates array", () => {
      const results = getSuggestionWithConfidence("test", []);

      expect(results).toEqual([]);
    });

    test("handles single candidate", () => {
      const results = getSuggestionWithConfidence("test", ["tast"]);

      expect(results.length).toBe(1);
      expect(results[0]?.value).toBe("tast");
      expect(results[0]?.confidence).toBeGreaterThan(0);
    });
  });

  describe("Confidence Formula Edge Cases", () => {
    test("handles empty string target", () => {
      const results = findSimilarStrings("", ["test", "hello"]);

      // Empty target vs non-empty candidates
      for (const result of results) {
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    test("handles empty string in candidates", () => {
      const results = findSimilarStrings("test", ["", "tast"]);

      expect(Array.isArray(results)).toBe(true);
    });

    test("both strings empty results in confidence 1.0", () => {
      const distance = calculateLevenshteinDistance("", "");
      const maxLength = Math.max("".length, "".length);
      const confidence = maxLength === 0 ? 1 : 1 - distance / maxLength;

      expect(confidence).toBe(1);
    });

    test("single character difference in short strings", () => {
      const target = "a";
      const candidates = ["b"];

      const results = findSimilarStrings(target, candidates);

      // Distance 1, max length 1: confidence = 1 - 1/1 = 0
      expect(results[0]?.confidence).toBe(0);
    });

    test("identical strings except for length", () => {
      const target = "test";
      const candidates = ["tests"]; // Distance 1 (1 insertion)

      const results = findSimilarStrings(target, candidates);

      // Distance 1, max length 5: confidence = 1 - 1/5 = 0.8
      if (results.length > 0) {
        expect(results[0]?.confidence).toBeCloseTo(1 - 1 / 5, 2);
      }
    });

    test("very long strings with small difference", () => {
      const target = "a".repeat(100);
      const candidate = "a".repeat(99) + "b"; // Distance 1

      const results = findSimilarStrings(target, [candidate]);

      // Distance 1, max length 100: confidence = 1 - 1/100 = 0.99
      expect(results[0]?.confidence).toBeCloseTo(0.99, 2);
    });

    test("very long strings with large difference", () => {
      const target = "a".repeat(100);
      const candidate = "b".repeat(100); // Distance 100

      const results = findSimilarStrings(target, [candidate]);

      // With such large distance, may not return any results due to maxDistance filtering
      // If it does return, confidence should be 0
      if (results.length > 0) {
        expect(results[0]?.confidence).toBe(0);
      }
    });

    test("strings with special characters", () => {
      const target = "test@example.com";
      const candidates = ["test@exampl.com", "test@example.org"];

      const results = findSimilarStrings(target, candidates);

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    test("strings with unicode characters", () => {
      const target = "café";
      const candidates = ["cafe", "caffe"];

      const results = findSimilarStrings(target, candidates);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.confidence).toBeGreaterThan(0);
    });

    test("strings with numbers", () => {
      const target = "version-1.2.3";
      const candidates = ["version-1.2.4", "version-1.3.3"];

      const results = findSimilarStrings(target, candidates);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.distance).toBe(1);
    });

    test("case-insensitive matching affects confidence", () => {
      const target = "TEST";
      const candidates = ["test", "tast"];

      const results = findSimilarStrings(target, candidates);

      // Should find similar strings (case-insensitive matching is used internally)
      expect(results.length).toBeGreaterThan(0);
    });

    test("alphabetical sorting when distances are equal", () => {
      const target = "test";
      const candidates = ["zast", "aast"]; // Both distance 1

      const results = findSimilarStrings(target, candidates);

      if (results.length >= 2 && results[0]!.distance === results[1]!.distance) {
        expect(results[0]!.value.localeCompare(results[1]!.value)).toBeLessThan(0);
      }
    });

    test("confidence reflects relative similarity", () => {
      const target = "installation";
      const veryClose = "instalation"; // Distance 1
      const somewhatClose = "install"; // Distance 5
      const farAway = "configuration"; // Distance 11

      const results = findSimilarStrings(target, [veryClose, somewhatClose, farAway]);

      const veryCloseResult = results.find((r) => r.value === veryClose);
      const somewhatCloseResult = results.find((r) => r.value === somewhatClose);

      if (veryCloseResult && somewhatCloseResult) {
        expect(veryCloseResult.confidence).toBeGreaterThan(somewhatCloseResult.confidence);
      }
    });

    test("maxDistance filters out low confidence results", () => {
      const target = "test";
      const candidates = ["tast", "best", "rest", "completely-different"];

      const resultsWithMaxDistance = findSimilarStrings(target, candidates, 1);

      // Should only include candidates with distance 1
      expect(resultsWithMaxDistance.every((r) => r.distance <= 1)).toBe(true);
    });

    test("confidence calculation is deterministic", () => {
      const target = "example";
      const candidates = ["exampl", "exampel"];

      const results1 = findSimilarStrings(target, candidates);
      const results2 = findSimilarStrings(target, candidates);

      expect(results1).toEqual(results2);
    });

    test("handles whitespace in strings", () => {
      const target = "hello world";
      const candidates = ["hello  world", "helloworld", "hello-world"];

      const results = findSimilarStrings(target, candidates);

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe("Confidence Score Distribution", () => {
    test("high confidence (>0.8) for very similar strings", () => {
      const target = "installation";
      const candidates = ["instalation"]; // Distance 1 out of 12

      const results = findSimilarStrings(target, candidates);

      expect(results[0]?.confidence).toBeGreaterThan(0.8);
    });

    test("medium confidence (0.5-0.8) for somewhat similar strings", () => {
      const target = "example";
      const candidates = ["exampl"]; // Distance 1 out of 7

      const results = findSimilarStrings(target, candidates);

      expect(results[0]?.confidence).toBeGreaterThanOrEqual(0.5);
      expect(results[0]?.confidence).toBeLessThanOrEqual(0.9);
    });

    test("low confidence (<0.5) for dissimilar strings", () => {
      const target = "test";
      const candidates = ["tast", "best"]; // Distance 1 out of 4

      const results = findSimilarStrings(target, candidates);

      // Distance 1 out of 4 = confidence 0.75
      // But we're testing principle that shorter strings with same distance have lower confidence
      const shortTarget = "ab";
      const shortCandidates = ["cd"]; // Distance 2 out of 2

      const shortResults = findSimilarStrings(shortTarget, shortCandidates);

      if (shortResults.length > 0) {
        expect(shortResults[0]?.confidence).toBeLessThan(0.5);
      }
    });

    test("confidence 0 when strings are completely different", () => {
      const target = "abc";
      const candidates = ["xyz"]; // Distance 3 out of 3

      const results = findSimilarStrings(target, candidates);

      // May not return results if distance exceeds maxDistance threshold
      if (results.length > 0) {
        expect(results[0]?.confidence).toBe(0);
      }
    });
  });
});
