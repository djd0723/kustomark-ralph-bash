# Git Operations Quick Start Guide

Quick reference for implementing git operations in Kustomark/Bun.

## Running Git Commands

### Basic Command Execution

```typescript
// Simple command
const result = await Bun.shell`git status`.text();

// With error handling
const process = await Bun.shell`git clone <url> <dest>`;
if (process.exitCode !== 0) {
  console.error("Clone failed");
}

// Get output in different formats
const text = await Bun.shell`git log --oneline -5`.text();
const bytes = await Bun.shell`git show --binary`.bytes();
const stream = await Bun.shell`git log`.stream();
```

### Common Git Operations in Bun

```typescript
// Clone
await Bun.shell`git clone https://github.com/user/repo.git dest`;

// Clone with branch
await Bun.shell`git clone -b main https://github.com/user/repo.git dest`;

// Shallow clone (faster)
await Bun.shell`git clone --depth 1 https://github.com/user/repo.git dest`;

// Fetch updates
await Bun.shell`cd /repo && git fetch origin`;

// Checkout branch
await Bun.shell`cd /repo && git checkout main`;

// Get current commit
const commit = await Bun.shell`cd /repo && git rev-parse HEAD`.text();

// List branches
const branches = await Bun.shell`cd /repo && git branch -r`.text();

// List tags
const tags = await Bun.shell`cd /repo && git tag`.text();
```

### Error Handling Pattern

```typescript
const executeGit = async (args: string[], cwd?: string) => {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30000,
  });

  const stdout = await Bun.readableStreamToText(proc.stdout);
  const stderr = await Bun.readableStreamToText(proc.stderr);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`Git failed: ${stderr}`);
  }

  return stdout;
};

// Usage
try {
  await executeGit(["clone", url, dest]);
} catch (error) {
  console.error(error.message);
}
```

## Authentication Approaches

### SSH (Recommended)

```typescript
// SSH works if:
// 1. SSH key exists at ~/.ssh/id_rsa (or env var SSH_KEY_PATH)
// 2. SSH agent is running (check SSH_AUTH_SOCK env var)

// SSH clone
const proc = Bun.spawn(["git", "clone", "git@github.com:user/repo.git", "dest"], {
  env: {
    ...process.env,
    SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
  },
});
```

### Token-Based (GitHub/GitLab)

```typescript
// HTTPS with token (safest for CI/CD)
const token = process.env.GITHUB_TOKEN;
const url = `https://${token}@github.com/user/repo.git`;

// Or use credential helper
const proc = Bun.spawn(["git", "clone", url, "dest"], {
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0", // No interactive prompts
  },
});
```

### GitHub CLI

```typescript
// GitHub CLI handles auth automatically
const isAuthenticated = async () => {
  const proc = await Bun.shell`gh auth status`.exitCode;
  return proc === 0;
};

// Clone with gh
const url = "https://github.com/user/repo.git";
await Bun.shell`git clone ${url} dest`;
```

## Caching Strategy

### Simple Cache Pattern

```typescript
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const cacheDir = join(process.env.HOME || "~", ".cache", "kustomark", "git");

const getOrClone = async (url: string, org: string, repo: string) => {
  const cachePath = join(cacheDir, org, repo);

  if (existsSync(cachePath)) {
    // Update existing cache
    await Bun.shell`cd ${cachePath} && git fetch origin`;
  } else {
    // Create new cache (bare repository for efficiency)
    mkdirSync(cachePath, { recursive: true });
    await Bun.shell`git clone --bare ${url} ${cachePath}/.git`;
  }

  return cachePath;
};
```

### Extract Subdirectory

```typescript
const extractSubdir = async (
  cachePath: string,
  ref: string,
  subdir: string,
  destPath: string
) => {
  // Use git archive to extract only subdirectory
  const proc = Bun.spawn(
    ["git", "archive", ref, subdir],
    { cwd: cachePath, stdout: "pipe" }
  );

  // Pipe to tar to extract
  const tar = Bun.spawn(["tar", "-x", "-C", destPath], {
    stdin: proc.stdout,
  });

  await tar.exited;
};
```

## Environment Variables

### Disable Interactive Prompts

```typescript
const env = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0", // Prevent "Username for 'https://github.com'?"
};

const proc = Bun.spawn(["git", "clone", url], { env });
```

### SSH Agent

```typescript
const env = {
  ...process.env,
  SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK, // Use system SSH agent
};
```

### Custom Config

```typescript
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/tmp/git-config", // Use custom git config
};
```

## Timeout Handling

### Built-in Timeout

```typescript
const proc = Bun.spawn(["git", "clone", url], {
  timeout: 60000, // 60 seconds
  killSignal: "SIGTERM",
});

await proc.exited;
```

### Manual Timeout Control

```typescript
const cloneWithTimeout = async (url: string, dest: string) => {
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

## Retry Logic

### Exponential Backoff

```typescript
const withRetry = async (fn: () => Promise<any>, maxAttempts = 3) => {
  let lastError;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxAttempts) {
        // Wait 2^i seconds (2s, 4s, 8s)
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }

  throw lastError;
};

// Usage
await withRetry(() => cloneRepository(url, dest));
```

## Detecting Available Auth

```typescript
// Check SSH agent
const hasSshAgent = () => Boolean(process.env.SSH_AUTH_SOCK);

// Check for SSH key
const hasSshKey = () => {
  const fs = require("fs");
  return fs.existsSync(process.env.HOME + "/.ssh/id_rsa");
};

// Check for GitHub CLI
const hasGithubCli = async () => {
  const proc = Bun.spawn(["gh", "auth", "status"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return (await proc.exited) === 0;
};

// Check for credentials
const hasGitCredentials = async () => {
  const proc = Bun.spawn(["git", "credential-osxkeychain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return (await proc.exited) !== 127;
};
```

## Error Parsing

```typescript
const parseGitError = (stderr: string): string => {
  if (stderr.includes("Permission denied")) {
    return "SSH key permission denied. Check your SSH configuration.";
  }
  if (stderr.includes("fatal: could not read Username")) {
    return "HTTPS authentication required. Configure git credentials.";
  }
  if (stderr.includes("fatal: repository not found")) {
    return "Repository not found. Check URL and permissions.";
  }
  if (stderr.includes("Connection refused")) {
    return "Connection refused. Check network and git host.";
  }
  if (stderr.includes("fatal: the remote end hung up")) {
    return "Connection lost during clone. Try again or use --depth 1.";
  }
  return "Unknown git error";
};

// Usage
const { exitCode, stderr } = await executeGit(["clone", url, dest]);
if (exitCode !== 0) {
  console.error(parseGitError(stderr));
}
```

## Sparse Checkout (Git 2.25.0+)

```typescript
const sparsCheckout = async (
  url: string,
  dest: string,
  paths: string[]
) => {
  // Clone with no initial checkout
  await Bun.shell`git clone --no-checkout ${url} ${dest}`;

  // Configure sparse checkout
  for (const path of paths) {
    await Bun.shell`cd ${dest} && git sparse-checkout add ${path}`;
  }

  // Perform checkout
  await Bun.shell`cd ${dest} && git checkout`;
};
```

## Validate Before Clone

```typescript
// Check if URL is valid git URL
const isValidGitUrl = (url: string): boolean => {
  return (
    url.startsWith("git@") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.includes("github.com/")
  );
};

// Check if repository exists (requires network)
const repoExists = async (url: string): Promise<boolean> => {
  const proc = Bun.spawn(["git", "ls-remote", "--exit-code", url], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return (await proc.exited) === 0;
};
```

## Practical Examples

### Clone into Cache, Extract Subset

```typescript
const resolveGitResource = async (
  url: string,
  ref: string,
  subpath?: string
) => {
  const cacheDir = join(process.env.HOME!, ".cache/kustomark/git");
  const [, org, repo] = url.match(/([^/]+)\/([^/]+?)(?:\.git)?$/) || [];
  const cachePath = join(cacheDir, org, repo);

  // Ensure cache exists
  if (!existsSync(cachePath)) {
    mkdirSync(cachePath, { recursive: true });
    await Bun.shell`git clone --bare ${url} ${cachePath}/.git`;
  }

  // Extract to temp directory
  const tmpDir = `/tmp/kustomark-${Date.now()}`;
  mkdirSync(tmpDir, { recursive: true });

  // Archive and extract
  const archiveProc = Bun.spawn(
    ["git", "archive", ref, ...(subpath ? [subpath] : [])],
    { cwd: cachePath, stdout: "pipe" }
  );

  const tarProc = Bun.spawn(["tar", "-x", "-C", tmpDir], {
    stdin: archiveProc.stdout,
  });

  await tarProc.exited;

  return tmpDir;
};
```

### Detect Auth and Clone

```typescript
const smartClone = async (url: string, dest: string) => {
  const hasSsh = Boolean(process.env.SSH_AUTH_SOCK);
  const hasToken = Boolean(process.env.GITHUB_TOKEN);

  let finalUrl = url;
  const env = { ...process.env };

  if (url.includes("github.com") && hasToken) {
    // Use token for HTTPS
    finalUrl = url.replace(
      "https://github.com/",
      `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/`
    );
  }

  if (hasSsh) {
    env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
  }

  env.GIT_TERMINAL_PROMPT = "0";

  const proc = Bun.spawn(["git", "clone", finalUrl, dest], { env });
  return (await proc.exited) === 0;
};
```

### Clone with Fallback

```typescript
const cloneWithFallback = async (url: string, dest: string) => {
  // Try full clone first
  let proc = Bun.spawn(["git", "clone", url, dest], {
    timeout: 30000,
  });

  if ((await proc.exited) === 0) {
    return true;
  }

  // Fallback to shallow clone
  console.log("Full clone failed, trying shallow clone...");
  proc = Bun.spawn(["git", "clone", "--depth", "1", url, dest]);

  return (await proc.exited) === 0;
};
```

## Performance Tips

1. **Use shallow clones** for one-off operations
   ```bash
   git clone --depth 1 <url> <dest>
   ```

2. **Use sparse checkout** for large repos with specific paths
   ```bash
   git clone --no-checkout <url>
   cd <dest> && git sparse-checkout set <path>
   ```

3. **Cache bare repositories** for repeated use
   ```bash
   git clone --bare <url> <cache>/.git
   ```

4. **Set reasonable timeouts**
   ```typescript
   { timeout: 60000 } // 60 second timeout
   ```

5. **Parallelize independent clones**
   ```typescript
   await Promise.all([clone1, clone2, clone3]);
   ```

## Bun-Specific Notes

- `Bun.shell` uses template literals for safe variable escaping
- `Bun.spawn` is 60% faster than Node.js for small processes
- Use async/await for non-blocking operations
- Stream API for large operations (`.stream()`)
- Always specify `timeout` for network operations
- `cwd` option more reliable than `cd` in command

## Common Gotchas

1. **Spaces in paths**: Use template literals, not string concat
   ```typescript
   await Bun.shell`git clone ${url} ${"path with spaces"}` // OK
   ```

2. **SSH vs HTTPS**: Ensure SSH agent is running or use HTTPS with token
   ```bash
   eval $(ssh-agent -s)
   ssh-add ~/.ssh/id_rsa
   ```

3. **Large repos**: Use `--depth 1` or sparse checkout
   ```typescript
   { timeout: 120000 } // Increase timeout for large repos
   ```

4. **Interactive prompts**: Always set `GIT_TERMINAL_PROMPT=0`
   ```typescript
   env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
   ```

5. **Cleanup**: Always remove temporary directories
   ```typescript
   rmSync(tmpDir, { recursive: true });
   ```

---

## Testing Checklist

- [ ] Clone from public GitHub repo
- [ ] Clone with SSH authentication
- [ ] Clone with HTTPS token
- [ ] Shallow clone (--depth 1)
- [ ] Sparse checkout
- [ ] Cache hit and miss
- [ ] Timeout behavior
- [ ] Error handling (404, auth failed, etc.)
- [ ] Large repository handling
- [ ] Concurrent operations

