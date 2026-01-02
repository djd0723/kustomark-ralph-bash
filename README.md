# Kustomark

> Declarative markdown patching pipeline. Like kustomize, but for markdown.

Kustomark solves the "upstream fork problem" for markdown files. Consume markdown from upstream sources while maintaining local customizations without forking. Perfect for documentation, Claude Code skills, and any scenario where you need to customize markdown files while staying in sync with upstream updates.

## Table of Contents

- [Problem Statement](#problem-statement)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
  - [kustomark build](#kustomark-build-path)
  - [kustomark diff](#kustomark-diff-path)
  - [kustomark validate](#kustomark-validate-path)
  - [kustomark init](#kustomark-init-path)
- [Configuration](#configuration)
- [Patch Operations](#patch-operations)
- [Resource Resolution](#resource-resolution)
- [Advanced Usage](#advanced-usage)
  - [Patch Groups](#patch-groups)
  - [Patch Inheritance](#patch-inheritance)
  - [Error Handling Strategies](#error-handling-strategies)
  - [Complex Overlay Example](#complex-overlay-example)
- [Performance](#performance)
  - [Parallel Builds](#parallel-builds)
  - [Incremental Builds](#incremental-builds)
- [Exit Codes](#exit-codes)
- [JSON Output](#json-output)
- [IDE Integration](#ide-integration)
  - [VSCode Extension](#vscode-extension)
  - [JSON Schema](#json-schema)
- [Web UI](#web-ui)
  - [Starting the Web UI](#starting-the-web-ui)
  - [Features](#features-1)
  - [Development](#development-1)
- [Design Principles](#design-principles)
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
- `--parallel` - Enable parallel builds for better performance
- `--jobs <number>` - Number of parallel jobs (default: CPU count)
- `--incremental` - Enable incremental builds (only rebuild changed files)
- `--clean-cache` - Force full rebuild by clearing build cache
- `--stats` - Show detailed build statistics including cache performance

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

### `kustomark init [path]`

Create a new kustomark configuration file.

```bash
# Interactive mode - guided wizard
kustomark init -i
kustomark init --interactive

# Non-interactive mode - base configuration
kustomark init .

# Non-interactive mode - overlay configuration
kustomark init ./overlay --base=../base --output=./output
```

**Options:**
- `-i`, `--interactive` - Launch interactive wizard with prompts
- `--base <path>` - Create overlay config referencing base (non-interactive)
- `--output <path>` - Set output directory (non-interactive)
- `--format <text|json>` - Output format (default: text)

**Interactive Mode:**

The interactive wizard guides you through creating a configuration with prompts for:
- Configuration type (base or overlay)
- Output directory
- Resource patterns (for base configs)
- Base configuration path (for overlays)
- Starter patches with detailed configuration options
- Error handling strategy (skip/warn/error)

Interactive mode is ideal for first-time users or when you want to explore available options.

**Non-Interactive Mode:**

Use flags to create configurations programmatically:
- Without `--base`: Creates a base configuration with `*.md` resources
- With `--base`: Creates an overlay configuration that extends the base

**Examples:**

```bash
# Create base config interactively
kustomark init -i

# Create base config with defaults
kustomark init ./base

# Create overlay config referencing a base
kustomark init ./team --base=../base --output=./output
```

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

### Patch Inheritance

Patches can extend other patches by ID to promote code reuse. This allows you to build complex patches on top of simpler base patches, reducing duplication and improving maintainability.

#### Overview

Patch inheritance enables you to:
- Define base patches once and reuse them across multiple derived patches
- Build inheritance chains for progressive customization
- Merge fields from parent patches into child patches
- Keep patches DRY (Don't Repeat Yourself)

#### Basic Syntax

Use the `id` field to name a patch, and the `extends` field to inherit from a parent patch:

```yaml
patches:
  # Base patch (no extends)
  - op: replace
    id: base-replace
    old: "old-text"
    new: "new-text"

  # Derived patch (extends the base)
  - op: replace
    id: extended-replace
    extends: base-replace
    new: "even-newer-text"  # Overrides the parent's 'new' field
```

When a patch extends another patch:
1. All fields from the parent patch are inherited
2. Fields explicitly defined in the child patch override parent fields
3. Arrays are concatenated rather than replaced
4. The `validate` array replaces (not concatenates) the parent's validation rules

#### Single Parent Inheritance

A derived patch inherits all fields from its parent and can override specific fields:

```yaml
patches:
  # Base branding patch
  - op: replace
    id: base-branding
    old: "ACME Corp"
    new: "ACME"

  # Specialized branding patch for specific files
  - op: replace
    id: branding-docs
    extends: base-branding
    include: "docs/**/*.md"
    onNoMatch: warn
```

In this example, `branding-docs` inherits `old`, `new`, and `op` from `base-branding`, while adding its own `include` pattern and `onNoMatch` behavior.

#### Multiple Inheritance (Extends as Array)

A patch can inherit from multiple parent patches:

```yaml
patches:
  - op: replace
    id: base-text
    old: "old-text"
    new: "new-text"

  - op: replace
    id: base-branding
    old: "ACME Corp"
    new: "Your Company"

  # Combines fields from both parents
  - op: replace
    id: combined-patch
    extends: [base-text, base-branding]
    include: "guides/**/*.md"
```

When using multiple inheritance:
- Fields are merged in order (first parent's fields, then second parent's, etc.)
- Later parent fields override earlier parent fields
- Child patch fields override all parent fields
- Arrays are concatenated from all parents plus the child

#### Deep Inheritance Chains

Patches can extend patches that themselves extend other patches:

```yaml
patches:
  # Level 1: Base patch
  - op: replace
    id: level-1
    old: "v1"
    new: "v2"

  # Level 2: Extends level 1
  - op: replace
    id: level-2
    extends: level-1
    old: "v2"  # Override
    new: "v3"

  # Level 3: Extends level 2
  - op: replace
    id: level-3
    extends: level-2
    include: "*.md"

  # Level 4: Extends level 3
  - op: replace
    id: level-4
    extends: level-3
    exclude: "README.md"
```

The chain resolves from the deepest parent upward, with later definitions overriding earlier ones.

#### Field Merging Rules

Different field types merge differently when inheriting:

**Primitive Fields (strings, numbers, booleans):**
```yaml
patches:
  - op: replace
    id: parent-patch
    old: "text1"
    new: "text2"

  - op: replace
    id: child-patch
    extends: parent-patch
    new: "text3"  # OVERRIDES parent's new field
```

Child patch's `new` field (text3) overrides parent's (text2).

**Array Fields (include, exclude, validate):**
```yaml
patches:
  - op: replace
    id: parent-patch
    old: "old"
    new: "new"
    include: ["*.md"]
    validate: ["pattern1"]

  - op: replace
    id: child-patch
    extends: parent-patch
    include: ["guides/**/*.md"]  # CONCATENATES: ["*.md", "guides/**/*.md"]
    validate: ["pattern2"]       # REPLACES: ["pattern2"]
```

- `include` and `exclude` arrays concatenate
- `validate` arrays replace (not concatenate)

**Complex Fields (content for section operations):**
```yaml
patches:
  - op: replace-section
    id: base-section
    id: my-section
    content: "Base content\n"

  - op: replace-section
    id: extended-section
    extends: base-section
    content: "New content\n"  # OVERRIDES base content
```

#### Section Operations with Inheritance

For section operations (replace-section, append-to-section, etc.), the `patchId` field is used for inheritance instead of `id`:

```yaml
patches:
  # Base section patch
  - op: append-to-section
    patchId: base-append
    id: installation
    content: "Basic install steps"

  # Inherit from base, customize for specific files
  - op: append-to-section
    patchId: custom-append
    extends: base-append
    include: "quickstart.md"
```

This distinction prevents confusion between:
- `id`: The markdown section to operate on
- `patchId`: The unique identifier for the patch itself (for inheritance)

#### Complete Inheritance Example

```yaml
patches:
  # Base patches
  - op: replace
    id: version-replace
    old: "1.0.0"
    new: "2.0.0"
    onNoMatch: warn

  - op: replace-section
    patchId: base-install
    id: installation
    content: |
      To install, run:
      ```bash
      npm install
      ```

  # Specialized patches extending the base
  - op: replace
    id: docs-version
    extends: version-replace
    include: "docs/**/*.md"

  - op: replace
    id: api-version
    extends: version-replace
    include: "api/**/*.md"
    new: "2.0.0-beta"  # Override parent's new value

  - op: replace-section
    patchId: quickstart-install
    extends: base-install
    include: "quickstart.md"
    content: |
      Quick install:
      ```bash
      npm install -S
      ```

  # Inheritance chain
  - op: replace
    id: brand-replace
    extends: version-replace
    old: "Company"
    new: "Brand"

  - op: replace
    id: team-brand
    extends: brand-replace
    include: "team/**/*.md"
```

#### Limitations and Best Practices

**Limitations:**

1. **No circular dependencies**: A patch cannot (directly or indirectly) extend itself. This will cause an error.

2. **Patch order**: A patch cannot extend a patch defined after it in the configuration. Always define parent patches before child patches.

3. **Single operation type per inheritance chain**: All patches in an inheritance chain must be the same operation type (e.g., all `replace`, or all `append-to-section`).

4. **Field compatibility**: Ensure fields are compatible across the inheritance chain. Extending a `replace-regex` patch with `flags` and then overriding with a `replace` patch will fail validation.

**Best Practices:**

1. **Name patches descriptively**: Use clear, hierarchical names:
   ```yaml
   - id: base-branding
   - id: branding-web-docs  # extends base-branding
   - id: branding-guides    # extends base-branding
   ```

2. **Limit inheritance depth**: Keep chains to 2-3 levels. Deep chains become hard to follow:
   ```yaml
   # Good: Simple hierarchy
   base → specialized → file-specific

   # Avoid: Deep chains
   base → level2 → level3 → level4 → level5
   ```

3. **Use multiple inheritance for composition**: Group related fields:
   ```yaml
   - id: file-filter
     include: "docs/**/*.md"

   - id: branding-rule
     old: "old"
     new: "new"

   - id: combined
     extends: [branding-rule, file-filter]
   ```

4. **Document inheritance relationships**: Use comments to clarify the inheritance structure:
   ```yaml
   patches:
     # Base rule - reused by multiple patches
     - op: replace
       id: base-version
       old: "v1"
       new: "v2"

     # Override for internal docs only
     - op: replace
       id: version-internal
       extends: base-version
       include: "internal/**/*.md"
   ```

5. **Prefer composition over modification**: Instead of deep override chains, compose from focused base patches:
   ```yaml
   # Good: Clear intent
   patches:
     - op: replace
       id: file-filter-docs
       include: "docs/**/*.md"

     - op: replace
       id: rule-version
       old: "v1"
       new: "v2"

     - op: replace
       id: docs-version
       extends: [rule-version, file-filter-docs]

   # Avoid: Chains of overrides
   patches:
     - op: replace
       id: step1
       include: "docs/**/*.md"

     - op: replace
       id: step2
       extends: step1
       old: "v1"

     - op: replace
       id: step3
       extends: step2
       new: "v2"
   ```

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

## Performance

Kustomark provides several performance optimizations for large projects.

### Parallel Builds

For projects with many files, enable parallel processing to significantly speed up builds:

```bash
# Use all available CPUs
kustomark build . --parallel

# Limit to 4 parallel jobs
kustomark build . --parallel --jobs=4
```

Parallel builds are most effective when:
- Processing 10+ files
- Applying complex patches
- Working with large markdown files

Overhead is minimal, so it's safe to enable for small projects too.

### Incremental Builds

Incremental builds only rebuild files that have changed, dramatically reducing build times for iterative development:

```bash
# Enable incremental builds
kustomark build . --incremental

# Force full rebuild (clear cache)
kustomark build . --incremental --clean-cache

# View cache performance
kustommark build . --incremental --stats
```

**How it works:**

Kustomark tracks:
- Source file content hashes
- Patch operation changes
- Configuration changes
- Dependency relationships

On subsequent builds, only files affected by changes are rebuilt.

**Cache invalidation:**

The cache is automatically invalidated when:
- Source files are modified, added, or deleted
- Patches are added, removed, or modified
- Configuration (kustomark.yaml) changes
- Patch include/exclude patterns change
- Patch groups are enabled/disabled

**Cache location:**

Build cache is stored in `.kustomark/build-cache.json` next to your `kustomark.yaml` file.

**Best practices:**

1. **Add `.kustomark/` to `.gitignore`** - Cache is machine-specific
2. **Use with --parallel** - Combine for maximum performance
3. **Use --stats** - Monitor cache effectiveness
4. **Clear cache when troubleshooting** - Use `--clean-cache` flag

**Example workflow:**

```bash
# First build (no cache)
kustomark build docs/ --incremental --parallel --stats
# Output: Built 100 files in 5.2s

# Edit one markdown file
vim docs/api/endpoints.md

# Second build (with cache)
kustomark build docs/ --incremental --parallel --stats
# Output: Built 1 file in 0.3s
#         Cache hits: 99
#         Cache hit rate: 99.0%
```

**Performance gains:**

Typical speedups with incremental builds:
- **1-5 files changed:** 5-20x faster
- **Config/patch changes:** Full rebuild required
- **Large projects (100+ files):** Up to 50x faster for single-file changes

**Combining with watch mode:**

In future releases, incremental builds will integrate with watch mode for near-instant rebuilds during development.

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

## IDE Integration

Kustomark provides a VSCode extension with full Language Server Protocol (LSP) support for enhanced editing experience.

### VSCode Extension

The Kustomark VSCode extension provides:

- **Autocomplete**: Intelligent suggestions for patch operations, fields, and enum values
- **Real-time Validation**: Instant feedback on configuration errors and warnings
- **Hover Documentation**: Rich markdown documentation for all fields and operations
- **JSON Schema Integration**: Editor validation for `kustomark.yaml` files

#### Installation

**From VSIX (Local Development)**:

```bash
# Build the extension
cd vscode-extension
npm install
npm run compile
npm run package

# Install in VSCode:
# 1. Open VSCode
# 2. Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
# 3. Type "Extensions: Install from VSIX"
# 4. Select kustomark-vscode-0.1.0.vsix
```

Or use the build script:

```bash
./vscode-extension/build-extension.sh
```

**From VSCode Marketplace**: Coming soon!

#### Configuration

The extension contributes the following settings:

- `kustomark.trace.server`: Trace LSP communication (off/messages/verbose)
- `kustomark.lsp.enabled`: Enable/disable the LSP server (default: true)
- `kustomark.validation.enabled`: Enable/disable real-time validation (default: true)

#### Features

1. **Autocomplete**: Start typing in a `kustomark.yaml` file to see suggestions for:
   - Root fields: `apiVersion`, `kind`, `output`, `resources`, `patches`, `validators`
   - Patch operations: All 18 operations (replace, remove-section, etc.)
   - Common fields: `include`, `exclude`, `onNoMatch`, `group`, `id`, `extends`, `validate`

2. **Validation**: Real-time error and warning messages as you type:
   - Missing required fields
   - Invalid field values
   - Malformed git URLs
   - Schema validation errors

3. **Hover Documentation**: Hover over any field or operation to see detailed documentation with examples

### JSON Schema

For editors that support JSON Schema validation for YAML files, you can use the generated schema:

```bash
# Generate the schema
kustomark schema > kustomark.schema.json

# Configure your editor to use it for kustomark.yaml files
```

## Web UI

Kustomark includes a visual web interface for editing configurations, previewing changes, and managing patch operations through an intuitive GUI.

### Starting the Web UI

**Development Mode** (with hot-reload):

```bash
# Start both backend and frontend dev servers
kustomark web --dev

# Or using npm scripts
bun run dev:web
```

This launches:
- Backend API server: `http://localhost:3000`
- Frontend dev server: `http://localhost:5173` (with Vite hot-reload)

**Production Mode**:

```bash
# Build the web UI
bun run build:web

# Run production server
kustomark web

# Or
bun run start:web
```

Production server runs at `http://localhost:3000` and serves both API and static assets.

**Custom Configuration**:

```bash
# Custom port and host
kustomark web --port 8080 --host 0.0.0.0

# Open browser automatically
kustomark web --open

# Verbose logging
kustomark web -v
```

### Features

The Web UI provides:

1. **Visual Config Editor**
   - YAML configuration preview
   - Patch list management with drag-and-drop
   - Add, edit, delete, and reorder patches

2. **Comprehensive Patch Form**
   - Support for all 18 patch operation types
   - Context-aware field rendering based on operation
   - Common fields (id, extends, include, exclude, onNoMatch, group, validate)
   - Real-time validation

3. **Three View Modes**
   - **Editor**: YAML config with patch management
   - **Diff**: Side-by-side diff viewer showing changes
   - **Preview**: Rendered markdown preview

4. **Build Integration**
   - Execute builds with optional flags (incremental, clean, group filtering)
   - View build results and statistics
   - See validation errors and warnings

5. **File Browser** (Planned)
   - Browse resources and output files
   - View file contents and history

### Development

The Web UI is built with:

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Express, Node.js, WebSocket support
- **Components**: Monaco Editor, React Markdown, Diff Viewer

**Directory Structure**:

```
src/web/
├── client/          # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── editor/    # PatchEditor, PatchList, PatchForm
│   │   │   ├── preview/   # DiffViewer, MarkdownPreview
│   │   │   └── common/    # Button, shared components
│   │   ├── services/      # API client
│   │   └── types/         # TypeScript definitions
│   ├── package.json
│   └── vite.config.ts
└── server/          # Express backend
    ├── services/    # Build, config, file services
    ├── routes/      # API endpoints
    ├── middleware/  # Validation, error handling
    └── index.ts     # Server entry point
```

**Build Scripts**:

```bash
# Build client only
bun run build:web:client

# Build server only
bun run build:web:server

# Build both
bun run build:web

# Development mode (both servers)
bun run dev:web

# Client dev server only
bun run dev:web:client

# Server dev server only
bun run dev:web:server
```

For more details, see [WEB_UI_README.md](WEB_UI_README.md).

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
