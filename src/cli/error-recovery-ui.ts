/**
 * Interactive error recovery UI for failed patch operations
 * Uses @clack/prompts for beautiful CLI interaction
 */

import * as clack from "@clack/prompts";
import type { PatchOperation } from "../core/types.js";

/**
 * Represents a potential fix for a failed patch operation
 */
export interface RecoveryResult {
  /** Type of recovery action */
  type: "auto-fix" | "suggestion" | "skip";
  /** Confidence score for this recovery (0-1) */
  confidence: number;
  /** Human-readable description of the fix */
  description: string;
  /** The modified patch that should work */
  fixedPatch?: PatchOperation;
  /** The content after applying the fix (if available) */
  fixedContent?: string;
  /** Detailed explanation of what was changed */
  explanation?: string;
  /** Before/after diff preview (if applicable) */
  diff?: {
    before: string;
    after: string;
  };
}

/**
 * Options for formatting recovery options in the select prompt
 */
interface RecoveryOptionFormatted {
  value: RecoveryResult | "skip" | "cancel";
  label: string;
  hint?: string;
}

/**
 * Present recovery options to the user when a patch fails
 *
 * @param error - The error message from the failed patch
 * @param content - The original content being patched
 * @param patch - The patch operation that failed
 * @param recoveries - Array of potential recovery solutions
 * @returns The selected RecoveryResult or null if user cancels/skips
 */
export async function presentRecoveryOptions(
  error: string,
  _content: string,
  patch: PatchOperation,
  recoveries: RecoveryResult[],
): Promise<RecoveryResult | null> {
  // Show error context
  clack.log.error(`Patch failed: ${error}`);
  clack.note(formatPatchInfo(patch), "Failed Patch");

  // If no recoveries available, return null
  if (recoveries.length === 0) {
    clack.log.warn("No automatic recovery options available");
    return null;
  }

  // Sort recoveries by confidence (highest first)
  const sortedRecoveries = [...recoveries].sort((a, b) => b.confidence - a.confidence);

  // Check for high-confidence recovery (>0.8)
  const highConfidenceRecovery = sortedRecoveries[0];
  if (highConfidenceRecovery && highConfidenceRecovery.confidence > 0.8) {
    // Offer to auto-apply high-confidence fix
    const autoApply = await clack.confirm({
      message: `High-confidence fix available: ${highConfidenceRecovery.description}\n  Apply automatically?`,
      initialValue: true,
    });

    if (clack.isCancel(autoApply)) {
      return null;
    }

    if (autoApply) {
      clack.log.success(`Auto-applying fix: ${highConfidenceRecovery.description}`);
      return highConfidenceRecovery;
    }
  }

  // Build options for select prompt
  const options: RecoveryOptionFormatted[] = sortedRecoveries.map((recovery) => ({
    value: recovery,
    label: formatRecoveryLabel(recovery),
    hint: recovery.explanation || `Confidence: ${formatConfidence(recovery.confidence)}`,
  }));

  // Add "Skip this patch" option
  options.push({
    value: "skip",
    label: "Skip this patch",
    hint: "Continue without applying this patch",
  });

  // Add "Cancel all" option
  options.push({
    value: "cancel",
    label: "Cancel all",
    hint: "Stop build process",
  });

  // Show selection prompt
  const selection = await clack.select({
    message: "Choose a recovery option:",
    options,
  });

  // Handle cancellation (Ctrl+C)
  if (clack.isCancel(selection)) {
    return null;
  }

  // Handle special actions
  if (selection === "skip") {
    clack.log.info("Skipping this patch");
    return null;
  }

  if (selection === "cancel") {
    clack.log.warn("Build cancelled by user");
    throw new Error("Build cancelled during error recovery");
  }

  // Return the selected recovery
  return selection as RecoveryResult;
}

/**
 * Ask user to confirm applying a specific fix
 *
 * @param recovery - The recovery result to apply
 * @returns true if user confirms, false otherwise
 */
export async function askToApplyFix(recovery: RecoveryResult): Promise<boolean> {
  // Show fix details
  clack.note(
    `Type: ${recovery.type}\nConfidence: ${formatConfidence(recovery.confidence)}\n\n${recovery.explanation || recovery.description}`,
    "Fix Details",
  );

  // Show before/after diff if available
  if (recovery.diff) {
    showDiff(recovery.diff.before, recovery.diff.after);
  }

  // Ask for confirmation
  const confirmed = await clack.confirm({
    message: "Apply this fix?",
    initialValue: true,
  });

  // Handle cancellation
  if (clack.isCancel(confirmed)) {
    return false;
  }

  return confirmed;
}

/**
 * Format patch information for display
 */
function formatPatchInfo(patch: PatchOperation): string {
  const lines: string[] = [];

  lines.push(`Operation: ${patch.op}`);

  // Show operation-specific details
  switch (patch.op) {
    case "replace":
      lines.push(`Old: "${truncateString(patch.old, 60)}"`);
      lines.push(`New: "${truncateString(patch.new, 60)}"`);
      break;

    case "replace-regex":
      lines.push(`Pattern: /${patch.pattern}/${patch.flags || ""}`);
      lines.push(`Replacement: "${truncateString(patch.replacement, 60)}"`);
      break;

    case "remove-section":
    case "replace-section":
    case "prepend-to-section":
    case "append-to-section":
    case "rename-header":
    case "move-section":
    case "change-section-level":
      lines.push(`Section ID: ${patch.id}`);
      break;

    case "remove-frontmatter":
    case "rename-frontmatter":
      lines.push(`Key: ${patch.op === "rename-frontmatter" ? patch.old : patch.key}`);
      break;

    case "delete-between":
    case "replace-between":
      lines.push(`Start: "${truncateString(patch.start, 40)}"`);
      lines.push(`End: "${truncateString(patch.end, 40)}"`);
      break;

    case "replace-line":
      lines.push(`Match: "${truncateString(patch.match, 60)}"`);
      break;

    case "insert-after-line":
    case "insert-before-line": {
      const target = patch.match || patch.pattern || "";
      lines.push(`Target: "${truncateString(target, 60)}"`);
      break;
    }
  }

  // Show common fields
  if (patch.group) {
    lines.push(`Group: ${patch.group}`);
  }
  if (patch.id) {
    lines.push(`ID: ${patch.id}`);
  }

  return lines.join("\n");
}

/**
 * Format recovery label with confidence indicator
 */
function formatRecoveryLabel(recovery: RecoveryResult): string {
  const confidencePercent = Math.round(recovery.confidence * 100);
  const confidenceIndicator = getConfidenceIndicator(recovery.confidence);

  return `${recovery.description} ${confidenceIndicator} (${confidencePercent}% confidence)`;
}

/**
 * Get visual indicator for confidence level
 */
function getConfidenceIndicator(confidence: number): string {
  if (confidence >= 0.9) return "✓✓✓";
  if (confidence >= 0.7) return "✓✓";
  if (confidence >= 0.5) return "✓";
  return "?";
}

/**
 * Format confidence score as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Truncate a string to maximum length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Show before/after diff in a formatted way
 */
function showDiff(before: string, after: string): void {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  const diffLines: string[] = [];
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine === afterLine) {
      // Unchanged line
      diffLines.push(`  ${beforeLine || ""}`);
    } else {
      // Changed line
      if (beforeLine !== undefined) {
        diffLines.push(`- ${beforeLine}`);
      }
      if (afterLine !== undefined) {
        diffLines.push(`+ ${afterLine}`);
      }
    }
  }

  // Limit diff preview to 20 lines
  const preview = diffLines.slice(0, 20);
  if (diffLines.length > 20) {
    preview.push(`... (${diffLines.length - 20} more lines)`);
  }

  clack.note(preview.join("\n"), "Diff Preview");
}

/**
 * Show error recovery flow integrated with build command
 *
 * This is a helper function that orchestrates the full recovery flow:
 * 1. Check for available recoveries
 * 2. Auto-apply high-confidence fixes (>0.8)
 * 3. Show selection menu for medium-confidence fixes
 * 4. Display original error if no recoveries available
 *
 * @param error - The error message from the failed patch
 * @param content - The original content being patched
 * @param patch - The patch operation that failed
 * @param recoveries - Array of potential recovery solutions
 * @returns The selected RecoveryResult or null if no recovery chosen
 */
export async function handlePatchError(
  error: string,
  content: string,
  patch: PatchOperation,
  recoveries: RecoveryResult[],
): Promise<RecoveryResult | null> {
  // If no recoveries available, show original error with suggestions
  if (recoveries.length === 0) {
    clack.log.error(`Patch failed: ${error}`);
    clack.note(formatPatchInfo(patch), "Failed Patch");
    showSuggestions(patch, content, error);
    return null;
  }

  // Check for high-confidence recovery (>0.8)
  const sortedRecoveries = [...recoveries].sort((a, b) => b.confidence - a.confidence);
  const highConfidenceRecovery = sortedRecoveries[0];

  if (highConfidenceRecovery && highConfidenceRecovery.confidence > 0.8) {
    // Auto-apply high-confidence fix with user confirmation
    clack.log.info("High-confidence fix detected");

    const shouldApply = await askToApplyFix(highConfidenceRecovery);
    if (shouldApply) {
      return highConfidenceRecovery;
    }
  }

  // Show selection menu for multiple medium-confidence recoveries
  if (
    sortedRecoveries.length > 1 ||
    (sortedRecoveries[0] && sortedRecoveries[0].confidence <= 0.8)
  ) {
    return await presentRecoveryOptions(error, content, patch, recoveries);
  }

  return null;
}

/**
 * Show suggestions when no automatic recovery is available
 */
function showSuggestions(patch: PatchOperation, _content: string, error: string): void {
  const suggestions: string[] = [];

  // Add operation-specific suggestions based on error type
  if (error.includes("matched 0 times")) {
    suggestions.push("The pattern did not match any content in the file");

    switch (patch.op) {
      case "remove-section":
      case "replace-section":
      case "prepend-to-section":
      case "append-to-section":
        suggestions.push(`Check if section '${patch.id}' exists in the document`);
        suggestions.push("Section IDs are case-sensitive and use GitHub-style slugs");
        break;

      case "replace":
        suggestions.push(`Verify the exact string exists in the content`);
        suggestions.push("String matching is case-sensitive by default");
        break;

      case "replace-regex":
        suggestions.push("Verify the regex pattern syntax");
        suggestions.push("Test the pattern with a regex tester tool");
        break;

      case "delete-between":
      case "replace-between":
        suggestions.push(`Check if both start and end markers exist`);
        suggestions.push("Markers must appear in the correct order");
        break;
    }
  }

  // Show general suggestions
  suggestions.push("");
  suggestions.push("Possible solutions:");
  suggestions.push("  • Review the patch operation parameters");
  suggestions.push("  • Check the file content matches expectations");
  suggestions.push("  • Use conditional patches with 'when' clause");
  suggestions.push("  • Set 'onNoMatch: skip' or 'onNoMatch: warn' for optional patches");

  if (suggestions.length > 0) {
    clack.note(suggestions.join("\n"), "Suggestions");
  }
}

/**
 * Show a summary of applied recoveries
 */
export function showRecoverySummary(totalErrors: number, recovered: number, skipped: number): void {
  const lines: string[] = [];

  lines.push(`Total patch errors: ${totalErrors}`);
  lines.push(`Automatically recovered: ${recovered}`);
  lines.push(`Skipped: ${skipped}`);

  const recoveryRate = totalErrors > 0 ? Math.round((recovered / totalErrors) * 100) : 0;
  lines.push(`Recovery rate: ${recoveryRate}%`);

  clack.note(lines.join("\n"), "Error Recovery Summary");
}
