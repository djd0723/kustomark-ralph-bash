/**
 * Template initialization command for Kustomark CLI
 * Implements scaffolding/init functionality to help users create custom templates
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as clack from "@clack/prompts";
import * as yaml from "js-yaml";
import type { TemplateVariable, Template as TemplateYaml } from "../core/templates/types.js";

// ============================================================================
// Types
// ============================================================================

export interface TemplateInitOptions {
  format: "text" | "json";
  verbosity: number;
  nonInteractive?: boolean;
}

export interface TemplateInitResult {
  success: boolean;
  path: string;
  files: string[];
  error?: string;
}

interface TemplateMetadata {
  name: string;
  description: string;
  category: "upstream-fork" | "documentation" | "skills" | "custom";
  author?: string;
  email?: string;
}

interface VariableDefinition {
  name: string;
  description: string;
  type: "string" | "boolean" | "number" | "array";
  required: boolean;
  defaultValue?: string;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Initialize a new template with interactive prompts
 * @param outputPath - Path where template should be created
 * @param options - Command options
 * @returns Promise resolving to exit code (0=success, 1=error)
 */
export async function templateInitCommand(
  outputPath: string,
  options: TemplateInitOptions,
): Promise<number> {
  try {
    if (options.nonInteractive) {
      return await initNonInteractive(outputPath, options);
    }
    return await initInteractive(outputPath, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      console.log(
        JSON.stringify(
          {
            success: false,
            path: outputPath,
            files: [],
            error: errorMessage,
          } as TemplateInitResult,
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
 * Interactive mode with prompts for template metadata
 */
async function initInteractive(outputPath: string, options: TemplateInitOptions): Promise<number> {
  clack.intro("Create a new Kustomark template");

  try {
    // Gather metadata
    const metadata = await gatherMetadata();

    // Gather variables
    const variables = await gatherVariables();

    // Create the template structure
    const result = await createTemplateStructure(outputPath, metadata, variables, options);

    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      clack.outro(
        `Template created successfully at ${result.path}\n\nCreated files:\n${result.files.map((f) => `  - ${f}`).join("\n")}\n\nNext steps:\n  1. Add your template files to the files/ directory\n  2. Update template.yaml with file mappings\n  3. Test your template with: kustomark template apply ${metadata.name}`,
      );
    }

    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      clack.cancel("Template creation cancelled");
      return 1;
    }
    throw error;
  }
}

/**
 * Non-interactive mode with defaults
 */
async function initNonInteractive(
  outputPath: string,
  options: TemplateInitOptions,
): Promise<number> {
  const basename = outputPath.split("/").pop() || "my-template";

  const metadata: TemplateMetadata = {
    name: basename,
    description: "A custom Kustomark template",
    category: "custom",
  };

  const variables: VariableDefinition[] = [
    {
      name: "PROJECT_NAME",
      description: "Name of the project",
      type: "string",
      required: true,
    },
  ];

  const result = await createTemplateStructure(outputPath, metadata, variables, options);

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Template created at: ${result.path}`);
    console.log("\nCreated files:");
    for (const file of result.files) {
      console.log(`  - ${file}`);
    }
  }

  return 0;
}

// ============================================================================
// Interactive Prompts
// ============================================================================

/**
 * Gather template metadata through interactive prompts
 */
async function gatherMetadata(): Promise<TemplateMetadata> {
  const answers = await clack.group(
    {
      name: () =>
        clack.text({
          message: "Template name (kebab-case):",
          placeholder: "my-custom-template",
          validate: (value) => {
            if (!value || value.trim() === "") {
              return "Template name is required";
            }
            if (!/^[a-z0-9-]+$/.test(value)) {
              return "Template name must be kebab-case (lowercase letters, numbers, and hyphens)";
            }
          },
        }) as Promise<string>,

      description: () =>
        clack.text({
          message: "Template description:",
          placeholder: "A brief description of what this template does",
          validate: (value) => {
            if (!value || value.trim() === "") {
              return "Description is required";
            }
          },
        }) as Promise<string>,

      category: () =>
        clack.select({
          message: "Template category:",
          options: [
            {
              value: "upstream-fork",
              label: "Upstream Fork",
              hint: "For consuming markdown from upstream sources",
            },
            {
              value: "documentation",
              label: "Documentation",
              hint: "For documentation pipeline templates",
            },
            {
              value: "skills",
              label: "Skills",
              hint: "For Claude Code skill customization",
            },
            {
              value: "custom",
              label: "Custom",
              hint: "For custom/other use cases",
            },
          ],
          initialValue: "custom",
        }) as Promise<"upstream-fork" | "documentation" | "skills" | "custom">,

      addAuthor: () =>
        clack.confirm({
          message: "Add author information?",
          initialValue: false,
        }) as Promise<boolean>,

      author: ({ results }) =>
        results.addAuthor
          ? (clack.text({
              message: "Author name:",
              placeholder: "Your Name",
            }) as Promise<string>)
          : undefined,

      email: ({ results }) =>
        results.addAuthor
          ? (clack.text({
              message: "Author email:",
              placeholder: "you@example.com",
              validate: (value) => {
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                  return "Invalid email format";
                }
              },
            }) as Promise<string>)
          : undefined,
    },
    {
      onCancel: () => {
        throw new Error("cancelled");
      },
    },
  );

  return {
    name: answers.name,
    description: answers.description,
    category: answers.category,
    author: typeof answers.author === "string" ? answers.author : undefined,
    email: typeof answers.email === "string" ? answers.email : undefined,
  };
}

/**
 * Gather template variables through interactive prompts
 */
async function gatherVariables(): Promise<VariableDefinition[]> {
  const variables: VariableDefinition[] = [];

  const addVariables = await clack.confirm({
    message: "Add template variables?",
    initialValue: true,
  });

  if (!addVariables) {
    return variables;
  }

  let continueAdding = true;

  while (continueAdding) {
    clack.note(`Defining variable ${variables.length + 1}`);

    try {
      const variable = await clack.group(
        {
          name: () =>
            clack.text({
              message: "Variable name (SCREAMING_SNAKE_CASE):",
              placeholder: "MY_VARIABLE",
              validate: (value) => {
                if (!value || value.trim() === "") {
                  return "Variable name is required";
                }
                if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
                  return "Variable name must be SCREAMING_SNAKE_CASE (uppercase letters, numbers, and underscores)";
                }
                if (variables.some((v) => v.name === value)) {
                  return "Variable name already exists";
                }
              },
            }) as Promise<string>,

          description: () =>
            clack.text({
              message: "Variable description:",
              placeholder: "Description of what this variable is used for",
              validate: (value) => {
                if (!value || value.trim() === "") {
                  return "Description is required";
                }
              },
            }) as Promise<string>,

          type: () =>
            clack.select({
              message: "Variable type:",
              options: [
                { value: "string", label: "String" },
                { value: "boolean", label: "Boolean" },
                { value: "number", label: "Number" },
                { value: "array", label: "Array" },
              ],
              initialValue: "string",
            }) as Promise<"string" | "boolean" | "number" | "array">,

          required: () =>
            clack.confirm({
              message: "Is this variable required?",
              initialValue: true,
            }) as Promise<boolean>,

          addDefault: ({ results }) =>
            !results.required
              ? (clack.confirm({
                  message: "Add a default value?",
                  initialValue: false,
                }) as Promise<boolean>)
              : undefined,

          defaultValue: ({ results }) =>
            results.addDefault
              ? (clack.text({
                  message: `Default value (${results.type ?? "string"}):`,
                  placeholder: getPlaceholderForType(results.type ?? "string"),
                }) as Promise<string>)
              : undefined,
        },
        {
          onCancel: () => {
            throw new Error("cancelled");
          },
        },
      );

      variables.push({
        name: variable.name,
        description: variable.description,
        type: variable.type,
        required: variable.required,
        defaultValue: typeof variable.defaultValue === "string" ? variable.defaultValue : undefined,
      });

      const continueResponse = await clack.confirm({
        message: "Add another variable?",
        initialValue: false,
      });

      // Handle clack symbol (user cancelled)
      if (typeof continueResponse === "symbol") {
        break;
      }

      continueAdding = continueResponse;
    } catch (error) {
      if (error instanceof Error && error.message === "cancelled") {
        break;
      }
      throw error;
    }
  }

  return variables;
}

// ============================================================================
// Template Structure Creation
// ============================================================================

/**
 * Create the template directory structure and files
 */
async function createTemplateStructure(
  outputPath: string,
  metadata: TemplateMetadata,
  variables: VariableDefinition[],
  _options: TemplateInitOptions,
): Promise<TemplateInitResult> {
  const absolutePath = resolve(outputPath);

  // Check if directory already exists
  if (existsSync(absolutePath)) {
    throw new Error(`Directory already exists: ${absolutePath}`);
  }

  // Create directory structure
  mkdirSync(absolutePath, { recursive: true });
  const filesDir = join(absolutePath, "files");
  mkdirSync(filesDir, { recursive: true });

  const createdFiles: string[] = [];

  // Create template.yaml
  const templateYaml = generateTemplateYaml(metadata, variables);
  const templateYamlPath = join(absolutePath, "template.yaml");
  writeFileSync(templateYamlPath, templateYaml, "utf-8");
  createdFiles.push("template.yaml");

  // Create README.md
  const readme = generateReadme(metadata, variables);
  const readmePath = join(absolutePath, "README.md");
  writeFileSync(readmePath, readme, "utf-8");
  createdFiles.push("README.md");

  // Create example kustomark.yaml in files/
  const exampleConfig = generateExampleKustomarkConfig(variables);
  const exampleConfigPath = join(filesDir, "kustomark.yaml");
  writeFileSync(exampleConfigPath, exampleConfig, "utf-8");
  createdFiles.push("files/kustomark.yaml");

  // Create example markdown file
  const exampleMd = generateExampleMarkdown(variables);
  const exampleMdPath = join(filesDir, "example.md");
  writeFileSync(exampleMdPath, exampleMd, "utf-8");
  createdFiles.push("files/example.md");

  return {
    success: true,
    path: absolutePath,
    files: createdFiles,
  };
}

// ============================================================================
// Template File Generators
// ============================================================================

/**
 * Generate template.yaml content
 */
function generateTemplateYaml(metadata: TemplateMetadata, variables: VariableDefinition[]): string {
  const template: TemplateYaml = {
    apiVersion: "kustomark/v1",
    kind: "Template",
    metadata: {
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
      tags: [metadata.category],
      author:
        metadata.author && metadata.email
          ? `${metadata.author} <${metadata.email}>`
          : metadata.author
            ? metadata.author
            : undefined,
      version: "1.0.0",
    },
    variables: variables.map((v) => {
      const variable: TemplateVariable = {
        name: v.name,
        description: v.description,
        type: v.type,
        required: v.required,
      };

      if (v.defaultValue) {
        // Parse default value based on type
        switch (v.type) {
          case "boolean":
            variable.default = v.defaultValue.toLowerCase() === "true";
            break;
          case "number":
            variable.default = Number.parseFloat(v.defaultValue);
            break;
          case "array":
            variable.default = v.defaultValue.split(",").map((s) => s.trim());
            break;
          default:
            variable.default = v.defaultValue;
        }
      }

      return variable;
    }),
    files: [
      {
        src: "files/kustomark.yaml",
        dest: "kustomark.yaml",
        substitute: true,
      },
      {
        src: "files/example.md",
        dest: "example.md",
        substitute: true,
      },
    ],
    // Add commented-out postApply section for reference
  };

  let yamlContent = yaml.dump(template, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });

  // Add commented-out postApply section
  yamlContent += "\n# Post-apply commands (optional)\n";
  yamlContent += "# Uncomment and customize as needed:\n";
  yamlContent += "#\n";
  yamlContent += "# postApply:\n";
  yamlContent += "#   - description: Initialize git repository\n";
  yamlContent += "#     command: git init\n";
  yamlContent += "#\n";
  yamlContent += "#   - description: Install dependencies\n";
  yamlContent += "#     command: npm install\n";

  return yamlContent;
}

/**
 * Generate README.md content
 */
function generateReadme(metadata: TemplateMetadata, variables: VariableDefinition[]): string {
  let readme = `# ${metadata.name}\n\n`;
  readme += `${metadata.description}\n\n`;
  readme += "## Overview\n\n";
  readme += `This is a ${metadata.category} template for Kustomark.\n\n`;

  if (variables.length > 0) {
    readme += "## Variables\n\n";
    readme += "This template supports the following variables:\n\n";

    for (const variable of variables) {
      readme += `### \`{{${variable.name}}}\`\n\n`;
      readme += `- **Description**: ${variable.description}\n`;
      readme += `- **Type**: ${variable.type}\n`;
      readme += `- **Required**: ${variable.required ? "Yes" : "No"}\n`;
      if (variable.defaultValue) {
        readme += `- **Default**: \`${variable.defaultValue}\`\n`;
      }
      readme += "\n";
    }
  }

  readme += "## Usage\n\n";
  readme += "Apply this template using the Kustomark CLI:\n\n";
  readme += "```bash\n";
  readme += `kustomark template apply ${metadata.name} [output-dir]`;

  if (variables.length > 0) {
    readme += " \\\n";
    for (const variable of variables) {
      if (variable.required) {
        const example = getExampleForType(variable.type);
        readme += `  --var ${variable.name}=${example}`;
        if (variables.indexOf(variable) < variables.length - 1) {
          readme += " \\\n";
        }
      }
    }
  }

  readme += "\n```\n\n";

  readme += "## Files\n\n";
  readme += "This template includes:\n\n";
  readme += "- `kustomark.yaml` - Base Kustomark configuration\n";
  readme += "- `example.md` - Example markdown file with variable substitution\n\n";

  readme += "## Customization\n\n";
  readme += "To customize this template:\n\n";
  readme += "1. Add your template files to the `files/` directory\n";
  readme += "2. Update `template.yaml` to include your files in the `files` section\n";
  readme += "3. Add variables as needed in the `variables` section\n";
  readme += "4. Use double curly braces with variable names in your files for substitution\n\n";

  if (metadata.author) {
    readme += "## Author\n\n";
    readme += `${metadata.author}`;
    if (metadata.email) {
      readme += ` <${metadata.email}>`;
    }
    readme += "\n";
  }

  return readme;
}

/**
 * Generate example kustomark.yaml content
 */
function generateExampleKustomarkConfig(variables: VariableDefinition[]): string {
  const hasProjectName = variables.some((v) => v.name === "PROJECT_NAME");

  let config = "apiVersion: kustomark/v1\n";
  config += "kind: Kustomization\n\n";

  if (hasProjectName) {
    config += "# Project: {{PROJECT_NAME}}\n\n";
  }

  config += "# Output directory for processed markdown\n";
  config += "output: ./output\n\n";

  config += "# Markdown files to process\n";
  config += "resources:\n";
  config += `  - "*.md"\n\n`;

  config += "# Optional: Add patches to customize content\n";
  config += "# patches:\n";
  config += "#   - op: replace\n";
  config += `#     old: "old text"\n`;
  config += `#     new: "new text"\n`;

  return config;
}

/**
 * Generate example markdown file
 */
function generateExampleMarkdown(variables: VariableDefinition[]): string {
  const hasProjectName = variables.some((v) => v.name === "PROJECT_NAME");

  let markdown = "---\n";
  if (hasProjectName) {
    markdown += "title: {{PROJECT_NAME}} Documentation\n";
  } else {
    markdown += "title: Example Documentation\n";
  }
  markdown += `date: ${new Date().toISOString().split("T")[0]}\n`;
  markdown += "---\n\n";

  if (hasProjectName) {
    markdown += "# {{PROJECT_NAME}}\n\n";
    markdown += "Welcome to the {{PROJECT_NAME}} documentation.\n\n";
  } else {
    markdown += "# Example Template\n\n";
    markdown += "This is an example markdown file for your template.\n\n";
  }

  markdown += "## Getting Started\n\n";
  markdown += "This template can be customized by:\n\n";
  markdown += "1. Editing the files in the template directory\n";
  markdown += "2. Adding variables to template.yaml\n";
  markdown += "3. Using variable substitution syntax in your files\n\n";

  if (variables.length > 0) {
    markdown += "## Template Variables\n\n";
    markdown += "This template uses the following variables:\n\n";
    for (const variable of variables) {
      markdown += `- **{{${variable.name}}}**: ${variable.description}\n`;
    }
    markdown += "\n";
  }

  markdown += "## Example Content\n\n";
  markdown += "Replace this section with your own content.\n";

  return markdown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get placeholder text for a variable type
 */
function getPlaceholderForType(type: string): string {
  switch (type) {
    case "boolean":
      return "true";
    case "number":
      return "42";
    case "array":
      return "item1,item2,item3";
    default:
      return "default value";
  }
}

/**
 * Get example value for a variable type
 */
function getExampleForType(type: string): string {
  switch (type) {
    case "boolean":
      return "true";
    case "number":
      return "1";
    case "array":
      return '"item1,item2"';
    default:
      return '"value"';
  }
}
