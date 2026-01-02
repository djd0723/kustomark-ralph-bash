# Kustomark API Documentation

This directory contains the API documentation for the Kustomark core library.

## Documentation

- **[Full API Reference](./api/index.html)** - Complete TypeDoc-generated API documentation

## Core Library Overview

The Kustomark core library provides a comprehensive set of tools for patching markdown files programmatically.

### Main Modules

#### Patch Engine
- **`applyPatches`** - Apply multiple patches to content sequentially
- **`applySinglePatch`** - Apply a single patch operation
- Individual patch functions:  `applyReplace`, `applyReplaceRegex`, `applyRemoveSection`, `applyReplaceSection`, etc.

#### Configuration
- **`parseConfig`** - Parse YAML configuration into KustomarkConfig object
- **`validateConfig`** - Validate configuration structure and rules

#### Resource Resolution
- **`resolveResources`** - Resolve resource patterns (globs, git URLs, HTTP archives) to markdown files
- Supports local files, git repositories, and HTTP archives
- Handles authentication, caching, and lock files

#### Remote Sources
- **Git Fetcher** - Clone and cache git repositories (`fetchGitRepository`, `clearGitCache`)
- **HTTP Fetcher** - Download and extract archives (`fetchHttpArchive`, `clearHttpCache`)
- **URL Parsers** - Parse git and HTTP archive URLs

#### Validation
- **`runValidators`** - Run global validators on content
- **`validateNotContains`** - Ensure content doesn't contain forbidden patterns
- **`validateFrontmatterRequired`** - Check required frontmatter fields

#### Frontmatter
- **`parseFrontmatter`** - Extract YAML frontmatter from markdown
- **`stringifyFrontmatter`** - Convert object to YAML frontmatter
- **`insertFrontmatter`** - Insert or replace frontmatter in content

#### File Operations
- **`applyCopyFile`** - Copy files with validation
- **`applyRenameFile`** - Rename files matching glob patterns
- **`applyDeleteFile`** - Delete files matching glob patterns
- **`applyMoveFile`** - Move files to new directory

#### Lock Files
- **`loadLockFile`** - Load lock file for reproducible builds
- **`saveLockFile`** - Save lock file with resolved dependencies
- **`updateLockEntry`** - Update or add lock file entry

#### Diff Generation
- **`generateDiff`** - Generate unified diff between two strings
- **`generateFileDiff`** - Generate diffs for multiple files

#### Utilities
- **`getNestedValue`** - Get nested values using dot notation
- **`setNestedValue`** - Set nested values using dot notation
- **`deleteNestedValue`** - Delete nested values using dot notation

## Quick Start

```typescript
import {
  parseConfig,
  resolveResources,
  applyPatches
} from 'kustomark';

// Parse configuration
const config = parseConfig(yamlContent);

// Resolve resources
const fileMap = new Map();
const resources = await resolveResources(
  config.resources,
  '/project/path',
  fileMap
);

// Apply patches
const result = applyPatches(
  content,
  config.patches || [],
  config.onNoMatch || 'warn'
);

console.log(result.content); // Patched content
console.log(result.applied); // Number of patches applied
```

## TypeScript Types

All types are exported from the core library:

```typescript
import type {
  KustomarkConfig,
  PatchOperation,
  PatchResult,
  ValidationResult,
  ResolvedResource,
  LockFile
} from 'kustomark';
```

## Examples

See the [examples directory](../examples/) for more detailed usage examples.

## Contributing

For information on contributing to Kustomark, see [CONTRIBUTING.md](../.github/CONTRIBUTING.md).
