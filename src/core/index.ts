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
