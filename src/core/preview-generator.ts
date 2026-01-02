/**
 * Preview generation module for Kustomark
 * Generates rich preview data with character-level diffs for side-by-side comparison
 */

/**
 * Type of change for a character-level diff
 */
export type CharDiffType = "same" | "insert" | "delete" | "replace";

/**
 * Character-level diff segment
 */
export interface CharDiff {
  /** Type of change */
  type: CharDiffType;
  /** Text content */
  text: string;
}

/**
 * Type of line change
 */
export type LineChangeType = "insert" | "delete" | "modify" | "unchanged";

/**
 * Preview information for a single line change
 */
export interface LineChange {
  /** Line number in original file (1-indexed, 0 if not applicable) */
  oldLineNumber: number;
  /** Line number in new file (1-indexed, 0 if not applicable) */
  newLineNumber: number;
  /** Type of change */
  type: LineChangeType;
  /** Original line content (empty for insertions) */
  oldText: string;
  /** New line content (empty for deletions) */
  newText: string;
  /** Character-level diff for modified lines */
  charDiff?: CharDiff[];
  /** ID of the patch that caused this change (if available) */
  patchId?: string;
  /** Operation type of the patch that caused this change */
  patchOp?: string;
}

/**
 * Preview data for a single file
 */
export interface FilePreview {
  /** File path */
  path: string;
  /** Original content */
  before: string;
  /** Modified content */
  after: string;
  /** Whether the file has any changes */
  hasChanges: boolean;
  /** Line-by-line change information */
  changes: LineChange[];
  /** Total lines added */
  linesAdded: number;
  /** Total lines deleted */
  linesDeleted: number;
  /** Total lines modified */
  linesModified: number;
}

/**
 * Complete preview result for multiple files
 */
export interface PreviewResult {
  /** List of file previews */
  files: FilePreview[];
  /** Total files with changes */
  filesChanged: number;
  /** Total lines added across all files */
  totalLinesAdded: number;
  /** Total lines deleted across all files */
  totalLinesDeleted: number;
  /** Total lines modified across all files */
  totalLinesModified: number;
}

/**
 * Compute character-level diff between two strings using Myers diff algorithm
 */
function computeCharDiff(oldText: string, newText: string): CharDiff[] {
  const result: CharDiff[] = [];

  // Simple character-level diff using longest common subsequence
  const lcs = longestCommonSubsequence(oldText, newText);

  let oldPos = 0;
  let newPos = 0;
  let lcsPos = 0;

  while (oldPos < oldText.length || newPos < newText.length) {
    const oldChar = oldText[oldPos];
    const newChar = newText[newPos];
    const lcsChar = lcs[lcsPos];

    if (lcsPos < lcs.length && oldPos < oldText.length && newPos < newText.length &&
        oldChar !== undefined && newChar !== undefined && lcsChar !== undefined &&
        oldChar === lcsChar && newChar === lcsChar) {
      // Characters match - same
      result.push({ type: "same", text: oldChar });
      oldPos++;
      newPos++;
      lcsPos++;
    } else if (oldPos < oldText.length && oldChar !== undefined && (lcsPos >= lcs.length || oldChar !== lcsChar)) {
      // Character deleted
      result.push({ type: "delete", text: oldChar });
      oldPos++;
    } else if (newPos < newText.length && newChar !== undefined) {
      // Character inserted
      result.push({ type: "insert", text: newChar });
      newPos++;
    }
  }

  // Merge consecutive same-type segments for better readability
  return mergeAdjacentCharDiffs(result);
}

/**
 * Merge adjacent character diffs of the same type
 */
function mergeAdjacentCharDiffs(diffs: CharDiff[]): CharDiff[] {
  if (diffs.length === 0) return [];

  const firstDiff = diffs[0];
  if (!firstDiff) return [];

  const merged: CharDiff[] = [];
  let current = { ...firstDiff };

  for (let i = 1; i < diffs.length; i++) {
    const diff = diffs[i];
    if (!diff) continue;
    if (diff.type === current.type) {
      current.text += diff.text;
    } else {
      merged.push(current);
      current = { ...diff };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Find longest common subsequence of two strings (character-level)
 */
function longestCommonSubsequence(a: string, b: string): string {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  // Build LCS table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const prevI = dp[i - 1];
      const currI = dp[i];
      if (!prevI || !currI) continue;

      if (a[i - 1] === b[j - 1]) {
        const prevDiag = prevI[j - 1];
        currI[j] = (prevDiag ?? 0) + 1;
      } else {
        const prevJ = prevI[j];
        const currJMinus1 = currI[j - 1];
        currI[j] = Math.max(prevJ ?? 0, currJMinus1 ?? 0);
      }
    }
  }

  // Reconstruct LCS
  let i = m;
  let j = n;
  let lcs = "";

  while (i > 0 && j > 0) {
    const aChar = a[i - 1];
    const bChar = b[j - 1];
    const dpPrevI = dp[i - 1];
    const dpCurrI = dp[i];

    if (aChar !== undefined && aChar === bChar) {
      lcs = aChar + lcs;
      i--;
      j--;
    } else if (dpPrevI && dpCurrI && (dpPrevI[j] ?? 0) > (dpCurrI[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Generate preview data for a single file
 *
 * @param path - File path
 * @param before - Original content
 * @param after - Modified content
 * @param patchInfo - Optional patch information for tracking changes
 * @returns File preview with line-by-line change information
 */
export function generateFilePreview(
  path: string,
  before: string,
  after: string,
  patchInfo?: { patchId?: string; patchOp?: string }
): FilePreview {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  const changes: LineChange[] = [];
  let linesAdded = 0;
  let linesDeleted = 0;
  let linesModified = 0;

  // Use longest common subsequence to compute line-level diff
  const lcsLines = longestCommonSubsequenceLines(beforeLines, afterLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < beforeLines.length || newIdx < afterLines.length) {
    const oldLine = beforeLines[oldIdx];
    const newLine = afterLines[newIdx];
    const lcsLine = lcsLines[lcsIdx];

    if (lcsIdx < lcsLines.length &&
        oldIdx < beforeLines.length &&
        newIdx < afterLines.length &&
        oldLine !== undefined &&
        newLine !== undefined &&
        lcsLine !== undefined &&
        oldLine === lcsLine &&
        newLine === lcsLine) {
      // Lines match - unchanged
      changes.push({
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1,
        type: "unchanged",
        oldText: oldLine,
        newText: newLine,
        patchId: patchInfo?.patchId,
        patchOp: patchInfo?.patchOp,
      });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (oldIdx < beforeLines.length && newIdx < afterLines.length &&
               oldLine !== undefined && newLine !== undefined &&
               (lcsIdx >= lcsLines.length || oldLine !== lcsLine) &&
               (lcsIdx >= lcsLines.length || newLine !== lcsLine)) {
      // Line modified (both present but different)
      const charDiff = computeCharDiff(oldLine, newLine);
      changes.push({
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1,
        type: "modify",
        oldText: oldLine,
        newText: newLine,
        charDiff,
        patchId: patchInfo?.patchId,
        patchOp: patchInfo?.patchOp,
      });
      linesModified++;
      oldIdx++;
      newIdx++;
    } else if (oldIdx < beforeLines.length && oldLine !== undefined && (lcsIdx >= lcsLines.length || oldLine !== lcsLine)) {
      // Line deleted
      changes.push({
        oldLineNumber: oldIdx + 1,
        newLineNumber: 0,
        type: "delete",
        oldText: oldLine,
        newText: "",
        patchId: patchInfo?.patchId,
        patchOp: patchInfo?.patchOp,
      });
      linesDeleted++;
      oldIdx++;
    } else if (newIdx < afterLines.length && newLine !== undefined) {
      // Line inserted
      changes.push({
        oldLineNumber: 0,
        newLineNumber: newIdx + 1,
        type: "insert",
        oldText: "",
        newText: newLine,
        patchId: patchInfo?.patchId,
        patchOp: patchInfo?.patchOp,
      });
      linesAdded++;
      newIdx++;
    }
  }

  return {
    path,
    before,
    after,
    hasChanges: before !== after,
    changes,
    linesAdded,
    linesDeleted,
    linesModified,
  };
}

/**
 * Find longest common subsequence of two arrays of lines
 */
function longestCommonSubsequenceLines(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  // Build LCS table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const prevI = dp[i - 1];
      const currI = dp[i];
      if (!prevI || !currI) continue;

      if (a[i - 1] === b[j - 1]) {
        const prevDiag = prevI[j - 1];
        currI[j] = (prevDiag ?? 0) + 1;
      } else {
        const prevJ = prevI[j];
        const currJMinus1 = currI[j - 1];
        currI[j] = Math.max(prevJ ?? 0, currJMinus1 ?? 0);
      }
    }
  }

  // Reconstruct LCS
  let i = m;
  let j = n;
  const lcs: string[] = [];

  while (i > 0 && j > 0) {
    const aLine = a[i - 1];
    const dpPrevI = dp[i - 1];
    const dpCurrI = dp[i];

    if (aLine !== undefined && aLine === b[j - 1]) {
      lcs.unshift(aLine);
      i--;
      j--;
    } else if (dpPrevI && dpCurrI && (dpPrevI[j] ?? 0) > (dpCurrI[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Generate preview result for multiple files
 *
 * @param fileMap - Map of file paths to their before/after content
 * @returns Complete preview result with statistics
 */
export function generatePreview(
  fileMap: Map<string, { before: string; after: string }>
): PreviewResult {
  const files: FilePreview[] = [];
  let filesChanged = 0;
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  let totalLinesModified = 0;

  for (const [path, { before, after }] of fileMap.entries()) {
    const preview = generateFilePreview(path, before, after);
    files.push(preview);

    if (preview.hasChanges) {
      filesChanged++;
      totalLinesAdded += preview.linesAdded;
      totalLinesDeleted += preview.linesDeleted;
      totalLinesModified += preview.linesModified;
    }
  }

  return {
    files,
    filesChanged,
    totalLinesAdded,
    totalLinesDeleted,
    totalLinesModified,
  };
}
