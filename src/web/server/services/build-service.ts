/**
 * Build service for executing kustomark builds
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import micromatch from "micromatch";
import { applyPatches } from "../../../core/patch-engine.js";
import { resolveInheritance } from "../../../core/patch-inheritance.js";
import { resolveResources } from "../../../core/resource-resolver.js";
import type {
  KustomarkConfig,
  OnNoMatchStrategy,
  PatchOperation,
  ValidationError,
  ValidationWarning,
} from "../../../core/types.js";
import { runValidators } from "../../../core/validators.js";
import { HttpError } from "../middleware/error-handler.js";
import type { BuildResponse } from "../types.js";

/**
 * Execute a kustomark build
 *
 * @param baseDir - Base directory for resolving paths
 * @param configPath - Path to config file (relative to baseDir)
 * @param config - Parsed kustomark config
 * @param enableGroups - Groups to enable (whitelist)
 * @param disableGroups - Groups to disable (blacklist)
 * @returns Build result
 */
export async function executeBuild(
  baseDir: string,
  configPath: string,
  config: KustomarkConfig,
  enableGroups?: string[],
  disableGroups?: string[],
): Promise<BuildResponse> {
  const startTime = Date.now();

  try {
    // Validate config has output directory
    if (!config.output) {
      throw new HttpError(400, "Config must specify an output directory");
    }

    // Resolve config directory
    const configDir = dirname(resolve(baseDir, configPath));
    const outputDir = resolve(configDir, config.output);

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Resolve resources
    const resolvedResources = await resolveResources(
      config.resources,
      configDir,
      undefined, // lockFile
    );

    const resources = new Map<string, string>();
    for (const resource of resolvedResources) {
      resources.set(resource.path, resource.content);
    }

    // Get patches with inheritance resolved
    const patches = config.patches ? resolveInheritance(config.patches) : [];

    // Filter patches by group
    const filteredPatches = patches.filter((patch) =>
      shouldApplyPatchGroup(patch, enableGroups, disableGroups),
    );

    // Apply patches to resources
    const patchResult = applyPatchesToResources(
      resources,
      filteredPatches,
      config.onNoMatch || "skip",
    );

    // Run global validators
    const validationErrors: ValidationError[] = [...patchResult.validationErrors];
    const validationWarnings: ValidationWarning[] = [];

    if (config.validators && config.validators.length > 0) {
      for (const [filePath, content] of patchResult.resources.entries()) {
        const errors = runValidators(content, config.validators);

        // Add file path to errors
        for (const error of errors) {
          validationErrors.push({
            ...error,
            file: filePath,
          });
        }
      }
    }

    // If there are validation errors, fail the build
    if (validationErrors.length > 0) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        filesWritten: 0,
        patchesApplied: 0,
        duration,
        errors: validationErrors,
        warnings: validationWarnings,
        error: `Build failed with ${validationErrors.length} validation error(s)`,
      };
    }

    // Write output files
    let filesWritten = 0;
    for (const [filePath, content] of patchResult.resources.entries()) {
      const outputPath = join(outputDir, filePath);

      // Ensure parent directory exists
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write file
      writeFileSync(outputPath, content, "utf-8");
      filesWritten++;
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      filesWritten,
      patchesApplied: patchResult.patchesApplied,
      duration,
      warnings: validationWarnings,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof HttpError) {
      throw error;
    }

    return {
      success: false,
      filesWritten: 0,
      patchesApplied: 0,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply patches to a map of resources
 */
function applyPatchesToResources(
  resources: Map<string, string>,
  patches: PatchOperation[],
  onNoMatch: OnNoMatchStrategy,
): {
  resources: Map<string, string>;
  patchesApplied: number;
  validationErrors: ValidationError[];
} {
  const patchedResources = new Map<string, string>();
  let totalPatchesApplied = 0;
  const allValidationErrors: ValidationError[] = [];

  for (const [filePath, content] of resources.entries()) {
    // Filter patches applicable to this file
    const applicablePatches = patches.filter((patch) => shouldApplyPatch(patch, filePath));

    if (applicablePatches.length === 0) {
      // No patches for this file, keep original content
      patchedResources.set(filePath, content);
      continue;
    }

    // Apply all applicable patches
    const result = applyPatches(content, applicablePatches, onNoMatch, false);
    patchedResources.set(filePath, result.content);
    totalPatchesApplied += result.applied;

    // Collect validation errors
    for (const error of result.validationErrors) {
      allValidationErrors.push({
        ...error,
        file: filePath,
      });
    }
  }

  return {
    resources: patchedResources,
    patchesApplied: totalPatchesApplied,
    validationErrors: allValidationErrors,
  };
}

/**
 * Check if a patch should be applied based on group filtering
 */
function shouldApplyPatchGroup(
  patch: PatchOperation,
  enableGroups?: string[],
  disableGroups?: string[],
): boolean {
  const patchGroup = patch.group;

  // Patches without a group are always enabled
  if (!patchGroup) {
    return true;
  }

  // If both are specified, enableGroups takes precedence
  if (enableGroups && enableGroups.length > 0) {
    return enableGroups.includes(patchGroup);
  }

  // If only disableGroups is specified
  if (disableGroups && disableGroups.length > 0) {
    return !disableGroups.includes(patchGroup);
  }

  // No group filtering specified, allow all
  return true;
}

/**
 * Check if a patch should be applied to a file based on include/exclude patterns
 */
function shouldApplyPatch(patch: PatchOperation, filePath: string): boolean {
  // If include is specified, file must match at least one include pattern
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    const matches = micromatch.isMatch(filePath, includePatterns);
    if (!matches) {
      return false;
    }
  }

  // If exclude is specified, file must not match any exclude pattern
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    const matches = micromatch.isMatch(filePath, excludePatterns);
    if (matches) {
      return false;
    }
  }

  return true;
}
