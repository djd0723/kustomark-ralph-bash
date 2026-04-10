/**
 * CLI command for suggesting patches based on differences between source and target files
 * Analyzes differences and generates kustomark.yaml configuration with suggested patches
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import * as yaml from "js-yaml";
import type { ScoredPatch } from "../core/patch-suggester.js";
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
  scoredPatches: ScoredPatch[];
  stats: {
    filesAnalyzed: number;
    filesDeleted: number;
    filesRenamed: number;
    filesMoved: number;
    filesCopied: number;
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

interface MatchResult {
  pairs: FilePair[];
  sourceOnlyPaths: string[];
  targetOnlyPaths: string[];
}

/**
 * Match files between source and target directories by relative path.
 * Returns matched pairs and paths of files that exist only in source
 * (candidates for delete-file patches).
 */
function matchFiles(sourcePath: string, targetPath: string): MatchResult {
  const pairs: FilePair[] = [];
  const sourceOnlyPaths: string[] = [];
  const targetOnlyPaths: string[] = [];

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

    // Build maps of relative paths for both sides
    const sourceMap = new Map<string, string>();
    for (const sourceFile of sourceFiles) {
      sourceMap.set(relative(sourcePath, sourceFile), sourceFile);
    }

    const targetMap = new Map<string, string>();
    for (const targetFile of targetFiles) {
      targetMap.set(relative(targetPath, targetFile), targetFile);
    }

    // Match source files with target files; track source-only files
    for (const [relPath, sourceFile] of sourceMap) {
      const matchingTarget = targetMap.get(relPath);
      if (matchingTarget) {
        pairs.push({ relativePath: relPath, sourcePath: sourceFile, targetPath: matchingTarget });
      } else {
        sourceOnlyPaths.push(relPath);
      }
    }

    // Track target-only files (present in target but not source)
    for (const relPath of targetMap.keys()) {
      if (!sourceMap.has(relPath)) {
        targetOnlyPaths.push(relPath);
      }
    }
  } else {
    throw new Error("Source and target must both be files or both be directories");
  }

  return { pairs, sourceOnlyPaths, targetOnlyPaths };
}

// ============================================================================
// File Operation Detection
// ============================================================================

/**
 * Read file content safely, returning null on error or empty content
 */
function readFileSafe(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.trim() ? content : null;
  } catch {
    return null;
  }
}

interface FileOpResult {
  fileOps: PatchOperation[];
  scoredFileOps: ScoredPatch[];
  /** Source-only paths not claimed by a rename/move — should become delete-file patches */
  remainingSourceOnly: string[];
  filesRenamed: number;
  filesMoved: number;
  filesCopied: number;
}

/**
 * Detect rename-file, move-file, and copy-file patches by comparing file contents
 * across source-only, target-only, and paired file sets.
 *
 * rename-file: source-only + target-only, same content, same parent dir, different basename
 * move-file:   source-only + target-only, same content, same basename, different parent dir
 * copy-file:   unchanged paired source file + target-only with same content
 */
function detectFileOperationPatches(
  sourcePath: string,
  targetPath: string,
  sourceOnlyPaths: string[],
  targetOnlyPaths: string[],
  pairs: FilePair[],
): FileOpResult {
  const fileOps: PatchOperation[] = [];
  const scoredFileOps: ScoredPatch[] = [];
  const claimedSourceOnly = new Set<string>();
  const claimedTargetOnly = new Set<string>();
  let filesRenamed = 0;
  let filesMoved = 0;
  let filesCopied = 0;

  // Read source-only file contents
  const sourceOnlyContents = new Map<string, string>();
  for (const relPath of sourceOnlyPaths) {
    const content = readFileSafe(join(sourcePath, relPath));
    if (content) sourceOnlyContents.set(relPath, content);
  }

  // Read target-only file contents
  const targetOnlyContents = new Map<string, string>();
  for (const relPath of targetOnlyPaths) {
    const content = readFileSafe(join(targetPath, relPath));
    if (content) targetOnlyContents.set(relPath, content);
  }

  // Build reverse maps: content → list of paths (for ambiguity detection)
  const contentToSourceOnly = new Map<string, string[]>();
  for (const [relPath, content] of sourceOnlyContents) {
    const existing = contentToSourceOnly.get(content) ?? [];
    existing.push(relPath);
    contentToSourceOnly.set(content, existing);
  }

  const contentToTargetOnly = new Map<string, string[]>();
  for (const [relPath, content] of targetOnlyContents) {
    const existing = contentToTargetOnly.get(content) ?? [];
    existing.push(relPath);
    contentToTargetOnly.set(content, existing);
  }

  // Detect rename-file and move-file: match source-only ↔ target-only by content
  for (const [srcRelPath, srcContent] of sourceOnlyContents) {
    const matchingTargetPaths = contentToTargetOnly.get(srcContent) ?? [];
    const matchingSourcePaths = contentToSourceOnly.get(srcContent) ?? [];

    // Only process unambiguous 1:1 content matches
    if (matchingTargetPaths.length !== 1 || matchingSourcePaths.length !== 1) continue;

    // biome-ignore lint/style/noNonNullAssertion: length === 1 is verified above
    const tgtRelPath = matchingTargetPaths[0]!;
    if (claimedTargetOnly.has(tgtRelPath)) continue;

    const srcBase = basename(srcRelPath);
    const tgtBase = basename(tgtRelPath);
    const srcDir = dirname(srcRelPath) === "." ? "" : dirname(srcRelPath);
    const tgtDir = dirname(tgtRelPath) === "." ? "" : dirname(tgtRelPath);

    if (srcBase !== tgtBase && srcDir === tgtDir) {
      // Different basename, same directory → rename-file
      const patch: PatchOperation = { op: "rename-file", match: srcRelPath, rename: tgtBase };
      fileOps.push(patch);
      const [scored] = scorePatches([patch], "", "");
      if (scored) scoredFileOps.push(scored);
      claimedSourceOnly.add(srcRelPath);
      claimedTargetOnly.add(tgtRelPath);
      filesRenamed++;
    } else if (srcBase === tgtBase && srcDir !== tgtDir) {
      // Same basename, different directory → move-file
      const destDir = tgtDir === "" ? "./" : `${tgtDir}/`;
      const patch: PatchOperation = { op: "move-file", match: srcRelPath, dest: destDir };
      fileOps.push(patch);
      const [scored] = scorePatches([patch], "", "");
      if (scored) scoredFileOps.push(scored);
      claimedSourceOnly.add(srcRelPath);
      claimedTargetOnly.add(tgtRelPath);
      filesMoved++;
    }
    // Both name and dir differ → ambiguous, skip
  }

  // Detect copy-file: paired source file (unchanged) + target-only with same content
  for (const pair of pairs) {
    const srcContent = readFileSafe(pair.sourcePath);
    const tgtContent = readFileSafe(pair.targetPath);
    // Only suggest copy-file when the source file is unchanged in the target
    if (!srcContent || srcContent !== tgtContent) continue;

    const matchingTargetOnly = (contentToTargetOnly.get(srcContent) ?? []).filter(
      (p) => !claimedTargetOnly.has(p),
    );

    for (const tgtRelPath of matchingTargetOnly) {
      const patch: PatchOperation = {
        op: "copy-file",
        src: pair.relativePath,
        dest: tgtRelPath,
      };
      fileOps.push(patch);
      const [scored] = scorePatches([patch], "", "");
      if (scored) scoredFileOps.push(scored);
      claimedTargetOnly.add(tgtRelPath);
      filesCopied++;
    }
  }

  const remainingSourceOnly = sourceOnlyPaths.filter((p) => !claimedSourceOnly.has(p));

  return { fileOps, scoredFileOps, remainingSourceOnly, filesRenamed, filesMoved, filesCopied };
}

// ============================================================================
// Patch Analysis Functions
// ============================================================================

/**
 * Analyze file pairs and generate suggested patches with confidence scores
 */
function analyzeFilePairs(
  pairs: FilePair[],
  options: CLIOptions,
): { patches: PatchOperation[]; scoredPatches: ScoredPatch[]; filesAnalyzed: number } {
  const allPatches: PatchOperation[] = [];
  const allScored: ScoredPatch[] = [];
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
      const rawPatches = suggestPatches(sourceContent, targetContent);

      // Always score patches for confidence tracking
      let scored = scorePatches(rawPatches, sourceContent, targetContent);

      // Filter by minimum confidence if specified
      if (options.minConfidence !== undefined && options.minConfidence > 0) {
        const minConf = options.minConfidence;
        const filteredCount = scored.filter((sp) => sp.score < minConf).length;
        scored = scored.filter((sp) => sp.score >= minConf);

        if (options.verbosity && options.verbosity >= 2 && filteredCount > 0) {
          console.error(
            `  Filtered ${filteredCount} low-confidence patches from ${pair.relativePath}`,
          );
        }
      }

      const patches = scored.map((sp) => sp.patch);

      // Add include pattern if we have multiple files
      if (pairs.length > 1 && pair.relativePath !== ".") {
        for (const patch of patches) {
          patch.include = pair.relativePath;
        }
      }

      allPatches.push(...patches);
      allScored.push(...scored);
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

  return { patches: allPatches, scoredPatches: allScored, filesAnalyzed };
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

  if (options.verbosity && options.verbosity >= 2 && result.scoredPatches.length > 0) {
    console.log("\nPatch confidence scores:");
    for (const sp of result.scoredPatches) {
      const pct = Math.round(sp.score * 100);
      console.log(`  [${pct}%] ${sp.description}`);
    }
  }

  if (options.verbosity && options.verbosity >= 1) {
    console.log("\nStatistics:");
    console.log(`  Files analyzed: ${result.stats.filesAnalyzed}`);
    if (result.stats.filesDeleted > 0) {
      console.log(`  Files deleted (source-only): ${result.stats.filesDeleted}`);
    }
    if (result.stats.filesRenamed > 0) {
      console.log(`  Files renamed: ${result.stats.filesRenamed}`);
    }
    if (result.stats.filesMoved > 0) {
      console.log(`  Files moved: ${result.stats.filesMoved}`);
    }
    if (result.stats.filesCopied > 0) {
      console.log(`  Files copied: ${result.stats.filesCopied}`);
    }
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

    const {
      pairs: filePairs,
      sourceOnlyPaths,
      targetOnlyPaths,
    } = matchFiles(sourcePath, targetPath);

    if (filePairs.length === 0 && sourceOnlyPaths.length === 0) {
      throw new Error("No matching files found between source and target");
    }

    if (verbosity >= 2) {
      console.log(`Found ${filePairs.length} file pair(s) to analyze\n`);
      if (sourceOnlyPaths.length > 0) {
        console.log(`Found ${sourceOnlyPaths.length} file(s) only in source\n`);
      }
      if (targetOnlyPaths.length > 0) {
        console.log(`Found ${targetOnlyPaths.length} file(s) only in target\n`);
      }
    }

    // Detect rename-file, move-file, copy-file patches via content comparison
    const fileOpResult = detectFileOperationPatches(
      sourcePath,
      targetPath,
      sourceOnlyPaths,
      targetOnlyPaths,
      filePairs,
    );

    // Analyze content-differing file pairs and generate patches
    const { patches, scoredPatches, filesAnalyzed } = analyzeFilePairs(filePairs, opts);

    // Add file operation patches (rename, move, copy)
    patches.push(...fileOpResult.fileOps);
    scoredPatches.push(...fileOpResult.scoredFileOps);

    // Generate delete-file patches for source-only files not claimed by a rename/move
    for (const relPath of fileOpResult.remainingSourceOnly) {
      const deletePatch = { op: "delete-file" as const, match: relPath };
      patches.push(deletePatch);
      const [scored] = scorePatches([deletePatch], "", "");
      if (scored) scoredPatches.push(scored);
    }

    // Generate configuration
    const config = generateConfig(sourcePath, patches);

    // Calculate confidence
    const confidence = calculateConfidence(patches);

    const result: SuggestResult = {
      config,
      scoredPatches,
      stats: {
        filesAnalyzed,
        filesDeleted: fileOpResult.remainingSourceOnly.length,
        filesRenamed: fileOpResult.filesRenamed,
        filesMoved: fileOpResult.filesMoved,
        filesCopied: fileOpResult.filesCopied,
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
