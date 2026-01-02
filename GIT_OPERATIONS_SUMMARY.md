# Git Operations Research Summary

## Overview

This research covers implementing git operations for Kustomark, a TypeScript/Bun-based markdown patching tool. The documentation provides comprehensive guidance on running git commands, handling authentication, implementing caching, and integrating with the existing codebase.

## Key Findings

### 1. Running Git Commands in Bun

**Best Approach: `Bun.shell()` with Template Literals**

```typescript
const result = await Bun.shell`git clone ${url} ${dest}`.text();
```

**Advantages:**
- Safe variable escaping (prevents injection attacks)
- Modern async/await API
- Multiple output formats (text, bytes, json, stream)
- Cleaner syntax than `Bun.spawn()`

**Alternative: `Bun.spawn()` for Advanced Control**
- Fine-grained I/O stream handling
- Process monitoring and timeout control
- Inter-process communication (IPC)
- Performance: 60% faster than Node.js

### 2. Best Practices for Shell Commands

#### Error Handling
- Always check `exitCode` after process execution
- Capture stderr separately for detailed error messages
- Classify errors (auth, network, repo not found, etc.)
- Provide actionable error messages to users

#### Argument Escaping
- Use template literals with `Bun.shell` for automatic escaping
- Use array format with `Bun.spawn` for clarity
- Avoid string concatenation for variable interpolation

#### Working Directory Context
- Use `cwd` option in spawn for cleaner code
- Or use `cd dir && command` in shell for simplicity

#### Timeouts
- Set explicit timeouts for network operations (30-120 seconds)
- Use `killSignal` to specify termination behavior
- Implement retry logic with exponential backoff

#### Environment Variables
- Always set `GIT_TERMINAL_PROMPT=0` to disable interactive prompts
- Pass `SSH_AUTH_SOCK` for SSH agent support
- Include existing env vars with `...process.env`

### 3. Git Credentials and Authentication

**Three Main Methods:**

#### SSH (Recommended for SSH URLs)
```typescript
// Requirements:
// 1. SSH key at ~/.ssh/id_rsa (or other standard location)
// 2. SSH agent running (export SSH_AUTH_SOCK set)

const env = {
  ...process.env,
  SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
};
```

#### HTTPS with Token (Recommended for CI/CD)
```typescript
const token = process.env.GITHUB_TOKEN;
const url = `https://${token}@github.com/user/repo.git`;

const env = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
};
```

#### Credential Helpers (macOS, Windows)
```typescript
// Automatic via osxkeychain, manager-core, etc.
// No special configuration needed if helper is installed
```

**Detection Strategy:**
1. Check SSH agent available (`SSH_AUTH_SOCK`)
2. Check for SSH key file
3. Check for git credential helper
4. Check for environment token
5. Fall back to interactive prompt (if allowed)

### 4. Repository Caching Strategy

**Recommended Structure:**
```
~/.cache/kustomark/git/
├── github.com/
│   ├── org1/
│   │   ├── repo1/
│   │   │   ├── .git/          # Bare git repository
│   │   │   └── metadata.json   # Cache metadata
│   │   └── repo2/
│   └── ...
└── gitlab.com/
    └── ...
```

**Cache Metadata Format:**
```typescript
{
  version: "1",
  url: "https://github.com/user/repo.git",
  protocol: "https",
  host: "github.com",
  org: "user",
  repo: "repo",
  ref: "main",                    // Requested ref
  resolvedRef: "abc123...",       // Actual commit hash
  lastFetched: 1704067200000,
  lastAccessed: 1704153600000,
  expiresAt: 1712000000000,       // 30 days default
}
```

**Operations:**
- **Get or Create**: Use cached version if valid, otherwise clone
- **Update**: Fetch latest from remote while keeping cache
- **Validate**: Check expiration and git directory integrity
- **Extract**: Use `git archive` to extract specific paths
- **Clean**: Remove expired caches periodically

**Performance Benefits:**
- Repeated operations reuse cache (no re-cloning)
- Large repos cached as bare repositories (smaller)
- Sparse checkout for specific subdirectories
- Shallow clones for one-off operations
- Automatic expiration prevents stale data

### 5. Error Handling Patterns

**Classification Approach:**
```typescript
// Group errors by category
- SSH_PERMISSION_DENIED: "SSH key permission issue"
- AUTH_REQUIRED: "HTTPS credentials needed"
- REPO_NOT_FOUND: "Repository doesn't exist or no access"
- CONNECTION_REFUSED: "Network issue"
- TIMEOUT: "Operation took too long"
```

**Retry Strategy:**
- Retryable: Connection errors, timeouts, temporary failures
- Non-retryable: Auth failures, invalid URLs, repo not found
- Exponential backoff: 1s, 2s, 4s, 8s between attempts
- Max 3 attempts by default

**User-Friendly Messages:**
```
"SSH key permission denied. Check your SSH configuration."
"HTTPS authentication required. Configure git credentials or use SSH."
"Repository not found. Check URL and permissions."
"Connection lost during clone. Try again or use shallow clone."
```

## Implementation Roadmap for Kustomark

### Phase 1: Foundation (Priority: NOW)
1. Create `src/core/git-operations.ts`
   - `cloneRepository()`
   - `fetchRepository()`
   - `checkoutRef()`
   - `resolveRef()`
   - Comprehensive error handling

2. Create `src/core/git-errors.ts`
   - Custom error types
   - Error classification

3. Add tests for all operations

### Phase 2: Authentication (Priority: HIGH)
1. Create `src/core/git-auth.ts`
   - `detectAuthMethods()`
   - `suggestAuthMethod()`
   - `configureAuth()`

2. Integrate detection into operations

3. Add tests for each auth method

### Phase 3: Caching (Priority: HIGH)
1. Create `src/core/git-cache.ts`
   - `getCachePath()`
   - `isCacheValid()`
   - `getOrCreateCache()`
   - `updateCache()`
   - `extractFromCache()`
   - `cleanExpiredCaches()`

2. Integrate into resource resolver

3. Add cache management CLI commands

### Phase 4: Integration (Priority: MEDIUM)
1. Update `src/core/resource-resolver.ts`
   - Replace git URL TODO with actual implementation
   - Use caching for repeated URLs

2. Update `src/cli/index.ts`
   - Add `fetch` command
   - Add cache management commands
   - Add flags: `--no-cache`, `--force-update`

3. Update CLI help text

### Phase 5: Testing & Documentation (Priority: MEDIUM)
1. Unit tests for all modules
2. Integration tests with real repositories
3. Performance benchmarks
4. Update README with git examples
5. Create troubleshooting guide

## Integration Points in Existing Code

### File: `src/core/resource-resolver.ts` (Line 130-140)
Replace TODO comment with actual git resolution using cache

### File: `src/core/config-parser.ts`
Validate git URLs during config parsing (already has `parseGitUrl`)

### File: `src/core/types.ts`
Extend with git-specific types (caching, auth options)

### File: `src/cli/index.ts`
Add fetch command and cache management commands

## Key Recommendations

### 1. For Development
- Start with simple clone/fetch operations
- Add error handling before caching
- Use small test repositories initially
- Test both SSH and HTTPS paths
- Set up CI/CD pipeline for testing

### 2. For Performance
- Use `--depth 1` for one-off clones (5-10x faster)
- Implement caching (avoid repeated clones)
- Use sparse checkout for large repos with specific paths
- Cache as bare repositories (saves space)
- Set reasonable timeouts (60s for normal, 120s for large)

### 3. For Security
- Always disable interactive prompts (`GIT_TERMINAL_PROMPT=0`)
- Use HTTPS with tokens over SSH in CI/CD
- Don't hardcode credentials in logs
- Validate URLs before operations
- Escape variables properly (use template literals)

### 4. For User Experience
- Detect available auth methods automatically
- Provide clear error messages
- Show progress for long operations
- Add cache statistics command
- Document troubleshooting steps

### 5. For Testing
- Use public test repositories (octocat/Hello-World)
- Mock git operations in unit tests
- Test with real repos in integration tests
- Cover error cases (404, auth failure, timeout)
- Test concurrent operations
- Benchmark performance improvements

## Bun-Specific Advantages

1. **Native Shell API**: `Bun.shell()` with template literals
2. **Fast Process Spawning**: 60% faster than Node.js
3. **Excellent TypeScript Support**: Zero-config setup
4. **Minimal Dependencies**: No extra packages needed
5. **Small Binary Size**: Good for distribution
6. **Built-in Testing**: `bun test` framework
7. **Fast Bundling**: Quick build and rebuild times

## Existing Codebase Analysis

### Current Patterns Used

1. **Error Handling**
   - Custom error classes with context
   - Error messages with field names
   - Chaining with `cause` parameter

2. **Type Safety**
   - Strict TypeScript config (`strict: true`)
   - No `any` types (using `unknown` instead)
   - Explicit interface definitions
   - Union types for error states

3. **File Operations**
   - Using `node:fs` and `node:path`
   - Absolute path normalization
   - Directory scanning with pattern matching
   - File content as strings in memory (fileMap pattern)

4. **Testing**
   - Unit tests with fixtures
   - Integration tests with real examples
   - Test-driven approach for new features
   - Comprehensive coverage expectations

### Recommended Patterns for Git Operations

1. **Follow existing error class pattern**
   - `GitOperationError extends Error`
   - Include error code and stderr

2. **Use existing ResourceResolutionError style**
   - Custom error class with context
   - Resource identifier for debugging

3. **Mirror existing async patterns**
   - Promise-based operations
   - Comprehensive error messages
   - Proper cleanup/teardown

4. **Maintain strict TypeScript**
   - No `any` types
   - Explicit interfaces
   - Type-safe error handling

## Quick Reference

### Common Commands

```typescript
// Clone
await Bun.shell`git clone ${url} ${dest}`;

// Fetch updates
await Bun.shell`cd ${repo} && git fetch origin`;

// Checkout ref
await Bun.shell`cd ${repo} && git checkout ${ref}`;

// List tags
const tags = await Bun.shell`cd ${repo} && git tag`.text();

// Get current commit
const commit = await Bun.shell`cd ${repo} && git rev-parse HEAD`.text();

// Extract subdirectory
await Bun.shell`cd ${repo} && git archive ${ref} ${subpath} | tar -x -C ${dest}`;
```

### Common Patterns

```typescript
// Error handling
if (process.exitCode !== 0) {
  throw new Error(`Git failed: ${stderr}`);
}

// Timeout
{ timeout: 60000, killSignal: "SIGTERM" }

// Working directory
{ cwd: repoPath }

// Environment
env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }

// Retry with backoff
for (let i = 1; i <= maxAttempts; i++) {
  await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
}
```

## Documentation Files Created

1. **GIT_OPERATIONS_RESEARCH.md** - Comprehensive research guide
   - All 5 research topics covered in depth
   - Code examples for each section
   - Bun-specific recommendations

2. **GIT_IMPLEMENTATION_GUIDE.md** - Ready-to-implement code
   - Complete `git-operations.ts` module
   - Complete `git-auth.ts` module
   - Complete `git-cache.ts` module
   - Integration points and CLI commands

3. **GIT_QUICK_START.md** - Quick reference guide
   - One-page cheat sheet
   - Common commands and patterns
   - Practical examples
   - Testing checklist

## Next Steps

1. Review research documents
2. Create git-operations.ts with basic operations
3. Add comprehensive error handling
4. Implement git-auth.ts for credential detection
5. Implement git-cache.ts for caching
6. Integrate into resource resolver
7. Add CLI commands for fetch and cache management
8. Add tests for all operations
9. Update documentation with examples
10. Performance benchmarking

## Questions Answered

1. **How to run git commands?**
   - Use `Bun.shell` with template literals (recommended)
   - Or `Bun.spawn` for advanced control

2. **Best practices for shell commands?**
   - Set timeouts, handle errors, disable prompts
   - Use template literals for safe escaping
   - Implement retry logic for network operations

3. **How to detect and use system credentials?**
   - Check `SSH_AUTH_SOCK` for SSH agent
   - Check `~/.ssh/id_rsa` for SSH key
   - Check env vars for GitHub token
   - Use system credential helpers

4. **How to implement caching?**
   - Store in `~/.cache/kustomark/git/`
   - Use bare repositories for efficiency
   - Track metadata with timestamps
   - Auto-expire after 30 days

5. **Error handling patterns?**
   - Classify errors by type
   - Implement retry logic
   - Provide actionable messages
   - Log details for debugging

