/**
 * CLI command for suggesting patches based on differences between source and target files
 * Analyzes differences and generates kustomark.yaml configuration with suggested patches
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as yaml from "js-yaml";
import { scorePatches, suggestPatches } from "../core/patch-suggester.js";
import type { KustomarkConfig, PatchOperation } from "../core/types.js";
import { createProgressReporter } from "./progress.js";

// ============================================================================
// Types
// ============================================================================

// CLI Options type for suggest command
interface CLIOptions {
  source?: string;
  target?: string;
  format?: "text" | "json";
  verbosity?: number;
  output?: string;
  minConfidence?: number;
}

export interface SuggestResult {
  config: KustomarkConfig;
  stats: {
    filesAnalyzed: number;
    patchesGenerated: number;
    confidence: "high" | "medium" | "low";
  };
}

export interface SuggestError {
  error: string;
}

interface FilePair {
  relativePath: string;
  sourcePath: string;
  targetPath: string;
}

// Patch suggestion is provided by the imported suggestPatches function from patch-suggester.ts

// ============================================================================
// File Discovery Functions
// ============================================================================

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip common directories
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "output") {
        continue;
      }
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Match files between source and target directories by relative path
 */
function matchFiles(sourcePath: string, targetPath: string): FilePair[] {
  const pairs: FilePair[] = [];

  const sourceIsDir = statSync(sourcePath).isDirectory();
  const targetIsDir = statSync(targetPath).isDirectory();

  if (!sourceIsDir && !targetIsDir) {
    // Both are files
    pairs.push({
      relativePath: ".",
      sourcePath,
      targetPath,
    });
  } else if (sourceIsDir && targetIsDir) {
    // Both are directories - match files by relative path
    const sourceFiles = findMarkdownFiles(sourcePath);
    const targetFiles = findMarkdownFiles(targetPath);

    // Build a map of relative paths to target files
    const targetMap = new Map<string, string>();
    for (const targetFile of targetFiles) {
      const relPath = relative(targetPath, targetFile);
      targetMap.set(relPath, targetFile);
    }

    // Match source files with target files
    for (const sourceFile of sourceFiles) {
      const relPath = relative(sourcePath, sourceFile);
      const matchingTarget = targetMap.get(relPath);

      if (matchingTarget) {
        pairs.push({
          relativePath: relPath,
          sourcePath: sourceFile,
          targetPath: matchingTarget,
        });
      }
    }
  } else {
    throw new Error("Source and target must both be files or both be directories");
  }

  return pairs;
}

// ============================================================================
// Patch Analysis Functions
// ============================================================================

/**
 * Analyze file pairs and generate suggested patches
 */
function analyzeFilePairs(
  pairs: FilePair[],
  options: CLIOptions,
): { patches: PatchOperation[]; filesAnalyzed: number } {
  const allPatches: PatchOperation[] = [];
  let filesAnalyzed = 0;

  const reporter = createProgressReporter({
    progress: true,
    verbosity: options.verbosity,
    format: options.format,
  });

  reporter.start(pairs.length, "Analyzing file differences");

  for (const pair of pairs) {
    try {
      const sourceContent = readFileSync(pair.sourcePath, "utf-8");
      const targetContent = readFileSync(pair.targetPath, "utf-8");

      // Skip if files are identical
      if (sourceContent === targetContent) {
        reporter.increment(1, `Skipped: ${pair.relativePath} (identical)`);
        continue;
      }

      // Suggest patches for this file pair
      let patches = suggestPatches(sourceContent, targetContent);

      // Filter by minimum confidence if specified
      if (options.minConfidence !== undefined && options.minConfidence > 0) {
        const minConf = options.minConfidence; // Store in const to satisfy TypeScript
        const scoredPatches = scorePatches(patches, sourceContent, targetContent);
        const filteredPatches = scoredPatches
          .filter((sp) => sp.score >= minConf)
          .map((sp) => sp.patch);

        const filteredCount = patches.length - filteredPatches.length;
        patches = filteredPatches;

        if (options.verbosity && options.verbosity >= 2 && filteredCount > 0) {
          console.error(
            `  Filtered ${filteredCount} low-confidence patches from ${pair.relativePath}`,
          );
        }
      }

      // Add include pattern if we have multiple files
      if (pairs.length > 1 && pair.relativePath !== ".") {
        for (const patch of patches) {
          patch.include = pair.relativePath;
        }
      }

      allPatches.push(...patches);
      filesAnalyzed++;

      reporter.increment(1, `Analyzed: ${pair.relativePath} (${patches.length} patches)`);
    } catch (error) {
      reporter.increment(1, `Error: ${pair.relativePath}`);
      if (options.verbosity && options.verbosity >= 2) {
        console.error(`  Failed to analyze ${pair.relativePath}: ${error}`);
      }
    }
  }

  reporter.finish("Analysis complete");

  return { patches: allPatches, filesAnalyzed };
}

/**
 * Calculate confidence level based on patch characteristics
 */
function calculateConfidence(patches: PatchOperation[]): "high" | "medium" | "low" {
  if (patches.length === 0) {
    return "low";
  }

  // Simple heuristic: fewer, simpler patches = higher confidence
  const avgPatchComplexity =
    patches.reduce((sum, patch) => {
      let complexity = 1;
      if (patch.op === "replace-regex") complexity = 3;
      if (patch.op.includes("section")) complexity = 2;
      if (patch.op.includes("frontmatter")) complexity = 2;
      return sum + complexity;
    }, 0) / patches.length;

  if (avgPatchComplexity <= 1.5 && patches.length <= 10) {
    return "high";
  }
  if (avgPatchComplexity <= 2.5) {
    return "medium";
  }
  return "low";
}

// ============================================================================
// Config Generation Functions
// ============================================================================

/**
 * Generate a complete kustomark.yaml configuration
 */
function generateConfig(sourcePath: string, patches: PatchOperation[]): KustomarkConfig {
  const config: KustomarkConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    output: "./output",
    resources: [sourcePath],
    patches,
  };

  // Set onNoMatch strategy if we have patches
  if (patches.length > 0) {
    config.onNoMatch = "warn";
  }

  return config;
}

/**
 * Serialize config to YAML string
 */
function serializeConfig(config: KustomarkConfig): string {
  return yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

// ============================================================================
// Output Functions
// ============================================================================

/**
 * Output results in text format
 */
function outputText(result: SuggestResult, options: CLIOptions): void {
  const configYaml = serializeConfig(result.config);

  console.log("Analyzing differences between source and target...\n");
  console.log(`Found ${result.stats.patchesGenerated} suggested patches:\n`);
  console.log("# Suggested kustomark.yaml\n");
  console.log(configYaml);

  if (options.verbosity && options.verbosity >= 1) {
    console.log("\nStatistics:");
    console.log(`  Files analyzed: ${result.stats.filesAnalyzed}`);
    console.log(`  Patches generated: ${result.stats.patchesGenerated}`);
    console.log(`  Confidence: ${result.stats.confidence}`);
  }

  if (options.output) {
    console.log(`\nConfiguration written to: ${options.output}`);
  }
}

/**
 * Output results in JSON format
 */
function outputJson(result: SuggestResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Output error in appropriate format
 */
function outputError(error: string, options: CLIOptions): void {
  if (options.format === "json") {
    const errorResult: SuggestError = { error };
    console.log(JSON.stringify(errorResult, null, 2));
  } else {
    console.error(`Error: ${error}`);
  }
}

// ============================================================================
// Main Command Function
// ============================================================================

/**
 * Main suggest command implementation
 * Analyzes differences between source and target and generates suggested patches
 */
export async function suggestCommand(options: CLIOptions): Promise<number> {
  try {
    // Validate options
    if (!options.source) {
      throw new Error("Source path is required (--source)");
    }

    if (!options.target) {
      throw new Error("Target path is required (--target)");
    }

    // Resolve paths
    const sourcePath = resolve(options.source);
    const targetPath = resolve(options.target);

    // Verify paths exist
    if (!existsSync(sourcePath)) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    if (!existsSync(targetPath)) {
      throw new Error(`Target path does not exist: ${targetPath}`);
    }

    // Set defaults
    const format = options.format || "text";
    const verbosity = options.verbosity ?? 1;

    const opts: CLIOptions = {
      ...options,
      format,
      verbosity,
    };

    // Match files between source and target
    if (verbosity >= 2) {
      console.log(`Source: ${sourcePath}`);
      console.log(`Target: ${targetPath}`);
      console.log("Matching files...\n");
    }

    const filePairs = matchFiles(sourcePath, targetPath);

    if (filePairs.length === 0) {
      throw new Error("No matching files found between source and target");
    }

    if (verbosity >= 2) {
      console.log(`Found ${filePairs.length} file pair(s) to analyze\n`);
    }

    // Analyze files and generate patches
    const { patches, filesAnalyzed } = analyzeFilePairs(filePairs, opts);

    // Generate configuration
    const config = generateConfig(sourcePath, patches);

    // Calculate confidence
    const confidence = calculateConfidence(patches);

    const result: SuggestResult = {
      config,
      stats: {
        filesAnalyzed,
        patchesGenerated: patches.length,
        confidence,
      },
    };

    // Write to output file if specified
    if (options.output) {
      const configYaml = serializeConfig(config);
      writeFileSync(options.output, configYaml, "utf-8");
    }

    // Output results
    if (format === "json") {
      outputJson(result);
    } else {
      outputText(result, opts);
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputError(errorMessage, options);
    return 1;
  }
}
