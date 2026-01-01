# Kustomark Implementation Plan

## Status: Starting M1 (MVP)

This document tracks the implementation of kustomark based on the spec milestones.

## M1: MVP - Local sources, core patches, CLI

### Priority Order

1. **[IN PROGRESS] Project Setup & Foundation**
   - Initialize TypeScript project with Bun
   - Setup project structure (core library, CLI)
   - Configure linting, testing, build
   - Setup CI/CD basics

2. **[TODO] Core Library - Config Parsing**
   - Parse YAML config schema
   - Validate required fields (apiVersion, kind, output, resources)
   - Support glob patterns in resources
   - Support resource negation with `!`
   - Support recursive kustomark config loading
   - Implement onNoMatch handling (skip|warn|error)

3. **[TODO] Core Library - Resource Resolution**
   - Resolve file globs to actual files
   - Resolve references to other kustomark configs
   - Build resource resolution tree (base → overlay → overlay)
   - Merge resources in order (last wins for conflicts)

4. **[TODO] Core Library - Patch Engine**
   - Implement `replace` operation
   - Implement `replace-regex` operation with flags support
   - Implement `remove-section` operation with GitHub-style slug parsing
   - Implement `replace-section` operation
   - Implement `prepend-to-section` and `append-to-section` operations
   - Support patch filtering (include/exclude globs)
   - Support per-patch onNoMatch override

5. **[TODO] Core Library - Diff Generation**
   - Generate unified diff format
   - Track which patches were applied
   - Track warnings (patches with no matches)

6. **[TODO] CLI Layer - Commands**
   - Implement `kustomark build [path]` command
   - Implement `kustomark diff [path]` command
   - Implement `kustomark validate [path]` command
   - Handle exit codes (0=success, 1=error/changes)

7. **[TODO] CLI Layer - Output Formatting**
   - Implement text output format (default)
   - Implement JSON output format (`--format=json`)
   - Support verbosity flags (`-v`, `-vv`, `-vvv`, `-q`)
   - Support `--clean` flag for build command

8. **[TODO] Testing**
   - Unit tests for config parsing
   - Unit tests for patch operations
   - Integration tests with temp directories
   - Test CLI exit codes
   - Test JSON output parsing
   - Test file comparison

9. **[TODO] Documentation**
   - CLI help text
   - Basic README with examples
   - API documentation for core library

## M2: Enhanced Operations (Future)
- Frontmatter operations
- Line operations
- Advanced validation

## M3: Remote Sources (Future)
- Git support
- HTTP support
- Caching
- Lock files

## M4: Developer Experience (Future)
- Watch mode
- Explain command
- Lint command
- Init command

## Current Focus
Starting with item #1: Project Setup & Foundation
