# Kustomark

[![CI](https://github.com/dexhorthy/kustomark-ralph-bash/actions/workflows/ci.yml/badge.svg)](https://github.com/dexhorthy/kustomark-ralph-bash/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dexhorthy/kustomark-ralph-bash/actions/workflows/codeql.yml/badge.svg)](https://github.com/dexhorthy/kustomark-ralph-bash/actions/workflows/codeql.yml)

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
  - [kustomark test](#kustomark-test)
  - [kustomark init](#kustomark-init-path)
  - [kustomark debug](#kustomark-debug-path)
  - [kustomark watch](#kustomark-watch-path)
  - [kustomark suggest](#kustomark-suggest)
  - [kustomark analyze](#kustomark-analyze-path)
- [Configuration](#configuration)
- [Patch Operations](#patch-operations)
- [Table Operations](#table-operations)
- [File Operations](#file-operations)
- [Conditional Patches](#conditional-patches)
  - [Condition Types](#condition-types)
  - [Logical Operators](#logical-operators)
  - [Real-World Examples](#real-world-examples)
- [Resources](#resources)
  - [Resource Strings](#resource-strings)
  - [Resource Objects](#resource-objects)
  - [Authentication](#authentication)
  - [Integrity Verification](#integrity-verification)
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
- [API Documentation](#api-documentation)
- [IDE Integration](#ide-integration)
  - [VSCode Extension](#vscode-extension)
  - [JSON Schema](#json-schema)
- [Web UI](#web-ui)
  - [Starting the Web UI](#starting-the-web-ui)
  - [Features](#features-1)
  - [Development](#development-1)
- [Watch Mode](#watch-mode)
  - [Starting Watch Mode](#starting-watch-mode)
  - [Watch Mode Hooks](#watch-mode-hooks)
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

# Preview changes without writing files
kustomark build ./team/ --dry-run

# Verbose output
kustomark build ./team/ -v
```

**Options:**
- `--format <text|json>` - Output format (default: text)
- `--clean` - Remove output files not in source
- `--dry-run` - Preview changes without writing files
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

### `kustomark test`

Test patches against markdown content without creating full configurations. Perfect for prototyping patches, debugging complex operations, and creating regression test suites.

```bash
# Run a test suite file
kustomark test --suite tests/patch-tests.yaml

# Test inline patch with file input
kustomark test --patch "op: replace
old: foo
new: bar" --input doc.md

# Test inline patch with inline content
kustomark test --patch "op: replace
old: hello
new: goodbye" --content "hello world"

# Test patches from file
kustomark test --patch-file patches.yaml --input sample.md

# Get JSON output
kustomark test --suite tests.yaml --format=json

# Strict mode (fail on any test failure)
kustomark test --suite tests.yaml --strict
```

**Options:**
- `--suite <file>` - Run a test suite file (YAML)
- `--patch <yaml>` - Test a single inline patch (YAML string)
- `--patch-file <file>` - Test patches from a file
- `--input <file>` - Input markdown file to test against
- `--content <string>` - Inline markdown content to test against
- `--format <text|json>` - Output format (default: text)
- `--show-steps` - Show intermediate results for multi-patch sequences
- `--strict` - Exit with code 1 if any test fails
- `-v` - Verbose output with details

**Exit code:** Returns 0 if all tests pass, 1 if any test fails.

**Test Suite Format:**

```yaml
apiVersion: kustomark/v1
kind: PatchTestSuite

tests:
  - name: "Replace company name"
    input: |
      # Welcome to ACME Corp
      ACME Corp is the best!
    patches:
      - op: replace
        old: "ACME Corp"
        new: "TechCorp"
    expected: |
      # Welcome to TechCorp
      TechCorp is the best!

  - name: "Remove deprecated section"
    input: |
      ## Features
      Great features here
      ## Deprecated
      Old stuff
      ## Installation
      Install guide
    patches:
      - op: remove-section
        id: deprecated
    expected: |
      ## Features
      Great features here
      ## Installation
      Install guide
```

**Use Cases:**
- **Patch Development:** Test patches before adding them to configurations
- **Debugging:** Understand why a patch isn't matching expected content
- **Regression Testing:** Create test suites to ensure patches work correctly
- **Documentation:** Share reproducible examples with teams
- **Learning:** Experiment with patch operations interactively

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

### `kustomark debug [path]`

Interactive patch debugging mode for step-by-step inspection and decision-making.

```bash
# Interactive mode - step through each patch
kustomark debug ./team/

# Debug patches for a specific file only
kustomark debug ./team/ --file guide.md

# Auto-apply mode with saved decisions
kustomark debug ./team/ --auto-apply --load-decisions decisions.json

# Save decisions for replay
kustomark debug ./team/ --save-decisions decisions.json

# Combine: load previous decisions and save updates
kustomark debug ./team/ --load-decisions prev.json --save-decisions updated.json

# JSON output
kustomark debug ./team/ --format=json
```

**Options:**
- `--auto-apply` - Automatically apply all patches without prompting
- `--file <filename>` - Debug only patches affecting a specific file
- `--save-decisions <path>` - Save apply/skip decisions to a file
- `--load-decisions <path>` - Load previous decisions from a file
- `--format <text|json>` - Output format (default: text)
- `-v`, `-vv`, `-vvv` - Increase verbosity

**Interactive Mode:**

When running without `--auto-apply`, debug mode presents each patch interactively:

```
============================================================
Patch 1 of 5
============================================================
File: guide.md
Operation: replace
Patch Index: 0

Patch Details:
{
  "op": "replace",
  "old": "upstream",
  "new": "local"
}

File Preview (first 10 lines):
# Guide
This is upstream documentation...

Options:
  a - Apply this patch
  s - Skip this patch
  q - Quit debug session

Your choice (a/s/q):
```

**Auto-Apply Mode:**

Use `--auto-apply` for non-interactive execution. Optionally load previous decisions with `--load-decisions` to replay a previous debug session.

**Decision Files:**

Decisions are saved in JSON format and can be replayed:

```json
[
  {
    "file": "guide.md",
    "patchIndex": 0,
    "action": "apply"
  },
  {
    "file": "guide.md",
    "patchIndex": 1,
    "action": "skip"
  }
]
```

**Use Cases:**
- Test patches interactively before committing config changes
- Troubleshoot why specific patches aren't being applied
- Create reproducible patch application workflows
- Debug complex overlay configurations with many patches

### `kustomark watch [path]`

Monitor files for changes and automatically rebuild output.

```bash
# Start watch mode
kustomark watch ./team/

# Watch with custom debounce interval (default: 300ms)
kustomark watch ./team/ --debounce=500

# Watch with JSON output for integration
kustomark watch ./team/ --format=json

# Disable watch hooks for security
kustomark watch ./team/ --no-hooks

# Watch with verbose logging
kustomark watch ./team/ -vv
```

**Options:**
- `--debounce <ms>` - Debounce interval in milliseconds (default: 300)
- `--no-hooks` - Disable watch hooks for security (prevents executing shell commands)
- `--format <text|json>` - Output format (default: text)
- `-v`, `-vv`, `-vvv` - Increase verbosity
- `-q` - Quiet mode (errors only)

**How it works:**

1. Performs initial build when started
2. Watches all source files and the configuration file for changes
3. Debounces rapid changes to avoid excessive rebuilds
4. Executes configured hooks (onBuild, onError, onChange) unless disabled
5. Continues watching until interrupted (Ctrl+C)

**JSON Output:**

With `--format=json`, watch mode outputs newline-delimited JSON events:

```json
{"event":"build","success":true,"filesWritten":5,"patchesApplied":12,"timestamp":"2024-01-15T10:30:45.123Z"}
{"event":"build","success":false,"error":"Invalid configuration","timestamp":"2024-01-15T10:31:02.456Z"}
```

**Use Cases:**
- Development workflow with auto-rebuild
- Integration with deployment pipelines
- Continuous documentation updates
- Running tests or notifications on file changes

See [Watch Mode Hooks](#watch-mode-hooks) for advanced automation with shell commands.

### `kustomark suggest`

Generate patch configuration from differences between source and target files. This command intelligently analyzes file differences and automatically creates kustomark.yaml configurations, helping you convert manual edits into automated patch pipelines.

```bash
# Analyze differences between two files
kustomark suggest --source original.md --target modified.md

# Generate config from directory comparison
kustomark suggest --source upstream/ --target customized/

# Save generated config to file
kustomark suggest --source docs/ --target team-docs/ --output kustomark.yaml

# Get suggestions as JSON
kustomark suggest --source old.md --target new.md --format=json

# Verbose output with statistics
kustomark suggest --source upstream/ --target custom/ -v

# Filter low-confidence patches (only show high-confidence suggestions)
kustomark suggest --source old.md --target new.md --min-confidence=0.8
```

**Options:**
- `--source <path>` - Source file or directory (before state) - **required**
- `--target <path>` - Target file or directory (after state) - **required**
- `--output <path>` - Write generated config to file
- `--min-confidence <0.0-1.0>` - Filter patches below confidence threshold (e.g., 0.8 for high-confidence only)
- `--format <text|json>` - Output format (default: text)
- `-v`, `-vv`, `-vvv` - Increase verbosity for more details
- `-q` - Quiet mode (errors only)

**What it detects:**
- **Frontmatter changes** - Generates `set-frontmatter`, `remove-frontmatter` operations
- **Section modifications** - Generates `rename-header`, `remove-section`, `replace-section` operations
- **Pattern replacements** - Detects repeated changes and generates `replace-regex` operations
- **Line edits** - Generates `replace`, `insert-after-line`, `delete-between` operations

**Confidence scoring:**
- **High (0.9+):** Frontmatter and section operations
- **Medium (0.7+):** Pattern-based replacements
- **Lower (<0.7):** Line-level edits

**Example workflow - Fork upstream documentation:**

```bash
# 1. Clone upstream docs
git clone https://github.com/vendor/docs upstream-docs/

# 2. Make your customizations manually
cp -r upstream-docs/ our-docs/
# ... edit files in our-docs/ ...

# 3. Generate patches from differences
kustomark suggest --source upstream-docs/ --target our-docs/ --output kustomark.yaml

# 4. Review generated config
cat kustomark.yaml

# 5. Build using generated config
kustomark build

# 6. When upstream updates, just pull and rebuild
cd upstream-docs && git pull
kustomark build
```

**Example output:**

```yaml
apiVersion: kustomark/v1
kind: Kustomization
output: ./output
resources:
  - ./upstream-docs/
patches:
  - op: set-frontmatter
    key: author
    value: Your Team
  - op: replace-regex
    pattern: 'vendor\.com'
    replacement: 'yourcompany.com'
    flags: g
  - op: rename-header
    header: Installation
    newText: Getting Started
```

**Use cases:**

1. **Learning kustomark syntax:** Make manual changes and see the equivalent patch operations
2. **Migration from manual editing:** Convert existing customizations to automated patches
3. **Quick prototyping:** Experiment with manual edits, then generate patches
4. **Upstream forks:** Automate customization of vendor documentation

**Tips:**

- Review generated patches - they're starting points, not perfect solutions
- Combine automatic suggestions with manual refinements
- Test with `kustomark diff` to verify behavior
- Start with single-file comparisons before scaling to directories

**JSON Output:**

With `--format=json`, outputs structured data with the generated config and statistics:

```json
{
  "config": {
    "apiVersion": "kustomark/v1",
    "kind": "Kustomization",
    "output": "./output",
    "resources": ["./source"],
    "patches": [...]
  },
  "stats": {
    "filesAnalyzed": 5,
    "patchesGenerated": 12,
    "confidence": "high"
  }
}
```

### `kustomark analyze [path]`

Analyze patch configuration for coverage, impact, complexity, and safety metrics. This command provides comprehensive insights into your kustomark configuration, helping you understand patch effectiveness, identify potential issues, and optimize your configuration.

```bash
# Basic usage - analyze current directory
kustomark analyze .

# JSON output for programmatic processing
kustomark analyze . --format=json

# Filter to show only high-risk operations
kustomark analyze . --min-risk=high

# Sort by complexity with verbose output
kustomark analyze . --sort=complexity -vv

# Quiet mode (errors only)
kustomark analyze . -q

# Maximum verbosity for detailed insights
kustomark analyze . -vvv
```

**Options:**
- `--format <text|json>` - Output format (default: text)
- `--min-risk <low|medium|high>` - Filter to minimum risk level
- `--sort <risk|complexity|impact|coverage>` - Sort results by field
- `-v`, `-vv`, `-vvv` - Increase verbosity (show more details)
- `-q` - Quiet mode (errors only)

**Analysis Types:**

The analyze command provides four types of analysis:

1. **Coverage Analysis** - Measures how many files are affected by patches
   - Total files in configuration
   - Files with patches vs. files without patches
   - Coverage percentage
   - Lists of patched and unpatched files (with `-vv` and `-vvv`)

2. **Impact Analysis** - Evaluates the scope of patch operations
   - Total number of patches
   - Total affected files
   - Files with multiple patches (potential conflicts)
   - Per-patch impact details (with `-vvv`)

3. **Complexity Analysis** - Assesses configuration complexity
   - Average, minimum, and maximum complexity scores
   - Top most complex files
   - Patch count and operation types per file
   - High-risk operation counts

4. **Safety Analysis** - Identifies potentially risky patches
   - Risk level distribution (high/medium/low)
   - Average risk score
   - Detailed risk reasons and affected files (with `-vv`)
   - Recommendations for safer alternatives

**Filtering and Sorting:**

Use `--min-risk` to focus on patches above a certain risk threshold:
- `--min-risk=high` - Show only high-risk patches
- `--min-risk=medium` - Show medium and high-risk patches
- `--min-risk=low` - Show all patches (default)

Use `--sort` to order results by different criteria:
- `--sort=risk` - Sort by risk score (highest first)
- `--sort=complexity` - Sort by complexity score (most complex first)
- `--sort=impact` - Sort by number of affected files
- `--sort=coverage` - Sort by coverage metrics

**Verbosity Levels:**

- Default: Summary statistics and overall assessment
- `-v`: Add lists of top complex files and high-risk patches
- `-vv`: Add detailed patch-by-patch breakdown
- `-vvv`: Add complete file lists and operation details
- `-q`: Suppress all output except errors

**Example Output:**

```
=== COVERAGE ANALYSIS ===
Total files: 42
Files with patches: 38 (90.5%)
Files without patches: 4

=== IMPACT ANALYSIS ===
Total patches: 15
Total affected files: 38
Files with multiple patches: 5

=== COMPLEXITY ANALYSIS ===
Total files: 42
Average complexity: 4.2
Max complexity: 12.5
Min complexity: 1.0

=== SAFETY ANALYSIS ===
Total patches: 15
High-risk patches: 2
Medium-risk patches: 5
Low-risk patches: 8
Average risk score: 4.3/10

=== SUMMARY ===
Coverage: GOOD (90.5%)
Overall risk: MEDIUM (2 high-risk patches)
Complexity: LOW (avg: 4.2)

Warning: 5 file(s) have multiple patches - consider reviewing for conflicts
```

**JSON Output:**

With `--format=json`, outputs structured data for programmatic analysis:

```json
{
  "success": true,
  "coverage": {
    "totalFiles": 42,
    "filesWithPatches": 38,
    "filesWithoutPatches": 4,
    "coveragePercentage": 90.5,
    "unpatchedFiles": ["file1.md", "file2.md"],
    "patchedFiles": ["file3.md", "file4.md"]
  },
  "impact": {
    "totalPatches": 15,
    "totalAffectedFiles": 38,
    "patches": [...],
    "multiPatchFiles": {
      "guide.md": 3,
      "readme.md": 2
    }
  },
  "complexity": {
    "totalFiles": 42,
    "averageComplexity": 4.2,
    "maxComplexity": 12.5,
    "minComplexity": 1.0,
    "files": [...],
    "topComplexFiles": [...]
  },
  "safety": {
    "totalPatches": 15,
    "highRiskPatches": 2,
    "mediumRiskPatches": 5,
    "lowRiskPatches": 8,
    "averageRiskScore": 4.3,
    "patches": [...],
    "highestRiskPatches": [...]
  }
}
```

**Use Cases:**

- **Configuration Review:** Understand the impact of your patches before deployment
- **Risk Assessment:** Identify high-risk operations that need careful testing
- **Optimization:** Find overly complex configurations that could be simplified
- **Coverage Gaps:** Discover files that should have patches but don't
- **CI/CD Integration:** Automate configuration quality checks with JSON output
- **Documentation:** Generate reports on configuration characteristics

**Exit Code:** Returns 0 on success, 1 on error (e.g., config file not found).

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

### `rename-header` - Rename Section Headers

Rename a section header while preserving its level and custom IDs.

```yaml
- op: rename-header
  id: old-section-name
  newText: "New Section Name"
```

**Example:**

Input:
```markdown
## Getting Started

Welcome to our guide.

## Installation {#install}

Install instructions here.
```

Output:
```markdown
## Getting Started

Welcome to our guide.

## Setup Instructions {#install}

Install instructions here.
```

**Notes:**
- Preserves the header level (e.g., `##` stays `##`)
- Preserves custom IDs if present (e.g., `{#custom-id}`)
- Only renames the header text, not the section content

### `move-section` - Move Section to New Position

Move a section (with all its children) to a new position in the document.

```yaml
- op: move-section
  id: section-to-move
  beforeId: target-section  # or use afterId
```

**Example:**

Input:
```markdown
## Introduction

Welcome!

## Installation

Install instructions.

## Configuration

Config instructions.

## Usage

Usage instructions.
```

Using `beforeId`:
```yaml
- op: move-section
  id: usage
  beforeId: installation
```

Output:
```markdown
## Introduction

Welcome!

## Usage

Usage instructions.

## Installation

Install instructions.

## Configuration

Config instructions.
```

**Notes:**
- Use `beforeId` to place before a target section
- Use `afterId` to place after a target section
- Moves the entire section including all subsections
- Section IDs are GitHub-style slugs (e.g., `## Installation` → `installation`)

### `change-section-level` - Promote/Demote Section Headers

Change the header level of a section (and optionally its children).

```yaml
- op: change-section-level
  id: subsection
  levelChange: -1  # -1 to promote (## → #), +1 to demote (## → ###)
  adjustChildren: true  # default: false
```

**Example:**

Input:
```markdown
# Main Title

## Section

### Subsection

Content here.

#### Deep Subsection

More content.
```

Using `levelChange: -1` to promote "Subsection":
```yaml
- op: change-section-level
  id: subsection
  levelChange: -1
  adjustChildren: true
```

Output:
```markdown
# Main Title

## Section

## Subsection

Content here.

### Deep Subsection

More content.
```

**Notes:**
- Positive `levelChange` demotes (adds `#`), negative promotes (removes `#`)
- `adjustChildren: true` adjusts all subsections by the same amount
- Header levels are clamped to valid range (1-6)

## Frontmatter Operations

Frontmatter operations allow you to manipulate YAML frontmatter at the beginning of markdown files. These operations support dot notation for nested keys (e.g., `metadata.author`).

### `set-frontmatter` - Set Frontmatter Field

Set or update a frontmatter field with a new value.

```yaml
- op: set-frontmatter
  key: author
  value: "Jane Doe"
```

**Nested keys with dot notation:**

```yaml
- op: set-frontmatter
  key: metadata.lastUpdated
  value: "2026-01-02"
```

**Example:**

Input:
```markdown
---
title: "My Document"
---

# My Document

Content here.
```

Output:
```markdown
---
title: "My Document"
author: "Jane Doe"
---

# My Document

Content here.
```

**Setting nested values:**

Input:
```markdown
---
title: "My Document"
---
```

Using:
```yaml
- op: set-frontmatter
  key: metadata.author
  value: "Jane Doe"
```

Output:
```markdown
---
title: "My Document"
metadata:
  author: "Jane Doe"
---
```

### `remove-frontmatter` - Remove Frontmatter Field

Remove a field from the frontmatter.

```yaml
- op: remove-frontmatter
  key: draft
```

**Example:**

Input:
```markdown
---
title: "My Document"
draft: true
author: "Jane Doe"
---

# My Document
```

Output:
```markdown
---
title: "My Document"
author: "Jane Doe"
---

# My Document
```

**Removing nested fields:**

```yaml
- op: remove-frontmatter
  key: metadata.internal
```

### `rename-frontmatter` - Rename Frontmatter Field

Rename a frontmatter field while preserving its value.

```yaml
- op: rename-frontmatter
  oldKey: author
  newKey: creator
```

**Example:**

Input:
```markdown
---
title: "My Document"
author: "Jane Doe"
---

# My Document
```

Output:
```markdown
---
title: "My Document"
creator: "Jane Doe"
---

# My Document
```

**Renaming nested fields:**

```yaml
- op: rename-frontmatter
  oldKey: metadata.author
  newKey: metadata.creator
```

### `merge-frontmatter` - Merge Frontmatter Object

Merge an object into the frontmatter, combining with existing values.

```yaml
- op: merge-frontmatter
  values:
    tags:
      - documentation
      - guide
    metadata:
      version: "1.0"
```

**Example:**

Input:
```markdown
---
title: "My Document"
tags:
  - tutorial
---

# My Document
```

Output:
```markdown
---
title: "My Document"
tags:
  - documentation
  - guide
metadata:
  version: "1.0"
---

# My Document
```

**Notes:**
- Arrays are replaced (not concatenated)
- Objects are shallow merged
- Existing keys are overwritten by new values

## Line Operations

Line operations allow precise manipulation of content at the line level, using exact string matching or regular expressions.

### `insert-after-line` - Insert Content After Matching Line

Insert content after the first line matching a pattern.

```yaml
- op: insert-after-line
  match: "## Installation"
  content: |

    > **Note:** Requires Node.js 18 or higher.
```

**Using regex:**

```yaml
- op: insert-after-line
  regex: "^npm install"
  content: |
    npm run build
```

**Example:**

Input:
```markdown
## Installation

Run the following command:

npm install kustomark
```

Output:
```markdown
## Installation

Run the following command:

npm install kustomark
npm run build
```

### `insert-before-line` - Insert Content Before Matching Line

Insert content before the first line matching a pattern.

```yaml
- op: insert-before-line
  match: "## Usage"
  content: |

    ## Prerequisites

    Make sure you have completed installation first.
```

**Example:**

Input:
```markdown
## Installation

Install instructions here.

## Usage

Usage instructions here.
```

Output:
```markdown
## Installation

Install instructions here.

## Prerequisites

Make sure you have completed installation first.

## Usage

Usage instructions here.
```

### `replace-line` - Replace Matching Line

Replace the first line matching a pattern with new content.

```yaml
- op: replace-line
  match: "Version: 1.0.0"
  replacement: "Version: 2.0.0"
```

**Using regex with capture groups:**

```yaml
- op: replace-line
  regex: "^Version: (\\d+)\\.(\\d+)\\.(\\d+)"
  replacement: "Version: $1.$2.1"
```

**Example:**

Input:
```markdown
# My Project

Version: 1.0.0

A great project.
```

Output:
```markdown
# My Project

Version: 2.0.0

A great project.
```

### `delete-between` - Delete Lines Between Markers

Delete all lines between two markers (inclusive or exclusive).

```yaml
- op: delete-between
  startMatch: "<!-- BEGIN REMOVE -->"
  endMatch: "<!-- END REMOVE -->"
  includeStart: true  # default: true
  includeEnd: true    # default: true
```

**Example:**

Input:
```markdown
# My Document

Some content here.

<!-- BEGIN REMOVE -->
This section is temporary.
It should be removed.
<!-- END REMOVE -->

More content here.
```

Output:
```markdown
# My Document

Some content here.

More content here.
```

**Exclusive mode (keeping markers):**

```yaml
- op: delete-between
  startMatch: "<!-- BEGIN REMOVE -->"
  endMatch: "<!-- END REMOVE -->"
  includeStart: false
  includeEnd: false
```

Output:
```markdown
# My Document

Some content here.

<!-- BEGIN REMOVE -->
<!-- END REMOVE -->

More content here.
```

### `replace-between` - Replace Content Between Markers

Replace all content between two markers with new content.

```yaml
- op: replace-between
  startMatch: "<!-- BEGIN CONFIG -->"
  endMatch: "<!-- END CONFIG -->"
  replacement: |
    config:
      enabled: true
      mode: production
  includeStart: false  # default: false
  includeEnd: false    # default: false
```

**Example:**

Input:
```markdown
# Configuration

<!-- BEGIN CONFIG -->
config:
  enabled: false
  mode: development
<!-- END CONFIG -->

# Usage
```

Output:
```markdown
# Configuration

<!-- BEGIN CONFIG -->
config:
  enabled: true
  mode: production
<!-- END CONFIG -->

# Usage
```

**Notes:**
- `includeStart: true` replaces the start marker too
- `includeEnd: true` replaces the end marker too
- Supports both exact string matching and regex patterns

## Table Operations

Table operations allow you to manipulate GitHub Flavored Markdown tables. Tables can be identified by their zero-based index in the document or by the section ID containing the table.

### `replace-table-cell` - Replace Content in Table Cell

Replace the content of a specific cell in a table.

```yaml
- op: replace-table-cell
  table: 0              # Table identifier (index or section ID)
  row: 0                # Row identifier (index or search criteria)
  column: "Age"         # Column identifier (index or header name)
  content: "31"
```

**Table Identification:**
- By index: `table: 0` (first table in document)
- By section: `table: "team-members"` (table in section with ID "team-members")

**Row Identification:**
- By index: `row: 0` (first data row, 0-based)
- By search criteria: `row: { column: "Name", value: "Alice" }` (first row where column "Name" equals "Alice")

**Column Identification:**
- By index: `column: 0` (first column, 0-based)
- By header name: `column: "Age"` (column with header "Age")

**Example:**

Input:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 30  | NYC  |
| Bob   | 25  | LA   |
```

After applying:
```yaml
- op: replace-table-cell
  table: 0
  row: { column: "Name", value: "Alice" }
  column: "Age"
  content: "31"
```

Output:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 31  | NYC  |
| Bob   | 25  | LA   |
```

### `add-table-row` - Add Row to Table

Add a new row to a table at a specified position.

```yaml
- op: add-table-row
  table: 0
  values: ["Charlie", "35", "SF"]
  position: -1          # Optional: -1 or omit for end, 0 for beginning
```

**Position Parameter:**
- Omitted or `-1`: Append to end of table (default)
- `0`: Insert at beginning
- Any number: Insert at that position (0-based)

**Example:**

Input:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 30  | NYC  |
| Bob   | 25  | LA   |
```

After applying:
```yaml
- op: add-table-row
  table: 0
  values: ["Charlie", "35", "SF"]
```

Output:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 30  | NYC  |
| Bob   | 25  | LA   |
| Charlie | 35  | SF   |
```

**Notes:**
- Values array must match the number of columns in the table
- Use empty strings for empty cells: `["Name", "", "City"]`

### `remove-table-row` - Remove Row from Table

Remove a row from a table by index or search criteria.

```yaml
- op: remove-table-row
  table: 0
  row: 1                # Row identifier (index or search criteria)
```

**Row Identification:**
- By index: `row: 1` (second data row, 0-based)
- By search criteria: `row: { column: "Name", value: "Bob" }` (first row where column "Name" equals "Bob")

**Example with search criteria:**

Input:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 30  | NYC  |
| Bob   | 25  | LA   |
| Carol | 28  | SF   |
```

After applying:
```yaml
- op: remove-table-row
  table: 0
  row: { column: "Name", value: "Bob" }
```

Output:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 30  | NYC  |
| Carol | 28  | SF   |
```

### `add-table-column` - Add Column to Table

Add a new column to a table with an optional default value for all rows.

```yaml
- op: add-table-column
  table: 0
  header: "Email"
  defaultValue: "N/A"   # Optional: default value for all rows
  position: -1          # Optional: -1 or omit for end, 0 for beginning
```

**Position Parameter:**
- Omitted or `-1`: Append to end (default)
- `0`: Insert at beginning
- Any number: Insert at that position (0-based)

**Example:**

Input:
```markdown
| Name  | Age | City |
|-------|-----|------|
| Alice | 30  | NYC  |
| Bob   | 25  | LA   |
```

After applying:
```yaml
- op: add-table-column
  table: 0
  header: "Email"
  defaultValue: ""
```

Output:
```markdown
| Name  | Age | City | Email |
|-------|-----|------|-------|
| Alice | 30  | NYC  |       |
| Bob   | 25  | LA   |       |
```

**Notes:**
- If `defaultValue` is omitted, empty strings are used
- The column will be added to all rows in the table

### `remove-table-column` - Remove Column from Table

Remove a column from a table by index or header name.

```yaml
- op: remove-table-column
  table: 0
  column: "Age"         # Column identifier (index or header name)
```

**Column Identification:**
- By index: `column: 1` (second column, 0-based)
- By header name: `column: "Age"` (column with header "Age")

**Example:**

Input:
```markdown
| Name  | Age | City | Email |
|-------|-----|------|-------|
| Alice | 30  | NYC  | a@example.com |
| Bob   | 25  | LA   | b@example.com |
```

After applying:
```yaml
- op: remove-table-column
  table: 0
  column: "Age"
```

Output:
```markdown
| Name  | City | Email |
|-------|------|-------|
| Alice | NYC  | a@example.com |
| Bob   | LA   | b@example.com |
```

**Notes:**
- Removing a column affects all rows in the table
- The header row and alignment row are also updated

## File Operations

File operations allow you to manipulate files during the build process. These operations work on the file map (source files to output paths) and support glob pattern matching.

### `copy-file` - Copy File to New Location

Copy a source file to a destination path, creating a duplicate in the output.

```yaml
- op: copy-file
  src: ./templates/header.md
  dest: shared/header.md
```

**Example:**

Input file map:
```
templates/header.md → templates/header.md
```

Output file map (after copy):
```
templates/header.md → shared/header.md
```

The original file still exists at its original location. The destination path is relative to the output directory.

**Use cases:**
- Copy template files to multiple locations
- Duplicate shared content across directories
- Create backups before applying transformations

### `rename-file` - Rename Files by Pattern

Rename files matching a glob pattern. Only the filename (basename) is changed, the directory path is preserved.

```yaml
- op: rename-file
  match: "**/SKILL.md"
  rename: "skill.md"
```

**Example:**

Input file map:
```
tools/create-research/SKILL.md → tools/create-research/SKILL.md
tools/task-manager/SKILL.md → tools/task-manager/SKILL.md
```

Output file map (after rename):
```
tools/create-research/SKILL.md → tools/create-research/skill.md
tools/task-manager/SKILL.md → tools/task-manager/skill.md
```

**Glob pattern matching:**
- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/`
- `?` - Matches exactly one character
- `[abc]` - Matches any character in the set

**Use cases:**
- Standardize filenames (e.g., UPPERCASE to lowercase)
- Rename files from upstream sources to match your conventions
- Bulk rename files based on patterns

### `delete-file` - Delete Files by Pattern

Delete files matching a glob pattern from the output.

```yaml
- op: delete-file
  match: "**/DEPRECATED-*.md"
```

**Example:**

Input file map:
```
docs/guide.md → docs/guide.md
docs/DEPRECATED-old-api.md → docs/DEPRECATED-old-api.md
examples/DEPRECATED-example.md → examples/DEPRECATED-example.md
```

Output file map (after delete):
```
docs/guide.md → docs/guide.md
```

Files matching the pattern are removed from the output entirely.

**Use cases:**
- Remove unwanted files from upstream sources
- Filter out deprecated documentation
- Clean up temporary or generated files

### `move-file` - Move Files to New Directory

Move files matching a glob pattern to a new directory. The filename is preserved, only the directory changes.

```yaml
- op: move-file
  match: "**/references/*.md"
  dest: docs/references/
```

**Example:**

Input file map:
```
tools/references/api.md → tools/references/api.md
skills/references/guide.md → skills/references/guide.md
docs/index.md → docs/index.md
```

Output file map (after move):
```
tools/references/api.md → docs/references/api.md
skills/references/guide.md → docs/references/guide.md
docs/index.md → docs/index.md
```

All matching files are moved to the specified destination directory, preserving their filenames.

**Use cases:**
- Reorganize file structure from upstream sources
- Consolidate scattered files into a single directory
- Move files to match your preferred directory layout

### Common Patterns

File operations work with the same common fields as other patch operations:

```yaml
- op: delete-file
  match: "**/test-*.md"
  include: "docs/**/*.md"    # Only apply to files in docs/
  exclude: "docs/tests/**"    # But not in docs/tests/
  onNoMatch: warn             # Warn if no files match
```

### Real-World Example

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - github.com/org/upstream-repo//skills?ref=v1.0.0

patches:
  # Rename all SKILL.md files to skill.md
  - op: rename-file
    match: "**/SKILL.md"
    rename: "skill.md"

  # Remove deprecated examples
  - op: delete-file
    match: "**/examples/deprecated-*.md"

  # Move all reference docs to a central location
  - op: move-file
    match: "**/references/*.md"
    dest: docs/api-reference/

  # Copy shared template to multiple locations
  - op: copy-file
    src: templates/footer.md
    dest: shared/footer.md

  # Apply content patches
  - op: replace
    old: "upstream-url"
    new: "our-url"
```

This configuration:
1. Fetches upstream skills from a git repository
2. Renames all `SKILL.md` files to lowercase `skill.md`
3. Removes deprecated examples
4. Consolidates reference docs into `docs/api-reference/`
5. Copies a template file
6. Applies content transformations

## Conditional Patches

Apply patches selectively based on file content and frontmatter using the `when` field. Conditions are evaluated per-file, making patch application deterministic and predictable.

### Overview

Conditional patches allow you to:
- Apply patches only to files matching specific conditions
- Create environment-specific transformations
- Build content-aware documentation pipelines
- Maintain a single configuration for multiple contexts

All condition evaluation is deterministic - the same file content always produces the same result.

### Basic Syntax

Add a `when` field to any patch operation:

```yaml
patches:
  - op: replace
    old: "development"
    new: "PRODUCTION"
    when:
      fileContains: "environment: production"
```

### Condition Types

#### `fileContains` - Content Substring Match

Checks if file content contains a specific substring (case-sensitive).

```yaml
when:
  fileContains: "production"
```

**Example:**
```yaml
patches:
  # Add production warning banner
  - op: prepend-to-section
    id: overview
    content: "\n> **Production**: Handle with care\n"
    when:
      fileContains: "production environment"
```

#### `fileMatches` - Regex Pattern Match

Checks if file content matches a regular expression pattern.

```yaml
when:
  fileMatches: "version\\s+\\d+\\.\\d+\\.\\d+"
```

**With regex flags:**
```yaml
when:
  fileMatches: "/production/i"  # Case-insensitive
```

**Example:**
```yaml
patches:
  # Update version numbers
  - op: replace-regex
    pattern: "v(\\d+)\\.(\\d+)\\.(\\d+)"
    replacement: "v$1.$2.0"
    when:
      fileMatches: "\\bv\\d+\\.\\d+\\.\\d+\\b"
```

#### `frontmatterEquals` - Frontmatter Value Match

Checks if a frontmatter key equals a specific value (supports deep equality).

```yaml
when:
  frontmatterEquals:
    key: "environment"
    value: "production"
```

**Nested keys with dot notation:**
```yaml
when:
  frontmatterEquals:
    key: "config.server.mode"
    value: "production"
```

**Complex values:**
```yaml
when:
  frontmatterEquals:
    key: "platforms"
    value: ["windows", "linux", "macos"]
```

**Example:**
```yaml
patches:
  # Production-specific API endpoint
  - op: replace
    old: "http://localhost:3000"
    new: "https://api.example.com"
    when:
      frontmatterEquals:
        key: "environment"
        value: "production"
```

#### `frontmatterExists` - Frontmatter Key Existence

Checks if a frontmatter key exists (regardless of value).

```yaml
when:
  frontmatterExists: "beta"
```

**Example:**
```yaml
patches:
  # Add beta warning to experimental features
  - op: prepend-to-section
    id: features
    content: "\n> **Beta**: This feature is experimental\n"
    when:
      frontmatterExists: "beta"
```

### Logical Operators

#### `not` - Logical Negation

Negates a condition.

```yaml
when:
  not:
    fileContains: "draft"
```

**Example:**
```yaml
patches:
  # Remove internal notes from published docs
  - op: remove-section
    id: internal-notes
    when:
      not:
        frontmatterEquals:
          key: "internal"
          value: true
```

#### `anyOf` - Logical OR

Matches if **any** sub-condition is true.

```yaml
when:
  anyOf:
    - fileContains: "production"
    - fileContains: "staging"
```

**Example:**
```yaml
patches:
  # Apply to both production and staging
  - op: replace
    old: "development endpoint"
    new: "live endpoint"
    when:
      anyOf:
        - frontmatterEquals:
            key: "environment"
            value: "production"
        - frontmatterEquals:
            key: "environment"
            value: "staging"
```

#### `allOf` - Logical AND

Matches if **all** sub-conditions are true.

```yaml
when:
  allOf:
    - frontmatterEquals:
        key: "published"
        value: true
    - fileContains: "API documentation"
```

**Example:**
```yaml
patches:
  # Only apply to published production docs
  - op: append-to-section
    id: footer
    content: "\n---\nLast updated: 2024-01-15"
    when:
      allOf:
        - frontmatterEquals:
            key: "environment"
            value: "production"
        - frontmatterEquals:
            key: "published"
            value: true
```

### Nested Conditions

Combine logical operators for complex conditions:

```yaml
when:
  allOf:
    # Must be production OR staging
    - anyOf:
        - frontmatterEquals:
            key: "environment"
            value: "production"
        - frontmatterEquals:
            key: "environment"
            value: "staging"
    # Must be published
    - frontmatterEquals:
        key: "published"
        value: true
    # Must NOT be a draft
    - not:
        frontmatterExists: "draft"
    # Must mention version number
    - fileMatches: "\\d+\\.\\d+\\.\\d+"
```

### Real-World Examples

#### Environment-Specific API Documentation

```yaml
patches:
  # Development environment
  - op: replace
    old: "{{API_URL}}"
    new: "http://localhost:3000"
    when:
      frontmatterEquals:
        key: "environment"
        value: "development"

  # Production environment
  - op: replace
    old: "{{API_URL}}"
    new: "https://api.example.com"
    when:
      frontmatterEquals:
        key: "environment"
        value: "production"
```

#### Content-Aware Transformations

```yaml
patches:
  # Add installation steps only for docs mentioning "install"
  - op: append-to-section
    id: getting-started
    content: |

      ## Installation

      ```bash
      npm install awesome-project
      ```
    when:
      allOf:
        - fileMatches: "\\binstall\\b"
        - not:
            fileContains: "Installation"
```

#### Security Level Based Content Masking

```yaml
patches:
  # Remove confidential sections from public docs
  - op: remove-section
    id: internal-implementation
    when:
      not:
        frontmatterEquals:
          key: "security_level"
          value: "confidential"

  # Add confidential warning banner
  - op: prepend-to-section
    id: overview
    content: "\n> **Confidential**: Internal use only\n"
    when:
      frontmatterEquals:
        key: "security_level"
        value: "confidential"
```

#### Version-Specific Documentation

```yaml
patches:
  # v2.x specific content
  - op: replace-section
    id: api-reference
    content: |
      ## API Reference (v2.x)

      The v2 API uses REST endpoints...
    when:
      allOf:
        - frontmatterEquals:
            key: "version"
            value: "2.x"
        - fileMatches: "\\bv2\\b"

  # v1.x deprecation notice
  - op: prepend-to-section
    id: api-reference
    content: "\n> **Deprecated**: v1 API is deprecated\n"
    when:
      frontmatterEquals:
        key: "version"
        value: "1.x"
```

### Use Cases

1. **Multi-Environment Documentation**: Maintain one set of docs with environment-specific content
2. **Feature Flags**: Show/hide documentation sections based on feature availability
3. **Localization**: Apply language-specific transformations
4. **Security Levels**: Redact sensitive content for different audiences
5. **Version Management**: Customize docs for different product versions
6. **Platform-Specific Instructions**: Tailor content for Windows/Linux/macOS
7. **Beta Features**: Add warnings or special formatting for experimental features

### Important Notes

**Deterministic Evaluation:**
- Conditions are evaluated per-file based on content and frontmatter only
- No environment variables or external state
- Same file always produces same result

**Evaluation Order:**
- Patches are applied sequentially in order
- Each patch's condition is evaluated against the **current** content (after previous patches)
- This allows cascading transformations

**Performance:**
- Condition evaluation is fast and happens in-memory
- No impact on build performance for most use cases

**Debugging:**
- Use `kustomark debug` to step through conditional patches
- Use `kustomark diff -v` to see which patches matched

## Resources

Resources define the source files for your kustomization. They can be simple strings (file paths, globs, URLs) or detailed objects with authentication and integrity verification.

### Resource Strings

The simplest form is a string that can be:

**Local file patterns:**
```yaml
resources:
  - "**/*.md"           # All markdown files recursively
  - "!**/README.md"     # Exclude pattern
  - ./docs/guide.md     # Specific file
  - ../base/            # Another kustomark config directory
```

**Remote git repositories:**
```yaml
resources:
  # GitHub shorthand
  - github.com/org/repo//path?ref=v1.2.0

  # Full git URL with HTTPS
  - git::https://github.com/org/repo.git//subdir?ref=main

  # SSH URL
  - git::git@github.com:org/repo.git//path?ref=abc1234
```

**HTTP archives:**
```yaml
resources:
  - https://example.com/releases/v1.0.0/docs.tar.gz
  - https://example.com/archive.tar.gz//subdir/
  - https://example.com/package.zip//docs/
```

Supported archive formats: `.tar.gz`, `.tgz`, `.tar`, `.zip`

### Resource Objects

For advanced use cases, resources can be objects with additional configuration:

```yaml
resources:
  - url: https://example.com/docs.tar.gz
    sha256: abc123def456...
    auth:
      type: bearer
      tokenEnv: GITHUB_TOKEN
```

**Resource Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | **Required**. Resource URL (git, HTTP, or local path) |
| `sha256` | string | Optional. SHA256 checksum for integrity verification |
| `auth` | object | Optional. Authentication configuration |

### Authentication

Resource objects support two authentication methods for HTTP resources:

#### Bearer Token Authentication

Use bearer tokens for GitHub releases, private registries, or API endpoints:

```yaml
resources:
  - url: https://private.example.com/docs.tar.gz
    auth:
      type: bearer
      tokenEnv: PRIVATE_REPO_TOKEN
```

The token is read from the specified environment variable:

```bash
export PRIVATE_REPO_TOKEN="your-token-here"
kustomark build ./team/
```

**Authentication Fields (Bearer):**

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Must be `"bearer"` |
| `tokenEnv` | string | **Required**. Environment variable name containing the bearer token |

#### Basic Authentication

Use basic auth for HTTP resources requiring username/password:

```yaml
resources:
  - url: https://internal.company.com/archive.tar.gz
    auth:
      type: basic
      username: myuser
      passwordEnv: COMPANY_PASSWORD
```

**Authentication Fields (Basic):**

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Must be `"basic"` |
| `username` | string | **Required**. Username for basic auth |
| `passwordEnv` | string | **Required**. Environment variable name containing the password |

**Security Note:** Never hardcode credentials in your configuration files. Always use environment variables for sensitive data.

### Integrity Verification

Use SHA256 checksums to verify that downloaded resources haven't been tampered with:

```yaml
resources:
  - url: https://example.com/v1.0.0/docs.tar.gz
    sha256: 6a087ac9e5702a0c9d60fbcd48696012646ec8df1491dea472b150e79fcaf804
```

When a `sha256` field is provided:
1. Kustomark downloads the resource
2. Calculates the SHA256 hash of the downloaded content
3. Compares it with the expected hash
4. Fails the build if the hashes don't match

**Getting the SHA256 hash:**

```bash
# For a local file
sha256sum file.tar.gz

# For a downloaded file
curl -sL https://example.com/file.tar.gz | sha256sum
```

### Mixed String and Object Resources

You can mix simple strings and resource objects in the same configuration:

```yaml
resources:
  # Simple local patterns
  - "docs/**/*.md"
  - "!docs/internal/**"

  # Git repository (string)
  - github.com/org/repo//docs?ref=v2.0.0

  # HTTP archive with checksum (object)
  - url: https://example.com/docs.tar.gz
    sha256: abc123def456...

  # Private resource with authentication (object)
  - url: https://private.example.com/internal-docs.tar.gz
    auth:
      type: bearer
      tokenEnv: PRIVATE_TOKEN
    sha256: def456abc123...

  # Another kustomark config
  - ../base/
```

### Complete Authentication Examples

**GitHub private release with token:**

```yaml
resources:
  - url: https://github.com/myorg/private-repo/releases/download/v1.0.0/docs.tar.gz
    auth:
      type: bearer
      tokenEnv: GITHUB_TOKEN
    sha256: 6a087ac9e5702a0c9d60fbcd48696012646ec8df1491dea472b150e79fcaf804
```

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
kustomark build ./team/
```

**Private registry with basic auth:**

```yaml
resources:
  - url: https://registry.internal.company.com/packages/docs-v1.0.0.tar.gz
    auth:
      type: basic
      username: ci-bot
      passwordEnv: REGISTRY_PASSWORD
    sha256: abc123def456abc123def456abc123def456abc123def456abc123def456abc1
```

```bash
export REGISTRY_PASSWORD="secret-password"
kustomark build ./production/
```

**Multiple authenticated resources:**

```yaml
resources:
  # Public resource (no auth needed)
  - url: https://example.com/public-docs.tar.gz
    sha256: public123...

  # GitHub private release
  - url: https://github.com/org/private/releases/download/v1.0/docs.tar.gz
    auth:
      type: bearer
      tokenEnv: GITHUB_TOKEN
    sha256: github123...

  # Internal registry
  - url: https://internal.company.com/docs.tar.gz
    auth:
      type: basic
      username: service-account
      passwordEnv: INTERNAL_PASSWORD
    sha256: internal123...
```

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
export INTERNAL_PASSWORD="secret"
kustommark build ./production/
```

### Environment Variable Best Practices

1. **Use descriptive names:** Choose clear environment variable names that indicate their purpose (e.g., `GITHUB_TOKEN`, `REGISTRY_PASSWORD`)

2. **Keep credentials out of version control:** Never commit `.env` files or credentials to git

3. **Use different tokens per environment:**
   ```bash
   # Development
   export GITHUB_TOKEN="ghp_dev_token"

   # Production
   export GITHUB_TOKEN="ghp_prod_token"
   ```

4. **Set environment variables before running kustomark:**
   ```bash
   # In CI/CD pipeline
   export GITHUB_TOKEN="${GITHUB_TOKEN_SECRET}"
   kustomark build ./production/

   # Using .env file (locally)
   source .env
   kustomark build ./team/
   ```

5. **Verify variables are set:**
   ```bash
   # Check before running
   if [ -z "$GITHUB_TOKEN" ]; then
     echo "Error: GITHUB_TOKEN not set"
     exit 1
   fi
   kustomark build ./team/
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

## API Documentation

For developers integrating Kustomark into their applications or extending its functionality, comprehensive API documentation is available for the core library.

### Accessing the API Documentation

The complete TypeScript API documentation is available in the `docs/api/` directory and includes:

- **All exported functions and classes** from the core library
- **Type definitions** for all configuration schemas and data structures
- **Patch operations** with detailed parameter documentation
- **Configuration schemas** with validation rules
- **Resource resolution** and remote fetching APIs
- **Build cache** and incremental build utilities
- **Template system** for variable substitution
- **Condition evaluation** for conditional patches

### Generating Documentation

To regenerate the API documentation from source:

```bash
bun run docs:api
```

The documentation is generated using [TypeDoc](https://typedoc.org/) from the TypeScript source code and JSDoc comments in `src/core/**/*.ts`.

### Core Library Usage

The core library can be imported and used programmatically:

```typescript
import {
  applyPatches,
  parseConfig,
  resolveResources,
  type KustomarkConfig,
  type PatchOperation
} from 'kustomark';

// Load and parse a kustomark configuration
const config: KustomarkConfig = await parseConfig('./kustomark.yaml');

// Resolve resources (local files, git repos, HTTP archives)
const resources = await resolveResources(config.resources, {
  baseDir: process.cwd()
});

// Apply patches to markdown content
const result = applyPatches(content, config.patches || [], {
  onNoMatch: config.onNoMatch || 'warn',
  filePath: 'README.md'
});

console.log(`Applied ${result.applied} patches`);
console.log(result.content);
```

### Key Modules

- **patch-engine.ts** - Core patching operations and markdown parsing
- **config-parser.ts** - Configuration file parsing and validation
- **resource-resolver.ts** - Resource resolution (local, git, HTTP)
- **build-cache.ts** - Incremental build caching
- **condition-evaluator.ts** - Conditional patch evaluation
- **validators.ts** - Content validation framework
- **template-manager.ts** - Template variable substitution

For detailed documentation of all functions, types, and interfaces, see the [API documentation](./docs/api/index.html).

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

3. **Four View Modes**
   - **Editor**: YAML config with patch management
   - **Diff**: Side-by-side diff viewer showing changes
   - **Preview**: Rendered markdown preview
   - **Files**: File browser with tree view and file content viewer

4. **Build Integration**
   - Execute builds with optional flags (incremental, clean, group filtering)
   - View build results and statistics
   - See validation errors and warnings

5. **File Browser**
   - Tree view of project files and directories
   - Expand/collapse directories to explore structure
   - Click files to view content with syntax highlighting
   - Copy file contents to clipboard
   - Automatically filters out build artifacts (node_modules, .git, dist, etc.)
   - Security: Path traversal protection prevents accessing files outside project

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

## Watch Mode

Watch mode enables automatic rebuilding of your markdown files whenever source files or configuration changes are detected. This is particularly useful during development or for continuous integration workflows.

### Starting Watch Mode

```bash
# Start watch mode with default settings
kustomark watch ./myproject/

# Custom debounce interval (prevents excessive rebuilds)
kustomark watch ./myproject/ --debounce=500

# JSON output for programmatic integration
kustomark watch ./myproject/ --format=json

# Disable hooks for security
kustomark watch ./myproject/ --no-hooks
```

See the [kustomark watch](#kustomark-watch-path) command reference for all options.

### Watch Mode Hooks

Watch hooks allow you to execute shell commands automatically in response to build events. This enables powerful automation workflows such as notifications, deployments, testing, and more.

#### Overview

Hooks are shell commands configured in your `kustomark.yaml` file that run at specific lifecycle events:

- **onBuild**: Runs after a successful build completes
- **onError**: Runs when a build fails
- **onChange**: Runs when file changes are detected (before rebuild)

Hooks execute sequentially and can use template variables to access event context information.

#### Configuration Example

Add a `watch` section to your `kustomark.yaml`:

```yaml
apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - "**/*.md"

patches:
  - op: replace
    old: "foo"
    new: "bar"

# Watch mode hooks
watch:
  # Run after successful build
  onBuild:
    - echo "Build completed successfully at {{timestamp}}"
    - ./scripts/deploy.sh
    - notify-send "Kustomark" "Build completed"

  # Run when build fails
  onError:
    - echo "Build failed: {{error}}"
    - echo "Exit code: {{exitCode}}"
    - notify-send "Kustomark Build Failed" "{{error}}"

  # Run when files change (before rebuild)
  onChange:
    - echo "File changed: {{file}} at {{timestamp}}"
    - git add {{file}}
```

#### Template Variables

Hooks support template variables that are replaced with actual values at runtime:

| Variable | Description | Available In |
|----------|-------------|--------------|
| `{{file}}` | Path to the file that changed | onChange |
| `{{error}}` | Error message from failed build | onError |
| `{{exitCode}}` | Exit code (0 for success, 1 for error) | onBuild, onError |
| `{{timestamp}}` | ISO 8601 timestamp of the event | All hooks |

**Example variable interpolation:**

```yaml
watch:
  onBuild:
    - echo "Build succeeded at {{timestamp}} with exit code {{exitCode}}"
    # Output: Build succeeded at 2024-01-15T10:30:45.123Z with exit code 0

  onError:
    - echo "Build failed: {{error}} (exit code: {{exitCode}})"
    # Output: Build failed: Invalid configuration (exit code: 1)

  onChange:
    - echo "File {{file}} changed at {{timestamp}}"
    # Output: File guide.md changed at 2024-01-15T10:30:45.123Z
```

#### Security

By default, watch hooks are enabled and will execute the configured shell commands. For security-sensitive environments where you don't want arbitrary shell commands to execute:

```bash
# Disable all hooks
kustomark watch . --no-hooks
```

**Security considerations:**

1. **Trusted configurations only**: Only use watch hooks with trusted `kustomark.yaml` files, as hooks can execute arbitrary shell commands
2. **Use --no-hooks in CI/CD**: Consider disabling hooks in automated environments unless explicitly needed
3. **Audit hook commands**: Review all hook commands before running watch mode
4. **Minimal privileges**: Run watch mode with minimal necessary privileges
5. **No user input in hooks**: Don't interpolate user-controlled input into hook commands

#### Use Cases

**1. Desktop Notifications:**

```yaml
watch:
  onBuild:
    - notify-send "Kustomark" "Build completed successfully"
  onError:
    - notify-send -u critical "Kustomark" "Build failed: {{error}}"
```

**2. Automated Deployment:**

```yaml
watch:
  onBuild:
    - rsync -av ./output/ user@server:/var/www/docs/
    - echo "Deployed at {{timestamp}}"
  onError:
    - echo "Deployment skipped due to build error"
```

**3. Running Tests:**

```yaml
watch:
  onBuild:
    - npm test
    - echo "Tests completed at {{timestamp}}"
  onError:
    - echo "Skipping tests due to build failure: {{error}}"
```

**4. Git Integration:**

```yaml
watch:
  onChange:
    - git add {{file}}
    - echo "Staged {{file}} for commit"
  onBuild:
    - git commit -m "Auto-update docs at {{timestamp}}"
    - git push origin main
```

**5. Slack/Discord Notifications:**

```yaml
watch:
  onBuild:
    - 'curl -X POST https://hooks.slack.com/... -d "{\"text\":\"Docs updated at {{timestamp}}\"}"'
  onError:
    - 'curl -X POST https://hooks.slack.com/... -d "{\"text\":\"Build failed: {{error}}\"}"'
```

**6. Build Metrics:**

```yaml
watch:
  onBuild:
    - echo "{{timestamp}},success,{{exitCode}}" >> build-metrics.csv
  onError:
    - echo "{{timestamp}},failure,{{exitCode}},{{error}}" >> build-metrics.csv
```

**7. Multi-Environment Deployment:**

```yaml
watch:
  onBuild:
    - ./deploy.sh staging
    - sleep 5
    - ./run-smoke-tests.sh
    - ./deploy.sh production
```

#### Hook Execution Details

**Execution order:**
- Hooks within a single event (e.g., onBuild) run sequentially in the order defined
- If one hook fails, subsequent hooks still execute
- Hook failures don't stop watch mode (it continues watching)

**Timeout:**
- Each hook command has a 30-second timeout
- Commands exceeding the timeout are killed automatically
- Timeout failures are logged but don't stop watch mode

**Environment:**
- Hooks inherit the shell environment from the parent process
- Commands execute in a shell (`sh -c`)
- Working directory is the directory containing `kustomark.yaml`

**Verbosity levels:**
- `-vvv` (verbosity 3): Shows hook execution messages
- `-vvvv` (verbosity 4): Shows hook stdout and stderr output

**Example with verbosity:**

```bash
# See which hooks are executing
kustomark watch . -vvv

# See full hook output
kustomark watch . -vvvv
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

## API Documentation

For detailed API documentation of the core library, see:

- **[API Reference](./docs/api/index.html)** - Full TypeDoc-generated API documentation
- **[API Overview](./docs/README.md)** - Quick overview of main modules and functions

## License

MIT

## Links

- [Specifications](./specs/)
- [M1 MVP Spec](./specs/m1-mvp.md)
- [API Documentation](./docs/api/index.html)
- [GitHub Repository](https://github.com/yourusername/kustomark)

---

Built with TypeScript and Bun. Inspired by kustomize.
