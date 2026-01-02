/**
 * Build cache module for Kustomark
 *
 * This module handles caching of build outputs to avoid redundant processing
 * when source files and patches haven't changed.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import * as yaml from "js-yaml";
import type {
  BuildCache,
  BuildCacheEntry,
  DependencyGraph,
  KustomarkConfig,
  LockFile,
  PatchOperation,
} from "./types.js";

/**
 * Calculates SHA256 hash of content
 *
 * @param content - Content to hash (string or bytes)
 * @returns SHA256 hash in hex format (without prefix)
 */
export function calculateFileHash(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

/**
 * Calculates deterministic hash of patch operations
 *
 * Creates a canonical string representation of patches and hashes it.
 * The representation is stable across runs for the same patch configuration.
 *
 * @param patch - Patch operation to hash
 * @returns SHA256 hash in hex format (without prefix)
 */
export function calculatePatchHash(patch: PatchOperation): string {
  // Create a stable JSON representation by sorting keys
  const canonical = JSON.stringify(patch, Object.keys(patch).sort());
  return calculateFileHash(canonical);
}

/**
 * Creates an empty build cache with the given config hash
 *
 * @param configHash - SHA256 hash of the config file content
 * @returns Empty BuildCache object
 */
export function createEmptyCache(configHash: string): BuildCache {
  return {
    version: 1,
    configHash,
    entries: [],
  };
}

/**
 * Gets the cache directory for a project
 *
 * Cache is stored at ~/.cache/kustomark/builds/{hash}/cache.yaml
 * where hash is SHA256 of the absolute config path
 *
 * @param configPath - Path to the kustomark config file
 * @param cacheDir - Optional custom cache directory (defaults to ~/.cache/kustomark/builds)
 * @returns Path to the cache directory for this project
 */
export function getCacheDirectory(configPath: string, cacheDir?: string): string {
  const baseDir = cacheDir ?? join(homedir(), ".cache", "kustomark", "builds");
  const absolutePath = resolve(configPath);
  const pathHash = calculateFileHash(absolutePath);
  return join(baseDir, pathHash);
}

/**
 * Loads build cache from disk
 *
 * @param configPath - Path to the kustomark config file
 * @param cacheDir - Optional custom cache directory
 * @returns Parsed BuildCache object, or null if cache doesn't exist or is invalid
 */
export async function loadBuildCache(
  configPath: string,
  cacheDir?: string,
): Promise<BuildCache | null> {
  const cacheDirPath = getCacheDirectory(configPath, cacheDir);
  const cacheFilePath = join(cacheDirPath, "cache.yaml");

  if (!existsSync(cacheFilePath)) {
    return null;
  }

  try {
    const content = await readFile(cacheFilePath, "utf-8");
    return await parseBuildCache(content);
  } catch (error) {
    // If the cache file is invalid, treat it as if it doesn't exist
    // This allows recovery from corrupted cache files
    console.warn(
      `Warning: Invalid build cache at ${cacheFilePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Parses YAML cache content into a BuildCache object
 *
 * @param content - YAML content as string (awaitable)
 * @returns Parsed BuildCache object
 * @throws Error if YAML is malformed or structure is invalid
 */
async function parseBuildCache(content: string | Promise<string>): Promise<BuildCache> {
  const resolvedContent = await content;

  try {
    const parsed = yaml.load(resolvedContent);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Build cache must be a YAML object");
    }

    const cache = parsed as Record<string, unknown>;

    // Validate version
    if (typeof cache.version !== "number") {
      throw new Error("Build cache must have a numeric 'version' field");
    }

    // Validate configHash
    if (typeof cache.configHash !== "string") {
      throw new Error("Build cache must have a string 'configHash' field");
    }

    // Validate entries
    if (!Array.isArray(cache.entries)) {
      throw new Error("Build cache must have an 'entries' array");
    }

    // Validate each entry
    const validatedEntries: BuildCacheEntry[] = [];
    for (const [index, entry] of cache.entries.entries()) {
      if (!entry || typeof entry !== "object") {
        throw new Error(`Build cache entry at index ${index} must be an object`);
      }

      const e = entry as Record<string, unknown>;

      if (typeof e.file !== "string") {
        throw new Error(`Build cache entry at index ${index} must have a string 'file' field`);
      }

      if (typeof e.sourceHash !== "string") {
        throw new Error(
          `Build cache entry at index ${index} must have a string 'sourceHash' field`,
        );
      }

      if (typeof e.patchHash !== "string") {
        throw new Error(`Build cache entry at index ${index} must have a string 'patchHash' field`);
      }

      if (typeof e.outputHash !== "string") {
        throw new Error(
          `Build cache entry at index ${index} must have a string 'outputHash' field`,
        );
      }

      if (typeof e.built !== "string") {
        throw new Error(`Build cache entry at index ${index} must have a string 'built' field`);
      }

      // Validate ISO 8601 timestamp format
      const builtDate = new Date(e.built);
      if (Number.isNaN(builtDate.getTime())) {
        throw new Error(
          `Build cache entry at index ${index} has invalid ISO 8601 timestamp in 'built' field`,
        );
      }

      validatedEntries.push({
        file: e.file,
        sourceHash: e.sourceHash,
        patchHash: e.patchHash,
        outputHash: e.outputHash,
        built: e.built,
      });
    }

    return {
      version: cache.version,
      configHash: cache.configHash,
      entries: validatedEntries,
    };
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Serializes a BuildCache object to YAML string format
 *
 * @param cache - BuildCache object to serialize
 * @returns YAML string representation
 */
function serializeBuildCache(cache: BuildCache): string {
  // Sort entries by file path for consistent output
  const sortedCache: BuildCache = {
    version: cache.version,
    configHash: cache.configHash,
    entries: [...cache.entries].sort((a, b) => a.file.localeCompare(b.file)),
  };

  return yaml.dump(sortedCache, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false, // Keep our manual sort order
  });
}

/**
 * Saves build cache to disk
 *
 * @param configPath - Path to the kustomark config file
 * @param cache - BuildCache object to save
 * @param cacheDir - Optional custom cache directory
 */
export async function saveBuildCache(
  configPath: string,
  cache: BuildCache,
  cacheDir?: string,
): Promise<void> {
  const cacheDirPath = getCacheDirectory(configPath, cacheDir);
  const cacheFilePath = join(cacheDirPath, "cache.yaml");

  // Ensure cache directory exists
  await mkdir(cacheDirPath, { recursive: true });

  const content = serializeBuildCache(cache);
  await writeFile(cacheFilePath, content, "utf-8");
}

/**
 * Updates the build cache with new build results
 *
 * Merges new entries with existing cache, replacing entries for the same file.
 *
 * @param cache - Existing BuildCache object
 * @param results - Map of file paths to new BuildCacheEntry objects
 * @returns New BuildCache object with updated entries
 */
export function updateBuildCache(
  cache: BuildCache,
  results: Map<string, BuildCacheEntry>,
): BuildCache {
  // Create a map of existing entries
  const entryMap = new Map<string, BuildCacheEntry>();
  for (const entry of cache.entries) {
    entryMap.set(entry.file, entry);
  }

  // Update/add new entries
  for (const [file, newEntry] of results) {
    entryMap.set(file, newEntry);
  }

  // Convert map back to array
  const updatedEntries = Array.from(entryMap.values());

  return {
    version: cache.version,
    configHash: cache.configHash,
    entries: updatedEntries,
  };
}

/**
 * Prunes cache entries for files that no longer exist
 *
 * @param cache - BuildCache object to prune
 * @param currentFiles - Set of file paths that currently exist
 * @returns New BuildCache object with pruned entries
 */
export function pruneCache(cache: BuildCache, currentFiles: Set<string>): BuildCache {
  const prunedEntries = cache.entries.filter((entry) => currentFiles.has(entry.file));

  return {
    version: cache.version,
    configHash: cache.configHash,
    entries: prunedEntries,
  };
}

/**
 * Clears the build cache for a specific project
 *
 * @param configPath - Path to the kustomark config file
 * @param cacheDir - Optional custom cache directory
 * @returns true if cache was cleared, false if no cache existed
 */
export async function clearProjectCache(configPath: string, cacheDir?: string): Promise<boolean> {
  const cacheDirPath = getCacheDirectory(configPath, cacheDir);

  if (!existsSync(cacheDirPath)) {
    return false;
  }

  await rm(cacheDirPath, { recursive: true, force: true });
  return true;
}

/**
 * Clears all build caches
 *
 * @param cacheDir - Optional custom cache directory (defaults to ~/.cache/kustomark/builds)
 * @returns Object with count of cleared caches and total bytes freed
 */
export async function clearAllCaches(
  cacheDir?: string,
): Promise<{ cleared: number; bytes: number }> {
  const baseDir = cacheDir ?? join(homedir(), ".cache", "kustomark", "builds");

  if (!existsSync(baseDir)) {
    return { cleared: 0, bytes: 0 };
  }

  const entries = await readdir(baseDir);
  let cleared = 0;
  let bytes = 0;

  for (const entry of entries) {
    const entryPath = join(baseDir, entry);

    try {
      // Calculate size before deletion
      const stats = await stat(entryPath);
      if (stats.isDirectory()) {
        // Recursively calculate directory size
        bytes += await calculateDirectorySize(entryPath);
      } else {
        bytes += stats.size;
      }

      await rm(entryPath, { recursive: true, force: true });
      cleared++;
    } catch (error) {
      // Skip entries that can't be deleted
      console.warn(
        `Warning: Could not clear cache at ${entryPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { cleared, bytes };
}

/**
 * Recursively calculates the total size of a directory
 *
 * @param dirPath - Path to directory
 * @returns Total size in bytes
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // If we can't read the directory, just return 0
    console.warn(
      `Warning: Could not calculate size of ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return totalSize;
}

/**
 * Current state during a build operation
 */
export interface CurrentBuildState {
  /** Current file content hashes (file path -> hash) */
  fileHashes: Map<string, string>;
  /** Current patches applicable to each file (file path -> patches) */
  filePatches: Map<string, PatchOperation[]>;
  /** Current configuration */
  config: KustomarkConfig;
  /** Current configuration file path */
  configPath: string;
  /** Current lock file (if exists) */
  lockFile?: LockFile;
  /** Enabled patch groups */
  enabledGroups: Set<string>;
  /** Disabled patch groups */
  disabledGroups: Set<string>;
}

/**
 * Result of checking whether a file should be rebuilt
 */
export interface ShouldRebuildResult {
  /** Whether the file should be rebuilt */
  rebuild: boolean;
  /** Reason for rebuild (if rebuild is true) */
  reason?: string;
}

/**
 * Result of determining which files to rebuild
 */
export interface RebuildDetermination {
  /** Set of file paths that need to be rebuilt */
  rebuild: Set<string>;
  /** Set of file paths that are unchanged and can use cached output */
  unchanged: Set<string>;
  /** Map of file path to list of reasons why it needs to be rebuilt */
  reasons: Map<string, string[]>;
}

/**
 * Result of detecting changed files
 */
export interface FileChanges {
  /** Files whose content has changed */
  changed: Set<string>;
  /** Files that have been added */
  added: Set<string>;
  /** Files that have been deleted */
  deleted: Set<string>;
}

/**
 * Detects which files have changed, been added, or been deleted
 *
 * @param currentFiles - Map of current file paths to their content hashes
 * @param cache - Build cache to compare against
 * @returns Object containing sets of changed, added, and deleted files
 */
export function detectChangedFiles(
  currentFiles: Map<string, string>,
  cache: BuildCache,
): FileChanges {
  const changed = new Set<string>();
  const added = new Set<string>();
  const deleted = new Set<string>();

  // Build a map of cached file hashes for quick lookup
  const cachedHashes = new Map<string, string>();
  for (const entry of cache.entries) {
    cachedHashes.set(entry.file, entry.sourceHash);
  }

  // Check for changed and added files
  for (const [filePath, currentHash] of currentFiles) {
    const cachedHash = cachedHashes.get(filePath);

    if (cachedHash === undefined) {
      // File is new
      added.add(filePath);
    } else if (cachedHash !== currentHash) {
      // File content has changed
      changed.add(filePath);
    }
  }

  // Check for deleted files
  for (const cachedPath of cachedHashes.keys()) {
    if (!currentFiles.has(cachedPath)) {
      deleted.add(cachedPath);
    }
  }

  return { changed, added, deleted };
}

/**
 * Checks if the configuration file has changed
 *
 * @param config - Current configuration object (unused, for API consistency)
 * @param configPath - Path to the config file
 * @param cache - Build cache to compare against
 * @returns true if config has changed, false otherwise
 */
export function hasConfigChanged(
  _config: KustomarkConfig,
  configPath: string,
  cache: BuildCache,
): boolean {
  // Read the config file and compute its hash
  try {
    const configContent = readFileSync(configPath, "utf-8");
    const currentConfigHash = calculateFileHash(configContent);

    // Compare with cached config hash
    return currentConfigHash !== cache.configHash;
  } catch (error) {
    // If we can't read the config file, assume it has changed
    return true;
  }
}

/**
 * Computes a hash of multiple patches applicable to a file
 *
 * This creates a deterministic hash based on the patch operations
 * that would be applied to the file.
 *
 * @param patches - Array of patch operations
 * @returns Hash string representing the patches
 */
export function computePatchesHash(patches: PatchOperation[]): string {
  // Serialize patches to a canonical string representation
  const patchString = JSON.stringify(
    patches.map((p) => JSON.parse(JSON.stringify(p, Object.keys(p).sort()))),
  );
  return calculateFileHash(patchString);
}

/**
 * Checks if the patches applicable to a file have changed
 *
 * @param currentPatches - Current patches applicable to the file
 * @param filePath - Path to the file (unused, for API consistency)
 * @param cacheEntry - Cache entry for the file
 * @returns true if patches have changed, false otherwise
 */
export function havePatchesChanged(
  currentPatches: PatchOperation[],
  _filePath: string,
  cacheEntry: BuildCacheEntry,
): boolean {
  const currentPatchHash = computePatchesHash(currentPatches);
  return currentPatchHash !== cacheEntry.patchHash;
}

/**
 * Checks if a single file should be rebuilt
 *
 * @param filePath - Path to the file to check
 * @param cacheEntry - Cache entry for the file
 * @param currentState - Current build state
 * @returns Object indicating whether to rebuild and the reason
 */
export function shouldRebuildFile(
  filePath: string,
  cacheEntry: BuildCacheEntry,
  currentState: CurrentBuildState,
): ShouldRebuildResult {
  // Check source file content
  const currentHash = currentState.fileHashes.get(filePath);
  if (currentHash === undefined) {
    return { rebuild: true, reason: "File not found in current file set" };
  }

  if (currentHash !== cacheEntry.sourceHash) {
    return { rebuild: true, reason: "Source file content changed" };
  }

  // Check patches
  const currentPatches = currentState.filePatches.get(filePath) ?? [];
  if (havePatchesChanged(currentPatches, filePath, cacheEntry)) {
    return { rebuild: true, reason: "Applicable patches changed" };
  }

  return { rebuild: false };
}

/**
 * Checks if any dependency of a file has changed
 *
 * @param filePath - Path to the file
 * @param graph - Dependency graph
 * @param rebuildSet - Set of files already marked for rebuild
 * @returns true if any dependency needs to be rebuilt, false otherwise
 */
function hasDependencyChanged(
  filePath: string,
  graph: DependencyGraph,
  rebuildSet: Set<string>,
): boolean {
  const node = graph.nodes.get(filePath);
  if (!node) {
    return false;
  }

  // Check if any direct dependency is being rebuilt
  for (const dependency of node.dependencies) {
    if (rebuildSet.has(dependency)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds a cache entry by file path
 *
 * @param cache - BuildCache object to search
 * @param filePath - File path to find
 * @returns Cache entry if found, null otherwise
 */
function findCacheEntry(cache: BuildCache, filePath: string): BuildCacheEntry | null {
  const entry = cache.entries.find((e) => e.file === filePath);
  return entry ?? null;
}

/**
 * Main function to determine which files need to be rebuilt
 *
 * This is the core invalidation logic that considers all possible reasons
 * a file might need to be rebuilt:
 * - Source file content changed (compare hashes)
 * - Config file changed (compare config hash)
 * - Applicable patches changed (compare patch hashes)
 * - Dependencies changed (check graph)
 * - Cache version mismatch (cache.version !== current version)
 * - Group filters changed (compare enabled/disabled groups)
 *
 * Note: Remote resource updates and referenced config changes are not yet
 * implemented but could be added by comparing lock file entries.
 *
 * @param resources - Map of file paths to their current content
 * @param patches - Array of patch operations from config
 * @param config - Current configuration
 * @param configPath - Path to the config file
 * @param cache - Build cache (or null if no cache exists)
 * @param graph - Dependency graph
 * @param enabledGroups - Optional set of enabled patch groups
 * @param disabledGroups - Optional set of disabled patch groups
 * @returns Object containing sets of files to rebuild and unchanged files, plus reasons
 */
export function determineFilesToRebuild(
  resources: Map<string, string>,
  patches: PatchOperation[],
  config: KustomarkConfig,
  configPath: string,
  cache: BuildCache | null,
  graph: DependencyGraph,
  enabledGroups?: Set<string>,
  disabledGroups?: Set<string>,
): RebuildDetermination {
  const rebuild = new Set<string>();
  const unchanged = new Set<string>();
  const reasons = new Map<string, string[]>();

  // Helper to add a rebuild reason
  const addReason = (filePath: string, reason: string) => {
    const existing = reasons.get(filePath) ?? [];
    existing.push(reason);
    reasons.set(filePath, existing);
    rebuild.add(filePath);
  };

  // If no cache exists, rebuild everything
  if (!cache) {
    for (const filePath of resources.keys()) {
      addReason(filePath, "No cache exists");
    }
    return { rebuild, unchanged, reasons };
  }

  // Check cache version
  if (cache.version !== 1) {
    for (const filePath of resources.keys()) {
      addReason(filePath, `Cache version mismatch (expected 1, got ${cache.version})`);
    }
    return { rebuild, unchanged, reasons };
  }

  // Compute current file hashes
  const fileHashes = new Map<string, string>();
  for (const [filePath, content] of resources) {
    fileHashes.set(filePath, calculateFileHash(content));
  }

  // Determine which patches apply to which files
  // For now, we'll assume all patches could apply to all files
  // In a real implementation, you'd filter patches based on include/exclude patterns
  const filePatches = new Map<string, PatchOperation[]>();
  for (const filePath of resources.keys()) {
    // Filter patches based on group membership if groups are specified
    let applicablePatches = patches;
    if (enabledGroups || disabledGroups) {
      applicablePatches = patches.filter((patch) => {
        const patchGroup = patch.group;

        // If patch has no group, it's always included
        if (!patchGroup) {
          return true;
        }

        // If disabled groups specified and patch is in disabled group, exclude it
        if (disabledGroups?.has(patchGroup)) {
          return false;
        }

        // If enabled groups specified and patch is not in enabled group, exclude it
        if (enabledGroups && enabledGroups.size > 0 && !enabledGroups.has(patchGroup)) {
          return false;
        }

        return true;
      });
    }

    filePatches.set(filePath, applicablePatches);
  }

  // Build current state
  const currentState: CurrentBuildState = {
    fileHashes,
    filePatches,
    config,
    configPath,
    enabledGroups: enabledGroups ?? new Set(),
    disabledGroups: disabledGroups ?? new Set(),
  };

  // Check if config changed - if so, rebuild everything
  if (hasConfigChanged(config, configPath, cache)) {
    for (const filePath of resources.keys()) {
      addReason(filePath, "Configuration file changed");
    }
    return { rebuild, unchanged, reasons };
  }

  // Detect file changes
  const fileChanges = detectChangedFiles(fileHashes, cache);

  // All new files need to be rebuilt
  for (const filePath of fileChanges.added) {
    addReason(filePath, "File was added");
  }

  // All changed files need to be rebuilt
  for (const filePath of fileChanges.changed) {
    addReason(filePath, "Source file content changed");
  }

  // Check each existing file
  for (const filePath of resources.keys()) {
    // Skip files already marked for rebuild
    if (rebuild.has(filePath)) {
      continue;
    }

    const cacheEntry = findCacheEntry(cache, filePath);

    // If no cache entry, rebuild
    if (!cacheEntry) {
      addReason(filePath, "No cache entry found");
      continue;
    }

    // Check if file itself should be rebuilt
    const shouldRebuild = shouldRebuildFile(filePath, cacheEntry, currentState);
    if (shouldRebuild.rebuild) {
      addReason(filePath, shouldRebuild.reason ?? "Unknown reason");
      continue;
    }

    // Check if any dependency has changed
    if (hasDependencyChanged(filePath, graph, rebuild)) {
      addReason(filePath, "Dependency changed");
      continue;
    }

    // If we got here, file doesn't need to be rebuilt
    unchanged.add(filePath);
  }

  return { rebuild, unchanged, reasons };
}
