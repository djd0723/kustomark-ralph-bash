# Git Operations Research - Executive Summary

## Quick Answer

For implementing git operations in Kustomark (Bun/TypeScript), **use shell commands via Bun.spawn** instead of libraries.

## Why Shell Commands?

✅ **Full sparse checkout support** - Native `git sparse-checkout` command
✅ **Complete authentication** - SSH keys, HTTPS tokens, credential helpers
✅ **Best Bun compatibility** - No native module compilation issues
✅ **Highest performance** - Direct git binary, no library overhead
✅ **All git features** - Access to every git capability
✅ **Easy maintenance** - Standard commands, simple debugging

## Library Comparison at a Glance

| Library | Verdict | Key Issue |
|---------|---------|-----------|
| **Shell Commands** | ✅ Recommended | None - best option |
| **simple-git** | ⚠️ Okay | Adds overhead, limited sparse checkout |
| **isomorphic-git** | ❌ Not Suitable | No SSH support, Bun issues |
| **nodegit** | ❌ Not Suitable | Poor Bun compatibility, complex install |

## Critical Limitations Found

### isomorphic-git
- ❌ **NO SSH support** - HTTPS only (dealbreaker for many repos)
- ❌ Reported issues with Bun (clone operations hang)
- ⚠️ Limited sparse checkout (only `filepaths` parameter)
- Slower performance (pure JavaScript implementation)

### nodegit
- ❌ **Poor Bun compatibility** - Native C++ bindings fail with Bun
- ❌ Complex installation - Requires build tools, common failures
- ⚠️ Limited sparse checkout (libgit2 limitations)
- Overkill for basic clone/fetch operations

### simple-git
- Still requires git binary (no advantage over direct commands)
- Limited sparse checkout API (must use `.raw()` anyway)
- Adds abstraction overhead without major benefits

## Quick Start Code

```typescript
import { spawn } from "bun";
import { mkdir, rm } from "fs/promises";

async function sparseCheckout(
  url: string,
  ref: string,
  paths: string[],
  targetDir: string
): Promise<void> {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  // Initialize
  await spawn({ cmd: ["git", "init"], cwd: targetDir }).exited;
  await spawn({ cmd: ["git", "remote", "add", "origin", url], cwd: targetDir }).exited;

  // Configure sparse checkout
  await spawn({ cmd: ["git", "config", "core.sparseCheckout", "true"], cwd: targetDir }).exited;
  await spawn({ cmd: ["git", "sparse-checkout", "set", ...paths], cwd: targetDir }).exited;

  // Fetch and checkout
  await spawn({ cmd: ["git", "fetch", "--depth=1", "origin", ref], cwd: targetDir }).exited;
  await spawn({ cmd: ["git", "checkout", "FETCH_HEAD"], cwd: targetDir }).exited;
}

// Usage
await sparseCheckout(
  "https://github.com/user/repo.git",
  "main",
  ["docs/", "*.md"],
  "./my-repo"
);
```

## Authentication Examples

### SSH
```typescript
const env = {
  GIT_SSH_COMMAND: "ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no"
};
```

### HTTPS with Token
```typescript
const url = `https://token:${process.env.GITHUB_TOKEN}@github.com/user/repo.git`;
```

### System Credentials
```typescript
// Git automatically uses configured credential helpers
await spawn({ cmd: ["git", "clone", url, dir] }).exited;
```

## Performance Optimization

1. **Shallow clones**: `--depth=1` for 90% size reduction
2. **Sparse checkout**: Only fetch needed directories
3. **Caching**: Reuse cloned repos with TTL
4. **Parallel operations**: Clone multiple repos concurrently

## Implementation Checklist

- [ ] Create `GitOperations` class using Bun.spawn
- [ ] Implement sparse checkout support
- [ ] Add SSH and HTTPS authentication
- [ ] Implement caching with TTL
- [ ] Add comprehensive error handling
- [ ] Integrate with resource-resolver.ts
- [ ] Write tests with real repositories

## Files Created

1. **GIT_LIBRARIES_COMPARISON.md** - Detailed analysis of all options
2. **GIT_CODE_EXAMPLES.md** - Ready-to-use code implementations
3. **GIT_OPERATIONS_RESEARCH.md** - Existing comprehensive guide (already present)
4. **GIT_RESEARCH_SUMMARY.md** - This summary document

## Next Steps

1. Review the code examples in `GIT_CODE_EXAMPLES.md`
2. Implement the `GitOperations` class in `src/core/git-operations.ts`
3. Update `resource-resolver.ts` to use git operations (replace TODO at line 130)
4. Add tests for git operations
5. Update CLI to support `--no-cache` and `--force-update` flags

## Key Takeaways

1. **Avoid library abstractions** - They add overhead without benefits for our use case
2. **isomorphic-git is not viable** - No SSH support, Bun compatibility issues
3. **nodegit is not viable** - Build issues, poor Bun compatibility
4. **Shell commands provide everything we need** - Performance, features, compatibility
5. **Bun.spawn is optimal** - 60% faster than Node.js, native TypeScript support

## Sources

Research based on comprehensive analysis of:
- npm package statistics and comparisons
- Official documentation for all libraries
- Bun compatibility reports
- Git documentation for sparse checkout and authentication
- Performance benchmarks

All sources documented in `GIT_LIBRARIES_COMPARISON.md`.

---

**Recommendation**: Proceed with shell commands via Bun.spawn. This approach provides the best combination of features, performance, and maintainability for Kustomark's requirements.
