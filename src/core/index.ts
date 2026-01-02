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
