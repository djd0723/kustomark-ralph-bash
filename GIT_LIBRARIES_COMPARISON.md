# Git Libraries Comparison for Kustomark (Bun/TypeScript)

## Executive Summary

After comprehensive research of git operation approaches for Bun/Node.js TypeScript projects, **using shell commands via Bun.spawn** is the recommended approach for Kustomark. This provides:

- Full sparse checkout support
- Complete authentication support (SSH keys, credential helpers, HTTPS tokens)
- Best compatibility with Bun runtime
- Highest performance
- No native dependency compilation issues
- Access to all git features without library limitations

## Available Options Overview

### 1. Shell Commands (via Bun.spawn or child_process)

Direct execution of git binary through process spawning.

**Popularity:** N/A (standard approach)

**Installation:**
```bash
# No npm package needed - uses system git
# Requires: git installed on system
```

**Pros:**
- Full access to all git features (sparse checkout, all auth methods)
- Native authentication support (SSH keys, credential helpers)
- Best compatibility with Bun runtime
- No compilation or native dependency issues
- Leverages git's built-in caching and optimization
- Most performant for Bun (child_process.spawn is fastest)
- TypeScript support via standard Node.js/Bun APIs
- Easy debugging (can test commands in terminal)
- Git handles security and edge cases

**Cons:**
- Requires git binary installed on system
- Less structured API (need to parse command output)
- More verbose error handling required
- Security considerations with command injection (mitigated with proper escaping)
- Not platform independent (git must be installed)

**Sparse Checkout:** ✅ Full native support via `git sparse-checkout` command

**Authentication:**
- ✅ SSH keys (full support via SSH_AUTH_SOCK)
- ✅ HTTPS (tokens, username/password)
- ✅ Credential helpers (osxkeychain, manager-core, cache, etc.)
- ✅ Git config integration

**Bun Compatibility:** ✅ Excellent

**TypeScript Support:** ✅ Standard Node.js/Bun APIs with full type safety

**Performance:** ✅ Excellent - direct git binary, no overhead

---

### 2. simple-git

A lightweight wrapper around the git binary providing a promise-based API.

**Popularity:** 7,896,609 weekly downloads, 3,764 GitHub stars

**Installation:**
```bash
bun add simple-git
```

**Pros:**
- High-level, easy-to-use Promise-based API
- Most popular git library for Node.js
- Excellent TypeScript support with bundled type definitions
- Works well with both Node.js and Bun
- Good for basic git operations
- Active maintenance
- Familiar API for developers

**Cons:**
- Still just a wrapper around git binary (requires git installed)
- Limited sparse checkout support (can execute raw commands but no high-level API)
- Adds abstraction overhead without major benefits
- Still spawns processes internally (overhead without advantages)
- Less control over advanced features
- Authentication relies on underlying git configuration

**Sparse Checkout:** ⚠️ Limited - can execute raw commands via `.raw()` method

**Authentication:**
- ✅ Relies on git's credential helpers
- ✅ Inherits system git authentication
- ⚠️ No programmatic auth API (uses environment/config)

**Bun Compatibility:** ✅ Good (uses child_process)

**TypeScript Support:** ✅ Excellent with bundled types

**Performance:** ✅ Good but adds overhead over direct spawn

**Example:**
```typescript
import simpleGit from 'simple-git';

const git = simpleGit();
await git.clone('https://github.com/user/repo.git', './dest');
await git.cwd('./dest').fetch();

// Sparse checkout requires raw commands
await git.raw(['config', 'core.sparseCheckout', 'true']);
```

---

### 3. isomorphic-git

A pure JavaScript implementation of git for Node.js and browsers.

**Popularity:** 627,969 weekly downloads, 8,000 GitHub stars

**Installation:**
```bash
bun add isomorphic-git
```

**Pros:**
- Pure JavaScript implementation (no git binary needed)
- Works in both Node.js and browser environments
- Good TypeScript definitions
- Can work without system dependencies
- Useful for browser-based git operations
- Active development

**Cons:**
- ❌ **NO SSH SUPPORT** (HTTPS only with Basic Auth)
- ⚠️ Limited sparse checkout (only via `filepaths` parameter, not full sparse checkout)
- Slower performance than native git (pure JS implementation)
- Complex API for advanced operations
- ❌ Reported issues with Bun (clone operations hanging)
- Not optimized for large repositories
- Missing many advanced git features
- Only supports username/password or token auth (no SSH keys, no credential helpers)

**Sparse Checkout:** ⚠️ Partial - `checkout()` accepts `filepaths` parameter but not full sparse checkout

**Authentication:**
- ❌ NO SSH support
- ✅ HTTPS with username/password
- ✅ HTTPS with Personal Access Tokens
- ❌ No credential helper support
- ❌ No SSH key support

**Bun Compatibility:** ❌ Problematic (reported issues with clone hanging)

**TypeScript Support:** ✅ Good type definitions included

**Performance:** ❌ Slower than native git

**Critical Limitation:** According to official documentation, isomorphic-git does **not support SSH protocol**. All authentication must be done over HTTPS using Basic Authentication or tokens. This is a dealbreaker for repositories requiring SSH access.

**Example:**
```typescript
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';

// HTTPS only - NO SSH support
await git.clone({
  fs,
  http,
  dir: '/path/to/repo',
  url: 'https://github.com/user/repo.git',
  ref: 'main',
  onAuth: () => ({ username: 'token', password: process.env.GITHUB_TOKEN }),
});

// Partial sparse checkout via filepaths
await git.checkout({
  fs,
  dir: '/path/to/repo',
  ref: 'main',
  filepaths: ['src/', 'docs/'],  // Not full sparse checkout
});
```

---

### 4. nodegit

Native Node.js bindings to libgit2, providing a comprehensive C++-based Git API.

**Popularity:** 29,343 weekly downloads, 5,749 GitHub stars

**Installation:**
```bash
bun add nodegit
# Requires: build tools (node-gyp, Python, C++ compiler)
```

**Pros:**
- Fast native bindings to libgit2
- Comprehensive API covering most git features
- Good performance for large operations
- Most complete Git feature set among libraries
- Suitable for server-side applications
- Good TypeScript definitions

**Cons:**
- ❌ **POOR BUN COMPATIBILITY** (native C++ bindings, N-API issues)
- ❌ Complex installation requiring build tools (node-gyp, Python, C++ compiler)
- ❌ Common installation failures (libstdc++, libssl-dev dependency issues)
- ⚠️ Limited sparse checkout support (libgit2 limitations)
- Steeper learning curve
- Overkill for basic clone/fetch operations
- May not work with Bun's runtime
- Platform-specific build requirements
- Maintenance overhead

**Sparse Checkout:** ⚠️ Limited due to libgit2 limitations

**Authentication:**
- ✅ Good authentication support
- ⚠️ Complex programmatic auth setup
- ✅ SSH and HTTPS support

**Bun Compatibility:** ❌ Poor (N-API compatibility issues, native modules)

**TypeScript Support:** ✅ Good type definitions

**Performance:** ✅ Excellent in Node.js, ❌ problematic in Bun

**Installation Issues:** Common problems include missing libstdc++-4.9, libssl-dev, and build tool configuration errors. Not recommended for cross-platform CLI tools.

**Example:**
```typescript
import NodeGit from 'nodegit';

// Complex API, requires understanding of libgit2
const repo = await NodeGit.Clone.clone(
  'https://github.com/user/repo.git',
  './dest'
);

// Sparse checkout support limited by libgit2
```

---

## Detailed Comparison Matrix

| Feature | Shell Commands | simple-git | isomorphic-git | nodegit |
|---------|----------------|------------|----------------|---------|
| **Sparse Checkout** | ✅ Full | ⚠️ Limited | ⚠️ Partial | ⚠️ Limited |
| **SSH Auth** | ✅ Full | ✅ Via git | ❌ No SSH | ✅ Yes |
| **HTTPS Auth** | ✅ Full | ✅ Via git | ✅ Basic only | ✅ Yes |
| **Credential Helpers** | ✅ Full | ✅ Yes | ❌ No | ⚠️ Limited |
| **Bun Compatibility** | ✅ Excellent | ✅ Good | ❌ Issues | ❌ Poor |
| **TypeScript** | ✅ Standard | ✅ Excellent | ✅ Good | ✅ Good |
| **Performance** | ✅ Excellent | ✅ Good | ❌ Slow | ✅ Fast* |
| **Installation** | ✅ Simple | ✅ Simple | ✅ Simple | ❌ Complex |
| **Dependencies** | Requires git | Requires git | None | Build tools |
| **Weekly Downloads** | N/A | 7.9M | 627K | 29K |
| **GitHub Stars** | N/A | 3,764 | 8,000 | 5,749 |
| **Maintenance** | Git project | Active | Active | Active |
| **Learning Curve** | Low | Low | Medium | High |
| **Browser Support** | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **All Git Features** | ✅ Yes | ✅ Via raw | ⚠️ Subset | ✅ Most |

*nodegit performance assumes Node.js; Bun has compatibility issues

---

## Why Each Library Falls Short

### Why NOT isomorphic-git?

**Critical Issues:**
1. ❌ **No SSH support** - This is a dealbreaker for many repositories requiring SSH authentication
2. Limited sparse checkout - Only supports `filepaths` parameter, not full git sparse-checkout
3. Performance issues with large repositories (pure JS implementation)
4. Bun compatibility problems (clone operations reported to hang)
5. HTTPS-only authentication severely limits usefulness
6. Missing advanced git features

**Use Case:** Only suitable for browser-based git operations or when you absolutely cannot install git binary.

### Why NOT nodegit?

**Critical Issues:**
1. ❌ **Poor Bun compatibility** - Native C++ bindings don't work well with Bun's runtime
2. Complex installation requiring build tools (node-gyp, Python, C++ compiler)
3. Common installation failures across platforms (libstdc++, libssl-dev issues)
4. Limited sparse checkout support due to libgit2 limitations
5. Overkill for basic clone/fetch/checkout operations

**Use Case:** Only if you need deep git internals manipulation in a Node.js-only environment and can ensure build tools are available.

### Why NOT simple-git?

**Issues:**
1. Adds abstraction overhead without major benefits for our use case
2. Still requires git binary (no advantage over direct commands)
3. Limited control over advanced features like sparse checkout
4. Sparse checkout requires falling back to `.raw()` commands anyway
5. Authentication still relies on system git configuration

**Use Case:** Good for teams wanting a higher-level API and don't need advanced features. However, for Kustomark's needs (sparse checkout, flexible auth), it doesn't provide enough value over direct commands.

---

## Why Shell Commands Win

### Advantages for Kustomark

1. **Full Feature Access**
   - Native sparse checkout support
   - All authentication methods (SSH, HTTPS, credential helpers)
   - Every git feature available without library limitations

2. **Best Bun Compatibility**
   - No native module compilation issues
   - Bun.spawn is optimized and fast
   - No N-API compatibility concerns

3. **Superior Performance**
   - Direct git binary execution (no library overhead)
   - Bun.spawn is ~60% faster than Node.js child_process
   - Leverages git's built-in optimizations

4. **Reliability**
   - Git binary handles edge cases and security
   - Battle-tested git implementation
   - No library bugs or limitations

5. **Maintainability**
   - Easy to debug (can test commands in terminal)
   - No dependency on third-party library maintenance
   - Commands are portable and well-documented

6. **Flexibility**
   - Full control over command execution
   - Easy to add new git features
   - Can use any git flag or option

### Performance Data

According to research, `child_process.spawn` performs best out of all approaches, which makes sense since libraries build on top of spawn, adding overhead. Bun.spawn provides additional performance benefits over Node.js:

- Bun.spawn is ~60% faster than Node.js child_process
- No library abstraction overhead
- Direct access to git's optimized operations

---

## Recommended Implementation

### Core Implementation with Bun.spawn

```typescript
import { spawn } from "bun";
import { mkdir, rm } from "fs/promises";
import { join } from "path";

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
  private async execGit(
    args: string[],
    cwd?: string,
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
      throw new Error(`Git command failed: ${stderr || stdout}`);
    }

    return { stdout, stderr, exitCode };
  }

  async cloneWithSparseCheckout(
    options: GitCloneOptions,
    auth?: GitAuthOptions
  ): Promise<void> {
    const {
      url,
      ref,
      sparseCheckoutPaths,
      depth = 1,
      targetDir,
      onProgress,
    } = options;

    // Prepare environment for authentication
    const env: Record<string, string> = {};

    if (auth?.sshKeyPath) {
      env.GIT_SSH_COMMAND = `ssh -i ${auth.sshKeyPath} -o StrictHostKeyChecking=no`;
    }

    if (auth?.httpsToken && auth?.httpsUsername) {
      // For HTTPS with token, we can use credential helper or URL embedding
      env.GIT_TERMINAL_PROMPT = "0"; // Disable interactive prompts
    }

    try {
      // Clean target directory if exists
      await rm(targetDir, { recursive: true, force: true });
      await mkdir(targetDir, { recursive: true });

      onProgress?.("Initializing repository...");
      await this.execGit(["init"], targetDir, env);

      onProgress?.("Adding remote...");
      await this.execGit(["remote", "add", "origin", url], targetDir, env);

      // Configure sparse checkout if paths provided
      if (sparseCheckoutPaths && sparseCheckoutPaths.length > 0) {
        onProgress?.("Configuring sparse checkout...");

        // Enable sparse checkout
        await this.execGit(
          ["config", "core.sparseCheckout", "true"],
          targetDir,
          env
        );

        // Set sparse checkout patterns using git sparse-checkout
        await this.execGit(
          ["sparse-checkout", "set", ...sparseCheckoutPaths],
          targetDir,
          env
        );
      }

      onProgress?.(`Fetching ref ${ref}...`);
      const fetchArgs = ["fetch", `--depth=${depth}`, "origin", ref];
      await this.execGit(fetchArgs, targetDir, env);

      onProgress?.("Checking out files...");
      await this.execGit(["checkout", "FETCH_HEAD"], targetDir, env);

      onProgress?.("Clone completed successfully!");
    } catch (error) {
      // Clean up on failure
      await rm(targetDir, { recursive: true, force: true });
      throw error;
    }
  }

  async fetch(
    repoDir: string,
    ref: string,
    auth?: GitAuthOptions
  ): Promise<void> {
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
}
```

### Usage Examples

```typescript
const git = new GitOperations();

// SSH authentication example
await git.cloneWithSparseCheckout(
  {
    url: "git@github.com:user/repo.git",
    ref: "main",
    sparseCheckoutPaths: ["docs/", "src/config/"],
    depth: 1,
    targetDir: "./cache/repo-main",
    onProgress: (msg) => console.log(msg),
  },
  {
    sshKeyPath: "~/.ssh/id_rsa",
  }
);

// HTTPS with token example
await git.cloneWithSparseCheckout(
  {
    url: "https://github.com/user/repo.git",
    ref: "v1.0.0",
    sparseCheckoutPaths: ["*.md", "src/"],
    targetDir: "./cache/repo-v1",
  },
  {
    httpsUsername: "token",
    httpsToken: process.env.GITHUB_TOKEN,
  }
);

// Full clone without sparse checkout
await git.cloneWithSparseCheckout({
  url: "https://github.com/user/repo.git",
  ref: "main",
  depth: 1,
  targetDir: "./cache/repo-full",
});
```

### Authentication Handling

#### SSH Keys
```typescript
// Use environment variable for SSH auth
const env = {
  GIT_SSH_COMMAND: "ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no",
};

// Or use SSH agent
const env = {
  SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "",
};
```

#### HTTPS with Tokens
```typescript
// Option 1: Use credential helper (recommended)
await execGit(["config", "--global", "credential.helper", "store"]);

// Option 2: Embed token in URL (less secure, logged)
const url = `https://${username}:${token}@github.com/user/repo.git`;

// Option 3: Use GIT_ASKPASS environment variable
process.env.GIT_ASKPASS = "/path/to/askpass-script.sh";
process.env.GIT_USERNAME = username;
```

---

## Caching Strategy

Implement disk-based caching to avoid repeated clones:

```typescript
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

interface CacheOptions {
  cacheDir: string;
  ttl?: number; // Time to live in milliseconds
}

class GitCache {
  private cacheDir: string;
  private ttl: number;

  constructor(options: CacheOptions) {
    this.cacheDir = options.cacheDir;
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default
  }

  private getCacheKey(url: string, ref: string, paths?: string[]): string {
    const key = `${url}:${ref}:${paths?.sort().join(",")}`;
    return createHash("sha256").update(key).digest("hex");
  }

  private getCachePath(cacheKey: string): string {
    return join(this.cacheDir, cacheKey);
  }

  async get(url: string, ref: string, paths?: string[]): Promise<string | null> {
    const cacheKey = this.getCacheKey(url, ref, paths);
    const cachePath = this.getCachePath(cacheKey);

    if (!existsSync(cachePath)) {
      return null;
    }

    // Check TTL
    const metadataPath = join(cachePath, ".cache-metadata.json");
    if (existsSync(metadataPath)) {
      const metadata = JSON.parse(await Bun.file(metadataPath).text());
      const age = Date.now() - metadata.timestamp;

      if (age > this.ttl) {
        return null; // Cache expired
      }
    }

    return cachePath;
  }

  async set(url: string, ref: string, repoPath: string, paths?: string[]): Promise<void> {
    const cacheKey = this.getCacheKey(url, ref, paths);
    const cachePath = this.getCachePath(cacheKey);

    await mkdir(this.cacheDir, { recursive: true });

    // Write metadata
    const metadataPath = join(cachePath, ".cache-metadata.json");
    await Bun.write(
      metadataPath,
      JSON.stringify({
        url,
        ref,
        paths,
        timestamp: Date.now(),
      })
    );
  }
}
```

---

## Performance Optimization Tips

### 1. Use Shallow Clones
```bash
git fetch --depth=1 origin main
```

### 2. Be Specific with Sparse Checkout
```bash
# Good - specific paths
docs/
src/config/

# Avoid - too broad
**/
```

### 3. Parallel Operations
```typescript
await Promise.all([
  cloneWithCache("repo1", "main", ["docs/"]),
  cloneWithCache("repo2", "v1.0", ["config/"]),
  cloneWithCache("repo3", "dev", ["*.md"]),
]);
```

### 4. Incremental Updates
```typescript
if (cached) {
  await git.fetch(cached, ref);
  await git.checkout(cached, ref);
} else {
  await git.cloneWithSparseCheckout({ ... });
}
```

---

## Summary and Recommendation

### Final Verdict: Use Shell Commands

For Kustomark's requirements, **direct shell commands via Bun.spawn** is the clear winner:

1. **Full sparse checkout support** - Native git sparse-checkout command
2. **Complete authentication** - SSH keys, HTTPS tokens, credential helpers
3. **Best Bun compatibility** - No native module issues
4. **Highest performance** - Direct git binary, no overhead
5. **Maximum flexibility** - Access to all git features
6. **Easy maintenance** - Standard git commands, easy to debug

### Implementation Checklist

- [ ] Create `GitOperations` class wrapping Bun.spawn
- [ ] Implement sparse checkout support
- [ ] Add caching layer with TTL
- [ ] Support SSH and HTTPS authentication
- [ ] Use git's native credential helpers
- [ ] Implement proper error handling and cleanup
- [ ] Add progress reporting
- [ ] Write comprehensive tests

---

## Sources

- [npm-compare: simple-git vs isomorphic-git vs nodegit](https://npm-compare.com/isomorphic-git,nodegit,simple-git)
- [npm trends: Git Libraries Comparison](https://npmtrends.com/isomorphic-git-vs-nodegit-vs-simple-git)
- [isomorphic-git Documentation](https://isomorphic-git.org/)
- [isomorphic-git Authentication Documentation](https://isomorphic-git.org/docs/en/authentication)
- [isomorphic-git FAQ](https://isomorphic-git.org/docs/en/faq)
- [simple-git npm package](https://www.npmjs.com/package/simple-git)
- [Git sparse-checkout Documentation](https://git-scm.com/docs/git-sparse-checkout)
- [Git credentials Documentation](https://git-scm.com/docs/gitcredentials)
- [Bun Shell Documentation](https://bun.com/docs/runtime/shell)
- [Bun.spawn API Reference](https://bun.com/docs/api/spawn)
- [Bun Node.js Compatibility](https://bun.com/docs/runtime/nodejs-compat)
- [Bun vs Node.js Performance Guide](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide)
- [NodeGit Installation Guide](https://www.nodegit.org/)
- [GitHub: isomorphic-git Repository](https://github.com/isomorphic-git/isomorphic-git)
