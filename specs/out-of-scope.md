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

## Deferred: Complexity

### Script Hooks

```yaml
- op: exec
  command: "./transform.sh"
```

**Rationale**: Non-deterministic, security considerations, portability.

### Plugin System

User-defined patch operations.

**Rationale**: API design complexity, security, ecosystem maintenance.

**Current alternative**: Request operations via issues; add to core if common.

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

Patch YAML, JSON, TOML.

**Rationale**: Scope creep. Tools exist (yq, jq). Kustomark is markdown-specific.

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
