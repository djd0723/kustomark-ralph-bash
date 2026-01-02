# Kustomark Implementation Plan

## Status: M1 Complete ✅ | M2 Complete ✅

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

3. **[DONE] Additional Section Operations** ✅
   - ✅ Implement `rename-header` operation
   - ✅ Implement `move-section` operation
   - ✅ Implement `change-section-level` operation
   - ✅ Unit tests for new section operations (73 new tests added)

4. **[DONE] Validation Features** ✅
   - ✅ Implement per-patch validation (`validate` field)
   - ✅ Implement global validators in config
   - ✅ Add `notContains` validator
   - ✅ Add `frontmatterRequired` validator
   - ✅ Add `--strict` flag to validate command
   - ✅ Update JSON output to include validation results in all commands

## M3: Remote Sources (In Progress)

### Priority Order

1. **[DONE] Git URL Parsing** ✅
   - ✅ Implement git URL parser with support for three formats:
     - GitHub shorthand: `github.com/org/repo//path?ref=v1.2.0`
     - Full git HTTPS: `git::https://github.com/org/repo.git//subdir?ref=main`
     - Git SSH: `git::git@github.com:org/repo.git//path?ref=abc1234`
   - ✅ Export `isGitUrl()` and `parseGitUrl()` functions
   - ✅ Export `ParsedGitUrl` type
   - ✅ Integrate git URL detection into resource-resolver.ts
   - ✅ Add git URL validation in config-parser.ts
   - ✅ Update CLI help text to document git URL support
   - ✅ Fixed git::https:// parsing bug (proper protocol handling)
   - ✅ Comprehensive test coverage (85 tests in git-url-parser.test.ts)

2. **[DONE] Git Repository Fetching** ✅
   - ✅ Implemented git clone/fetch functionality using Bun.spawn
   - ✅ Support sparse checkout for subdirectories
   - ✅ Handle authentication (SSH keys, credential helpers via git)
   - ✅ Cache cloned repositories in ~/.cache/kustomark/git/
   - ✅ Checkout specified ref (branch/tag/commit)
   - ✅ Integrated into resource-resolver.ts for seamless git URL resolution
   - ✅ Export all git fetcher functions from core/index.ts
   - ✅ Comprehensive test coverage (14 new tests in git-fetcher.test.ts)

3. **[TODO] HTTP Archive Support**
   - Support `.tar.gz`, `.tgz`, `.tar`, `.zip` archives
   - Download and extract archives
   - Handle authentication (bearer tokens, etc.)
   - Validate checksums

4. **[TODO] Caching System**
   - Implement cache directory (`~/.cache/kustomark/`)
   - Cache git repositories
   - Cache HTTP archives
   - Implement cache commands (list, clear)

5. **[TODO] Lock File Generation**
   - Generate `kustomark.lock.yaml`
   - Track resolved refs and integrity hashes
   - Support `--update` flag to update lock file
   - Support `--no-lock` flag to ignore lock file

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

**2026-01-01 (M2 Additional Section Operations):**
- ✅ All 3 additional section operations implemented (rename-header, move-section, change-section-level)
- ✅ `rename-header`: Rename section headers while preserving level and custom IDs
- ✅ `move-section`: Move sections with all children to new positions
- ✅ `change-section-level`: Promote/demote sections with level clamping (1-6)
- ✅ 73 comprehensive unit tests added (367 total tests passing, up from 294)
- ✅ Fixed edge cases: empty header text, substring matching in tests, section hierarchy
- ✅ All linting and tests passing

**2026-01-01 (M2 Validation Features - Core Implementation):**
- ✅ Created `/home/dex/kustomark-ralph-bash/src/core/validators.ts` with full validation implementation:
  - `validateNotContains(content, pattern)` - checks if content doesn't contain forbidden pattern
  - `validateFrontmatterRequired(content, requiredKeys)` - validates required frontmatter fields with dot notation support
  - `runValidator(content, validator)` - runs a single global validator
  - `runValidators(content, validators)` - runs all global validators
- ✅ Extended type system in `types.ts`:
  - `PatchResult` now includes `validationErrors: ValidationError[]`
  - Types already existed: `Validator`, `PatchValidation`, `ValidationError`, `ValidationWarning`
- ✅ Updated `patch-engine.ts` for per-patch validation:
  - `applySinglePatch()` now runs validation after applying patches
  - `applyPatches()` collects and returns all validation errors
  - Per-patch validation only runs if patch successfully matched (count > 0)
- ✅ Updated `src/core/index.ts` to export all validator functions and validation types
- ✅ All 367 tests still passing ✓
- ✅ All linting checks passing (bun check) ✓
- ✅ Validation happens AFTER patches are applied (as per spec)
- ✅ Supports dot notation for nested frontmatter keys (e.g., "metadata.author")

**2026-01-01 (M2 Validation Features - CLI Integration Complete):**
- ✅ Added `--strict` flag to CLI argument parser (added to CLIOptions interface)
- ✅ Implemented `--strict` flag behavior in validate command:
  - Treats warnings as errors when strict mode is enabled
  - JSON output includes `"strict"` field in all responses
  - Text output clearly indicates when strict mode caused validation to fail
- ✅ Integrated validation errors into build command:
  - Collects per-patch validation errors from patch engine
  - Runs global validators on all patched files
  - Includes `validationErrors` field in JSON output (BuildResult interface)
  - Displays validation errors in text output with file location, validator name, and message
  - Build succeeds (exit 0) even with validation errors - they're informational
- ✅ Integrated validation errors into diff command:
  - Collects per-patch validation errors from patch engine
  - Runs global validators on all patched files
  - Includes `validationErrors` field in JSON output (DiffResult interface)
  - Displays validation errors in text output after diff summary
  - Exit code unaffected by validation errors (only based on changes)
- ✅ Comprehensive integration tests (34 new tests, 401 total tests passing):
  - Per-patch validation with notContains
  - Global validators with notContains and frontmatterRequired
  - JSON output validation for all commands
  - Text output validation display
  - --strict flag behavior in validate command
  - Validation errors don't affect build/diff exit codes
  - File context preservation in error messages
  - Mixed per-patch and global validation scenarios
- ✅ All linting checks passing (bun check) ✓
- ✅ Type-safe implementation (no `any` types, proper ValidationError typing)

**2026-01-01 (M3 Git URL Parsing):**
- ✅ Created `/home/dex/kustomark-ralph-bash/src/core/git-url-parser.ts` with full parsing implementation:
  - `isGitUrl(url)` - detects if a URL is a git URL (github.com/ or git:: prefix)
  - `parseGitUrl(url)` - parses git URLs into structured components
  - Supports GitHub shorthand, git::https://, and git::git@ SSH formats
  - Handles refs (branch/tag/commit) via query parameters
  - Handles subpaths via // separator
  - Returns null for invalid URLs
- ✅ Integrated into resource-resolver.ts:
  - Detects git URLs in resources array
  - Validates git URL format
  - Throws informative error for valid but unimplemented git URLs
  - Added TODO comments for future fetching implementation
- ✅ Integrated into config-parser.ts:
  - Validates git URLs during config validation
  - Adds validation errors for malformed git URLs
  - Adds validation warnings for valid but unsupported git URLs
- ✅ Updated src/core/index.ts to export git URL parser functions
- ✅ Updated CLI help text to document git URL support
- ✅ Comprehensive test suite (83 new tests, 484 total tests passing, up from 401):
  - GitHub shorthand format parsing
  - Git SSH URL parsing (git::git@...)
  - Edge cases and invalid inputs
  - Real-world examples
  - Type safety verification
  - Alternative git hosting providers (GitLab, Bitbucket, self-hosted)
- ✅ All linting checks passing (bun check) ✓
- ✅ Type-safe implementation with ParsedGitUrl interface

**Status:**
- **M1 COMPLETE! ✅**
- **M2 COMPLETE! ✅**
- **M3 GIT FETCHING COMPLETE! ✅**
  - Git URL parsing and validation: DONE ✅
  - Git repository fetching: DONE ✅
  - Next: HTTP archive support and lock file generation

**Next Priority:** M3 HTTP Archive Support (.tar.gz, .zip) and Lock File Generation

**2026-01-02 (M3 Git Repository Fetching):**
- ✅ Created `/home/dex/kustomark-ralph-bash/src/core/git-fetcher.ts` with complete git operations:
  - `fetchGitRepository()` - Clone and cache git repositories with sparse checkout support
  - `clearGitCache()` - Clear cached repositories (all or by pattern)
  - `listGitCache()` - List all cached repositories
  - `getDefaultCacheDir()` - Get default cache directory path
  - `GitFetchError` - Custom error class for git operations
  - Supports authentication via SSH keys and git credential helpers
  - Caches repositories in `~/.cache/kustomark/git/`
  - Handles branch/tag/commit checkout with SHA resolution
- ✅ Fixed git::https:// URL parsing bug in git-url-parser.ts:
  - Proper handling of protocol:// separator to avoid breaking HTTPS URLs
  - Now correctly parses git::https:// and git::http:// formats
- ✅ Added `cloneUrl` field to `ParsedGitUrl` type for git operations
- ✅ Made `resolveResources()` async to support git fetching
- ✅ Integrated git fetching into resource-resolver.ts:
  - Automatically fetches git repositories when git URLs are encountered
  - Recursively finds markdown files in fetched repositories
  - Respects subpath specifications in git URLs
  - Adds fetched files to the file map for processing
- ✅ Updated CLI to handle async resource resolution
- ✅ Updated all tests to handle async resolveResources (resource-resolver.test.ts, cli-integration.test.ts)
- ✅ Created comprehensive test suite in `/home/dex/kustomark-ralph-bash/tests/git-fetcher.test.ts`:
  - 14 tests covering fetching, caching, error handling, and cache operations
  - Tests use real GitHub repository (anthropics/anthropic-sdk-typescript)
  - All network tests have appropriate timeouts (60s-180s)
- ✅ All 501 tests passing ✓
- ✅ All linting checks passing (bun check) ✓
- ✅ Type-safe implementation with proper error handling
