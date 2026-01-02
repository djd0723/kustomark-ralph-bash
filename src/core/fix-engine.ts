/**
 * Fix engine for kustomark
 *
 * Analyzes failed patches from build results and provides intelligent suggestions
 * for fixing them. Supports different fix strategies including exact match replacement,
 * fuzzy match selection, and manual editing.
 */

import { applySinglePatch } from "./patch-engine.js";
import {
  findSimilarStrings,
  generateFrontmatterKeySuggestions,
  generateSectionSuggestions,
} from "./suggestion-engine.js";
import type { PatchOperation, PatchResult, ValidationWarning } from "./types.js";

/**
 * Strategy for applying a fix
 */
export type FixStrategy = "exact-match" | "fuzzy-match" | "manual-edit" | "skip";

/**
 * A single fix suggestion for a failed patch
 */
export interface FixSuggestion {
  /** The original patch that failed */
  originalPatch: PatchOperation;
  /** Index of the patch in the original patches array */
  patchIndex: number;
  /** Suggested fix strategy */
  strategy: FixStrategy;
  /** Confidence score (0-100) for auto-fix */
  confidence: number;
  /** Human-readable description of the fix */
  description: string;
  /** The modified patch to apply (if applicable) */
  modifiedPatch?: PatchOperation;
  /** Fuzzy match options (for fuzzy-match strategy) */
  fuzzyMatches?: Array<{
    value: string;
    distance: number;
    confidence: number;
    patch: PatchOperation;
  }>;
  /** Original error/warning message */
  errorMessage: string;
}

/**
 * Result of analyzing failed patches
 */
export interface FailedPatchAnalysis {
  /** Total number of patches analyzed */
  totalPatches: number;
  /** Number of patches that failed */
  failedPatches: number;
  /** Number of patches that succeeded */
  successfulPatches: number;
  /** Number of patches skipped due to conditions */
  conditionSkippedPatches: number;
  /** Detailed information about each failed patch with fix suggestions */
  failures: FixSuggestion[];
}

/**
 * Result of applying a fix
 */
export interface ApplyFixResult {
  /** Whether the fix was successfully applied */
  success: boolean;
  /** The patched content after applying the fix */
  content: string;
  /** Number of changes made */
  count: number;
  /** Error message if the fix failed */
  error?: string;
  /** The patch that was applied (original or modified) */
  appliedPatch: PatchOperation;
}

/**
 * Analyze a build result to find patches that failed (count === 0)
 *
 * This function examines the warnings from a PatchResult to identify patches
 * that matched 0 times and collects them for fix analysis.
 *
 * @param patchResult - Result from applying patches
 * @param patches - Original array of patches that were applied
 * @returns Analysis of failed patches with counts
 */
export function analyzeFailedPatches(
  patchResult: PatchResult,
  patches: PatchOperation[],
): FailedPatchAnalysis {
  const failures: FixSuggestion[] = [];

  // Track which patch indices have warnings (failed patches)
  const failedPatchIndices = new Set<number>();

  // Parse warnings to find failed patches
  // Warnings contain messages like "Patch 'replace 'old' with 'new'' matched 0 times"
  for (const warning of patchResult.warnings) {
    if (warning.message.includes("matched 0 times")) {
      // Try to match the warning to a patch
      // We need to find which patch this warning corresponds to
      // This is done by checking each patch against the content
      failedPatchIndices.add(failures.length); // Placeholder - we'll determine this below
    }
  }

  // Since warnings don't directly reference patch indices, we need to
  // re-apply patches individually to determine which ones failed
  // This is a limitation of the current warning system
  // For now, we'll use a heuristic approach

  return {
    totalPatches: patches.length,
    failedPatches: failures.length,
    successfulPatches: patchResult.applied,
    conditionSkippedPatches: patchResult.conditionSkipped,
    failures,
  };
}

/**
 * Generate fix suggestions for a failed patch
 *
 * This function analyzes why a patch failed and generates intelligent
 * suggestions for fixing it, including confidence scores and modified patches.
 *
 * @param patch - The patch that failed
 * @param patchIndex - Index of the patch in the patches array
 * @param content - The content that was being patched
 * @param warning - The warning message from the failed patch
 * @returns Fix suggestion with strategy and confidence score
 */
export function generateFixSuggestions(
  patch: PatchOperation,
  patchIndex: number,
  content: string,
  warning: ValidationWarning,
): FixSuggestion {
  const errorMessage = warning.message;

  // Default fix suggestion
  const baseSuggestion: Omit<FixSuggestion, "strategy" | "confidence" | "description"> = {
    originalPatch: patch,
    patchIndex,
    errorMessage,
  };

  // Generate strategy-specific suggestions based on patch type
  switch (patch.op) {
    case "replace": {
      // Check if string exists with different casing
      const oldLower = patch.old.toLowerCase();
      const contentLower = content.toLowerCase();

      if (contentLower.includes(oldLower) && !content.includes(patch.old)) {
        // Case mismatch - high confidence exact match fix
        const regex = new RegExp(patch.old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const match = content.match(regex);
        if (match?.[0]) {
          return {
            ...baseSuggestion,
            strategy: "exact-match",
            confidence: 95,
            description: `String exists with different casing: '${match[0]}'`,
            modifiedPatch: {
              ...patch,
              old: match[0],
            },
          };
        }
      }

      // Try fuzzy matching for similar strings
      // Extract words from content for better matching
      const words = content.match(/\b\w+\b/g) || [];
      const similarWords = findSimilarStrings(patch.old, words);

      if (similarWords.length > 0) {
        const fuzzyMatches = similarWords.map((match) => {
          // Calculate confidence based on distance and position
          const maxDistance = Math.max(3, Math.floor(patch.old.length * 0.3));
          const confidence = Math.max(
            0,
            Math.round(((maxDistance - match.distance) / maxDistance) * 100),
          );

          return {
            value: match.value,
            distance: match.distance,
            confidence,
            patch: {
              ...patch,
              old: match.value,
            } as PatchOperation,
          };
        });

        return {
          ...baseSuggestion,
          strategy: "fuzzy-match",
          confidence: fuzzyMatches[0]?.confidence ?? 0,
          description: `Found ${fuzzyMatches.length} similar string(s) that could be replaced`,
          fuzzyMatches,
        };
      }

      // No similar strings found - manual edit required
      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: `String '${patch.old}' not found. Manual review required.`,
      };
    }

    case "replace-regex": {
      // Regex patterns are harder to fix automatically
      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description:
          "Regex pattern did not match. Review the pattern syntax and try testing with a simpler pattern.",
      };
    }

    case "remove-section":
    case "replace-section":
    case "prepend-to-section":
    case "append-to-section":
    case "rename-header":
    case "move-section":
    case "change-section-level": {
      // Section operations - use existing suggestion engine
      const suggestions = generateSectionSuggestions(patch.id, content);

      if (suggestions.length > 0 && suggestions[0]?.startsWith("Did you mean")) {
        // Extract suggested section ID from "Did you mean 'section-id'?"
        const match = suggestions[0].match(/'([^']+)'/);
        if (match?.[1]) {
          const suggestedId = match[1];
          return {
            ...baseSuggestion,
            strategy: "exact-match",
            confidence: 85,
            description: `Section '${patch.id}' not found. ${suggestions[0]}`,
            modifiedPatch: {
              ...patch,
              id: suggestedId,
            } as PatchOperation,
          };
        }
      }

      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: `Section '${patch.id}' not found. ${suggestions.join(" ")}`,
      };
    }

    case "remove-frontmatter":
    case "rename-frontmatter": {
      // Frontmatter operations
      const key = patch.op === "rename-frontmatter" ? patch.old : patch.key;
      const suggestions = generateFrontmatterKeySuggestions(
        key,
        {}, // We'd need to parse frontmatter from content here
      );

      if (suggestions.length > 0 && suggestions[0]?.startsWith("Did you mean")) {
        const match = suggestions[0].match(/'([^']+)'/);
        if (match?.[1]) {
          const suggestedKey = match[1];
          return {
            ...baseSuggestion,
            strategy: "exact-match",
            confidence: 80,
            description: `Frontmatter key '${key}' not found. ${suggestions[0]}`,
            modifiedPatch:
              patch.op === "rename-frontmatter"
                ? { ...patch, old: suggestedKey }
                : { ...patch, key: suggestedKey },
          };
        }
      }

      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: `Frontmatter key '${key}' not found. ${suggestions.join(" ")}`,
      };
    }

    case "delete-between":
    case "replace-between": {
      const { start, end } = patch;
      const hasStart = content.includes(start);
      const hasEnd = content.includes(end);

      if (!hasStart && !hasEnd) {
        return {
          ...baseSuggestion,
          strategy: "manual-edit",
          confidence: 0,
          description: `Neither start marker '${start}' nor end marker '${end}' was found.`,
        };
      }

      if (!hasStart) {
        return {
          ...baseSuggestion,
          strategy: "manual-edit",
          confidence: 0,
          description: `Start marker '${start}' was not found.`,
        };
      }

      if (!hasEnd) {
        return {
          ...baseSuggestion,
          strategy: "manual-edit",
          confidence: 0,
          description: `End marker '${end}' was not found.`,
        };
      }

      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: "Both markers exist but may not be in the expected order.",
      };
    }

    case "replace-line": {
      const lines = content.split("\n").filter((line) => line.trim().length > 0);
      const similarLines = findSimilarStrings(patch.match, lines);

      if (similarLines.length > 0) {
        const fuzzyMatches = similarLines.slice(0, 3).map((match) => {
          const maxDistance = Math.max(3, Math.floor(patch.match.length * 0.25));
          const confidence = Math.max(
            0,
            Math.round(((maxDistance - match.distance) / maxDistance) * 100),
          );

          return {
            value: match.value,
            distance: match.distance,
            confidence,
            patch: {
              ...patch,
              match: match.value,
            } as PatchOperation,
          };
        });

        return {
          ...baseSuggestion,
          strategy: "fuzzy-match",
          confidence: fuzzyMatches[0]?.confidence ?? 0,
          description: `Found ${fuzzyMatches.length} similar line(s)`,
          fuzzyMatches,
        };
      }

      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: `No similar lines found matching '${patch.match}'.`,
      };
    }

    case "insert-after-line":
    case "insert-before-line": {
      if (patch.match) {
        const lines = content.split("\n").filter((line) => line.trim().length > 0);
        const similarLines = findSimilarStrings(patch.match, lines);

        if (similarLines.length > 0) {
          const fuzzyMatches = similarLines.slice(0, 3).map((match) => {
            const matchLength = patch.match?.length ?? 10;
            const maxDistance = Math.max(3, Math.floor(matchLength * 0.25));
            const confidence = Math.max(
              0,
              Math.round(((maxDistance - match.distance) / maxDistance) * 100),
            );

            return {
              value: match.value,
              distance: match.distance,
              confidence,
              patch: {
                ...patch,
                match: match.value,
              } as PatchOperation,
            };
          });

          return {
            ...baseSuggestion,
            strategy: "fuzzy-match",
            confidence: fuzzyMatches[0]?.confidence ?? 0,
            description: `Found ${fuzzyMatches.length} similar line(s)`,
            fuzzyMatches,
          };
        }
      }

      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: patch.pattern
          ? "The regex pattern did not match any lines."
          : `No similar lines found matching '${patch.match}'.`,
      };
    }

    // File operations - these shouldn't typically fail with "matched 0 times"
    case "copy-file":
    case "rename-file":
    case "delete-file":
    case "move-file":
    case "set-frontmatter":
    case "merge-frontmatter":
      return {
        ...baseSuggestion,
        strategy: "skip",
        confidence: 0,
        description: "This operation type should not fail with match count errors.",
      };

    // Table operations
    case "replace-table-cell":
    case "add-table-row":
    case "remove-table-row":
    case "add-table-column":
    case "remove-table-column":
      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: "Table not found or row/column not found. Manual review required.",
      };

    default: {
      // TypeScript exhaustiveness check - use type assertion for unknown operations
      const unknownOp = (patch as PatchOperation).op;
      return {
        ...baseSuggestion,
        strategy: "manual-edit",
        confidence: 0,
        description: `Unknown patch operation: ${unknownOp}`,
      };
    }
  }
}

/**
 * Apply an auto-fix to a patch
 *
 * This function takes a fix suggestion and applies the modified patch to the content.
 * It only applies fixes with confidence >= threshold (default 75).
 *
 * @param content - The content to patch
 * @param fixSuggestion - The fix suggestion to apply
 * @param confidenceThreshold - Minimum confidence score to auto-apply (0-100, default 75)
 * @returns Result of applying the fix
 */
export async function applyAutoFix(
  content: string,
  fixSuggestion: FixSuggestion,
  confidenceThreshold = 75,
): Promise<ApplyFixResult> {
  // Check confidence threshold
  if (fixSuggestion.confidence < confidenceThreshold) {
    return {
      success: false,
      content,
      count: 0,
      error: `Confidence score ${fixSuggestion.confidence} is below threshold ${confidenceThreshold}`,
      appliedPatch: fixSuggestion.originalPatch,
    };
  }

  // Determine which patch to apply
  let patchToApply: PatchOperation;

  if (fixSuggestion.strategy === "exact-match" && fixSuggestion.modifiedPatch) {
    patchToApply = fixSuggestion.modifiedPatch;
  } else if (
    fixSuggestion.strategy === "fuzzy-match" &&
    fixSuggestion.fuzzyMatches &&
    fixSuggestion.fuzzyMatches.length > 0
  ) {
    // Use the best fuzzy match
    const bestMatch = fixSuggestion.fuzzyMatches[0];
    if (!bestMatch) {
      return {
        success: false,
        content,
        count: 0,
        error: "No fuzzy matches available",
        appliedPatch: fixSuggestion.originalPatch,
      };
    }
    patchToApply = bestMatch.patch;
  } else {
    return {
      success: false,
      content,
      count: 0,
      error: `Cannot auto-fix with strategy: ${fixSuggestion.strategy}`,
      appliedPatch: fixSuggestion.originalPatch,
    };
  }

  // Apply the patch
  try {
    const result = await applySinglePatch(content, patchToApply, "error", false);

    if (result.count === 0) {
      return {
        success: false,
        content: result.content,
        count: 0,
        error: "Modified patch still matched 0 times",
        appliedPatch: patchToApply,
      };
    }

    if (result.validationErrors.length > 0) {
      return {
        success: false,
        content: result.content,
        count: result.count,
        error: `Validation errors: ${result.validationErrors.map((e) => e.message).join(", ")}`,
        appliedPatch: patchToApply,
      };
    }

    return {
      success: true,
      content: result.content,
      count: result.count,
      appliedPatch: patchToApply,
    };
  } catch (error) {
    return {
      success: false,
      content,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
      appliedPatch: patchToApply,
    };
  }
}

/**
 * Analyze a single file's patch results and generate fix suggestions
 *
 * This is a helper function that re-applies patches individually to identify
 * which ones failed and generates fix suggestions for each failure.
 *
 * @param content - The original content
 * @param patches - Array of patches to analyze
 * @param onNoMatch - Strategy for handling no-match scenarios (default: "warn")
 * @returns Array of fix suggestions for failed patches
 */
export async function analyzeFilePatchFailures(
  content: string,
  patches: PatchOperation[],
  onNoMatch: "skip" | "warn" | "error" = "warn",
): Promise<FixSuggestion[]> {
  const failures: FixSuggestion[] = [];

  // Apply each patch individually to identify failures
  let currentContent = content;

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    if (!patch) continue;

    try {
      const result = await applySinglePatch(currentContent, patch, onNoMatch, false);

      // Check if patch failed (count === 0 and not skipped by condition)
      if (result.count === 0 && !result.conditionSkipped) {
        // Generate fix suggestion
        const warning: ValidationWarning = {
          message: result.warning?.message || `Patch matched 0 times`,
          suggestions: result.warning?.suggestions,
        };

        const fixSuggestion = generateFixSuggestions(patch, i, currentContent, warning);
        failures.push(fixSuggestion);
      } else if (result.count > 0) {
        // Patch succeeded - update content for next patch
        currentContent = result.content;
      }
      // If conditionSkipped, we don't count it as a failure
    } catch (error) {
      // Patch threw an error
      const errorMessage = error instanceof Error ? error.message : String(error);
      failures.push({
        originalPatch: patch,
        patchIndex: i,
        strategy: "manual-edit",
        confidence: 0,
        description: `Patch threw an error: ${errorMessage}`,
        errorMessage,
      });
    }
  }

  return failures;
}
