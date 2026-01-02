/**
 * CLI command for analyzing patch configurations
 * Provides comprehensive analytics on coverage, impact, complexity, and safety
 */

import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import {
  analyzeFileComplexity,
  analyzePatchCoverage,
  analyzePatchImpact,
  analyzePatchSafety,
  type ComplexityAnalysis,
  type CoverageAnalysis,
  type FileComplexity,
  type ImpactAnalysis,
  type PatchSafety,
  type RiskLevel,
  type SafetyAnalysis,
} from "../core/analytics.js";
import { parseConfig } from "../core/config-parser.js";
import { loadLockFile } from "../core/lock-file.js";
import { resolveResources } from "../core/resource-resolver.js";
import type { KustomarkConfig, LockFile, LockFileEntry } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  verbosity: number; // 0=quiet, 1=normal, 2=-v, 3=-vv, 4=-vvv
  minRisk?: "high" | "medium" | "low" | string; // Minimum risk level to display
  sort?: "risk" | "complexity" | "impact" | "coverage" | string; // Sort order
}

interface AnalyzeResult {
  success: boolean;
  coverage: CoverageAnalysis;
  impact: ImpactAnalysis;
  complexity: ComplexityAnalysis;
  safety: SafetyAnalysis;
  error?: string;
}

// ============================================================================
// Color Utilities (Simple ANSI codes)
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function getRiskColor(risk: RiskLevel): keyof typeof colors {
  switch (risk) {
    case "high":
      return "red";
    case "medium":
      return "yellow";
    case "low":
      return "green";
  }
}

// ============================================================================
// Filtering and Sorting Functions
// ============================================================================

/**
 * Filter patches by minimum risk level
 */
function filterPatchesByRisk(patches: PatchSafety[], minRisk: RiskLevel): PatchSafety[] {
  const riskOrder: Record<RiskLevel, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const minLevel = riskOrder[minRisk];

  return patches.filter((patch) => riskOrder[patch.riskLevel] >= minLevel);
}

/**
 * Sort patches based on specified criteria
 */
function sortPatches(
  patches: PatchSafety[],
  sortBy: "risk" | "complexity" | "impact" | "coverage",
): PatchSafety[] {
  const sorted = [...patches];

  switch (sortBy) {
    case "risk":
      // Already sorted by risk in descending order from analytics
      sorted.sort((a, b) => b.riskScore - a.riskScore);
      break;
    case "impact":
      sorted.sort((a, b) => b.affectedFiles - a.affectedFiles);
      break;
    case "complexity":
    case "coverage":
      // For these, we'd need additional data not present in PatchSafety
      // Fall back to risk sorting
      sorted.sort((a, b) => b.riskScore - a.riskScore);
      break;
  }

  return sorted;
}

/**
 * Sort files by complexity
 */
function sortFilesByComplexity(files: FileComplexity[]): FileComplexity[] {
  return [...files].sort((a, b) => b.complexityScore - a.complexityScore);
}

// ============================================================================
// Text Output Functions
// ============================================================================

/**
 * Output coverage analysis in text format
 */
function outputCoverageText(coverage: CoverageAnalysis, verbosity: number): void {
  console.log(colorize("\n=== Coverage Analysis ===", "bold"));
  console.log(`Total files: ${coverage.totalFiles}`);
  console.log(
    `Files with patches: ${colorize(String(coverage.filesWithPatches), "green")} (${coverage.coveragePercentage.toFixed(1)}%)`,
  );
  console.log(
    `Files without patches: ${colorize(String(coverage.filesWithoutPatches), coverage.filesWithoutPatches > 0 ? "yellow" : "green")}`,
  );

  if (verbosity >= 3 && coverage.unpatchedFiles.length > 0) {
    console.log(colorize("\nUnpatched files:", "dim"));
    for (const file of coverage.unpatchedFiles) {
      console.log(`  - ${file}`);
    }
  }

  if (verbosity >= 2 && coverage.patchedFiles.length > 0) {
    console.log(colorize("\nPatched files:", "dim"));
    for (const file of coverage.patchedFiles) {
      console.log(`  - ${file}`);
    }
  }
}

/**
 * Output impact analysis in text format
 */
function outputImpactText(impact: ImpactAnalysis, verbosity: number): void {
  console.log(colorize("\n=== Impact Analysis ===", "bold"));
  console.log(`Total patches: ${impact.totalPatches}`);
  console.log(`Total affected files: ${impact.totalAffectedFiles}`);
  console.log(
    `Files with multiple patches: ${colorize(String(impact.multiPatchFiles.size), impact.multiPatchFiles.size > 0 ? "yellow" : "green")}`,
  );

  if (verbosity >= 2 && impact.multiPatchFiles.size > 0) {
    console.log(colorize("\nFiles affected by multiple patches:", "dim"));
    const sorted = Array.from(impact.multiPatchFiles.entries()).sort((a, b) => b[1] - a[1]);
    for (const [file, count] of sorted) {
      console.log(`  - ${file} (${count} patches)`);
    }
  }

  if (verbosity >= 3) {
    console.log(colorize("\nPer-patch impact:", "dim"));
    for (const patch of impact.patches) {
      console.log(`  Patch ${patch.patchIndex}:`);
      console.log(`    operation: ${patch.operation}`);
      console.log(`    affected files: ${patch.affectedFiles}`);
      if (patch.group) {
        console.log(`    group: ${patch.group}`);
      }
      if (verbosity >= 4) {
        console.log(`    files:`);
        for (const file of patch.files) {
          console.log(`      - ${file}`);
        }
      }
    }
  }
}

/**
 * Output complexity analysis in text format
 */
function outputComplexityText(complexity: ComplexityAnalysis, verbosity: number): void {
  console.log(colorize("\n=== Complexity Analysis ===", "bold"));
  console.log(`Total files: ${complexity.totalFiles}`);
  console.log(`Average complexity: ${complexity.averageComplexity.toFixed(2)}`);
  console.log(`Max complexity: ${complexity.maxComplexity.toFixed(2)}`);
  console.log(`Min complexity: ${complexity.minComplexity.toFixed(2)}`);

  if (verbosity >= 2 && complexity.topComplexFiles.length > 0) {
    const topN =
      verbosity >= 3
        ? complexity.topComplexFiles.length
        : Math.min(5, complexity.topComplexFiles.length);
    console.log(colorize(`\nTop ${topN} most complex files:`, "dim"));
    for (const file of complexity.topComplexFiles.slice(0, topN)) {
      const complexityColor =
        file.complexityScore > 10 ? "red" : file.complexityScore > 5 ? "yellow" : "green";
      console.log(
        `  ${file.file}: ${colorize(file.complexityScore.toFixed(2), complexityColor)} (${file.patchCount} patches, ${file.uniqueOperationTypes} ops, ${file.highRiskOperations} high-risk)`,
      );
      if (verbosity >= 4) {
        console.log(`    Operations: ${file.operations.join(", ")}`);
      }
    }
  }
}

/**
 * Output safety analysis in text format
 */
function outputSafetyText(
  safety: SafetyAnalysis,
  verbosity: number,
  minRisk?: RiskLevel,
  sortBy?: string,
): void {
  console.log(colorize("\n=== Safety Analysis ===", "bold"));
  console.log(`Total patches: ${safety.totalPatches}`);
  console.log(`high-risk patches: ${colorize(String(safety.highRiskPatches), "red")}`);
  console.log(`medium-risk patches: ${colorize(String(safety.mediumRiskPatches), "yellow")}`);
  console.log(`low-risk patches: ${colorize(String(safety.lowRiskPatches), "green")}`);
  console.log(`Average risk score: ${safety.averageRiskScore.toFixed(2)}/10`);

  if (verbosity >= 2) {
    let patchesToShow = safety.highestRiskPatches;

    // Apply filters
    if (minRisk) {
      patchesToShow = filterPatchesByRisk(patchesToShow, minRisk);
    }

    // Apply sorting
    if (sortBy && (sortBy === "risk" || sortBy === "impact")) {
      patchesToShow = sortPatches(patchesToShow, sortBy as "risk" | "impact");
    }

    if (patchesToShow.length > 0) {
      const showCount = verbosity >= 3 ? patchesToShow.length : Math.min(10, patchesToShow.length);
      console.log(
        colorize(
          `\n${minRisk ? `Patches with ${minRisk}+ risk` : "Highest risk patches"} (top ${showCount}):`,
          "dim",
        ),
      );

      for (const patch of patchesToShow.slice(0, showCount)) {
        const riskColor = getRiskColor(patch.riskLevel);
        console.log(
          `  Patch ${patch.patchIndex} (${patch.operation}): ${colorize(patch.riskLevel.toUpperCase(), riskColor)} (score: ${patch.riskScore}/10)`,
        );
        console.log(`    Reason: ${patch.riskReason}`);
        console.log(
          `    Affected files: ${patch.affectedFiles}${patch.group ? ` [${patch.group}]` : ""}`,
        );
      }
    } else if (minRisk) {
      console.log(colorize(`\nNo patches found with ${minRisk}+ risk level`, "dim"));
    }
  }
}

/**
 * Output summary in text format
 */
function outputSummaryText(
  coverage: CoverageAnalysis,
  impact: ImpactAnalysis,
  complexity: ComplexityAnalysis,
  safety: SafetyAnalysis,
): void {
  console.log(colorize("\n=== Summary ===", "bold"));

  // Coverage status
  const coverageStatus =
    coverage.coveragePercentage >= 80
      ? colorize("GOOD", "green")
      : coverage.coveragePercentage >= 50
        ? colorize("FAIR", "yellow")
        : colorize("LOW", "red");
  console.log(`Coverage: ${coverageStatus} (${coverage.coveragePercentage.toFixed(1)}%)`);

  // Risk assessment
  const riskStatus =
    safety.highRiskPatches === 0
      ? colorize("LOW", "green")
      : safety.highRiskPatches <= 3
        ? colorize("MEDIUM", "yellow")
        : colorize("HIGH", "red");
  console.log(`Overall risk: ${riskStatus} (${safety.highRiskPatches} high-risk patches)`);

  // Complexity assessment
  const complexityStatus =
    complexity.averageComplexity <= 5
      ? colorize("LOW", "green")
      : complexity.averageComplexity <= 10
        ? colorize("MEDIUM", "yellow")
        : colorize("HIGH", "red");
  console.log(`Complexity: ${complexityStatus} (avg: ${complexity.averageComplexity.toFixed(2)})`);

  // Multi-patch files warning
  if (impact.multiPatchFiles.size > 0) {
    console.log(
      colorize(
        `\nWarning: ${impact.multiPatchFiles.size} file(s) have multiple patches - consider reviewing for conflicts`,
        "yellow",
      ),
    );
  }

  // Recommendations for high-risk patches
  if (safety.highRiskPatches > 0) {
    console.log(colorize("\n=== Recommendations ===", "bold"));
    console.log(
      `Found ${colorize(String(safety.highRiskPatches), "red")} high risk ${safety.highRiskPatches === 1 ? "patch" : "patches"}:`,
    );
    console.log("  - Review these patches carefully before applying");
    console.log("  - Consider testing in a safe environment first");
    console.log("  - Ensure you have backups of affected files");
  }
}

/**
 * Output complete analysis in text format
 */
function outputText(result: AnalyzeResult, options: CLIOptions): void {
  // Quiet mode (-q): only show summary
  if (options.verbosity === 0) {
    outputSummaryText(result.coverage, result.impact, result.complexity, result.safety);
    return;
  }

  outputCoverageText(result.coverage, options.verbosity);
  outputImpactText(result.impact, options.verbosity);
  outputComplexityText(result.complexity, options.verbosity);
  outputSafetyText(
    result.safety,
    options.verbosity,
    options.minRisk as RiskLevel | undefined,
    options.sort,
  );
  outputSummaryText(result.coverage, result.impact, result.complexity, result.safety);
  console.log(); // Final newline
}

/**
 * Sort files by patch count (for coverage sorting)
 */
function sortFilesByPatchCount(files: FileComplexity[]): FileComplexity[] {
  return [...files].sort((a, b) => b.patchCount - a.patchCount);
}

/**
 * Prepare and output complete analysis in JSON format
 */
function outputJson(result: AnalyzeResult, options: CLIOptions): void {
  let output = result;

  // Apply filters if specified
  if (options.minRisk) {
    output = {
      ...result,
      safety: {
        ...result.safety,
        patches: filterPatchesByRisk(result.safety.patches, options.minRisk as RiskLevel),
        highestRiskPatches: filterPatchesByRisk(
          result.safety.highestRiskPatches,
          options.minRisk as RiskLevel,
        ),
      },
    };
  }

  // Apply sorting if specified
  if (options.sort) {
    if (options.sort === "risk") {
      output = {
        ...output,
        safety: {
          ...output.safety,
          patches: sortPatches(output.safety.patches, options.sort),
          highestRiskPatches: sortPatches(output.safety.highestRiskPatches, options.sort),
        },
      };
    } else if (options.sort === "impact") {
      // Sort patches by affected files count
      output = {
        ...output,
        impact: {
          ...output.impact,
          patches: [...output.impact.patches].sort((a, b) => b.affectedFiles - a.affectedFiles),
        },
        safety: {
          ...output.safety,
          patches: sortPatches(output.safety.patches, options.sort),
          highestRiskPatches: sortPatches(output.safety.highestRiskPatches, options.sort),
        },
      };
    } else if (options.sort === "complexity") {
      output = {
        ...output,
        complexity: {
          ...output.complexity,
          files: sortFilesByComplexity(output.complexity.files),
          topComplexFiles: sortFilesByComplexity(output.complexity.topComplexFiles),
        },
      };
    } else if (options.sort === "coverage") {
      output = {
        ...output,
        complexity: {
          ...output.complexity,
          files: sortFilesByPatchCount(output.complexity.files),
          topComplexFiles: sortFilesByPatchCount(output.complexity.topComplexFiles),
        },
      };
    }
  }

  // Convert Map to object for JSON serialization
  const jsonOutput = {
    ...output,
    impact: {
      ...output.impact,
      multiPatchFiles: Object.fromEntries(output.impact.multiPatchFiles),
    },
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(jsonOutput, null, 2));
}

/**
 * Output error in appropriate format
 */
function outputError(error: string, options: CLIOptions): void {
  if (options.format === "json") {
    const errorResult: AnalyzeResult = {
      success: false,
      coverage: {
        totalFiles: 0,
        filesWithPatches: 0,
        filesWithoutPatches: 0,
        coveragePercentage: 0,
        unpatchedFiles: [],
        patchedFiles: [],
      },
      impact: {
        totalPatches: 0,
        totalAffectedFiles: 0,
        patches: [],
        multiPatchFiles: new Map(),
      },
      complexity: {
        totalFiles: 0,
        averageComplexity: 0,
        maxComplexity: 0,
        minComplexity: 0,
        files: [],
        topComplexFiles: [],
      },
      safety: {
        totalPatches: 0,
        highRiskPatches: 0,
        mediumRiskPatches: 0,
        lowRiskPatches: 0,
        averageRiskScore: 0,
        patches: [],
        highestRiskPatches: [],
      },
      error,
    };
    // Convert Map to object for JSON serialization
    const jsonOutput = {
      ...errorResult,
      impact: {
        ...errorResult.impact,
        multiPatchFiles: Object.fromEntries(errorResult.impact.multiPatchFiles),
      },
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    console.error(colorize(`Error: ${error}`, "red"));
  }
}

// ============================================================================
// Main Command Function
// ============================================================================

/**
 * Main analyze command implementation
 * Analyzes patch configuration for coverage, impact, complexity, and safety
 */
export async function analyzeCommand(configPath: string, options: CLIOptions): Promise<number> {
  // Validate options FIRST before any other operations
  if (options.minRisk && !["low", "medium", "high"].includes(options.minRisk)) {
    const errorMsg = `Invalid risk level: ${options.minRisk}. Must be one of: low, medium, high`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  if (options.sort && !["risk", "complexity", "impact", "coverage"].includes(options.sort)) {
    const errorMsg = `Invalid sort option: ${options.sort}. Must be one of: risk, complexity, impact, coverage`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const inputPath = resolve(configPath);

    // Determine the actual config file path
    let actualConfigPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      actualConfigPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(actualConfigPath);

    // Load config
    if (options.verbosity >= 2) {
      console.error(`Loading config from ${actualConfigPath}...`);
    }

    if (!existsSync(actualConfigPath)) {
      throw new Error(`Config file not found: ${actualConfigPath}`);
    }

    const configContent = readFileSync(actualConfigPath, "utf-8");
    const config: KustomarkConfig = parseConfig(configContent);

    // Load lock file if it exists
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    try {
      lockFile = loadLockFile(actualConfigPath);
    } catch {
      // Lock file is optional for analysis
    }

    // Scan directory to build file map
    if (options.verbosity >= 2) {
      console.error("Scanning directory for markdown files...");
    }

    const fileMap = new Map<string, string>();
    const normalizedBasePath = normalize(basePath);
    const scanRoot = dirname(normalizedBasePath);

    function scanDirectory(dir: string): void {
      if (!existsSync(dir)) {
        return;
      }

      let entries: Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch (_error) {
        // Skip directories we can't read (permission denied, etc.)
        return;
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, .git, and other common directories
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "output") {
            continue;
          }
          // Recursively scan subdirectories
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Include markdown files and kustomark config files
          if (
            entry.name.endsWith(".md") ||
            entry.name === "kustomark.yaml" ||
            entry.name === "kustomark.yml"
          ) {
            try {
              const content = readFileSync(fullPath, "utf-8");
              const normalizedPath = normalize(fullPath);
              fileMap.set(normalizedPath, content);
            } catch (error) {
              // Skip files we can't read
              if (options.verbosity >= 2) {
                console.warn(
                  `Warning: Could not read file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          }
        }
      }
    }

    scanDirectory(scanRoot);

    if (options.verbosity >= 2) {
      console.error(`Scanned ${fileMap.size} file(s)`);
    }

    // Resolve resources
    if (options.verbosity >= 2) {
      console.error("Resolving resources...");
    }

    const resolvedResources = await resolveResources(config.resources, basePath, fileMap, {
      lockFile: lockFile ?? undefined,
      updateLock: false,
      lockEntries,
    });

    if (resolvedResources.length === 0) {
      throw new Error("No resources found to analyze");
    }

    if (options.verbosity >= 2) {
      console.error(`Resolved ${resolvedResources.length} resource(s)`);
    }

    // Build file set for analytics (convert to relative paths)
    const files = new Set<string>();
    for (const resource of resolvedResources) {
      const relativePath = relative(basePath, resource.path);
      files.add(relativePath);
    }

    // Run all analytics functions
    if (options.verbosity >= 2) {
      console.error("Running analytics...");
    }

    const patches = config.patches ?? [];
    const coverage = analyzePatchCoverage(files, patches);
    const impact = analyzePatchImpact(files, patches);
    const complexity = analyzeFileComplexity(files, patches);
    const safety = analyzePatchSafety(files, patches);

    const result: AnalyzeResult = {
      success: true,
      coverage,
      impact,
      complexity,
      safety,
    };

    // Output results
    if (options.format === "json") {
      outputJson(result, options);
    } else {
      outputText(result, options);
    }

    return 0; // Success
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputError(errorMessage, options);
    throw error; // Re-throw to set exit code
  }
}
