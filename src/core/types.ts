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
  /** Source file path */
  src: string;
  /** Destination file path */
  dest: string;
}

/**
 * Rename file operation - renames files matching a pattern
 */
export interface RenameFilePatch extends PatchCommonFields {
  op: "rename-file";
  /** Glob pattern to match files */
  match: string;
  /** New filename (basename only, not full path) */
  rename: string;
}

/**
 * Delete file operation - deletes files matching a pattern
 */
export interface DeleteFilePatch extends PatchCommonFields {
  op: "delete-file";
  /** Glob pattern to match files to delete */
  match: string;
}

/**
 * Move file operation - moves files matching a pattern to a destination
 */
export interface MoveFilePatch extends PatchCommonFields {
  op: "move-file";
  /** Glob pattern to match files */
  match: string;
  /** Destination directory path */
  dest: string;
}

/**
 * Replace table cell operation - replaces content in a specific table cell
 */
export interface ReplaceTableCellPatch extends PatchCommonFields {
  op: "replace-table-cell";
  /** Table identifier (index 0-based or heading text) */
  table: number | string;
  /** Row identifier (0-based index or object with column and value to match) */
  row: number | { column: number | string; value: string };
  /** Column identifier (0-based index or header name) */
  column: number | string;
  /** New content for the cell */
  content: string;
}

/**
 * Add table row operation - adds a new row to a table
 */
export interface AddTableRowPatch extends PatchCommonFields {
  op: "add-table-row";
  /** Table identifier (index 0-based or heading text) */
  table: number | string;
  /** Array of cell values for the new row */
  values: string[];
  /** Position to insert the row (0-based index, default: append to end) */
  position?: number;
}

/**
 * Remove table row operation - removes a row from a table
 */
export interface RemoveTableRowPatch extends PatchCommonFields {
  op: "remove-table-row";
  /** Table identifier (index 0-based or heading text) */
  table: number | string;
  /** Row identifier (0-based index or object with column and value to match) */
  row: number | { column: number | string; value: string };
}

/**
 * Add table column operation - adds a new column to a table
 */
export interface AddTableColumnPatch extends PatchCommonFields {
  op: "add-table-column";
  /** Table identifier (index 0-based or heading text) */
  table: number | string;
  /** Header name for the new column */
  header: string;
  /** Default value for existing rows (default: empty string) */
  defaultValue?: string;
  /** Position to insert the column (0-based index, default: append to end) */
  position?: number;
}

/**
 * Remove table column operation - removes a column from a table
 */
export interface RemoveTableColumnPatch extends PatchCommonFields {
  op: "remove-table-column";
  /** Table identifier (index 0-based or heading text) */
  table: number | string;
  /** Column identifier (0-based index or header name) */
  column: number | string;
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
  | MoveFilePatch
  | ReplaceTableCellPatch
  | AddTableRowPatch
  | RemoveTableRowPatch
  | AddTableColumnPatch
  | RemoveTableColumnPatch;

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
 * Authentication configuration for remote resources
 */
export interface ResourceAuth {
  /** Authentication type */
  type: "bearer" | "basic";
  /** Environment variable name containing the bearer token */
  tokenEnv?: string;
  /** Username for basic authentication */
  username?: string;
  /** Environment variable name containing the password for basic auth */
  passwordEnv?: string;
}

/**
 * Resource object with URL and optional authentication/checksum
 */
export interface ResourceObject {
  /** Resource URL */
  url: string;
  /** Optional SHA256 checksum for integrity verification */
  sha256?: string;
  /** Optional authentication configuration */
  auth?: ResourceAuth;
}

/**
 * Resource item - can be a simple string URL or a detailed object
 */
export type ResourceItem = string | ResourceObject;

/**
 * Security configuration for remote resource validation
 */
export interface SecurityConfig {
  /** List of allowed hostnames for remote resources (e.g., github.com, internal.company.com) */
  allowedHosts?: string[];
  /** List of allowed protocols for remote resources (e.g., https, git) */
  allowedProtocols?: string[];
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
  resources: ResourceItem[];
  /** Ordered list of patches to apply */
  patches?: PatchOperation[];
  /** Default strategy for patches that don't match */
  onNoMatch?: OnNoMatchStrategy;
  /** Global validators to run on all resources */
  validators?: Validator[];
  /** Watch mode hooks - shell commands triggered on build events */
  watch?: WatchHooks;
  /** Security configuration for remote resource validation */
  security?: SecurityConfig;
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
  /** Intelligent suggestions for fixing the issue */
  suggestions?: string[];
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
  warnings: ValidationWarning[];
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

/**
 * Individual patch test case
 */
export interface PatchTest {
  /** Name of the test */
  name: string;
  /** Input markdown content */
  input: string;
  /** Patches to apply */
  patches: PatchOperation[];
  /** Expected output after applying patches */
  expected: string;
}

/**
 * Test suite file structure
 */
export interface PatchTestSuite {
  /** API version - must be "kustomark/v1" */
  apiVersion: string;
  /** Kind - must be "PatchTestSuite" */
  kind: string;
  /** List of test cases */
  tests: PatchTest[];
}

/**
 * Result of running a single test
 */
export interface TestResult {
  /** Name of the test */
  name: string;
  /** Whether the test passed */
  passed: boolean;
  /** Actual output from applying patches */
  actual: string;
  /** Expected output */
  expected: string;
  /** Unified diff between expected and actual (if failed) */
  diff?: string;
  /** Error message (if test execution failed) */
  error?: string;
  /** Number of patches applied */
  appliedPatches: number;
  /** Warnings from patch application */
  warnings: ValidationWarning[];
  /** Validation errors from patch application */
  validationErrors: ValidationError[];
}

/**
 * Result of running a test suite
 */
export interface TestSuiteResult {
  /** Total number of tests */
  total: number;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Individual test results */
  results: TestResult[];
}

/**
 * Coverage statistics for patch analysis
 */
export interface CoverageReport {
  /** Total number of patches defined */
  totalPatches: number;
  /** Number of patches that were applied */
  appliedPatches: number;
  /** Number of patches that were skipped */
  skippedPatches: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** List of patch indices that were not applied */
  unappliedPatchIndices: number[];
}

/**
 * Impact data for a single patch
 */
export interface PatchImpact {
  /** Index of the patch in the patches array */
  patchIndex: number;
  /** Patch operation type */
  operation: string;
  /** Number of files affected by this patch */
  filesAffected: number;
  /** Total number of changes made */
  changesCount: number;
  /** List of file paths affected */
  affectedFiles: string[];
}

/**
 * Overall impact analysis across all patches
 */
export interface ImpactReport {
  /** Total number of files processed */
  totalFiles: number;
  /** Total number of changes made across all files */
  totalChanges: number;
  /** Impact data for each patch */
  patchImpacts: PatchImpact[];
  /** Files with the most changes (sorted by change count) */
  mostImpactedFiles: Array<{ file: string; changes: number }>;
}

/**
 * Complexity metrics for a single file
 */
export interface FileComplexity {
  /** File path */
  file: string;
  /** Number of patches applied to this file */
  patchCount: number;
  /** Number of sections in the file */
  sectionCount: number;
  /** Number of frontmatter fields */
  frontmatterFieldCount: number;
  /** Whether the file has tables */
  hasTables: boolean;
  /** Complexity score (higher = more complex) */
  complexityScore: number;
}

/**
 * Overall complexity analysis
 */
export interface ComplexityReport {
  /** Complexity metrics for each file */
  fileComplexities: FileComplexity[];
  /** Average complexity score across all files */
  averageComplexity: number;
  /** Maximum complexity score found */
  maxComplexity: number;
  /** Minimum complexity score found */
  minComplexity: number;
  /** Files with highest complexity (sorted by score) */
  mostComplexFiles: FileComplexity[];
}

/**
 * Risk level classification
 */
export type RiskLevel = "high" | "medium" | "low";

/**
 * Safety metrics for a single patch
 */
export interface PatchSafety {
  /** Index of the patch in the patches array */
  patchIndex: number;
  /** Patch operation type */
  operation: string;
  /** Risk level of this patch */
  riskLevel: RiskLevel;
  /** Risk factors identified */
  riskFactors: string[];
  /** Whether this patch has validation rules */
  hasValidation: boolean;
  /** Whether this patch has conditions */
  hasConditions: boolean;
}

/**
 * Overall safety analysis
 */
export interface SafetyReport {
  /** Safety metrics for each patch */
  patchSafeties: PatchSafety[];
  /** Number of high-risk patches */
  highRiskCount: number;
  /** Number of medium-risk patches */
  mediumRiskCount: number;
  /** Number of low-risk patches */
  lowRiskCount: number;
  /** Overall safety score (0-100, higher is safer) */
  overallSafetyScore: number;
  /** List of high-risk patches requiring attention */
  highRiskPatches: PatchSafety[];
}

/**
 * Combined analytics report with all analyses
 */
export interface AnalyticsReport {
  /** Coverage analysis */
  coverage: CoverageReport;
  /** Impact analysis */
  impact: ImpactReport;
  /** Complexity analysis */
  complexity: ComplexityReport;
  /** Safety analysis */
  safety: SafetyReport;
  /** Timestamp when the analysis was generated (ISO 8601) */
  generatedAt: string;
}

/**
 * Details about a detected conflict between patches
 */
export interface PatchConflict {
  /** Indices of the conflicting patches */
  patchIndices: [number, number];
  /** Type of conflict */
  type: "overlapping-targets" | "competing-changes" | "order-dependent";
  /** Description of the conflict */
  description: string;
  /** Severity of the conflict */
  severity: "high" | "medium" | "low";
}

/**
 * Details about dependencies between patches
 */
export interface PatchDependency {
  /** Index of the dependent patch */
  dependentPatch: number;
  /** Indices of patches it depends on */
  dependsOn: number[];
  /** Type of dependency */
  type: "sequential" | "prerequisite" | "complementary";
  /** Description of the dependency */
  description: string;
}

/**
 * Impact details for dry-run analysis
 */
export interface DryRunImpact {
  /** Estimated number of files to be created */
  filesCreated: number;
  /** Estimated number of files to be modified */
  filesModified: number;
  /** Estimated number of files to be deleted */
  filesDeleted: number;
  /** Estimated bytes to be added */
  bytesAdded: number;
  /** Estimated bytes to be removed */
  bytesRemoved: number;
  /** Net change in bytes */
  netBytes: number;
}

/**
 * Dry-run analysis results
 */
export interface DryRunAnalysis {
  /** Complexity score (0-100, higher = more complex) */
  complexityScore: number;
  /** Risk level assessment */
  riskLevel: RiskLevel;
  /** Impact details */
  impact: DryRunImpact;
  /** Detected conflicts */
  conflicts: PatchConflict[];
  /** Dependency relationships */
  dependencies: PatchDependency[];
  /** Overall assessment message */
  assessment: string;
}

// Benchmark Types
export interface BenchmarkConfig {
  name: string;
  description: string;
  fileCount: number;
  operations: PatchOperation[];
  complexity: "simple" | "medium" | "complex";
  warmupRuns: number;
  benchmarkRuns: number;
}

export interface BenchmarkResult {
  operation: string;
  fileCount: number;
  complexity: string;
  runs: number;
  timing: {
    mean: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  throughput: {
    filesPerSecond: number;
    operationsPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface BenchmarkSuiteResult {
  timestamp: string;
  environment: {
    platform: string;
    arch: string;
    bunVersion: string;
    cpuCount: number;
    totalMemory: number;
  };
  results: BenchmarkResult[];
  summary: {
    totalDuration: number;
    totalOperations: number;
    averageThroughput: number;
  };
}

export interface BenchmarkComparison {
  operation: string;
  fileCount: number;
  baseline: BenchmarkResult;
  current: BenchmarkResult;
  change: {
    meanPercent: number;
    medianPercent: number;
    memoryPercent: number;
    regression: boolean;
    improvement: boolean;
  };
}

// Snapshot Testing Types

/**
 * Snapshot manifest containing metadata about a saved snapshot
 */
export interface SnapshotManifest {
  /** Timestamp when snapshot was created */
  timestamp: string;
  /** Kustomark version used to create snapshot */
  version: string;
  /** Map of file paths to their SHA256 hashes */
  fileHashes: Record<string, string>;
  /** Total number of files in snapshot */
  fileCount: number;
}

/**
 * Result of verifying current build against a snapshot
 */
export interface SnapshotVerificationResult {
  /** Whether the current build matches the snapshot */
  matches: boolean;
  /** Files that were added (not in snapshot) */
  added: string[];
  /** Files that were removed (in snapshot but not in build) */
  removed: string[];
  /** Files that were modified (different hash) */
  modified: Array<{
    path: string;
    expectedHash: string;
    actualHash: string;
  }>;
  /** Total number of differences found */
  differenceCount: number;
}
