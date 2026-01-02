# Kustomark

> Declarative markdown patching pipeline. Like kustomize, but for markdown.

Kustomark solves the "upstream fork problem" for markdown files. Consume markdown from upstream sources while maintaining local customizations without forking. Perfect for documentation, Claude Code skills, and any scenario where you need to customize markdown files while staying in sync with upstream updates.

## Table of Contents

- [Problem Statement](#problem-statement)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
- [Patch Operations](#patch-operations)
- [Resource Resolution](#resource-resolution)
- [Advanced Usage](#advanced-usage)
- [Exit Codes](#exit-codes)
- [JSON Output](#json-output)
- [Contributing](#contributing)

## Problem Statement

Without kustomark:
- Fork and diverge (lose upstream updates)
- Manual sync (tedious and error-prone)
- No version control for customizations

With kustomark:
- Declarative patches in version control
- Deterministic, reproducible builds
- Easy upstream updates
- Test your customizations

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Upstream     │     │  Your Patches   │     │     Output      │
│    Markdown     │ ──▶ │   (YAML config) │ ──▶ │   (customized)  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Installation

### Using Bun (recommended)

```bash
bun install kustomark
```

### From Source

```bash
git clone https://github.com/yourusername/kustomark.git
cd kustomark
bun install
bun run build
```

The CLI will be available at `./dist/cli/index.js` or you can link it globally:

```bash
bun link
```

## Quick Start

### 1. Create a base directory with markdown files

```bash
mkdir -p myproject/base
echo "# My Project\n\nWelcome to myproject!" > myproject/base/README.md
```

### 2. Create a kustomization with patches

Create `myproject/overlay/kustomark.yaml`:

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../base/

patches:
  - op: replace
    old: "myproject"
    new: "awesome-project"
```

### 3. Build the output

```bash
kustomark build myproject/overlay/
```

Your customized markdown files will be in `myproject/overlay/output/`.

### 4. Preview changes before building

```bash
kustomark diff myproject/overlay/
```

This shows what would change without writing files.

## CLI Commands

### `kustomark build [path]`

Build and write output files.

```bash
# Build from a directory containing kustomark.yaml
kustomark build ./team/

# Build with JSON output
kustomark build ./team/ --format=json

# Build and clean extra files
kustomark build ./team/ --clean

# Verbose output
kustomark build ./team/ -v
```

**Options:**
- `--format <text|json>` - Output format (default: text)
- `--clean` - Remove output files not in source
- `-v`, `-vv`, `-vvv` - Increase verbosity
- `-q` - Quiet mode (errors only)

### `kustomark diff [path]`

Show what would change without writing files.

```bash
# Show diff in text format
kustomark diff ./team/

# Show diff with details
kustomark diff ./team/ -v

# Get diff as JSON
kustomark diff ./team/ --format=json
```

**Exit code:** Returns 0 if no changes, 1 if changes detected.

### `kustomark validate [path]`

Validate configuration without building.

```bash
# Validate configuration
kustomark validate ./team/

# Get validation results as JSON
kustomark validate ./team/ --format=json
```

**Exit code:** Returns 0 if valid, 1 if invalid.

## Configuration

### Config File Structure

Create a `kustomark.yaml` file:

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - "**/*.md"           # glob pattern
  - "!**/README.md"     # negation
  - ../base/            # another kustomark config

patches:
  - op: replace
    old: "foo"
    new: "bar"

onNoMatch: warn  # skip | warn | error
```

### Field Reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `apiVersion` | yes | string | Must be `kustomark/v1` |
| `kind` | yes | string | Must be `Kustomization` |
| `output` | yes* | string | Output directory (*required for build) |
| `resources` | yes | array | Globs, paths, or other kustomark configs |
| `patches` | no | array | Ordered list of patch operations |
| `onNoMatch` | no | string | Default: `warn`. Options: `skip`, `warn`, `error` |

### Resource Types

| Pattern | Description | Example |
|---------|-------------|---------|
| Glob | Match files by pattern | `"**/*.md"` |
| Negation | Exclude files | `"!**/README.md"` |
| File path | Specific file | `"./docs/guide.md"` |
| Directory | Kustomark config directory | `"../base/"` |

### Common Patch Fields

All patch operations support these optional fields:

| Field | Type | Description |
|-------|------|-------------|
| `include` | string or array | Glob pattern(s) to include specific files |
| `exclude` | string or array | Glob pattern(s) to exclude specific files |
| `onNoMatch` | string | Override default behavior: `skip`, `warn`, or `error` |

## Patch Operations

### `replace` - Simple String Replacement

Replace all occurrences of an exact string.

```yaml
- op: replace
  old: "upstream-path/"
  new: "local-path/"
```

**Example:**

Input:
```markdown
Visit upstream-path/docs for more info.
```

Output:
```markdown
Visit local-path/docs for more info.
```

**With file filtering:**

```yaml
- op: replace
  old: "myproject"
  new: "awesome-project"
  include: "*.md"
  exclude: "README.md"
```

### `replace-regex` - Regular Expression Replacement

Replace using regular expressions with capture groups.

```yaml
- op: replace-regex
  pattern: "Run `rpi (\\w+)`"
  replacement: "Run `thoughts $1`"
  flags: "gi"  # g=global, i=case-insensitive, m=multiline, s=dotall
```

**Regex Flags:**
- `g` - Global (replace all matches)
- `i` - Case-insensitive
- `m` - Multiline (^ and $ match line boundaries)
- `s` - Dotall (. matches newlines)

**Example:**

Input:
```markdown
Run `rpi task-add "Buy milk"`
Run `rpi task-list`
```

Output:
```markdown
Run `thoughts task-add "Buy milk"`
Run `thoughts task-list`
```

### `remove-section` - Remove Markdown Section

Remove a section by its ID (GitHub-style slug or custom ID).

```yaml
- op: remove-section
  id: advanced-topics
  includeChildren: true  # default: true
```

**Example:**

Input:
```markdown
# Getting Started

Welcome!

## Installation

Install instructions here.

## Advanced Topics

This section will be removed.

### Subsection

This will also be removed if includeChildren: true
```

Output:
```markdown
# Getting Started

Welcome!

## Installation

Install instructions here.
```

**Section IDs:**
- Auto-generated from headers: `## Advanced Topics` → `advanced-topics`
- Custom IDs: `## Usage {#custom-id}` → `custom-id`

**includeChildren:**
- `true` (default) - Remove section and all subsections
- `false` - Remove only content until first subsection

### `replace-section` - Replace Section Content

Replace the entire content of a section (keeps the header).

```yaml
- op: replace-section
  id: installation
  content: |
    To install, run:

    ```bash
    npm install awesome-project
    ```
```

**Example:**

Input:
```markdown
## Installation

Old installation instructions.

## Usage

Usage instructions.
```

Output:
```markdown
## Installation

To install, run:

```bash
npm install awesome-project
```

## Usage

Usage instructions.
```

### `prepend-to-section` - Add Content to Section Start

Add content immediately after the section header.

```yaml
- op: prepend-to-section
  id: usage
  content: |

    > **Warning:** This is experimental!
```

**Example:**

Input:
```markdown
## Usage

Use the tool like this...
```

Output:
```markdown
## Usage

> **Warning:** This is experimental!

Use the tool like this...
```

### `append-to-section` - Add Content to Section End

Add content at the end of a section (before the next section).

```yaml
- op: append-to-section
  id: usage
  content: |

    ### Additional Options

    - `--verbose` - Enable verbose output
    - `--config <path>` - Specify config file
```

**Example:**

Input:
```markdown
## Usage

Basic usage instructions.

## Configuration

Config instructions.
```

Output:
```markdown
## Usage

Basic usage instructions.

### Additional Options

- `--verbose` - Enable verbose output
- `--config <path>` - Specify config file

## Configuration

Config instructions.
```

## Resource Resolution

Resources are resolved recursively. When you reference another kustomark config, its patches are applied first (base), then your patches are applied (overlay).

### Overlay Pattern

```
base/kustomark.yaml          → Base configuration with resources
    ↓
company/kustomark.yaml       → Company-wide customizations
    ↓
team/kustomark.yaml          → Team-specific customizations
    ↓
output/                      → Final customized files
```

**Example:**

`base/kustomark.yaml`:
```yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - "*.md"
```

`team/kustomark.yaml`:
```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../base/

patches:
  - op: replace
    old: "company-name"
    new: "team-name"

  - op: append-to-section
    id: footer
    content: |

      ---
      Team-specific footer content
```

When you run `kustomark build team/`, it:
1. Loads resources from `base/` (all `*.md` files)
2. Applies patches from `team/kustomark.yaml`
3. Writes output to `team/output/`

### Multiple Resources

Resources are processed in order. For conflicts, last one wins.

```yaml
resources:
  - ../base/
  - ../shared/
  - ./local-overrides/
```

## Advanced Usage

### Custom Section IDs

Use `{#custom-id}` syntax for explicit section IDs:

```markdown
## My Section {#my-custom-id}

Content here.
```

Then reference it in patches:

```yaml
- op: append-to-section
  id: my-custom-id
  content: "Additional content"
```

### File-Specific Patches

Use `include` and `exclude` to target specific files:

```yaml
patches:
  # Only apply to documentation files
  - op: replace
    old: "v1.0"
    new: "v2.0"
    include: "docs/**/*.md"

  # Apply to all except README
  - op: replace
    old: "internal-name"
    new: "public-name"
    exclude: "README.md"

  # Multiple patterns
  - op: replace-section
    id: installation
    content: "Custom installation steps"
    include:
      - "guide.md"
      - "quickstart.md"
```

### Patch Groups

Organize patches into groups and selectively enable/disable them:

```yaml
patches:
  # Branding patches
  - op: replace
    old: "CompanyName"
    new: "AcmeCorp"
    group: "branding"

  - op: replace
    old: "support@company.com"
    new: "support@acme.com"
    group: "branding"

  # Feature flags
  - op: replace-section
    id: beta-features
    content: "# Beta Features\n\nNow available!"
    group: "beta"

  # Always applies (no group)
  - op: replace
    old: "TODO"
    new: "DONE"
```

Control which groups are applied:

```bash
# Apply only branding patches (+ ungrouped patches)
kustomark build . --enable-groups=branding

# Apply all except beta patches
kustomark build . --disable-groups=beta

# Apply multiple groups
kustomark build . --enable-groups=branding,docs

# If both flags specified, --enable-groups takes precedence
kustomark build . --enable-groups=branding --disable-groups=branding
# Result: branding patches ARE applied (whitelist wins)
```

**Group naming rules:**
- Alphanumeric characters, hyphens, and underscores only
- Example: `my-group`, `group_123`, `FeatureX`

**Behavior:**
- Patches without a `group` field are always applied
- `--enable-groups`: whitelist mode (only specified groups + ungrouped)
- `--disable-groups`: blacklist mode (exclude specified groups)
- If both flags specified, `--enable-groups` takes precedence

### Error Handling Strategies

Control what happens when a patch doesn't match:

```yaml
# Global default
onNoMatch: warn

patches:
  # Must match or fail
  - op: replace
    old: "critical-string"
    new: "replacement"
    onNoMatch: error

  # Silently skip if not found
  - op: remove-section
    id: optional-section
    onNoMatch: skip

  # Warn if not found (default)
  - op: replace
    old: "something"
    new: "else"
    onNoMatch: warn
```

**Strategies:**
- `skip` - Silently ignore if patch doesn't match
- `warn` - Log warning but continue (default)
- `error` - Fail immediately if patch doesn't match

### Complex Overlay Example

```
project/
├── upstream/
│   ├── kustomark.yaml
│   └── docs/
│       ├── guide.md
│       └── api.md
├── company/
│   ├── kustomark.yaml
│   └── (company customizations)
└── team/
    ├── kustomark.yaml
    └── output/
```

`upstream/kustomark.yaml`:
```yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - "docs/**/*.md"
```

`company/kustomark.yaml`:
```yaml
apiVersion: kustomark/v1
kind: Kustomization

resources:
  - ../upstream/

patches:
  - op: replace
    old: "Acme Corp"
    new: "Your Company"

  - op: replace-section
    id: support
    content: |
      Contact support@yourcompany.com
```

`team/kustomark.yaml`:
```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - ../company/

patches:
  - op: append-to-section
    id: footer
    content: |

      ---
      Team Alpha - Internal Use Only
```

Build:
```bash
kustomark build team/
```

This applies patches in order: upstream → company → team.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (for `diff`: no changes detected) |
| `1` | Error or changes detected (for `diff`) |

**Examples:**

```bash
# Build succeeds
kustomark build ./team/
echo $?  # 0

# Validation fails
kustomark validate ./broken/
echo $?  # 1

# Diff detects changes
kustomark diff ./team/
echo $?  # 1 (changes exist)

# Diff with no changes
kustomark diff ./unchanged/
echo $?  # 0 (no changes)
```

## JSON Output

All commands support `--format=json` for machine-readable output.

### Build Output

```bash
kustomark build ./team/ --format=json
```

```json
{
  "success": true,
  "filesWritten": 15,
  "patchesApplied": 48,
  "warnings": [
    "Patch 'replace 'foo' with 'bar'' matched 0 times"
  ]
}
```

**Fields:**
- `success` - Boolean indicating if build succeeded
- `filesWritten` - Number of files written to output
- `patchesApplied` - Number of patches that matched and were applied
- `warnings` - Array of warning messages
- `errors` - (if failed) Array of error objects with `field` and `message`

### Diff Output

```bash
kustomark diff ./team/ --format=json
```

```json
{
  "hasChanges": true,
  "files": [
    {
      "path": "guide.md",
      "status": "modified",
      "diff": "--- a/guide.md\n+++ b/guide.md\n@@ -1,3 +1,3 @@\n-Old content\n+New content"
    },
    {
      "path": "new-file.md",
      "status": "added"
    }
  ]
}
```

**Fields:**
- `hasChanges` - Boolean indicating if changes were detected
- `files` - Array of file change objects
  - `path` - File path relative to output
  - `status` - One of: `added`, `modified`, `deleted`
  - `diff` - (optional) Unified diff format

### Validate Output

```bash
kustomark validate ./team/ --format=json
```

```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    "No patches defined"
  ]
}
```

**Invalid config:**

```json
{
  "valid": false,
  "errors": [
    {
      "field": "apiVersion",
      "message": "must be 'kustomark/v1'"
    },
    {
      "field": "resources",
      "message": "must be a non-empty array"
    }
  ],
  "warnings": []
}
```

### Using JSON Output in Scripts

```bash
#!/bin/bash

# Build and capture result
result=$(kustomark build ./team/ --format=json)

# Check success
if echo "$result" | jq -e '.success' > /dev/null; then
  echo "Build succeeded!"
  files=$(echo "$result" | jq -r '.filesWritten')
  echo "Wrote $files files"
else
  echo "Build failed!"
  echo "$result" | jq -r '.errors[].message'
  exit 1
fi
```

## Design Principles

1. **Determinism**: Same inputs always produce same outputs
2. **Machine-readable**: All commands support `--format=json`
3. **Non-interactive**: No PTY required, all flags explicit
4. **Testable**: Every feature verifiable via CLI exit codes and output

## Contributing

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/kustomark.git
cd kustomark

# Install dependencies
bun install

# Run tests
bun test

# Run tests in watch mode
bun test:watch

# Type check
bun run check

# Lint
bun run lint

# Format code
bun run format
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/core/patch-engine.test.ts

# Watch mode
bun test:watch
```

### Project Structure

```
kustomark/
├── src/
│   ├── core/              # Core library (no I/O)
│   │   ├── types.ts       # Type definitions
│   │   ├── config-parser.ts
│   │   ├── patch-engine.ts
│   │   ├── diff-generator.ts
│   │   └── resource-resolver.ts
│   └── cli/               # CLI layer (handles I/O)
│       └── index.ts
├── tests/
│   ├── core/              # Core library tests
│   ├── cli/               # CLI integration tests
│   └── fixtures/          # Test fixtures
├── specs/                 # Design specifications
└── dist/                  # Built output
```

### Architecture

Kustomark has two layers with clean separation:

**Core Library** (`src/core/`):
- Pure functions with no I/O
- Config parsing and validation
- Patch engine operations
- Diff generation
- Resource resolution logic

**CLI Layer** (`src/cli/`):
- File system operations
- User input/output
- Formatting (text/json)
- Orchestrates core library functions

This separation makes the core library:
- Easy to test (no mocking required)
- Reusable in other contexts (web, API, etc.)
- Pure and predictable

### Adding a New Patch Operation

1. Add types to `src/core/types.ts`
2. Implement the operation in `src/core/patch-engine.ts`
3. Add tests in `tests/core/patch-engine.test.ts`
4. Update this README with examples
5. Add integration test fixtures in `tests/fixtures/`

### Code Quality

We use:
- **TypeScript** for type safety
- **Biome** for linting and formatting
- **Bun** for testing and runtime

Before submitting a PR:

```bash
bun run check      # Type check
bun run lint       # Lint
bun run format     # Format
bun test           # Run tests
```

### Submitting Issues

When submitting an issue, please include:

- Kustomark version
- Your `kustomark.yaml` config
- Input markdown files (minimal example)
- Expected vs actual output
- Error messages or unexpected behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Update documentation
7. Submit a pull request

## License

MIT

## Links

- [Specifications](./specs/)
- [M1 MVP Spec](./specs/m1-mvp.md)
- [GitHub Repository](https://github.com/yourusername/kustomark)

---

Built with TypeScript and Bun. Inspired by kustomize.
