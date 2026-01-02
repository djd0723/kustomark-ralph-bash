/**
 * Lock file parser and manager for Kustomark
 *
 * This module handles parsing, serialization, and management of lock files
 * that track resolved dependencies and their integrity hashes.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as yaml from "js-yaml";
import type { LockFile, LockFileEntry } from "./types.js";

/**
 * Parses YAML lock file content into a LockFile object
 *
 * Validates the structure of the lock file including version number, resources array,
 * and all required fields for each resource entry. Each resource must have a valid URL,
 * resolved URL, SHA256 integrity hash, and ISO 8601 timestamp.
 *
 * @param content - YAML content as string
 * @returns Parsed and validated LockFile object
 * @throws {Error} If YAML is malformed, structure is invalid, or validation fails
 *
 * @example
 * ```typescript
 * const yamlContent = `
 * version: 1
 * resources:
 *   - url: https://example.com/resource.md
 *     resolved: https://cdn.example.com/resource.md
 *     integrity: sha256-abc123...
 *     fetched: 2024-01-15T10:30:00Z
 * `;
 *
 * const lockFile = parseLockFile(yamlContent);
 * console.log(lockFile.version); // 1
 * console.log(lockFile.resources.length); // 1
 * ```
 */
export function parseLockFile(content: string): LockFile {
  try {
    const parsed = yaml.load(content);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Lock file must be a YAML object");
    }

    const lockFile = parsed as Record<string, unknown>;

    // Validate version
    if (typeof lockFile.version !== "number") {
      throw new Error("Lock file must have a numeric 'version' field");
    }

    // Validate resources
    if (!Array.isArray(lockFile.resources)) {
      throw new Error("Lock file must have a 'resources' array");
    }

    // Validate each resource entry
    const validatedResources: LockFileEntry[] = [];
    for (const [index, resource] of lockFile.resources.entries()) {
      if (!resource || typeof resource !== "object") {
        throw new Error(`Lock file resource at index ${index} must be an object`);
      }

      const entry = resource as Record<string, unknown>;

      if (typeof entry.url !== "string") {
        throw new Error(`Lock file resource at index ${index} must have a string 'url' field`);
      }

      if (typeof entry.resolved !== "string") {
        throw new Error(`Lock file resource at index ${index} must have a string 'resolved' field`);
      }

      if (typeof entry.integrity !== "string") {
        throw new Error(
          `Lock file resource at index ${index} must have a string 'integrity' field`,
        );
      }

      if (!entry.integrity.startsWith("sha256-")) {
        throw new Error(`Lock file resource at index ${index} integrity must start with 'sha256-'`);
      }

      if (typeof entry.fetched !== "string") {
        throw new Error(`Lock file resource at index ${index} must have a string 'fetched' field`);
      }

      // Validate ISO 8601 timestamp format
      const fetchedDate = new Date(entry.fetched);
      if (Number.isNaN(fetchedDate.getTime())) {
        throw new Error(
          `Lock file resource at index ${index} has invalid ISO 8601 timestamp in 'fetched' field`,
        );
      }

      // Add validated entry
      validatedResources.push({
        url: entry.url,
        resolved: entry.resolved,
        integrity: entry.integrity,
        fetched: entry.fetched,
      });
    }

    return {
      version: lockFile.version,
      resources: validatedResources,
    };
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Serializes a LockFile object to YAML string format
 *
 * Resources are automatically sorted by URL for consistent output across runs.
 * The output uses 2-space indentation and a 120-character line width.
 *
 * @param lockFile - LockFile object to serialize
 * @returns YAML string representation with sorted resources
 *
 * @example
 * ```typescript
 * const lockFile: LockFile = {
 *   version: 1,
 *   resources: [
 *     {
 *       url: 'https://example.com/resource.md',
 *       resolved: 'https://cdn.example.com/resource.md',
 *       integrity: 'sha256-abc123...',
 *       fetched: '2024-01-15T10:30:00Z'
 *     }
 *   ]
 * };
 *
 * const yaml = serializeLockFile(lockFile);
 * console.log(yaml);
 * // version: 1
 * // resources:
 * //   - url: https://example.com/resource.md
 * //     resolved: https://cdn.example.com/resource.md
 * //     ...
 * ```
 */
export function serializeLockFile(lockFile: LockFile): string {
  // Sort resources by URL for consistent output
  const sortedLockFile: LockFile = {
    version: lockFile.version,
    resources: [...lockFile.resources].sort((a, b) => a.url.localeCompare(b.url)),
  };

  return yaml.dump(sortedLockFile, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false, // Keep our manual sort order
  });
}

/**
 * Gets the lock file path for a given config file path
 *
 * The lock file is always located in the same directory as the config file
 * and is named "kustomark.lock". This ensures lock files are co-located with
 * their corresponding configuration files.
 *
 * @param configPath - Path to the kustomark config file
 * @returns Absolute path to the lock file (kustomark.lock)
 *
 * @example
 * ```typescript
 * const configPath = '/home/user/project/kustomark.config.ts';
 * const lockPath = getLockFilePath(configPath);
 * console.log(lockPath); // "/home/user/project/kustomark.lock"
 * ```
 */
export function getLockFilePath(configPath: string): string {
  const dir = dirname(configPath);
  return join(dir, "kustomark.lock");
}

/**
 * Loads a lock file from the filesystem
 *
 * Attempts to read and parse the lock file associated with the given config file.
 * If the file doesn't exist or is invalid/corrupted, returns null and logs a warning.
 * This allows graceful recovery from missing or corrupted lock files.
 *
 * @param configPath - Path to the kustomark config file
 * @returns Parsed LockFile object, or null if file doesn't exist or is invalid
 *
 * @example
 * ```typescript
 * const configPath = '/home/user/project/kustomark.config.ts';
 * const lockFile = loadLockFile(configPath);
 *
 * if (lockFile) {
 *   console.log(`Loaded ${lockFile.resources.length} resources`);
 * } else {
 *   console.log('No lock file found, will create a new one');
 * }
 * ```
 */
export function loadLockFile(configPath: string): LockFile | null {
  const lockFilePath = getLockFilePath(configPath);

  if (!existsSync(lockFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(lockFilePath, "utf-8");
    return parseLockFile(content);
  } catch (error) {
    // If the lock file is invalid, treat it as if it doesn't exist
    // This allows recovery from corrupted lock files
    console.warn(
      `Warning: Invalid lock file at ${lockFilePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Saves a lock file to the filesystem
 *
 * Serializes the lock file to YAML format and writes it to disk in the same
 * directory as the config file. The file is written with UTF-8 encoding.
 *
 * @param configPath - Path to the kustomark config file
 * @param lockFile - LockFile object to save
 * @throws {Error} If the file cannot be written to disk
 *
 * @example
 * ```typescript
 * const lockFile: LockFile = {
 *   version: 1,
 *   resources: [
 *     {
 *       url: 'https://example.com/resource.md',
 *       resolved: 'https://cdn.example.com/resource.md',
 *       integrity: 'sha256-abc123...',
 *       fetched: new Date().toISOString()
 *     }
 *   ]
 * };
 *
 * saveLockFile('/home/user/project/kustomark.config.ts', lockFile);
 * // Creates /home/user/project/kustomark.lock
 * ```
 */
export function saveLockFile(configPath: string, lockFile: LockFile): void {
  const lockFilePath = getLockFilePath(configPath);
  const content = serializeLockFile(lockFile);
  writeFileSync(lockFilePath, content, "utf-8");
}

/**
 * Finds a lock file entry by URL
 *
 * Searches the lock file for a resource with the specified URL. URLs are matched
 * exactly (case-sensitive). Returns null if no matching entry is found.
 *
 * @param lockFile - LockFile object to search
 * @param url - Resource URL to find
 * @returns Lock file entry if found, null otherwise
 *
 * @example
 * ```typescript
 * const lockFile: LockFile = {
 *   version: 1,
 *   resources: [
 *     {
 *       url: 'https://example.com/resource.md',
 *       resolved: 'https://cdn.example.com/resource.md',
 *       integrity: 'sha256-abc123...',
 *       fetched: '2024-01-15T10:30:00Z'
 *     }
 *   ]
 * };
 *
 * const entry = findLockEntry(lockFile, 'https://example.com/resource.md');
 * if (entry) {
 *   console.log('Found:', entry.integrity);
 * }
 * ```
 */
export function findLockEntry(lockFile: LockFile, url: string): LockFileEntry | null {
  const entry = lockFile.resources.find((r) => r.url === url);
  return entry ?? null;
}

/**
 * Updates or adds a lock file entry
 *
 * If an entry with the same URL exists, it will be replaced with the new entry.
 * Otherwise, the new entry will be appended to the resources array. Returns a new
 * LockFile object without mutating the original.
 *
 * @param lockFile - LockFile object to update
 * @param entry - Lock file entry to add or update
 * @returns New LockFile object with the entry updated (does not mutate original)
 *
 * @example
 * ```typescript
 * const lockFile: LockFile = {
 *   version: 1,
 *   resources: []
 * };
 *
 * const newEntry: LockFileEntry = {
 *   url: 'https://example.com/new-resource.md',
 *   resolved: 'https://cdn.example.com/new-resource.md',
 *   integrity: 'sha256-xyz789...',
 *   fetched: new Date().toISOString()
 * };
 *
 * const updatedLockFile = updateLockEntry(lockFile, newEntry);
 * console.log(updatedLockFile.resources.length); // 1
 * console.log(lockFile.resources.length); // 0 (original unchanged)
 * ```
 *
 * @example
 * ```typescript
 * // Updating existing entry
 * const updated = updateLockEntry(lockFile, {
 *   url: 'https://example.com/existing.md',
 *   resolved: 'https://cdn.example.com/existing-new.md',
 *   integrity: 'sha256-newHash...',
 *   fetched: new Date().toISOString()
 * });
 * // Entry with matching URL is replaced
 * ```
 */
export function updateLockEntry(lockFile: LockFile, entry: LockFileEntry): LockFile {
  const existingIndex = lockFile.resources.findIndex((r) => r.url === entry.url);

  let newResources: LockFileEntry[];
  if (existingIndex >= 0) {
    // Replace existing entry
    newResources = [...lockFile.resources];
    newResources[existingIndex] = entry;
  } else {
    // Add new entry
    newResources = [...lockFile.resources, entry];
  }

  return {
    version: lockFile.version,
    resources: newResources,
  };
}

/**
 * Calculates SHA256 hash of content with "sha256-" prefix
 *
 * Uses Bun's CryptoHasher for efficient hashing. The returned hash is prefixed
 * with "sha256-" to match the integrity field format used in lock files.
 *
 * @param content - Content to hash (string or bytes)
 * @returns Hash in format "sha256-{hex}" where hex is the lowercase hexadecimal digest
 *
 * @example
 * ```typescript
 * const content = 'Hello, world!';
 * const hash = calculateContentHash(content);
 * console.log(hash); // "sha256-315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3"
 * ```
 *
 * @example
 * ```typescript
 * // Works with binary data too
 * const bytes = new Uint8Array([72, 101, 108, 108, 111]);
 * const hash = calculateContentHash(bytes);
 * console.log(hash); // "sha256-185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969"
 * ```
 */
export function calculateContentHash(content: string | Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  const hash = hasher.digest("hex");
  return `sha256-${hash}`;
}
