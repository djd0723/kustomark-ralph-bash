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
 * Build a dependency graph from resources, patches, and config
 *
 * @param resources - Map of absolute file paths to their content
 * @param patches - Array of patch operations
 * @param config - Kustomark configuration
 * @param configPath - Absolute path to the config file
 * @returns Dependency graph showing relationships between files
 *
 * @example
 * ```typescript
 * const resources = new Map([
 *   ['/project/docs/api.md', '# API'],
 *   ['/project/docs/guide.md', '# Guide']
 * ]);
 * const patches = [
 *   { op: 'replace', old: 'foo', new: 'bar', include: '**\/api.md' }
 * ];
 * const graph = buildDependencyGraph(
 *   resources,
 *   patches,
 *   config,
 *   '/project/kustomark.yaml'
 * );
 * ```
 */
export function buildDependencyGraph(
  resources: Map<string, string>,
  patches: PatchOperation[],
  _config: KustomarkConfig,
  configPath: string,
): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: new Map(),
    configPath: normalize(configPath),
  };

  // Get all resource file paths
  const resourcePaths = Array.from(resources.keys()).map((path) => normalize(path));

  // Create nodes for all resource files
  for (const filePath of resourcePaths) {
    ensureNode(graph, filePath);
  }

  // Add dependency from config to all output files
  // The config file affects all outputs
  ensureNode(graph, graph.configPath);
  for (const filePath of resourcePaths) {
    addDependency(graph, filePath, graph.configPath);
  }

  // Add dependencies based on patches
  for (const patch of patches) {
    const affectedFiles = getFilesAffectedByPatch(patch, resourcePaths);

    // Each affected file depends on the config (where the patch is defined)
    for (const filePath of affectedFiles) {
      addDependency(graph, filePath, graph.configPath);
    }
  }

  return graph;
}

/**
 * Get all files affected by changes to the given files
 *
 * This performs a transitive closure to find all files that directly or
 * indirectly depend on the changed files.
 *
 * @param graph - The dependency graph
 * @param changedFiles - Set of absolute paths to changed files
 * @returns Set of absolute paths to all affected files (including changed files)
 *
 * @example
 * ```typescript
 * const affected = getAffectedFiles(graph, new Set(['/project/kustomark.yaml']));
 * // Returns all output files since they all depend on the config
 * ```
 */
export function getAffectedFiles(graph: DependencyGraph, changedFiles: Set<string>): Set<string> {
  const affected = new Set<string>();
  const queue: string[] = Array.from(changedFiles).map((path) => normalize(path));

  // Use BFS to traverse the dependency graph
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    // Skip if already processed
    if (affected.has(current)) continue;

    affected.add(current);

    // Find all files that depend on the current file
    const node = graph.nodes.get(current);
    if (node) {
      // Add all dependents to the queue
      for (const dependent of node.dependents) {
        if (!affected.has(dependent)) {
          queue.push(dependent);
        }
      }
    }
  }

  return affected;
}

/**
 * Get direct dependencies for a file based on patches
 *
 * This is a helper function that determines which files a given file depends on
 * based on the patches that affect it.
 *
 * @param filePath - Absolute path to the file
 * @param patches - Array of patch operations
 * @returns Set of absolute paths to direct dependencies
 *
 * @example
 * ```typescript
 * const deps = getDependencies('/project/docs/api.md', patches);
 * // Returns paths to files that api.md depends on (typically the config)
 * ```
 */
export function getDependencies(filePath: string, patches: PatchOperation[]): Set<string> {
  const dependencies = new Set<string>();
  const normalizedPath = normalize(filePath);

  // Check each patch to see if it affects this file
  for (const patch of patches) {
    if (doesPatchAffectFile(patch, normalizedPath)) {
      // For now, we track that the file depends on patches being applied
      // In a more complete implementation, we might track specific dependency relationships
      // based on patch content (e.g., if a patch references another file)
    }
  }

  return dependencies;
}

/**
 * Add a dependency edge to the graph
 *
 * Creates an edge from 'from' to 'to', indicating that 'from' depends on 'to'.
 * Automatically ensures both nodes exist in the graph.
 *
 * @param graph - The dependency graph to modify
 * @param from - Absolute path to the dependent file
 * @param to - Absolute path to the dependency file
 *
 * @example
 * ```typescript
 * addDependency(graph, '/project/output/api.md', '/project/kustomark.yaml');
 * // api.md now depends on kustomark.yaml
 * ```
 */
export function addDependency(graph: DependencyGraph, from: string, to: string): void {
  const normalizedFrom = normalize(from);
  const normalizedTo = normalize(to);

  // Ensure both nodes exist
  const fromNode = ensureNode(graph, normalizedFrom);
  const toNode = ensureNode(graph, normalizedTo);

  // Add the dependency relationship
  fromNode.dependencies.add(normalizedTo);
  toNode.dependents.add(normalizedFrom);
}

/**
 * Ensure a node exists in the graph, creating it if necessary
 *
 * @param graph - The dependency graph
 * @param filePath - Absolute path to the file
 * @returns The node for the file
 */
function ensureNode(graph: DependencyGraph, filePath: string): DependencyNode {
  const normalizedPath = normalize(filePath);

  let node = graph.nodes.get(normalizedPath);
  if (!node) {
    node = {
      path: normalizedPath,
      dependencies: new Set(),
      dependents: new Set(),
    };
    graph.nodes.set(normalizedPath, node);
  }

  return node;
}

/**
 * Get all files affected by a patch operation
 *
 * @param patch - The patch operation
 * @param allFiles - Array of all file paths to consider
 * @returns Array of file paths affected by this patch
 */
function getFilesAffectedByPatch(patch: PatchOperation, allFiles: string[]): string[] {
  const normalizedFiles = allFiles.map((path) => normalize(path));

  // If patch has include patterns, only include matching files
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    return normalizedFiles.filter((filePath) => {
      return includePatterns.some((pattern) => matchesPattern(filePath, pattern));
    });
  }

  // If patch has exclude patterns, include all files except those matching
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    return normalizedFiles.filter((filePath) => {
      return !excludePatterns.some((pattern) => matchesPattern(filePath, pattern));
    });
  }

  // If neither include nor exclude, patch affects all files
  return normalizedFiles;
}

/**
 * Check if a patch affects a specific file
 *
 * @param patch - The patch operation
 * @param filePath - Absolute path to the file
 * @returns True if the patch affects this file
 */
function doesPatchAffectFile(patch: PatchOperation, filePath: string): boolean {
  const normalizedPath = normalize(filePath);

  // If patch has include patterns, check if file matches
  if (patch.include) {
    const includePatterns = Array.isArray(patch.include) ? patch.include : [patch.include];
    return includePatterns.some((pattern) => matchesPattern(normalizedPath, pattern));
  }

  // If patch has exclude patterns, file is affected if it doesn't match exclude
  if (patch.exclude) {
    const excludePatterns = Array.isArray(patch.exclude) ? patch.exclude : [patch.exclude];
    return !excludePatterns.some((pattern) => matchesPattern(normalizedPath, pattern));
  }

  // If neither include nor exclude, patch affects this file
  return true;
}

/**
 * Check if a file path matches a glob pattern
 *
 * @param filePath - Absolute path to check
 * @param pattern - Glob pattern to match against
 * @returns True if the file matches the pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalize(filePath);

  // Use micromatch for glob matching
  // We need to extract just the filename part for pattern matching
  // since patterns might be relative (like '**/*.md')
  return micromatch.isMatch(normalizedPath, pattern, {
    dot: true,
    matchBase: true,
  });
}
