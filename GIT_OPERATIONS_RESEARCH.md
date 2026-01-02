# Git Operations in Bun/TypeScript - Research Guide

This document provides comprehensive guidance on implementing git operations in Bun/TypeScript, including best practices, patterns, and recommendations specific to the Kustomark project.

## Table of Contents

1. [Running Git Commands](#running-git-commands)
2. [Best Practices for Shell Commands in Bun](#best-practices-for-shell-commands-in-bun)
3. [Detecting and Using System Git Credentials](#detecting-and-using-system-git-credentials)
4. [Repository Caching Strategy](#repository-caching-strategy)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Kustomark-Specific Recommendations](#kustomark-specific-recommendations)

---

## Running Git Commands

### 1.1 Using `Bun.shell()` (Recommended)

Bun provides a modern, promise-based API for executing shell commands via `Bun.shell()`. This is the recommended approach for most use cases.

#### Basic Syntax

```typescript
import { shell } from "bun";

// Simple command
const result = await Bun.shell`git status`.text();

// With interpolation
const branch = "main";
const output = await Bun.shell`git checkout ${branch}`.text();

// Error handling
const process = await Bun.shell`git clone <url>`;
if (process.exitCode !== 0) {
  console.error("Clone failed");
}
```

#### Output Formats

```typescript
// Get output as string
const text = await Bun.shell`git log --oneline`.text();

// Get output as bytes
const bytes = await Bun.shell`git show --binary`.bytes();

// Parse JSON output (if available)
const json = await Bun.shell`git config --list --format=json`.json();

// Stream output (for large operations)
const stream = await Bun.shell`git log`.stream();
for await (const chunk of stream) {
  // Process chunk by chunk
}
```

#### Git Command Examples for Kustomark

```typescript
// Clone a repository
const clone = async (url: string, dest: string) => {
  const process = await Bun.shell`git clone ${url} ${dest}`;
  return process.exitCode === 0;
};

// Fetch updates
const fetch = async (repoPath: string) => {
  const process = await Bun.shell`cd ${repoPath} && git fetch origin`;
  return process.exitCode === 0;
};

// Checkout specific ref (branch, tag, commit)
const checkout = async (repoPath: string, ref: string) => {
  const process = await Bun.shell`cd ${repoPath} && git checkout ${ref}`;
  return process.exitCode === 0;
};

// Sparse checkout (for subdirectories)
const sparseCheckout = async (repoPath: string, path: string) => {
  // Git 2.25.0+ sparse checkout
  const commands = [
    `cd ${repoPath}`,
    `git sparse-checkout set ${path}`,
  ];
  const process = await Bun.shell`${commands.join(" && ")}`;
  return process.exitCode === 0;
};

// Get current commit hash
const getCurrentCommit = async (repoPath: string): Promise<string> => {
  const hash = await Bun.shell`cd ${repoPath} && git rev-parse HEAD`.text();
  return hash.trim();
};

// List remote branches
const listRemoteBranches = async (repoPath: string): Promise<string[]> => {
  const output = await Bun.shell`cd ${repoPath} && git branch -r`.text();
  return output
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("HEAD"));
};

// List tags
const listTags = async (repoPath: string): Promise<string[]> => {
  const output = await Bun.shell`cd ${repoPath} && git tag`.text();
  return output
    .split("\n")
    .map(line => line.trim())
    .filter(line => line);
};
```

### 1.2 Using `Bun.spawn()` for Advanced Control

For more granular control over input/output streams, use `Bun.spawn()`.

```typescript
// Low-level process spawning
const proc = Bun.spawn(["git", "clone", url, dest], {
  stdout: "pipe",
  stderr: "pipe",
  stdin: "inherit",
});

// Read output
const stdout = await Bun.readableStreamToText(proc.stdout);
const stderr = await Bun.readableStreamToText(proc.stderr);
const exitCode = await proc.exited;

// With timeout
const proc2 = Bun.spawn(["git", "fetch", "origin"], {
  timeout: 30000, // 30 seconds
  killSignal: "SIGTERM",
});

// With environment variables
const proc3 = Bun.spawn(["git", "clone", url], {
  env: {
    ...process.env,
    GIT_ASKPASS: "/path/to/credential-helper",
    GIT_TERMINAL_PROMPT: "0", // Disable interactive prompts
  },
});
```

### 1.3 Synchronous Alternative

For simpler operations, `Bun.spawnSync()` is available but less recommended for I/O operations:

```typescript
const result = Bun.spawnSync(["git", "status"]);
if (result.success) {
  console.log(result.stdout.toString());
}
```

**Performance Note:** Bun's `spawnSync` is ~60% faster than Node.js, but async is still preferred for non-blocking operations.

---

## Best Practices for Shell Commands in Bun

### 2.1 Error Handling

```typescript
// Always check exit codes
const runGit = async (command: string): Promise<{ success: boolean; output: string }> => {
  const process = await Bun.shell`${command}`;

  if (process.exitCode !== 0) {
    throw new Error(`Git command failed: ${command}`);
  }

  return {
    success: true,
    output: await process.text(),
  };
};

// Capture stderr separately
const runWithStderr = async (command: string) => {
  const process = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await Bun.readableStreamToText(process.stdout);
  const stderr = await Bun.readableStreamToText(process.stderr);
  const exitCode = await process.exited;

  return { exitCode, stdout, stderr };
};
```

### 2.2 Argument Escaping and Safety

```typescript
// Use Bun.shell template literals for automatic escaping
const url = "https://github.com/user/repo.git";
const dest = "./my repo"; // Space in path - safely handled

// SAFE: Template literal handles escaping
await Bun.shell`git clone ${url} ${dest}`;

// AVOID: String concatenation (security risk)
// await Bun.shell(`git clone ${url} ${dest}`) // Bad for spaces/special chars

// For complex cases with Bun.spawn, use array format (preferred)
Bun.spawn(["git", "clone", url, dest], { /* options */ });
```

### 2.3 Working Directory Context

```typescript
// Method 1: cd in shell command (simple)
const result = await Bun.shell`cd ${repoPath} && git status`.text();

// Method 2: Use cwd in spawn (cleaner for multiple operations)
const proc = Bun.spawn(["git", "status"], {
  cwd: repoPath,
});

// Recommended pattern for Kustomark: Create operation wrapper
interface GitOperationOptions {
  cwd: string;
  timeout?: number;
}

const executeGitCommand = async (
  args: string[],
  options: GitOperationOptions
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    timeout: options.timeout ?? 30000,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    Bun.readableStreamToText(proc.stdout),
    Bun.readableStreamToText(proc.stderr),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
};

// Usage
const result = await executeGitCommand(["clone", url, "dest"], {
  cwd: tempDir,
  timeout: 60000,
});
```

### 2.4 Timeout Handling

```typescript
// Set timeouts for long operations
const cloneWithTimeout = async (
  url: string,
  dest: string,
  timeoutMs: number = 60000
): Promise<boolean> => {
  const proc = Bun.spawn(["git", "clone", url, dest], {
    timeout: timeoutMs,
    killSignal: "SIGTERM",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
};

// Manual timeout control (for more granular control)
const cloneWithManualTimeout = async (
  url: string,
  dest: string
): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const proc = Bun.spawn(["git", "clone", url, dest], {
      signal: controller.signal,
    });

    await proc.exited;
  } finally {
    clearTimeout(timeoutId);
  }
};
```

### 2.5 Environment Variables and Authentication

```typescript
// Disable interactive prompts
const gitOptions = {
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0", // Disable interactive prompts
  },
};

// Use SSH_AUTH_SOCK for SSH agent
const sshOptions = {
  env: {
    ...process.env,
    SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "",
  },
};

// Use GitHub token for HTTPS auth
const tokenOptions = {
  env: {
    ...process.env,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  },
};

// Override git config for specific operation
const configOptions = {
  env: {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/tmp/git-config",
  },
};
```

### 2.6 Stream Processing for Large Operations

```typescript
// For large git operations, use streaming
const streamGitOutput = async (command: string) => {
  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
  });

  for await (const chunk of proc.stdout) {
    // Process each chunk (e.g., update progress, memory-efficient)
    process.stdout.write(chunk);
  }

  return proc.exited;
};

// Example: Clone with progress reporting
const cloneWithProgress = async (url: string, dest: string) => {
  const proc = Bun.spawn(["git", "clone", "--progress", url, dest], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Stream stderr (git progress goes to stderr)
  for await (const chunk of proc.stderr) {
    // Parse progress and report (e.g., "Receiving objects: 50%")
    process.stderr.write(chunk);
  }

  await proc.exited;
};
```

---

## Detecting and Using System Git Credentials

### 3.1 Detecting Available Credential Methods

```typescript
// Check if SSH key is available
const hasSshKey = async (keyPath: string = "~/.ssh/id_rsa"): Promise<boolean> => {
  const expandedPath = keyPath.startsWith("~")
    ? keyPath.replace("~", Bun.env.HOME || "")
    : keyPath;

  try {
    await Bun.file(expandedPath).exists();
    return true;
  } catch {
    return false;
  }
};

// Check SSH agent availability
const hasSshAgent = (): boolean => {
  return Boolean(process.env.SSH_AUTH_SOCK);
};

// Check GitHub CLI authentication
const hasGithubCli = async (): Promise<boolean> => {
  const proc = Bun.spawn(["gh", "auth", "status"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
};

// Check for git credentials
const hasGitCredentials = async (): Promise<boolean> => {
  const proc = Bun.spawn(["git", "credential-osxkeychain"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) !== 127; // File not found error
};
```

### 3.2 Using System Credentials for Git Operations

```typescript
// Automatic credential detection and usage
const cloneWithCredentials = async (
  url: string,
  dest: string
): Promise<boolean> => {
  // Use system git configuration and credentials
  const proc = Bun.spawn(["git", "clone", url, dest], {
    env: {
      ...process.env,
      // These instruct git to use system credential helpers
      GIT_TERMINAL_PROMPT: "0", // No interactive prompts
      GIT_SSH_COMMAND: "ssh -o StrictHostKeyChecking=no", // Optional: less strict
    },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60000,
  });

  return (await proc.exited) === 0;
};

// SSH-specific operations
const fetchWithSsh = async (repoPath: string): Promise<boolean> => {
  const proc = Bun.spawn(["git", "fetch", "origin"], {
    cwd: repoPath,
    env: {
      ...process.env,
      SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "",
      GIT_TERMINAL_PROMPT: "0",
    },
  });

  return (await proc.exited) === 0;
};

// GitHub CLI integration (if available)
const cloneWithGithubCli = async (
  org: string,
  repo: string,
  dest: string
): Promise<boolean> => {
  // GitHub CLI handles auth automatically
  const url = `https://github.com/${org}/${repo}.git`;
  return cloneWithCredentials(url, dest);
};

// Credential helper setup
const setupCredentialHelper = async (helper: string): Promise<boolean> => {
  // Set default credential helper (osxkeychain, manager-core, cache, etc.)
  const proc = Bun.spawn(["git", "config", "--global", "credential.helper", helper]);

  return (await proc.exited) === 0;
};
```

### 3.3 Handling Authentication Failures

```typescript
// Retry logic for authentication failures
const cloneWithRetry = async (
  url: string,
  dest: string,
  maxRetries: number = 3
): Promise<{ success: boolean; attempt: number }> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const proc = Bun.spawn(["git", "clone", url, dest], {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    });

    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return { success: true, attempt };
    }

    if (attempt < maxRetries) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return { success: false, attempt: maxRetries };
};

// Check for specific authentication errors
const parseGitError = (stderr: string): string | null => {
  if (stderr.includes("Permission denied")) {
    return "SSH_KEY_PERMISSION_DENIED";
  }
  if (stderr.includes("fatal: could not read Username")) {
    return "HTTPS_AUTH_REQUIRED";
  }
  if (stderr.includes("fatal: Authentication failed")) {
    return "AUTHENTICATION_FAILED";
  }
  if (stderr.includes("Connection refused")) {
    return "CONNECTION_REFUSED";
  }
  return null;
};
```

---

## Repository Caching Strategy

### 4.1 Cache Directory Structure

```
~/.cache/kustomark/
├── git/
│   ├── github.com/
│   │   ├── org/
│   │   │   └── repo/
│   │   │       ├── .git/
│   │   │       └── metadata.json  # Cache metadata
│   │   └── ...
│   └── ...
├── http/
│   └── (tar.gz, zip archives)
└── metadata.json  # Global cache index
```

### 4.2 Cache Metadata Format

```typescript
interface CacheMetadata {
  version: "1";
  url: string;
  type: "git" | "http";
  protocol: "https" | "ssh" | "http";
  host: string;
  org: string;
  repo: string;
  path?: string;
  ref: string; // branch, tag, or commit hash
  resolvedRef?: string; // resolved commit hash
  lastFetched: number; // timestamp
  lastAccessed: number; // timestamp
  expiresAt: number; // cache expiration timestamp
  integrity?: string; // SHA256 hash of content
}

interface GlobalCacheIndex {
  version: "1";
  caches: CacheMetadata[];
  totalSize: number; // bytes
  lastCompacted: number; // timestamp
}
```

### 4.3 Cache Operations

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const CACHE_DIR = join(Bun.env.HOME || "~", ".cache", "kustomark");
const GIT_CACHE_DIR = join(CACHE_DIR, "git");
const CACHE_EXPIRY_DAYS = 30;

// Get cache path for a repository
const getCachePath = (
  org: string,
  repo: string,
  host: string = "github.com"
): string => {
  return join(GIT_CACHE_DIR, host, org, repo);
};

// Check if cache exists and is valid
const isCacheValid = (cachePath: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): boolean => {
  const metadataPath = join(cachePath, "metadata.json");

  if (!existsSync(metadataPath)) {
    return false;
  }

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8")) as CacheMetadata;
    const ageMs = Date.now() - metadata.lastFetched;

    return ageMs < maxAgeMs;
  } catch {
    return false;
  }
};

// Initialize cache for a repository
const initializeCache = async (
  url: string,
  parsedGit: ParsedGitUrl,
  cachePath: string
): Promise<void> => {
  // Create cache directory
  mkdirSync(cachePath, { recursive: true });

  // Initialize bare git repository
  const proc = Bun.spawn(["git", "clone", "--bare", url, ".git"], {
    cwd: cachePath,
  });

  if ((await proc.exited) !== 0) {
    throw new Error(`Failed to initialize git cache for ${url}`);
  }

  // Write metadata
  const metadata: CacheMetadata = {
    version: "1",
    url,
    type: "git",
    protocol: parsedGit.protocol,
    host: parsedGit.host,
    org: parsedGit.org,
    repo: parsedGit.repo,
    path: parsedGit.path,
    ref: parsedGit.ref,
    lastFetched: Date.now(),
    lastAccessed: Date.now(),
    expiresAt: Date.now() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  writeFileSync(
    join(cachePath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
};

// Update cache (fetch latest)
const updateCache = async (cachePath: string): Promise<void> => {
  const proc = Bun.spawn(["git", "fetch", "origin"], {
    cwd: cachePath,
    timeout: 60000,
  });

  if ((await proc.exited) !== 0) {
    throw new Error("Failed to fetch updates for cached repository");
  }

  // Update metadata
  const metadataPath = join(cachePath, "metadata.json");
  const metadata = JSON.parse(readFileSync(metadataPath, "utf-8")) as CacheMetadata;
  metadata.lastFetched = Date.now();

  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
};

// Get resolved commit hash for a ref
const resolveRef = async (
  cachePath: string,
  ref: string
): Promise<string | null> => {
  const proc = Bun.spawn(["git", "rev-parse", ref], {
    cwd: cachePath,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await Bun.readableStreamToText(proc.stdout);

  if ((await proc.exited) === 0) {
    return stdout.trim();
  }

  return null;
};

// Extract subset from cache
const extractFromCache = async (
  cachePath: string,
  ref: string,
  subpath: string | undefined,
  outputPath: string
): Promise<void> => {
  // Resolve ref to commit hash
  const commit = await resolveRef(cachePath, ref);
  if (!commit) {
    throw new Error(`Could not resolve ref "${ref}"`);
  }

  // Create output directory
  mkdirSync(outputPath, { recursive: true });

  // Extract specific subdirectory
  if (subpath) {
    const proc = Bun.spawn(
      ["git", "archive", commit, subpath, "-o", "-"],
      {
        cwd: cachePath,
        stdout: "pipe",
      }
    );

    // Extract tar archive
    const extractProc = Bun.spawn(["tar", "-x"], {
      stdin: proc.stdout,
      cwd: outputPath,
    });

    await extractProc.exited;
  } else {
    // Extract entire repository
    const proc = Bun.spawn(["git", "archive", commit, "-o", "-"], {
      cwd: cachePath,
      stdout: "pipe",
    });

    const extractProc = Bun.spawn(["tar", "-x"], {
      stdin: proc.stdout,
      cwd: outputPath,
    });

    await extractProc.exited;
  }
};

// Get or create cache for repository
const getOrCreateCache = async (
  url: string,
  parsedGit: ParsedGitUrl,
  forceUpdate: boolean = false
): Promise<string> => {
  const cachePath = getCachePath(parsedGit.org, parsedGit.repo, parsedGit.host);

  if (existsSync(cachePath) && isCacheValid(cachePath)) {
    if (forceUpdate) {
      await updateCache(cachePath);
    }
    return cachePath;
  }

  // Create new cache
  await initializeCache(url, parsedGit, cachePath);

  return cachePath;
};

// Clean expired caches
const cleanExpiredCaches = async (): Promise<number> => {
  let cleaned = 0;

  const walkDir = (dir: string) => {
    if (!existsSync(dir)) return;

    const entries = Bun.file(dir).readdir ? await Bun.file(dir).readdir() : [];

    for (const entry of entries) {
      const path = join(dir, entry.name);
      const stat = Bun.file(path);

      if (stat.isDirectory()) {
        walkDir(path);
      } else if (entry.name === "metadata.json") {
        try {
          const metadata = JSON.parse(readFileSync(path, "utf-8")) as CacheMetadata;

          if (Date.now() > metadata.expiresAt) {
            rmSync(dirname(path), { recursive: true });
            cleaned++;
          }
        } catch {
          // Skip invalid metadata files
        }
      }
    }
  };

  await walkDir(GIT_CACHE_DIR);

  return cleaned;
};
```

### 4.4 Cache Usage in Resource Resolution

```typescript
// Integration with resource resolver
const resolveGitResource = async (
  parsedGit: ParsedGitUrl,
  options: { useCache: boolean; forceUpdate: boolean } = {}
): Promise<{ path: string; ref: string; resolvedRef: string }> => {
  if (options.useCache) {
    const cachePath = await getOrCreateCache(
      parsedGit.fullUrl,
      parsedGit,
      options.forceUpdate
    );

    const resolvedRef = await resolveRef(cachePath, parsedGit.ref);

    return {
      path: cachePath,
      ref: parsedGit.ref,
      resolvedRef: resolvedRef || parsedGit.ref,
    };
  } else {
    // Shallow clone without caching (for one-off operations)
    const tempPath = `/tmp/kustomark-${Date.now()}`;

    const proc = Bun.spawn(
      ["git", "clone", "--depth", "1", "--branch", parsedGit.ref, parsedGit.fullUrl, tempPath],
      { timeout: 60000 }
    );

    if ((await proc.exited) === 0) {
      return {
        path: tempPath,
        ref: parsedGit.ref,
        resolvedRef: parsedGit.ref,
      };
    }

    throw new Error(`Failed to clone ${parsedGit.fullUrl}`);
  }
};
```

---

## Error Handling Patterns

### 5.1 Comprehensive Error Handling

```typescript
// Custom error types
class GitOperationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stderr: string = "",
    public readonly stdout: string = ""
  ) {
    super(message);
    this.name = "GitOperationError";
  }
}

// Wrapper with comprehensive error handling
const executeGitOperation = async (
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
  } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    timeout: options.timeout ?? 30000,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    Bun.readableStreamToText(proc.stdout),
    Bun.readableStreamToText(proc.stderr),
  ]);

  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
};

// High-level operation with error classification
const cloneRepositoryWithErrorHandling = async (
  url: string,
  dest: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const { exitCode, stderr } = await executeGitOperation(
      ["clone", url, dest],
      { timeout: 60000 }
    );

    if (exitCode === 0) {
      return { success: true, message: "Repository cloned successfully" };
    }

    // Classify error
    if (stderr.includes("Permission denied")) {
      throw new GitOperationError(
        "SSH key permission denied. Check your SSH configuration.",
        "SSH_PERMISSION_DENIED",
        stderr
      );
    }

    if (stderr.includes("fatal: could not read Username")) {
      throw new GitOperationError(
        "HTTPS authentication required. Configure git credentials.",
        "AUTH_REQUIRED",
        stderr
      );
    }

    if (stderr.includes("fatal: repository not found")) {
      throw new GitOperationError(
        `Repository not found: ${url}`,
        "REPO_NOT_FOUND",
        stderr
      );
    }

    if (stderr.includes("Connection refused")) {
      throw new GitOperationError(
        "Connection refused. Check network and git host availability.",
        "CONNECTION_REFUSED",
        stderr
      );
    }

    throw new GitOperationError(
      "Unknown git error",
      "UNKNOWN",
      stderr
    );
  } catch (error) {
    if (error instanceof GitOperationError) {
      return { success: false, message: error.message };
    }

    throw new Error(`Failed to clone repository: ${error}`);
  }
};
```

### 5.2 Retry Logic with Exponential Backoff

```typescript
// Retry configuration
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    "CONNECTION_REFUSED",
    "TIMEOUT",
    "TEMPORARY_FAILURE",
  ],
};

// Retry wrapper
const withRetry = async <T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> => {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | null = null;
  let delayMs = finalConfig.initialDelayMs;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = finalConfig.retryableErrors.some(errCode =>
        lastError?.message.includes(errCode)
      );

      if (!isRetryable || attempt === finalConfig.maxAttempts) {
        throw lastError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Increase delay for next attempt
      delayMs = Math.min(
        delayMs * finalConfig.backoffMultiplier,
        finalConfig.maxDelayMs
      );
    }
  }

  throw lastError || new Error("Unknown error");
};

// Usage
const cloneWithRetry = (url: string, dest: string) =>
  withRetry(() => cloneRepositoryWithErrorHandling(url, dest), {
    maxAttempts: 3,
    retryableErrors: ["CONNECTION_REFUSED", "TEMPORARY_FAILURE"],
  });
```

### 5.3 Validation and Checks

```typescript
// Validate URL before operations
const validateGitUrl = (url: string): boolean => {
  try {
    // Basic URL validation
    if (!url.includes("@") && !url.includes("://")) {
      return false;
    }

    // SSH format validation
    if (url.includes("@")) {
      return /^git@[^:]+:[^:]+\/[^:]+\.git$/.test(url);
    }

    // HTTPS format validation
    if (url.includes("://")) {
      return /^https?:\/\/.+\/.+\/.+\.git$/.test(url);
    }

    return false;
  } catch {
    return false;
  }
};

// Validate local repository
const validateLocalRepository = async (
  repoPath: string
): Promise<{ valid: boolean; error?: string }> => {
  const { exitCode, stderr } = await executeGitOperation(
    ["rev-parse", "--git-dir"],
    { cwd: repoPath }
  );

  if (exitCode === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    error: stderr.trim() || "Not a git repository",
  };
};

// Check if ref exists
const refExists = async (
  repoPath: string,
  ref: string
): Promise<boolean> => {
  const { exitCode } = await executeGitOperation(
    ["rev-parse", ref],
    { cwd: repoPath }
  );

  return exitCode === 0;
};

// Validate subpath exists in repository
const subpathExists = async (
  repoPath: string,
  ref: string,
  subpath: string | undefined
): Promise<boolean> => {
  if (!subpath) {
    return true; // No subpath means entire repo
  }

  const { exitCode } = await executeGitOperation(
    ["cat-file", "-e", `${ref}:${subpath}`],
    { cwd: repoPath }
  );

  return exitCode === 0;
};
```

---

## Kustomark-Specific Recommendations

### 6.1 Proposed Implementation Architecture

```typescript
// Directory structure for git operations
src/
├── core/
│   ├── git-operations.ts       // Main git operations module
│   ├── git-cache.ts            // Caching layer
│   ├── git-auth.ts             // Authentication handling
│   └── git-errors.ts           // Custom error types
├── cli/
│   └── index.ts                // Enhanced with git commands
└── types.ts                    // Extended with git types
```

### 6.2 Integration Points in Existing Code

Based on the codebase analysis, integrate at:

1. **resource-resolver.ts** (Line 130-140)
   - Replace TODO comment with actual git resolution
   - Use caching for repeated fetches
   - Handle authentication gracefully

2. **config-parser.ts**
   - Validate git URLs during parsing
   - Warn about unsupported features

3. **cli/index.ts**
   - Add `fetch` command skeleton
   - Add cache management commands
   - Add `--no-cache` and `--force-update` flags

### 6.3 Implementation Phases

**Phase 1: Foundation (1-2 days)**
- Create git-operations.ts with basic clone/fetch
- Create git-errors.ts with error types
- Add comprehensive tests

**Phase 2: Authentication (1 day)**
- Create git-auth.ts for credential detection
- Support SSH and HTTPS auth paths
- Add retry logic

**Phase 3: Caching (2-3 days)**
- Create git-cache.ts
- Implement cache metadata and validation
- Add cache cleanup logic

**Phase 4: CLI Integration (1-2 days)**
- Integrate into resource-resolver.ts
- Add fetch command
- Add cache commands
- Update help text

**Phase 5: Testing & Documentation (2-3 days)**
- Comprehensive unit tests
- Integration tests with real repos
- Performance testing

### 6.4 Type Extensions

```typescript
// Add to types.ts
export interface ParsedGitUrl {
  type: "git";
  protocol: "https" | "ssh";
  host: string;
  org: string;
  repo: string;
  path?: string;
  ref: string;
  fullUrl: string;
}

export interface GitResolutionOptions {
  useCache: boolean;
  cacheDir?: string;
  forceUpdate: boolean;
  timeout?: number;
  maxRetries: number;
  auth?: {
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface GitOperationResult {
  success: boolean;
  path: string;
  ref: string;
  resolvedRef: string;
  cacheHit?: boolean;
  message?: string;
}
```

### 6.5 Performance Considerations

1. **Shallow Clones for One-off Operations**
   - Use `--depth 1` for temporary fetches
   - Saves bandwidth and time for large repos

2. **Sparse Checkout for Large Repos**
   - Only fetch specific subdirectories
   - Reduces cloned size significantly

3. **Caching Strategy**
   - Cache bare repositories
   - Reuse for multiple operations
   - Automatic expiration after 30 days

4. **Parallel Operations**
   - Clone multiple repos concurrently
   - Limit to prevent resource exhaustion

### 6.6 Testing Recommendations

```typescript
// Test fixtures
const TEST_REPOS = {
  valid: "https://github.com/torvalds/linux.git",
  small: "https://github.com/octocat/Hello-World.git",
  private: "https://github.com/private/repo.git", // For auth testing
  nonexistent: "https://github.com/nonexistent/repo.git",
  invalid: "not-a-git-url",
};

// Test scenarios
1. Clone success
2. Clone with sparse checkout
3. Fetch updates
4. Checkout ref (branch, tag, commit)
5. SSH authentication (if ssh-agent available)
6. HTTPS authentication with token
7. Cache hit and miss
8. Cache expiration
9. Network timeout
10. Invalid credentials
11. Repository not found
12. Malformed URL
13. Concurrent clones
14. Large repository handling
```

### 6.7 Documentation Updates

- Add git operations documentation to README.md
- Document cache management
- Provide authentication setup guide
- Include troubleshooting section
- Add examples for each git URL format

---

## Summary

### Key Takeaways

1. **Use `Bun.shell()` for most operations** - Modern, safe, easy to use
2. **Use `Bun.spawn()` for advanced control** - Fine-grained I/O and timeout handling
3. **Implement comprehensive error handling** - Classify errors and provide actionable messages
4. **Add caching at the foundation** - Critical for repeated operations
5. **Support multiple auth methods** - SSH keys, credential helpers, tokens
6. **Handle timeouts explicitly** - Essential for remote operations
7. **Provide good defaults** - But allow configuration

### Bun-Specific Advantages

- Faster process spawning (60% faster than Node.js)
- Native shell API with template literals
- Integrated file system operations
- Strong TypeScript support out of the box
- Lower overhead for small CLI tools

### Next Steps for Kustomark

1. Implement git-operations.ts with basic clone/fetch
2. Add comprehensive error handling
3. Implement caching layer
4. Integrate authentication handling
5. Add CLI commands for git operations
6. Comprehensive testing with real repositories

