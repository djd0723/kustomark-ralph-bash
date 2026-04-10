/**
 * Core library exports
 *
 * This module provides the core functionality for kustomark:
 * - Patch engine for applying transformations
 * - Type definitions
 * - Config parsing (from other modules)
 */

// Export baseline manager functions and types
export {
  type BaselineComparisonResult,
  type BaselineHistoryEntry,
  BaselineManager,
  type BaselineManagerOptions,
  type BaselineMetadata,
  type BaselineRecord,
} from "./baseline-manager.js";

// Export benchmark storage functions
export {
  compareResults,
  detectRegressions,
  listBaselines,
  loadBaseline,
  saveBaseline,
} from "./benchmark-storage.js";

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

// Export build history functions and types
export {
  clearHistory,
  compareBuildHistory,
  deleteBuild,
  getBuildById,
  getHistoryDirectory,
  getHistoryStats,
  getLatestBuild,
  type HistoryStats,
  listBuilds,
  loadBuild,
  loadManifest,
  pruneHistory,
  recordBuild,
  rollbackBuild,
  saveBuildToHistory,
} from "./build-history.js";
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
// Export error classes and helper functions
export {
  ConfigurationError,
  extractSnippet,
  FileSystemError,
  findFailurePosition,
  findSimilarContent,
  KustomarkError,
  levenshteinDistance,
  PatchError,
  PatchValidationError,
  ResourceError,
} from "./errors.js";
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
export {
  findList,
  type ListItem,
  type ListType,
  type MarkdownList,
  parseLists,
} from "./list-parser.js";
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
// Export all patch engine functions
export {
  applyAiTransform,
  applyAppendToFile,
  applyAppendToSection,
  applyDeduplicateListItems,
  applyDeduplicateTableRows,
  applyFilterListItems,
  applyFilterTableRows,
  applyInsertSection,
  applyMergeFrontmatter,
  applyModifyLinks,
  applyPatches,
  applyPatchesWithPlugins,
  applyPrependToFile,
  applyPrependToSection,
  applyRemoveFrontmatter,
  applyRemoveSection,
  applyRenameFrontmatter,
  applyRenameTableColumn,
  applyReorderListItems,
  applyReorderTableColumns,
  applyReplace,
  applyReplaceInSection,
  applyReplaceRegex,
  applyReplaceSection,
  applySetFrontmatter,
  applySinglePatch,
  applyUpdateToc,
  findSection,
  generateSlug,
  parseSections,
  resolveVars,
  resolveVarsInPatch,
} from "./patch-engine.js";
// Export patch inheritance functions
export { resolveInheritance } from "./patch-inheritance.js";
// Export plugin error classes
export {
  createPluginLoadErrorMessage,
  PluginChecksumError,
  PluginExecutionError,
  PluginLoadError,
  PluginNotFoundError,
  PluginParamValidationError,
  PluginTimeoutError,
  PluginValidationError,
  validatePluginInterface,
} from "./plugin-errors.js";
// Export plugin executor functions
export { createPluginContext, executePlugin } from "./plugin-executor.js";
// Export plugin loader functions
export {
  calculatePluginHash,
  createPluginRegistry,
  loadPlugin,
  resolvePluginSource,
} from "./plugin-loader.js";
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
// Export snapshot manager functions and types
export {
  type BuildResult,
  calculateFileHash as calculateSnapshotFileHash,
  createSnapshot,
  loadSnapshot,
  type SnapshotManifest,
  type SnapshotVerificationResult,
  updateSnapshot,
  verifySnapshot,
} from "./snapshot-manager.js";
// Export suggestion engine functions
export {
  calculateLevenshteinDistance,
  findSimilarStrings,
  generateFrontmatterKeySuggestions,
  generatePatchSuggestions,
  generateSectionSuggestions,
  getSuggestionWithConfidence,
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
  AddListItemPatch,
  AiTransformPatch,
  AllOfCondition,
  AnalyticsReport,
  AnyOfCondition,
  AppendToFilePatch,
  AppendToSectionPatch,
  BenchmarkComparison,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkSuiteResult,
  BuildCache,
  BuildCacheEntry,
  BuildComparisonResult,
  BuildFileEntry,
  BuildHistoryEntry,
  BuildHistoryManifest,
  ComplexityReport,
  Condition,
  CoverageReport,
  DeduplicateListItemsPatch,
  DeduplicateTableRowsPatch,
  DependencyGraph,
  DependencyNode,
  FileComplexity,
  FileContainsCondition,
  FileMatchesCondition,
  FilterListItemsPatch,
  FilterTableRowsPatch,
  FrontmatterEqualsCondition,
  FrontmatterExistsCondition,
  ImpactReport,
  InsertSectionPatch,
  KustomarkConfig,
  LockFile,
  LockFileEntry,
  MarkdownSection,
  MergeFrontmatterPatch,
  ModifyLinksPatch,
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
  PrependToFilePatch,
  PrependToSectionPatch,
  RemoveFrontmatterPatch,
  RemoveListItemPatch,
  RemoveSectionPatch,
  RenameFrontmatterPatch,
  RenameTableColumnPatch,
  ReorderListItemsPatch,
  ReplaceInSectionPatch,
  ReplacePatch,
  ReplaceRegexPatch,
  ReplaceSectionPatch,
  RiskLevel,
  RollbackOptions,
  RollbackResult,
  SafetyReport,
  SecurityConfig,
  SetFrontmatterPatch,
  SetListItemPatch,
  TestResult,
  TestSuiteResult,
  UpdateTocPatch,
  ValidationError,
  ValidationResult,
  ValidationWarning,
  Validator,
} from "./types.js";
// Export validator functions
export {
  runValidator,
  runValidators,
  validateContains,
  validateFrontmatterRequired,
  validateMatchesRegex,
  validateNotContains,
  validateNotMatchesRegex,
} from "./validators.js";
