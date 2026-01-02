/**
 * Smart Error Recovery - Suggestion Engine
 *
 * Provides intelligent suggestions when patches fail to match by:
 * - Calculating string similarity using Levenshtein distance
 * - Finding similar strings using fuzzy matching
 * - Suggesting section IDs when section operations fail
 * - Suggesting frontmatter keys when frontmatter operations fail
 */

import { parseFrontmatter, parseSections } from "./patch-engine.js";
import type { PatchOperation } from "./types.js";

/**
 * Calculate Levenshtein distance between two strings
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string into another.
 *
 * @param a - First string
 * @param b - Second string
 * @returns The Levenshtein distance
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  // Handle edge cases
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = [];

  // Initialize first column (deletions from a)
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row (insertions to a)
  for (let j = 0; j <= b.length; j++) {
    if (matrix[0]) {
      matrix[0][j] = j;
    }
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      const deletion = (matrix[i - 1]?.[j] ?? 0) + 1;
      const insertion = (matrix[i]?.[j - 1] ?? 0) + 1;
      const substitution = (matrix[i - 1]?.[j - 1] ?? 0) + cost;

      const minValue = Math.min(deletion, insertion, substitution);
      // matrix[i] is guaranteed to exist because we initialized it in the first loop
      const row = matrix[i];
      if (row) {
        row[j] = minValue;
      }
    }
  }

  return matrix[a.length]?.[b.length] ?? 0;
}

/**
 * Find similar strings from a list of candidates using fuzzy matching
 *
 * @param target - The target string to match against
 * @param candidates - Array of candidate strings to search through
 * @param maxDistance - Maximum Levenshtein distance to consider (default: auto-calculated based on target length)
 * @returns Array of similar strings with their distances, sorted by distance (closest first)
 */
export function findSimilarStrings(
  target: string,
  candidates: string[],
  maxDistance?: number,
): Array<{ value: string; distance: number }> {
  // Auto-calculate maxDistance based on target length if not provided
  const threshold =
    maxDistance ?? (target.length <= 5 ? 2 : target.length <= 10 ? 3 : target.length <= 20 ? 5 : 7);

  const results: Array<{ value: string; distance: number }> = [];

  // Also check case-insensitive matches
  const targetLower = target.toLowerCase();

  for (const candidate of candidates) {
    // Calculate distance for exact case
    const distance = calculateLevenshteinDistance(target, candidate);

    // Also check case-insensitive distance
    const distanceLower = calculateLevenshteinDistance(targetLower, candidate.toLowerCase());

    // Use the smaller distance
    const finalDistance = Math.min(distance, distanceLower);

    if (finalDistance <= threshold && finalDistance > 0) {
      // Don't include exact matches (distance 0)
      results.push({ value: candidate, distance: finalDistance });
    }
  }

  // Sort by distance (closest first), then alphabetically for ties
  results.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.value.localeCompare(b.value);
  });

  // Limit to top 5 suggestions
  return results.slice(0, 5);
}

/**
 * Generate suggestions for similar section IDs
 *
 * @param sectionId - The section ID that wasn't found
 * @param content - The markdown content to search for sections
 * @returns Array of suggestion strings
 */
export function generateSectionSuggestions(sectionId: string, content: string): string[] {
  const sections = parseSections(content);
  const sectionIds = sections.map((s) => s.id);

  if (sectionIds.length === 0) {
    return ["No sections found in the document"];
  }

  const similar = findSimilarStrings(sectionId, sectionIds);

  if (similar.length === 0) {
    // No similar sections found, list available sections
    const available =
      sectionIds.length <= 5
        ? sectionIds
        : [...sectionIds.slice(0, 5), `... and ${sectionIds.length - 5} more`];
    return [`Available sections: ${available.join(", ")}`];
  }

  const suggestions: string[] = [];
  for (const { value } of similar) {
    suggestions.push(`Did you mean '${value}'?`);
  }

  return suggestions;
}

/**
 * Generate suggestions for similar frontmatter keys
 *
 * @param key - The frontmatter key that wasn't found
 * @param frontmatter - The frontmatter object to search for keys
 * @returns Array of suggestion strings
 */
export function generateFrontmatterKeySuggestions(
  key: string,
  frontmatter: Record<string, unknown>,
): string[] {
  const keys = Object.keys(frontmatter);

  if (keys.length === 0) {
    return ["No frontmatter keys found in the document"];
  }

  const similar = findSimilarStrings(key, keys);

  if (similar.length === 0) {
    // No similar keys found, list available keys
    const available =
      keys.length <= 5 ? keys : [...keys.slice(0, 5), `... and ${keys.length - 5} more`];
    return [`Available frontmatter keys: ${available.join(", ")}`];
  }

  const suggestions: string[] = [];
  for (const { value } of similar) {
    suggestions.push(`Did you mean '${value}'?`);
  }

  return suggestions;
}

/**
 * Generate helpful patch suggestions based on patch type and error
 *
 * @param patch - The patch operation that failed
 * @param content - The content that was being patched
 * @param error - The error message (typically "matched 0 times")
 * @returns Array of suggestion strings
 */
export function generatePatchSuggestions(
  patch: PatchOperation,
  content: string,
  error: string,
): string[] {
  // Only generate suggestions for "matched 0 times" errors
  if (!error.includes("matched 0 times")) {
    return [];
  }

  const suggestions: string[] = [];

  switch (patch.op) {
    case "remove-section":
    case "replace-section":
    case "prepend-to-section":
    case "append-to-section":
    case "rename-header":
    case "move-section":
    case "change-section-level": {
      // Section operations - suggest similar section IDs
      const sectionSuggestions = generateSectionSuggestions(patch.id, content);
      suggestions.push(...sectionSuggestions);
      break;
    }

    case "remove-frontmatter":
    case "rename-frontmatter": {
      // Frontmatter operations - suggest similar keys
      const { data } = parseFrontmatter(content);
      const key = patch.op === "rename-frontmatter" ? patch.old : patch.key;
      const frontmatterSuggestions = generateFrontmatterKeySuggestions(key, data);
      suggestions.push(...frontmatterSuggestions);
      break;
    }

    case "replace": {
      // String replacement - check if the string exists with different case
      const oldLower = patch.old.toLowerCase();
      const contentLower = content.toLowerCase();
      if (contentLower.includes(oldLower) && !content.includes(patch.old)) {
        suggestions.push(
          "The string exists with different casing. Consider using case-insensitive matching.",
        );
      } else {
        suggestions.push(`The string '${patch.old}' was not found in the content.`);
      }
      break;
    }

    case "replace-regex": {
      // Regex replacement
      suggestions.push("The regex pattern did not match any content. Check your pattern syntax.");
      break;
    }

    case "delete-between":
    case "replace-between": {
      // Between markers
      const { start, end } = patch;
      const hasStart = content.includes(start);
      const hasEnd = content.includes(end);

      if (!hasStart && !hasEnd) {
        suggestions.push(`Neither start marker '${start}' nor end marker '${end}' was found.`);
      } else if (!hasStart) {
        suggestions.push(`Start marker '${start}' was not found.`);
      } else if (!hasEnd) {
        suggestions.push(`End marker '${end}' was not found.`);
      } else {
        suggestions.push("Both markers exist but may not be in the expected order.");
      }
      break;
    }

    case "replace-line": {
      // Line replacement
      const lines = content.split("\n");
      const similarLines = findSimilarStrings(
        patch.match,
        lines.filter((line) => line.trim().length > 0),
      );

      if (similarLines.length > 0) {
        for (const { value } of similarLines.slice(0, 3)) {
          suggestions.push(`Did you mean: '${value}'?`);
        }
      } else {
        suggestions.push(`No similar lines found matching '${patch.match}'.`);
      }
      break;
    }

    case "insert-after-line":
    case "insert-before-line": {
      // Line insertion
      if (patch.match) {
        const lines = content.split("\n");
        const similarLines = findSimilarStrings(
          patch.match,
          lines.filter((line) => line.trim().length > 0),
        );

        if (similarLines.length > 0) {
          for (const { value } of similarLines.slice(0, 3)) {
            suggestions.push(`Did you mean: '${value}'?`);
          }
        } else {
          suggestions.push(`No similar lines found matching '${patch.match}'.`);
        }
      } else if (patch.pattern) {
        suggestions.push("The regex pattern did not match any lines. Check your pattern syntax.");
      }
      break;
    }

    // Operations that always succeed or are handled elsewhere
    case "set-frontmatter":
    case "merge-frontmatter":
    case "copy-file":
    case "rename-file":
    case "delete-file":
    case "move-file":
      // These operations typically don't fail with "matched 0 times"
      break;

    default:
      // Unknown operation type - no specific suggestions
      break;
  }

  return suggestions;
}
