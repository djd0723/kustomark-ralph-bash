/**
 * CLI command for fixing failed patches interactively
 * Provides intelligent suggestions and interactive prompts for patches that failed to match
 *
 * Features:
 * - Analyzes patches that failed to apply and identifies the cause
 * - Generates intelligent fix suggestions using the suggestion engine
 * - Interactive mode with step-by-step prompts for each failed patch
 * - Auto-apply mode with configurable confidence threshold
 * - Support for selecting, editing, skipping, or deleting failed patches
 * - Saves fixed configuration to original file or a new file
 *
 * Usage:
 * - Interactive: kustomark fix ./path/to/config
 * - Auto-apply: kustomark fix ./path/to/config --auto-apply
 * - With threshold: kustomark fix ./path/to/config --auto-apply --confidence-threshold=90
 * - Save to new file: kustomark fix ./path/to/config --save-to=./fixed-config.yaml
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import * as clack from "@clack/prompts";
import * as yaml from "js-yaml";
import { parseConfig, validateConfig } from "../core/config-parser.js";
import { loadLockFile } from "../core/lock-file.js";
import { applyPatches } from "../core/patch-engine.js";
import { resolveResources } from "../core/resource-resolver.js";
import { generatePatchSuggestions } from "../core/suggestion-engine.js";
import type { KustomarkConfig, LockFile, LockFileEntry, PatchOperation } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface CLIOptions {
  format: "text" | "json";
  verbosity: number;
  autoApply?: boolean;
  confidenceThreshold?: number;
  saveTo?: string;
  quiet?: boolean;
}

interface FailedPatch {
  patchIndex: number;
  patch: PatchOperation;
  file: string;
  error: string;
  suggestions: FixSuggestion[];
}

interface FixSuggestion {
  description: string;
  confidence: number;
  patch: PatchOperation;
}

interface FixSession {
  failedPatches: FailedPatch[];
  config: KustomarkConfig;
  configPath: string;
  stats: {
    fixed: number;
    skipped: number;
    deleted: number;
  };
}

interface FixResult {
  success: boolean;
  stats: {
    fixed: number;
    skipped: number;
    deleted: number;
    total: number;
  };
  configSaved?: string;
  error?: string;
}

// ============================================================================
// Editor Helper Functions
// ============================================================================

/**
 * Open a patch in the user's editor for manual editing
 * @param patch - The patch to edit
 * @returns The edited patch, or null if editing was cancelled/failed
 */
function editPatchInEditor(patch: PatchOperation): PatchOperation | null {
  // Get the user's preferred editor
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";

  // Create a temporary file
  const tempDir = mkdtempSync(join(tmpdir(), "kustomark-fix-"));
  const tempFile = join(tempDir, "patch.yaml");

  try {
    // Write the patch to the temp file
    const patchYaml = yaml.dump([patch], {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
    writeFileSync(tempFile, patchYaml, "utf-8");

    // Open the editor
    clack.log.info(`Opening ${editor}... (save and quit to apply changes)`);
    const result = spawnSync(editor, [tempFile], {
      stdio: "inherit",
      shell: true,
    });

    // Check if the editor exited successfully
    if (result.status !== 0) {
      clack.log.error("Editor exited with error");
      return null;
    }

    // Read the edited content
    const editedContent = readFileSync(tempFile, "utf-8");

    // Parse the edited YAML
    const parsed = yaml.load(editedContent);

    // Validate that it's a valid patch array
    if (!Array.isArray(parsed) || parsed.length === 0) {
      clack.log.error("Invalid YAML format - expected an array with one patch");
      return null;
    }

    const editedPatch = parsed[0] as PatchOperation;

    // Basic validation - ensure it has an op field
    if (!editedPatch || typeof editedPatch !== "object" || !("op" in editedPatch)) {
      clack.log.error("Invalid patch format - missing 'op' field");
      return null;
    }

    return editedPatch;
  } catch (error) {
    clack.log.error(
      `Failed to edit patch: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  } finally {
    // Clean up the temp file
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// Patch Analysis Functions
// ============================================================================

/**
 * Analyze patches and find failures
 */
async function analyzePatches(
  config: KustomarkConfig,
  basePath: string,
  fileMap: Map<string, string>,
): Promise<FailedPatch[]> {
  const failedPatches: FailedPatch[] = [];
  const patches = config.patches || [];

  // For each patch, try to apply it to all matching files
  for (let patchIndex = 0; patchIndex < patches.length; patchIndex++) {
    const patch = patches[patchIndex];
    if (!patch) continue;

    // Find files that match this patch's include/exclude patterns
    for (const [filePath, content] of Array.from(fileMap.entries())) {
      // Check if patch should apply to this file
      if (!shouldApplyPatch(patch, filePath, basePath)) {
        continue;
      }

      // Try to apply the patch
      const result = await applyPatches(content, [patch], "skip", false);

      // Check if patch failed (had warnings)
      if (result.warnings.length > 0) {
        const warning = result.warnings[0];
        if (warning) {
          const suggestions = generateFixSuggestions(patch, content, warning.message);
          failedPatches.push({
            patchIndex,
            patch,
            file: filePath,
            error: warning.message,
            suggestions,
          });
        }
      }
    }
  }

  return failedPatches;
}

/**
 * Check if a patch should apply to a file
 */
function shouldApplyPatch(patch: PatchOperation, filePath: string, basePath: string): boolean {
  const relativePath = filePath.startsWith(basePath)
    ? filePath.slice(basePath.length + 1)
    : filePath;

  // Check include patterns
  if (patch.include) {
    const patterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    const matches = patterns.some((pattern) => {
      // Simple glob matching
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
      return regex.test(relativePath);
    });
    if (!matches) return false;
  }

  // Check exclude patterns
  if (patch.exclude) {
    const patterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    const matches = patterns.some((pattern) => {
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
      return regex.test(relativePath);
    });
    if (matches) return false;
  }

  return true;
}

/**
 * Generate fix suggestions for a failed patch
 */
function generateFixSuggestions(
  patch: PatchOperation,
  content: string,
  error: string,
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  const patchSuggestions = generatePatchSuggestions(patch, content, error);

  // Convert text suggestions to fix suggestions with confidence scores
  for (const suggestion of patchSuggestions) {
    let confidence = 50; // Base confidence
    let fixedPatch: PatchOperation | null = null;

    // Parse "Did you mean 'xyz'?" suggestions
    const didYouMeanMatch = suggestion.match(/Did you mean '([^']+)'\?/);
    if (didYouMeanMatch?.[1]) {
      confidence = 85;
      fixedPatch = createFixedPatch(patch, didYouMeanMatch[1]);
    } else if (suggestion.includes("case-insensitive")) {
      confidence = 75;
      // For case-insensitive suggestions, we can't auto-fix but provide high confidence
      fixedPatch = patch; // Keep original
    } else if (suggestion.includes("Available")) {
      confidence = 30;
      // List of available options - lower confidence
      fixedPatch = patch;
    }

    if (fixedPatch) {
      suggestions.push({
        description: suggestion,
        confidence,
        patch: fixedPatch,
      });
    }
  }

  // If no specific suggestions, add a generic one
  if (suggestions.length === 0) {
    suggestions.push({
      description: "Manual edit required",
      confidence: 0,
      patch,
    });
  }

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions.slice(0, 5); // Top 5 suggestions
}

/**
 * Create a fixed patch based on a suggestion
 */
function createFixedPatch(original: PatchOperation, suggestedValue: string): PatchOperation {
  const fixed = { ...original };

  // Update the appropriate field based on operation type
  switch (original.op) {
    case "remove-section":
    case "replace-section":
    case "prepend-to-section":
    case "append-to-section":
    case "rename-header":
    case "move-section":
    case "change-section-level":
      if ("id" in fixed) {
        fixed.id = suggestedValue;
      }
      break;

    case "remove-frontmatter":
    case "rename-frontmatter":
      if ("key" in fixed) {
        fixed.key = suggestedValue;
      } else if ("old" in fixed) {
        fixed.old = suggestedValue;
      }
      break;

    case "replace-line":
      if ("match" in fixed) {
        fixed.match = suggestedValue;
      }
      break;

    case "insert-after-line":
    case "insert-before-line":
      if ("match" in fixed) {
        fixed.match = suggestedValue;
      }
      break;
  }

  return fixed;
}

// ============================================================================
// Interactive Fix Loop
// ============================================================================

/**
 * Run interactive fix session
 */
async function runInteractiveSession(session: FixSession, options: CLIOptions): Promise<void> {
  if (session.failedPatches.length === 0) {
    clack.log.success("No failed patches found!");
    return;
  }

  clack.intro("Fix Failed Patches");

  const totalPatches = session.failedPatches.length;
  let currentIndex = 0;

  for (const failed of session.failedPatches) {
    currentIndex++;

    // Display patch information
    clack.note(
      `Patch: ${failed.patch.op}\nFile: ${failed.file}\nError: ${failed.error}`,
      `Failed Patch ${currentIndex}/${totalPatches}`,
    );

    // Display suggestions if available
    if (failed.suggestions.length > 0 && failed.suggestions[0]) {
      const topSuggestions = failed.suggestions.slice(0, 3);
      const suggestionText = topSuggestions
        .map((s, i) => `${i + 1}. [${s.confidence}%] ${s.description}`)
        .join("\n");
      clack.log.info(`Suggestions:\n${suggestionText}`);
    }

    // Auto-apply if confidence threshold is met
    const topSuggestion = failed.suggestions[0];
    const threshold = options.confidenceThreshold || 80;

    if (options.autoApply && topSuggestion && topSuggestion.confidence >= threshold) {
      clack.log.success(`Auto-applying suggestion with ${topSuggestion.confidence}% confidence`);
      if (session.config.patches) {
        session.config.patches[failed.patchIndex] = topSuggestion.patch;
      }
      session.stats.fixed++;
      continue;
    }

    // Interactive prompt
    const action = await clack.select({
      message: "What would you like to do?",
      options: [
        ...(topSuggestion && topSuggestion.confidence > 0
          ? [
              {
                value: "auto",
                label: `Auto-fix with suggestion #1 (${topSuggestion.confidence}% confidence)`,
                hint: topSuggestion.description,
              },
            ]
          : []),
        {
          value: "select",
          label: "Select a suggestion",
          hint: "Choose from available suggestions",
        },
        {
          value: "edit",
          label: "Edit manually",
          hint: "Open editor to modify patch",
        },
        {
          value: "skip",
          label: "Skip this patch",
          hint: "Leave patch as-is",
        },
        {
          value: "delete",
          label: "Delete this patch",
          hint: "Remove patch from config",
        },
        {
          value: "quit",
          label: "Quit",
          hint: "Exit without saving",
        },
      ],
    });

    if (clack.isCancel(action) || action === "quit") {
      const confirm = await clack.confirm({
        message: "Are you sure you want to quit without saving?",
      });

      if (confirm) {
        clack.cancel("Fix session cancelled");
        process.exit(0);
      } else {
        // Continue to next iteration
        continue;
      }
    }

    switch (action) {
      case "auto": {
        if (topSuggestion && session.config.patches) {
          session.config.patches[failed.patchIndex] = topSuggestion.patch;
          session.stats.fixed++;
          clack.log.success("Applied suggestion");
        }
        break;
      }

      case "select": {
        const choices = failed.suggestions.map((s, i) => ({
          value: i,
          label: `[${s.confidence}%] ${s.description}`,
        }));

        const selected = await clack.select({
          message: "Select a suggestion:",
          options: choices,
        });

        if (!clack.isCancel(selected) && typeof selected === "number") {
          const suggestion = failed.suggestions[selected];
          if (suggestion && session.config.patches) {
            session.config.patches[failed.patchIndex] = suggestion.patch;
            session.stats.fixed++;
            clack.log.success("Applied selected suggestion");
          }
        }
        break;
      }

      case "edit": {
        const editedPatch = editPatchInEditor(failed.patch);
        if (editedPatch && session.config.patches) {
          session.config.patches[failed.patchIndex] = editedPatch;
          session.stats.fixed++;
          clack.log.success("Patch updated with manual edits");
        } else {
          clack.log.warn("Edit cancelled or invalid - patch not changed");
          session.stats.skipped++;
        }
        break;
      }

      case "skip": {
        session.stats.skipped++;
        clack.log.info("Skipped patch");
        break;
      }

      case "delete": {
        const confirm = await clack.confirm({
          message: "Are you sure you want to delete this patch?",
        });

        if (confirm && session.config.patches) {
          // Mark for deletion by setting to undefined
          session.config.patches[failed.patchIndex] = undefined as unknown as PatchOperation;
          session.stats.deleted++;
          clack.log.success("Patch deleted");
        }
        break;
      }
    }
  }
}

// ============================================================================
// Auto-Apply Mode
// ============================================================================

/**
 * Run auto-apply mode
 */
function runAutoApply(session: FixSession, options: CLIOptions): void {
  const threshold = options.confidenceThreshold || 80;

  for (const failed of session.failedPatches) {
    const topSuggestion = failed.suggestions[0];

    if (topSuggestion && topSuggestion.confidence >= threshold && session.config.patches) {
      session.config.patches[failed.patchIndex] = topSuggestion.patch;
      session.stats.fixed++;

      if (options.verbosity >= 2) {
        console.log(
          `Fixed patch ${failed.patchIndex} with ${topSuggestion.confidence}% confidence: ${topSuggestion.description}`,
        );
      }
    } else {
      session.stats.skipped++;

      if (options.verbosity >= 2) {
        console.log(
          `Skipped patch ${failed.patchIndex}: confidence ${topSuggestion?.confidence || 0}% below threshold ${threshold}%`,
        );
      }
    }
  }
}

// ============================================================================
// Save Functions
// ============================================================================

/**
 * Save the fixed configuration
 */
async function saveConfiguration(session: FixSession, options: CLIOptions): Promise<string> {
  // Remove deleted patches (those marked as undefined)
  if (session.config.patches) {
    session.config.patches = session.config.patches.filter((p) => p !== undefined);
  }

  // Serialize to YAML
  const configYaml = yaml.dump(session.config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });

  // Determine save path
  const savePath = options.saveTo || session.configPath;

  // Write file
  writeFileSync(savePath, configYaml, "utf-8");

  return savePath;
}

// ============================================================================
// Main Command Function
// ============================================================================

/**
 * Main fix command implementation
 * Analyzes failed patches and provides interactive fixing
 */
export async function fixCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);

    // Determine the actual config file path
    let configPath = inputPath;
    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(configPath);

    // Load config
    if (options.verbosity >= 2) {
      console.log(`Loading config from ${configPath}...`);
    }

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const configContent = readFileSync(configPath, "utf-8");
    const config: KustomarkConfig = parseConfig(configContent);

    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new Error(`Invalid configuration: ${errorMessages}`);
    }

    // Load lock file
    let lockFile: LockFile | null = null;
    const lockEntries: LockFileEntry[] = [];

    try {
      lockFile = loadLockFile(configPath);
    } catch {
      // Lock file is optional
    }

    // Build file map by scanning directory
    if (options.verbosity >= 2) {
      console.log("Scanning for markdown files...");
    }

    const fileMap = new Map<string, string>();
    const normalizedBasePath = normalize(basePath);

    // Use resource resolver to get files
    const resolvedResources = await resolveResources(config.resources, basePath, fileMap, {
      lockFile: lockFile ?? undefined,
      updateLock: false,
      lockEntries,
    });

    // Build file map from resolved resources
    for (const resource of resolvedResources) {
      fileMap.set(resource.path, resource.content);
    }

    if (fileMap.size === 0) {
      throw new Error("No resources found to process");
    }

    if (options.verbosity >= 2) {
      console.log(`Found ${fileMap.size} file(s)`);
    }

    // Analyze patches to find failures
    if (options.verbosity >= 2) {
      console.log("Analyzing patches...");
    }

    const failedPatches = await analyzePatches(config, normalizedBasePath, fileMap);

    if (failedPatches.length === 0) {
      if (options.format === "json") {
        const result: FixResult = {
          success: true,
          stats: {
            fixed: 0,
            skipped: 0,
            deleted: 0,
            total: 0,
          },
        };
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log("No failed patches found. All patches applied successfully!");
      }
      return 0;
    }

    // Create fix session
    const session: FixSession = {
      failedPatches,
      config,
      configPath,
      stats: {
        fixed: 0,
        skipped: 0,
        deleted: 0,
      },
    };

    if (options.verbosity >= 1) {
      console.log(`Found ${failedPatches.length} failed patch(es)`);
    }

    // Run fix mode
    if (options.autoApply) {
      if (options.verbosity >= 2) {
        console.log("Running in auto-apply mode...");
      }
      runAutoApply(session, options);
    } else {
      await runInteractiveSession(session, options);
    }

    // Show summary
    const totalChanges = session.stats.fixed + session.stats.deleted;

    if (totalChanges > 0) {
      if (!options.quiet && options.format !== "json") {
        console.log("\nSummary:");
        console.log(`  Fixed: ${session.stats.fixed}`);
        console.log(`  Skipped: ${session.stats.skipped}`);
        console.log(`  Deleted: ${session.stats.deleted}`);
      }

      // Ask to save changes (interactive mode only)
      if (!options.autoApply && !options.saveTo) {
        const shouldSave = await clack.confirm({
          message: "Save changes to configuration?",
          initialValue: true,
        });

        if (clack.isCancel(shouldSave) || !shouldSave) {
          clack.outro("Changes discarded");
          return 0;
        }
      }

      // Save configuration
      const savedPath = await saveConfiguration(session, options);

      if (options.format === "json") {
        const result: FixResult = {
          success: true,
          stats: {
            fixed: session.stats.fixed,
            skipped: session.stats.skipped,
            deleted: session.stats.deleted,
            total: failedPatches.length,
          },
          configSaved: savedPath,
        };
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        clack.outro(`Configuration saved to ${savedPath}`);
      }
    } else {
      if (options.format === "json") {
        const result: FixResult = {
          success: true,
          stats: {
            fixed: 0,
            skipped: session.stats.skipped,
            deleted: 0,
            total: failedPatches.length,
          },
        };
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        clack.outro("No changes made");
      }
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.format === "json") {
      const result: FixResult = {
        success: false,
        stats: {
          fixed: 0,
          skipped: 0,
          deleted: 0,
          total: 0,
        },
        error: errorMessage,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    return 1;
  }
}
