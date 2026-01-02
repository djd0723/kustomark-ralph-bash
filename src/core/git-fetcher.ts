/**
 * Git Fetcher Module
 *
 * Provides git repository fetching with caching and authentication support
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseGitUrl } from "./git-url-parser.js";
import { findLockEntry } from "./lock-file.js";
import type { LockFile, LockFileEntry, ParsedGitUrl } from "./types.js";

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
}

/**
 * Get the default cache directory for git repositories
 */
export function getDefaultCacheDir(): string {
  return join(homedir(), ".cache", "kustomark", "git");
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
 * Clone a git repository
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
 * @param gitUrl - Git URL to fetch (GitHub shorthand, git::https://, or git::git@)
 * @param options - Fetch options
 * @returns GitFetchResult with repo path, cache status, and resolved SHA
 *
 * @example
 * ```typescript
 * const result = await fetchGitRepository(
 *   'github.com/org/repo//path?ref=v1.0.0'
 * );
 * console.log(result.repoPath); // ~/.cache/kustomark/git/github_com_org_repo
 * console.log(result.resolvedSha); // abc123...
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

    // Update existing repository
    try {
      await executeGit(["fetch", "origin"], {
        cwd: repoPath,
        timeout: options.timeout,
        authToken: options.authToken,
      });
    } catch (error) {
      // If fetch fails, remove the cached repo and clone fresh
      await rm(repoPath, { recursive: true, force: true });
      needsClone = true;
    }
  } else if (!needsClone) {
    cached = true;
  }

  // Clone if needed
  if (needsClone) {
    await cloneRepository(
      parsed.cloneUrl,
      repoPath,
      parsed.path,
      options.timeout,
      options.authToken,
    );
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
 * @param cacheDir - Cache directory to clear (defaults to ~/.cache/kustomark/git)
 * @param pattern - Optional pattern to match cache keys (e.g., 'github_com_org_repo')
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
 * @param cacheDir - Cache directory to list (defaults to ~/.cache/kustomark/git)
 * @returns Array of cache keys
 */
export async function listGitCache(cacheDir?: string): Promise<string[]> {
  const dir = cacheDir ?? getDefaultCacheDir();

  if (!existsSync(dir)) {
    return [];
  }

  return await readdir(dir);
}
