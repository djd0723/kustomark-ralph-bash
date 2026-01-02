/**
 * Dependency graph module for tracking file relationships in kustomark
 *
 * This module builds and manages a dependency graph that tracks:
 * - Source file → Output file (1:1 mapping)
 * - Config file → All output files
 * - Patches (via include/exclude) → Matching files
 * - Referenced configs → Their outputs
 */

import { normalize } from "node:path";
import micromatch from "micromatch";
import type { DependencyGraph, DependencyNode, KustomarkConfig, PatchOperation } from "./types.js";

/**
 * Build a dependency graph from config and files
 *
 * @param config - Kustomark configuration
 * @param files - Map of file paths to their content
 * @param configPath - Absolute path to the config file (default: "/kustomark.yaml")
 * @returns Dependency graph showing relationships between files
 *
 * @example
 * ```typescript
 * const files = new Map([
 *   ['docs/api.md', '# API'],
 *   ['docs/guide.md', '# Guide']
 * ]);
 * const graph = buildDependencyGraph(config, files, '/project/kustomark.yaml');
 * ```
 */
export function buildDependencyGraph(
  config: KustomarkConfig,
  files: Map<string, string>,
  configPath = "/kustomark.yaml",
): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: new Map(),
    configPath: normalize(configPath),
    configDependencies: [],
    patchGroups: [],
  };

  // Get all file paths
  const filePaths = Array.from(files.keys());

  // Check for config dependencies in resources field
  const configDeps = (config.resources || []).filter(
    (resource) => resource.endsWith("/") || resource.includes("../"),
  );
  graph.configDependencies = configDeps;

  // Collect unique patch groups
  const patchGroups = new Set<string>();
  if (config.patches) {
    for (const patch of config.patches) {
      if (patch.group) {
        patchGroups.add(patch.group);
      }
    }
  }
  graph.patchGroups = Array.from(patchGroups);

  // Create nodes for all files
  for (const filePath of filePaths) {
    const node: DependencyNode = {
      path: filePath,
      dependencies: [],
      dependents: new Set(),
      appliedPatches: [],
    };

    // If there are config dependencies, all files depend on the config
    if (graph.configDependencies.length > 0) {
      node.dependencies.push("config");
    }

    // Determine which patches apply to this file
    if (config.patches) {
      for (let i = 0; i < config.patches.length; i++) {
        const patch = config.patches[i];
        if (patch && doesPatchApplyToFile(patch, filePath, filePaths)) {
          node.appliedPatches.push(i);
        }
      }
    }

    graph.nodes.set(filePath, node);
  }

  return graph;
}

/**
 * Get all files affected by changes to patches or configs
 *
 * @param graph - The dependency graph
 * @param changedPatchIndices - Indices of patches that changed
 * @param changedConfigs - Optional array of config paths that changed
 * @returns Set of file paths affected by the changes
 *
 * @example
 * ```typescript
 * const affected = getAffectedFiles(graph, [0, 1]); // Patches 0 and 1 changed
 * const affected2 = getAffectedFiles(graph, [], ["../base/"]); // Base config changed
 * ```
 */
export function getAffectedFiles(
  graph: DependencyGraph,
  changedPatchIndices: number[],
  changedConfigs: string[] = [],
): Set<string> {
  const affected = new Set<string>();

  // If configs changed, all files that depend on configs are affected
  if (changedConfigs.length > 0) {
    for (const [filePath, node] of graph.nodes) {
      // Check if this file depends on any of the changed configs
      if (node.dependencies.includes("config")) {
        const hasChangedConfig = changedConfigs.some((changedConfig) =>
          graph.configDependencies.includes(changedConfig),
        );
        if (hasChangedConfig) {
          affected.add(filePath);
        }
      }
    }
  }

  // Check which files are affected by the changed patches
  for (const [filePath, node] of graph.nodes) {
    for (const patchIndex of changedPatchIndices) {
      if (node.appliedPatches.includes(patchIndex)) {
        affected.add(filePath);
        break;
      }
    }
  }

  return affected;
}

/**
 * Get dependencies for a specific file
 *
 * @param graph - The dependency graph
 * @param filePath - Path to the file
 * @returns Object with patches and configs that affect this file
 *
 * @example
 * ```typescript
 * const deps = getDependencies(graph, "docs/api.md");
 * console.log(deps.patches); // [0, 1, 2] - patch indices
 * console.log(deps.configs); // ["../base/"] - config paths
 * ```
 */
export function getDependencies(
  graph: DependencyGraph,
  filePath: string,
): { patches: number[]; configs: string[] } {
  const node = graph.nodes.get(filePath);

  if (!node) {
    return { patches: [], configs: [] };
  }

  const configs = node.dependencies.includes("config") ? graph.configDependencies : [];

  return {
    patches: node.appliedPatches,
    configs,
  };
}

/**
 * Check if a patch applies to a specific file
 *
 * @param patch - The patch operation
 * @param filePath - Path to the file
 * @param _allFiles - All file paths in the project (unused but kept for API consistency)
 * @returns True if the patch applies to this file
 */
function doesPatchApplyToFile(
  patch: PatchOperation,
  filePath: string,
  _allFiles: string[],
): boolean {
  // Check include patterns
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    const matchesInclude = includePatterns.some((pattern) => matchesPattern(filePath, pattern));
    if (!matchesInclude) {
      return false;
    }
  }

  // Check exclude patterns
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    const matchesExclude = excludePatterns.some((pattern) => matchesPattern(filePath, pattern));
    if (matchesExclude) {
      return false;
    }
  }

  // If no include/exclude patterns, or file passed all checks, patch applies
  return true;
}

/**
 * Check if a file path matches a glob pattern
 *
 * @param filePath - Path to check
 * @param pattern - Glob pattern to match against
 * @returns True if the file matches the pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  return micromatch.isMatch(filePath, pattern, {
    dot: true,
    matchBase: false,
    bash: true,
    nobrace: false,
    noextglob: false,
  });
}
