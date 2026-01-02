/**
 * HTTP Archive Fetcher Module
 *
 * Provides HTTP archive fetching with caching, extraction, and authentication support
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
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
  /** Offline mode - fail if remote fetch is needed */
  offline?: boolean;
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
 *
 * Returns the standard cache location where HTTP archives are stored locally.
 * The cache directory is located at ~/.cache/kustomark/http with subdirectories
 * for 'archives' (downloaded files) and 'extracted' (extracted contents).
 *
 * @returns {string} The absolute path to the default HTTP cache directory
 *
 * @example
 * ```typescript
 * const cacheDir = getDefaultCacheDir();
 * console.log(cacheDir); // /home/user/.cache/kustomark/http
 * ```
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
 * Download a file from a URL using Node.js http/https modules
 * This avoids CORS issues that occur with Bun's fetch() implementation
 */
async function downloadFile(
  url: string,
  destPath: string,
  options: { authToken?: string; headers?: Record<string, string>; timeout?: number } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "User-Agent": "kustomark-http-fetcher/1.0",
      ...options.headers,
    };

    // Add authentication if provided
    if (options.authToken) {
      headers.Authorization = `Bearer ${options.authToken}`;
    }

    const timeout = options.timeout ?? 60000;
    const parsedUrl = new URL(url);
    const get = parsedUrl.protocol === "https:" ? httpsGet : httpGet;

    const request = get(
      url,
      {
        headers,
        timeout,
      },
      (response) => {
        // Handle redirects
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          const redirectUrl = response.headers.location;
          downloadFile(redirectUrl, destPath, options).then(resolve).catch(reject);
          return;
        }

        // Check for HTTP errors
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(
            new HttpFetchError(
              `HTTP ${response.statusCode}: ${response.statusMessage}`,
              "HTTP_ERROR",
              response.statusCode,
            ),
          );
          return;
        }

        // Collect response data
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        response.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            await writeFile(destPath, buffer);
            resolve();
          } catch (error) {
            reject(
              new HttpFetchError(
                `Failed to write file: ${(error as Error).message}`,
                "WRITE_FAILED",
              ),
            );
          }
        });

        response.on("error", (error) => {
          reject(new HttpFetchError(`Response error: ${error.message}`, "DOWNLOAD_FAILED"));
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      reject(new HttpFetchError(`Download timed out after ${timeout}ms`, "TIMEOUT"));
    });

    request.on("error", (error) => {
      reject(new HttpFetchError(`Failed to download file: ${error.message}`, "DOWNLOAD_FAILED"));
    });

    request.end();
  });
}

/**
 * Fetch an HTTP archive and extract its contents
 *
 * Downloads and extracts an archive file from a URL to the local cache. Supports
 * multiple archive formats (.tar.gz, .tgz, .tar, .zip) and optional extraction of
 * specific subdirectories. Includes checksum verification, authentication support,
 * and lock file integration for reproducible builds.
 *
 * @param {string} url - URL of the archive to fetch. Must end with a supported extension:
 *   .tar.gz, .tgz, .tar, or .zip
 * @param {HttpFetchOptions} [options={}] - Fetch options including:
 *   - cacheDir: Custom cache directory (defaults to ~/.cache/kustomark/http)
 *   - authToken: Bearer token for authentication (overrides KUSTOMARK_HTTP_TOKEN env var)
 *   - sha256: SHA256 checksum to validate the downloaded file
 *   - subpath: Subpath to extract from the archive (e.g., "docs/")
 *   - update: Whether to update an existing cached archive
 *   - timeout: Timeout in milliseconds for HTTP requests
 *   - headers: Additional HTTP headers
 *   - lockFile: Lock file to use for pinned versions
 *   - updateLock: Whether to update the lock file (fetch latest)
 *   - offline: Offline mode - fail if remote fetch is needed
 * @returns {Promise<HttpFetchResult>} Result containing:
 *   - files: Array of extracted files with their paths and contents
 *   - cached: Whether the archive was fetched from remote or used from cache
 *   - checksum: The SHA256 checksum of the downloaded archive
 *   - lockEntry: Lock file entry for this fetch
 *
 * @throws {HttpFetchError} If the URL has an unsupported format, download fails,
 *   checksum verification fails, or offline mode prevents fetching
 *
 * @example
 * ```typescript
 * // Basic usage - fetch and extract all files
 * const result = await fetchHttpArchive(
 *   'https://example.com/archive.tar.gz'
 * );
 * for (const file of result.files) {
 *   console.log(file.path, file.content);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Fetch with subpath and checksum verification
 * const result = await fetchHttpArchive(
 *   'https://example.com/archive.tar.gz',
 *   {
 *     subpath: 'docs/',
 *     sha256: 'abc123...',
 *     authToken: process.env.GITHUB_TOKEN,
 *   }
 * );
 * console.log(`Found ${result.files.length} files in docs/`);
 * ```
 *
 * @example
 * ```typescript
 * // Fetch with custom headers and timeout
 * const result = await fetchHttpArchive(
 *   'https://api.example.com/releases/v1.0.0/package.zip',
 *   {
 *     headers: { 'X-Custom-Header': 'value' },
 *     timeout: 120000,
 *     update: true
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Offline mode - only use cached archives
 * const result = await fetchHttpArchive(
 *   'https://example.com/archive.tar.gz',
 *   { offline: true }
 * );
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

  // In offline mode, fail if archive is not cached
  if (needsDownload && options.offline) {
    throw new HttpFetchError(
      `Cannot fetch ${url} in offline mode. Run without --offline to fetch.`,
      "OFFLINE_MODE",
    );
  }

  // Check if we should update existing cache
  if (!needsDownload && (options.update || options.updateLock)) {
    // In offline mode, cannot update existing cache
    if (options.offline) {
      throw new HttpFetchError(
        `Cannot update ${url} in offline mode. Run without --offline to update.`,
        "OFFLINE_MODE",
      );
    }

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
 * Removes cached HTTP archives and their extracted contents from the local cache
 * directory. You can optionally specify a pattern to only clear matching entries.
 * This is useful for freeing up disk space or forcing fresh downloads.
 *
 * @param {string} [cacheDir] - Cache directory to clear (defaults to ~/.cache/kustomark/http)
 * @param {string} [pattern] - Optional pattern to match cache keys (partial hash match).
 *   If provided, only cache entries containing this pattern will be cleared.
 * @returns {Promise<number>} Number of cache entries cleared (both archives and extracted directories)
 *
 * @example
 * ```typescript
 * // Clear all cached archives
 * const cleared = await clearHttpCache();
 * console.log(`Cleared ${cleared} cache entries`);
 * ```
 *
 * @example
 * ```typescript
 * // Clear specific cache entries by partial hash
 * const cleared = await clearHttpCache(undefined, 'a1b2c3');
 * console.log(`Cleared ${cleared} matching entries`);
 * ```
 *
 * @example
 * ```typescript
 * // Clear cache from custom directory
 * const cleared = await clearHttpCache('/custom/cache/dir');
 * ```
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
 * Returns a list of all cached HTTP archives in the cache directory.
 * Each entry represents a cached archive identified by its cache key
 * (a hash of the source URL).
 *
 * @param {string} [cacheDir] - Cache directory to list (defaults to ~/.cache/kustomark/http)
 * @returns {Promise<string[]>} Array of cache keys representing cached archives
 *
 * @example
 * ```typescript
 * // List all cached archives
 * const cached = await listHttpCache();
 * console.log(cached);
 * // ['a1b2c3d4e5f6g7h8', '9i0j1k2l3m4n5o6p']
 * ```
 *
 * @example
 * ```typescript
 * // List cached archives from a custom cache directory
 * const cached = await listHttpCache('/custom/cache/dir');
 * ```
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
 * Checks if a specific URL is cached and returns information about the cached
 * archive including its checksum and file path. Useful for verifying cache
 * status before fetching.
 *
 * @param {string} url - The URL of the archive to check
 * @param {string} [cacheDir] - Cache directory (defaults to ~/.cache/kustomark/http)
 * @returns {Promise<{exists: boolean; checksum?: string; path?: string} | null>}
 *   Object with cache information:
 *   - exists: Whether the archive is cached
 *   - checksum: SHA256 checksum of the cached archive (if exists)
 *   - path: Absolute path to the cached archive file (if exists)
 *
 * @example
 * ```typescript
 * // Check if an archive is cached
 * const info = await getCacheInfo('https://example.com/archive.tar.gz');
 * if (info?.exists) {
 *   console.log(`Cached at ${info.path}`);
 *   console.log(`Checksum: ${info.checksum}`);
 * } else {
 *   console.log('Not cached');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Check cache with custom directory
 * const info = await getCacheInfo(
 *   'https://example.com/archive.tar.gz',
 *   '/custom/cache/dir'
 * );
 * ```
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
