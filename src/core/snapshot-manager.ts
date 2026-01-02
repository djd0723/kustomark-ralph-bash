/**
 * Snapshot manager for build output verification
 *
 * This module provides snapshot functionality to capture and verify build outputs,
 * enabling regression testing and ensuring consistent build results across changes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Snapshot manifest metadata
 */
export interface SnapshotManifest {
  /** Snapshot creation timestamp (ISO 8601) */
  timestamp: string;
  /** Kustomark version when snapshot was created */
  version: string;
  /** File hashes - maps relative file path to SHA256 hash */
  fileHashes: Record<string, string>;
  /** Total number of files in the snapshot */
  fileCount: number;
}

/**
 * Build result input for snapshot operations
 */
export interface BuildResult {
  /** Map of file paths to their content */
  files: Map<string, string>;
  /** Build success status */
  success: boolean;
}

/**
 * Result of verifying a snapshot against current build output
 */
export interface SnapshotVerificationResult {
  /** Whether the current build matches the snapshot */
  matches: boolean;
  /** Files that were added (in current but not in snapshot) */
  added: string[];
  /** Files that were removed (in snapshot but not in current) */
  removed: string[];
  /** Files that were modified (content hash mismatch) */
  modified: Array<{
    file: string;
    expectedHash: string;
    actualHash: string;
  }>;
  /** Snapshot manifest that was compared against */
  manifest: SnapshotManifest;
}

/**
 * Calculates SHA256 hash of file content
 *
 * Uses Bun's CryptoHasher for efficient hashing. The returned hash is a
 * lowercase hexadecimal digest without any prefix.
 *
 * @param content - File content to hash
 * @returns SHA256 hash as lowercase hexadecimal string
 *
 * @example
 * ```typescript
 * const content = '# Hello World\n\nThis is a test.';
 * const hash = calculateFileHash(content);
 * console.log(hash); // "a1b2c3d4..."
 * ```
 */
export function calculateFileHash(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

/**
 * Loads snapshot manifest from disk
 *
 * Reads and parses the manifest.json file from the snapshot directory.
 * Returns null if the manifest doesn't exist or is invalid.
 *
 * @param snapshotDir - Path to snapshot directory
 * @returns Parsed manifest or null if not found/invalid
 *
 * @example
 * ```typescript
 * const manifest = await loadSnapshot('/project/.kustomark/snapshots');
 * if (manifest) {
 *   console.log(`Snapshot has ${manifest.fileCount} files`);
 *   console.log(`Created at ${manifest.timestamp}`);
 * }
 * ```
 */
export async function loadSnapshot(snapshotDir: string): Promise<SnapshotManifest | null> {
  const manifestPath = join(snapshotDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(content);

    // Validate manifest structure
    if (!parsed || typeof parsed !== "object") {
      console.warn(`Warning: Invalid snapshot manifest at ${manifestPath}: not an object`);
      return null;
    }

    if (typeof parsed.timestamp !== "string") {
      console.warn(`Warning: Invalid snapshot manifest at ${manifestPath}: missing timestamp`);
      return null;
    }

    if (typeof parsed.version !== "string") {
      console.warn(`Warning: Invalid snapshot manifest at ${manifestPath}: missing version`);
      return null;
    }

    if (!parsed.fileHashes || typeof parsed.fileHashes !== "object") {
      console.warn(`Warning: Invalid snapshot manifest at ${manifestPath}: invalid fileHashes`);
      return null;
    }

    if (typeof parsed.fileCount !== "number") {
      console.warn(`Warning: Invalid snapshot manifest at ${manifestPath}: invalid fileCount`);
      return null;
    }

    return {
      timestamp: parsed.timestamp,
      version: parsed.version,
      fileHashes: parsed.fileHashes as Record<string, string>,
      fileCount: parsed.fileCount,
    };
  } catch (error) {
    console.warn(
      `Warning: Failed to load snapshot manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Creates a snapshot of build output
 *
 * Captures the current build output and saves it as a snapshot in the specified
 * directory. The snapshot consists of:
 * - A manifest.json file with metadata and file hashes
 * - Individual files in the snapshot directory matching the build structure
 *
 * @param buildResult - Build result containing files to snapshot
 * @param snapshotDir - Directory to save snapshot (e.g., .kustomark/snapshots)
 * @returns Snapshot manifest with metadata
 * @throws {Error} If snapshot directory cannot be created or files cannot be written
 *
 * @example
 * ```typescript
 * const buildResult: BuildResult = {
 *   files: new Map([
 *     ['docs/readme.md', '# README\n\nHello world'],
 *     ['docs/api.md', '# API\n\nDocumentation']
 *   ]),
 *   success: true
 * };
 *
 * const manifest = await createSnapshot(buildResult, '.kustomark/snapshots');
 * console.log(`Created snapshot with ${manifest.fileCount} files`);
 * ```
 */
export async function createSnapshot(
  buildResult: BuildResult,
  snapshotDir: string,
): Promise<SnapshotManifest> {
  // Ensure snapshot directory exists
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }

  // Calculate file hashes and write files
  const fileHashes: Record<string, string> = {};

  for (const [filePath, content] of buildResult.files.entries()) {
    // Calculate hash
    const hash = calculateFileHash(content);
    fileHashes[filePath] = hash;

    // Write file to snapshot directory
    const snapshotFilePath = join(snapshotDir, filePath);
    const snapshotFileDir = dirname(snapshotFilePath);

    // Ensure parent directory exists
    if (!existsSync(snapshotFileDir)) {
      mkdirSync(snapshotFileDir, { recursive: true });
    }

    writeFileSync(snapshotFilePath, content, "utf-8");
  }

  // Create manifest
  const manifest: SnapshotManifest = {
    timestamp: new Date().toISOString(),
    version: getKustomarkVersion(),
    fileHashes,
    fileCount: buildResult.files.size,
  };

  // Write manifest
  const manifestPath = join(snapshotDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return manifest;
}

/**
 * Verifies current build output against a saved snapshot
 *
 * Compares the current build result with a previously saved snapshot to detect
 * any differences. Returns detailed information about added, removed, and
 * modified files.
 *
 * @param buildResult - Current build result to verify
 * @param snapshotDir - Directory containing the snapshot to compare against
 * @returns Verification result with detailed diff information
 * @throws {Error} If snapshot doesn't exist or cannot be loaded
 *
 * @example
 * ```typescript
 * const buildResult: BuildResult = {
 *   files: new Map([
 *     ['docs/readme.md', '# README\n\nUpdated content']
 *   ]),
 *   success: true
 * };
 *
 * const result = await verifySnapshot(buildResult, '.kustomark/snapshots');
 * if (!result.matches) {
 *   console.log(`Added: ${result.added.length} files`);
 *   console.log(`Removed: ${result.removed.length} files`);
 *   console.log(`Modified: ${result.modified.length} files`);
 * }
 * ```
 */
export async function verifySnapshot(
  buildResult: BuildResult,
  snapshotDir: string,
): Promise<SnapshotVerificationResult> {
  // Load snapshot manifest
  const manifest = await loadSnapshot(snapshotDir);

  if (!manifest) {
    throw new Error(
      `No snapshot found at ${snapshotDir}. Create a snapshot first with createSnapshot().`,
    );
  }

  // Calculate current file hashes
  const currentHashes: Record<string, string> = {};
  for (const [filePath, content] of buildResult.files.entries()) {
    currentHashes[filePath] = calculateFileHash(content);
  }

  // Find differences
  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{ file: string; expectedHash: string; actualHash: string }> = [];

  // Check for added and modified files
  for (const [filePath, hash] of Object.entries(currentHashes)) {
    if (!(filePath in manifest.fileHashes)) {
      added.push(filePath);
    } else {
      const expectedHash = manifest.fileHashes[filePath];
      if (expectedHash && expectedHash !== hash) {
        modified.push({
          file: filePath,
          expectedHash,
          actualHash: hash,
        });
      }
    }
  }

  // Check for removed files
  for (const filePath of Object.keys(manifest.fileHashes)) {
    if (!(filePath in currentHashes)) {
      removed.push(filePath);
    }
  }

  // Sort for consistent output
  added.sort();
  removed.sort();
  modified.sort((a, b) => a.file.localeCompare(b.file));

  const matches = added.length === 0 && removed.length === 0 && modified.length === 0;

  return {
    matches,
    added,
    removed,
    modified,
    manifest,
  };
}

/**
 * Updates an existing snapshot with new build output
 *
 * Replaces the existing snapshot with the current build result. This is
 * functionally equivalent to creating a new snapshot, but semantically
 * indicates an intentional update of an existing baseline.
 *
 * @param buildResult - Build result to use for updating the snapshot
 * @param snapshotDir - Directory containing the snapshot to update
 * @returns Updated snapshot manifest
 * @throws {Error} If snapshot directory cannot be created or files cannot be written
 *
 * @example
 * ```typescript
 * const buildResult: BuildResult = {
 *   files: new Map([
 *     ['docs/readme.md', '# README\n\nNew baseline content']
 *   ]),
 *   success: true
 * };
 *
 * const manifest = await updateSnapshot(buildResult, '.kustomark/snapshots');
 * console.log(`Updated snapshot at ${manifest.timestamp}`);
 * ```
 */
export async function updateSnapshot(
  buildResult: BuildResult,
  snapshotDir: string,
): Promise<SnapshotManifest> {
  // Updating a snapshot is the same as creating a new one
  // The semantic difference is that we're intentionally replacing an existing baseline
  return createSnapshot(buildResult, snapshotDir);
}

/**
 * Gets the current Kustomark version
 *
 * Reads the version from package.json. Returns "unknown" if the version
 * cannot be determined.
 *
 * @returns Kustomark version string
 *
 * @internal
 */
function getKustomarkVersion(): string {
  try {
    // In production, package.json is typically at the project root
    // Try multiple common locations
    const possiblePaths = [
      join(process.cwd(), "package.json"),
      join(dirname(import.meta.dir ?? __dirname), "../../package.json"),
      join(import.meta.dir ?? __dirname, "../../package.json"),
    ];

    for (const pkgPath of possiblePaths) {
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.version && typeof pkg.version === "string") {
          return pkg.version;
        }
      }
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}
