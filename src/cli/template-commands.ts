/**
 * Template commands for Kustomark CLI
 * Implements list, show, and apply subcommands for template management
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import type { TemplateVariables } from "../core/templates/applier.js";
import { TemplateApplier, TemplateManager } from "../core/templates/index.js";

// ============================================================================
// Types
// ============================================================================

export interface TemplateCommandOptions {
  format: "text" | "json";
  verbosity: number;
  category?: string; // For list --category filter
  var?: Record<string, string>; // For apply --var key=value
  dryRun?: boolean; // For apply --dry-run
  overwrite?: boolean; // For apply --overwrite
  interactive?: boolean; // For apply --interactive
}

export interface TemplateListResult {
  templates: Array<{
    id: string;
    name: string;
    description: string;
    source: string;
    tags: string[];
  }>;
  total: number;
}

export interface TemplateShowResult {
  template: {
    id: string;
    name: string;
    description: string;
    source: string;
    tags: string[];
    files: string[];
  };
  variables: Array<{
    name: string;
    files: string[];
  }>;
}

export interface TemplateApplyResult {
  success: boolean;
  template: string;
  outputDir: string;
  files: string[];
  skipped: string[];
  substitutions: number;
  dryRun: boolean;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prompt user for missing template variables interactively
 * Uses @clack/prompts to provide a user-friendly interactive experience
 *
 * @param foundVariables - Array of all variable names found in the template
 * @param providedVariables - Variables already provided via --var flags
 * @returns Promise resolving to complete variable map including prompted values
 */
async function promptForVariables(
  foundVariables: string[],
  providedVariables: TemplateVariables,
): Promise<TemplateVariables> {
  // Filter out variables that are already provided
  const missingVariables = foundVariables.filter((varName) => !(varName in providedVariables));

  // If all variables are provided, no need to prompt
  if (missingVariables.length === 0) {
    return providedVariables;
  }

  // Start interactive prompts
  clack.intro("Template Variable Configuration");

  // Show which variables were already provided
  if (Object.keys(providedVariables).length > 0) {
    const providedList = Object.entries(providedVariables)
      .map(([key, value]) => `  ${key} = ${value}`)
      .join("\n");
    clack.note(`Already provided:\n${providedList}`, "Provided Variables");
  }

  // Build the complete variables object starting with provided ones
  const allVariables: TemplateVariables = { ...providedVariables };

  try {
    // Prompt for each missing variable
    for (const varName of missingVariables) {
      const value = await clack.text({
        message: `Value for {{${varName}}}:`,
        placeholder: `Enter value for ${varName}`,
        validate: (input) => {
          if (!input || input.trim() === "") {
            return `Variable ${varName} is required`;
          }
        },
      });

      // Handle cancellation
      if (clack.isCancel(value)) {
        clack.cancel("Template application cancelled");
        process.exit(0);
      }

      allVariables[varName] = value as string;
    }

    clack.outro("Variables configured successfully!");
    return allVariables;
  } catch (error) {
    // Handle any unexpected errors during prompting
    clack.cancel("An error occurred during variable prompting");
    throw error;
  }
}

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * List all available templates
 * @param options - Command options
 * @returns Promise resolving to exit code (0=success, 1=error)
 */
export async function templateList(options: TemplateCommandOptions): Promise<number> {
  try {
    const manager = new TemplateManager();
    const templates = await manager.listTemplates();

    // Filter by category if specified
    let filteredTemplates = templates;
    if (options.category) {
      filteredTemplates = templates.filter((t) =>
        t.tags.some((tag) => tag.toLowerCase() === options.category?.toLowerCase()),
      );
    }

    // Build result
    const result: TemplateListResult = {
      templates: filteredTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        source: t.source,
        tags: t.tags,
      })),
      total: filteredTemplates.length,
    };

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      outputTemplateList(result, options);
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            templates: [],
            total: 0,
            error: errorMessage,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

/**
 * Show detailed information about a specific template
 * @param templateName - Template identifier
 * @param options - Command options
 * @returns Promise resolving to exit code (0=success, 1=error)
 */
export async function templateShow(
  templateName: string,
  options: TemplateCommandOptions,
): Promise<number> {
  try {
    const manager = new TemplateManager();
    const applier = new TemplateApplier();

    // Get the template
    const template = await manager.getTemplate(templateName);

    // Extract variables from template files
    const variableMap = new Map<string, Set<string>>();

    const validation = applier.validateVariables(template, {});
    for (const varName of validation.found) {
      if (!variableMap.has(varName)) {
        variableMap.set(varName, new Set());
      }
      // Find which files contain this variable
      for (const f of template.files) {
        if (f.content.includes(`{{${varName}}}`)) {
          variableMap.get(varName)?.add(f.path);
        }
      }
    }

    // Build result
    const result: TemplateShowResult = {
      template: {
        id: template.metadata.id,
        name: template.metadata.name,
        description: template.metadata.description,
        source: template.metadata.source,
        tags: template.metadata.tags,
        files: template.metadata.files,
      },
      variables: Array.from(variableMap.entries()).map(([name, files]) => ({
        name,
        files: Array.from(files),
      })),
    };

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      outputTemplateShow(result, options);
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            error: errorMessage,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

/**
 * Apply a template to an output directory
 * @param templateName - Template identifier
 * @param outputDir - Output directory path (defaults to current directory)
 * @param options - Command options
 * @returns Promise resolving to exit code (0=success, 1=error)
 */
export async function templateApply(
  templateName: string,
  outputDir: string,
  options: TemplateCommandOptions,
): Promise<number> {
  try {
    const manager = new TemplateManager();
    const applier = new TemplateApplier();

    // Get the template
    const template = await manager.getTemplate(templateName);

    // Resolve output directory
    const absoluteOutputDir = resolve(outputDir);

    // Check if output directory exists (unless dry-run)
    if (!options.dryRun && !existsSync(absoluteOutputDir)) {
      if (options.verbosity > 0 && options.format === "text") {
        console.log(`Creating directory: ${absoluteOutputDir}`);
      }
    }

    // Prepare variables
    let variables: TemplateVariables = options.var ?? {};

    // Validate variables to find what's needed
    const validation = applier.validateVariables(template, variables);

    // Determine if we should use interactive mode
    // Interactive mode is enabled when:
    // 1. --interactive flag is explicitly set, OR
    // 2. No --var flags were provided AND format is 'text' (not JSON)
    const shouldUseInteractive =
      options.interactive === true ||
      (Object.keys(variables).length === 0 && options.format === "text");

    // If variables are missing and interactive mode is available, prompt for them
    if (!validation.valid && shouldUseInteractive) {
      try {
        // Prompt for missing variables
        variables = await promptForVariables(validation.found, variables);

        // Re-validate with the new variables
        const revalidation = applier.validateVariables(template, variables);
        if (!revalidation.valid) {
          // This shouldn't happen if promptForVariables worked correctly,
          // but handle it just in case
          console.error("Error: Some variables are still missing after prompting");
          return 1;
        }
      } catch (_error) {
        // Error during prompting (user cancelled or other error)
        return 1;
      }
    } else if (!validation.valid) {
      // Non-interactive mode or JSON format - report missing variables as error
      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              success: false,
              template: templateName,
              outputDir: absoluteOutputDir,
              files: [],
              skipped: [],
              substitutions: 0,
              dryRun: options.dryRun ?? false,
              error: "Missing required variables",
              missingVariables: validation.missing.map((m) => ({
                variable: m.variable,
                file: m.file,
              })),
            },
            null,
            2,
          ),
        );
      } else {
        console.error("Error: Missing required variables:\n");
        for (const missing of validation.missing) {
          console.error(`  - ${missing.variable} (used in ${missing.file})`);
        }
        console.error("\nProvide variables using --var KEY=VALUE or use --interactive");
      }
      return 1;
    }

    // Warn about unused variables
    if (validation.unused.length > 0 && options.verbosity > 0 && options.format === "text") {
      console.log(`Warning: Unused variables: ${validation.unused.join(", ")}`);
    }

    // Apply the template
    const result = await applier.applyTemplate(template, {
      outputDir: absoluteOutputDir,
      variables,
      dryRun: options.dryRun ?? false,
      overwrite: options.overwrite ?? false,
    });

    // Build result
    const applyResult: TemplateApplyResult = {
      success: true,
      template: templateName,
      outputDir: absoluteOutputDir,
      files: result.files,
      skipped: result.skipped,
      substitutions: result.substitutions,
      dryRun: options.dryRun ?? false,
    };

    // Output results
    if (options.format === "json") {
      console.log(JSON.stringify(applyResult, null, 2));
    } else {
      outputTemplateApply(applyResult, options);
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const result: TemplateApplyResult = {
      success: false,
      template: templateName,
      outputDir: resolve(outputDir),
      files: [],
      skipped: [],
      substitutions: 0,
      dryRun: options.dryRun ?? false,
      error: errorMessage,
    };

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}

// ============================================================================
// Output Formatting Functions
// ============================================================================

/**
 * Output template list in text format
 */
function outputTemplateList(result: TemplateListResult, options: TemplateCommandOptions): void {
  if (result.total === 0) {
    console.log("No templates found.");
    return;
  }

  if (options.verbosity === 0) {
    // Quiet mode: just list template names
    for (const template of result.templates) {
      console.log(template.id);
    }
    return;
  }

  // Normal output: show formatted list
  console.log(`Available templates (${result.total}):\n`);

  for (const template of result.templates) {
    console.log(`  ${template.id}`);
    console.log(`    ${template.description}`);

    if (options.verbosity > 1) {
      console.log(`    Source: ${template.source}`);
      if (template.tags.length > 0) {
        console.log(`    Tags: ${template.tags.join(", ")}`);
      }
    }

    console.log(""); // Blank line between templates
  }

  if (options.verbosity > 0) {
    console.log(`\nUse 'kustomark template show <name>' to see details about a template.`);
  }
}

/**
 * Output template details in text format
 */
function outputTemplateShow(result: TemplateShowResult, options: TemplateCommandOptions): void {
  console.log(`Template: ${result.template.name}`);
  console.log(`ID: ${result.template.id}`);
  console.log(`Description: ${result.template.description}`);
  console.log(`Source: ${result.template.source}`);

  if (result.template.tags.length > 0) {
    console.log(`Tags: ${result.template.tags.join(", ")}`);
  }

  console.log(`\nFiles (${result.template.files.length}):`);
  for (const file of result.template.files) {
    console.log(`  - ${file}`);
  }

  if (result.variables.length > 0) {
    console.log(`\nVariables (${result.variables.length}):`);
    for (const variable of result.variables) {
      console.log(`  - {{${variable.name}}}`);
      if (options.verbosity > 1) {
        console.log(`    Used in: ${variable.files.join(", ")}`);
      }
    }
    console.log(`\nProvide variables when applying: --var ${result.variables[0]?.name}=value`);
  } else {
    console.log("\nNo variables required.");
  }

  console.log("\nApply this template:");
  console.log(`  kustomark template apply ${result.template.id} [output-dir]`);
}

/**
 * Output template apply results in text format
 */
function outputTemplateApply(result: TemplateApplyResult, options: TemplateCommandOptions): void {
  if (result.dryRun) {
    console.log("Dry run: Preview of template application\n");
  }

  if (options.verbosity > 0) {
    console.log(`Template: ${result.template}`);
    console.log(`Output directory: ${result.outputDir}`);
    console.log("");
  }

  if (result.files.length > 0) {
    const verb = result.dryRun ? "Would create" : "Created";
    console.log(`${verb} ${result.files.length} file(s):`);
    for (const file of result.files) {
      console.log(`  ${result.dryRun ? "+" : "✓"} ${file}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log(`\nSkipped ${result.skipped.length} existing file(s):`);
    for (const file of result.skipped) {
      console.log(`  - ${file}`);
    }
    if (!result.dryRun) {
      console.log("\nUse --overwrite to replace existing files.");
    }
  }

  if (options.verbosity > 0 && result.substitutions > 0) {
    console.log(`\nVariable substitutions: ${result.substitutions}`);
  }

  if (result.dryRun) {
    console.log("\nNo files were written (dry run mode).");
    console.log("Remove --dry-run to apply the template.");
  } else if (result.files.length > 0) {
    console.log("\nTemplate applied successfully!");
  }
}
