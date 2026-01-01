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
  parseSections,
  generateSlug,
  findSection,
  applySinglePatch,
} from "./patch-engine.js";

// Export all types
export type {
  OnNoMatchStrategy,
  PatchCommonFields,
  ReplacePatch,
  ReplaceRegexPatch,
  RemoveSectionPatch,
  ReplaceSectionPatch,
  PrependToSectionPatch,
  AppendToSectionPatch,
  PatchOperation,
  KustomarkConfig,
  ValidationError,
  ValidationResult,
  PatchResult,
  MarkdownSection,
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
