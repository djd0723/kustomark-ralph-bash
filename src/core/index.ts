/**
 * Core library exports
 *
 * This module provides the core functionality for kustomark:
 * - Patch engine for applying transformations
 * - Type definitions
 * - Config parsing (from other modules)
 */

// Export build cache functions and types
export {
  type CurrentBuildState,
  calculateFileHash,
  calculatePatchHash,
  clearAllCaches,
  clearProjectCache,
  computePatchesHash,
  createEmptyCache,
  detectChangedFiles,
  determineFilesToRebuild,
  type FileChanges,
  getCacheDirectory,
  hasConfigChanged,
  havePatchesChanged,
  loadBuildCache,
  pruneCache,
  type RebuildDetermination,
  type ShouldRebuildResult,
  saveBuildCache,
  shouldRebuildFile,
  updateBuildCache,
} from "./build-cache.js";
// Export condition evaluator functions
export {
  evaluateAllOf,
  evaluateAnyOf,
  evaluateCondition,
  evaluateFileContains,
  evaluateFileMatches,
  evaluateFrontmatterEquals,
  evaluateFrontmatterExists,
  evaluateNot,
} from "./condition-evaluator.js";

// Export config parser functions
export { parseConfig, validateConfig } from "./config-parser.js";
// Export dependency graph functions and types
export {
  buildDependencyGraph,
  getAffectedFiles,
  getDependencies,
} from "./dependency-graph.js";

// Export diff generator functions and types
export {
  type DiffResult,
  type FileDiff,
  type FileStatus,
  generateDiff,
  generateFileDiff,
} from "./diff-generator.js";
// Export file operations functions and types
export {
  applyCopyFile,
  applyDeleteFile,
  applyMoveFile,
  applyRenameFile,
  type FileOperationResult,
  validatePath,
} from "./file-operations.js";
// Export frontmatter parser functions and types
export {
  extractFrontmatter,
  type FrontmatterResult,
  insertFrontmatter,
  parseFrontmatter,
  stringifyFrontmatter,
} from "./frontmatter-parser.js";
// Export git fetcher functions and types
export {
  clearGitCache,
  fetchGitRepository,
  GitFetchError,
  type GitFetchOptions,
  type GitFetchResult,
  getDefaultCacheDir,
  listGitCache,
} from "./git-fetcher.js";

// Export git URL parser functions
export { isGitUrl, parseGitUrl } from "./git-url-parser.js";
// Export HTTP archive fetcher functions and types
export {
  clearHttpCache,
  type ExtractedFile,
  fetchHttpArchive,
  getCacheInfo,
  getDefaultCacheDir as getDefaultHttpCacheDir,
  HttpFetchError,
  type HttpFetchOptions,
  type HttpFetchResult,
  listHttpCache,
} from "./http-fetcher.js";
// Export HTTP archive URL parser functions
export { isHttpArchiveUrl, parseHttpArchiveUrl } from "./http-url-parser.js";
// Export lock file functions and types
export {
  calculateContentHash,
  findLockEntry,
  getLockFilePath,
  loadLockFile,
  parseLockFile,
  saveLockFile,
  serializeLockFile,
  updateLockEntry,
} from "./lock-file.js";
// Export nested value utilities
export { deleteNestedValue, getNestedValue, setNestedValue } from "./nested-values.js";
// Export preview generator functions and types
export {
  type CharDiff,
  type CharDiffType,
  type FilePreview,
  generateFilePreview,
  generatePreview,
  type LineChange,
  type LineChangeType,
  type PreviewResult,
} from "./preview-generator.js";
// Export all patch engine functions
export {
  applyAppendToSection,
  applyMergeFrontmatter,
  applyPatches,
  applyPrependToSection,
  applyRemoveFrontmatter,
  applyRemoveSection,
  applyRenameFrontmatter,
  applyReplace,
  applyReplaceRegex,
  applyReplaceSection,
  applySetFrontmatter,
  applySinglePatch,
  findSection,
  generateSlug,
  parseSections,
} from "./patch-engine.js";

// Export patch inheritance functions
export { resolveInheritance } from "./patch-inheritance.js";
// Export resource resolver functions and types
export {
  type ResolvedResource,
  ResourceResolutionError,
  resolveResources,
} from "./resource-resolver.js";
// Export security validation functions and types
export {
  SecurityValidationError,
  validateResourceSecurity,
} from "./security.js";
// Export suggestion engine functions
export {
  calculateLevenshteinDistance,
  findSimilarStrings,
  generateFrontmatterKeySuggestions,
  generatePatchSuggestions,
  generateSectionSuggestions,
} from "./suggestion-engine.js";
// Export table parser functions and types
export {
  type ColumnAlignment,
  findRowIndex,
  findTable,
  getColumnIndex,
  type MarkdownTable,
  parseTables,
  serializeTable,
} from "./table-parser.js";
// Export test runner functions
export { runPatchTest, runTestSuite } from "./test-runner.js";
// Export test suite parser functions
export { parseTestSuite, validateTestSuite } from "./test-suite-parser.js";
// Export all types
// Export condition types
// Export test types
// Export analytics types
export type {
  AllOfCondition,
  AnalyticsReport,
  AnyOfCondition,
  AppendToSectionPatch,
  BuildCache,
  BuildCacheEntry,
  ComplexityReport,
  Condition,
  CoverageReport,
  DependencyGraph,
  DependencyNode,
  FileComplexity,
  FileContainsCondition,
  FileMatchesCondition,
  FrontmatterEqualsCondition,
  FrontmatterExistsCondition,
  ImpactReport,
  KustomarkConfig,
  LockFile,
  LockFileEntry,
  MarkdownSection,
  MergeFrontmatterPatch,
  NotCondition,
  OnNoMatchStrategy,
  ParsedGitUrl,
  ParsedHttpArchiveUrl,
  PatchCommonFields,
  PatchImpact,
  PatchOperation,
  PatchResult,
  PatchSafety,
  PatchTest,
  PatchTestSuite,
  PatchValidation,
  PrependToSectionPatch,
  RemoveFrontmatterPatch,
  RemoveSectionPatch,
  RenameFrontmatterPatch,
  ReplacePatch,
  ReplaceRegexPatch,
  ReplaceSectionPatch,
  RiskLevel,
  SafetyReport,
  SecurityConfig,
  SetFrontmatterPatch,
  TestResult,
  TestSuiteResult,
  ValidationError,
  ValidationResult,
  ValidationWarning,
  Validator,
} from "./types.js";
// Export validator functions
export {
  runValidator,
  runValidators,
  validateFrontmatterRequired,
  validateNotContains,
} from "./validators.js";
