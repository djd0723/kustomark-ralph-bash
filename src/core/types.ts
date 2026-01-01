/**
 * Core type definitions for Kustomark
 */

/**
 * Strategy for handling patches that don't match
 */
export type OnNoMatchStrategy = "skip" | "warn" | "error";

/**
 * Common fields shared by all patch operations
 */
export interface PatchCommonFields {
  /** Glob pattern(s) to include specific files */
  include?: string | string[];
  /** Glob pattern(s) to exclude specific files */
  exclude?: string | string[];
  /** Override the default onNoMatch behavior for this patch */
  onNoMatch?: OnNoMatchStrategy;
}

/**
 * Replace operation - simple string replacement
 */
export interface ReplacePatch extends PatchCommonFields {
  op: "replace";
  old: string;
  new: string;
}

/**
 * Replace regex operation - regex-based replacement
 */
export interface ReplaceRegexPatch extends PatchCommonFields {
  op: "replace-regex";
  pattern: string;
  replacement: string;
  /** Regex flags: g=global, i=case-insensitive, m=multiline, s=dotall */
  flags?: string;
}

/**
 * Remove section operation - removes a markdown section by ID
 */
export interface RemoveSectionPatch extends PatchCommonFields {
  op: "remove-section";
  /** Section ID (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** Whether to include child sections (default: true) */
  includeChildren?: boolean;
}

/**
 * Replace section operation - replaces entire section content
 */
export interface ReplaceSectionPatch extends PatchCommonFields {
  op: "replace-section";
  /** Section ID (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** New content for the section */
  content: string;
}

/**
 * Prepend to section operation - adds content to the beginning of a section
 */
export interface PrependToSectionPatch extends PatchCommonFields {
  op: "prepend-to-section";
  /** Section ID (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** Content to prepend */
  content: string;
}

/**
 * Append to section operation - adds content to the end of a section
 */
export interface AppendToSectionPatch extends PatchCommonFields {
  op: "append-to-section";
  /** Section ID (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** Content to append */
  content: string;
}

/**
 * Union type of all supported patch operations
 */
export type PatchOperation =
  | ReplacePatch
  | ReplaceRegexPatch
  | RemoveSectionPatch
  | ReplaceSectionPatch
  | PrependToSectionPatch
  | AppendToSectionPatch;

/**
 * Kustomark configuration structure
 */
export interface KustomarkConfig {
  /** API version - must be "kustomark/v1" */
  apiVersion: string;
  /** Kind - must be "Kustomization" */
  kind: string;
  /** Output directory (required for build command) */
  output?: string;
  /** Resource patterns, file paths, or kustomark configs */
  resources: string[];
  /** Ordered list of patches to apply */
  patches?: PatchOperation[];
  /** Default strategy for patches that don't match */
  onNoMatch?: OnNoMatchStrategy;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Field path where the error occurred */
  field: string;
  /** Error message */
  message: string;
}

/**
 * Result of config validation
 */
export interface ValidationResult {
  /** Whether the config is valid */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Result of applying patches to content
 */
export interface PatchResult {
  /** The patched content */
  content: string;
  /** Number of patches that were successfully applied */
  applied: number;
  /** Warnings from patches with onNoMatch=warn that had no matches */
  warnings: string[];
}

/**
 * A section in markdown with its boundaries
 */
export interface MarkdownSection {
  /** The section ID (slug or custom ID) */
  id: string;
  /** Header level (1-6) */
  level: number;
  /** Start line index (inclusive) */
  startLine: number;
  /** End line index (exclusive) */
  endLine: number;
  /** The full header text including # symbols */
  headerText: string;
}
