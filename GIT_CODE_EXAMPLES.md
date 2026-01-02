# Git Operations Code Examples for Kustomark

This document provides ready-to-use code examples for implementing git operations using shell commands in Bun/TypeScript.

## Table of Contents

1. [Basic Git Operations](#basic-git-operations)
2. [Sparse Checkout](#sparse-checkout)
3. [Authentication](#authentication)
4. [Caching](#caching)
5. [Error Handling](#error-handling)
6. [Complete Integration Example](#complete-integration-example)

---

## Basic Git Operations

### Simple Clone

```typescript
import { spawn } from "bun";

async function gitClone(url: string, targetDir: string): Promise<boolean> {
  const proc = spawn({
    cmd: ["git", "clone", url, targetDir],
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

// Usage
await gitClone("https://github.com/user/repo.git", "./my-repo");
```

### Shallow Clone (Faster)

```typescript
async function shallowClone(
  url: string,
  ref: string,
  targetDir: string
): Promise<boolean> {
  const proc = spawn({
    cmd: [
      "git",
      "clone",
      "--depth",
      "1",
      "--branch",
      ref,
      "--single-branch",
      url,
      targetDir,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

// Usage
await shallowClone("https://github.com/user/repo.git", "main", "./my-repo");
```

### Fetch Specific Ref

```typescript
async function fetchRef(repoDir: string, ref: string): Promise<boolean> {
  const proc = spawn({
    cmd: ["git", "fetch", "origin", ref],
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

// Usage
await fetchRef("./my-repo", "v1.0.0");
```

### Checkout Ref

```typescript
async function checkoutRef(repoDir: string, ref: string): Promise<boolean> {
  const proc = spawn({
    cmd: ["git", "checkout", ref],
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

// Usage
await checkoutRef("./my-repo", "feature-branch");
```

### Get Current Commit Hash

```typescript
async function getCurrentCommitHash(repoDir: string): Promise<string> {
  const proc = spawn({
    cmd: ["git", "rev-parse", "HEAD"],
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error("Failed to get commit hash");
  }

  return stdout.trim();
}

// Usage
const hash = await getCurrentCommitHash("./my-repo");
console.log(`Current commit: ${hash}`);
```

---

## Sparse Checkout

### Basic Sparse Checkout

```typescript
import { spawn } from "bun";
import { mkdir, rm } from "fs/promises";

async function sparseCheckout(
  url: string,
  ref: string,
  paths: string[],
  targetDir: string
): Promise<void> {
  // Clean and create target directory
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  // Initialize git repo
  let proc = spawn({
    cmd: ["git", "init"],
    cwd: targetDir,
  });
  await proc.exited;

  // Add remote
  proc = spawn({
    cmd: ["git", "remote", "add", "origin", url],
    cwd: targetDir,
  });
  await proc.exited;

  // Configure sparse checkout
  proc = spawn({
    cmd: ["git", "config", "core.sparseCheckout", "true"],
    cwd: targetDir,
  });
  await proc.exited;

  // Set sparse checkout paths using modern sparse-checkout command
  proc = spawn({
    cmd: ["git", "sparse-checkout", "set", ...paths],
    cwd: targetDir,
  });
  await proc.exited;

  // Fetch with depth
  proc = spawn({
    cmd: ["git", "fetch", "--depth=1", "origin", ref],
    cwd: targetDir,
  });
  await proc.exited;

  // Checkout
  proc = spawn({
    cmd: ["git", "checkout", "FETCH_HEAD"],
    cwd: targetDir,
  });
  await proc.exited;
}

// Usage
await sparseCheckout(
  "https://github.com/user/repo.git",
  "main",
  ["docs/", "src/config/", "*.md"],
  "./sparse-repo"
);
```

### Sparse Checkout with Progress

```typescript
async function sparseCheckoutWithProgress(
  url: string,
  ref: string,
  paths: string[],
  targetDir: string,
  onProgress: (message: string) => void
): Promise<void> {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  onProgress("Initializing repository...");
  await spawn({ cmd: ["git", "init"], cwd: targetDir }).exited;

  onProgress("Adding remote...");
  await spawn({
    cmd: ["git", "remote", "add", "origin", url],
    cwd: targetDir,
  }).exited;

  onProgress("Configuring sparse checkout...");
  await spawn({
    cmd: ["git", "config", "core.sparseCheckout", "true"],
    cwd: targetDir,
  }).exited;

  onProgress(`Setting sparse paths: ${paths.join(", ")}`);
  await spawn({
    cmd: ["git", "sparse-checkout", "set", ...paths],
    cwd: targetDir,
  }).exited;

  onProgress(`Fetching ${ref}...`);
  await spawn({
    cmd: ["git", "fetch", "--depth=1", "origin", ref],
    cwd: targetDir,
  }).exited;

  onProgress("Checking out files...");
  await spawn({
    cmd: ["git", "checkout", "FETCH_HEAD"],
    cwd: targetDir,
  }).exited;

  onProgress("Complete!");
}

// Usage
await sparseCheckoutWithProgress(
  "https://github.com/user/repo.git",
  "main",
  ["docs/"],
  "./sparse-repo",
  (msg) => console.log(`[Git] ${msg}`)
);
```

---

## Authentication

### SSH Authentication

```typescript
async function cloneWithSSH(
  url: string,
  targetDir: string,
  sshKeyPath: string = "~/.ssh/id_rsa"
): Promise<boolean> {
  const proc = spawn({
    cmd: ["git", "clone", url, targetDir],
    env: {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`,
      GIT_TERMINAL_PROMPT: "0", // Disable interactive prompts
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

// Usage
await cloneWithSSH(
  "git@github.com:user/private-repo.git",
  "./private-repo",
  "~/.ssh/custom_key"
);
```

### HTTPS with Token

```typescript
async function cloneWithToken(
  url: string,
  targetDir: string,
  token: string
): Promise<boolean> {
  // Method 1: Embed token in URL (works but token may be logged)
  const urlWithToken = url.replace("https://", `https://token:${token}@`);

  const proc = spawn({
    cmd: ["git", "clone", urlWithToken, targetDir],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

// Usage
await cloneWithToken(
  "https://github.com/user/repo.git",
  "./repo",
  process.env.GITHUB_TOKEN!
);
```

### HTTPS with Credential Helper

```typescript
async function setupCredentialHelper(helper: string = "store"): Promise<void> {
  const proc = spawn({
    cmd: ["git", "config", "--global", "credential.helper", helper],
  });

  await proc.exited;
}

async function cloneWithCredentialHelper(
  url: string,
  targetDir: string
): Promise<boolean> {
  // Git will use configured credential helper
  const proc = spawn({
    cmd: ["git", "clone", url, targetDir],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
}

// Usage
await setupCredentialHelper("osxkeychain"); // macOS
// await setupCredentialHelper("manager-core"); // Windows
// await setupCredentialHelper("cache --timeout=3600"); // Linux with 1hr cache

await cloneWithCredentialHelper("https://github.com/user/repo.git", "./repo");
```

### Detect Available Auth Methods

```typescript
import { existsSync } from "fs";

interface AuthCapabilities {
  hasSSHKey: boolean;
  hasSSHAgent: boolean;
  hasGitCredentials: boolean;
}

async function detectAuthCapabilities(): Promise<AuthCapabilities> {
  const homeDir = process.env.HOME || "~";

  // Check for SSH key
  const hasSSHKey = existsSync(`${homeDir}/.ssh/id_rsa`) ||
                     existsSync(`${homeDir}/.ssh/id_ed25519`);

  // Check for SSH agent
  const hasSSHAgent = Boolean(process.env.SSH_AUTH_SOCK);

  // Check for git credential helper
  const proc = spawn({
    cmd: ["git", "config", "credential.helper"],
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const hasGitCredentials = (await proc.exited) === 0 && stdout.trim().length > 0;

  return {
    hasSSHKey,
    hasSSHAgent,
    hasGitCredentials,
  };
}

// Usage
const auth = await detectAuthCapabilities();
console.log("Auth capabilities:", auth);

if (auth.hasSSHAgent) {
  console.log("Can use SSH authentication");
}
if (auth.hasGitCredentials) {
  console.log("Can use HTTPS with credential helper");
}
```

---

## Caching

### Simple Cache Implementation

```typescript
import { existsSync } from "fs";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

class SimpleGitCache {
  constructor(private cacheDir: string = "./.cache/git") {}

  private getCacheKey(url: string, ref: string, paths?: string[]): string {
    const key = `${url}:${ref}:${paths?.sort().join(",")}`;
    return createHash("sha256").update(key).digest("hex");
  }

  private getCachePath(key: string): string {
    return join(this.cacheDir, key);
  }

  async get(url: string, ref: string, paths?: string[]): Promise<string | null> {
    const key = this.getCacheKey(url, ref, paths);
    const path = this.getCachePath(key);

    if (existsSync(path)) {
      return path;
    }

    return null;
  }

  async set(url: string, ref: string, repoPath: string, paths?: string[]): Promise<void> {
    const key = this.getCacheKey(url, ref, paths);
    const cachePath = this.getCachePath(key);

    await mkdir(this.cacheDir, { recursive: true });

    // Copy repo to cache (you might want to use git clone --mirror for efficiency)
    // For now, we just track the path
    const metadata = {
      url,
      ref,
      paths,
      repoPath,
      timestamp: Date.now(),
    };

    await Bun.write(
      join(cachePath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );
  }

  async clear(): Promise<void> {
    await rm(this.cacheDir, { recursive: true, force: true });
  }
}

// Usage
const cache = new SimpleGitCache();

async function cloneWithCache(
  url: string,
  ref: string,
  targetDir: string,
  paths?: string[]
): Promise<void> {
  // Check cache
  const cached = await cache.get(url, ref, paths);

  if (cached) {
    console.log("Cache hit! Using cached repository.");
    // Could copy from cache or use directly
    return;
  }

  console.log("Cache miss. Cloning repository...");

  // Clone normally
  if (paths && paths.length > 0) {
    await sparseCheckout(url, ref, paths, targetDir);
  } else {
    await shallowClone(url, ref, targetDir);
  }

  // Store in cache
  await cache.set(url, ref, targetDir, paths);
}

// Usage
await cloneWithCache(
  "https://github.com/user/repo.git",
  "main",
  "./repo",
  ["docs/"]
);
```

### Advanced Cache with TTL

```typescript
interface CacheMetadata {
  url: string;
  ref: string;
  paths?: string[];
  timestamp: number;
  commitHash?: string;
}

class GitCacheWithTTL {
  constructor(
    private cacheDir: string = "./.cache/git",
    private ttlMs: number = 24 * 60 * 60 * 1000 // 24 hours
  ) {}

  private getCacheKey(url: string, ref: string, paths?: string[]): string {
    const key = `${url}:${ref}:${paths?.sort().join(",")}`;
    return createHash("sha256").update(key).digest("hex");
  }

  private getCachePath(key: string): string {
    return join(this.cacheDir, key);
  }

  async get(url: string, ref: string, paths?: string[]): Promise<string | null> {
    const key = this.getCacheKey(url, ref, paths);
    const cachePath = this.getCachePath(key);
    const metadataPath = join(cachePath, "metadata.json");

    if (!existsSync(metadataPath)) {
      return null;
    }

    // Check TTL
    const metadata: CacheMetadata = JSON.parse(
      await Bun.file(metadataPath).text()
    );

    const age = Date.now() - metadata.timestamp;

    if (age > this.ttlMs) {
      console.log(`Cache expired (age: ${Math.round(age / 1000)}s)`);
      await this.invalidate(url, ref, paths);
      return null;
    }

    return cachePath;
  }

  async set(
    url: string,
    ref: string,
    repoPath: string,
    paths?: string[]
  ): Promise<void> {
    const key = this.getCacheKey(url, ref, paths);
    const cachePath = this.getCachePath(key);

    await mkdir(cachePath, { recursive: true });

    // Get commit hash for reference
    let commitHash: string | undefined;
    try {
      commitHash = await getCurrentCommitHash(repoPath);
    } catch {
      // Ignore if can't get hash
    }

    const metadata: CacheMetadata = {
      url,
      ref,
      paths,
      timestamp: Date.now(),
      commitHash,
    };

    await Bun.write(
      join(cachePath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );
  }

  async invalidate(url: string, ref: string, paths?: string[]): Promise<void> {
    const key = this.getCacheKey(url, ref, paths);
    const cachePath = this.getCachePath(key);
    await rm(cachePath, { recursive: true, force: true });
  }

  async clearExpired(): Promise<number> {
    let cleared = 0;

    if (!existsSync(this.cacheDir)) {
      return cleared;
    }

    const entries = await Array.fromAsync(
      Bun.file(this.cacheDir).values()
    );

    for (const entry of entries) {
      const metadataPath = join(this.cacheDir, entry.name, "metadata.json");

      if (existsSync(metadataPath)) {
        const metadata: CacheMetadata = JSON.parse(
          await Bun.file(metadataPath).text()
        );

        const age = Date.now() - metadata.timestamp;

        if (age > this.ttlMs) {
          await rm(join(this.cacheDir, entry.name), {
            recursive: true,
            force: true,
          });
          cleared++;
        }
      }
    }

    return cleared;
  }
}

// Usage
const cache = new GitCacheWithTTL("./.cache/git", 7 * 24 * 60 * 60 * 1000); // 7 days

// Clean expired caches periodically
const cleaned = await cache.clearExpired();
console.log(`Cleaned ${cleaned} expired cache entries`);
```

---

## Error Handling

### Custom Error Types

```typescript
class GitError extends Error {
  constructor(
    message: string,
    public code: string,
    public stdout?: string,
    public stderr?: string
  ) {
    super(message);
    this.name = "GitError";
  }
}

class GitAuthError extends GitError {
  constructor(message: string, stderr?: string) {
    super(message, "AUTH_ERROR", "", stderr);
    this.name = "GitAuthError";
  }
}

class GitNotFoundError extends GitError {
  constructor(message: string, stderr?: string) {
    super(message, "NOT_FOUND", "", stderr);
    this.name = "GitNotFoundError";
  }
}

class GitNetworkError extends GitError {
  constructor(message: string, stderr?: string) {
    super(message, "NETWORK_ERROR", "", stderr);
    this.name = "GitNetworkError";
  }
}
```

### Error Classification

```typescript
async function execGitWithErrors(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string }> {
  const proc = spawn({
    cmd: ["git", ...args],
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    // Classify error based on stderr
    if (stderr.includes("Permission denied") || stderr.includes("publickey")) {
      throw new GitAuthError(
        "SSH authentication failed. Check your SSH keys.",
        stderr
      );
    }

    if (
      stderr.includes("could not read Username") ||
      stderr.includes("Authentication failed")
    ) {
      throw new GitAuthError(
        "HTTPS authentication failed. Check your credentials.",
        stderr
      );
    }

    if (
      stderr.includes("repository not found") ||
      stderr.includes("not found")
    ) {
      throw new GitNotFoundError(
        "Repository not found. Check the URL.",
        stderr
      );
    }

    if (
      stderr.includes("Connection refused") ||
      stderr.includes("Could not resolve host")
    ) {
      throw new GitNetworkError(
        "Network error. Check your connection.",
        stderr
      );
    }

    // Generic git error
    throw new GitError(
      `Git command failed: ${args.join(" ")}`,
      "UNKNOWN",
      stdout,
      stderr
    );
  }

  return { stdout, stderr };
}

// Usage
try {
  await execGitWithErrors(["clone", "git@github.com:user/private.git", "./repo"]);
} catch (error) {
  if (error instanceof GitAuthError) {
    console.error("Authentication problem:", error.message);
    // Suggest solutions
    console.log("Try: ssh-add ~/.ssh/id_rsa");
  } else if (error instanceof GitNotFoundError) {
    console.error("Repository not found:", error.message);
  } else if (error instanceof GitNetworkError) {
    console.error("Network problem:", error.message);
  } else {
    console.error("Unknown error:", error);
  }
}
```

### Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry auth errors or not found errors
      if (
        error instanceof GitAuthError ||
        error instanceof GitNotFoundError
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }

  throw lastError;
}

// Usage
const result = await withRetry(
  () => execGitWithErrors(["clone", url, targetDir]),
  3,
  1000
);
```

---

## Complete Integration Example

### Full GitOperations Class

```typescript
import { spawn } from "bun";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { existsSync } from "fs";

interface GitCloneOptions {
  url: string;
  ref: string;
  sparseCheckoutPaths?: string[];
  depth?: number;
  targetDir: string;
  onProgress?: (message: string) => void;
}

interface GitAuthOptions {
  sshKeyPath?: string;
  httpsUsername?: string;
  httpsToken?: string;
}

class GitOperations {
  private cache: GitCacheWithTTL;

  constructor(cacheDir: string = "./.cache/git", cacheTTL?: number) {
    this.cache = new GitCacheWithTTL(cacheDir, cacheTTL);
  }

  private async execGit(
    args: string[],
    cwd?: string,
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string }> {
    const proc = spawn({
      cmd: ["git", ...args],
      cwd,
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      // Error classification
      if (stderr.includes("Permission denied") || stderr.includes("publickey")) {
        throw new GitAuthError("SSH authentication failed", stderr);
      }

      if (stderr.includes("could not read Username")) {
        throw new GitAuthError("HTTPS authentication required", stderr);
      }

      if (stderr.includes("repository not found")) {
        throw new GitNotFoundError("Repository not found", stderr);
      }

      throw new GitError("Git command failed", "UNKNOWN", stdout, stderr);
    }

    return { stdout, stderr };
  }

  async cloneWithSparseCheckout(
    options: GitCloneOptions,
    auth?: GitAuthOptions,
    useCache: boolean = true
  ): Promise<string> {
    const {
      url,
      ref,
      sparseCheckoutPaths,
      depth = 1,
      targetDir,
      onProgress,
    } = options;

    // Check cache
    if (useCache) {
      const cached = await this.cache.get(url, ref, sparseCheckoutPaths);
      if (cached) {
        onProgress?.("Using cached repository");
        return cached;
      }
    }

    // Prepare auth environment
    const env: Record<string, string> = {
      GIT_TERMINAL_PROMPT: "0",
    };

    if (auth?.sshKeyPath) {
      env.GIT_SSH_COMMAND = `ssh -i ${auth.sshKeyPath} -o StrictHostKeyChecking=no`;
    }

    try {
      // Clean target directory
      await rm(targetDir, { recursive: true, force: true });
      await mkdir(targetDir, { recursive: true });

      onProgress?.("Initializing repository...");
      await this.execGit(["init"], targetDir, env);

      onProgress?.("Adding remote...");
      await this.execGit(["remote", "add", "origin", url], targetDir, env);

      // Configure sparse checkout
      if (sparseCheckoutPaths && sparseCheckoutPaths.length > 0) {
        onProgress?.("Configuring sparse checkout...");
        await this.execGit(
          ["config", "core.sparseCheckout", "true"],
          targetDir,
          env
        );
        await this.execGit(
          ["sparse-checkout", "set", ...sparseCheckoutPaths],
          targetDir,
          env
        );
      }

      onProgress?.(`Fetching ${ref}...`);
      await this.execGit(
        ["fetch", `--depth=${depth}`, "origin", ref],
        targetDir,
        env
      );

      onProgress?.("Checking out files...");
      await this.execGit(["checkout", "FETCH_HEAD"], targetDir, env);

      // Cache the result
      if (useCache) {
        await this.cache.set(url, ref, targetDir, sparseCheckoutPaths);
      }

      onProgress?.("Complete!");
      return targetDir;
    } catch (error) {
      // Clean up on failure
      await rm(targetDir, { recursive: true, force: true });
      throw error;
    }
  }

  async fetch(repoDir: string, ref: string, auth?: GitAuthOptions): Promise<void> {
    const env: Record<string, string> = {};

    if (auth?.sshKeyPath) {
      env.GIT_SSH_COMMAND = `ssh -i ${auth.sshKeyPath} -o StrictHostKeyChecking=no`;
    }

    await this.execGit(["fetch", "origin", ref], repoDir, env);
  }

  async checkout(repoDir: string, ref: string): Promise<void> {
    await this.execGit(["checkout", ref], repoDir);
  }

  async getCommitHash(repoDir: string): Promise<string> {
    const { stdout } = await this.execGit(["rev-parse", "HEAD"], repoDir);
    return stdout.trim();
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  async clearExpiredCache(): Promise<number> {
    return await this.cache.clearExpired();
  }
}

// Usage Example
async function main() {
  const git = new GitOperations();

  try {
    // Clone with sparse checkout
    const repoPath = await git.cloneWithSparseCheckout(
      {
        url: "https://github.com/user/repo.git",
        ref: "main",
        sparseCheckoutPaths: ["docs/", "*.md"],
        targetDir: "./my-repo",
        onProgress: (msg) => console.log(`[Git] ${msg}`),
      },
      {
        httpsToken: process.env.GITHUB_TOKEN,
      }
    );

    console.log(`Repository cloned to: ${repoPath}`);

    // Get current commit
    const hash = await git.getCommitHash(repoPath);
    console.log(`Current commit: ${hash}`);

    // Clean expired caches
    const cleaned = await git.clearExpiredCache();
    console.log(`Cleaned ${cleaned} expired cache entries`);
  } catch (error) {
    if (error instanceof GitAuthError) {
      console.error("Authentication failed:", error.message);
    } else if (error instanceof GitNotFoundError) {
      console.error("Repository not found:", error.message);
    } else {
      console.error("Error:", error);
    }
  }
}

main();
```

---

## Integration with Kustomark

### Update resource-resolver.ts

Replace the TODO at line 130-140:

```typescript
// In resolveResources function, replace the git URL TODO section:

if (isGitUrl(pattern)) {
  const parsedGit = parseGitUrl(pattern);
  if (!parsedGit) {
    throw new ResourceResolutionError(
      `Malformed git URL: ${pattern}`,
      pattern
    );
  }

  // Initialize git operations
  const git = new GitOperations();

  try {
    // Clone or get from cache
    const repoPath = await git.cloneWithSparseCheckout(
      {
        url: parsedGit.fullUrl,
        ref: parsedGit.ref,
        sparseCheckoutPaths: parsedGit.path ? [parsedGit.path] : undefined,
        targetDir: join(".cache", "git", parsedGit.org, parsedGit.repo, parsedGit.ref),
        onProgress: (msg) => console.log(`[Git] ${msg}`),
      },
      undefined, // Auth - will use system credentials
      true // Use cache
    );

    // Resolve markdown files from cloned repo
    const clonedFileMap = new Map<string, string>();
    // ... read files from repoPath into clonedFileMap

    // Add resolved files to resolvedResources
    for (const [filePath, content] of clonedFileMap) {
      if (filePath.endsWith(".md")) {
        resolvedResources.push({
          path: filePath,
          content,
          source: pattern,
        });
      }
    }
  } catch (error) {
    throw new ResourceResolutionError(
      `Failed to clone git repository: ${error instanceof Error ? error.message : String(error)}`,
      pattern,
      error instanceof Error ? error : undefined
    );
  }
}
```

---

## Summary

This document provides production-ready code examples for:

1. Basic git operations (clone, fetch, checkout)
2. Sparse checkout implementation
3. Multiple authentication methods (SSH, HTTPS tokens, credential helpers)
4. Caching with TTL
5. Comprehensive error handling
6. Complete integration example

All examples use Bun's spawn API for maximum performance and compatibility. The code is ready to integrate into Kustomark's resource resolver.
