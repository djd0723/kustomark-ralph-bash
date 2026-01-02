/**
 * Git Fetcher Module
 *
 * Provides git repository fetching with caching and authentication support
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseGitUrl } from "./git-url-parser.js";
import { findLockEntry } from "./lock-file.js";
import type { LockFile, LockFileEntry, ParsedGitUrl } from "./types.js";
import { createLogger, LogLevel, Verbosity } from "./utils/logger.js";

/**
 * Error thrown when git operations fail
 */
export class GitFetchError extends Error {
  public readonly code: string;
  public readonly stderr?: string;

  constructor(message: string, code: string, stderr?: string) {
    super(message);
    this.name = "GitFetchError";
    this.code = code;
    this.stderr = stderr;
  }
}

/**
 * Result of a git fetch operation
 */
export interface GitFetchResult {
  /** Path to the cached repository */
  repoPath: string;
  /** Whether the repository was fetched from remote or used from cache */
  cached: boolean;
  /** The resolved commit SHA */
  resolvedSha: string;
  /** Lock file entry for this fetch (for lock file generation) */
  lockEntry?: LockFileEntry;
}

/**
 * Options for git fetching
 */
export interface GitFetchOptions {
  /** Custom cache directory (defaults to ~/.cache/kustomark/git) */
  cacheDir?: string;
  /** Whether to update an existing cached repository */
  update?: boolean;
  /** Timeout in milliseconds for git operations */
  timeout?: number;
  /** Lock file to use for pinned versions */
  lockFile?: LockFile;
  /** Whether to update the lock file (fetch latest) */
  updateLock?: boolean;
  /** Offline mode - fail if remote fetch is needed */
  offline?: boolean;
  /** Authentication token (for HTTPS git operations) */
  authToken?: string;
  /** Maximum number of retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  retryBaseDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 30000) */
  retryMaxDelay?: number;
  /** Enable verbose logging of retry attempts (default: false) */
  verbose?: boolean;
}

/**
 * Get the default cache directory for git repositories
 *
 * Returns the standard cache location where git repositories are stored
 * locally. The cache directory is located at ~/.cache/kustomark/git.
 *
 * @returns {string} The absolute path to the default git cache directory
 *
 * @example
 * ```typescript
 * const cacheDir = getDefaultCacheDir();
 * console.log(cacheDir); // /home/user/.cache/kustomark/git
 * ```
 */
export function getDefaultCacheDir(): string {
  return join(homedir(), ".cache", "kustomark", "git");
}

/**
 * Check if a git error is retryable
 *
 * Determines if a git operation error is transient and should be retried.
 * Retryable errors include network failures, timeouts, and temporary
 * server issues.
 *
 * @param error - The GitFetchError to check
 * @returns true if the error is retryable, false otherwise
 */
function isRetryableGitError(error: GitFetchError): boolean {
  // Network errors (retryable)
  const retryableErrorCodes = [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNABORTED",
    "ENETUNREACH",
    "EAI_AGAIN",
  ];

  // Check for network error codes in error message or stderr
  const errorText = `${error.message} ${error.stderr || ""}`;
  if (retryableErrorCodes.some((code) => errorText.includes(code))) {
    return true;
  }

  // Timeout errors
  if (error.code === "TIMEOUT") {
    return true;
  }

  // Git-specific transient errors
  if (error.stderr) {
    const stderr = error.stderr.toLowerCase();
    // Connection/network issues
    if (
      stderr.includes("could not resolve host") ||
      stderr.includes("failed to connect") ||
      stderr.includes("connection timed out") ||
      stderr.includes("connection reset") ||
      stderr.includes("transfer closed") ||
      stderr.includes("rpc failed") ||
      stderr.includes("the remote end hung up") ||
      stderr.includes("error: rpc failed") ||
      stderr.includes("fatal: the remote end hung up unexpectedly")
    ) {
      return true;
    }

    // Temporary server issues
    if (
      stderr.includes("503 service unavailable") ||
      stderr.includes("502 bad gateway") ||
      stderr.includes("504 gateway timeout")
    ) {
      return true;
    }
  }

  // Non-retryable errors: authentication failures, invalid URLs, etc.
  if (
    error.code === "CLONE_FAILED" &&
    error.stderr &&
    (error.stderr.includes("Authentication failed") ||
      error.stderr.includes("could not read Username") ||
      error.stderr.includes("Permission denied") ||
      error.stderr.includes("Repository not found"))
  ) {
    return false;
  }

  // Default: assume retryable for CLONE_FAILED, FETCH_FAILED
  return error.code === "CLONE_FAILED" || error.code === "FETCH_FAILED";
}

/**
 * Calculate retry delay with exponential backoff
 *
 * Implements exponential backoff with jitter to prevent thundering herd.
 * Formula: min(maxDelay, baseDelay * 2^attempt) + jitter
 *
 * @param attempt - Current retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay cap in milliseconds (default: 30000)
 * @returns Delay in milliseconds before next retry
 */
function calculateRetryDelay(attempt: number, baseDelay = 1000, maxDelay = 30000): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * 2 ** attempt;

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter (0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;

  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a cache key for a git URL
 * Format: {host}_{org}_{repo}
 */
function getCacheKey(parsed: ParsedGitUrl): string {
  const host = parsed.host.replace(/[^a-zA-Z0-9]/g, "_");
  const org = parsed.org.replace(/[^a-zA-Z0-9]/g, "_");
  const repo = parsed.repo.replace(/[^a-zA-Z0-9]/g, "_");
  return `${host}_${org}_${repo}`;
}

/**
 * Execute a git command
 */
async function executeGit(
  args: string[],
  options: { cwd?: string; timeout?: number; authToken?: string } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const env: Record<string, string> = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0", // Disable interactive prompts
  };

  // Add auth token to environment for HTTPS operations
  if (options.authToken) {
    // Git can use GIT_ASKPASS with a custom script, but for simplicity
    // we'll inject the token into the URL via git credential helper
    // For GitHub, the token can be used as password with 'x-access-token' as username
    env.GIT_USERNAME = "x-access-token";
    env.GIT_PASSWORD = options.authToken;
  }

  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });

  let killed = false;
  const timeout = options.timeout ?? 60000;
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
      throw new GitFetchError(`Git operation timed out after ${timeout}ms`, "TIMEOUT");
    }

    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Clone a git repository with retry logic
 */
async function cloneRepositoryWithRetry(
  url: string,
  dest: string,
  options: {
    sparsePath?: string;
    timeout?: number;
    authToken?: string;
    maxRetries?: number;
    retryBaseDelay?: number;
    retryMaxDelay?: number;
    verbose?: boolean;
  } = {},
): Promise<void> {
  const maxRetries = options.maxRetries ?? 3;
  const retryBaseDelay = options.retryBaseDelay ?? 1000;
  const retryMaxDelay = options.retryMaxDelay ?? 30000;
  const verbose = options.verbose ?? false;

  // Create a logger for git operations
  const logger = createLogger({
    component: "git-fetcher",
    level: LogLevel.DEBUG,
    verbosity: verbose ? Verbosity.VERBOSE : Verbosity.NORMAL,
  });

  let lastError: GitFetchError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await cloneRepository(url, dest, options.sparsePath, options.timeout, options.authToken);
      // Success!
      if (attempt > 0) {
        logger.info(`Successfully cloned ${url} after ${attempt} retry attempt(s)`, {
          url,
          attempts: attempt,
        });
      }
      return;
    } catch (error) {
      if (!(error instanceof GitFetchError)) {
        throw error;
      }

      lastError = error;

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableGitError(lastError)) {
        logger.debug(`Non-retryable error encountered: ${lastError.code}`, {
          code: lastError.code,
          message: lastError.message,
        });
        throw lastError;
      }

      // Calculate delay
      const delay = calculateRetryDelay(attempt, retryBaseDelay, retryMaxDelay);

      logger.debug(
        `Retry attempt ${attempt + 1}/${maxRetries} for cloning ${url} after ${delay}ms`,
        {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: lastError.message,
          url,
        },
      );

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Clone a git repository (internal function without retry)
 */
async function cloneRepository(
  url: string,
  dest: string,
  sparsePath?: string,
  timeout?: number,
  authToken?: string,
): Promise<void> {
  if (sparsePath) {
    // Clone with sparse checkout
    const { exitCode, stderr } = await executeGit(
      ["clone", "--no-checkout", "--filter=blob:none", url, dest],
      { timeout, authToken },
    );

    if (exitCode !== 0) {
      throw new GitFetchError(`Failed to clone repository: ${stderr}`, "CLONE_FAILED", stderr);
    }

    // Initialize sparse checkout
    const sparseResult = await executeGit(["sparse-checkout", "init", "--cone"], {
      cwd: dest,
      timeout,
      authToken,
    });

    if (sparseResult.exitCode !== 0) {
      throw new GitFetchError(
        `Failed to initialize sparse checkout: ${sparseResult.stderr}`,
        "SPARSE_INIT_FAILED",
        sparseResult.stderr,
      );
    }

    // Set sparse checkout path
    const setResult = await executeGit(["sparse-checkout", "set", sparsePath], {
      cwd: dest,
      timeout,
      authToken,
    });

    if (setResult.exitCode !== 0) {
      throw new GitFetchError(
        `Failed to set sparse checkout path: ${setResult.stderr}`,
        "SPARSE_SET_FAILED",
        setResult.stderr,
      );
    }
  } else {
    // Standard clone
    const { exitCode, stderr } = await executeGit(["clone", url, dest], { timeout, authToken });

    if (exitCode !== 0) {
      throw new GitFetchError(`Failed to clone repository: ${stderr}`, "CLONE_FAILED", stderr);
    }
  }
}

/**
 * Checkout a specific ref (branch, tag, or commit)
 */
async function checkoutRef(
  repoPath: string,
  ref: string,
  timeout?: number,
  authToken?: string,
): Promise<string> {
  // Fetch the ref if it's not available locally
  const fetchResult = await executeGit(["fetch", "origin", ref], {
    cwd: repoPath,
    timeout,
    authToken,
  });

  if (fetchResult.exitCode !== 0) {
    // If fetch fails, try fetching all refs (might be a tag)
    const fetchAllResult = await executeGit(["fetch", "origin"], {
      cwd: repoPath,
      timeout,
      authToken,
    });

    if (fetchAllResult.exitCode !== 0) {
      throw new GitFetchError(
        `Failed to fetch ref ${ref}: ${fetchAllResult.stderr}`,
        "FETCH_FAILED",
        fetchAllResult.stderr,
      );
    }
  }

  // Checkout the ref
  const checkoutResult = await executeGit(["checkout", ref], {
    cwd: repoPath,
    timeout,
    authToken,
  });

  if (checkoutResult.exitCode !== 0) {
    throw new GitFetchError(
      `Failed to checkout ref ${ref}: ${checkoutResult.stderr}`,
      "CHECKOUT_FAILED",
      checkoutResult.stderr,
    );
  }

  // Get the resolved commit SHA
  const revParseResult = await executeGit(["rev-parse", "HEAD"], {
    cwd: repoPath,
    timeout,
    authToken,
  });

  if (revParseResult.exitCode !== 0) {
    throw new GitFetchError(
      `Failed to resolve commit SHA: ${revParseResult.stderr}`,
      "REV_PARSE_FAILED",
      revParseResult.stderr,
    );
  }

  return revParseResult.stdout;
}

/**
 * Calculate content hash of all markdown files in a git repository path
 *
 * @param repoPath - Path to the repository
 * @param subpath - Optional subpath within the repository
 * @returns SHA256 hash (hex string without prefix)
 */
async function calculateGitContentHash(repoPath: string, subpath?: string): Promise<string> {
  const searchPath = subpath ? join(repoPath, subpath) : repoPath;

  // Find all .md files recursively using git ls-files for reliability
  const lsFilesResult = await executeGit(["ls-files", "*.md"], { cwd: searchPath });

  if (lsFilesResult.exitCode !== 0) {
    // Fallback to finding files manually if git ls-files fails
    const files: string[] = [];

    async function walkDir(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip .git directory
          if (entry.name !== ".git") {
            await walkDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          // Make path relative to searchPath
          const relativePath = fullPath.substring(searchPath.length + 1);
          files.push(relativePath);
        }
      }
    }

    await walkDir(searchPath);
    files.sort();

    // Hash all files
    const hasher = new Bun.CryptoHasher("sha256");
    for (const file of files) {
      const filePath = join(searchPath, file);
      const content = await readFile(filePath);
      hasher.update(content);
    }

    return hasher.digest("hex");
  }

  // Parse git ls-files output
  const files = lsFilesResult.stdout
    .split("\n")
    .filter((f) => f.trim().length > 0)
    .sort();

  // Hash all files in sorted order
  const hasher = new Bun.CryptoHasher("sha256");
  for (const file of files) {
    const filePath = join(searchPath, file);
    const content = await readFile(filePath);
    hasher.update(content);
  }

  return hasher.digest("hex");
}

/**
 * Fetch a git repository and return the path to the cached copy
 *
 * Clones or updates a git repository to the local cache, checks out the specified
 * ref (branch, tag, or commit), and returns metadata about the fetch operation.
 * Supports GitHub shorthand URLs, HTTPS git URLs, and SSH git URLs with optional
 * sparse checkout for specific subdirectories.
 *
 * @param {string} gitUrl - Git URL to fetch. Supports multiple formats:
 *   - GitHub shorthand: `github.com/org/repo//path?ref=v1.0.0`
 *   - HTTPS: `git::https://github.com/org/repo.git//subdir?ref=main`
 *   - SSH: `git::git@github.com:org/repo.git//path?ref=abc1234`
 * @param {GitFetchOptions} [options={}] - Fetch options including:
 *   - cacheDir: Custom cache directory (defaults to ~/.cache/kustomark/git)
 *   - update: Whether to update an existing cached repository
 *   - timeout: Timeout in milliseconds for git operations
 *   - lockFile: Lock file to use for pinned versions
 *   - updateLock: Whether to update the lock file (fetch latest)
 *   - offline: Offline mode - fail if remote fetch is needed
 *   - authToken: Authentication token (for HTTPS git operations)
 * @returns {Promise<GitFetchResult>} Result containing:
 *   - repoPath: Path to the cached repository
 *   - cached: Whether the repository was fetched from remote or used from cache
 *   - resolvedSha: The resolved commit SHA
 *   - lockEntry: Lock file entry for this fetch
 *
 * @throws {GitFetchError} If the URL is invalid, git operations fail, or offline mode prevents fetching
 *
 * @example
 * ```typescript
 * // Fetch a repository using GitHub shorthand
 * const result = await fetchGitRepository(
 *   'github.com/org/repo//path?ref=v1.0.0'
 * );
 * console.log(result.repoPath); // ~/.cache/kustomark/git/github_com_org_repo
 * console.log(result.resolvedSha); // abc123...
 * console.log(result.cached); // false (first fetch)
 * ```
 *
 * @example
 * ```typescript
 * // Fetch with authentication and update existing cache
 * const result = await fetchGitRepository(
 *   'git::https://github.com/org/private-repo.git?ref=main',
 *   {
 *     authToken: process.env.GITHUB_TOKEN,
 *     update: true,
 *     timeout: 120000
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Fetch in offline mode (uses cache only)
 * const result = await fetchGitRepository(
 *   'github.com/org/repo?ref=v1.0.0',
 *   { offline: true }
 * );
 * ```
 */
export async function fetchGitRepository(
  gitUrl: string,
  options: GitFetchOptions = {},
): Promise<GitFetchResult> {
  const parsed = parseGitUrl(gitUrl);
  if (!parsed) {
    throw new GitFetchError(`Invalid git URL: ${gitUrl}`, "INVALID_URL");
  }

  const cacheDir = options.cacheDir ?? getDefaultCacheDir();
  const cacheKey = getCacheKey(parsed);
  const repoPath = join(cacheDir, cacheKey);
  let ref = parsed.ref ?? "main";

  // Check lock file for pinned version
  if (options.lockFile && !options.updateLock) {
    const lockEntry = findLockEntry(options.lockFile, gitUrl);
    if (lockEntry) {
      // Use the locked SHA instead of the ref from the URL
      ref = lockEntry.resolved;
    }
  }

  // Ensure cache directory exists
  await mkdir(cacheDir, { recursive: true });

  let cached = false;
  let needsClone = !existsSync(repoPath);

  // In offline mode, fail if repository is not cached
  if (needsClone && options.offline) {
    throw new GitFetchError(
      `Cannot fetch ${parsed.host}/${parsed.org}/${parsed.repo} in offline mode. Run without --offline to fetch.`,
      "OFFLINE_MODE",
    );
  }

  if (!needsClone && options.update) {
    // In offline mode, cannot update existing repository
    if (options.offline) {
      throw new GitFetchError(
        `Cannot update ${parsed.host}/${parsed.org}/${parsed.repo} in offline mode. Run without --offline to update.`,
        "OFFLINE_MODE",
      );
    }

    // Update existing repository with retry logic
    const maxRetries = options.maxRetries ?? 3;
    const retryBaseDelay = options.retryBaseDelay ?? 1000;
    const retryMaxDelay = options.retryMaxDelay ?? 30000;
    const verbose = options.verbose ?? false;

    // Create a logger for git operations
    const logger = createLogger({
      component: "git-fetcher",
      level: LogLevel.DEBUG,
      verbosity: verbose ? Verbosity.VERBOSE : Verbosity.NORMAL,
    });

    let fetchSuccess = false;
    let lastError: GitFetchError | undefined;

    for (let attempt = 0; attempt <= maxRetries && !fetchSuccess; attempt++) {
      try {
        await executeGit(["fetch", "origin"], {
          cwd: repoPath,
          timeout: options.timeout,
          authToken: options.authToken,
        });
        fetchSuccess = true;
        if (attempt > 0) {
          logger.info(`Successfully fetched updates after ${attempt} retry attempt(s)`, {
            attempts: attempt,
          });
        }
      } catch (error) {
        if (!(error instanceof GitFetchError)) {
          throw error;
        }

        lastError = error;

        // If this was the last attempt, fall back to fresh clone
        if (attempt === maxRetries) {
          logger.debug(`All ${maxRetries} retry attempts exhausted, falling back to fresh clone`, {
            maxRetries,
          });
          await rm(repoPath, { recursive: true, force: true });
          needsClone = true;
          break;
        }

        // Check if error is retryable
        if (!isRetryableGitError(lastError)) {
          logger.debug(
            `Non-retryable error encountered: ${lastError.code}, falling back to fresh clone`,
            {
              code: lastError.code,
              message: lastError.message,
            },
          );
          await rm(repoPath, { recursive: true, force: true });
          needsClone = true;
          break;
        }

        // Calculate delay
        const delay = calculateRetryDelay(attempt, retryBaseDelay, retryMaxDelay);

        logger.debug(
          `Retry attempt ${attempt + 1}/${maxRetries} for fetching updates after ${delay}ms`,
          {
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: lastError.message,
          },
        );

        // Wait before retrying
        await sleep(delay);
      }
    }
  } else if (!needsClone) {
    cached = true;
  }

  // Clone if needed
  if (needsClone) {
    await cloneRepositoryWithRetry(parsed.cloneUrl, repoPath, {
      sparsePath: parsed.path,
      timeout: options.timeout,
      authToken: options.authToken,
      maxRetries: options.maxRetries,
      retryBaseDelay: options.retryBaseDelay,
      retryMaxDelay: options.retryMaxDelay,
      verbose: options.verbose,
    });
  }

  // Checkout the specified ref
  const resolvedSha = await checkoutRef(repoPath, ref, options.timeout, options.authToken);

  // Calculate content hash and create lock entry
  const contentHash = await calculateGitContentHash(repoPath, parsed.path);
  const lockEntry: LockFileEntry = {
    url: gitUrl,
    resolved: resolvedSha,
    integrity: `sha256-${contentHash}`,
    fetched: new Date().toISOString(),
  };

  return {
    repoPath,
    cached,
    resolvedSha,
    lockEntry,
  };
}

/**
 * Clear the git cache
 *
 * Removes cached git repositories from the local cache directory. You can optionally
 * specify a pattern to only clear matching repositories. This is useful for freeing
 * up disk space or forcing fresh clones.
 *
 * @param {string} [cacheDir] - Cache directory to clear (defaults to ~/.cache/kustomark/git)
 * @param {string} [pattern] - Optional pattern to match cache keys (e.g., 'github_com_org_repo').
 *   If provided, only cache entries containing this pattern will be cleared.
 * @returns {Promise<number>} The number of cache entries cleared
 *
 * @example
 * ```typescript
 * // Clear all cached repositories
 * const cleared = await clearGitCache();
 * console.log(`Cleared ${cleared} repositories`);
 * ```
 *
 * @example
 * ```typescript
 * // Clear only repositories from github.com
 * const cleared = await clearGitCache(undefined, 'github_com');
 * console.log(`Cleared ${cleared} GitHub repositories`);
 * ```
 *
 * @example
 * ```typescript
 * // Clear repositories from a specific organization
 * const cleared = await clearGitCache(undefined, 'github_com_myorg');
 * ```
 */
export async function clearGitCache(cacheDir?: string, pattern?: string): Promise<number> {
  const dir = cacheDir ?? getDefaultCacheDir();

  if (!existsSync(dir)) {
    return 0;
  }

  const entries = await readdir(dir);
  let cleared = 0;

  for (const entry of entries) {
    if (pattern && !entry.includes(pattern)) {
      continue;
    }

    const entryPath = join(dir, entry);
    await rm(entryPath, { recursive: true, force: true });
    cleared++;
  }

  return cleared;
}

/**
 * List cached git repositories
 *
 * Returns a list of all cached git repositories in the cache directory.
 * Each entry represents a cached repository identified by its cache key
 * in the format: {host}_{org}_{repo}.
 *
 * @param {string} [cacheDir] - Cache directory to list (defaults to ~/.cache/kustomark/git)
 * @returns {Promise<string[]>} Array of cache keys representing cached repositories
 *
 * @example
 * ```typescript
 * // List all cached repositories
 * const cached = await listGitCache();
 * console.log(cached);
 * // ['github_com_org_repo1', 'github_com_org_repo2']
 * ```
 *
 * @example
 * ```typescript
 * // List cached repositories from a custom cache directory
 * const cached = await listGitCache('/custom/cache/dir');
 * ```
 */
export async function listGitCache(cacheDir?: string): Promise<string[]> {
  const dir = cacheDir ?? getDefaultCacheDir();

  if (!existsSync(dir)) {
    return [];
  }

  return await readdir(dir);
}
