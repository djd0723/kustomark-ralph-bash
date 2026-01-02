/**
 * Interactive wizard for creating kustomark configurations
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as clack from "@clack/prompts";
import * as yaml from "js-yaml";
import type { KustomarkConfig, PatchOperation } from "../core/types.js";

interface CLIOptions {
  format: "text" | "json";
  clean: boolean;
  strict: boolean;
  verbosity: number;
  update: boolean;
  noLock: boolean;
  stats: boolean;
  file?: string;
  base?: string;
  output?: string;
  debounce?: number;
  enableGroups?: string[];
  disableGroups?: string[];
  parallel?: boolean;
  jobs?: number;
  incremental?: boolean;
  cleanCache?: boolean;
  cacheDir?: string;
}

interface WizardAnswers {
  configType: "base" | "overlay";
  output: string;
  baseConfig?: string;
  resourcePatterns?: string[];
  customPattern?: string;
  addPatches?: boolean;
  patchOperations?: string[];
  onNoMatch?: "skip" | "warn" | "error";
}

interface PatchDetails {
  op: string;
  [key: string]: unknown;
}

/**
 * Main interactive wizard function
 */
export async function initInteractive(path: string, _options: CLIOptions): Promise<number> {
  clack.intro("Create a new kustomark configuration");

  try {
    const answers = await clack.group<WizardAnswers>(
      {
        configType: () =>
          clack.select({
            message: "What type of configuration do you want to create?",
            options: [
              {
                value: "base",
                label: "Base",
                hint: "A base configuration with markdown resources",
              },
              {
                value: "overlay",
                label: "Overlay",
                hint: "An overlay that extends a base configuration",
              },
            ],
          }) as Promise<"base" | "overlay">,

        output: () =>
          clack.text({
            message: "Output directory:",
            placeholder: "./output",
            defaultValue: "./output",
            validate: (value) => {
              if (!value || value.trim() === "") {
                return "Output directory is required";
              }
            },
          }) as Promise<string>,

        baseConfig: ({ results }) =>
          results.configType === "overlay"
            ? (clack.text({
                message: "Path to base configuration:",
                placeholder: "../base/kustomark.yaml",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Base configuration path is required for overlays";
                  }
                  const resolvedPath = resolve(
                    path.endsWith("kustomark.yaml") ? path.slice(0, -15) : path,
                    value,
                  );
                  if (!existsSync(resolvedPath)) {
                    return `Base configuration not found: ${value}`;
                  }
                },
              }) as Promise<string>)
            : undefined,

        resourcePatterns: ({ results }) =>
          results.configType === "base"
            ? (clack.multiselect({
                message: "Select resource patterns:",
                options: [
                  {
                    value: "*.md",
                    label: "*.md",
                    hint: "All markdown files in current directory",
                  },
                  {
                    value: "**/*.md",
                    label: "**/*.md",
                    hint: "All markdown files recursively",
                  },
                  {
                    value: "docs/**/*.md",
                    label: "docs/**/*.md",
                    hint: "All markdown files in docs directory",
                  },
                  {
                    value: "custom",
                    label: "Custom pattern",
                    hint: "Enter a custom glob pattern",
                  },
                ],
                required: true,
              }) as Promise<string[]>)
            : undefined,

        customPattern: ({ results }) =>
          results.resourcePatterns?.includes("custom")
            ? (clack.text({
                message: "Enter custom resource pattern:",
                placeholder: "src/**/*.md",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Custom pattern is required";
                  }
                },
              }) as Promise<string>)
            : undefined,

        addPatches: ({ results }) =>
          results.configType === "overlay"
            ? (clack.confirm({
                message: "Add starter patches?",
                initialValue: true,
              }) as Promise<boolean>)
            : undefined,

        patchOperations: ({ results }) =>
          results.addPatches
            ? (clack.multiselect({
                message: "Select patch operations to configure:",
                options: [
                  {
                    value: "replace",
                    label: "Replace",
                    hint: "Simple string replacement",
                  },
                  {
                    value: "remove-section",
                    label: "Remove Section",
                    hint: "Remove a markdown section by ID",
                  },
                  {
                    value: "set-frontmatter",
                    label: "Set Frontmatter",
                    hint: "Set a frontmatter field",
                  },
                  {
                    value: "replace-regex",
                    label: "Replace Regex",
                    hint: "Regex-based replacement",
                  },
                  {
                    value: "prepend-to-section",
                    label: "Prepend to Section",
                    hint: "Add content at start of section",
                  },
                  {
                    value: "append-to-section",
                    label: "Append to Section",
                    hint: "Add content at end of section",
                  },
                ],
              }) as Promise<string[]>)
            : undefined,

        onNoMatch: ({ results }) =>
          results.addPatches && results.patchOperations && results.patchOperations.length > 0
            ? (clack.select({
                message: "What should happen when a patch doesn't match?",
                options: [
                  {
                    value: "skip",
                    label: "Skip",
                    hint: "Silently skip patches that don't match",
                  },
                  {
                    value: "warn",
                    label: "Warn",
                    hint: "Show warnings for patches that don't match",
                  },
                  {
                    value: "error",
                    label: "Error",
                    hint: "Fail the build if patches don't match",
                  },
                ],
                initialValue: "warn",
              }) as Promise<"skip" | "warn" | "error">)
            : undefined,
      },
      {
        onCancel: () => {
          clack.cancel("Configuration creation cancelled");
          process.exit(0);
        },
      },
    );

    // Collect patch details if operations were selected
    const patches: PatchOperation[] = [];
    if (answers.patchOperations && answers.patchOperations.length > 0) {
      clack.note("Configure each patch operation. Press Ctrl+C to skip any operation.");

      for (const op of answers.patchOperations) {
        try {
          const patchDetails = await collectPatchDetails(op);
          if (patchDetails) {
            patches.push(patchDetails as unknown as PatchOperation);
          }
        } catch (error) {
          // User cancelled this patch, skip it
        }
      }
    }

    // Build the configuration
    const config = buildConfig(answers, patches);

    // Determine the config file path
    const configPath = path.endsWith("kustomark.yaml") ? path : join(path, "kustomark.yaml");
    const configDir = path.endsWith("kustomark.yaml") ? path.slice(0, -15) : path;

    // Create directory if it doesn't exist
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write the config file
    const configYaml = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    writeFileSync(configPath, configYaml, "utf-8");

    // Create output directory if specified
    if (answers.output && answers.output !== "./output") {
      const outputDir = resolve(configDir, answers.output);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
    }

    clack.outro(
      `Configuration created successfully at ${configPath}\n\nNext steps:\n  ${answers.configType === "base" ? "Add markdown files to the directory" : "Review and customize the patches"}\n  Run: kustomark build ${configPath}`,
    );

    return 0;
  } catch (error) {
    if (error instanceof Error) {
      clack.cancel(error.message);
    } else {
      clack.cancel("An unexpected error occurred");
    }
    return 1;
  }
}

/**
 * Collect details for a specific patch operation
 */
async function collectPatchDetails(op: string): Promise<PatchDetails | null> {
  const spinner = clack.spinner();
  spinner.start(`Configuring ${op} patch`);
  spinner.stop(`Configure ${op} patch`);

  try {
    switch (op) {
      case "replace": {
        const details = await clack.group(
          {
            old: () =>
              clack.text({
                message: "Text to find:",
                placeholder: "old text",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Old text is required";
                  }
                },
              }),
            new: () =>
              clack.text({
                message: "Replacement text:",
                placeholder: "new text",
                validate: (value) => {
                  if (value === undefined || value === null) {
                    return "Replacement text is required (use empty string for deletion)";
                  }
                },
              }),
            include: () =>
              clack.text({
                message: "Include pattern (optional):",
                placeholder: "**/*.md",
              }),
          },
          {
            onCancel: () => {
              throw new Error("Cancelled");
            },
          },
        );

        return {
          op: "replace",
          old: details.old,
          new: details.new,
          ...(details.include && { include: details.include }),
        };
      }

      case "remove-section": {
        const details = await clack.group(
          {
            id: () =>
              clack.text({
                message: "Section ID to remove:",
                placeholder: "section-slug",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Section ID is required";
                  }
                },
              }),
            includeChildren: () =>
              clack.confirm({
                message: "Include child sections?",
                initialValue: true,
              }),
            include: () =>
              clack.text({
                message: "Include pattern (optional):",
                placeholder: "**/*.md",
              }),
          },
          {
            onCancel: () => {
              throw new Error("Cancelled");
            },
          },
        );

        return {
          op: "remove-section",
          id: details.id,
          includeChildren: details.includeChildren,
          ...(details.include && { include: details.include }),
        };
      }

      case "set-frontmatter": {
        const details = await clack.group(
          {
            key: () =>
              clack.text({
                message: "Frontmatter key:",
                placeholder: "title",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Key is required";
                  }
                },
              }),
            value: () =>
              clack.text({
                message: "Frontmatter value:",
                placeholder: "My Document",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Value is required";
                  }
                },
              }),
            include: () =>
              clack.text({
                message: "Include pattern (optional):",
                placeholder: "**/*.md",
              }),
          },
          {
            onCancel: () => {
              throw new Error("Cancelled");
            },
          },
        );

        // Try to parse value as JSON/YAML for complex types
        let parsedValue: unknown = details.value;
        try {
          parsedValue = yaml.load(details.value);
        } catch {
          // Keep as string if not valid YAML
          parsedValue = details.value;
        }

        return {
          op: "set-frontmatter",
          key: details.key,
          value: parsedValue,
          ...(details.include && { include: details.include }),
        };
      }

      case "replace-regex": {
        const details = await clack.group(
          {
            pattern: () =>
              clack.text({
                message: "Regex pattern:",
                placeholder: "\\b\\w+\\b",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Pattern is required";
                  }
                  try {
                    new RegExp(value);
                  } catch {
                    return "Invalid regex pattern";
                  }
                },
              }),
            replacement: () =>
              clack.text({
                message: "Replacement string:",
                placeholder: "$1",
              }),
            flags: () =>
              clack.text({
                message: "Regex flags (optional):",
                placeholder: "gi",
              }),
            include: () =>
              clack.text({
                message: "Include pattern (optional):",
                placeholder: "**/*.md",
              }),
          },
          {
            onCancel: () => {
              throw new Error("Cancelled");
            },
          },
        );

        return {
          op: "replace-regex",
          pattern: details.pattern,
          replacement: details.replacement || "",
          ...(details.flags && { flags: details.flags }),
          ...(details.include && { include: details.include }),
        };
      }

      case "prepend-to-section": {
        const details = await clack.group(
          {
            id: () =>
              clack.text({
                message: "Section ID:",
                placeholder: "section-slug",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Section ID is required";
                  }
                },
              }),
            content: () =>
              clack.text({
                message: "Content to prepend:",
                placeholder: "New content...",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Content is required";
                  }
                },
              }),
            include: () =>
              clack.text({
                message: "Include pattern (optional):",
                placeholder: "**/*.md",
              }),
          },
          {
            onCancel: () => {
              throw new Error("Cancelled");
            },
          },
        );

        return {
          op: "prepend-to-section",
          id: details.id,
          content: details.content,
          ...(details.include && { include: details.include }),
        };
      }

      case "append-to-section": {
        const details = await clack.group(
          {
            id: () =>
              clack.text({
                message: "Section ID:",
                placeholder: "section-slug",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Section ID is required";
                  }
                },
              }),
            content: () =>
              clack.text({
                message: "Content to append:",
                placeholder: "New content...",
                validate: (value) => {
                  if (!value || value.trim() === "") {
                    return "Content is required";
                  }
                },
              }),
            include: () =>
              clack.text({
                message: "Include pattern (optional):",
                placeholder: "**/*.md",
              }),
          },
          {
            onCancel: () => {
              throw new Error("Cancelled");
            },
          },
        );

        return {
          op: "append-to-section",
          id: details.id,
          content: details.content,
          ...(details.include && { include: details.include }),
        };
      }

      default:
        clack.log.warn(`Unknown operation: ${op}`);
        return null;
    }
  } catch (error) {
    // User cancelled this patch
    return null;
  }
}

/**
 * Build the final configuration from wizard answers
 */
function buildConfig(answers: WizardAnswers, patches: PatchOperation[]): KustomarkConfig {
  const config: KustomarkConfig = {
    apiVersion: "kustomark/v1",
    kind: "Kustomization",
    output: answers.output || "./output",
    resources: [],
  };

  // Add resources based on config type
  if (answers.configType === "base") {
    // Build resource patterns
    const patterns: string[] = [];
    if (answers.resourcePatterns) {
      for (const pattern of answers.resourcePatterns) {
        if (pattern === "custom" && answers.customPattern) {
          patterns.push(answers.customPattern);
        } else if (pattern !== "custom") {
          patterns.push(pattern);
        }
      }
    }
    config.resources = patterns.length > 0 ? patterns : ["**/*.md"];
  } else if (answers.configType === "overlay" && answers.baseConfig) {
    config.resources = [answers.baseConfig];
  }

  // Add patches if configured
  if (patches.length > 0) {
    config.patches = patches;
  }

  // Add onNoMatch strategy if specified
  if (answers.onNoMatch) {
    config.onNoMatch = answers.onNoMatch;
  }

  return config;
}
