# Kustomark Implementation Plan

## Status: M1 Complete ✅ | M2 In Progress (Frontmatter ✅, Line Ops ✅)

This document tracks the implementation of kustomark based on the spec milestones.

## M1: MVP - Local sources, core patches, CLI

### Priority Order

1. **[DONE] Project Setup & Foundation** ✅
   - ✅ Initialize TypeScript project with Bun
   - ✅ Setup project structure (core library, CLI)
   - ✅ Configure linting, testing, build
   - ⏳ Setup CI/CD basics (deferred)

2. **[DONE] Core Library - Config Parsing** ✅
   - ✅ Parse YAML config schema
   - ✅ Validate required fields (apiVersion, kind, output, resources)
   - ✅ Support glob patterns in resources
   - ✅ Support resource negation with `!`
   - ✅ Support recursive kustomark config loading
   - ✅ Implement onNoMatch handling (skip|warn|error)

3. **[DONE] Core Library - Resource Resolution** ✅
   - ✅ Resolve file globs to actual files
   - ✅ Resolve references to other kustomark configs
   - ✅ Build resource resolution tree (base → overlay → overlay)
   - ✅ Merge resources in order (last wins for conflicts)

4. **[DONE] Core Library - Patch Engine** ✅
   - ✅ Implement `replace` operation
   - ✅ Implement `replace-regex` operation with flags support
   - ✅ Implement `remove-section` operation with GitHub-style slug parsing
   - ✅ Implement `replace-section` operation
   - ✅ Implement `prepend-to-section` and `append-to-section` operations
   - ✅ Support patch filtering (include/exclude globs)
   - ✅ Support per-patch onNoMatch override

5. **[DONE] Core Library - Diff Generation** ✅
   - ✅ Generate unified diff format
   - ✅ Track which patches were applied
   - ✅ Track warnings (patches with no matches)

6. **[DONE] CLI Layer - Commands** ✅
   - ✅ Implement `kustomark build [path]` command
   - ✅ Implement `kustomark diff [path]` command
   - ✅ Implement `kustomark validate [path]` command
   - ✅ Handle exit codes (0=success, 1=error/changes)

7. **[DONE] CLI Layer - Output Formatting** ✅
   - ✅ Implement text output format (default)
   - ✅ Implement JSON output format (`--format=json`)
   - ✅ Support verbosity flags (`-v`, `-vv`, `-vvv`, `-q`)
   - ✅ Support `--clean` flag for build command

8. **[DONE] Testing** ✅
   - ✅ Unit tests for config parsing
   - ✅ Unit tests for patch operations (244 tests pass)
   - ✅ Unit tests for resource resolution
   - ✅ Unit tests for diff generation
   - ✅ Integration tests with fixtures
   - ✅ Test CLI exit codes
   - ✅ Test JSON output parsing
   - ✅ Test file comparison

9. **[DONE] Documentation** ✅
   - ✅ CLI help text
   - ✅ Basic README with examples
   - ⏳ API documentation for core library (deferred to M2)

## M2: Enhanced Operations (In Progress)

### Priority Order

1. **[DONE] Frontmatter Operations** ✅
   - ✅ Implement `set-frontmatter` operation with dot notation support
   - ✅ Implement `remove-frontmatter` operation
   - ✅ Implement `rename-frontmatter` operation
   - ✅ Implement `merge-frontmatter` operation
   - ✅ Add frontmatter parsing and serialization utilities
   - ✅ Support nested keys with dot notation (e.g., "metadata.author")
   - ✅ Comprehensive unit tests (244 tests passing)
   - ✅ Type safety with `unknown` instead of `any`

2. **[DONE] Line Operations** ✅
   - ✅ Implement `insert-after-line` operation with exact and regex matching
   - ✅ Implement `insert-before-line` operation with exact and regex matching
   - ✅ Implement `replace-line` operation
   - ✅ Implement `delete-between` operation with inclusive/exclusive modes
   - ✅ Implement `replace-between` operation with inclusive/exclusive modes
   - ✅ Support regex matching for insert operations
   - ✅ Comprehensive unit tests (50 new tests, 294 total tests passing)

3. **[TODO] Additional Section Operations**
   - ⏳ Implement `rename-header` operation
   - ⏳ Implement `move-section` operation
   - ⏳ Implement `change-section-level` operation
   - ⏳ Unit tests for new section operations

4. **[TODO] Validation Features**
   - ⏳ Implement per-patch validation (`validate` field)
   - ⏳ Implement global validators in config
   - ⏳ Add `notContains` validator
   - ⏳ Add `frontmatterRequired` validator
   - ⏳ Add `--strict` flag to validate command
   - ⏳ Update JSON output to include validation results

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

## Current Status

**M1 MVP COMPLETE! ✅** All 9 core implementation tasks are done. The CLI is fully functional and documented with:
- Complete config parsing and validation
- Resource resolution with support for nested configs
- All patch operations (replace, regex, section operations)
- Diff generation
- All CLI commands (build, diff, validate)
- Comprehensive test coverage (154 tests passing)
- Complete README with usage examples and API reference

**Recent Completions:**

**2026-01-01 (Initial):**
- ✅ M1 MVP Complete - All core functionality
- ✅ Comprehensive README.md with installation, usage, and API reference

**2026-01-01 (M2 Start - Frontmatter Operations):**
- ✅ Frontmatter parsing utilities with YAML support
- ✅ All 4 frontmatter operations (set, remove, rename, merge)
- ✅ Dot notation support for nested keys (e.g., "metadata.author")
- ✅ Type-safe implementation (using `unknown` instead of `any`)
- ✅ Comprehensive test coverage (244 tests passing, up from 154)
- ✅ All linting checks passing

**2026-01-01 (M2 Line Operations):**
- ✅ All 5 line operations implemented (insert-after-line, insert-before-line, replace-line, delete-between, replace-between)
- ✅ Support for both exact string matching and regex patterns
- ✅ Inclusive/exclusive modes for delete/replace-between operations
- ✅ 50 comprehensive unit tests added (294 total tests passing, up from 244)
- ✅ Full integration with onNoMatch strategy system
- ✅ All linting and tests passing

**Next Priority:** M2 Additional Section Operations - rename-header, move-section, change-section-level
