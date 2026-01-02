/**
 * Core library exports
 *
 * This module provides the core functionality for kustomark:
 * - Patch engine for applying transformations
 * - Type definitions
 * - Config parsing (from other modules)
 */

// Export all patch engine functions
export {
  applyPatches,
  applyReplace,
  applyReplaceRegex,
  applyRemoveSection,
  applyReplaceSection,
  applyPrependToSection,
  applyAppendToSection,
  applySetFrontmatter,
  applyRemoveFrontmatter,
  applyRenameFrontmatter,
  applyMergeFrontmatter,
  parseSections,
  generateSlug,
  findSection,
  applySinglePatch,
} from "./patch-engine.js";

// Export all types
export type {
  OnNoMatchStrategy,
  PatchCommonFields,
  PatchValidation,
  ReplacePatch,
  ReplaceRegexPatch,
  RemoveSectionPatch,
  ReplaceSectionPatch,
  PrependToSectionPatch,
  AppendToSectionPatch,
  SetFrontmatterPatch,
  RemoveFrontmatterPatch,
  RenameFrontmatterPatch,
  MergeFrontmatterPatch,
  PatchOperation,
  Validator,
  KustomarkConfig,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  PatchResult,
  MarkdownSection,
  ParsedGitUrl,
  ParsedHttpArchiveUrl,
} from "./types.js";

// Export config parser functions
export { parseConfig, validateConfig } from "./config-parser.js";

// Export resource resolver functions and types
export {
  resolveResources,
  type ResolvedResource,
  ResourceResolutionError,
} from "./resource-resolver.js";

// Export diff generator functions and types
export {
  generateDiff,
  generateFileDiff,
  type FileDiff,
  type FileStatus,
  type DiffResult,
} from "./diff-generator.js";

// Export frontmatter parser functions and types
export {
  parseFrontmatter,
  stringifyFrontmatter,
  extractFrontmatter,
  insertFrontmatter,
  getNestedValue,
  setNestedValue,
  deleteNestedValue,
  type FrontmatterResult,
} from "./frontmatter-parser.js";

// Export validator functions
export {
  validateNotContains,
  validateFrontmatterRequired,
  runValidator,
  runValidators,
} from "./validators.js";

// Export git URL parser functions
export { isGitUrl, parseGitUrl } from "./git-url-parser.js";

// Export HTTP archive URL parser functions
export { isHttpArchiveUrl, parseHttpArchiveUrl } from "./http-url-parser.js";

// Export git fetcher functions and types
export {
  fetchGitRepository,
  clearGitCache,
  listGitCache,
  getDefaultCacheDir,
  GitFetchError,
  type GitFetchResult,
  type GitFetchOptions,
} from "./git-fetcher.js";

// Export HTTP archive fetcher functions and types
export {
  fetchHttpArchive,
  clearHttpCache,
  listHttpCache,
  getCacheInfo,
  getDefaultCacheDir as getDefaultHttpCacheDir,
  HttpFetchError,
  type HttpFetchResult,
  type HttpFetchOptions,
  type ExtractedFile,
} from "./http-fetcher.js";

// Export lock file functions and types
export {
  parseLockFile,
  serializeLockFile,
  loadLockFile,
  saveLockFile,
  getLockFilePath,
  findLockEntry,
  updateLockEntry,
  calculateContentHash,
} from "./lock-file.js";

export type { LockFile, LockFileEntry } from "./types.js";

// Export patch inheritance functions
export { resolveInheritance } from "./patch-inheritance.js";

// Export build cache functions and types
export {
  calculateFileHash,
  calculatePatchHash,
  createEmptyCache,
  loadBuildCache,
  saveBuildCache,
  getCacheDirectory,
  clearProjectCache,
  clearAllCaches,
  updateBuildCache,
  pruneCache,
  detectChangedFiles,
  hasConfigChanged,
  computePatchesHash,
  havePatchesChanged,
  shouldRebuildFile,
  determineFilesToRebuild,
  type CurrentBuildState,
  type ShouldRebuildResult,
  type RebuildDetermination,
  type FileChanges,
} from "./build-cache.js";

export type { BuildCache, BuildCacheEntry } from "./types.js";

// Export dependency graph functions and types
export {
  buildDependencyGraph,
  getAffectedFiles,
  getDependencies,
} from "./dependency-graph.js";

export type { DependencyNode, DependencyGraph } from "./types.js";

// Export condition evaluator functions
export {
  evaluateCondition,
  evaluateFileContains,
  evaluateFileMatches,
  evaluateFrontmatterEquals,
  evaluateFrontmatterExists,
  evaluateNot,
  evaluateAnyOf,
  evaluateAllOf,
} from "./condition-evaluator.js";

// Export condition types
export type {
  Condition,
  FileContainsCondition,
  FileMatchesCondition,
  FrontmatterEqualsCondition,
  FrontmatterExistsCondition,
  NotCondition,
  AnyOfCondition,
  AllOfCondition,
} from "./types.js";

// Export file operations functions and types
export {
  applyCopyFile,
  applyRenameFile,
  applyDeleteFile,
  applyMoveFile,
  validatePath,
  type FileOperationResult,
} from "./file-operations.js";

// Export security validation functions and types
export {
  validateResourceSecurity,
  SecurityValidationError,
} from "./security.js";

export type { SecurityConfig } from "./types.js";

// Export suggestion engine functions
export {
  calculateLevenshteinDistance,
  findSimilarStrings,
  generateSectionSuggestions,
  generateFrontmatterKeySuggestions,
  generatePatchSuggestions,
} from "./suggestion-engine.js";
