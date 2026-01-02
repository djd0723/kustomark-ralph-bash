/**
 * Analytics module for Kustommark
 *
 * This module provides comprehensive analytics for patch operations,
 * tracking coverage, impact, complexity, and safety metrics.
 */

import type { KustomarkConfig, PatchOperation } from "./types.js";

/**
 * Risk level for patch operations
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * Risk score range: 1-10
 */
export type RiskScore = number;

/**
 * Coverage statistics for files
 */
export interface CoverageAnalysis {
  /** Total number of files */
  totalFiles: number;
  /** Number of files with at least one patch */
  filesWithPatches: number;
  /** Number of files without any patches */
  filesWithoutPatches: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** List of file paths without patches */
  unpatchedFiles: string[];
  /** List of file paths with patches */
  patchedFiles: string[];
}

/**
 * Impact analysis for individual patches
 */
export interface PatchImpact {
  /** Patch index in the config */
  patchIndex: number;
  /** Patch operation type */
  operation: string;
  /** Number of files affected by this patch */
  affectedFiles: number;
  /** List of file paths affected by this patch */
  files: string[];
  /** Total number of modifications (for multi-file operations) */
  modifications: number;
  /** Patch group (if specified) */
  group?: string;
}

/**
 * Impact analysis for all patches
 */
export interface ImpactAnalysis {
  /** Total number of patches */
  totalPatches: number;
  /** Total files affected by at least one patch */
  totalAffectedFiles: number;
  /** Per-patch impact details */
  patches: PatchImpact[];
  /** Files affected by multiple patches (path -> count) */
  multiPatchFiles: Map<string, number>;
}

/**
 * Complexity score for a file
 */
export interface FileComplexity {
  /** File path */
  file: string;
  /** Number of patches applied to this file */
  patchCount: number;
  /** Number of unique operation types */
  uniqueOperationTypes: number;
  /** Number of high-risk operations */
  highRiskOperations: number;
  /** Calculated complexity score */
  complexityScore: number;
  /** List of operation types affecting this file */
  operations: string[];
}

/**
 * Complexity analysis for all files
 */
export interface ComplexityAnalysis {
  /** Total number of files analyzed */
  totalFiles: number;
  /** Average complexity score across all files */
  averageComplexity: number;
  /** Maximum complexity score */
  maxComplexity: number;
  /** Minimum complexity score */
  minComplexity: number;
  /** Per-file complexity details */
  files: FileComplexity[];
  /** Files sorted by complexity (descending) */
  topComplexFiles: FileComplexity[];
}

/**
 * Safety assessment for a patch
 */
export interface PatchSafety {
  /** Patch index in the config */
  patchIndex: number;
  /** Patch operation type */
  operation: string;
  /** Risk level (low, medium, high) */
  riskLevel: RiskLevel;
  /** Numeric risk score (1-10) */
  riskScore: RiskScore;
  /** Human-readable risk reason */
  riskReason: string;
  /** Number of files affected */
  affectedFiles: number;
  /** Patch group (if specified) */
  group?: string;
}

/**
 * Safety analysis for all patches
 */
export interface SafetyAnalysis {
  /** Total number of patches */
  totalPatches: number;
  /** Number of high-risk patches */
  highRiskPatches: number;
  /** Number of medium-risk patches */
  mediumRiskPatches: number;
  /** Number of low-risk patches */
  lowRiskPatches: number;
  /** Average risk score across all patches */
  averageRiskScore: number;
  /** Per-patch safety details */
  patches: PatchSafety[];
  /** Patches sorted by risk (descending) */
  highestRiskPatches: PatchSafety[];
}

/**
 * Complete analytics report
 */
export interface AnalyticsReport {
  /** Coverage analysis */
  coverage: CoverageAnalysis;
  /** Impact analysis */
  impact: ImpactAnalysis;
  /** Complexity analysis */
  complexity: ComplexityAnalysis;
  /** Safety analysis */
  safety: SafetyAnalysis;
  /** Timestamp of analysis (ISO 8601) */
  timestamp: string;
}

/**
 * Analyzes which files have patches vs unpatched
 *
 * @param files - Set of all file paths
 * @param patches - Array of patch operations
 * @returns Coverage analysis with statistics
 *
 * @example
 * ```typescript
 * const files = new Set(['docs/api.md', 'docs/guide.md']);
 * const patches = [{op: 'replace', include: 'docs/api.md', old: 'foo', new: 'bar'}];
 * const coverage = analyzePatchCoverage(files, patches);
 * console.log(coverage.coveragePercentage); // 50
 * ```
 */
export function analyzePatchCoverage(
  files: Set<string>,
  patches: PatchOperation[],
): CoverageAnalysis {
  const totalFiles = files.size;
  const patchedFiles = new Set<string>();

  // Determine which files have patches
  for (const file of files) {
    for (const patch of patches) {
      if (patchAppliesToFile(patch, file)) {
        patchedFiles.add(file);
        break; // File is covered, no need to check more patches
      }
    }
  }

  const filesWithPatches = patchedFiles.size;
  const filesWithoutPatches = totalFiles - filesWithPatches;
  const coveragePercentage = totalFiles > 0 ? (filesWithPatches / totalFiles) * 100 : 0;

  const unpatchedFiles = Array.from(files).filter((file) => !patchedFiles.has(file));

  return {
    totalFiles,
    filesWithPatches,
    filesWithoutPatches,
    coveragePercentage,
    unpatchedFiles,
    patchedFiles: Array.from(patchedFiles),
  };
}

/**
 * Tracks files affected per patch and modifications
 *
 * @param files - Set of all file paths
 * @param patches - Array of patch operations
 * @returns Impact analysis showing which patches affect which files
 *
 * @example
 * ```typescript
 * const files = new Set(['docs/api.md', 'docs/guide.md']);
 * const patches = [{op: 'replace', old: 'foo', new: 'bar'}]; // Applies to all
 * const impact = analyzePatchImpact(files, patches);
 * console.log(impact.patches[0].affectedFiles); // 2
 * ```
 */
export function analyzePatchImpact(files: Set<string>, patches: PatchOperation[]): ImpactAnalysis {
  const patchImpacts: PatchImpact[] = [];
  const fileAffectedCount = new Map<string, number>();

  // Analyze each patch
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    if (!patch) continue;

    const affectedFiles: string[] = [];

    // Check which files this patch affects
    for (const file of files) {
      if (patchAppliesToFile(patch, file)) {
        affectedFiles.push(file);
        fileAffectedCount.set(file, (fileAffectedCount.get(file) ?? 0) + 1);
      }
    }

    patchImpacts.push({
      patchIndex: i,
      operation: patch.op,
      affectedFiles: affectedFiles.length,
      files: affectedFiles,
      modifications: affectedFiles.length, // Each file is one modification
      group: patch.group,
    });
  }

  // Find files affected by multiple patches
  const multiPatchFiles = new Map<string, number>();
  for (const [file, count] of fileAffectedCount) {
    if (count > 1) {
      multiPatchFiles.set(file, count);
    }
  }

  // Count unique files affected
  const totalAffectedFiles = fileAffectedCount.size;

  return {
    totalPatches: patches.length,
    totalAffectedFiles,
    patches: patchImpacts,
    multiPatchFiles,
  };
}

/**
 * Complexity scoring per file based on patches
 *
 * Formula: (patchCount × 2) + (uniqueOperationTypes × 1.5) + (highRiskOps × 3)
 *
 * @param files - Set of all file paths
 * @param patches - Array of patch operations
 * @returns Complexity analysis with per-file scores
 *
 * @example
 * ```typescript
 * const files = new Set(['docs/api.md']);
 * const patches = [
 *   {op: 'replace', include: 'docs/api.md', old: 'a', new: 'b'},
 *   {op: 'delete-file', match: 'docs/api.md'}
 * ];
 * const complexity = analyzeFileComplexity(files, patches);
 * console.log(complexity.files[0].complexityScore); // (2*2) + (2*1.5) + (1*3) = 10
 * ```
 */
export function analyzeFileComplexity(
  files: Set<string>,
  patches: PatchOperation[],
): ComplexityAnalysis {
  const fileComplexities: FileComplexity[] = [];
  let totalComplexity = 0;
  let minComplexity = Number.POSITIVE_INFINITY;
  let maxComplexity = 0;

  // Analyze each file
  for (const file of files) {
    const applicablePatches: PatchOperation[] = [];
    const operationTypes = new Set<string>();
    let highRiskOps = 0;

    // Find patches that apply to this file
    for (const patch of patches) {
      if (patchAppliesToFile(patch, file)) {
        applicablePatches.push(patch);
        operationTypes.add(patch.op);

        // Check if this is a high-risk operation
        const { riskLevel } = assessPatchRisk(patch);
        if (riskLevel === "high") {
          highRiskOps++;
        }
      }
    }

    // Calculate complexity score
    const patchCount = applicablePatches.length;
    const uniqueOperationTypes = operationTypes.size;
    const complexityScore = patchCount * 2 + uniqueOperationTypes * 1.5 + highRiskOps * 3;

    const fileComplexity: FileComplexity = {
      file,
      patchCount,
      uniqueOperationTypes,
      highRiskOperations: highRiskOps,
      complexityScore,
      operations: Array.from(operationTypes),
    };

    fileComplexities.push(fileComplexity);
    totalComplexity += complexityScore;

    // Track min/max
    if (complexityScore < minComplexity) {
      minComplexity = complexityScore;
    }
    if (complexityScore > maxComplexity) {
      maxComplexity = complexityScore;
    }
  }

  // Handle edge case of no files
  if (files.size === 0) {
    minComplexity = 0;
    maxComplexity = 0;
  }

  const averageComplexity = files.size > 0 ? totalComplexity / files.size : 0;

  // Sort by complexity (descending) for top complex files
  const topComplexFiles = [...fileComplexities].sort(
    (a, b) => b.complexityScore - a.complexityScore,
  );

  return {
    totalFiles: files.size,
    averageComplexity,
    maxComplexity,
    minComplexity,
    files: fileComplexities,
    topComplexFiles,
  };
}

/**
 * Risk assessment for each patch operation
 *
 * Risk scoring:
 * - High (8-10): delete-file, remove-section, replace-regex, remove-frontmatter, remove-table-*
 * - Medium (4-7): replace, replace-section, replace-between, rename-file, move-file
 * - Low (1-3): append-to-section, prepend-to-section, set-frontmatter, copy-file, insert-*, add-table-*
 *
 * @param files - Set of all file paths
 * @param patches - Array of patch operations
 * @returns Safety analysis with risk assessments
 *
 * @example
 * ```typescript
 * const files = new Set(['docs/api.md']);
 * const patches = [{op: 'delete-file', match: '*.md'}];
 * const safety = analyzePatchSafety(files, patches);
 * console.log(safety.patches[0].riskLevel); // 'high'
 * ```
 */
export function analyzePatchSafety(files: Set<string>, patches: PatchOperation[]): SafetyAnalysis {
  const patchSafeties: PatchSafety[] = [];
  let totalRiskScore = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  // Analyze each patch
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    if (!patch) continue;

    const { riskLevel, riskScore, riskReason } = assessPatchRisk(patch);

    // Count affected files
    let affectedFiles = 0;
    for (const file of files) {
      if (patchAppliesToFile(patch, file)) {
        affectedFiles++;
      }
    }

    const patchSafety: PatchSafety = {
      patchIndex: i,
      operation: patch.op,
      riskLevel,
      riskScore,
      riskReason,
      affectedFiles,
      group: patch.group,
    };

    patchSafeties.push(patchSafety);
    totalRiskScore += riskScore;

    // Count by risk level
    if (riskLevel === "high") {
      highRiskCount++;
    } else if (riskLevel === "medium") {
      mediumRiskCount++;
    } else {
      lowRiskCount++;
    }
  }

  const averageRiskScore = patches.length > 0 ? totalRiskScore / patches.length : 0;

  // Sort by risk (descending)
  const highestRiskPatches = [...patchSafeties].sort((a, b) => b.riskScore - a.riskScore);

  return {
    totalPatches: patches.length,
    highRiskPatches: highRiskCount,
    mediumRiskPatches: mediumRiskCount,
    lowRiskPatches: lowRiskCount,
    averageRiskScore,
    patches: patchSafeties,
    highestRiskPatches,
  };
}

/**
 * Main function that combines all analyses
 *
 * @param config - Kustomark configuration
 * @param files - Set of all file paths
 * @returns Complete analytics report
 *
 * @example
 * ```typescript
 * const report = generateAnalyticsReport(config, files);
 * console.log(`Coverage: ${report.coverage.coveragePercentage.toFixed(1)}%`);
 * console.log(`High-risk patches: ${report.safety.highRiskPatches}`);
 * ```
 */
export function generateAnalyticsReport(
  config: KustomarkConfig,
  files: Set<string>,
): AnalyticsReport {
  const patches = config.patches ?? [];

  const coverage = analyzePatchCoverage(files, patches);
  const impact = analyzePatchImpact(files, patches);
  const complexity = analyzeFileComplexity(files, patches);
  const safety = analyzePatchSafety(files, patches);

  return {
    coverage,
    impact,
    complexity,
    safety,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Determines if a patch applies to a specific file
 *
 * Checks include/exclude patterns and file operations.
 *
 * @param patch - Patch operation to check
 * @param file - File path to check against
 * @returns True if patch applies to file
 */
function patchAppliesToFile(patch: PatchOperation, file: string): boolean {
  // Check include patterns
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    const matchesInclude = includePatterns.some((pattern) => matchesGlob(file, pattern));
    if (!matchesInclude) {
      return false;
    }
  }

  // Check exclude patterns
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    const matchesExclude = excludePatterns.some((pattern) => matchesGlob(file, pattern));
    if (matchesExclude) {
      return false;
    }
  }

  // Special handling for file operations
  if (
    patch.op === "copy-file" ||
    patch.op === "rename-file" ||
    patch.op === "delete-file" ||
    patch.op === "move-file"
  ) {
    // For file operations, check if the file matches the operation's target
    if ("match" in patch && patch.match) {
      return matchesGlob(file, patch.match);
    }
    if ("src" in patch && patch.src) {
      return file === patch.src;
    }
  }

  // If no include/exclude patterns, patch applies to all files
  return true;
}

/**
 * Simple glob pattern matching
 *
 * Supports * (any chars), ** (any path), and exact matches.
 *
 * @param path - File path to test
 * @param pattern - Glob pattern
 * @returns True if path matches pattern
 */
function matchesGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  // Escape special regex characters except * and /
  let regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§DOUBLESTAR§")
    .replace(/\*/g, "[^/]*")
    .replace(/§DOUBLESTAR§/g, ".*");

  // Add anchors
  regexPattern = `^${regexPattern}$`;

  const regex = new RegExp(regexPattern);
  return regex.test(path);
}

/**
 * Assesses the risk level of a patch operation
 *
 * @param patch - Patch operation to assess
 * @returns Risk assessment with level, score, and reason
 */
function assessPatchRisk(patch: PatchOperation): {
  riskLevel: RiskLevel;
  riskScore: RiskScore;
  riskReason: string;
} {
  const op = patch.op;

  // High risk (8-10): Destructive operations
  if (
    op === "delete-file" ||
    op === "remove-section" ||
    op === "replace-regex" ||
    op === "remove-frontmatter" ||
    op === "remove-table-row" ||
    op === "remove-table-column"
  ) {
    return {
      riskLevel: "high",
      riskScore: op === "delete-file" ? 10 : op === "replace-regex" ? 9 : 8,
      riskReason: `${op} is a destructive operation that removes content`,
    };
  }

  // Medium risk (4-7): Modification operations
  if (
    op === "replace" ||
    op === "replace-section" ||
    op === "replace-between" ||
    op === "rename-file" ||
    op === "move-file" ||
    op === "replace-line" ||
    op === "rename-header" ||
    op === "move-section" ||
    op === "change-section-level" ||
    op === "delete-between" ||
    op === "rename-frontmatter" ||
    op === "merge-frontmatter" ||
    op === "replace-table-cell"
  ) {
    return {
      riskLevel: "medium",
      riskScore: op === "rename-file" || op === "move-file" ? 6 : op === "delete-between" ? 6 : 5,
      riskReason: `${op} modifies existing content or structure`,
    };
  }

  // Low risk (1-3): Additive operations
  if (
    op === "append-to-section" ||
    op === "prepend-to-section" ||
    op === "set-frontmatter" ||
    op === "copy-file" ||
    op === "insert-after-line" ||
    op === "insert-before-line" ||
    op === "add-table-row" ||
    op === "add-table-column"
  ) {
    return {
      riskLevel: "low",
      riskScore: op === "copy-file" ? 3 : op === "set-frontmatter" ? 2 : 1,
      riskReason: `${op} adds content without removing existing data`,
    };
  }

  // Default to medium risk for unknown operations
  return {
    riskLevel: "medium",
    riskScore: 5,
    riskReason: `${op} is an unknown operation type`,
  };
}
