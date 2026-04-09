# Future & Deferred Features

Features not in the current roadmap, with rationale.

## Recently Implemented

These features were previously deferred but have now been implemented.

### Conditional Patches

**Status**: Implemented

Apply patches based on file content and frontmatter conditions.

```yaml
- op: replace
  old: "foo"
  new: "bar"
  when:
    fileContains: "production"
```

**Implementation Details**:
- Deterministic evaluation based on file content only
- Per-file condition evaluation (no global state)
- Supports: `fileContains`, `fileMatches`, `frontmatterEquals`, `frontmatterExists`
- Logical operators: `not`, `anyOf`, `allOf`
- Fully tested with 50+ test cases
- Documented in README with comprehensive examples

**Use Cases**:
- Environment-specific patches (production, staging, development)
- Content-aware transformations
- Security level based content masking
- Version-specific documentation
- Platform-specific instructions

See [README - Conditional Patches](../README.md#conditional-patches) for full documentation.

## Deferred: Interactive Features

**Status**: IMPLEMENTED (All features below have been completed)

### Interactive Debug Mode

**Status**: Implemented

Step-through patch application with keyboard input.

**Implementation Details**:
- Interactive prompt-based debugging with (a)pply, (s)kip, (q)uit options
- File preview and patch details at each step
- Auto-apply mode with decision persistence (--auto-apply, --save-decisions, --load-decisions)
- Non-interactive execution for automation workflows
- Graceful cancellation support (Ctrl+C)

See [README - Debug Command](../README.md#kustomark-debug) for full documentation.

### Interactive Init Wizard

**Status**: Implemented

Prompt-based config creation with beautiful CLI UX.

**Implementation Details**:
- Config type selection (base vs overlay)
- Output directory and base config prompts
- Resource pattern multiselect
- Optional starter patches with 6 common operations
- Input validation and file existence checks
- Graceful cancellation at any step
- Backward compatible with non-interactive mode (--base, --output flags)

See [README - Init Command](../README.md#kustomark-init) for full documentation.

### Script Hooks (exec operation)

**Status**: Implemented

Execute shell scripts as part of the patch pipeline.

```yaml
- op: exec
  command: "./transform.sh"
  timeout: 5000  # Optional, defaults to 5000ms
```

**Implementation Details**:
- Deterministic script execution with configurable timeout
- Uses Bun.spawn for process execution
- Timeout enforcement (default 5s, configurable)
- Full stdin/stdout/stderr handling
- Exit code checking and error handling
- Tested with 20+ test cases

**Use Cases**:
- Custom transformations via external scripts
- Integration with existing tooling
- Complex text processing that's easier in bash/python/etc
- Code generation and formatting

**Security Considerations**:
- Scripts have full system access (use with trusted scripts only)
- Timeout prevents runaway processes
- Exit code validation ensures script success

See implementation in `src/core/patch-engine.ts` (applyExec function).

### Plugin System

**Status**: Implemented

User-defined patch operations via JavaScript/TypeScript plugins.

**Implementation Details**:
- Complete plugin infrastructure (`plugin-types.ts`, `plugin-loader.ts`, `plugin-executor.ts`)
- SHA256-based cache invalidation
- Checksum verification for security
- Dynamic import() supports both ESM and CommonJS
- 30s default timeout with configurable override
- 7 custom error classes for detailed diagnostics
- 77 comprehensive tests with 149 assertions

**Use Cases**:
- Organization-specific patch operations
- Complex transformations requiring full programming capability
- Reusable custom operations across projects
- Integration with external APIs or databases

**Security Model**:
- Trust-based: Plugins have full system access
- Checksum verification ensures plugin integrity
- Plugin discovery from local paths or npm packages

See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for complete plugin system documentation and examples.

## Deferred: Complexity

### Full AST Parsing

Parse markdown into full AST for semantic manipulation.

**Rationale**: Complexity, fragility, overkill for most patches.

**Current approach**: Parse headers for sections; string ops for rest.

## Not Planned

Features that conflict with core design principles.

### AI/LLM Transforms

```yaml
- op: ai-transform
  prompt: "Rewrite in TypeScript"
```

**Rationale**: Non-deterministic by nature. Conflicts with core principle.

**Alternative**: Use AI to author deterministic patches once.

### Environment Variable Templating

```yaml
- op: replace
  old: "${OLD_VALUE}"
  new: "${NEW_VALUE}"
```

**Rationale**: Hidden dependencies, breaks determinism.

**Alternative**: Use separate config files per environment.

### Bidirectional Sync

Push changes back to upstream.

**Rationale**: Violates the consumption model; unclear semantics.

### Multi-Format Support

**Status**: Fully Implemented (JSON/YAML/TOML)

`json-set`, `json-delete`, and `json-merge` operations work on `.json`, `.yaml`, `.yml`, and `.toml` files.
TOML support uses `Bun.TOML.parse()` (built-in) for parsing and `smol-toml` for serialization.

See `src/core/patch-engine.ts` (`applyJsonSet`, `applyJsonDelete`, `applyJsonMerge`).

## Future Candidates

**Status**: ALL IMPLEMENTED ✅

All features listed below have been successfully implemented and are now part of the core kustomark toolset.

| Feature | Complexity | Status | Notes |
|---------|------------|--------|-------|
| Interactive debug mode | Medium | ✅ COMPLETE | PTY-based step-through with decision persistence |
| Interactive init wizard | Low | ✅ COMPLETE | Prompt-based setup with @clack/prompts |
| Patch inheritance (extend by ID) | Medium | ✅ COMPLETE | Single/multiple parent inheritance with field merging |
| Patch groups (enable/disable) | Medium | ✅ COMPLETE | --enable-groups and --disable-groups flags |
| Parallel builds | Medium | ✅ COMPLETE | --parallel and --jobs=N flags with concurrency control |
| Incremental builds | High | ✅ COMPLETE | --incremental with SHA256-based change detection |
| Build cache | High | ✅ COMPLETE | Project-local .kustomark/build-cache.json |
| LSP server | High | ✅ COMPLETE | Full IDE integration with autocomplete, diagnostics, hover |
| Web UI | High | ✅ COMPLETE | React-based visual editor with live preview |
| Template system | Medium | ✅ COMPLETE | Built-in templates with template list/show/apply/init |

See [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for detailed implementation notes and [README.md](../README.md) for usage documentation.
