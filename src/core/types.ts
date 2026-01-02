/**
 * Core type definitions for Kustomark
 */

/**
 * Strategy for handling patches that don't match
 */
export type OnNoMatchStrategy = "skip" | "warn" | "error";

/**
 * Per-patch validation configuration
 */
export interface PatchValidation {
  /** Validate that the result does not contain this string */
  notContains?: string;
}

/**
 * Common fields shared by all patch operations
 */
export interface PatchCommonFields {
  /** Unique identifier for this patch (for inheritance) */
  id?: string;
  /** Patch ID(s) to extend from (single ID or array of IDs) */
  extends?: string | string[];
  /** Glob pattern(s) to include specific files */
  include?: string | string[];
  /** Glob pattern(s) to exclude specific files */
  exclude?: string | string[];
  /** Override the default onNoMatch behavior for this patch */
  onNoMatch?: OnNoMatchStrategy;
  /** Per-patch validation rules */
  validate?: PatchValidation;
  /** Optional group name for selective patch application */
  group?: string;
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
 * Set frontmatter operation - sets a frontmatter field
 */
export interface SetFrontmatterPatch extends PatchCommonFields {
  op: "set-frontmatter";
  /** Frontmatter key */
  key: string;
  /** Value to set */
  value: unknown;
}

/**
 * Remove frontmatter operation - removes a frontmatter field
 */
export interface RemoveFrontmatterPatch extends PatchCommonFields {
  op: "remove-frontmatter";
  /** Frontmatter key to remove */
  key: string;
}

/**
 * Rename frontmatter operation - renames a frontmatter field
 */
export interface RenameFrontmatterPatch extends PatchCommonFields {
  op: "rename-frontmatter";
  /** Old key name */
  old: string;
  /** New key name */
  new: string;
}

/**
 * Merge frontmatter operation - merges multiple values into frontmatter
 */
export interface MergeFrontmatterPatch extends PatchCommonFields {
  op: "merge-frontmatter";
  /** Key-value pairs to merge */
  values: Record<string, unknown>;
}

/**
 * Delete between markers operation - deletes content between two markers
 */
export interface DeleteBetweenPatch extends PatchCommonFields {
  op: "delete-between";
  /** Start marker string */
  start: string;
  /** End marker string */
  end: string;
  /** Whether to include the marker lines (default: true) */
  inclusive?: boolean;
}

/**
 * Replace between markers operation - replaces content between two markers
 */
export interface ReplaceBetweenPatch extends PatchCommonFields {
  op: "replace-between";
  /** Start marker string */
  start: string;
  /** End marker string */
  end: string;
  /** Replacement content */
  content: string;
  /** Whether to include the marker lines (default: true) */
  inclusive?: boolean;
}

/**
 * Replace line operation - replaces entire lines that match
 */
export interface ReplaceLinePatch extends PatchCommonFields {
  op: "replace-line";
  /** Exact string to match (entire line) */
  match: string;
  /** Replacement line content */
  replacement: string;
}

/**
 * Insert after line operation - inserts content after a matching line
 */
export interface InsertAfterLinePatch extends PatchCommonFields {
  op: "insert-after-line";
  /** Exact string to match (mutually exclusive with pattern) */
  match?: string;
  /** Regex pattern to match (mutually exclusive with match) */
  pattern?: string;
  /** Whether pattern is a regex (default: false) */
  regex?: boolean;
  /** Content to insert after the matching line */
  content: string;
}

/**
 * Insert before line operation - inserts content before a matching line
 */
export interface InsertBeforeLinePatch extends PatchCommonFields {
  op: "insert-before-line";
  /** Exact string to match (mutually exclusive with pattern) */
  match?: string;
  /** Regex pattern to match (mutually exclusive with match) */
  pattern?: string;
  /** Whether pattern is a regex (default: false) */
  regex?: boolean;
  /** Content to insert before the matching line */
  content: string;
}

/**
 * Move section operation - moves a section after another section
 */
export interface MoveSectionPatch extends PatchCommonFields {
  op: "move-section";
  /** Section ID to move (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** Section ID to move after (GitHub-style slug or explicit {#custom-id}) */
  after: string;
}

/**
 * Rename header operation - renames a section header while preserving level
 */
export interface RenameHeaderPatch extends PatchCommonFields {
  op: "rename-header";
  /** Section ID (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** New header text */
  new: string;
}

/**
 * Change section level operation - changes the heading level of a section
 */
export interface ChangeSectionLevelPatch extends PatchCommonFields {
  op: "change-section-level";
  /** Section ID (GitHub-style slug or explicit {#custom-id}) */
  id: string;
  /** Level change delta (e.g., -1 to promote ### → ##, +1 to demote ## → ###) */
  delta: number;
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
  | AppendToSectionPatch
  | SetFrontmatterPatch
  | RemoveFrontmatterPatch
  | RenameFrontmatterPatch
  | MergeFrontmatterPatch
  | DeleteBetweenPatch
  | ReplaceBetweenPatch
  | ReplaceLinePatch
  | InsertAfterLinePatch
  | InsertBeforeLinePatch
  | MoveSectionPatch
  | RenameHeaderPatch
  | ChangeSectionLevelPatch;

/**
 * Global validator configuration
 */
export interface Validator {
  /** Unique name for this validator */
  name: string;
  /** Validate that content does not contain this string */
  notContains?: string;
  /** Validate that frontmatter has these required fields */
  frontmatterRequired?: string[];
}

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
  /** Global validators to run on all resources */
  validators?: Validator[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Field path where the error occurred */
  field?: string;
  /** File path where the error occurred (for resource validation) */
  file?: string;
  /** Validator name that triggered the error (for global validators) */
  validator?: string;
  /** Error message */
  message: string;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  /** Field path where the warning occurred */
  field?: string;
  /** File path where the warning occurred (for resource validation) */
  file?: string;
  /** Validator name that triggered the warning (for global validators) */
  validator?: string;
  /** Warning message */
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
  warnings: ValidationWarning[];
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
  /** Validation errors from per-patch validation */
  validationErrors: ValidationError[];
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

/**
 * Parsed Git URL components for remote sources
 */
export interface ParsedGitUrl {
  /** Resource type - always 'git' for Git URLs */
  type: "git";
  /** Protocol used - 'https' or 'ssh' */
  protocol: "https" | "ssh";
  /** Git host (e.g., github.com, gitlab.com) */
  host: string;
  /** Organization or user name */
  org: string;
  /** Repository name */
  repo: string;
  /** Subpath within repository (after //) */
  path?: string;
  /** Git ref - branch, tag, or SHA */
  ref: string;
  /** Full git clone URL (always HTTPS format) */
  fullUrl: string;
  /** Clone URL for git operations (same as fullUrl) */
  cloneUrl: string;
}

/**
 * Parsed HTTP archive URL components for remote sources
 */
export interface ParsedHttpArchiveUrl {
  /** Resource type - always 'http-archive' for HTTP archive URLs */
  type: "http-archive";
  /** Base URL of the archive file (without subpath or query params) */
  url: string;
  /** Subpath within archive (after //) */
  subpath?: string;
  /** Archive type (.tar.gz, .tgz, .tar, .zip) */
  archiveType: "tar.gz" | "tgz" | "tar" | "zip";
  /** Query parameters for auth or other configuration */
  queryParams: Record<string, string>;
}

/**
 * Lock file entry for a resolved resource
 */
export interface LockFileEntry {
  /** Original URL from resources */
  url: string;
  /** Resolved reference (commit SHA for git, URL for HTTP) */
  resolved: string;
  /** Integrity hash in format "sha256-..." */
  integrity: string;
  /** Timestamp when fetched (ISO 8601) */
  fetched: string;
}

/**
 * Lock file structure
 */
export interface LockFile {
  /** Lock file version */
  version: number;
  /** Locked resources */
  resources: LockFileEntry[];
}

/**
 * Build cache entry for a single file
 */
export interface BuildCacheEntry {
  /** File path relative to project root */
  file: string;
  /** SHA256 hash of source content */
  sourceHash: string;
  /** SHA256 hash of patches applied to this file */
  patchHash: string;
  /** SHA256 hash of output content */
  outputHash: string;
  /** Timestamp when built (ISO 8601) */
  built: string;
}

/**
 * Build cache structure
 */
export interface BuildCache {
  /** Cache version */
  version: number;
  /** SHA256 hash of config file content */
  configHash: string;
  /** Cached build entries */
  entries: BuildCacheEntry[];
}

/**
 * A node in the dependency graph representing a file
 */
export interface DependencyNode {
  /** Absolute path to the file */
  path: string;
  /** Set of absolute paths this file depends on */
  dependencies: Set<string>;
  /** Set of absolute paths that depend on this file */
  dependents: Set<string>;
}

/**
 * Dependency graph for tracking file relationships
 */
export interface DependencyGraph {
  /** Map of file path to dependency node */
  nodes: Map<string, DependencyNode>;
  /** Path to the config file that created this graph */
  configPath: string;
}
