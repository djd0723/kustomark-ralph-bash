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
 * @param content - YAML content as string
 * @returns Parsed LockFile object
 * @throws Error if YAML is malformed or structure is invalid
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
 * @param lockFile - LockFile object to serialize
 * @returns YAML string representation
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
 * The lock file is located in the same directory as the config file
 * and named "kustomark.lock"
 *
 * @param configPath - Path to the kustomark config file
 * @returns Path to the lock file
 */
export function getLockFilePath(configPath: string): string {
  const dir = dirname(configPath);
  return join(dir, "kustomark.lock");
}

/**
 * Loads a lock file from the filesystem
 *
 * @param configPath - Path to the kustomark config file
 * @returns Parsed LockFile object, or null if file doesn't exist or is invalid
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
 * @param configPath - Path to the kustomark config file
 * @param lockFile - LockFile object to save
 */
export function saveLockFile(configPath: string, lockFile: LockFile): void {
  const lockFilePath = getLockFilePath(configPath);
  const content = serializeLockFile(lockFile);
  writeFileSync(lockFilePath, content, "utf-8");
}

/**
 * Finds a lock file entry by URL
 *
 * @param lockFile - LockFile object to search
 * @param url - Resource URL to find
 * @returns Lock file entry if found, null otherwise
 */
export function findLockEntry(lockFile: LockFile, url: string): LockFileEntry | null {
  const entry = lockFile.resources.find((r) => r.url === url);
  return entry ?? null;
}

/**
 * Updates or adds a lock file entry
 *
 * If an entry with the same URL exists, it will be replaced.
 * Otherwise, the new entry will be added.
 *
 * @param lockFile - LockFile object to update
 * @param entry - Lock file entry to add or update
 * @returns New LockFile object with the entry updated
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
 * Uses Bun's CryptoHasher for efficient hashing.
 *
 * @param content - Content to hash (string or bytes)
 * @returns Hash in format "sha256-<hex>"
 */
export function calculateContentHash(content: string | Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  const hash = hasher.digest("hex");
  return `sha256-${hash}`;
}
