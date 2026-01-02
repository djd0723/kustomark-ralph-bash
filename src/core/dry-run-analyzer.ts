/**
 * Dry-run analysis for kustomark builds
 *
 * Provides comprehensive analysis of what a build would do without executing it:
 * - Complexity scoring based on patch types and regex patterns
 * - Risk assessment for potentially destructive operations
 * - Impact calculation for file changes and size differences
 * - Conflict detection for patches that may interfere with each other
 * - Dependency analysis for patches that rely on results of other patches
 */

import type {
  Condition,
  DryRunAnalysis,
  DryRunImpact,
  PatchConflict,
  PatchDependency,
  PatchOperation,
  ReplaceRegexPatch,
  RiskLevel,
} from "./types.js";

/**
 * Calculate complexity score for a regex pattern
 * Factors considered:
 * - Special characters and escapes
 * - Quantifiers and groups
 * - Character classes
 * - Lookaheads/lookbehinds
 * - Backreferences
 */
function calculateRegexComplexity(pattern: string): number {
  let score = 0;

  // Base score for using regex at all
  score += 10;

  // Special character usage (each adds complexity)
  const specialChars = pattern.match(/[.*+?^${}()|[\]\\]/g);
  if (specialChars) {
    score += specialChars.length * 2;
  }

  // Quantifiers (greedy, lazy, exact)
  const quantifiers = pattern.match(/[*+?]|\{\d+,?\d*\}/g);
  if (quantifiers) {
    score += quantifiers.length * 3;
  }

  // Capturing groups
  const groups = pattern.match(/\([^)]*\)/g);
  if (groups) {
    score += groups.length * 5;
  }

  // Character classes
  const charClasses = pattern.match(/\[[^\]]*\]/g);
  if (charClasses) {
    score += charClasses.length * 3;
  }

  // Lookaheads/lookbehinds (high complexity)
  const lookarounds = pattern.match(/\(\?[=!<]/g);
  if (lookarounds) {
    score += lookarounds.length * 10;
  }

  // Backreferences (high complexity)
  const backrefs = pattern.match(/\\[1-9]\d*/g);
  if (backrefs) {
    score += backrefs.length * 8;
  }

  // Long patterns are inherently more complex
  if (pattern.length > 50) {
    score += Math.floor((pattern.length - 50) / 10);
  }

  return Math.min(score, 100); // Cap at 100
}

/**
 * Calculate complexity score for a condition
 */
function calculateConditionComplexity(condition: Condition): number {
  switch (condition.type) {
    case "fileContains":
    case "frontmatterEquals":
    case "frontmatterExists":
      return 5; // Simple conditions

    case "fileMatches":
      // Regex pattern in condition
      return 5 + calculateRegexComplexity(condition.pattern) / 2;

    case "not":
      // Negation adds some complexity
      return 3 + calculateConditionComplexity(condition.condition);

    case "anyOf":
    case "allOf": {
      // Compound conditions
      const subComplexity = condition.conditions.reduce(
        (sum, c) => sum + calculateConditionComplexity(c),
        0,
      );
      return 10 + subComplexity;
    }

    default:
      return 0;
  }
}

/**
 * Calculate overall complexity score for patches
 */
function calculateComplexityScore(patches: PatchOperation[]): number {
  if (patches.length === 0) return 0;

  let totalScore = 0;

  for (const patch of patches) {
    let patchScore = 0;

    // Base score by operation type
    switch (patch.op) {
      // Simple operations
      case "replace":
      case "replace-line":
      case "set-frontmatter":
      case "remove-frontmatter":
        patchScore = 5;
        break;

      // Moderate operations
      case "replace-regex":
        patchScore = 15 + calculateRegexComplexity((patch as ReplaceRegexPatch).pattern);
        break;
      case "insert-after-line":
      case "insert-before-line":
        if (patch.pattern || patch.regex) {
          patchScore = 10 + (patch.pattern ? calculateRegexComplexity(patch.pattern) : 5);
        } else {
          patchScore = 8;
        }
        break;
      case "delete-between":
      case "replace-between":
        patchScore = 12;
        break;

      // Section operations
      case "remove-section":
      case "replace-section":
      case "prepend-to-section":
      case "append-to-section":
      case "move-section":
      case "rename-header":
      case "change-section-level":
        patchScore = 10;
        break;

      // Frontmatter operations
      case "rename-frontmatter":
      case "merge-frontmatter":
        patchScore = 8;
        break;

      // File operations (higher complexity)
      case "copy-file":
      case "move-file":
        patchScore = 15;
        break;
      case "rename-file":
        patchScore = 18;
        break;
      case "delete-file":
        patchScore = 20;
        break;

      // Table operations
      case "replace-table-cell":
        patchScore = 12;
        break;
      case "add-table-row":
      case "remove-table-row":
      case "add-table-column":
      case "remove-table-column":
        patchScore = 15;
        break;

      default:
        patchScore = 10;
    }

    // Additional complexity from conditions
    if (patch.when) {
      patchScore += calculateConditionComplexity(patch.when);
    }

    // Additional complexity from include/exclude patterns
    if (patch.include || patch.exclude) {
      patchScore += 5;
    }

    totalScore += patchScore;
  }

  // Normalize to 0-100 scale
  // Average complexity per patch, scaled
  const avgComplexity = totalScore / patches.length;
  const normalized = Math.min(Math.round(avgComplexity * 1.5), 100);

  return normalized;
}

/**
 * Assess risk level based on patch types and scope
 */
function assessRiskLevel(patches: PatchOperation[]): RiskLevel {
  let riskScore = 0;

  for (const patch of patches) {
    // Destructive operations = high risk
    switch (patch.op) {
      case "delete-file":
        riskScore += 50;
        break;
      case "remove-section":
      case "delete-between":
        riskScore += 30;
        break;
      case "move-file":
      case "rename-file":
        riskScore += 25;
        break;
      case "replace-section":
      case "replace-between":
        riskScore += 20;
        break;
      case "replace-regex": {
        // Regex replacements can be risky if too broad
        const regexPatch = patch as ReplaceRegexPatch;
        if (regexPatch.flags?.includes("g")) {
          riskScore += 15; // Global replacements are riskier
        } else {
          riskScore += 10;
        }
        break;
      }
      case "move-section":
      case "change-section-level":
        riskScore += 15;
        break;
      case "remove-frontmatter":
      case "remove-table-row":
      case "remove-table-column":
        riskScore += 12;
        break;
      default:
        riskScore += 5;
    }

    // Patches without validation are riskier
    if (!patch.validate) {
      riskScore += 3;
    }

    // Patches without conditions on destructive ops are riskier
    if (!patch.when && (patch.op === "delete-file" || patch.op === "remove-section")) {
      riskScore += 10;
    }
  }

  // Normalize risk score
  const avgRisk = patches.length > 0 ? riskScore / patches.length : 0;

  if (avgRisk >= 30) return "high";
  if (avgRisk >= 15) return "medium";
  return "low";
}

/**
 * Calculate impact details
 */
function calculateImpact(patches: PatchOperation[], fileCount: number = 1): DryRunImpact {
  let filesCreated = 0;
  let filesModified = 0;
  let filesDeleted = 0;
  let bytesAdded = 0;
  let bytesRemoved = 0;

  for (const patch of patches) {
    switch (patch.op) {
      case "copy-file":
        filesCreated += 1;
        bytesAdded += 1000; // Estimated average file size
        break;

      case "delete-file":
        filesDeleted += 1;
        bytesRemoved += 1000; // Estimated average file size
        break;

      case "move-file":
      case "rename-file":
        // No net change in file count, but files are modified
        filesModified += 1;
        break;

      case "remove-section":
      case "delete-between":
      case "remove-frontmatter":
      case "remove-table-row":
      case "remove-table-column":
        filesModified += fileCount;
        bytesRemoved += 200; // Estimated bytes removed per file
        break;

      case "prepend-to-section":
      case "append-to-section":
      case "set-frontmatter":
      case "merge-frontmatter":
      case "add-table-row":
      case "add-table-column":
      case "insert-after-line":
      case "insert-before-line":
        filesModified += fileCount;
        bytesAdded += 150; // Estimated bytes added per file
        break;

      case "replace":
      case "replace-regex":
      case "replace-section":
      case "replace-between":
      case "replace-line":
      case "replace-table-cell":
      case "rename-header":
      case "rename-frontmatter":
        filesModified += fileCount;
        // Replacements could add or remove, assume neutral
        break;

      case "move-section":
      case "change-section-level":
        filesModified += fileCount;
        break;
    }
  }

  return {
    filesCreated,
    filesModified,
    filesDeleted,
    bytesAdded,
    bytesRemoved,
    netBytes: bytesAdded - bytesRemoved,
  };
}

/**
 * Detect conflicts between patches
 */
function detectConflicts(patches: PatchOperation[]): PatchConflict[] {
  const conflicts: PatchConflict[] = [];

  for (let i = 0; i < patches.length; i++) {
    for (let j = i + 1; j < patches.length; j++) {
      const patch1 = patches[i];
      const patch2 = patches[j];
      if (!patch1 || !patch2) continue;

      // Check for same-section conflicts
      if (
        (patch1.op === "remove-section" ||
          patch1.op === "replace-section" ||
          patch1.op === "move-section") &&
        (patch2.op === "remove-section" ||
          patch2.op === "replace-section" ||
          patch2.op === "prepend-to-section" ||
          patch2.op === "append-to-section" ||
          patch2.op === "move-section")
      ) {
        if (patch1.id === patch2.id) {
          conflicts.push({
            patchIndices: [i, j],
            type: "overlapping-targets",
            description: `Both patches target section "${patch1.id}"`,
            severity: "high",
          });
        }
      }

      // Check for same frontmatter key conflicts
      if (
        (patch1.op === "set-frontmatter" || patch1.op === "remove-frontmatter") &&
        (patch2.op === "set-frontmatter" || patch2.op === "remove-frontmatter")
      ) {
        if (patch1.key === patch2.key) {
          conflicts.push({
            patchIndices: [i, j],
            type: "competing-changes",
            description: `Both patches modify frontmatter key "${patch1.key}"`,
            severity: "medium",
          });
        }
      }

      // Check for file operation conflicts
      if (patch1.op === "delete-file" && patch2.op === "copy-file") {
        conflicts.push({
          patchIndices: [i, j],
          type: "order-dependent",
          description: "File deletion followed by file copy - order matters",
          severity: "high",
        });
      }

      // Check for regex replacement conflicts
      if (patch1.op === "replace-regex" && patch2.op === "replace-regex") {
        const regex1 = patch1 as ReplaceRegexPatch;
        const regex2 = patch2 as ReplaceRegexPatch;

        // If both have global flag and might overlap
        if (regex1.flags?.includes("g") && regex2.flags?.includes("g")) {
          conflicts.push({
            patchIndices: [i, j],
            type: "order-dependent",
            description: "Multiple global regex replacements - order affects final result",
            severity: "medium",
          });
        }
      }

      // Check for table conflicts
      if (
        (patch1.op === "add-table-row" ||
          patch1.op === "remove-table-row" ||
          patch1.op === "add-table-column" ||
          patch1.op === "remove-table-column") &&
        (patch2.op === "add-table-row" ||
          patch2.op === "remove-table-row" ||
          patch2.op === "add-table-column" ||
          patch2.op === "remove-table-column")
      ) {
        if (patch1.table === patch2.table) {
          conflicts.push({
            patchIndices: [i, j],
            type: "order-dependent",
            description: `Both patches modify the same table`,
            severity: "medium",
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Analyze dependencies between patches
 */
function analyzeDependencies(patches: PatchOperation[]): PatchDependency[] {
  const dependencies: PatchDependency[] = [];

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    if (!patch) continue;
    const dependsOn: number[] = [];

    // Check if this patch depends on earlier patches
    for (let j = 0; j < i; j++) {
      const earlierPatch = patches[j];
      if (!earlierPatch) continue;

      // Section operations may depend on section existence
      if (
        (patch.op === "prepend-to-section" ||
          patch.op === "append-to-section" ||
          patch.op === "replace-section") &&
        earlierPatch.op === "replace-section" &&
        patch.id === earlierPatch.id
      ) {
        dependsOn.push(j);
      }

      // Frontmatter operations may depend on key existence
      if (
        patch.op === "rename-frontmatter" &&
        earlierPatch.op === "set-frontmatter" &&
        patch.old === earlierPatch.key
      ) {
        dependsOn.push(j);
      }

      // File operations may depend on file creation
      if (
        (patch.op === "move-file" || patch.op === "rename-file") &&
        earlierPatch.op === "copy-file"
      ) {
        dependsOn.push(j);
      }

      // Replace operations may depend on content being present
      if (
        patch.op === "replace" &&
        (earlierPatch.op === "prepend-to-section" ||
          earlierPatch.op === "append-to-section" ||
          earlierPatch.op === "insert-after-line" ||
          earlierPatch.op === "insert-before-line")
      ) {
        // The replace might target content added by the earlier patch
        if (earlierPatch.content && patch.old.includes(earlierPatch.content)) {
          dependsOn.push(j);
        }
      }
    }

    if (dependsOn.length > 0) {
      let type: PatchDependency["type"] = "sequential";
      let description = "Depends on earlier patches for correct execution";

      if (dependsOn.length === 1) {
        type = "prerequisite";
        description = `Requires patch #${dependsOn[0]} to execute first`;
      } else if (dependsOn.length > 2) {
        type = "complementary";
        description = `Works in conjunction with ${dependsOn.length} other patches`;
      }

      dependencies.push({
        dependentPatch: i,
        dependsOn,
        type,
        description,
      });
    }
  }

  return dependencies;
}

/**
 * Generate overall assessment message
 */
function generateAssessment(analysis: Omit<DryRunAnalysis, "assessment">): string {
  const parts: string[] = [];

  // Risk assessment
  if (analysis.riskLevel === "high") {
    parts.push("HIGH RISK: This build contains potentially destructive operations.");
  } else if (analysis.riskLevel === "medium") {
    parts.push("MEDIUM RISK: This build modifies content in non-trivial ways.");
  } else {
    parts.push("LOW RISK: This build appears safe to execute.");
  }

  // Complexity assessment
  if (analysis.complexityScore >= 70) {
    parts.push("The patches are highly complex and may require careful review.");
  } else if (analysis.complexityScore >= 40) {
    parts.push("The patches have moderate complexity.");
  } else {
    parts.push("The patches are relatively simple.");
  }

  // Conflict warnings
  if (analysis.conflicts.length > 0) {
    const highSeverity = analysis.conflicts.filter((c) => c.severity === "high").length;
    if (highSeverity > 0) {
      parts.push(
        `WARNING: ${highSeverity} high-severity conflict(s) detected that may cause unexpected results.`,
      );
    } else {
      parts.push(`${analysis.conflicts.length} potential conflict(s) detected.`);
    }
  }

  // Dependency info
  if (analysis.dependencies.length > 0) {
    parts.push(`${analysis.dependencies.length} patch(es) have dependencies on earlier patches.`);
  }

  // Impact summary
  const { impact } = analysis;
  const impactParts: string[] = [];
  if (impact.filesCreated > 0) impactParts.push(`${impact.filesCreated} file(s) created`);
  if (impact.filesModified > 0) impactParts.push(`${impact.filesModified} file(s) modified`);
  if (impact.filesDeleted > 0) impactParts.push(`${impact.filesDeleted} file(s) deleted`);

  if (impactParts.length > 0) {
    parts.push(`Impact: ${impactParts.join(", ")}.`);
  }

  return parts.join(" ");
}

/**
 * Analyze what a build would do without executing it
 *
 * @param patches - Array of patches to analyze
 * @param fileCount - Estimated number of files that will be processed
 * @returns Comprehensive dry-run analysis
 */
export function analyzeBuild(patches: PatchOperation[], fileCount: number = 1): DryRunAnalysis {
  // Calculate all metrics
  const complexityScore = calculateComplexityScore(patches);
  const riskLevel = assessRiskLevel(patches);
  const impact = calculateImpact(patches, fileCount);
  const conflicts = detectConflicts(patches);
  const dependencies = analyzeDependencies(patches);

  // Create analysis object without assessment
  const partialAnalysis = {
    complexityScore,
    riskLevel,
    impact,
    conflicts,
    dependencies,
  };

  // Generate assessment based on all metrics
  const assessment = generateAssessment(partialAnalysis);

  return {
    ...partialAnalysis,
    assessment,
  };
}
