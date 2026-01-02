/**
 * Type definitions for the Kustomark template system
 */

/**
 * Template category for organizing templates
 */
export type TemplateCategory =
  | "upstream-fork" // Templates for consuming upstream markdown
  | "documentation" // Documentation pipeline templates
  | "skills" // Claude Code skill customization templates
  | "custom"; // User-defined custom templates

/**
 * Variable type for template variables
 */
export type VariableType = "string" | "boolean" | "number" | "array";

/**
 * A variable that can be substituted in template files
 */
export interface TemplateVariable {
  /** Variable name (used in {{variable_name}} syntax) */
  name: string;
  /** Human-readable description of the variable */
  description: string;
  /** Type of the variable */
  type: VariableType;
  /** Default value if not provided */
  default?: string | boolean | number | string[];
  /** Whether this variable is required */
  required: boolean;
  /** Example value for documentation */
  example?: string | boolean | number | string[];
  /** Validation pattern (regex) for string variables */
  pattern?: string;
}

/**
 * A file in the template with content and destination path
 */
export interface TemplateFile {
  /** Source file path relative to template root */
  src: string;
  /** Destination path relative to output (supports {{variables}}) */
  dest: string;
  /** Whether to apply variable substitution to this file */
  substitute: boolean;
}

/**
 * Command to run after template is applied
 */
export interface PostApplyCommand {
  /** Command to execute */
  command: string;
  /** Description of what the command does */
  description: string;
  /** Working directory (relative to template output) */
  cwd?: string;
}

/**
 * Template definition structure (template.yaml)
 */
export interface Template {
  /** Template API version */
  apiVersion: string;
  /** Kind - must be "Template" */
  kind: string;
  /** Template metadata */
  metadata: {
    /** Template name (kebab-case) */
    name: string;
    /** Short description of the template */
    description: string;
    /** Template category */
    category: TemplateCategory;
    /** Template version (semver) */
    version: string;
    /** Author name or organization */
    author?: string;
    /** Tags for searchability */
    tags?: string[];
  };
  /** Variables that can be substituted in template files */
  variables: TemplateVariable[];
  /** Files to include in the template */
  files: TemplateFile[];
  /** Optional commands to run after applying template */
  postApply?: PostApplyCommand[];
}

/**
 * Values provided by user for template variables
 */
export type TemplateValues = Record<string, string | boolean | number | string[]>;

/**
 * Result of applying a template
 */
export interface TemplateApplyResult {
  /** Whether the template was applied successfully */
  success: boolean;
  /** Files that were created */
  filesCreated: string[];
  /** Errors encountered during application */
  errors: TemplateError[];
  /** Warnings generated during application */
  warnings: TemplateWarning[];
  /** Post-apply commands that were executed */
  commandsExecuted: string[];
}

/**
 * Template error details
 */
export interface TemplateError {
  /** Error message */
  message: string;
  /** File where error occurred (if applicable) */
  file?: string;
  /** Variable name that caused the error (if applicable) */
  variable?: string;
}

/**
 * Template warning details
 */
export interface TemplateWarning {
  /** Warning message */
  message: string;
  /** File where warning occurred (if applicable) */
  file?: string;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Whether the template is valid */
  valid: boolean;
  /** Validation errors */
  errors: TemplateError[];
  /** Validation warnings */
  warnings: TemplateWarning[];
}

/**
 * Template metadata for listing and discovery
 */
export interface TemplateInfo {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: TemplateCategory;
  /** Template version */
  version: string;
  /** Template author */
  author?: string;
  /** Template tags */
  tags?: string[];
  /** Source where template is located */
  source: TemplateSource;
}

/**
 * Source location for a template
 */
export interface TemplateSource {
  /** Source type */
  type: "local" | "git" | "http";
  /** Path or URL to template */
  path: string;
  /** Git ref (for git sources) */
  ref?: string;
}

/**
 * Template registry for discovering available templates
 */
export interface TemplateRegistry {
  /** Registry version */
  version: number;
  /** Available templates */
  templates: TemplateInfo[];
  /** Last update timestamp */
  updated: string;
}
