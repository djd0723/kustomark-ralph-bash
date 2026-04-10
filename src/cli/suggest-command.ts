/**
 * CLI command for suggesting patches based on differences between source and target files
 * Analyzes differences and generates kustomark.yaml configuration with suggested patches
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import * as yaml from "js-yaml";
import micromatch from "micromatch";
import { parseConfig } from "../core/config-parser.js";
import { applyPatches } from "../core/patch-engine.js";
import type { ScoredPatch } from "../core/patch-suggester.js";
import { scorePatches, suggestJsonPatches, suggestPatches } from "../core/patch-suggester.js";
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
  verify?: boolean;
  write?: string;
  apply?: string;
  interactive?: boolean;
}

export interface VerificationFileResult {
  /** Relative path of the file */
  file: string;
  /** Whether the patches reproduced the target exactly */
  reproduced: boolean;
  /** Similarity score (0–1): fraction of target lines that match */
  similarity: number;
  /** Lines in the target not present in the patched output */
  unmatchedLines: number;
}

export interface VerificationSummary {
  /** Total file pairs checked */
  filesChecked: number;
  /** Files where patches exactly reproduced the target */
  exactMatches: number;
  /** Files where patches partially reproduced the target (similarity > 0 but < 1) */
  partialMatches: number;
  /** Files where patches produced no useful change toward the target */
  notReproduced: number;
  /** Per-file results */
  results: VerificationFileResult[];
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
    patchesConsolidated: number;
    confidence: "high" | "medium" | "low";
    /** Number of files written to output dir when --apply is used */
    filesApplied?: number;
    /** Number of patches approved in interactive session */
    patchesApproved?: number;
  };
  /** Present when --verify flag is used */
  verification?: VerificationSummary;
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

const SUPPORTED_EXTENSIONS = new Set([".md", ".json", ".yaml", ".yml", ".toml"]);

function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Recursively find all supported files (markdown, JSON, YAML) in a directory
 */
function findSupportedFiles(dir: string): string[] {
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
      files.push(...findSupportedFiles(fullPath));
    } else if (entry.isFile() && isSupportedFile(entry.name)) {
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
    const sourceFiles = findSupportedFiles(sourcePath);
    const targetFiles = findSupportedFiles(targetPath);

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
// Cross-File Patch Consolidation
// ============================================================================

/**
 * File operations that target a specific file and must NOT be consolidated
 * across multiple files (their `match`/`src`/`dest` fields are file-specific).
 */
const NON_CONSOLIDATABLE_OPS = new Set(["copy-file", "rename-file", "move-file", "delete-file"]);

/**
 * Returns a stable JSON identity key for a patch, excluding the `include` field.
 * Two patches with the same key but different `include` values are candidates
 * for consolidation.
 */
function patchIdentityKey(patch: PatchOperation): string {
  const { include: _include, ...rest } = patch as PatchOperation & { include?: unknown };
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(rest).sort()) {
    sorted[k] = (rest as Record<string, unknown>)[k];
  }
  return JSON.stringify(sorted);
}

/**
 * Computes the most specific glob pattern that covers all provided relative paths.
 *
 * Rules:
 * - All files in the same directory with same extension → `dir/*.ext`
 * - All files under a common ancestor with same extension → `prefix/**\/*.ext`
 * - Mixed extensions → strip the extension part (`dir/*` or `**\/*`)
 */
export function computeMinimalGlob(paths: string[]): string {
  if (paths.length === 0) return "**/*";

  const dirs = paths.map((p) => (dirname(p) === "." ? "" : dirname(p)));
  const exts = paths.map((p) => extname(p).toLowerCase());

  const allSameExt = exts.every((e) => e === exts[0]);
  const ext = allSameExt ? (exts[0] ?? "") : "";

  // Find the longest common directory prefix segment-by-segment
  const splitDirs = dirs.map((d) => (d === "" ? [] : d.split("/")));
  const commonParts: string[] = [];
  const minLen = Math.min(...splitDirs.map((d) => d.length));
  for (let i = 0; i < minLen; i++) {
    const seg = splitDirs[0]?.[i];
    if (seg !== undefined && splitDirs.every((d) => d[i] === seg)) {
      commonParts.push(seg);
    } else {
      break;
    }
  }
  const commonDir = commonParts.join("/");
  const prefix = commonDir ? `${commonDir}/` : "";

  // Determine whether all files sit directly in commonDir or in sub-directories
  const allDirect = dirs.every((d) => d === commonDir);

  if (allDirect) {
    return ext ? `${prefix}*${ext}` : `${prefix}*`;
  }
  return ext ? `${prefix}**/*${ext}` : `${prefix}**/*`;
}

/**
 * Consolidates identical patches that span multiple files into a single patch
 * with a broader glob `include` pattern.
 *
 * Example: three files each producing `{ op: "replace", old: "Acme", new: "Corp" }`
 * with per-file `include` fields become one patch with `include: "**\/*.md"`.
 *
 * File-operation patches (delete-file, rename-file, move-file, copy-file) are
 * never consolidated — they carry file-specific paths in their fields.
 *
 * @returns New arrays with consolidated patches and their corresponding scored entries.
 */
export function consolidatePatches(
  patches: PatchOperation[],
  scored: ScoredPatch[],
): { patches: PatchOperation[]; scoredPatches: ScoredPatch[]; patchesConsolidated: number } {
  if (patches.length === 0) {
    return { patches: [], scoredPatches: [], patchesConsolidated: 0 };
  }

  type Entry = { patch: PatchOperation; sp: ScoredPatch; includeStr: string | undefined };

  const groups = new Map<string, Entry[]>();

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i] as PatchOperation;
    const sp = (scored[i] ?? { patch, score: 0.5, description: "" }) as ScoredPatch;
    const rawInclude = (patch as PatchOperation & { include?: string | string[] }).include;
    const includeStr = Array.isArray(rawInclude) ? rawInclude.join(",") : rawInclude;

    // Non-consolidatable ops go in their own unique group (never merged)
    if (NON_CONSOLIDATABLE_OPS.has(patch.op)) {
      const key = `__file_op__:${i}`;
      groups.set(key, [{ patch, sp, includeStr }]);
      continue;
    }

    const key = patchIdentityKey(patch);
    const group = groups.get(key) ?? [];
    group.push({ patch, sp, includeStr });
    groups.set(key, group);
  }

  const outPatches: PatchOperation[] = [];
  const outScored: ScoredPatch[] = [];
  let patchesConsolidated = 0;

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;

    if (group.length === 1) {
      outPatches.push(first.patch);
      outScored.push(first.sp);
      continue;
    }

    // Multiple entries with the same content — consolidate
    const includeStrings = group
      .map((e) => e.includeStr)
      .filter((s): s is string => typeof s === "string");

    const { patch, sp } = first;
    const consolidated = { ...patch } as PatchOperation & { include?: string };

    if (includeStrings.length === group.length) {
      // Every entry had an individual include path — replace with glob
      consolidated.include = computeMinimalGlob(includeStrings);
    } else {
      // Some patches had no include (whole-directory match) — drop include
      delete consolidated.include;
    }

    // Use the maximum score from the group
    const maxScore = Math.max(...group.map((e) => e.sp.score));
    outPatches.push(consolidated);
    outScored.push({ patch: consolidated, score: maxScore, description: sp.description });
    patchesConsolidated += group.length - 1; // how many were merged away
  }

  return { patches: outPatches, scoredPatches: outScored, patchesConsolidated };
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

      // Suggest patches for this file pair — dispatch by extension
      const fileExt = extname(pair.sourcePath).toLowerCase();
      const isStructured =
        fileExt === ".json" || fileExt === ".yaml" || fileExt === ".yml" || fileExt === ".toml";
      const rawPatches = isStructured
        ? suggestJsonPatches(sourceContent, targetContent, fileExt)
        : suggestPatches(sourceContent, targetContent);

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
// Verification Functions
// ============================================================================

const FILE_OP_OPS = new Set(["copy-file", "rename-file", "delete-file", "move-file"]);

/**
 * Compute line-level similarity between two strings.
 * Returns a value in [0, 1] where 1 = identical.
 */
function computeSimilarity(actual: string, expected: string): number {
  if (actual === expected) return 1;
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  if (expectedLines.length === 0) return actual.length === 0 ? 1 : 0;

  const actualSet = new Set(actualLines);
  let matched = 0;
  for (const line of expectedLines) {
    if (actualSet.has(line)) matched++;
  }
  return matched / expectedLines.length;
}

/**
 * Apply content patches to source files and compare results with target files.
 * File-operation patches (rename, move, copy, delete) are excluded since they
 * operate on the file system rather than file content.
 */
export async function verifyPatches(
  pairs: FilePair[],
  patches: PatchOperation[],
): Promise<VerificationSummary> {
  const contentPatches = patches.filter((p) => !FILE_OP_OPS.has(p.op));

  const results: VerificationFileResult[] = [];
  let exactMatches = 0;
  let partialMatches = 0;
  let notReproduced = 0;

  for (const pair of pairs) {
    let sourceContent: string;
    let targetContent: string;
    try {
      sourceContent = readFileSync(pair.sourcePath, "utf-8");
      targetContent = readFileSync(pair.targetPath, "utf-8");
    } catch {
      continue;
    }

    // Select patches that apply to this file (respecting include patterns)
    const applicablePatches = contentPatches.filter((p) => {
      if (!p.include) return true;
      const patterns = Array.isArray(p.include) ? p.include : [p.include];
      return patterns.some((pat) => pair.relativePath === pat || pair.relativePath === ".");
    });

    // Apply patches to source content
    let patched: string;
    try {
      const patchResult = await applyPatches(sourceContent, applicablePatches);
      patched = patchResult.content;
    } catch {
      patched = sourceContent;
    }

    const reproduced = patched === targetContent;
    const similarity = reproduced ? 1 : computeSimilarity(patched, targetContent);
    const targetLines = targetContent.split("\n").length;
    const unmatchedLines = Math.round((1 - similarity) * targetLines);

    if (reproduced) {
      exactMatches++;
    } else if (similarity > 0) {
      partialMatches++;
    } else {
      notReproduced++;
    }

    results.push({
      file: pair.relativePath,
      reproduced,
      similarity,
      unmatchedLines,
    });
  }

  return {
    filesChecked: results.length,
    exactMatches,
    partialMatches,
    notReproduced,
    results,
  };
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

function writePatches(
  writePath: string,
  newPatches: PatchOperation[],
  sourcePath: string,
): "created" | "merged" {
  if (!existsSync(writePath)) {
    const config = generateConfig(sourcePath, newPatches);
    writeFileSync(writePath, serializeConfig(config), "utf-8");
    return "created";
  }
  const existingYaml = readFileSync(writePath, "utf-8");
  const existingConfig = parseConfig(existingYaml);
  const existingPatches: PatchOperation[] = existingConfig.patches ?? [];
  existingConfig.patches = [...existingPatches, ...newPatches];
  writeFileSync(writePath, serializeConfig(existingConfig), "utf-8");
  return "merged";
}

// ============================================================================
// Apply Function
// ============================================================================

/**
 * Apply the suggested patches to each source file and write results to outputDir.
 * Files that have no patches (identical to source) are still copied.
 * Returns the count of files written.
 */
export async function applyPatchesToDirectory(
  filePairs: FilePair[],
  patches: PatchOperation[],
  sourcePath: string,
  outputDir: string,
): Promise<number> {
  const resolvedOutput = resolve(outputDir);
  mkdirSync(resolvedOutput, { recursive: true });

  // Determine if sourcePath is a directory or single file
  const sourceIsDir = existsSync(sourcePath) && statSync(sourcePath).isDirectory();

  let filesWritten = 0;

  for (const pair of filePairs) {
    const sourceContent = readFileSafe(pair.sourcePath);
    if (sourceContent === null) continue;

    // Compute the relative path used for include/exclude matching and output placement.
    // For directory sources: relative path from sourcePath to the file.
    // For single-file sources: use the basename of the file.
    const relPath = sourceIsDir ? relative(sourcePath, pair.sourcePath) : basename(pair.sourcePath);

    const applicablePatches = patches.filter((p) => shouldApplyPatch(p, relPath));

    let resultContent = sourceContent;
    if (applicablePatches.length > 0) {
      const patchResult = await applyPatches(resultContent, applicablePatches);
      resultContent = patchResult.content;
    }

    const outPath = join(resolvedOutput, relPath);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, resultContent, "utf-8");
    filesWritten++;
  }

  return filesWritten;
}

// Determines whether a patch's include/exclude patterns match a given relative file path.
// Mirrors the logic used in the main build pipeline.
function shouldApplyPatch(patch: PatchOperation, relPath: string): boolean {
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    if (!micromatch.isMatch(relPath, includePatterns)) return false;
  }

  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    if (micromatch.isMatch(relPath, excludePatterns)) return false;
  }

  return true;
}

// ============================================================================
// Interactive Review
// ============================================================================

/**
 * Runs an interactive session for reviewing and approving suggested patches.
 *
 * Presents each scored patch to the user one-by-one. The user can:
 *   a / y  → approve the patch (include in output)
 *   s / n  → skip the patch (exclude from output)
 *   q      → quit and use patches approved so far
 *
 * Falls back silently (returns all patches) when stdin is not a TTY.
 *
 * @param scoredPatches - Patches sorted by score descending
 * @param stdin - Readable stream for user input (default: process.stdin)
 * @param stdout - Writable stream for output (default: process.stdout)
 * @returns Array of approved ScoredPatch entries
 */
export async function runInteractiveSession(
  scoredPatches: ScoredPatch[],
  stdin: NodeJS.ReadableStream = process.stdin,
  stdout: NodeJS.WritableStream = process.stdout,
): Promise<ScoredPatch[]> {
  // Non-TTY fallback — scripts / CI get all patches unchanged
  if (!(stdin as { isTTY?: boolean }).isTTY) {
    return [...scoredPatches];
  }

  if (scoredPatches.length === 0) {
    return [];
  }

  const rl = createInterface({ input: stdin, output: stdout });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  const approved: ScoredPatch[] = [];

  try {
    stdout.write(`\nInteractive patch review: ${scoredPatches.length} patch(es) to review\n`);
    stdout.write("Keys: [a]pprove  [s]kip  [q]uit\n");

    for (let i = 0; i < scoredPatches.length; i++) {
      const sp = scoredPatches[i];
      if (!sp) continue;

      const pct = Math.round(sp.score * 100);
      stdout.write(`\n${"─".repeat(60)}\n`);
      stdout.write(`Patch ${i + 1}/${scoredPatches.length}  [${pct}% confidence]\n`);
      stdout.write(`  ${sp.description}\n`);
      stdout.write(`  op: ${sp.patch.op}\n`);
      if ("include" in sp.patch && sp.patch.include) {
        stdout.write(`  include: ${sp.patch.include}\n`);
      }

      const answer = await question("  → [a]pprove / [s]kip / [q]uit: ");
      const key = answer.trim().toLowerCase();

      if (key === "q") {
        stdout.write("\nStopping review — using patches approved so far.\n");
        break;
      }

      if (key === "a" || key === "y") {
        approved.push(sp);
        stdout.write("  ✓ Approved\n");
      } else {
        stdout.write("  – Skipped\n");
      }
    }

    stdout.write(
      `\nReview complete: ${approved.length}/${scoredPatches.length} patch(es) approved.\n`,
    );
  } finally {
    rl.close();
  }

  return approved;
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
    if (result.stats.patchesConsolidated > 0) {
      console.log(
        `  Patches consolidated: ${result.stats.patchesConsolidated} duplicate(s) merged into glob includes`,
      );
    }
    if (result.stats.patchesApproved !== undefined) {
      console.log(`  Patches approved: ${result.stats.patchesApproved} (interactive)`);
    }
    console.log(`  Confidence: ${result.stats.confidence}`);
  }

  if (result.verification) {
    const v = result.verification;
    console.log("\nVerification:");
    console.log(`  Files checked: ${v.filesChecked}`);
    console.log(`  Exact matches: ${v.exactMatches}/${v.filesChecked}`);
    if (v.partialMatches > 0) {
      console.log(`  Partial matches: ${v.partialMatches}`);
    }
    if (v.notReproduced > 0) {
      console.log(`  Not reproduced: ${v.notReproduced}`);
    }
    if (options.verbosity && options.verbosity >= 2) {
      for (const r of v.results) {
        const pct = Math.round(r.similarity * 100);
        const status = r.reproduced ? "✓ exact" : `~${pct}%`;
        console.log(`  [${status}] ${r.file}`);
      }
    }
  }

  if (options.output) {
    console.log(`\nConfiguration written to: ${options.output}`);
  }
  if (options.write && options.write !== "-" && options.write !== "stdout") {
    console.log(`\nPatches written to: ${options.write}`);
  }
  if (options.apply) {
    const count = result.stats.filesApplied ?? 0;
    console.log(`\nApplied to: ${options.apply} (${count} file(s) written)`);
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

    // Consolidate duplicate patches across files into single glob-include patches
    const {
      patches: consolidatedPatches,
      scoredPatches: consolidatedScored,
      patchesConsolidated,
    } = consolidatePatches(patches, scoredPatches);

    // Interactive review: let the user approve/skip each patch before proceeding
    let finalPatches = consolidatedPatches;
    let finalScored = consolidatedScored;
    let patchesApproved: number | undefined;
    if (options.interactive) {
      const approvedScored = await runInteractiveSession(finalScored);
      patchesApproved = approvedScored.length;
      finalPatches = approvedScored.map((sp) => sp.patch);
      finalScored = approvedScored;
    }

    // Generate configuration
    const config = generateConfig(sourcePath, finalPatches);

    // Calculate confidence
    const confidence = calculateConfidence(finalPatches);

    // Run verification if requested: apply patches to source and compare with target
    let verification: VerificationSummary | undefined;
    if (options.verify && filePairs.length > 0) {
      if (verbosity >= 2) {
        console.log("\nVerifying patches against target files...");
      }
      verification = await verifyPatches(filePairs, finalPatches);
    }

    const result: SuggestResult = {
      config,
      scoredPatches: finalScored,
      stats: {
        filesAnalyzed,
        filesDeleted: fileOpResult.remainingSourceOnly.length,
        filesRenamed: fileOpResult.filesRenamed,
        filesMoved: fileOpResult.filesMoved,
        filesCopied: fileOpResult.filesCopied,
        patchesGenerated: finalPatches.length,
        patchesConsolidated,
        confidence,
        patchesApproved,
      },
      verification,
    };

    // Write to output file if specified
    if (options.output) {
      const configYaml = serializeConfig(config);
      writeFileSync(options.output, configYaml, "utf-8");
    }

    // Merge-aware write if --write is specified
    if (options.write && options.write !== "-" && options.write !== "stdout") {
      writePatches(options.write, config.patches ?? [], sourcePath);
    }

    // Apply patches to output directory if --apply is specified
    if (options.apply) {
      const filesApplied = await applyPatchesToDirectory(
        filePairs,
        finalPatches,
        sourcePath,
        options.apply,
      );
      result.stats.filesApplied = filesApplied;
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
