# Git Operations - Visual Implementation Guide

Visual diagrams and flowcharts for understanding git operations in Kustomark.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kustomark                                │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  CLI Layer (src/cli/index.ts)                          │   │
│  │  - build, diff, validate, fetch, cache commands        │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │  Resource Resolver (src/core/resource-resolver.ts)    │   │
│  │  - Resolves local files                                │   │
│  │  - Handles git URLs via git-operations                 │   │
│  │  - Uses cache for git resources                        │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │  Patch Engine (src/core/patch-engine.ts)               │   │
│  │  - Applies patches to resolved resources               │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │  Output Generation                                      │   │
│  │  - Writes files to output directory                    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Git Operations Layer (NEW)                            │   │
│  │                                                         │   │
│  │  ┌─────────────────┬────────────────┬──────────────┐  │   │
│  │  │ git-operations  │ git-auth       │ git-cache    │  │   │
│  │  │                 │                │              │  │   │
│  │  │ - Clone         │ - Detect SSH   │ - Store in   │  │   │
│  │  │ - Fetch         │ - Detect HTTPS │   cache/     │  │   │
│  │  │ - Checkout      │ - Detect tokens│ - Metadata   │  │   │
│  │  │ - Resolve       │ - Configure    │ - Expiration │  │   │
│  │  │ - Extract       │   env vars     │ - Extract    │  │   │
│  │  └─────────────────┴────────────────┴──────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │  External: Git (via Bun.shell/Bun.spawn)              │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Cache Storage: ~/.cache/kustomark/git/                │   │
│  │  System Storage: Project files + output/                │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Git Resource Resolution Flow

```
Resource URL (from config)
    │
    ├─ Is it a git URL? (isGitUrl)
    │   │
    │   ├─ NO: Local file/glob pattern
    │   │   ├─ Glob match
    │   │   └─ Read from filesystem
    │   │
    │   └─ YES: Git URL
    │       ├─ Parse git URL (parseGitUrl)
    │       │
    │       ├─ Detect auth (detectAuthMethods)
    │       │
    │       ├─ Check cache (getCacheInfo)
    │       │   ├─ Cache valid? → Use cached version
    │       │   │   ├─ Resolve ref to commit
    │       │   │   └─ Extract files from cache
    │       │   │
    │       │   └─ Cache invalid → Clone new
    │       │       ├─ Initialize cache
    │       │       ├─ Resolve ref
    │       │       └─ Extract files
    │       │
    │       └─ Add resolved files to resources
    │
    ▼
Resolved Resources (Map<filename, content>)
    │
    ├─ Apply patches
    │
    ├─ Run validators
    │
    └─ Write output files
```

## Authentication Decision Tree

```
User wants to clone a git repository
    │
    ├─ Is URL SSH? (git@github.com:...)
    │   │
    │   └─ YES
    │       ├─ Check SSH agent available?
    │       │   └─ YES: Use SSH agent (preferred)
    │       │   └─ NO: Need passphrase prompt (less ideal)
    │       │
    │       └─ FAILED: Try HTTPS as fallback
    │
    ├─ Is URL HTTPS? (https://github.com/...)
    │   │
    │   └─ YES
    │       ├─ Check GitHub token available?
    │       │   └─ YES: Use token auth (preferred for CI/CD)
    │       │
    │       ├─ Check credential helper available?
    │       │   └─ YES: Use credential helper (good)
    │       │
    │       ├─ Check GitHub CLI available?
    │       │   └─ YES: Use gh auth (good)
    │       │
    │       └─ Fallback: Interactive prompt (not ideal for automation)
    │
    ▼
Git operation with configured auth
```

## Caching Architecture

```
Requested Git Resource
    │
    ├─ Parse URL
    │   └─ Extract: host, org, repo
    │
    ├─ Calculate cache path
    │   └─ ~/.cache/kustomark/git/{host}/{org}/{repo}/
    │
    ├─ Check if cache exists and is valid
    │   │
    │   ├─ YES: Cache hit
    │   │   │
    │   │   ├─ Load metadata
    │   │   │
    │   │   ├─ Check expiration (30 days default)
    │   │   │   └─ Expired? → Clean up
    │   │   │
    │   │   ├─ Fetch updates (optional with --force-update)
    │   │   │
    │   │   ├─ Resolve ref to commit hash
    │   │   │
    │   │   ├─ Extract files using git archive
    │   │   │   └─ Use tar to extract
    │   │   │
    │   │   └─ Return extracted files
    │   │
    │   ├─ NO: Cache miss
    │   │   │
    │   │   ├─ Clone repo to cache (bare repository)
    │   │   │   └─ git clone --bare <url> <cache>/.git
    │   │   │
    │   │   ├─ Create metadata.json with timestamps
    │   │   │
    │   │   ├─ Resolve ref to commit hash
    │   │   │
    │   │   ├─ Extract files using git archive
    │   │   │
    │   │   └─ Return extracted files
    │   │
    │   └─ Periodic cleanup of expired caches
    │       └─ Clean every 1000+ cache operations
    │
    ▼
Extracted files ready for patching
```

## Error Handling Flow

```
Git Operation Executed
    │
    ├─ Check exit code
    │   │
    │   ├─ 0: Success ✓
    │   │   └─ Return result
    │   │
    │   ├─ Non-zero: Error
    │   │   │
    │   │   ├─ Parse stderr
    │   │   │
    │   │   ├─ Classify error
    │   │   │   ├─ "Permission denied" → SSH_AUTH_FAILED
    │   │   │   ├─ "could not read Username" → HTTPS_AUTH_REQUIRED
    │   │   │   ├─ "repository not found" → REPO_NOT_FOUND
    │   │   │   ├─ "Connection refused" → CONNECTION_ERROR
    │   │   │   ├─ "hung up unexpectedly" → NETWORK_ERROR
    │   │   │   └─ Other → UNKNOWN_ERROR
    │   │   │
    │   │   ├─ Decide if retryable
    │   │   │   ├─ Retryable: CONNECTION_ERROR, NETWORK_ERROR, TIMEOUT
    │   │   │   │   │
    │   │   │   │   ├─ Retry with exponential backoff
    │   │   │   │   │   └─ Attempt 1: wait 2s
    │   │   │   │   │   └─ Attempt 2: wait 4s
    │   │   │   │   │   └─ Attempt 3: wait 8s
    │   │   │   │   │
    │   │   │   │   └─ Max 3 attempts (configurable)
    │   │   │   │
    │   │   │   └─ Non-retryable: AUTH_FAILED, REPO_NOT_FOUND
    │   │   │       └─ Fail immediately with user message
    │   │   │
    │   │   └─ Generate user-friendly error message
    │   │       ├─ Problem description
    │   │       ├─ Suggested action
    │   │       └─ Command for debugging
    │   │
    │   └─ Return error result
    │
    ▼
Error handled appropriately
```

## Sequence Diagram: Clone with Cache

```
User                 CLI              Resource Resolver
  │                   │                      │
  ├─ build ────────────►│                      │
  │                   │                      │
  │                   ├─ resolveResources──►│
  │                   │                      │
  │                   │                ┌─ Check cache
  │                   │                │ valid? NO
  │                   │                │
  │                   │     ┌──────────────────┐
  │                   │     │  Git Operations  │
  │                   │     │                  │
  │                   │     ├─ getOrCreateCache
  │                   │     │     ├─ Clone repo
  │                   │     │     ├─ Save metadata
  │                   │     │     └─ Return path
  │                   │     │
  │                   │     ├─ resolveRef
  │                   │     │     └─ Get commit hash
  │                   │     │
  │                   │     └─ extractFiles
  │                   │          └─ git archive + tar
  │                   │
  │                   │◄─────── Extracted files
  │                   │
  │                   ├─ applyPatches
  │                   │
  │                   ├─ writeOutput
  │                   │
  ◄─────────────────────────── Success
```

## File Organization

```
src/
├── core/
│   ├── types.ts
│   │   └─ Export: ParsedGitUrl, GitResolutionOptions, etc.
│   │
│   ├── git-url-parser.ts (EXISTING)
│   │   ├─ isGitUrl(url): boolean
│   │   ├─ parseGitUrl(url): ParsedGitUrl | null
│   │   └─ Already integrated with resource-resolver.ts
│   │
│   ├── resource-resolver.ts (MODIFY)
│   │   └─ Lines 130-140: Replace git URL TODO with:
│   │      ├─ getOrCreateCache(parsedGit.fullUrl, parsedGit)
│   │      ├─ extractFromCache(cachePath, ref, subpath)
│   │      └─ Add resolved files to resolvedResources
│   │
│   ├── git-operations.ts (NEW)
│   │   ├─ executeGitCommand(args, options)
│   │   ├─ cloneRepository(url, dest, sparsePath?)
│   │   ├─ fetchRepository(repoPath, remote?)
│   │   ├─ checkoutRef(repoPath, ref)
│   │   ├─ resolveRef(repoPath, ref)
│   │   ├─ listTags(repoPath)
│   │   ├─ listBranches(repoPath, remote?)
│   │   ├─ isGitRepository(repoPath)
│   │   ├─ refExists(repoPath, ref)
│   │   ├─ pathExistsAtRef(repoPath, ref, path)
│   │   ├─ extractFiles(repoPath, ref, subpath, destPath)
│   │   ├─ getCurrentCommit(repoPath)
│   │   ├─ withRetry(operation, maxAttempts, delayMs)
│   │   └─ Errors: classifyCloneError(), etc.
│   │
│   ├── git-auth.ts (NEW)
│   │   ├─ hasSshAgent()
│   │   ├─ hasSshKey(keyPath?)
│   │   ├─ hasGithubCli()
│   │   ├─ hasCredentialHelper()
│   │   ├─ getGithubToken()
│   │   ├─ detectAuthMethods(): AuthDetectionResult
│   │   ├─ configureAuth(method): env vars
│   │   └─ suggestAuthMethod(url, detectionResult)
│   │
│   ├── git-cache.ts (NEW)
│   │   ├─ getCachePath(host, org, repo)
│   │   ├─ getCachePathFromParsed(parsed)
│   │   ├─ isCacheValid(cachePath, maxAgeMs?)
│   │   ├─ getCacheInfo(parsed)
│   │   ├─ initializeCache(url, parsed)
│   │   ├─ updateCache(cachePath)
│   │   ├─ resolveRefInCache(cachePath, ref)
│   │   ├─ extractFromCache(cachePath, ref, destPath, subpath?)
│   │   ├─ getOrCreateCache(url, parsed, options?)
│   │   ├─ cleanExpiredCaches()
│   │   └─ getCacheStats()
│   │
│   ├── patch-engine.ts (EXISTING - no changes)
│   │
│   ├── validators.ts (EXISTING - no changes)
│   │
│   ├── config-parser.ts (EXISTING - maybe update validation)
│   │
│   ├── diff-generator.ts (EXISTING - no changes)
│   │
│   ├── frontmatter-parser.ts (EXISTING - no changes)
│   │
│   └── index.ts (EXISTING - export new modules)
│
└── cli/
    └── index.ts (MODIFY)
        ├─ Add options: noCache, forceUpdate
        ├─ Update parseArgs() to handle new flags
        ├─ Add fetchCommand() for fetch command
        ├─ Update main() switch to handle 'fetch'
        ├─ Update help text
        └─ Add cache management commands
```

## Implementation Dependencies

```
New Module Dependencies:

git-operations.ts
    ├─ Depends on: node:fs, node:path, Bun API
    ├─ Uses: Bun.spawn
    ├─ Exports: Classes, interfaces, functions
    └─ No internal dependencies

git-auth.ts
    ├─ Depends on: node:fs, git-operations
    ├─ Uses: hasSshKey, hasGithubCli, executeGitCommand
    └─ Exports: Auth interfaces and detection functions

git-cache.ts
    ├─ Depends on: node:fs, node:path, git-operations
    ├─ Uses: executeGitCommand, refExists, getCurrentCommit
    ├─ Exports: Cache management functions
    └─ Uses interfaces from types.ts

Integration Points:

resource-resolver.ts (MODIFY)
    ├─ Uses: parseGitUrl (already imported)
    ├─ Add: getOrCreateCache from git-cache
    ├─ Add: extractFromCache from git-cache
    ├─ Add: executeGitCommand for fallback operations
    └─ No new dependencies

cli/index.ts (MODIFY)
    ├─ Add: getOrCreateCache from git-cache
    ├─ Add: detectAuthMethods from git-auth
    ├─ Add: cache cleanup functions from git-cache
    └─ Add: fetch command implementation

types.ts (EXTEND)
    ├─ Add: GitResolutionOptions interface
    ├─ Add: CacheMetadata interface
    ├─ Add: AuthDetectionResult interface
    └─ Extend: ParsedGitUrl (already exists)
```

## Memory and Performance Characteristics

```
Resource Usage by Operation:

Clone with Cache (Recommended):
├─ Memory: ~500 MB (bare git repo metadata)
├─ Disk: Variable per repo
├─ Network: ~5-30 MB (typical repo)
├─ Time: 5-60s (first), 1-5s (cached)
└─ Ideal for: Repeated operations, large repos

Shallow Clone (--depth 1):
├─ Memory: ~50-200 MB
├─ Disk: ~50-200 MB
├─ Network: ~1-10 MB
├─ Time: 1-10s
└─ Ideal for: One-off clones, CI/CD

Sparse Checkout:
├─ Memory: Variable (subdir only)
├─ Disk: Small (subdir only)
├─ Network: Minimal
├─ Time: 1-5s
└─ Ideal for: Large repos, specific paths

Extract from Cache:
├─ Memory: Small
├─ Disk: Small (extracted files only)
├─ Network: None
├─ Time: <1s
└─ Ideal for: Fast iteration, offline use

Concurrent Clones (N repos):
├─ Memory: N × 50-500 MB
├─ Network: Scales linearly
├─ Time: Same as single (parallel)
├─ Recommendation: Limit to 3-5 concurrent
└─ Use: Promise.all() with semaphore
```

## Testing Matrix

```
Git Operations Testing:

┌─────────────────┬──────────┬───────────┬──────────┬──────────┐
│ Operation       │ Local    │ SSH       │ HTTPS    │ Fallback │
├─────────────────┼──────────┼───────────┼──────────┼──────────┤
│ Clone           │ ✓        │ ✓         │ ✓        │ ✓        │
│ Fetch           │ ✓        │ ✓         │ ✓        │ ✓        │
│ Checkout        │ ✓        │ -         │ -        │ -        │
│ Resolve Ref     │ ✓        │ -         │ -        │ -        │
│ Extract Files   │ ✓        │ -         │ -        │ -        │
├─────────────────┼──────────┼───────────┼──────────┼──────────┤
│ Error Handling  │ ✓        │ ✓         │ ✓        │ ✓        │
│ Retry Logic     │ ✓        │ ✓         │ ✓        │ ✓        │
│ Timeout         │ ✓        │ ✓         │ ✓        │ ✓        │
├─────────────────┼──────────┼───────────┼──────────┼──────────┤
│ Cache Hit       │ ✓        │ -         │ -        │ -        │
│ Cache Miss      │ ✓        │ ✓         │ ✓        │ ✓        │
│ Cache Expire    │ ✓        │ -         │ -        │ -        │
└─────────────────┴──────────┴───────────┴──────────┴──────────┘

Auth Detection Tests:
├─ SSH Agent Present/Absent
├─ SSH Key Exists/Missing
├─ GitHub CLI Available/Not
├─ Credential Helper Present/Absent
├─ Token Available/Missing
└─ Fallback Behavior

Error Cases:
├─ Invalid URL
├─ Repository Not Found (404)
├─ Authentication Failed
├─ Network Timeout
├─ Large Repository
├─ Malformed Sparse Path
├─ Ref Not Found
└─ Disk Space Issues
```

## State Transitions

```
Resource Resolution States:

[Starting]
    ↓
[Parsing URL] ← Is git URL?
    ├─ NO → [Local Resolution]
    │        ↓
    │        [Complete]
    │
    └─ YES → [Parse Git URL]
             ↓
             [Check Cache]
             ├─ Valid → [Update if needed]
             │          ↓
             │          [Resolve Ref]
             │          ↓
             │          [Extract Files]
             │          ↓
             │          [Complete]
             │
             └─ Invalid → [Detect Auth]
                          ↓
                          [Clone Repo]
                          ├─ Success → [Initialize Cache]
                          │            ↓
                          │            [Resolve Ref]
                          │            ↓
                          │            [Extract Files]
                          │            ↓
                          │            [Complete]
                          │
                          └─ Fail → [Retry Logic]
                                   ├─ Retry? → [Clone Repo]
                                   └─ No → [Error]
                                           ↓
                                           [Complete with Error]
```

---

This visual guide complements the other documentation files. Use these diagrams alongside the detailed guides for better understanding.

