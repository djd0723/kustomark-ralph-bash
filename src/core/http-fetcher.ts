/**
 * HTTP Archive Fetcher Module
 *
 * Provides HTTP archive fetching with caching, extraction, and authentication support
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { findLockEntry } from "./lock-file.js";
import type { LockFile, LockFileEntry } from "./types.js";

/**
 * Error thrown when HTTP archive operations fail
 */
export class HttpFetchError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly stderr?: string;

  constructor(message: string, code: string, statusCode?: number, stderr?: string) {
    super(message);
    this.name = "HttpFetchError";
    this.code = code;
    this.statusCode = statusCode;
    this.stderr = stderr;
  }
}

/**
 * Represents a file extracted from an archive
 */
export interface ExtractedFile {
  /** Relative path of the file within the archive */
  path: string;
  /** File content as a string */
  content: string;
}

/**
 * Options for HTTP archive fetching
 */
export interface HttpFetchOptions {
  /** Custom cache directory (defaults to ~/.cache/kustomark/http) */
  cacheDir?: string;
  /** Bearer token for authentication (overrides env vars) */
  authToken?: string;
  /** SHA256 checksum to validate the downloaded file */
  sha256?: string;
  /** Subpath to extract from the archive (e.g., "docs/") */
  subpath?: string;
  /** Whether to update an existing cached archive */
  update?: boolean;
  /** Timeout in milliseconds for HTTP requests */
  timeout?: number;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** Lock file to use for pinned versions */
  lockFile?: LockFile;
  /** Whether to update the lock file (fetch latest) */
  updateLock?: boolean;
}

/**
 * Result of an HTTP archive fetch operation
 */
export interface HttpFetchResult {
  /** Array of extracted files with their paths and contents */
  files: ExtractedFile[];
  /** Whether the archive was fetched from remote or used from cache */
  cached: boolean;
  /** The checksum of the downloaded archive */
  checksum: string;
  /** Lock file entry for this fetch (for lock file generation) */
  lockEntry?: LockFileEntry;
}

/**
 * Supported archive formats
 */
type ArchiveFormat = "tar.gz" | "tgz" | "tar" | "zip";

/**
 * Get the default cache directory for HTTP archives
 */
export function getDefaultCacheDir(): string {
  return join(homedir(), ".cache", "kustomark", "http");
}

/**
 * Generate a cache key for a URL
 * Format: SHA256 hash of the URL to handle any special characters
 */
function getCacheKey(url: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(url);
  const hash = hasher.digest("hex");
  return hash.substring(0, 16); // Use first 16 chars for brevity
}

/**
 * Detect archive format from filename
 */
function detectArchiveFormat(filename: string): ArchiveFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz")) return "tar.gz";
  if (lower.endsWith(".tgz")) return "tgz";
  if (lower.endsWith(".tar")) return "tar";
  if (lower.endsWith(".zip")) return "zip";
  return null;
}

/**
 * Calculate SHA256 checksum of a file
 */
async function calculateChecksum(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const hasher = new Bun.CryptoHasher("sha256");
  const buffer = await file.arrayBuffer();
  hasher.update(new Uint8Array(buffer));
  return hasher.digest("hex");
}

/**
 * Execute a command for archive extraction
 */
async function executeCommand(
  args: string[],
  options: { cwd?: string; timeout?: number } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const [cmd, ...cmdArgs] = args;
  if (!cmd) {
    throw new HttpFetchError("Command is required", "INVALID_COMMAND");
  }
  const proc = Bun.spawn([cmd, ...cmdArgs], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  let killed = false;
  const timeout = options.timeout ?? 30000;
  const timeoutHandle = setTimeout(() => {
    killed = true;
    proc.kill();
  }, timeout);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    clearTimeout(timeoutHandle);

    if (killed) {
      throw new HttpFetchError(`Command timed out after ${timeout}ms`, "TIMEOUT");
    }

    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Extract an archive to a directory
 */
async function extractArchive(
  archivePath: string,
  destDir: string,
  format: ArchiveFormat,
  timeout?: number,
): Promise<void> {
  await mkdir(destDir, { recursive: true });

  let result: { exitCode: number; stdout: string; stderr: string };

  if (format === "tar.gz" || format === "tgz" || format === "tar") {
    // Use tar for tar-based archives
    const tarArgs = ["tar", "-xf", archivePath, "-C", destDir];

    // Add compression flag if needed
    if (format === "tar.gz" || format === "tgz") {
      tarArgs.splice(1, 0, "-z");
    }

    result = await executeCommand(tarArgs, { timeout });
  } else if (format === "zip") {
    // Use unzip for zip archives
    result = await executeCommand(["unzip", "-q", archivePath, "-d", destDir], { timeout });
  } else {
    throw new HttpFetchError(`Unsupported archive format: ${format}`, "UNSUPPORTED_FORMAT");
  }

  if (result.exitCode !== 0) {
    throw new HttpFetchError(
      `Failed to extract archive: ${result.stderr}`,
      "EXTRACTION_FAILED",
      undefined,
      result.stderr,
    );
  }
}

/**
 * Read all files from a directory recursively
 */
async function readFilesRecursively(
  dir: string,
  baseDir: string,
  subpath?: string,
): Promise<ExtractedFile[]> {
  const files: ExtractedFile[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.substring(baseDir.length + 1);

    if (entry.isDirectory()) {
      // Always recurse into directories to find matching files
      const subFiles = await readFilesRecursively(fullPath, baseDir, subpath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      // If subpath is specified, only include files under that path
      if (subpath && !relativePath.startsWith(subpath)) {
        continue;
      }

      try {
        const content = await readFile(fullPath, "utf-8");
        files.push({
          path: subpath ? relativePath.substring(subpath.length) : relativePath,
          content,
        });
      } catch (error) {
        // Log warning but continue processing other files
        console.warn(
          `Warning: Could not read file ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return files;
}

/**
 * Download a file from a URL
 */
async function downloadFile(
  url: string,
  destPath: string,
  options: { authToken?: string; headers?: Record<string, string>; timeout?: number } = {},
): Promise<void> {
  const headers: Record<string, string> = {
    "User-Agent": "kustomark-http-fetcher/1.0",
    ...options.headers,
  };

  // Add authentication if provided
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  const controller = new AbortController();
  const timeout = options.timeout ?? 60000;
  const timeoutHandle = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      throw new HttpFetchError(
        `HTTP ${response.status}: ${response.statusText}`,
        "HTTP_ERROR",
        response.status,
      );
    }

    // Write the response to the file
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(destPath, new Uint8Array(arrayBuffer));
  } catch (error) {
    clearTimeout(timeoutHandle);

    if (error instanceof HttpFetchError) {
      throw error;
    }

    if ((error as Error).name === "AbortError") {
      throw new HttpFetchError(`Download timed out after ${timeout}ms`, "TIMEOUT");
    }

    throw new HttpFetchError(
      `Failed to download file: ${(error as Error).message}`,
      "DOWNLOAD_FAILED",
    );
  }
}

/**
 * Fetch an HTTP archive and extract its contents
 *
 * @param url - URL of the archive to fetch (.tar.gz, .tgz, .tar, .zip)
 * @param options - Fetch options
 * @returns HttpFetchResult with extracted files, cache status, and checksum
 *
 * @example
 * ```typescript
 * const result = await fetchHttpArchive(
 *   'https://example.com/archive.tar.gz',
 *   {
 *     subpath: 'docs/',
 *     sha256: 'abc123...',
 *     authToken: process.env.GITHUB_TOKEN,
 *   }
 * );
 *
 * for (const file of result.files) {
 *   console.log(file.path, file.content);
 * }
 * ```
 */
export async function fetchHttpArchive(
  url: string,
  options: HttpFetchOptions = {},
): Promise<HttpFetchResult> {
  // Detect archive format
  const filename = basename(new URL(url).pathname);
  const format = detectArchiveFormat(filename);

  if (!format) {
    throw new HttpFetchError(
      "Unsupported archive format. URL must end with .tar.gz, .tgz, .tar, or .zip",
      "UNSUPPORTED_FORMAT",
    );
  }

  const cacheDir = options.cacheDir ?? getDefaultCacheDir();
  const cacheKey = getCacheKey(url);
  const archivePath = join(cacheDir, "archives", `${cacheKey}${extname(filename)}`);
  const extractDir = join(cacheDir, "extracted", cacheKey);

  // Get auth token from options or environment
  const authToken = options.authToken ?? process.env.KUSTOMARK_HTTP_TOKEN;

  // Ensure cache directory exists
  await mkdir(join(cacheDir, "archives"), { recursive: true });

  let cached = false;
  let needsDownload = !existsSync(archivePath);

  // Check if we should update existing cache
  if (!needsDownload && (options.update || options.updateLock)) {
    needsDownload = true;
    cached = false;
  } else if (!needsDownload) {
    cached = true;
  }

  // Download if needed
  if (needsDownload) {
    await downloadFile(url, archivePath, {
      authToken,
      headers: options.headers,
      timeout: options.timeout,
    });
  }

  // Validate checksum if provided
  const checksum = await calculateChecksum(archivePath);
  if (options.sha256 && checksum !== options.sha256) {
    // Remove invalid file
    await rm(archivePath, { force: true });
    throw new HttpFetchError(
      `Checksum mismatch: expected ${options.sha256}, got ${checksum}`,
      "CHECKSUM_MISMATCH",
    );
  }

  // If lock file is provided and not updating, verify integrity matches
  if (options.lockFile && !options.updateLock) {
    const lockEntry = findLockEntry(options.lockFile, url);
    if (lockEntry) {
      const expectedIntegrity = `sha256-${checksum}`;
      if (lockEntry.integrity !== expectedIntegrity) {
        // Checksum mismatch with lock file - clear cache and re-fetch
        await rm(archivePath, { force: true });
        if (existsSync(extractDir)) {
          await rm(extractDir, { recursive: true, force: true });
        }

        // Re-download
        await downloadFile(url, archivePath, {
          authToken,
          headers: options.headers,
          timeout: options.timeout,
        });

        // Recalculate checksum
        const newChecksum = await calculateChecksum(archivePath);
        const newIntegrity = `sha256-${newChecksum}`;

        // If still doesn't match, throw error
        if (lockEntry.integrity !== newIntegrity) {
          await rm(archivePath, { force: true });
          throw new HttpFetchError(
            `Integrity mismatch with lock file: expected ${lockEntry.integrity}, got ${newIntegrity}`,
            "INTEGRITY_MISMATCH",
          );
        }
      }
    }
  }

  // Clean and recreate extraction directory
  if (existsSync(extractDir)) {
    await rm(extractDir, { recursive: true, force: true });
  }

  // Extract the archive
  await extractArchive(archivePath, extractDir, format, options.timeout);

  // Read all extracted files
  const files = await readFilesRecursively(extractDir, extractDir, options.subpath);

  // Create lock file entry
  const lockEntry: LockFileEntry = {
    url,
    resolved: url, // HTTP URLs resolve to themselves
    integrity: `sha256-${checksum}`,
    fetched: new Date().toISOString(),
  };

  return {
    files,
    cached,
    checksum,
    lockEntry,
  };
}

/**
 * Clear the HTTP archive cache
 *
 * @param cacheDir - Cache directory to clear (defaults to ~/.cache/kustomark/http)
 * @param pattern - Optional pattern to match cache keys (partial hash match)
 * @returns Number of cache entries cleared
 */
export async function clearHttpCache(cacheDir?: string, pattern?: string): Promise<number> {
  const dir = cacheDir ?? getDefaultCacheDir();

  if (!existsSync(dir)) {
    return 0;
  }

  let cleared = 0;

  // Clear archives
  const archivesDir = join(dir, "archives");
  if (existsSync(archivesDir)) {
    const entries = await readdir(archivesDir);
    for (const entry of entries) {
      if (pattern && !entry.includes(pattern)) {
        continue;
      }
      await rm(join(archivesDir, entry), { force: true });
      cleared++;
    }
  }

  // Clear extracted directories
  const extractedDir = join(dir, "extracted");
  if (existsSync(extractedDir)) {
    const entries = await readdir(extractedDir);
    for (const entry of entries) {
      if (pattern && !entry.includes(pattern)) {
        continue;
      }
      await rm(join(extractedDir, entry), { recursive: true, force: true });
      cleared++;
    }
  }

  return cleared;
}

/**
 * List cached HTTP archives
 *
 * @param cacheDir - Cache directory to list (defaults to ~/.cache/kustomark/http)
 * @returns Array of cache keys
 */
export async function listHttpCache(cacheDir?: string): Promise<string[]> {
  const dir = cacheDir ?? getDefaultCacheDir();
  const archivesDir = join(dir, "archives");

  if (!existsSync(archivesDir)) {
    return [];
  }

  const entries = await readdir(archivesDir);
  return entries.map((entry) => {
    // Remove extension to get cache key
    const key = entry.replace(/\.(tar\.gz|tgz|tar|zip)$/, "");
    return key;
  });
}

/**
 * Get metadata about a cached archive
 *
 * @param url - The URL of the archive
 * @param cacheDir - Cache directory (defaults to ~/.cache/kustomark/http)
 * @returns Object with cache information or null if not cached
 */
export async function getCacheInfo(
  url: string,
  cacheDir?: string,
): Promise<{ exists: boolean; checksum?: string; path?: string } | null> {
  const dir = cacheDir ?? getDefaultCacheDir();
  const cacheKey = getCacheKey(url);
  const archivesDir = join(dir, "archives");

  if (!existsSync(archivesDir)) {
    return { exists: false };
  }

  // Find the archive file
  const entries = await readdir(archivesDir);
  const archiveFile = entries.find((entry) => entry.startsWith(cacheKey));

  if (!archiveFile) {
    return { exists: false };
  }

  const archivePath = join(archivesDir, archiveFile);
  const checksum = await calculateChecksum(archivePath);

  return {
    exists: true,
    checksum,
    path: archivePath,
  };
}
