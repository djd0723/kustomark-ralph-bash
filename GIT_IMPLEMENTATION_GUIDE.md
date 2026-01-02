# Git Operations Implementation Guide for Kustomark

This document provides concrete, ready-to-implement code examples for integrating git operations into Kustomark. These examples follow the existing code patterns and integrate seamlessly with the current architecture.

## Table of Contents

1. [Core Git Module](#core-git-module)
2. [Authentication Module](#authentication-module)
3. [Caching Module](#caching-module)
4. [Integration Points](#integration-points)
5. [CLI Commands](#cli-commands)
6. [Testing Strategy](#testing-strategy)

---

## Core Git Module

### File: `src/core/git-operations.ts`

This module provides the main git operations API for Kustomark.

```typescript
/**
 * Core Git Operations Module
 *
 * Provides high-level abstractions for git operations:
 * - Clone repositories
 * - Fetch updates
 * - Checkout refs
 * - Extract subdirectories
 * - Handle sparse checkouts
 */

import { ParsedGitUrl } from "./types.js";

// Custom error types (see git-errors.ts)
export class GitOperationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stderr: string = ""
  ) {
    super(message);
    this.name = "GitOperationError";
  }
}

export interface GitOperationOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface GitOperationResult {
  success: boolean;
  message: string;
  stderr?: string;
  stdout?: string;
}

/**
 * Execute a git command with comprehensive error handling
 *
 * @param args - Git command arguments (without 'git' prefix)
 * @param options - Operation options
 * @returns Result with exit code and output
 */
export const executeGitCommand = async (
  args: string[],
  options: GitOperationOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    timeout: options.timeout ?? 30000,
    stdout: "pipe",
    stderr: "pipe",
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });

  const [stdout, stderr] = await Promise.all([
    Bun.readableStreamToText(proc.stdout),
    Bun.readableStreamToText(proc.stderr),
  ]);

  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
};

/**
 * Clone a git repository
 *
 * @param url - Git URL
 * @param dest - Destination directory
 * @param options - Optional sparse path for sparse checkout
 * @returns Success result or error
 */
export const cloneRepository = async (
  url: string,
  dest: string,
  sparsePathopt?: string
): Promise<GitOperationResult> => {
  try {
    const args = ["clone"];

    // Add sparse checkout if path is specified
    if (sparsePathopt) {
      args.push("--no-checkout", url, dest);

      const { exitCode, stderr } = await executeGitCommand(args);

      if (exitCode !== 0) {
        return classifyCloneError(stderr, url);
      }

      // Setup sparse checkout
      const sparseResult = await executeGitCommand(
        ["sparse-checkout", "set", sparsePathopt],
        { cwd: dest }
      );

      if (sparseResult.exitCode !== 0) {
        return {
          success: false,
          message: `Failed to set sparse checkout for ${sparsePathopt}`,
          stderr: sparseResult.stderr,
        };
      }

      // Perform checkout
      const checkoutResult = await executeGitCommand(["checkout"], { cwd: dest });

      if (checkoutResult.exitCode !== 0) {
        return {
          success: false,
          message: "Failed to checkout repository",
          stderr: checkoutResult.stderr,
        };
      }
    } else {
      // Standard clone
      args.push(url, dest);
      const { exitCode, stderr } = await executeGitCommand(args, {
        timeout: 60000, // Longer timeout for large repos
      });

      if (exitCode !== 0) {
        return classifyCloneError(stderr, url);
      }
    }

    return {
      success: true,
      message: `Repository cloned successfully from ${url}${
        sparsePathopt ? ` (sparse: ${sparsePathopt})` : ""
      }`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Clone operation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Shallow clone a repository (faster for large repos)
 *
 * @param url - Git URL
 * @param dest - Destination directory
 * @param depth - Number of commits to fetch (default: 1)
 * @returns Success result or error
 */
export const shallowCloneRepository = async (
  url: string,
  dest: string,
  depth: number = 1
): Promise<GitOperationResult> => {
  try {
    const { exitCode, stderr } = await executeGitCommand(
      ["clone", "--depth", String(depth), url, dest],
      { timeout: 30000 }
    );

    if (exitCode === 0) {
      return {
        success: true,
        message: `Shallow repository cloned (depth=${depth}) from ${url}`,
      };
    }

    return classifyCloneError(stderr, url);
  } catch (error) {
    return {
      success: false,
      message: `Shallow clone failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Fetch updates from remote
 *
 * @param repoPath - Path to local repository
 * @param remote - Remote name (default: 'origin')
 * @returns Success result or error
 */
export const fetchRepository = async (
  repoPath: string,
  remote: string = "origin"
): Promise<GitOperationResult> => {
  try {
    const { exitCode, stderr } = await executeGitCommand(
      ["fetch", remote],
      { cwd: repoPath, timeout: 60000 }
    );

    if (exitCode === 0) {
      return {
        success: true,
        message: `Fetched updates from ${remote}`,
      };
    }

    return {
      success: false,
      message: `Failed to fetch from ${remote}`,
      stderr,
    };
  } catch (error) {
    return {
      success: false,
      message: `Fetch operation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Checkout a specific ref (branch, tag, or commit)
 *
 * @param repoPath - Path to local repository
 * @param ref - Ref to checkout (branch, tag, or commit hash)
 * @returns Success result or error
 */
export const checkoutRef = async (
  repoPath: string,
  ref: string
): Promise<GitOperationResult> => {
  try {
    const { exitCode, stderr } = await executeGitCommand(
      ["checkout", ref],
      { cwd: repoPath }
    );

    if (exitCode === 0) {
      return {
        success: true,
        message: `Checked out ref: ${ref}`,
      };
    }

    if (stderr.includes("unknown revision")) {
      return {
        success: false,
        message: `Ref not found: ${ref}`,
        stderr,
      };
    }

    return {
      success: false,
      message: `Failed to checkout ref: ${ref}`,
      stderr,
    };
  } catch (error) {
    return {
      success: false,
      message: `Checkout operation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Resolve a ref to its commit hash
 *
 * @param repoPath - Path to local repository
 * @param ref - Ref to resolve (branch, tag, or commit hash)
 * @returns Commit hash or null if ref not found
 */
export const resolveRef = async (
  repoPath: string,
  ref: string
): Promise<string | null> => {
  try {
    const { exitCode, stdout } = await executeGitCommand(
      ["rev-parse", ref],
      { cwd: repoPath }
    );

    if (exitCode === 0) {
      return stdout.trim();
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * List all available tags in repository
 *
 * @param repoPath - Path to local repository
 * @returns Array of tag names
 */
export const listTags = async (repoPath: string): Promise<string[]> => {
  try {
    const { exitCode, stdout } = await executeGitCommand(["tag"], {
      cwd: repoPath,
    });

    if (exitCode === 0) {
      return stdout
        .split("\n")
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    return [];
  } catch {
    return [];
  }
};

/**
 * List all available branches
 *
 * @param repoPath - Path to local repository
 * @param remote - Include remote branches (default: false)
 * @returns Array of branch names
 */
export const listBranches = async (
  repoPath: string,
  remote: boolean = false
): Promise<string[]> => {
  try {
    const args = ["branch"];
    if (remote) args.push("-r");

    const { exitCode, stdout } = await executeGitCommand(args, {
      cwd: repoPath,
    });

    if (exitCode === 0) {
      return stdout
        .split("\n")
        .map(branch => branch.replace(/^[* ]/,"").trim())
        .filter(branch => branch.length > 0);
    }

    return [];
  } catch {
    return [];
  }
};

/**
 * Validate that a directory is a git repository
 *
 * @param repoPath - Path to check
 * @returns true if valid git repository, false otherwise
 */
export const isGitRepository = async (repoPath: string): Promise<boolean> => {
  try {
    const { exitCode } = await executeGitCommand(
      ["rev-parse", "--git-dir"],
      { cwd: repoPath }
    );

    return exitCode === 0;
  } catch {
    return false;
  }
};

/**
 * Check if a ref exists in repository
 *
 * @param repoPath - Path to local repository
 * @param ref - Ref to check
 * @returns true if ref exists, false otherwise
 */
export const refExists = async (
  repoPath: string,
  ref: string
): Promise<boolean> => {
  try {
    const { exitCode } = await executeGitCommand(
      ["rev-parse", ref],
      { cwd: repoPath }
    );

    return exitCode === 0;
  } catch {
    return false;
  }
};

/**
 * Check if a path exists at a specific ref
 *
 * @param repoPath - Path to local repository
 * @param ref - Ref to check (branch, tag, commit)
 * @param path - Path to check (relative to repo root)
 * @returns true if path exists, false otherwise
 */
export const pathExistsAtRef = async (
  repoPath: string,
  ref: string,
  path: string
): Promise<boolean> => {
  try {
    const { exitCode } = await executeGitCommand(
      ["cat-file", "-e", `${ref}:${path}`],
      { cwd: repoPath }
    );

    return exitCode === 0;
  } catch {
    return false;
  }
};

/**
 * Extract files from a git ref to destination
 *
 * This is useful for extracting subdirectories without full clone.
 *
 * @param repoPath - Path to local repository
 * @param ref - Ref to extract from
 * @param subpath - Specific subdirectory to extract (optional)
 * @param destPath - Destination directory
 * @returns Success result or error
 */
export const extractFiles = async (
  repoPath: string,
  ref: string,
  subpath: string | undefined,
  destPath: string
): Promise<GitOperationResult> => {
  try {
    // Verify ref exists
    if (!(await refExists(repoPath, ref))) {
      return {
        success: false,
        message: `Ref not found: ${ref}`,
      };
    }

    // Create destination directory
    await Bun.file(destPath).mkdir({ recursive: true });

    // Use git archive to extract files
    const archiveArgs = ["archive", ref];

    if (subpath) {
      // Verify subpath exists
      if (!(await pathExistsAtRef(repoPath, ref, subpath))) {
        return {
          success: false,
          message: `Path not found at ${ref}: ${subpath}`,
        };
      }

      archiveArgs.push(subpath);
    }

    const archiveProc = Bun.spawn(["git", ...archiveArgs], {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    });

    // Extract tar archive
    const extractProc = Bun.spawn(["tar", "-x", "-C", destPath], {
      stdin: archiveProc.stdout,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [archiveExit, extractExit] = await Promise.all([
      archiveProc.exited,
      extractProc.exited,
    ]);

    if (archiveExit === 0 && extractExit === 0) {
      return {
        success: true,
        message: `Extracted ${subpath ? `${subpath} from ` : ""}${ref}`,
      };
    }

    return {
      success: false,
      message: `Failed to extract files from ${ref}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Extract operation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Get the current HEAD commit hash
 *
 * @param repoPath - Path to local repository
 * @returns Commit hash or null on error
 */
export const getCurrentCommit = async (
  repoPath: string
): Promise<string | null> => {
  try {
    const { exitCode, stdout } = await executeGitCommand(
      ["rev-parse", "HEAD"],
      { cwd: repoPath }
    );

    if (exitCode === 0) {
      return stdout.trim();
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Classify clone errors and return user-friendly messages
 *
 * @param stderr - stderr output from git command
 * @param url - Repository URL for context
 * @returns GitOperationResult with classified error
 */
function classifyCloneError(
  stderr: string,
  url: string
): GitOperationResult {
  if (stderr.includes("Permission denied")) {
    return {
      success: false,
      message: "SSH permission denied. Check your SSH key and configuration.",
      stderr,
    };
  }

  if (stderr.includes("fatal: could not read Username")) {
    return {
      success: false,
      message: "HTTPS authentication required. Configure git credentials or use SSH.",
      stderr,
    };
  }

  if (stderr.includes("fatal: repository not found")) {
    return {
      success: false,
      message: `Repository not found: ${url}. Check URL and permissions.`,
      stderr,
    };
  }

  if (stderr.includes("Connection refused")) {
    return {
      success: false,
      message: "Connection refused. Check network and git host availability.",
      stderr,
    };
  }

  if (stderr.includes("fatal: the remote end hung up unexpectedly")) {
    return {
      success: false,
      message: "Connection lost during clone. Try again or use shallow clone.",
      stderr,
    };
  }

  if (stderr.includes("Could not resolve host")) {
    return {
      success: false,
      message: "Network error: Could not resolve host. Check your internet connection.",
      stderr,
    };
  }

  return {
    success: false,
    message: "Clone failed. Check the URL and your git configuration.",
    stderr,
  };
}

/**
 * Retry wrapper for git operations
 *
 * @param operation - Operation function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param delayMs - Initial delay between retries
 * @returns Operation result
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        // Wait before retry with exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  throw lastError || new Error("Operation failed");
};
```

---

## Authentication Module

### File: `src/core/git-auth.ts`

This module detects and configures git authentication.

```typescript
/**
 * Git Authentication Module
 *
 * Handles detection and configuration of git credentials:
 * - SSH keys and agent
 * - Credential helpers (osxkeychain, manager-core, cache)
 * - GitHub CLI integration
 * - Token-based auth
 */

import { existsSync } from "node:fs";
import { expandHome } from "./file-utils.js"; // Utility function

export interface AuthMethod {
  type: "ssh" | "https" | "token" | "none";
  available: boolean;
  description: string;
}

export interface AuthDetectionResult {
  available: AuthMethod[];
  preferred: AuthMethod | null;
  recommendation: string;
}

/**
 * Check if SSH agent is available
 *
 * SSH agent allows passwordless authentication if keys are loaded.
 *
 * @returns true if SSH agent available, false otherwise
 */
export const hasSshAgent = (): boolean => {
  return Boolean(process.env.SSH_AUTH_SOCK);
};

/**
 * Check if SSH key exists
 *
 * @param keyPath - Path to SSH key (default: ~/.ssh/id_rsa)
 * @returns true if key exists, false otherwise
 */
export const hasSshKey = async (
  keyPath: string = "~/.ssh/id_rsa"
): Promise<boolean> => {
  try {
    const expandedPath = expandHome(keyPath);
    return existsSync(expandedPath);
  } catch {
    return false;
  }
};

/**
 * Check if GitHub CLI is available and authenticated
 *
 * @returns true if gh is available and authenticated, false otherwise
 */
export const hasGithubCli = async (): Promise<boolean> => {
  try {
    const proc = Bun.spawn(["gh", "auth", "status"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    return (await proc.exited) === 0;
  } catch {
    return false;
  }
};

/**
 * Check if git credential helper is available
 *
 * Looks for osxkeychain, wincred, manager-core, or cache
 *
 * @returns true if any credential helper available, false otherwise
 */
export const hasCredentialHelper = async (): Promise<boolean> => {
  const helpers = ["osxkeychain", "manager-core", "wincred", "cache"];

  for (const helper of helpers) {
    const proc = Bun.spawn(["git", "credential-" + helper], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if ((await proc.exited) !== 127) {
      return true;
    }
  }

  return false;
};

/**
 * Check if GitHub token is available
 *
 * Checks environment variables for GitHub token
 *
 * @returns GitHub token if available, null otherwise
 */
export const getGithubToken = (): string | null => {
  return (
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_PAT ||
    null
  );
};

/**
 * Detect available authentication methods
 *
 * @returns Authentication detection result
 */
export const detectAuthMethods = async (): Promise<AuthDetectionResult> => {
  const available: AuthMethod[] = [];

  // Check SSH
  const sshKey = await hasSshKey();
  const sshAgent = hasSshAgent();

  if (sshKey && sshAgent) {
    available.push({
      type: "ssh",
      available: true,
      description: "SSH with loaded key (recommended)",
    });
  } else if (sshKey) {
    available.push({
      type: "ssh",
      available: true,
      description: "SSH key available (requires agent or passphrase)",
    });
  }

  // Check HTTPS
  const hasHelper = await hasCredentialHelper();
  const hasToken = getGithubToken();

  if (hasToken) {
    available.push({
      type: "token",
      available: true,
      description: "GitHub token available",
    });
  } else if (hasHelper) {
    available.push({
      type: "https",
      available: true,
      description: "HTTPS with credential helper",
    });
  } else {
    available.push({
      type: "https",
      available: true,
      description: "HTTPS (will prompt for credentials)",
    });
  }

  // Check GitHub CLI
  const ghAvailable = await hasGithubCli();
  if (ghAvailable) {
    available.push({
      type: "token",
      available: true,
      description: "GitHub CLI authenticated",
    });
  }

  // Determine preferred method
  let preferred: AuthMethod | null = null;

  if (sshKey && sshAgent) {
    preferred = available[0]; // SSH with agent is preferred
  } else if (hasToken) {
    preferred = available.find(m => m.type === "token") || null;
  } else if (ghAvailable) {
    preferred = available.find(m => m.description.includes("GitHub CLI")) || null;
  } else if (sshKey) {
    preferred = available[0]; // SSH without agent
  }

  // Generate recommendation
  let recommendation = "";

  if (!preferred) {
    recommendation = "No authentication method available. Configure SSH key or GitHub credentials.";
  } else if (preferred.type === "ssh" && !sshAgent) {
    recommendation = "SSH key found but agent not running. Start SSH agent or use HTTPS with token.";
  } else {
    recommendation = `Using ${preferred.description}`;
  }

  return {
    available,
    preferred,
    recommendation,
  };
};

/**
 * Configure git for specific authentication method
 *
 * @param method - Authentication method to use
 * @returns Environment variables to use for git operations
 */
export const configureAuth = (method: AuthMethod): Record<string, string> => {
  const env: Record<string, string> = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0", // Disable interactive prompts
  };

  if (method.type === "ssh") {
    // SSH configuration
    if (process.env.SSH_AUTH_SOCK) {
      env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
    }

    // Disable strict host key checking for new hosts (optional, less secure)
    // env.GIT_SSH_COMMAND = "ssh -o StrictHostKeyChecking=no";
  } else if (method.type === "token") {
    // Token-based auth
    const token = getGithubToken();
    if (token) {
      // Use token for HTTPS authentication
      env.GIT_CREDENTIALS = `https://x-access-token:${token}@github.com`;
    }
  }

  return env;
};

/**
 * Suggest best authentication method for given URL
 *
 * @param url - Git URL
 * @param detectionResult - Result from detectAuthMethods()
 * @returns Recommended authentication method
 */
export const suggestAuthMethod = (
  url: string,
  detectionResult: AuthDetectionResult
): AuthMethod | null => {
  // SSH URLs prefer SSH auth
  if (url.includes("@")) {
    return (
      detectionResult.available.find(m => m.type === "ssh") || null
    );
  }

  // HTTPS URLs can use token or credential helper
  if (url.startsWith("https://")) {
    return (
      detectionResult.available.find(m => m.type === "token") ||
      detectionResult.available.find(m => m.type === "https") ||
      null
    );
  }

  // Default to preferred method
  return detectionResult.preferred;
};
```

---

## Caching Module

### File: `src/core/git-cache.ts`

This module implements the caching system for git repositories.

```typescript
/**
 * Git Caching Module
 *
 * Implements caching for cloned repositories:
 * - Cache storage in ~/.cache/kustomark/git/
 * - Metadata tracking for cache validation
 * - Automatic expiration and cleanup
 * - Cache hit/miss reporting
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ParsedGitUrl } from "./types.js";
import { expandHome } from "./file-utils.js"; // Utility function
import { executeGitCommand, refExists, getCurrentCommit } from "./git-operations.js";

export interface CacheMetadata {
  version: "1";
  url: string;
  protocol: "https" | "ssh";
  host: string;
  org: string;
  repo: string;
  path?: string;
  ref: string; // Branch, tag, or commit hash requested
  resolvedRef?: string; // Actual commit hash after resolution
  lastFetched: number; // Timestamp
  lastAccessed: number; // Timestamp
  expiresAt: number; // Cache expiration timestamp
  integrity?: string; // SHA256 hash of content
}

export interface CacheInfo {
  cached: boolean;
  cachePath: string | null;
  metadata: CacheMetadata | null;
  expired: boolean;
}

const CACHE_BASE_DIR = join(expandHome("~"), ".cache", "kustomark");
const GIT_CACHE_DIR = join(CACHE_BASE_DIR, "git");
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Get cache directory path for a repository
 *
 * @param host - Git host (e.g., github.com)
 * @param org - Organization/user
 * @param repo - Repository name
 * @returns Full cache directory path
 */
export const getCachePath = (
  host: string,
  org: string,
  repo: string
): string => {
  return join(GIT_CACHE_DIR, host, org, repo);
};

/**
 * Get cache directory path from ParsedGitUrl
 *
 * @param parsed - Parsed git URL
 * @returns Full cache directory path
 */
export const getCachePathFromParsed = (parsed: ParsedGitUrl): string => {
  return getCachePath(parsed.host, parsed.org, parsed.repo);
};

/**
 * Load cache metadata
 *
 * @param cachePath - Cache directory path
 * @returns Metadata object or null if not found
 */
const loadMetadata = (cachePath: string): CacheMetadata | null => {
  const metadataPath = join(cachePath, "metadata.json");

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, "utf-8");
    return JSON.parse(content) as CacheMetadata;
  } catch {
    return null;
  }
};

/**
 * Save cache metadata
 *
 * @param cachePath - Cache directory path
 * @param metadata - Metadata to save
 */
const saveMetadata = (cachePath: string, metadata: CacheMetadata): void => {
  mkdirSync(cachePath, { recursive: true });
  const metadataPath = join(cachePath, "metadata.json");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
};

/**
 * Check if cache is valid (exists and not expired)
 *
 * @param cachePath - Cache directory path
 * @param maxAgeMs - Maximum cache age in milliseconds (default: 30 days)
 * @returns true if cache exists and is valid, false otherwise
 */
export const isCacheValid = (
  cachePath: string,
  maxAgeMs: number = CACHE_EXPIRY_MS
): boolean => {
  if (!existsSync(cachePath)) {
    return false;
  }

  const metadata = loadMetadata(cachePath);

  if (!metadata) {
    return false;
  }

  // Check expiration
  if (Date.now() > metadata.expiresAt) {
    return false;
  }

  // Check that git directory exists
  const gitDir = join(cachePath, ".git");
  return existsSync(gitDir);
};

/**
 * Get cache info for a repository
 *
 * @param parsed - Parsed git URL
 * @returns Cache information
 */
export const getCacheInfo = (parsed: ParsedGitUrl): CacheInfo => {
  const cachePath = getCachePathFromParsed(parsed);
  const metadata = loadMetadata(cachePath);
  const valid = isCacheValid(cachePath);
  const expired = metadata ? Date.now() > metadata.expiresAt : false;

  return {
    cached: valid && !expired,
    cachePath: existsSync(cachePath) ? cachePath : null,
    metadata,
    expired,
  };
};

/**
 * Initialize cache for a repository
 *
 * Creates bare git repository clone in cache directory.
 *
 * @param url - Full git URL
 * @param parsed - Parsed git URL
 * @returns Success result or error
 */
export const initializeCache = async (
  url: string,
  parsed: ParsedGitUrl
): Promise<{ success: boolean; message: string }> => {
  try {
    const cachePath = getCachePathFromParsed(parsed);

    // Create cache directory
    mkdirSync(cachePath, { recursive: true });

    // Clone as bare repository
    const { exitCode, stderr } = await executeGitCommand(
      ["clone", "--bare", url, ".git"],
      { cwd: cachePath }
    );

    if (exitCode !== 0) {
      return {
        success: false,
        message: `Failed to initialize cache: ${stderr}`,
      };
    }

    // Create metadata
    const metadata: CacheMetadata = {
      version: "1",
      url,
      protocol: parsed.protocol,
      host: parsed.host,
      org: parsed.org,
      repo: parsed.repo,
      path: parsed.path,
      ref: parsed.ref,
      lastFetched: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + CACHE_EXPIRY_MS,
    };

    saveMetadata(cachePath, metadata);

    return {
      success: true,
      message: `Cache initialized for ${url}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Cache initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Update cache (fetch latest)
 *
 * Fetches updates from remote while keeping bare repository.
 *
 * @param cachePath - Cache directory path
 * @returns Success result or error
 */
export const updateCache = async (
  cachePath: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const { exitCode, stderr } = await executeGitCommand(
      ["fetch", "origin", "+refs/heads/*:refs/heads/*", "+refs/tags/*:refs/tags/*"],
      { cwd: cachePath, timeout: 120000 } // Longer timeout for updates
    );

    if (exitCode !== 0) {
      return {
        success: false,
        message: `Fetch failed: ${stderr}`,
      };
    }

    // Update metadata
    const metadata = loadMetadata(cachePath);

    if (metadata) {
      metadata.lastFetched = Date.now();
      metadata.lastAccessed = Date.now();
      saveMetadata(cachePath, metadata);
    }

    return {
      success: true,
      message: "Cache updated",
    };
  } catch (error) {
    return {
      success: false,
      message: `Update failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Resolve ref in cache to commit hash
 *
 * @param cachePath - Cache directory path
 * @param ref - Ref to resolve
 * @returns Commit hash or null if not found
 */
export const resolveRefInCache = async (
  cachePath: string,
  ref: string
): Promise<string | null> => {
  if (!(await refExists(cachePath, ref))) {
    return null;
  }

  return getCurrentCommit(cachePath);
};

/**
 * Extract files from cache to working directory
 *
 * @param cachePath - Cache directory path
 * @param ref - Ref to extract from
 * @param destPath - Destination directory
 * @param subpath - Optional subdirectory to extract
 * @returns Success result or error
 */
export const extractFromCache = async (
  cachePath: string,
  ref: string,
  destPath: string,
  subpath?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Ensure destination directory exists
    mkdirSync(destPath, { recursive: true });

    // Build git archive command
    const archiveArgs = ["archive", ref];

    if (subpath) {
      archiveArgs.push(subpath);
    }

    // Use git archive from cache to extract files
    const archiveProc = Bun.spawn(["git", ...archiveArgs], {
      cwd: cachePath,
      stdout: "pipe",
      stderr: "pipe",
    });

    // Extract tar to destination
    const extractProc = Bun.spawn(["tar", "-x", "-C", destPath], {
      stdin: archiveProc.stdout,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [archiveExit, extractExit] = await Promise.all([
      archiveProc.exited,
      extractProc.exited,
    ]);

    if (archiveExit === 0 && extractExit === 0) {
      // Update last accessed time
      const metadata = loadMetadata(cachePath);
      if (metadata) {
        metadata.lastAccessed = Date.now();
        saveMetadata(cachePath, metadata);
      }

      return {
        success: true,
        message: `Extracted ${subpath || "entire repository"}`,
      };
    }

    return {
      success: false,
      message: "Extraction failed",
    };
  } catch (error) {
    return {
      success: false,
      message: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Get or create cache for repository
 *
 * If cache exists and is valid, returns cache path.
 * If cache is invalid or doesn't exist, creates new cache.
 *
 * @param url - Full git URL
 * @param parsed - Parsed git URL
 * @param options - Cache options
 * @returns Cache path or error
 */
export const getOrCreateCache = async (
  url: string,
  parsed: ParsedGitUrl,
  options: { forceUpdate?: boolean } = {}
): Promise<{ success: boolean; path?: string; message: string }> => {
  try {
    const cachePath = getCachePathFromParsed(parsed);
    const valid = isCacheValid(cachePath);

    if (valid) {
      if (options.forceUpdate) {
        const updateResult = await updateCache(cachePath);
        if (!updateResult.success) {
          return updateResult;
        }
      }

      return {
        success: true,
        path: cachePath,
        message: "Cache hit",
      };
    }

    // Create new cache
    if (existsSync(cachePath)) {
      // Remove invalid cache
      rmSync(cachePath, { recursive: true });
    }

    const initResult = await initializeCache(url, parsed);

    if (initResult.success) {
      return {
        success: true,
        path: cachePath,
        message: "Cache initialized",
      };
    }

    return initResult;
  } catch (error) {
    return {
      success: false,
      message: `Cache operation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Clean expired caches
 *
 * Removes caches that have exceeded expiration time.
 *
 * @returns Number of caches cleaned
 */
export const cleanExpiredCaches = async (): Promise<number> => {
  let cleaned = 0;

  if (!existsSync(GIT_CACHE_DIR)) {
    return 0;
  }

  const walkAndClean = (dir: string) => {
    if (!existsSync(dir)) {
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === ".git") {
          // This is a cache directory, check metadata
          const metadataPath = join(dirname(path), "metadata.json");

          if (existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(
                readFileSync(metadataPath, "utf-8")
              ) as CacheMetadata;

              if (Date.now() > metadata.expiresAt) {
                rmSync(dirname(path), { recursive: true });
                cleaned++;
              }
            } catch {
              // Invalid metadata, clean it
              rmSync(dirname(path), { recursive: true });
              cleaned++;
            }
          }
        } else {
          walkAndClean(path);
        }
      }
    }
  };

  walkAndClean(GIT_CACHE_DIR);

  return cleaned;
};

/**
 * Get cache statistics
 *
 * @returns Cache statistics
 */
export const getCacheStats = (): {
  totalCaches: number;
  totalSize: number;
  oldestCache: number | null;
  newestCache: number | null;
} => {
  let totalCaches = 0;
  let totalSize = 0;
  let oldestCache: number | null = null;
  let newestCache: number | null = null;

  if (!existsSync(GIT_CACHE_DIR)) {
    return { totalCaches, totalSize, oldestCache, newestCache };
  }

  const walkAndSize = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === ".git") {
          // Found a cache directory
          totalCaches++;

          const metadataPath = join(dirname(path), "metadata.json");
          if (existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(
                readFileSync(metadataPath, "utf-8")
              ) as CacheMetadata;

              if (!oldestCache || metadata.lastFetched < oldestCache) {
                oldestCache = metadata.lastFetched;
              }

              if (!newestCache || metadata.lastFetched > newestCache) {
                newestCache = metadata.lastFetched;
              }
            } catch {
              // Skip invalid metadata
            }
          }
        } else {
          walkAndSize(path);
        }
      } else {
        // Size calculation (approximate)
        totalSize += 1024; // Rough estimate per file
      }
    }
  };

  walkAndSize(GIT_CACHE_DIR);

  return { totalCaches, totalSize, oldestCache, newestCache };
};
```

---

## Integration Points

### Update: `src/core/resource-resolver.ts` (Lines 119-140)

Replace the TODO comment with actual git resolution:

```typescript
// In the positivePatterns loop, replace the git URL handling:

// Check if pattern is a git URL
if (isGitUrl(pattern)) {
  const parsedGit = parseGitUrl(pattern);
  if (!parsedGit) {
    throw new ResourceResolutionError(
      `Malformed git URL: ${pattern}. Please check the URL format.`,
      pattern,
    );
  }

  // Implement git URL fetching
  try {
    // Get or create cache for repository
    const cacheResult = await getOrCreateCache(parsedGit.fullUrl, parsedGit);

    if (!cacheResult.success || !cacheResult.path) {
      throw new ResourceResolutionError(
        `Failed to fetch git repository: ${cacheResult.message}`,
        pattern,
      );
    }

    // Extract files from cache
    const extractResult = await extractFromCache(
      cacheResult.path,
      parsedGit.ref,
      join(normalizedBaseDir, `.git-fetch-${Date.now()}`),
      parsedGit.path
    );

    if (!extractResult.success) {
      throw new ResourceResolutionError(
        `Failed to extract from git repository: ${extractResult.message}`,
        pattern,
      );
    }

    // Add resolved markdown files to resolvedResources
    // ... (scan extracted directory for .md files)

  } catch (error) {
    throw new ResourceResolutionError(
      `Git URL resolution failed: ${error instanceof Error ? error.message : String(error)}`,
      pattern,
      error instanceof Error ? error : undefined,
    );
  }
}
```

### Update: `src/cli/index.ts`

Add fetch command:

```typescript
// Add to CLIOptions interface:
interface CLIOptions {
  // ... existing fields
  noCache?: boolean;
  forceUpdate?: boolean;
}

// Add to parseArgs function:
} else if (arg === "--no-cache") {
  options.noCache = true;
} else if (arg === "--force-update") {
  options.forceUpdate = true;
}

// Add new command:
async function fetchCommand(path: string, options: CLIOptions): Promise<number> {
  try {
    const inputPath = resolve(path);
    let configPath = inputPath;

    if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
      configPath = join(inputPath, "kustomark.yaml");
    }

    const basePath = dirname(configPath);
    log(`Loading config from ${configPath}...`, 2, options);
    const config = readKustomarkConfig(inputPath);

    // Validate config
    const validation = validateConfig(config, { requireOutput: false });
    if (!validation.valid) {
      console.error("Error: Invalid configuration");
      return 1;
    }

    // Identify git resources
    const gitResources = config.resources
      .filter(isGitUrl)
      .map(url => parseGitUrl(url));

    if (gitResources.length === 0) {
      if (options.verbosity > 0) {
        console.log("No git resources found");
      }
      return 0;
    }

    let fetched = 0;
    for (const resource of gitResources) {
      if (!resource) continue;

      // Fetch or update cache
      const cacheResult = await getOrCreateCache(resource.fullUrl, resource, {
        forceUpdate: options.forceUpdate,
      });

      if (cacheResult.success) {
        fetched++;
        log(`Fetched: ${resource.fullUrl}`, 2, options);
      } else {
        console.error(`Failed to fetch: ${resource.fullUrl}`);
      }
    }

    if (options.verbosity > 0) {
      console.log(`Fetched ${fetched} resource(s)`);
    }

    return 0;
  } catch (error) {
    console.error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

// Update main() switch statement:
case "fetch":
  return await fetchCommand(path, options);
```

---

## CLI Commands

Add to help text:

```bash
kustomark fetch [path]      Fetch/cache remote resources
kustomark cache clean       Clean expired caches
kustomark cache list        List cached repositories
```

---

## Testing Strategy

### Test Structure

```typescript
// tests/git-operations.test.ts
describe("git operations", () => {
  it("should clone a small repository", async () => {
    const result = await cloneRepository(
      "https://github.com/octocat/Hello-World.git",
      "./test-repo"
    );

    assert(result.success);
    assert(existsSync("./test-repo/.git"));
  });

  it("should handle authentication failures", async () => {
    const result = await cloneRepository(
      "https://github.com/private/repo.git",
      "./test-repo"
    );

    assert(!result.success);
    assert(result.message.includes("authentication"));
  });

  // ... more tests
});
```

### Test Utilities

```typescript
// tests/fixtures/git-fixtures.ts
export const TEST_REPOS = {
  valid: "https://github.com/octocat/Hello-World.git",
  small: "https://github.com/torvalds/linux.git",
  nonexistent: "https://github.com/nonexistent/repo.git",
  invalid: "not-a-git-url",
};

export const cleanupTestRepo = (path: string) => {
  if (existsSync(path)) {
    rmSync(path, { recursive: true });
  }
};
```

---

## Summary

These implementations provide:

1. **Robust git operations** with proper error handling
2. **Flexible authentication** supporting SSH, HTTPS, and tokens
3. **Intelligent caching** for performance and offline usage
4. **Seamless integration** with existing Kustomark architecture
5. **Type-safe** implementation using TypeScript
6. **Comprehensive testing** patterns

The modular design allows implementing features incrementally while maintaining code quality and compatibility with the existing system.

