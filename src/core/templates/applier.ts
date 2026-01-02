/**
 * Template Applier Module
 *
 * Handles applying templates to output directories with variable substitution
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { validatePath } from "../file-operations.js";
import type { Template } from "./manager.js";

/**
 * Template variable substitution map
 */
export type TemplateVariables = Record<string, string>;

/**
 * Template application options
 */
export interface ApplyTemplateOptions {
  /** Output directory path */
  outputDir: string;
  /** Template variables for substitution */
  variables?: TemplateVariables;
  /** Dry-run mode - don't write files */
  dryRun?: boolean;
  /** Overwrite existing files */
  overwrite?: boolean;
}

/**
 * Result of applying a template
 */
export interface ApplyTemplateResult {
  /** Files that would be/were created */
  files: string[];
  /** Files that were skipped (already exist) */
  skipped: string[];
  /** Number of variables substituted */
  substitutions: number;
}

/**
 * Validation error for template variables
 */
export interface VariableValidationError {
  /** Variable name */
  variable: string;
  /** File path where variable was found */
  file: string;
  /** Error message */
  message: string;
}

/**
 * Result of validating template variables
 */
export interface VariableValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Variables that are required but not provided */
  missing: VariableValidationError[];
  /** Variables that are provided but not used */
  unused: string[];
  /** All variables found in template */
  found: string[];
}

/**
 * Error thrown when template application fails
 */
export class TemplateApplyError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TemplateApplyError";
    this.code = code;
  }
}

/**
 * Template Applier
 * Handles applying templates to directories with variable substitution
 */
export class TemplateApplier {
  /**
   * Apply a template to an output directory
   *
   * @param template - Template to apply
   * @param options - Application options
   * @returns Result of template application
   * @throws TemplateApplyError if application fails
   */
  async applyTemplate(
    template: Template,
    options: ApplyTemplateOptions,
  ): Promise<ApplyTemplateResult> {
    const { outputDir, variables = {}, dryRun = false, overwrite = false } = options;

    // Resolve output directory to absolute path
    const absoluteOutputDir = resolve(outputDir);

    // Track results
    const createdFiles: string[] = [];
    const skippedFiles: string[] = [];
    let totalSubstitutions = 0;

    // Create output directory if it doesn't exist (unless dry-run)
    if (!dryRun && !existsSync(absoluteOutputDir)) {
      await mkdir(absoluteOutputDir, { recursive: true });
    }

    // Process each template file
    for (const file of template.files) {
      const outputPath = join(absoluteOutputDir, file.path);

      // Validate output path to prevent path traversal
      try {
        validatePath(file.path, absoluteOutputDir);
      } catch (_error) {
        throw new TemplateApplyError(`Invalid file path in template: ${file.path}`, "INVALID_PATH");
      }

      // Check if file already exists
      if (existsSync(outputPath) && !overwrite) {
        skippedFiles.push(file.path);
        continue;
      }

      // Apply variable substitution
      const { content, substitutions } = this.substituteVariables(file.content, variables);
      totalSubstitutions += substitutions;

      // Write file (unless dry-run)
      if (!dryRun) {
        // Create parent directories if needed
        const fileDir = dirname(outputPath);
        if (!existsSync(fileDir)) {
          await mkdir(fileDir, { recursive: true });
        }

        await writeFile(outputPath, content, "utf-8");
      }

      createdFiles.push(file.path);
    }

    return {
      files: createdFiles,
      skipped: skippedFiles,
      substitutions: totalSubstitutions,
    };
  }

  /**
   * Validate template variables
   * Checks which variables are required and whether all required ones are provided
   *
   * @param template - Template to validate
   * @param variables - Variables provided by user
   * @returns Validation result
   */
  validateVariables(template: Template, variables: TemplateVariables): VariableValidationResult {
    const providedVars = new Set(Object.keys(variables));
    const foundVars = new Set<string>();
    const missing: VariableValidationError[] = [];

    // Find all variables in template files
    for (const file of template.files) {
      const varsInFile = this.extractVariables(file.content);

      for (const variable of varsInFile) {
        foundVars.add(variable);

        // Check if this variable is provided
        if (!providedVars.has(variable)) {
          missing.push({
            variable,
            file: file.path,
            message: `Required variable '${variable}' not provided`,
          });
        }
      }
    }

    // Find unused variables
    const unused: string[] = [];
    for (const provided of providedVars) {
      if (!foundVars.has(provided)) {
        unused.push(provided);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      unused,
      found: Array.from(foundVars),
    };
  }

  /**
   * Substitute template variables in content
   * Variables are in the format {{VARIABLE_NAME}}
   *
   * @param content - Content with variable placeholders
   * @param variables - Variable substitution map
   * @returns Substituted content and count of substitutions
   */
  substituteVariables(
    content: string,
    variables: TemplateVariables,
  ): { content: string; substitutions: number } {
    let result = content;
    let substitutions = 0;

    // Replace each variable
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

      // Count occurrences
      const matches = result.match(regex);
      if (matches) {
        substitutions += matches.length;
      }

      result = result.replace(regex, value);
    }

    return { content: result, substitutions };
  }

  /**
   * Extract all variable names from content
   * Finds all {{VARIABLE_NAME}} patterns
   *
   * @param content - Content to search
   * @returns Array of unique variable names
   */
  private extractVariables(content: string): string[] {
    const variablePattern = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
    const variables = new Set<string>();

    let match = variablePattern.exec(content);
    while (match !== null) {
      if (match[1]) {
        variables.add(match[1]);
      }
      match = variablePattern.exec(content);
    }

    return Array.from(variables);
  }
}
