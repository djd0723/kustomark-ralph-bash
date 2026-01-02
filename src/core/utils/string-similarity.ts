/**
 * String Similarity Utilities
 *
 * This module provides optimized string similarity algorithms, primarily
 * focusing on the Levenshtein distance (edit distance) calculation.
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string
 * into another. It's commonly used for fuzzy matching, spell checking,
 * and suggestion systems.
 */

/**
 * Options for calculating Levenshtein distance
 */
export interface LevenshteinOptions {
  /**
   * Maximum distance threshold. If provided, the algorithm will return early
   * once it determines the distance exceeds this threshold, improving performance
   * for large strings when only a certain similarity level is needed.
   *
   * @default undefined (no threshold, calculate full distance)
   */
  threshold?: number;

  /**
   * Whether to perform case-insensitive comparison
   *
   * @default false
   */
  caseInsensitive?: boolean;
}

/**
 * Calculate the Levenshtein distance between two strings using an optimized algorithm
 *
 * This implementation uses several optimizations:
 * 1. Space optimization: O(min(m,n)) instead of O(m*n) by using two rows instead of full matrix
 * 2. Early termination: Stops calculation when threshold is exceeded
 * 3. String swap: Always processes shorter string as second parameter for better space complexity
 * 4. Edge case handling: Fast paths for empty strings and identical strings
 *
 * Time Complexity: O(m * n) where m and n are string lengths
 * Space Complexity: O(min(m, n)) - significant improvement over naive O(m * n)
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @param options - Optional configuration for the calculation
 * @returns The Levenshtein distance (minimum number of edits needed)
 *
 * @example
 * ```typescript
 * // Basic usage
 * calculateLevenshteinDistance("kitten", "sitting"); // 3
 *
 * // With threshold for early termination
 * calculateLevenshteinDistance("hello", "world", { threshold: 3 }); // 4 (but returns early)
 *
 * // Case-insensitive comparison
 * calculateLevenshteinDistance("Hello", "hello", { caseInsensitive: true }); // 0
 * ```
 */
export function calculateLevenshteinDistance(
  str1: string,
  str2: string,
  options?: LevenshteinOptions,
): number {
  // Apply case-insensitive transformation if requested
  let a = str1;
  let b = str2;

  if (options?.caseInsensitive) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }

  // Fast path: identical strings
  if (a === b) return 0;

  // Fast path: one string is empty
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimization: swap strings so b is always the shorter one
  // This reduces space complexity from O(max(m,n)) to O(min(m,n))
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;
  const threshold = options?.threshold;

  // Space optimization: use two rows instead of full matrix
  // Previous row and current row - we only need to keep track of the last row
  let prevRow = new Array<number>(bLen + 1);
  let currRow = new Array<number>(bLen + 1);

  // Initialize first row (distances from empty string to prefixes of b)
  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j;
  }

  // Calculate distances row by row
  for (let i = 1; i <= aLen; i++) {
    // First column: distance from empty string to prefix of a
    currRow[0] = i;

    // Track minimum value in current row for early termination
    let minInRow = currRow[0];

    for (let j = 1; j <= bLen; j++) {
      // Cost of substitution: 0 if characters match, 1 if they don't
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      // Calculate minimum of three operations:
      // 1. Deletion from a: prevRow[j] + 1
      // 2. Insertion to a: currRow[j - 1] + 1
      // 3. Substitution: prevRow[j - 1] + cost
      const deletion = (prevRow[j] ?? 0) + 1;
      const insertion = (currRow[j - 1] ?? 0) + 1;
      const substitution = (prevRow[j - 1] ?? 0) + cost;

      const currentValue = Math.min(deletion, insertion, substitution);
      currRow[j] = currentValue;

      // Track minimum for early termination
      if (currentValue < minInRow) {
        minInRow = currentValue;
      }
    }

    // Early termination: if minimum value in row exceeds threshold,
    // the final distance will definitely exceed threshold
    if (threshold !== undefined && minInRow > threshold) {
      return minInRow; // Return early - we know it exceeds threshold
    }

    // Swap rows for next iteration (reuse arrays to avoid allocations)
    [prevRow, currRow] = [currRow, prevRow];
  }

  // Result is in the last cell of the previous row (after swap)
  return prevRow[bLen] ?? 0;
}

/**
 * Calculate similarity ratio between two strings (0.0 to 1.0)
 *
 * The similarity ratio is calculated as:
 * 1.0 - (levenshtein_distance / max_length)
 *
 * - 1.0 means strings are identical
 * - 0.0 means strings are completely different
 * - Values in between indicate degree of similarity
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @param options - Optional configuration for the calculation
 * @returns Similarity ratio between 0.0 (completely different) and 1.0 (identical)
 *
 * @example
 * ```typescript
 * calculateSimilarityRatio("hello", "hello"); // 1.0
 * calculateSimilarityRatio("hello", "hallo"); // 0.8
 * calculateSimilarityRatio("abc", "xyz"); // 0.0
 * ```
 */
export function calculateSimilarityRatio(
  str1: string,
  str2: string,
  options?: LevenshteinOptions,
): number {
  const maxLength = Math.max(str1.length, str2.length);

  // Handle edge case: both strings empty
  if (maxLength === 0) return 1.0;

  const distance = calculateLevenshteinDistance(str1, str2, options);
  return 1.0 - distance / maxLength;
}

/**
 * Check if two strings are similar within a given threshold
 *
 * This is a convenience function that combines distance calculation with
 * threshold checking. It's more efficient than calculating the full distance
 * and then comparing, as it uses early termination.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @param maxDistance - Maximum allowed distance for strings to be considered similar
 * @param options - Optional configuration (note: threshold in options will be overridden)
 * @returns true if strings are similar (distance <= maxDistance), false otherwise
 *
 * @example
 * ```typescript
 * areStringsSimilar("hello", "hallo", 1); // true (distance is 1)
 * areStringsSimilar("hello", "world", 1); // false (distance is 4)
 * ```
 */
export function areStringsSimilar(
  str1: string,
  str2: string,
  maxDistance: number,
  options?: Omit<LevenshteinOptions, "threshold">,
): boolean {
  const distance = calculateLevenshteinDistance(str1, str2, {
    ...options,
    threshold: maxDistance,
  });
  return distance <= maxDistance;
}

/**
 * Result of a fuzzy string match
 */
export interface FuzzyMatchResult {
  /**
   * The matched string from the candidates
   */
  value: string;

  /**
   * The Levenshtein distance from the target string
   */
  distance: number;

  /**
   * The similarity ratio (0.0 to 1.0)
   */
  similarity: number;
}

/**
 * Options for fuzzy string matching
 */
export interface FuzzyMatchOptions {
  /**
   * Maximum Levenshtein distance to consider a match
   * If not provided, auto-calculated based on target length:
   * - <= 5 chars: max distance 2
   * - <= 10 chars: max distance 3
   * - <= 20 chars: max distance 5
   * - > 20 chars: max distance 7
   */
  maxDistance?: number;

  /**
   * Maximum number of results to return
   * @default 5
   */
  maxResults?: number;

  /**
   * Whether to perform case-insensitive matching
   * @default false
   */
  caseInsensitive?: boolean;

  /**
   * Whether to exclude exact matches (distance 0)
   * @default false
   */
  excludeExact?: boolean;
}

/**
 * Find strings from a list of candidates that are similar to the target string
 *
 * This function performs fuzzy matching to find strings that are similar to
 * the target string based on Levenshtein distance. Results are sorted by
 * distance (most similar first) and limited to a maximum number of results.
 *
 * @param target - The target string to match against
 * @param candidates - Array of candidate strings to search through
 * @param options - Optional configuration for the fuzzy matching
 * @returns Array of fuzzy match results, sorted by similarity (closest first)
 *
 * @example
 * ```typescript
 * const candidates = ["installation", "configuration", "introduction"];
 * const results = findSimilarStrings("instalation", candidates);
 * // [{ value: "installation", distance: 1, similarity: 0.916... }]
 *
 * // With custom options
 * const results = findSimilarStrings("hello", candidates, {
 *   maxDistance: 2,
 *   maxResults: 3,
 *   caseInsensitive: true
 * });
 * ```
 */
export function findSimilarStrings(
  target: string,
  candidates: string[],
  options?: FuzzyMatchOptions,
): FuzzyMatchResult[] {
  const {
    maxDistance: userMaxDistance,
    maxResults = 5,
    caseInsensitive = false,
    excludeExact = false,
  } = options || {};

  // Auto-calculate maxDistance based on target length if not provided
  const maxDistance =
    userMaxDistance ??
    (target.length <= 5 ? 2 : target.length <= 10 ? 3 : target.length <= 20 ? 5 : 7);

  const results: FuzzyMatchResult[] = [];

  for (const candidate of candidates) {
    // Calculate distance with threshold for early termination
    const distance = calculateLevenshteinDistance(target, candidate, {
      threshold: maxDistance,
      caseInsensitive,
    });

    // Only include results within threshold
    if (distance <= maxDistance) {
      // Optionally exclude exact matches
      if (excludeExact && distance === 0) {
        continue;
      }

      const maxLen = Math.max(target.length, candidate.length);
      const similarity = maxLen > 0 ? 1.0 - distance / maxLen : 1.0;

      results.push({
        value: candidate,
        distance,
        similarity,
      });
    }
  }

  // Sort by distance (closest first), then alphabetically for ties
  results.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.value.localeCompare(b.value);
  });

  // Limit to maximum number of results
  return results.slice(0, maxResults);
}

/**
 * Find the best match from a list of candidates
 *
 * Returns the single best match (lowest distance) or undefined if no matches
 * are found within the threshold.
 *
 * @param target - The target string to match against
 * @param candidates - Array of candidate strings to search through
 * @param options - Optional configuration for the fuzzy matching
 * @returns The best fuzzy match result, or undefined if no match found
 *
 * @example
 * ```typescript
 * const candidates = ["installation", "configuration", "introduction"];
 * const best = findBestMatch("instalation", candidates);
 * // { value: "installation", distance: 1, similarity: 0.916... }
 *
 * const noMatch = findBestMatch("xyz", candidates, { maxDistance: 1 });
 * // undefined
 * ```
 */
export function findBestMatch(
  target: string,
  candidates: string[],
  options?: FuzzyMatchOptions,
): FuzzyMatchResult | undefined {
  const results = findSimilarStrings(target, candidates, {
    ...options,
    maxResults: 1,
  });

  return results[0];
}
