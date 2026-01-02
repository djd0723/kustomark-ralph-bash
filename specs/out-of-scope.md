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

Current focus is non-interactive CLI for automation. Interactive features may come later.

### Interactive Debug Mode

Step-through patch application with keyboard input.

**Current alternative**: Use `--format=json` with verbose flags.

### Interactive Init Wizard

Prompt-based config creation.

**Current alternative**: Use explicit flags: `kustomark init --base ../company/`

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

| Feature | Complexity | Notes |
|---------|------------|-------|
| Interactive debug mode | Medium | PTY-based step-through |
| Interactive init wizard | Low | Prompt-based setup |
| Patch inheritance (extend by ID) | Medium | |
| Patch groups (enable/disable) | Medium | |
| Parallel builds | Medium | |
| Incremental builds | High | |
| Build cache | High | |
| LSP server | High | IDE integration |
| Web UI | High | Visual patch editor |
