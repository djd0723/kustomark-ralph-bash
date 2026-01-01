/**
 * Diff generation module for Kustomark
 * Generates unified diff format (like git diff) for file changes
 * Pure logic - no I/O operations
 */

/**
 * File change status
 */
export type FileStatus = "added" | "modified" | "deleted";

/**
 * Diff information for a single file
 */
export interface FileDiff {
  /** File path */
  path: string;
  /** Change status */
  status: FileStatus;
  /** Unified diff output */
  diff: string;
}

/**
 * Result of diff generation for multiple files
 */
export interface DiffResult {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** List of file diffs */
  files: FileDiff[];
}

/**
 * Represents a single line in the diff with context
 */
interface DiffLine {
  /** Line content */
  content: string;
  /** Line type: added, removed, or context */
  type: "add" | "remove" | "context";
  /** Original line number (1-indexed, 0 if not applicable) */
  originalLine: number;
  /** Modified line number (1-indexed, 0 if not applicable) */
  modifiedLine: number;
}

/**
 * A hunk represents a continuous block of changes
 */
interface DiffHunk {
  /** Starting line in original file (1-indexed) */
  originalStart: number;
  /** Number of lines in original file */
  originalCount: number;
  /** Starting line in modified file (1-indexed) */
  modifiedStart: number;
  /** Number of lines in modified file */
  modifiedCount: number;
  /** Lines in this hunk */
  lines: DiffLine[];
}

/**
 * Generate a unified diff between two text strings
 *
 * @param original - Original content
 * @param modified - Modified content
 * @param filepath - Path to the file (for diff header)
 * @returns Unified diff string in git diff format
 */
export function generateDiff(original: string, modified: string, filepath: string): string {
  // Split into lines, preserving empty lines
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");

  // Generate the diff hunks
  const hunks = computeDiffHunks(originalLines, modifiedLines);

  // If no changes, return empty string
  if (hunks.length === 0) {
    return "";
  }

  // Build unified diff format
  const lines: string[] = [];

  // Add file header
  lines.push(`--- a/${filepath}`);
  lines.push(`+++ b/${filepath}`);

  // Add each hunk
  for (const hunk of hunks) {
    // Hunk header: @@ -originalStart,originalCount +modifiedStart,modifiedCount @@
    lines.push(
      `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.modifiedStart},${hunk.modifiedCount} @@`,
    );

    // Add hunk lines
    for (const line of hunk.lines) {
      if (line.type === "add") {
        lines.push(`+${line.content}`);
      } else if (line.type === "remove") {
        lines.push(`-${line.content}`);
      } else {
        lines.push(` ${line.content}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generate diffs for multiple files
 *
 * @param files - Array of file objects with path and content
 * @returns Structured diff result
 */
export function generateFileDiff(
  files: Array<{
    path: string;
    original?: string;
    modified?: string;
  }>,
): DiffResult {
  const fileDiffs: FileDiff[] = [];

  for (const file of files) {
    const { path, original, modified } = file;

    // Determine file status
    let status: FileStatus;
    let diff: string;

    if (original === undefined && modified !== undefined) {
      // New file
      status = "added";
      diff = generateNewFileDiff(modified, path);
    } else if (original !== undefined && modified === undefined) {
      // Deleted file
      status = "deleted";
      diff = generateDeletedFileDiff(original, path);
    } else if (original !== undefined && modified !== undefined) {
      // Modified file
      status = "modified";
      diff = generateDiff(original, modified, path);

      // Skip if no actual changes
      if (diff === "") {
        continue;
      }
    } else {
      // Both undefined - skip this file
      continue;
    }

    fileDiffs.push({ path, status, diff });
  }

  return {
    hasChanges: fileDiffs.length > 0,
    files: fileDiffs,
  };
}

/**
 * Generate diff for a new file (all lines added)
 */
function generateNewFileDiff(content: string, filepath: string): string {
  const lines: string[] = [];
  lines.push("--- /dev/null");
  lines.push(`+++ b/${filepath}`);

  const contentLines = content.split("\n");
  if (contentLines.length > 0) {
    lines.push(`@@ -0,0 +1,${contentLines.length} @@`);
    for (const line of contentLines) {
      lines.push(`+${line}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate diff for a deleted file (all lines removed)
 */
function generateDeletedFileDiff(content: string, filepath: string): string {
  const lines: string[] = [];
  lines.push(`--- a/${filepath}`);
  lines.push("+++ /dev/null");

  const contentLines = content.split("\n");
  if (contentLines.length > 0) {
    lines.push(`@@ -1,${contentLines.length} +0,0 @@`);
    for (const line of contentLines) {
      lines.push(`-${line}`);
    }
  }

  return lines.join("\n");
}

/**
 * Compute diff hunks using a simple line-by-line comparison algorithm
 * Uses Longest Common Subsequence (LCS) approach
 */
function computeDiffHunks(originalLines: string[], modifiedLines: string[]): DiffHunk[] {
  // Compute LCS to find common lines
  const lcs = computeLCS(originalLines, modifiedLines);

  // Build diff lines from LCS
  const diffLines = buildDiffLines(originalLines, modifiedLines, lcs);

  // If no changes, return empty array
  if (diffLines.length === 0) {
    return [];
  }

  // Group diff lines into hunks with context
  const hunks = groupIntoHunks(diffLines);

  return hunks;
}

/**
 * Compute Longest Common Subsequence using dynamic programming
 * Returns a set of indices in the original array that are part of the LCS
 */
function computeLCS(a: string[], b: string[]): Set<number> {
  const m = a.length;
  const n = b.length;

  // DP table: dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const prevRow = dp[i - 1];
      const currRow = dp[i];
      if (!prevRow || !currRow) continue;

      if (a[i - 1] === b[j - 1]) {
        currRow[j] = (prevRow[j - 1] ?? 0) + 1;
      } else {
        currRow[j] = Math.max(prevRow[j] ?? 0, currRow[j - 1] ?? 0);
      }
    }
  }

  // Backtrack to find which lines are in the LCS
  const lcsIndices = new Set<number>();
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    const currRow = dp[i];
    const prevRow = dp[i - 1];
    if (!currRow || !prevRow) break;

    if (a[i - 1] === b[j - 1]) {
      lcsIndices.add(i - 1);
      i--;
      j--;
    } else if ((prevRow[j] ?? 0) > (currRow[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }

  return lcsIndices;
}

/**
 * Build diff lines by comparing original and modified using LCS
 */
function buildDiffLines(
  originalLines: string[],
  modifiedLines: string[],
  lcs: Set<number>,
): DiffLine[] {
  const diffLines: DiffLine[] = [];
  let origIdx = 0;
  let modIdx = 0;

  // Build a mapping of original indices to modified indices for LCS lines
  const lcsMapping = new Map<number, number>();
  let tempModIdx = 0;

  for (let i = 0; i < originalLines.length; i++) {
    if (lcs.has(i)) {
      const origLine = originalLines[i];
      if (origLine === undefined) continue;
      // Find the corresponding line in modified
      while (tempModIdx < modifiedLines.length) {
        if (origLine === modifiedLines[tempModIdx]) {
          lcsMapping.set(i, tempModIdx);
          tempModIdx++;
          break;
        }
        tempModIdx++;
      }
    }
  }

  // Process all lines
  while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
    if (origIdx < originalLines.length && lcs.has(origIdx)) {
      // This is a common line
      const correspondingModIdx = lcsMapping.get(origIdx);

      // Add any inserted lines before this common line
      while (correspondingModIdx !== undefined && modIdx < correspondingModIdx) {
        const modLine = modifiedLines[modIdx];
        if (modLine !== undefined) {
          diffLines.push({
            content: modLine,
            type: "add",
            originalLine: 0,
            modifiedLine: modIdx + 1,
          });
        }
        modIdx++;
      }

      // Add the common line as context
      const origLine = originalLines[origIdx];
      if (origLine !== undefined) {
        diffLines.push({
          content: origLine,
          type: "context",
          originalLine: origIdx + 1,
          modifiedLine: modIdx + 1,
        });
      }
      origIdx++;
      modIdx++;
    } else if (origIdx < originalLines.length) {
      // Line removed from original
      const origLine = originalLines[origIdx];
      if (origLine !== undefined) {
        diffLines.push({
          content: origLine,
          type: "remove",
          originalLine: origIdx + 1,
          modifiedLine: 0,
        });
      }
      origIdx++;
    } else {
      // Line added to modified
      const modLine = modifiedLines[modIdx];
      if (modLine !== undefined) {
        diffLines.push({
          content: modLine,
          type: "add",
          originalLine: 0,
          modifiedLine: modIdx + 1,
        });
      }
      modIdx++;
    }
  }

  // Filter out context-only diff (no actual changes)
  const hasChanges = diffLines.some((line) => line.type === "add" || line.type === "remove");
  if (!hasChanges) {
    return [];
  }

  return diffLines;
}

/**
 * Group diff lines into hunks with context
 * Context lines are lines around changes that help understand the diff
 */
function groupIntoHunks(diffLines: DiffLine[]): DiffHunk[] {
  const CONTEXT_LINES = 3; // Number of context lines before/after changes
  const hunks: DiffHunk[] = [];

  if (diffLines.length === 0) {
    return hunks;
  }

  let currentHunk: DiffLine[] = [];
  let lastChangeIndex = -1;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];
    if (!line) continue;

    if (line.type !== "context") {
      // This is a change line
      // Include context before this change
      const contextStart = Math.max(lastChangeIndex + 1, i - CONTEXT_LINES);
      for (let j = contextStart; j < i; j++) {
        const contextLine = diffLines[j];
        if (contextLine && !currentHunk.includes(contextLine)) {
          currentHunk.push(contextLine);
        }
      }

      currentHunk.push(line);
      lastChangeIndex = i;
    } else if (lastChangeIndex >= 0 && i - lastChangeIndex <= CONTEXT_LINES) {
      // This is context after a recent change
      currentHunk.push(line);
    } else if (currentHunk.length > 0) {
      // We've moved too far from the last change, finalize current hunk
      hunks.push(createHunk(currentHunk));
      currentHunk = [];
      lastChangeIndex = -1;
    }
  }

  // Add final hunk if any
  if (currentHunk.length > 0) {
    hunks.push(createHunk(currentHunk));
  }

  return hunks;
}

/**
 * Create a hunk object from a list of diff lines
 */
function createHunk(lines: DiffLine[]): DiffHunk {
  // Find the range of original and modified line numbers
  let originalStart = Number.POSITIVE_INFINITY;
  let modifiedStart = Number.POSITIVE_INFINITY;
  let originalEnd = 0;
  let modifiedEnd = 0;

  for (const line of lines) {
    if (line.originalLine > 0) {
      originalStart = Math.min(originalStart, line.originalLine);
      originalEnd = Math.max(originalEnd, line.originalLine);
    }
    if (line.modifiedLine > 0) {
      modifiedStart = Math.min(modifiedStart, line.modifiedLine);
      modifiedEnd = Math.max(modifiedEnd, line.modifiedLine);
    }
  }

  // Handle edge cases
  if (originalStart === Number.POSITIVE_INFINITY) {
    originalStart = 0;
  }
  if (modifiedStart === Number.POSITIVE_INFINITY) {
    modifiedStart = 0;
  }

  const originalCount = originalStart === 0 ? 0 : originalEnd - originalStart + 1;
  const modifiedCount = modifiedStart === 0 ? 0 : modifiedEnd - modifiedStart + 1;

  return {
    originalStart: originalStart === 0 ? 0 : originalStart,
    originalCount,
    modifiedStart: modifiedStart === 0 ? 0 : modifiedStart,
    modifiedCount,
    lines,
  };
}
