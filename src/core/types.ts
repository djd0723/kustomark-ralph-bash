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
 * Condition for checking if file content contains a string
 */
export interface FileContainsCondition {
  type: "fileContains";
  /** String to search for in file content */
  value: string;
}

/**
 * Condition for checking if file content matches a regex pattern
 */
export interface FileMatchesCondition {
  type: "fileMatches";
  /** Regex pattern to match against file content */
  pattern: string;
}

/**
 * Condition for checking if frontmatter field equals a value
 */
export interface FrontmatterEqualsCondition {
  type: "frontmatterEquals";
  /** Frontmatter key to check */
  key: string;
  /** Expected value (can be string, number, boolean, array, or object) */
  value: unknown;
}

/**
 * Condition for checking if frontmatter key exists
 */
export interface FrontmatterExistsCondition {
  type: "frontmatterExists";
  /** Frontmatter key to check for existence */
  key: string;
}

/**
 * Logical NOT condition - negates another condition
 */
export interface NotCondition {
  type: "not";
  /** Condition to negate */
  condition: Condition;
}

/**
 * Logical OR condition - matches if any sub-condition matches
 */
export interface AnyOfCondition {
  type: "anyOf";
  /** List of conditions to check (matches if any is true) */
  conditions: Condition[];
}

/**
 * Logical AND condition - matches if all sub-conditions match
 */
export interface AllOfCondition {
  type: "allOf";
  /** List of conditions to check (matches if all are true) */
  conditions: Condition[];
}

/**
 * Union type of all supported condition types
 */
export type Condition =
  | FileContainsCondition
  | FileMatchesCondition
  | FrontmatterEqualsCondition
  | FrontmatterExistsCondition
  | NotCondition
  | AnyOfCondition
  | AllOfCondition;

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
  /** Optional condition - patch only applies if condition evaluates to true */
  when?: Condition;
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
 * Copy file operation - copies a file to a new location
 */
export interface CopyFilePatch extends PatchCommonFields {
  op: "copy-file";
  /** Source file path (relative to project root) */
  source: string;
  /** Destination file path (relative to project root) */
  destination: string;
  /** Whether to overwrite if destination exists (default: false) */
  overwrite?: boolean;
}

/**
 * Rename file operation - renames a file
 */
export interface RenameFilePatch extends PatchCommonFields {
  op: "rename-file";
  /** Source file path (relative to project root) */
  source: string;
  /** Destination file path (relative to project root) */
  destination: string;
  /** Whether to overwrite if destination exists (default: false) */
  overwrite?: boolean;
}

/**
 * Delete file operation - deletes a file
 */
export interface DeleteFilePatch extends PatchCommonFields {
  op: "delete-file";
  /** File path to delete (relative to project root) */
  path: string;
}

/**
 * Move file operation - moves a file to a new location
 */
export interface MoveFilePatch extends PatchCommonFields {
  op: "move-file";
  /** Source file path (relative to project root) */
  source: string;
  /** Destination file path (relative to project root) */
  destination: string;
  /** Whether to overwrite if destination exists (default: false) */
  overwrite?: boolean;
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
  | ChangeSectionLevelPatch
  | CopyFilePatch
  | RenameFilePatch
  | DeleteFilePatch
  | MoveFilePatch;

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
 * Watch mode hooks configuration
 */
export interface WatchHooks {
  /** Commands to run after successful build */
  onBuild?: string[];
  /** Commands to run when build fails */
  onError?: string[];
  /** Commands to run when file changes are detected */
  onChange?: string[];
}

/**
 * Hook execution context for template variables
 */
export interface HookContext {
  /** The file that changed (for onChange hooks) */
  file?: string;
  /** Exit code from build or previous hook */
  exitCode?: number;
  /** Error message (for onError hooks) */
  error?: string;
  /** Timestamp of the event */
  timestamp: string;
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
  /** Watch mode hooks - shell commands triggered on build events */
  watch?: WatchHooks;
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
  /** Number of patches skipped due to condition evaluation */
  conditionSkipped: number;
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
  /** Map of config paths to their hashes (for tracking base configs in overlays) */
  configHashes?: Record<string, string>;
  /** Cached build entries - Map of file path to cache entry for O(1) lookup */
  entries: Map<string, BuildCacheEntry>;
  /** Group filters used during build (for cache invalidation) */
  groupFilters?: {
    /** Enabled groups (whitelist mode) */
    enabled?: string[];
    /** Disabled groups (blacklist mode) */
    disabled?: string[];
  };
}

/**
 * A node in the dependency graph representing a file
 */
export interface DependencyNode {
  /** Absolute path to the file */
  path: string;
  /** List of dependency types (e.g., "config" for config dependencies) */
  dependencies: string[];
  /** Set of absolute paths that depend on this file */
  dependents: Set<string>;
  /** Indices of patches applied to this file */
  appliedPatches: number[];
}

/**
 * Dependency graph for tracking file relationships
 */
export interface DependencyGraph {
  /** Map of file path to dependency node */
  nodes: Map<string, DependencyNode>;
  /** Path to the config file that created this graph */
  configPath: string;
  /** List of referenced config paths from resources field */
  configDependencies: string[];
  /** List of unique patch group names */
  patchGroups: string[];
}
