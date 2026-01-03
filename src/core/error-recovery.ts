/**
 * Intelligent Error Recovery System
 *
 * This module provides an intelligent error recovery system that can automatically
 * detect and fix common patch errors. It includes:
 * - Built-in recovery strategies for common error patterns
 * - Extensible strategy system for custom recovery logic
 * - Confidence scoring to determine when auto-recovery is safe
 * - Alternative fix suggestions when confidence is low
 *
 * @example
 * ```typescript
 * const engine = new ErrorRecoveryEngine();
 * const patch = { op: 'replace', old: 'Hello World', new: 'Hello TypeScript' };
 * const error = new PatchError('matched 0 times', 'PATCH_NO_MATCH');
 *
 * // Try automatic recovery (only if confidence >= 0.8)
 * const result = await engine.recoverAutomatically(error, content, patch);
 * if (result?.success) {
 *   // Apply the fixed patch
 *   applyPatch(content, result.fixedPatch);
 * }
 *
 * // Or get all possible recoveries sorted by confidence
 * const recoveries = await engine.findRecoveries(error, content, patch);
 * for (const recovery of recoveries) {
 *   console.log(`${recovery.message} (confidence: ${recovery.confidence})`);
 * }
 * ```
 */

import type { PatchError } from "./errors.js";
import { parseFrontmatter, parseSections } from "./patch-engine.js";
import { findSimilarStrings } from "./suggestion-engine.js";
import type { PatchOperation } from "./types.js";

/**
 * Strategy for recovering from a specific type of error
 *
 * Each strategy implements logic to detect if it can recover from an error,
 * and if so, provides a fixed patch or alternative suggestions.
 */
export interface ErrorRecoveryStrategy {
  /** Unique identifier for this strategy */
  id: string;

  /** Human-readable name for this strategy */
  name: string;

  /** Description of what this strategy does */
  description: string;

  /** Base confidence score for this strategy (0-1) */
  confidence: number;

  /**
   * Checks if this strategy can recover from the given error
   *
   * @param error - The patch error that occurred
   * @param content - The content being patched
   * @param patch - The patch operation that failed
   * @returns true if this strategy can attempt recovery
   */
  canRecover: (
    error: PatchError,
    content: string,
    patch: PatchOperation,
  ) => boolean | Promise<boolean>;

  /**
   * Attempts to recover from the error by providing a fixed patch
   *
   * @param error - The patch error that occurred
   * @param content - The content being patched
   * @param patch - The patch operation that failed
   * @returns Recovery result with fixed patch and confidence score
   */
  recover: (
    error: PatchError,
    content: string,
    patch: PatchOperation,
  ) => RecoveryResult | Promise<RecoveryResult>;
}

/**
 * Result of an error recovery attempt
 */
export interface RecoveryResult {
  /** Whether the recovery was successful */
  success: boolean;

  /** The auto-corrected patch (if recovery was successful) */
  fixedPatch?: PatchOperation;

  /** Human-readable explanation of what was fixed */
  message: string;

  /** Confidence score for this recovery (0-1) */
  confidence: number;

  /** Alternative fix options if the main fix has low confidence */
  alternatives?: PatchOperation[];
}

/**
 * Section ID typo recovery strategy
 *
 * Uses Levenshtein distance to find similar section IDs when a section
 * operation fails due to section not found.
 */
class SectionIdTypoRecovery implements ErrorRecoveryStrategy {
  id = "section-id-typo";
  name = "Section ID Typo Recovery";
  description = "Finds similar section IDs using fuzzy matching";
  confidence = 0.85;

  canRecover(_error: PatchError, _content: string, patch: PatchOperation): boolean {
    // Check if this is a section operation that failed
    const sectionOps = [
      "remove-section",
      "replace-section",
      "prepend-to-section",
      "append-to-section",
      "rename-header",
      "move-section",
      "change-section-level",
    ];

    return (
      sectionOps.includes(patch.op) && _error.message.includes("matched 0 times") && "id" in patch
    );
  }

  recover(_error: PatchError, content: string, patch: PatchOperation): RecoveryResult {
    if (!("id" in patch)) {
      return {
        success: false,
        message: "Patch does not have an ID field",
        confidence: 0,
      };
    }

    const sections = parseSections(content);
    const sectionIds = sections.map((s) => s.id);
    const targetId = patch.id as string;

    // Find similar section IDs
    const similar = findSimilarStrings(targetId, sectionIds);

    if (similar.length === 0) {
      return {
        success: false,
        message: `No similar section IDs found for '${targetId}'`,
        confidence: 0,
      };
    }

    // Take the closest match
    const bestMatch = similar[0];
    if (!bestMatch) {
      return {
        success: false,
        message: `No similar section IDs found for '${targetId}'`,
        confidence: 0,
      };
    }

    // Calculate confidence based on distance
    const maxDistance = Math.max(3, Math.floor(targetId.length * 0.3));
    const normalizedDistance = Math.min(1, bestMatch.distance / maxDistance);
    const confidence = this.confidence * (1 - normalizedDistance);

    // Create fixed patch
    const fixedPatch = { ...patch, id: bestMatch.value };

    // Create alternatives from other matches
    const alternatives = similar.slice(1, 4).map((match) => ({
      ...patch,
      id: match.value,
    }));

    return {
      success: true,
      fixedPatch,
      message: `Fixed section ID typo: '${targetId}' → '${bestMatch.value}' (distance: ${bestMatch.distance})`,
      confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }
}

/**
 * Case mismatch recovery strategy
 *
 * Handles errors where the text exists but with different casing,
 * such as "hello world" vs "Hello World".
 */
class CaseMismatchRecovery implements ErrorRecoveryStrategy {
  id = "case-mismatch";
  name = "Case Mismatch Recovery";
  description = "Handles case sensitivity issues in string matching";
  confidence = 0.9;

  canRecover(_error: PatchError, content: string, patch: PatchOperation): boolean {
    // Check if this is a text-based operation
    const textOps = ["replace", "replace-line"];
    if (!textOps.includes(patch.op)) {
      return false;
    }

    // Check if error is about not matching
    if (!_error.message.includes("matched 0 times")) {
      return false;
    }

    // Check if the text exists with different casing
    if (patch.op === "replace" && "old" in patch) {
      const oldText = patch.old as string;
      return !content.includes(oldText) && content.toLowerCase().includes(oldText.toLowerCase());
    }

    if (patch.op === "replace-line" && "match" in patch) {
      const matchText = patch.match as string;
      const lines = content.split("\n");
      return (
        !lines.some((line) => line === matchText) &&
        lines.some((line) => line.toLowerCase() === matchText.toLowerCase())
      );
    }

    return false;
  }

  recover(_error: PatchError, content: string, patch: PatchOperation): RecoveryResult {
    if (patch.op === "replace" && "old" in patch) {
      const oldText = patch.old as string;
      const lines = content.split("\n");

      // Find the line with different casing
      for (const line of lines) {
        if (line.toLowerCase() === oldText.toLowerCase()) {
          // Extract the actual text from the content
          const actualText = line;
          const fixedPatch = { ...patch, old: actualText };

          return {
            success: true,
            fixedPatch,
            message: `Fixed case mismatch: '${oldText}' → '${actualText}'`,
            confidence: this.confidence,
          };
        }
      }

      // Try to find a substring match with different casing
      const lowerContent = content.toLowerCase();
      const lowerOld = oldText.toLowerCase();
      const index = lowerContent.indexOf(lowerOld);

      if (index !== -1) {
        const actualText = content.substring(index, index + oldText.length);
        const fixedPatch = { ...patch, old: actualText };

        return {
          success: true,
          fixedPatch,
          message: `Fixed case mismatch: '${oldText}' → '${actualText}'`,
          confidence: this.confidence,
        };
      }
    }

    if (patch.op === "replace-line" && "match" in patch) {
      const matchText = patch.match as string;
      const lines = content.split("\n");

      for (const line of lines) {
        if (line.toLowerCase() === matchText.toLowerCase()) {
          const fixedPatch = { ...patch, match: line };

          return {
            success: true,
            fixedPatch,
            message: `Fixed case mismatch in line: '${matchText}' → '${line}'`,
            confidence: this.confidence,
          };
        }
      }
    }

    return {
      success: false,
      message: "Could not find text with different casing",
      confidence: 0,
    };
  }
}

/**
 * Whitespace normalization recovery strategy
 *
 * Handles errors where text doesn't match due to extra spaces, tabs,
 * or different whitespace characters.
 */
class WhitespaceNormalizationRecovery implements ErrorRecoveryStrategy {
  id = "whitespace-normalization";
  name = "Whitespace Normalization Recovery";
  description = "Handles extra/missing spaces and whitespace differences";
  confidence = 0.88;

  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  canRecover(_error: PatchError, content: string, patch: PatchOperation): boolean {
    const textOps = ["replace", "replace-line"];
    if (!textOps.includes(patch.op)) {
      return false;
    }

    if (!_error.message.includes("matched 0 times")) {
      return false;
    }

    if (patch.op === "replace" && "old" in patch) {
      const oldText = patch.old as string;
      const normalizedOld = this.normalizeWhitespace(oldText);
      const normalizedContent = this.normalizeWhitespace(content);

      return !content.includes(oldText) && normalizedContent.includes(normalizedOld);
    }

    if (patch.op === "replace-line" && "match" in patch) {
      const matchText = patch.match as string;
      const normalizedMatch = this.normalizeWhitespace(matchText);
      const lines = content.split("\n");

      return (
        !lines.some((line) => line === matchText) &&
        lines.some((line) => this.normalizeWhitespace(line) === normalizedMatch)
      );
    }

    return false;
  }

  recover(_error: PatchError, content: string, patch: PatchOperation): RecoveryResult {
    if (patch.op === "replace" && "old" in patch) {
      const oldText = patch.old as string;
      const normalizedOld = this.normalizeWhitespace(oldText);

      // Split content into lines and check each one
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const normalizedLine = this.normalizeWhitespace(line);
        if (normalizedLine.includes(normalizedOld)) {
          // Find the actual text in the original line
          // This is tricky - we need to find the substring that normalizes to normalizedOld
          const words = line.split(/\s+/);
          let actualText = "";

          // Try to reconstruct the text with original whitespace
          for (let start = 0; start < words.length; start++) {
            for (let end = start + 1; end <= words.length; end++) {
              const candidate = line.substring(
                line.indexOf(words[start] || ""),
                line.indexOf(words[end - 1] || "") + (words[end - 1]?.length || 0),
              );

              if (this.normalizeWhitespace(candidate) === normalizedOld) {
                actualText = candidate;
                break;
              }
            }
            if (actualText) break;
          }

          if (actualText) {
            const fixedPatch = { ...patch, old: actualText };
            return {
              success: true,
              fixedPatch,
              message: `Fixed whitespace differences: '${oldText}' → '${actualText}'`,
              confidence: this.confidence,
            };
          }
        }
      }
    }

    if (patch.op === "replace-line" && "match" in patch) {
      const matchText = patch.match as string;
      const normalizedMatch = this.normalizeWhitespace(matchText);
      const lines = content.split("\n");

      for (const line of lines) {
        if (this.normalizeWhitespace(line) === normalizedMatch) {
          const fixedPatch = { ...patch, match: line };
          return {
            success: true,
            fixedPatch,
            message: `Fixed whitespace in line match: '${matchText}' → '${line}'`,
            confidence: this.confidence,
          };
        }
      }
    }

    return {
      success: false,
      message: "Could not normalize whitespace to find match",
      confidence: 0,
    };
  }
}

/**
 * Frontmatter key typo recovery strategy
 *
 * Uses Levenshtein distance to find similar frontmatter keys when
 * a frontmatter operation fails.
 */
class FrontmatterKeyTypoRecovery implements ErrorRecoveryStrategy {
  id = "frontmatter-key-typo";
  name = "Frontmatter Key Typo Recovery";
  description = "Finds similar frontmatter keys using fuzzy matching";
  confidence = 0.85;

  canRecover(_error: PatchError, _content: string, patch: PatchOperation): boolean {
    const frontmatterOps = ["remove-frontmatter", "rename-frontmatter"];
    return frontmatterOps.includes(patch.op) && _error.message.includes("matched 0 times");
  }

  recover(_error: PatchError, content: string, patch: PatchOperation): RecoveryResult {
    const { data } = parseFrontmatter(content);
    const keys = Object.keys(data);

    let targetKey: string;
    if (patch.op === "remove-frontmatter" && "key" in patch) {
      targetKey = patch.key as string;
    } else if (patch.op === "rename-frontmatter" && "old" in patch) {
      targetKey = patch.old as string;
    } else {
      return {
        success: false,
        message: "Invalid frontmatter patch operation",
        confidence: 0,
      };
    }

    // Find similar keys
    const similar = findSimilarStrings(targetKey, keys);

    if (similar.length === 0) {
      return {
        success: false,
        message: `No similar frontmatter keys found for '${targetKey}'`,
        confidence: 0,
      };
    }

    const bestMatch = similar[0];
    if (!bestMatch) {
      return {
        success: false,
        message: `No similar frontmatter keys found for '${targetKey}'`,
        confidence: 0,
      };
    }

    // Calculate confidence based on distance
    const maxDistance = Math.max(3, Math.floor(targetKey.length * 0.3));
    const normalizedDistance = Math.min(1, bestMatch.distance / maxDistance);
    const confidence = this.confidence * (1 - normalizedDistance);

    // Create fixed patch
    let fixedPatch: PatchOperation;
    if (patch.op === "remove-frontmatter") {
      fixedPatch = { ...patch, key: bestMatch.value };
    } else {
      fixedPatch = { ...patch, old: bestMatch.value };
    }

    // Create alternatives
    const alternatives = similar.slice(1, 4).map((match) => {
      if (patch.op === "remove-frontmatter") {
        return { ...patch, key: match.value };
      } else {
        return { ...patch, old: match.value };
      }
    });

    return {
      success: true,
      fixedPatch,
      message: `Fixed frontmatter key typo: '${targetKey}' → '${bestMatch.value}' (distance: ${bestMatch.distance})`,
      confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }
}

/**
 * Line match fuzzy recovery strategy
 *
 * Finds similar lines when exact line matching fails, using
 * Levenshtein distance for fuzzy matching.
 */
class LineFuzzyMatchRecovery implements ErrorRecoveryStrategy {
  id = "line-fuzzy-match";
  name = "Line Fuzzy Match Recovery";
  description = "Finds similar lines with slight differences";
  confidence = 0.75;

  canRecover(_error: PatchError, _content: string, patch: PatchOperation): boolean {
    const lineOps = ["replace-line", "insert-after-line", "insert-before-line"];
    return (
      lineOps.includes(patch.op) && _error.message.includes("matched 0 times") && "match" in patch
    );
  }

  recover(_error: PatchError, content: string, patch: PatchOperation): RecoveryResult {
    if (!("match" in patch)) {
      return {
        success: false,
        message: "Patch does not have a match field",
        confidence: 0,
      };
    }

    const matchText = patch.match as string;
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    // Find similar lines using Levenshtein distance
    const similar = findSimilarStrings(matchText, lines);

    if (similar.length === 0) {
      return {
        success: false,
        message: `No similar lines found for '${matchText}'`,
        confidence: 0,
      };
    }

    const bestMatch = similar[0];
    if (!bestMatch) {
      return {
        success: false,
        message: `No similar lines found for '${matchText}'`,
        confidence: 0,
      };
    }

    // Calculate confidence - stricter for line matching
    const maxDistance = Math.max(5, Math.floor(matchText.length * 0.2));
    const normalizedDistance = Math.min(1, bestMatch.distance / maxDistance);
    const confidence = this.confidence * (1 - normalizedDistance);

    const fixedPatch = { ...patch, match: bestMatch.value };

    const alternatives = similar.slice(1, 4).map((match) => ({
      ...patch,
      match: match.value,
    }));

    return {
      success: true,
      fixedPatch,
      message: `Found similar line: '${matchText}' → '${bestMatch.value}' (distance: ${bestMatch.distance})`,
      confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }
}

/**
 * Marker order recovery strategy
 *
 * Detects when start/end markers are reversed in delete-between or
 * replace-between operations.
 */
class MarkerOrderRecovery implements ErrorRecoveryStrategy {
  id = "marker-order";
  name = "Marker Order Recovery";
  description = "Detects when start/end markers are reversed";
  confidence = 0.95;

  canRecover(_error: PatchError, content: string, patch: PatchOperation): boolean {
    const markerOps = ["delete-between", "replace-between"];
    if (!markerOps.includes(patch.op)) {
      return false;
    }

    if (!_error.message.includes("matched 0 times")) {
      return false;
    }

    if (!("start" in patch && "end" in patch)) {
      return false;
    }

    const startMarker = patch.start as string;
    const endMarker = patch.end as string;

    // Check if both markers exist
    const hasStart = content.includes(startMarker);
    const hasEnd = content.includes(endMarker);

    if (!hasStart || !hasEnd) {
      return false;
    }

    // Check if they're in the wrong order
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    return endIndex < startIndex;
  }

  recover(_error: PatchError, _content: string, patch: PatchOperation): RecoveryResult {
    if (!("start" in patch && "end" in patch)) {
      return {
        success: false,
        message: "Patch does not have start/end markers",
        confidence: 0,
      };
    }

    const startMarker = patch.start as string;
    const endMarker = patch.end as string;

    // Swap the markers
    const fixedPatch = {
      ...patch,
      start: endMarker,
      end: startMarker,
    };

    return {
      success: true,
      fixedPatch,
      message: `Fixed marker order: swapped '${startMarker}' and '${endMarker}'`,
      confidence: this.confidence,
    };
  }
}

/**
 * Error Recovery Engine
 *
 * Manages error recovery strategies and provides methods to:
 * - Register custom recovery strategies
 * - Find all applicable recoveries for an error
 * - Automatically recover from errors when confidence is high enough
 */
export class ErrorRecoveryEngine {
  private strategies: ErrorRecoveryStrategy[] = [];

  constructor() {
    // Register built-in strategies
    this.registerStrategy(new SectionIdTypoRecovery());
    this.registerStrategy(new CaseMismatchRecovery());
    this.registerStrategy(new WhitespaceNormalizationRecovery());
    this.registerStrategy(new FrontmatterKeyTypoRecovery());
    this.registerStrategy(new LineFuzzyMatchRecovery());
    this.registerStrategy(new MarkerOrderRecovery());
  }

  /**
   * Register a custom error recovery strategy
   *
   * @param strategy - The recovery strategy to register
   */
  registerStrategy(strategy: ErrorRecoveryStrategy): void {
    // Check for duplicate IDs
    const existing = this.strategies.find((s) => s.id === strategy.id);
    if (existing) {
      throw new Error(`Strategy with ID '${strategy.id}' is already registered`);
    }

    this.strategies.push(strategy);
  }

  /**
   * Find all applicable recovery strategies for an error
   *
   * Returns results sorted by confidence (highest first).
   *
   * @param error - The patch error that occurred
   * @param content - The content being patched
   * @param patch - The patch operation that failed
   * @returns Array of recovery results sorted by confidence
   */
  async findRecoveries(
    error: PatchError,
    content: string,
    patch: PatchOperation,
  ): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];

    for (const strategy of this.strategies) {
      try {
        const canRecover = await strategy.canRecover(error, content, patch);
        if (!canRecover) {
          continue;
        }

        const result = await strategy.recover(error, content, patch);
        if (result.success) {
          results.push(result);
        }
      } catch (err) {
        // Strategy failed - continue with other strategies
        console.warn(
          `Recovery strategy '${strategy.id}' failed:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Attempt automatic recovery from an error
   *
   * Only returns a recovery result if the confidence is above the minimum threshold.
   * This is useful for automatically fixing errors without user intervention.
   *
   * @param error - The patch error that occurred
   * @param content - The content being patched
   * @param patch - The patch operation that failed
   * @param minConfidence - Minimum confidence required for automatic recovery (default: 0.8)
   * @returns Recovery result if confidence is high enough, null otherwise
   */
  async recoverAutomatically(
    error: PatchError,
    content: string,
    patch: PatchOperation,
    minConfidence = 0.8,
  ): Promise<RecoveryResult | null> {
    const recoveries = await this.findRecoveries(error, content, patch);

    if (recoveries.length === 0) {
      return null;
    }

    const bestRecovery = recoveries[0];
    if (!bestRecovery) {
      return null;
    }

    // Only return if confidence is high enough
    if (bestRecovery.confidence >= minConfidence) {
      return bestRecovery;
    }

    return null;
  }
}
