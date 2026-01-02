/**
 * Client-side type definitions for Kustomark web UI
 * Re-exports types from the core library for use in the web client
 */

export type OnNoMatchStrategy = "skip" | "warn" | "error";

export interface PatchValidation {
  notContains?: string;
}

export interface PatchCommonFields {
  id?: string;
  extends?: string | string[];
  include?: string | string[];
  exclude?: string | string[];
  onNoMatch?: OnNoMatchStrategy;
  validate?: PatchValidation;
  group?: string;
}

export interface ReplacePatch extends PatchCommonFields {
  op: "replace";
  old: string;
  new: string;
}

export interface ReplaceRegexPatch extends PatchCommonFields {
  op: "replace-regex";
  pattern: string;
  replacement: string;
  flags?: string;
}

export interface RemoveSectionPatch extends PatchCommonFields {
  op: "remove-section";
  id: string;
  includeChildren?: boolean;
}

export interface ReplaceSectionPatch extends PatchCommonFields {
  op: "replace-section";
  id: string;
  content: string;
}

export interface PrependToSectionPatch extends PatchCommonFields {
  op: "prepend-to-section";
  id: string;
  content: string;
}

export interface AppendToSectionPatch extends PatchCommonFields {
  op: "append-to-section";
  id: string;
  content: string;
}

export interface SetFrontmatterPatch extends PatchCommonFields {
  op: "set-frontmatter";
  key: string;
  value: unknown;
}

export interface RemoveFrontmatterPatch extends PatchCommonFields {
  op: "remove-frontmatter";
  key: string;
}

export interface RenameFrontmatterPatch extends PatchCommonFields {
  op: "rename-frontmatter";
  old: string;
  new: string;
}

export interface MergeFrontmatterPatch extends PatchCommonFields {
  op: "merge-frontmatter";
  values: Record<string, unknown>;
}

export interface DeleteBetweenPatch extends PatchCommonFields {
  op: "delete-between";
  start: string;
  end: string;
  inclusive?: boolean;
}

export interface ReplaceBetweenPatch extends PatchCommonFields {
  op: "replace-between";
  start: string;
  end: string;
  content: string;
  inclusive?: boolean;
}

export interface ReplaceLinePatch extends PatchCommonFields {
  op: "replace-line";
  match: string;
  replacement: string;
}

export interface InsertAfterLinePatch extends PatchCommonFields {
  op: "insert-after-line";
  match?: string;
  pattern?: string;
  regex?: boolean;
  content: string;
}

export interface InsertBeforeLinePatch extends PatchCommonFields {
  op: "insert-before-line";
  match?: string;
  pattern?: string;
  regex?: boolean;
  content: string;
}

export interface MoveSectionPatch extends PatchCommonFields {
  op: "move-section";
  id: string;
  after: string;
}

export interface RenameHeaderPatch extends PatchCommonFields {
  op: "rename-header";
  id: string;
  new: string;
}

export interface ChangeSectionLevelPatch extends PatchCommonFields {
  op: "change-section-level";
  id: string;
  delta: number;
}

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

export interface Validator {
  name: string;
  notContains?: string;
  frontmatterRequired?: string[];
}

export interface KustomarkConfig {
  apiVersion: string;
  kind: string;
  output?: string;
  resources: string[];
  patches?: PatchOperation[];
  onNoMatch?: OnNoMatchStrategy;
  validators?: Validator[];
}

export interface ValidationError {
  field?: string;
  file?: string;
  validator?: string;
  message: string;
}

export interface ValidationWarning {
  field?: string;
  file?: string;
  validator?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface PatchResult {
  content: string;
  applied: number;
  warnings: string[];
  validationErrors: ValidationError[];
}

export interface BuildResult {
  filesWritten: number;
  patchesApplied: number;
  duration: number;
  errors?: string[];
  warnings?: string[];
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}
