/**
 * Preview service for executing kustomark dry-run builds
 * Applies patches without writing files and returns diff data
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, normalize, relative, resolve } from "node:path";
import micromatch from "micromatch";
import { applyPatches } from "../../../core/patch-engine.js";
import { resolveInheritance } from "../../../core/patch-inheritance.js";
import { generatePreview } from "../../../core/preview-generator.js";
import { resolveResources } from "../../../core/resource-resolver.js";
import type { KustomarkConfig, PatchOperation } from "../../../core/types.js";
import type { PreviewResponse } from "../types.js";

/**
 * Recursively scan a directory and return a map of file paths to contents
 */
function buildFileMap(dir: string): Map<string, string> {
  const fileMap = new Map<string, string>();

  function scan(scanDir: string): void {
    try {
      const entries = readdirSync(scanDir);
      for (const entry of entries) {
        const fullPath = resolve(scanDir, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            scan(fullPath);
          } else if (stats.isFile()) {
            const content = readFileSync(fullPath, "utf-8");
            fileMap.set(fullPath, content);
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  scan(dir);
  return fileMap;
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

  if (!patchGroup) {
    return true;
  }

  if (enableGroups && enableGroups.length > 0) {
    return enableGroups.includes(patchGroup);
  }

  if (disableGroups && disableGroups.length > 0) {
    return !disableGroups.includes(patchGroup);
  }

  return true;
}

/**
 * Check if a patch should be applied to a file based on include/exclude patterns
 */
function shouldApplyPatch(patch: PatchOperation, filePath: string): boolean {
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    if (!micromatch.isMatch(filePath, includePatterns)) {
      return false;
    }
  }

  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    if (micromatch.isMatch(filePath, excludePatterns)) {
      return false;
    }
  }

  return true;
}

/**
 * Execute a dry-run preview build — resolves resources and applies patches
 * without writing any files to disk.
 *
 * @param baseDir - Base directory for resolving paths
 * @param configPath - Path to config file (relative to baseDir)
 * @param config - Parsed kustomark config
 * @param enableGroups - Groups to enable (whitelist)
 * @param disableGroups - Groups to disable (blacklist)
 * @returns Preview result with per-file before/after diffs
 */
export async function executePreview(
  baseDir: string,
  configPath: string,
  config: KustomarkConfig,
  enableGroups?: string[],
  disableGroups?: string[],
): Promise<PreviewResponse> {
  const startTime = Date.now();

  // Resolve config directory
  const configDir = dirname(resolve(baseDir, configPath));

  // Build file map by scanning the config directory (needed by resolveResources)
  const fileMap = buildFileMap(configDir);

  // Resolve resources
  const resolvedResources = await resolveResources(config.resources, configDir, fileMap);

  // Build original files map with relative paths
  const originalFiles = new Map<string, string>();
  for (const resource of resolvedResources) {
    const normalizedPath = normalize(resource.path);
    const resourceBaseDir = resource.baseDir || configDir;
    const relativePath = relative(resourceBaseDir, normalizedPath);
    originalFiles.set(relativePath, resource.content);
  }

  // Get patches with inheritance resolved
  const patches = config.patches ? resolveInheritance(config.patches) : [];

  // Filter patches by group
  const filteredPatches = patches.filter((patch) =>
    shouldApplyPatchGroup(patch, enableGroups, disableGroups),
  );

  // Apply patches (dry run — no file writes)
  const modifiedFiles = new Map<string, string>();
  for (const [filePath, content] of originalFiles.entries()) {
    const applicablePatches = filteredPatches.filter((patch) => shouldApplyPatch(patch, filePath));

    if (applicablePatches.length === 0) {
      modifiedFiles.set(filePath, content);
      continue;
    }

    const result = await applyPatches(content, applicablePatches, "skip", false);
    modifiedFiles.set(filePath, result.content);
  }

  // Build before/after map for preview generation
  const previewFileMap = new Map<string, { before: string; after: string }>();
  for (const [filePath, before] of originalFiles.entries()) {
    const after = modifiedFiles.get(filePath) ?? before;
    previewFileMap.set(filePath, { before, after });
  }

  const previewResult = generatePreview(previewFileMap);
  const duration = Date.now() - startTime;

  return {
    files: previewResult.files,
    filesChanged: previewResult.filesChanged,
    totalLinesAdded: previewResult.totalLinesAdded,
    totalLinesDeleted: previewResult.totalLinesDeleted,
    totalLinesModified: previewResult.totalLinesModified,
    duration,
  };
}
