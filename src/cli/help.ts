/**
 * Help Command System for Kustomark CLI
 * Provides comprehensive documentation for all commands with examples
 */

// ============================================================================
// ANSI Color Codes for Terminal Output
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatTitle(text: string): string {
  return `${colors.bold}${colors.cyan}${text}${colors.reset}`;
}

function formatCommand(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

function formatFlag(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

function formatExample(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

function formatSection(text: string): string {
  return `${colors.bold}${colors.blue}${text}${colors.reset}`;
}

function formatHighlight(text: string): string {
  return `${colors.magenta}${text}${colors.reset}`;
}

// ============================================================================
// Main Help (Overview)
// ============================================================================

export function getMainHelp(): string {
  return formatHelp(`
${formatTitle("Kustomark - Declarative markdown patching pipeline")}

${formatSection("USAGE")}
  ${formatCommand("kustomark")} ${formatFlag("<command>")} [path] [options]

${formatSection("CORE COMMANDS")}
  ${formatCommand("build")}        Build and write output files
  ${formatCommand("diff")}         Show what would change without writing files
  ${formatCommand("preview")}      Visual side-by-side preview of changes
  ${formatCommand("validate")}     Validate configuration without building
  ${formatCommand("watch")}        Monitor files and rebuild on changes
  ${formatCommand("init")}         Create a new kustomark.yaml config

${formatSection("ADVANCED COMMANDS")}
  ${formatCommand("debug")}        Interactive patch debugging mode
  ${formatCommand("fix")}          Interactive configuration error fixing
  ${formatCommand("lint")}         Check for common issues in configuration
  ${formatCommand("explain")}      Show resolution chain and patch details
  ${formatCommand("analyze")}      Analyze patch complexity and provide insights
  ${formatCommand("test")}         Run patch tests against sample content
  ${formatCommand("template")}     Manage and apply configuration templates
  ${formatCommand("fetch")}        Fetch remote resources without building
  ${formatCommand("web")}          Launch web UI for visual editing
  ${formatCommand("cache")}        Manage cache for remote resources
  ${formatCommand("schema")}       Export JSON Schema for editor integration
  ${formatCommand("snapshot")}     Create, verify, or update build output snapshots
  ${formatCommand("suggest")}      Generate patches from file differences
  ${formatCommand("profile")}      Memory profiling and performance analysis

${formatSection("GETTING HELP")}
  ${formatCommand("kustomark help")}                Show this help message
  ${formatCommand("kustomark help")} ${formatFlag("<command>")}     Show detailed help for a command
  ${formatCommand("kustomark")} ${formatFlag("<command>")} ${formatFlag("--help")}  Show detailed help for a command

${formatSection("COMMON FLAGS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)
  ${formatFlag("--help, -h")}             Show help for a command

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Success (for diff: no changes detected)
  ${formatHighlight("1")}    Error or changes detected (for diff)

${formatSection("EXAMPLES")}
  ${formatExample("# Build from a directory containing kustomark.yaml")}
  ${formatCommand("kustomark build ./team/")}

  ${formatExample("# Preview changes before building")}
  ${formatCommand("kustomark diff ./team/")}

  ${formatExample("# Create a new configuration interactively")}
  ${formatCommand("kustomark init -i")}

  ${formatExample("# Get detailed help for the build command")}
  ${formatCommand("kustomark help build")}

${formatSection("QUICK START")}
  1. Create a directory with markdown files
  2. Run ${formatCommand("kustomark init -i")} to create a config
  3. Run ${formatCommand("kustomark build .")} to apply patches
  4. Use ${formatCommand("kustomark watch .")} for development

${formatSection("DOCUMENTATION")}
  For full documentation, visit:
  ${formatHighlight("https://github.com/yourusername/kustomark")}

  For more help on a specific command:
  ${formatCommand("kustomark help")} ${formatFlag("<command>")}
`);
}

// ============================================================================
// Command-Specific Help
// ============================================================================

export function getCommandHelp(command: string): string {
  const helpFunctions: Record<string, () => string> = {
    build: getBuildHelp,
    diff: getDiffHelp,
    preview: getPreviewHelp,
    validate: getValidateHelp,
    watch: getWatchHelp,
    init: getInitHelp,
    debug: getDebugHelp,
    fix: getFixHelp,
    lint: getLintHelp,
    explain: getExplainHelp,
    analyze: getAnalyzeHelp,
    test: getTestHelp,
    fetch: getFetchHelp,
    web: getWebHelp,
    cache: getCacheHelp,
    schema: getSchemaHelp,
    snapshot: getSnapshotHelp,
    template: getTemplateHelp,
    suggest: getSuggestHelp,
    profile: getProfileHelp,
  };

  const helpFunc = helpFunctions[command];
  if (!helpFunc) {
    return `Unknown command: ${command}\n\nRun 'kustomark help' for a list of available commands.`;
  }

  return formatHelp(helpFunc());
}

// ============================================================================
// Build Command Help
// ============================================================================

function getBuildHelp(): string {
  return `
${formatTitle("kustomark build - Build and write output files")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark build")} [path] [options]

${formatSection("DESCRIPTION")}
  Build processes markdown files through your patch pipeline and writes
  the output to the configured output directory. It resolves resources,
  applies patches, and generates the final customized markdown files.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("--clean")}                Remove output files not in source
  ${formatFlag("--dry-run")}              Preview changes without writing files
  ${formatFlag("--auto-fix")}             Enable interactive error recovery for failed patches
  ${formatFlag("--stats")}                Show detailed build statistics
  ${formatFlag("--progress")}             Show progress feedback during build
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

${formatSection("PERFORMANCE OPTIONS")}
  ${formatFlag("--parallel")}             Enable parallel processing of files
  ${formatFlag("--jobs")} <N>             Number of parallel jobs (default: CPU count)
  ${formatFlag("--incremental")}          Only rebuild changed files
  ${formatFlag("--clean-cache")}          Clear build cache before building
  ${formatFlag("--cache-dir")} <path>     Custom cache directory

${formatSection("VARIABLE SUBSTITUTION")}
  ${formatFlag("--var")} <NAME=VALUE>        Override a variable (can be repeated)
  ${formatFlag("--env-var")} <NAME>          Expose an environment variable by name (can be repeated)

  Variables defined under the ${formatHighlight("vars")} key in kustomark.yaml can be referenced
  in any patch string value as ${formatHighlight("$" + "{varName}")}. Environment variables can be
  whitelisted in the ${formatHighlight("envVars")} config key or passed via ${formatFlag("--env-var")}.

  Resolution priority (highest to lowest):
    1. ${formatFlag("--var")} CLI flags
    2. ${formatHighlight("envVars")} config list / ${formatFlag("--env-var")} flags (from process.env)
    3. ${formatHighlight("vars")} config defaults

  Example:
    kustomark.yaml: ${formatExample("vars:\n    environment: staging\nenvVars:\n  - APP_VERSION\n  - GIT_COMMIT_SHA")}
    Override:       ${formatFlag("--var environment=production")}
    From env:       ${formatFlag("--env-var NODE_ENV")}

${formatSection("GROUP FILTERING")}
  ${formatFlag("--enable-groups")} <list>   Enable only specified groups (comma-separated)
  ${formatFlag("--disable-groups")} <list>  Disable specified groups (comma-separated)

  Patches without a group are always enabled. If both flags are specified,
  --enable-groups takes precedence (whitelist mode).

${formatSection("LOCK FILE OPTIONS")}
  ${formatFlag("--update")}               Update kustomark.lock with latest refs
  ${formatFlag("--no-lock")}              Ignore lock file (fetch latest versions)
  ${formatFlag("--offline")}              Fail if remote fetch is needed

${formatSection("EXAMPLES")}
  ${formatExample("# Basic build")}
  ${formatCommand("kustomark build ./team/")}

  ${formatExample("# Build with JSON output")}
  ${formatCommand("kustomark build ./team/ --format=json")}

  ${formatExample("# Preview changes without writing files")}
  ${formatCommand("kustomark build ./team/ --dry-run")}

  ${formatExample("# Build and clean extra files")}
  ${formatCommand("kustomark build ./team/ --clean")}

  ${formatExample("# Fast parallel build")}
  ${formatCommand("kustomark build ./team/ --parallel --incremental")}

  ${formatExample("# Build with specific patch groups only")}
  ${formatCommand("kustomark build ./team/ --enable-groups=branding,security")}

  ${formatExample("# Build excluding certain patch groups")}
  ${formatCommand("kustomark build ./team/ --disable-groups=experimental")}

  ${formatExample("# Build with interactive error recovery")}
  ${formatCommand("kustomark build ./team/ --auto-fix --stats")}

${formatSection("WORKFLOWS")}
  ${formatHighlight("Development workflow:")}
    1. ${formatCommand("kustomark build . --dry-run")} - Preview changes
    2. ${formatCommand("kustomark build .")} - Build output
    3. ${formatCommand("kustomark build . --clean")} - Clean build

  ${formatHighlight("Production workflow:")}
    1. ${formatCommand("kustomark build . --offline")} - Use locked versions
    2. ${formatCommand("kustomark validate .")} - Verify config
    3. ${formatCommand("kustomark build . --stats")} - Build with metrics

  ${formatHighlight("Performance workflow:")}
    1. ${formatCommand("kustomark build . --parallel --incremental")} - Fast first build
    2. Make changes to source files
    3. ${formatCommand("kustomark build . --incremental")} - Fast incremental rebuild

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Build succeeded
  ${formatHighlight("1")}    Build failed or validation error

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark diff")}     Preview changes before building
  ${formatCommand("kustomark watch")}    Auto-rebuild on file changes
  ${formatCommand("kustomark validate")} Validate configuration
`;
}

// ============================================================================
// Diff Command Help
// ============================================================================

function getDiffHelp(): string {
  return `
${formatTitle("kustomark diff - Show what would change")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark diff")} [path] [options]

${formatSection("DESCRIPTION")}
  Diff shows what changes would be made without writing any files. This is
  useful for previewing the effects of your patches before committing to a
  build. The command compares current files with what would be generated.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

  All build options (--parallel, --incremental, --enable-groups, etc.) are
  also supported for diff to ensure accurate preview.

${formatSection("EXAMPLES")}
  ${formatExample("# Show diff in text format")}
  ${formatCommand("kustomark diff ./team/")}

  ${formatExample("# Show diff with details")}
  ${formatCommand("kustomark diff ./team/ -v")}

  ${formatExample("# Get diff as JSON")}
  ${formatCommand("kustomark diff ./team/ --format=json")}

  ${formatExample("# Check if changes exist (use exit code)")}
  ${formatCommand("kustomark diff ./team/ -q && echo 'No changes' || echo 'Changes detected'")}

${formatSection("OUTPUT FORMAT")}
  ${formatHighlight("Text format:")}
    Shows unified diff format with + and - for changes
    Lists added, modified, and deleted files

  ${formatHighlight("JSON format:")}
    {
      "hasChanges": true,
      "files": [
        {
          "path": "guide.md",
          "status": "modified",
          "diff": "--- a/guide.md\\n+++ b/guide.md\\n..."
        }
      ]
    }

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    No changes detected
  ${formatHighlight("1")}    Changes detected or error

${formatSection("USE CASES")}
  ${formatHighlight("Pre-commit checks:")}
    ${formatCommand("kustomark diff . -q")}
    Verify patches before committing configuration changes

  ${formatHighlight("CI/CD validation:")}
    ${formatCommand("kustomark diff . --format=json > diff.json")}
    Capture changes for automated testing

  ${formatHighlight("Review workflow:")}
    ${formatCommand("kustomark diff . | less")}
    Review all changes before building

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark build")}     Build and write files
  ${formatCommand("kustomark preview")}   Visual side-by-side preview
  ${formatCommand("kustomark debug")}     Interactive patch debugging
`;
}

// ============================================================================
// Preview Command Help
// ============================================================================

function getPreviewHelp(): string {
  return `
${formatTitle("kustomark preview - Visual side-by-side preview of changes")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark preview")} [path] [options]

${formatSection("DESCRIPTION")}
  Preview shows a side-by-side visual comparison of what changes will be made
  to your files. It displays before/after columns with character-level diff
  highlighting, making it easy to see exactly what your patches will do.

  This is the most user-friendly way to understand your changes before
  committing to a build. Unlike 'diff' which shows unified diffs, preview
  gives you a rich, color-coded visual comparison.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity (more context lines)
  ${formatFlag("-q")}                     Quiet mode (only show changes, no unchanged lines)

  All build options (--parallel, --incremental, --enable-groups, etc.) are
  also supported for preview to ensure accurate comparison.

${formatSection("VISUAL FORMAT")}
  ${formatHighlight("Side-by-side columns:")}
    Left column shows original content
    Right column shows modified content
    Line numbers for easy reference

  ${formatHighlight("Color coding:")}
    ${formatCommand("Red background")}     Deleted text (character-level)
    ${formatCommand("Green background")}   Inserted text (character-level)
    ${formatCommand("Yellow")}             Modified lines
    ${formatCommand("Gray (dim)")}         Unchanged context lines

  ${formatHighlight("Change markers:")}
    ${formatCommand("-")}  Line deletion
    ${formatCommand("+")}  Line insertion
    ${formatCommand("~")}  Line modification
    ${formatCommand(" ")}  Unchanged (context)

${formatSection("EXAMPLES")}
  ${formatExample("# Basic preview")}
  ${formatCommand("kustomark preview ./team/")}

  ${formatExample("# Preview with more context")}
  ${formatCommand("kustomark preview ./team/ -v")}

  ${formatExample("# Preview only changes (no context)")}
  ${formatCommand("kustomark preview ./team/ -q")}

  ${formatExample("# Get preview data as JSON")}
  ${formatCommand("kustomark preview ./team/ --format=json")}

  ${formatExample("# Preview specific patch groups")}
  ${formatCommand("kustomark preview ./team/ --enable-groups=branding")}

${formatSection("JSON OUTPUT")}
  ${formatHighlight("Structure:")}
    {
      "files": [
        {
          "path": "guide.md",
          "before": "original content",
          "after": "modified content",
          "hasChanges": true,
          "linesAdded": 5,
          "linesDeleted": 2,
          "linesModified": 3,
          "changes": [
            {
              "oldLineNumber": 10,
              "newLineNumber": 10,
              "type": "modify",
              "oldText": "old line",
              "newText": "new line",
              "charDiff": [...]
            }
          ]
        }
      ],
      "filesChanged": 1,
      "totalLinesAdded": 5,
      "totalLinesDeleted": 2,
      "totalLinesModified": 3
    }

${formatSection("USE CASES")}
  ${formatHighlight("Patch development:")}
    ${formatCommand("kustomark preview .")}
    See exactly what your patches do while developing

  ${formatHighlight("Code review:")}
    ${formatCommand("kustomark preview . -v | less -R")}
    Review changes thoroughly before merging

  ${formatHighlight("Debugging:")}
    ${formatCommand("kustomark preview . -q")}
    Quickly identify what's changing without context noise

  ${formatHighlight("Documentation:")}
    ${formatCommand("kustomark preview . --format=json > preview.json")}
    Export preview data for documentation or tooling

${formatSection("COMPARISON WITH OTHER COMMANDS")}
  ${formatHighlight("diff")}      Shows unified diff format (like git diff)
  ${formatHighlight("preview")}   Shows side-by-side visual comparison (this command)
  ${formatHighlight("build")}     Actually writes files to output directory
  ${formatHighlight("debug")}     Interactive step-through patch debugging

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    No changes detected
  ${formatHighlight("1")}    Changes detected or error

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark diff")}      Unified diff format
  ${formatCommand("kustomark build")}     Build and write files
  ${formatCommand("kustomark debug")}     Interactive debugging
  ${formatCommand("kustomark analyze")}   Build complexity analysis
`;
}

// ============================================================================
// Validate Command Help
// ============================================================================

function getValidateHelp(): string {
  return `
${formatTitle("kustomark validate - Validate configuration")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark validate")} [path] [options]

${formatSection("DESCRIPTION")}
  Validate checks your kustomark.yaml configuration for errors without
  building or writing any files. It verifies syntax, required fields,
  patch operations, and resource references.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("--strict")}               Enable strict validation mode
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

${formatSection("EXAMPLES")}
  ${formatExample("# Validate configuration")}
  ${formatCommand("kustomark validate ./team/")}

  ${formatExample("# Get validation results as JSON")}
  ${formatCommand("kustomark validate ./team/ --format=json")}

  ${formatExample("# Strict validation (treat warnings as errors)")}
  ${formatCommand("kustomark validate ./team/ --strict")}

${formatSection("VALIDATION CHECKS")}
  ${formatHighlight("Required fields:")}
    - apiVersion must be 'kustomark/v1'
    - kind must be 'Kustomization'
    - resources must be a non-empty array

  ${formatHighlight("Patch validation:")}
    - Valid operation types
    - Required fields for each operation
    - Valid glob patterns
    - Valid regex patterns
    - Valid frontmatter keys

  ${formatHighlight("Resource validation:")}
    - Valid glob patterns
    - Valid file paths
    - Valid git URLs
    - Valid HTTP URLs

${formatSection("OUTPUT FORMAT")}
  ${formatHighlight("Text format:")}
    ✓ Valid configuration
    Or lists errors and warnings

  ${formatHighlight("JSON format:")}
    {
      "valid": true|false,
      "errors": [...],
      "warnings": [...]
    }

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Configuration is valid
  ${formatHighlight("1")}    Configuration has errors

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark lint")}      Check for common issues
  ${formatCommand("kustomark build")}     Build after validating
`;
}

// ============================================================================
// Watch Command Help
// ============================================================================

function getWatchHelp(): string {
  return `
${formatTitle("kustomark watch - Monitor and rebuild on changes")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark watch")} [path] [options]

${formatSection("DESCRIPTION")}
  Watch monitors your source files and configuration for changes and
  automatically rebuilds the output. This is useful during development
  for immediate feedback. Watch mode can also execute custom hooks on
  build events.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--debounce")} <ms>         Debounce interval in milliseconds (default: 300)
  ${formatFlag("--no-hooks")}             Disable watch hooks for security
  ${formatFlag("--incremental")}          Only rebuild changed files (near-instant rebuilds)
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

  All build options are also supported for watch mode.

${formatSection("EXAMPLES")}
  ${formatExample("# Start watch mode")}
  ${formatCommand("kustomark watch ./team/")}

  ${formatExample("# Watch with incremental rebuilds (fastest)")}
  ${formatCommand("kustomark watch ./team/ --incremental")}

  ${formatExample("# Watch with custom debounce interval")}
  ${formatCommand("kustomark watch ./team/ --debounce=500")}

  ${formatExample("# Watch with JSON output for integration")}
  ${formatCommand("kustomark watch ./team/ --format=json")}

  ${formatExample("# Disable watch hooks for security")}
  ${formatCommand("kustomark watch ./team/ --no-hooks")}

  ${formatExample("# Watch with verbose logging")}
  ${formatCommand("kustomark watch ./team/ -vv")}

${formatSection("WATCH HOOKS")}
  Configure hooks in your kustomark.yaml to execute commands on events:

  watch:
    onBuild:
      - echo "Build completed at {{timestamp}}"
      - ./deploy.sh
    onError:
      - echo "Build failed: {{error}}"
    onChange:
      - echo "File changed: {{file}}"

  ${formatHighlight("Available template variables:")}
    {{file}}       - Changed file path (onChange only)
    {{error}}      - Error message (onError only)
    {{exitCode}}   - Build exit code
    {{timestamp}}  - ISO 8601 timestamp

${formatSection("USE CASES")}
  ${formatHighlight("Development workflow:")}
    ${formatCommand("kustomark watch . --debounce=100")}
    Fast rebuilds during active development

  ${formatHighlight("Documentation server:")}
    Configure onBuild hook to restart doc server
    Auto-deploy on successful builds

  ${formatHighlight("Testing workflow:")}
    Configure onBuild hook to run tests
    Get immediate feedback on changes

${formatSection("JSON OUTPUT")}
  With --format=json, watch outputs newline-delimited JSON events:

  {"event":"build","success":true,"filesWritten":5,...}
  {"event":"build","success":false,"error":"..."}

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark build")}     Manual build
  ${formatCommand("kustomark web")}       Visual editing interface
`;
}

// ============================================================================
// Init Command Help
// ============================================================================

function getInitHelp(): string {
  return `
${formatTitle("kustomark init - Create a new configuration")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark init")} [path] [options]

${formatSection("DESCRIPTION")}
  Init creates a new kustomark.yaml configuration file. It can run
  interactively with a guided wizard or non-interactively with flags
  for automation. Choose between creating a base configuration or an
  overlay that extends another configuration.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path where kustomark.yaml will be created (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("-i, --interactive")}      Launch interactive wizard with prompts
  ${formatFlag("--base")} <path>          Create overlay config referencing base
  ${formatFlag("--output")} <path>        Set output directory (non-interactive)
  ${formatFlag("--format")} <text|json>    Output format (default: text)

${formatSection("MODES")}
  ${formatHighlight("Interactive mode (recommended for beginners):")}
    Guided wizard with prompts for all configuration options
    Explains each choice and provides examples
    Ideal for first-time users

  ${formatHighlight("Non-interactive mode (for automation):")}
    Use flags to create configurations programmatically
    Without --base: creates a base configuration
    With --base: creates an overlay configuration

${formatSection("EXAMPLES")}
  ${formatExample("# Interactive mode - guided wizard")}
  ${formatCommand("kustomark init -i")}

  ${formatExample("# Create base config with defaults")}
  ${formatCommand("kustomark init ./base")}

  ${formatExample("# Create overlay config referencing a base")}
  ${formatCommand("kustomark init ./team --base=../base --output=./output")}

  ${formatExample("# Create config in current directory")}
  ${formatCommand("kustomark init .")}

${formatSection("INTERACTIVE WIZARD")}
  The wizard guides you through:
    1. Configuration type (base or overlay)
    2. Output directory
    3. Resource patterns (for base configs)
    4. Base configuration path (for overlays)
    5. Starter patches with detailed options
    6. Error handling strategy

${formatSection("CONFIGURATION TYPES")}
  ${formatHighlight("Base configuration:")}
    - Contains actual markdown files
    - Defines resources as glob patterns
    - Can be referenced by overlays

  ${formatHighlight("Overlay configuration:")}
    - References a base configuration
    - Adds or overrides patches
    - Used for team/environment customization

${formatSection("WORKFLOW")}
  ${formatHighlight("Single project:")}
    1. ${formatCommand("kustomark init -i")} in your docs directory
    2. Add patches to customize content
    3. ${formatCommand("kustomark build .")}

  ${formatHighlight("Multi-layer setup:")}
    1. ${formatCommand("kustomark init base/")} - Create base
    2. ${formatCommand("kustomark init team/ --base=../base")} - Create overlay
    3. ${formatCommand("kustomark build team/")} - Build with overlays

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark validate")} Validate created configuration
  ${formatCommand("kustomark build")}    Build from configuration
`;
}

// ============================================================================
// Debug Command Help
// ============================================================================

function getDebugHelp(): string {
  return `
${formatTitle("kustomark debug - Interactive patch debugging")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark debug")} [path] [options]

${formatSection("DESCRIPTION")}
  Debug provides an interactive mode for stepping through patch operations
  one by one. You can inspect each patch, see how it would modify files,
  and choose to apply or skip it. This is invaluable for troubleshooting
  patch configurations and understanding patch behavior.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--auto-apply")}           Automatically apply all patches without prompting
  ${formatFlag("--file")} <filename>      Debug only patches affecting a specific file
  ${formatFlag("--save-decisions")} <path> Save apply/skip decisions to a file
  ${formatFlag("--load-decisions")} <path> Load previous decisions from a file
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity

${formatSection("EXAMPLES")}
  ${formatExample("# Interactive mode - step through each patch")}
  ${formatCommand("kustomark debug ./team/")}

  ${formatExample("# Debug patches for a specific file only")}
  ${formatCommand("kustomark debug ./team/ --file guide.md")}

  ${formatExample("# Auto-apply mode with saved decisions")}
  ${formatCommand("kustomark debug ./team/ --auto-apply --load-decisions decisions.json")}

  ${formatExample("# Save decisions for replay")}
  ${formatCommand("kustomark debug ./team/ --save-decisions decisions.json")}

  ${formatExample("# Combine: load previous decisions and save updates")}
  ${formatCommand("kustomark debug ./team/ --load-decisions prev.json --save-decisions updated.json")}

${formatSection("INTERACTIVE MODE")}
  For each patch, debug mode shows:
    - Patch details (operation, fields)
    - Target file name
    - File preview (first 10 lines)
    - Progress indicator

  You can choose:
    ${formatFlag("a")} - Apply this patch
    ${formatFlag("s")} - Skip this patch
    ${formatFlag("q")} - Quit debug session

${formatSection("DECISION FILES")}
  Decisions are saved in JSON format:

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

  Use these to replay debugging sessions or create test cases.

${formatSection("USE CASES")}
  ${formatHighlight("Troubleshooting:")}
    ${formatCommand("kustomark debug . --file problematic.md")}
    See exactly which patches affect a file and how

  ${formatHighlight("Testing new patches:")}
    ${formatCommand("kustomark debug .")}
    Verify patches work as expected before committing

  ${formatHighlight("Creating test scenarios:")}
    ${formatCommand("kustomark debug . --save-decisions test-case.json")}
    Save decisions for automated testing

  ${formatHighlight("Reproducing issues:")}
    ${formatCommand("kustomark debug . --load-decisions issue-123.json")}
    Replay exact sequence that caused a problem

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark diff")}      Preview all changes at once
  ${formatCommand("kustomark explain")}   Understand patch resolution
`;
}

// ============================================================================
// Fix Command Help
// ============================================================================

function getFixHelp(): string {
  return `
${formatTitle("kustomark fix - Interactive configuration error fixing")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark fix")} [path] [options]

${formatSection("DESCRIPTION")}
  Fix provides an interactive interface for identifying and correcting errors
  in your kustomark.yaml configuration. It validates your configuration,
  detects common issues, and offers automated fixes with confidence scores.

  Unlike 'validate' which only reports errors, and 'lint' which provides
  warnings, fix actively helps you correct problems. Unlike 'debug' which
  steps through patches, fix focuses on configuration-level issues.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--auto-fix")}             Automatically apply all high-confidence fixes
  ${formatFlag("--min-confidence")} <N>   Only show fixes with confidence >= N (0.0-1.0, default: 0.5)
  ${formatFlag("--save-to")} <file>       Save fixed config to a different file (for safety)
  ${formatFlag("--dry-run")}              Show what would be fixed without modifying files
  ${formatFlag("--format")} <text|json>   Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

${formatSection("EXAMPLES")}
  ${formatExample("# Interactive mode - review and apply fixes one by one")}
  ${formatCommand("kustomark fix ./team/")}

  ${formatExample("# Auto-fix all high-confidence issues")}
  ${formatCommand("kustomark fix ./team/ --auto-fix")}

  ${formatExample("# Preview fixes without modifying files")}
  ${formatCommand("kustomark fix ./team/ --dry-run")}

  ${formatExample("# Save to a different file for safety")}
  ${formatCommand("kustomark fix ./team/ --save-to kustomark-fixed.yaml")}

  ${formatExample("# Only show high-confidence fixes (0.8+)")}
  ${formatCommand("kustomark fix ./team/ --min-confidence=0.8")}

  ${formatExample("# Auto-fix with specific confidence threshold")}
  ${formatCommand("kustomark fix ./team/ --auto-fix --min-confidence=0.9")}

  ${formatExample("# Get fix suggestions as JSON")}
  ${formatCommand("kustomark fix ./team/ --format=json")}

${formatSection("INTERACTIVE MODE")}
  For each detected issue, fix mode shows:
    - Issue description and severity
    - Current (problematic) configuration
    - Suggested fix with confidence score
    - Before/after diff preview

  You can choose:
    ${formatFlag("a")} - Apply this fix
    ${formatFlag("s")} - Skip this fix
    ${formatFlag("e")} - Edit fix manually before applying
    ${formatFlag("q")} - Quit without saving
    ${formatFlag("A")} - Apply all remaining high-confidence fixes
    ${formatFlag("Q")} - Save and quit

${formatSection("AUTO-FIX MODE")}
  With ${formatFlag("--auto-fix")}, the command automatically applies all fixes that meet
  the confidence threshold without prompting. This is useful for:
    - CI/CD pipelines
    - Batch processing multiple configurations
    - Applying well-known fixes to common issues

  ${formatHighlight("Safety features:")}
    - Only applies fixes above confidence threshold
    - Creates backup of original configuration
    - Reports all changes made
    - Can be combined with --dry-run for preview

${formatSection("CONFIDENCE SCORING")}
  Each suggested fix has a confidence score (0.0-1.0):

  ${formatHighlight("High confidence (0.9-1.0):")}
    - Syntax errors (missing quotes, invalid YAML)
    - Required field violations
    - Invalid enum values
    - Type mismatches
    ${formatExample("→ Safe to auto-fix")}

  ${formatHighlight("Medium confidence (0.7-0.89):")}
    - Common anti-patterns with obvious fixes
    - Resource path corrections
    - Pattern normalization
    ${formatExample("→ Review recommended")}

  ${formatHighlight("Lower confidence (0.5-0.69):")}
    - Suggested optimizations
    - Potential improvements
    - Ambiguous corrections
    ${formatExample("→ Manual review required")}

  ${formatHighlight("Low confidence (<0.5):")}
    - Experimental suggestions
    - Context-dependent fixes
    ${formatExample("→ Not shown by default (use --min-confidence to adjust)")}

${formatSection("TYPES OF FIXES")}
  ${formatHighlight("Validation errors:")}
    - Missing required fields (apiVersion, kind, resources)
    - Invalid field values
    - Type errors (string vs array, etc.)

  ${formatHighlight("Syntax errors:")}
    - Malformed YAML
    - Invalid regex patterns
    - Invalid glob patterns
    - Unescaped special characters

  ${formatHighlight("Patch errors:")}
    - Invalid operation types
    - Missing required patch fields
    - Conflicting patch operations
    - Invalid patch targets

  ${formatHighlight("Resource errors:")}
    - Invalid URLs or paths
    - Missing resource files
    - Circular base references
    - Duplicate resource entries

  ${formatHighlight("Performance issues:")}
    - Inefficient patterns
    - Redundant operations
    - Overlapping patches

${formatSection("COMMAND COMPARISON")}
  ${formatHighlight("fix vs validate:")}
    ${formatCommand("validate")} - Reports errors, no fixes
    ${formatCommand("fix")}      - Reports errors AND suggests/applies fixes

  ${formatHighlight("fix vs lint:")}
    ${formatCommand("lint")} - Checks for warnings and best practices
    ${formatCommand("fix")}  - Fixes actual errors (can also fix some lint issues)

  ${formatHighlight("fix vs debug:")}
    ${formatCommand("debug")} - Interactive patch-by-patch execution
    ${formatCommand("fix")}   - Configuration-level error correction

${formatSection("WORKFLOW EXAMPLES")}
  ${formatHighlight("Basic fix workflow:")}
    1. ${formatCommand("kustomark validate .")} - Identify errors
    2. ${formatCommand("kustomark fix .")} - Interactively fix errors
    3. ${formatCommand("kustomark validate .")} - Verify fixes
    4. ${formatCommand("kustomark build .")} - Build with fixed config

  ${formatHighlight("Safe fix workflow:")}
    1. ${formatCommand("kustomark fix . --dry-run")} - Preview all fixes
    2. ${formatCommand("kustomark fix . --save-to kustomark-fixed.yaml")} - Save to new file
    3. ${formatCommand("kustomark validate -f kustomark-fixed.yaml")} - Test new config
    4. ${formatCommand("mv kustomark-fixed.yaml kustomark.yaml")} - Replace original

  ${formatHighlight("Automated fix workflow:")}
    1. ${formatCommand("kustomark fix . --auto-fix --min-confidence=0.9")} - Auto-fix critical errors
    2. ${formatCommand("kustomark fix . --min-confidence=0.7")} - Review medium-confidence fixes
    3. ${formatCommand("kustomark build .")} - Build with fixes applied

  ${formatHighlight("CI/CD integration:")}
    ${formatCommand("kustomark fix . --auto-fix --min-confidence=0.95 && kustomark build .")}
    Automatically fix critical errors in CI pipeline

${formatSection("SAVING FIXES SAFELY")}
  ${formatHighlight("Backup original (default behavior):")}
    ${formatCommand("kustomark fix .")}
    Creates: kustomark.yaml.backup

  ${formatHighlight("Save to different file:")}
    ${formatCommand("kustomark fix . --save-to kustomark-fixed.yaml")}
    Original file remains unchanged

  ${formatHighlight("Preview only:")}
    ${formatCommand("kustomark fix . --dry-run")}
    No files modified

${formatSection("JSON OUTPUT")}
  With --format=json, outputs structured fix information:

  ${formatExample("{")}
  ${formatExample('  "issues": [')}
  ${formatExample("    {")}
  ${formatExample('      "severity": "error",')}
  ${formatExample('      "message": "Missing required field: apiVersion",')}
  ${formatExample('      "location": "root",')}
  ${formatExample('      "fix": {')}
  ${formatExample('        "description": "Add apiVersion: kustomark/v1",')}
  ${formatExample('        "confidence": 1.0,')}
  ${formatExample('        "patch": "..."')}
  ${formatExample("      }")}
  ${formatExample("    }")}
  ${formatExample("  ],")}
  ${formatExample('  "stats": {')}
  ${formatExample('    "totalIssues": 5,')}
  ${formatExample('    "fixedIssues": 4,')}
  ${formatExample('    "skippedIssues": 1,')}
  ${formatExample('    "avgConfidence": 0.92')}
  ${formatExample("  }")}
  ${formatExample("}")}

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    All issues fixed successfully or no issues found
  ${formatHighlight("1")}    Some issues remain unfixed or errors occurred
  ${formatHighlight("2")}    Configuration file not found or invalid

${formatSection("USE CASES")}
  ${formatHighlight("Fix syntax errors after manual editing:")}
    ${formatCommand("kustomark fix .")}
    Catch and fix YAML formatting issues

  ${formatHighlight("Migrate old configuration format:")}
    ${formatCommand("kustomark fix . --auto-fix")}
    Automatically update to current schema version

  ${formatHighlight("Cleanup after copy-paste:")}
    ${formatCommand("kustomark fix . --min-confidence=0.8")}
    Fix common issues from copying examples

  ${formatHighlight("Pre-commit hook:")}
    ${formatCommand("kustomark fix . --auto-fix --min-confidence=0.95 -q")}
    Ensure config is error-free before committing

  ${formatHighlight("Team onboarding:")}
    ${formatCommand("kustomark fix . -v")}
    Learn from fixes with verbose explanations

${formatSection("TIPS")}
  ${formatHighlight("Start with dry-run:")}
    Always preview fixes with --dry-run before applying
    Understand what will change

  ${formatHighlight("Use confidence thresholds wisely:")}
    - 0.95+ for automated/unattended fixes
    - 0.8+ for semi-automated workflows
    - 0.5+ for interactive review

  ${formatHighlight("Combine with other commands:")}
    ${formatCommand("kustomark validate . && kustomark fix .")}
    Validate first, then fix issues

  ${formatHighlight("Review auto-fixes:")}
    Even high-confidence fixes should be reviewed
    Use git diff to see changes

  ${formatHighlight("Save to different file when unsure:")}
    ${formatCommand("kustomark fix . --save-to test.yaml")}
    Test the fixed config before replacing original

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark validate")}  Validate configuration (no fixes)
  ${formatCommand("kustomark lint")}      Check for warnings and best practices
  ${formatCommand("kustomark debug")}     Interactive patch debugging
  ${formatCommand("kustomark analyze")}   Analyze configuration complexity
`;
}

// ============================================================================
// Lint Command Help
// ============================================================================

function getLintHelp(): string {
  return `
${formatTitle("kustomark lint - Check for common issues")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark lint")} [path] [options]

${formatSection("DESCRIPTION")}
  Lint analyzes your configuration for common issues, anti-patterns,
  and potential problems that aren't strict errors but could cause
  unexpected behavior. It provides recommendations for improving your
  configuration.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

${formatSection("EXAMPLES")}
  ${formatExample("# Check for common issues")}
  ${formatCommand("kustomark lint ./team/")}

  ${formatExample("# Get lint results as JSON")}
  ${formatCommand("kustomark lint ./team/ --format=json")}

  ${formatExample("# Verbose lint with detailed explanations")}
  ${formatCommand("kustomark lint ./team/ -v")}

${formatSection("CHECKS PERFORMED")}
  ${formatHighlight("Overlapping patches:")}
    Detects patches that might conflict or overlap
    Warns about duplicate replacements

  ${formatHighlight("Redundant patches:")}
    Identifies patches that have no effect
    Detects patches that cancel each other out

  ${formatHighlight("Resource issues:")}
    Warns about missing resources
    Detects unreachable configurations

  ${formatHighlight("Performance issues:")}
    Suggests using --parallel for large projects
    Recommends --incremental for development

${formatSection("USE CASES")}
  ${formatHighlight("Pre-commit check:")}
    ${formatCommand("kustomark lint . && git commit")}
    Catch issues before committing

  ${formatHighlight("CI/CD validation:")}
    ${formatCommand("kustomark lint . --format=json")}
    Automated quality checks

  ${formatHighlight("Configuration review:")}
    ${formatCommand("kustomark lint . -v")}
    Understand potential issues in detail

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark validate")} Check for errors
  ${formatCommand("kustomark explain")}  Understand configuration
`;
}

// ============================================================================
// Explain Command Help
// ============================================================================

function getExplainHelp(): string {
  return `
${formatTitle("kustomark explain - Show resolution chain")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark explain")} [path] [options]

${formatSection("DESCRIPTION")}
  Explain shows how kustomark resolves your configuration, including
  the full chain of overlays, resource resolution, and which patches
  apply to which files. This helps you understand complex multi-layer
  configurations and troubleshoot unexpected behavior.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--file")} <filename>      Show lineage for a specific file
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

${formatSection("EXAMPLES")}
  ${formatExample("# Show full resolution chain")}
  ${formatCommand("kustomark explain ./team/")}

  ${formatExample("# Show lineage for a specific file")}
  ${formatCommand("kustomark explain ./team/ --file guide.md")}

  ${formatExample("# Get explanation as JSON")}
  ${formatCommand("kustomark explain ./team/ --format=json")}

  ${formatExample("# Detailed explanation with verbose output")}
  ${formatCommand("kustomark explain ./team/ -v")}

${formatSection("OUTPUT INFORMATION")}
  ${formatHighlight("Configuration chain:")}
    Shows the order configurations are loaded
    Displays resource and patch counts per config

  ${formatHighlight("File lineage (with --file):")}
    Shows which config introduced the file
    Lists all patches that apply to the file
    Shows patch details and order

  ${formatHighlight("Resolution details:")}
    Total files processed
    Total patches applied
    Output directory

${formatSection("USE CASES")}
  ${formatHighlight("Understanding overlays:")}
    ${formatCommand("kustomark explain .")}
    See how base and overlay configs combine

  ${formatHighlight("Troubleshooting files:")}
    ${formatCommand("kustomark explain . --file mystery.md")}
    Find out where a file comes from

  ${formatHighlight("Patch debugging:")}
    ${formatCommand("kustomark explain . --file guide.md -v")}
    See all patches affecting a file in order

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark debug")}     Interactive patch debugging
  ${formatCommand("kustomark lint")}      Check for issues
`;
}

// ============================================================================
// Analyze Command Help
// ============================================================================

function getAnalyzeHelp(): string {
  return `
${formatTitle("kustomark analyze - Analyze patch configuration")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark analyze")} [path] [options]

${formatSection("DESCRIPTION")}
  Analyze provides insights into your patch configuration by examining
  complexity, patterns, and potential optimizations. It helps you understand
  the maintainability of your configuration and suggests improvements.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("--show-patterns")}        Show detailed pattern analysis
  ${formatFlag("--show-recommendations")} Show optimization recommendations
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity
  ${formatFlag("-q")}                     Quiet mode (errors only)

${formatSection("EXAMPLES")}
  ${formatExample("# Analyze configuration")}
  ${formatCommand("kustomark analyze ./team/")}

  ${formatExample("# Get analysis as JSON")}
  ${formatCommand("kustomark analyze ./team/ --format=json")}

  ${formatExample("# Show detailed pattern analysis")}
  ${formatCommand("kustomark analyze ./team/ --show-patterns")}

  ${formatExample("# Get recommendations for optimization")}
  ${formatCommand("kustomark analyze ./team/ --show-recommendations")}

${formatSection("ANALYSIS METRICS")}
  ${formatHighlight("Complexity Score:")}
    Overall complexity (0-100) based on:
    - Number of patches
    - Operation diversity
    - Pattern complexity
    - Conditional logic depth

  ${formatHighlight("Maintainability Score:")}
    Ease of understanding and modifying (0-100)
    Higher scores indicate simpler, clearer configs

  ${formatHighlight("Pattern Detection:")}
    Identifies common patterns like:
    - Repeated replacements (suggest regex)
    - Similar patches (suggest inheritance)
    - Overlapping operations (suggest merge)

  ${formatHighlight("Recommendations:")}
    Actionable suggestions to improve config:
    - Use patch groups for organization
    - Consolidate similar operations
    - Add validation rules
    - Optimize resource patterns

${formatSection("OUTPUT FORMAT")}
  ${formatHighlight("Text format:")}
    Human-readable summary with scores
    Lists patterns and recommendations
    Color-coded severity levels

  ${formatHighlight("JSON format:")}
    {
      "complexity": 35,
      "maintainability": 82,
      "patches": {
        "total": 15,
        "byOperation": {...}
      },
      "patterns": [...],
      "recommendations": [...]
    }

${formatSection("USE CASES")}
  ${formatHighlight("Configuration review:")}
    ${formatCommand("kustomark analyze .")}
    Understand config complexity before making changes

  ${formatHighlight("Optimization:")}
    ${formatCommand("kustomark analyze . --show-recommendations")}
    Find ways to simplify and improve configuration

  ${formatHighlight("Team onboarding:")}
    ${formatCommand("kustomark analyze . --show-patterns")}
    Help new team members understand config structure

  ${formatHighlight("CI/CD metrics:")}
    ${formatCommand("kustomark analyze . --format=json")}
    Track configuration complexity over time

${formatSection("INTERPRETATION")}
  ${formatHighlight("Complexity Scores:")}
    0-25:   Simple configuration
    26-50:  Moderate complexity
    51-75:  Complex configuration
    76-100: Very complex (consider refactoring)

  ${formatHighlight("Maintainability Scores:")}
    80-100: Highly maintainable
    60-79:  Moderately maintainable
    40-59:  Challenging to maintain
    0-39:   Difficult to maintain (needs refactoring)

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark lint")}      Check for issues
  ${formatCommand("kustomark explain")}   Understand resolution
  ${formatCommand("kustomark validate")}  Validate configuration
`;
}

// ============================================================================
// Test Command Help
// ============================================================================

function getTestHelp(): string {
  return `
${formatTitle("kustomark test - Run patch tests")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark test --suite")} <file> [options]
  ${formatCommand("kustomark test --patch")} <yaml> --input <file> [options]
  ${formatCommand("kustomark test --patch-file")} <file> --input <file> [options]

${formatSection("DESCRIPTION")}
  Test runs patch tests against sample markdown content. You can run a full
  test suite from a file, or test individual patches inline or from a file.
  Tests verify that patches produce expected output and help catch regressions.

${formatSection("TEST MODES")}
  ${formatHighlight("Test Suite Mode:")}
    ${formatCommand("kustomark test --suite tests.yaml")}
    Run multiple tests defined in a PatchTestSuite file

  ${formatHighlight("Inline Patch Mode:")}
    ${formatCommand("kustomark test --patch '<yaml>' --input file.md")}
    Test a single inline patch against an input file

  ${formatHighlight("Patch File Mode:")}
    ${formatCommand("kustomark test --patch-file patches.yaml --input file.md")}
    Test patches from a file against an input file

${formatSection("OPTIONS")}
  ${formatFlag("--suite")} <file>         Path to test suite YAML file
  ${formatFlag("--patch")} <yaml>         Inline YAML patch to test
  ${formatFlag("--patch-file")} <file>    Path to file containing patches
  ${formatFlag("--input")} <file>         Input markdown file to test against
  ${formatFlag("--content")} <string>     Inline markdown content to test against
  ${formatFlag("--format")} <text|json>   Output format (default: text)
  ${formatFlag("--show-steps")}          Show intermediate results for multi-patch sequences
  ${formatFlag("--strict")}              Exit with code 1 if any test fails
  ${formatFlag("-v, -vv, -vvv")}         Increase verbosity
  ${formatFlag("-q")}                    Quiet mode (errors only)

${formatSection("EXAMPLES")}
  ${formatExample("# Run a test suite")}
  ${formatCommand("kustomark test --suite tests/patches.yaml")}

  ${formatExample("# Test a single inline patch")}
  ${formatCommand("kustomark test --patch 'op: replace")}
  ${formatCommand("old: foo")}
  ${formatCommand("new: bar' --input doc.md")}

  ${formatExample("# Test patches from a file")}
  ${formatCommand("kustomark test --patch-file patches.yaml --input sample.md")}

  ${formatExample("# Test with inline content")}
  ${formatCommand("kustomark test --patch 'op: replace")}
  ${formatCommand("old: hello")}
  ${formatCommand("new: goodbye' --content 'hello world'")}

  ${formatExample("# Get test results as JSON")}
  ${formatCommand("kustomark test --suite tests.yaml --format=json")}

  ${formatExample("# Fail on any test failure (for CI/CD)")}
  ${formatCommand("kustomark test --suite tests.yaml --strict")}

${formatSection("TEST SUITE FORMAT")}
  ${formatHighlight("A PatchTestSuite YAML file contains:")}
    ${formatExample("apiVersion: kustomark/v1")}
    ${formatExample("kind: PatchTestSuite")}
    ${formatExample("tests:")}
    ${formatExample("  - name: Test name")}
    ${formatExample("    input: |")}
    ${formatExample("      # Input markdown")}
    ${formatExample("    patches:")}
    ${formatExample("      - op: replace")}
    ${formatExample("        old: foo")}
    ${formatExample("        new: bar")}
    ${formatExample("    expected: |")}
    ${formatExample("      # Expected output")}

${formatSection("OUTPUT FORMAT")}
  ${formatHighlight("Text format:")}
    - Colorized pass/fail indicators
    - Unified diff for failures
    - Summary with counts

  ${formatHighlight("JSON format:")}
    - Structured test results
    - All test outcomes
    - Error details and diffs

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    All tests passed
  ${formatHighlight("1")}    One or more tests failed or validation errors

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark debug")}      Interactive patch debugging
  ${formatCommand("kustomark validate")}   Validate configuration
`;
}

// ============================================================================
// Fetch Command Help
// ============================================================================

function getFetchHelp(): string {
  return `
${formatTitle("kustomark fetch - Fetch remote resources")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark fetch")} [path] [options]

${formatSection("DESCRIPTION")}
  Fetch downloads remote resources (git repositories, HTTP archives) and
  caches them locally without building. This is useful for pre-downloading
  dependencies, updating caches, or verifying remote resource availability.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--update")}               Update kustomark.lock with latest refs
  ${formatFlag("--no-lock")}              Ignore lock file (fetch latest versions)
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}          Increase verbosity

${formatSection("EXAMPLES")}
  ${formatExample("# Fetch all remote resources")}
  ${formatCommand("kustomark fetch ./team/")}

  ${formatExample("# Update lock file with latest versions")}
  ${formatCommand("kustomark fetch ./team/ --update")}

  ${formatExample("# Fetch latest versions (ignore lock)")}
  ${formatCommand("kustomark fetch ./team/ --no-lock")}

${formatSection("REMOTE RESOURCE TYPES")}
  ${formatHighlight("Git repositories:")}
    github.com/org/repo//path?ref=v1.0.0
    git::https://github.com/org/repo.git//path?ref=main
    git::git@github.com:org/repo.git//path?ref=v2.0

  ${formatHighlight("HTTP archives:")}
    https://example.com/archive.tar.gz//path
    https://example.com/file.zip//path?checksum=sha256:abc123...

${formatSection("CACHE LOCATIONS")}
  ${formatHighlight("Git cache:")}      ~/.cache/kustomark/git/
  ${formatHighlight("HTTP cache:")}     ~/.cache/kustomark/http/
  ${formatHighlight("Build cache:")}    ~/.cache/kustomark/builds/

${formatSection("USE CASES")}
  ${formatHighlight("Pre-download dependencies:")}
    ${formatCommand("kustomark fetch .")}
    Download all remotes before offline work

  ${formatHighlight("Update dependencies:")}
    ${formatCommand("kustomark fetch . --update")}
    Get latest versions and update lock file

  ${formatHighlight("CI/CD caching:")}
    ${formatCommand("kustomark fetch . && kustomark build . --offline")}
    Separate fetch and build steps for better caching

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark cache")}    Manage cache
  ${formatCommand("kustomark build")}    Build with fetched resources
`;
}

// ============================================================================
// Web Command Help
// ============================================================================

function getWebHelp(): string {
  return `
${formatTitle("kustomark web - Visual editing interface")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark web")} [path] [options]

${formatSection("DESCRIPTION")}
  Web launches a visual interface for editing kustomark configurations,
  previewing changes, and managing patches through a GUI. It provides
  an alternative to editing YAML files directly and includes real-time
  diff viewing and markdown preview.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to directory containing kustomark.yaml (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--dev, -d")}              Run in development mode with hot reload
  ${formatFlag("--port")} <port>          Server port (default: 3000)
  ${formatFlag("--host")} <host>          Server host (default: localhost)
  ${formatFlag("--open, -o")}             Open browser automatically
  ${formatFlag("-v")}                     Verbose logging

${formatSection("EXAMPLES")}
  ${formatExample("# Start web UI (production mode)")}
  ${formatCommand("kustomark web")}

  ${formatExample("# Development mode with hot reload")}
  ${formatCommand("kustomark web --dev")}

  ${formatExample("# Custom port and auto-open browser")}
  ${formatCommand("kustomark web --port 8080 --open")}

  ${formatExample("# Listen on all interfaces")}
  ${formatCommand("kustomark web --host 0.0.0.0")}

${formatSection("FEATURES")}
  ${formatHighlight("Visual Config Editor:")}
    - YAML configuration preview
    - Add, edit, delete, reorder patches
    - Drag-and-drop patch reordering

  ${formatHighlight("Patch Form:")}
    - Support for all 22 patch operations
    - Context-aware field rendering
    - Real-time validation
    - Common fields (id, extends, include, exclude, etc.)

  ${formatHighlight("Four View Modes:")}
    - Editor: Manage configuration and patches
    - Diff: Side-by-side diff viewer
    - Preview: Rendered markdown preview
    - Files: File browser with content viewer

  ${formatHighlight("Build Integration:")}
    - Execute builds with flags
    - View build results and statistics
    - See validation errors and warnings

  ${formatHighlight("File Browser:")}
    - Tree view of project structure
    - Expand/collapse directories
    - View file contents with syntax highlighting
    - Copy file contents to clipboard

${formatSection("DEVELOPMENT MODE")}
  With --dev flag:
    - Backend API server: http://localhost:3000
    - Frontend dev server: http://localhost:5173 (Vite)
    - Hot reload for instant feedback
    - Source maps for debugging

${formatSection("PRODUCTION MODE")}
  Default mode:
    - Single server at http://localhost:3000
    - Serves both API and static assets
    - Optimized and bundled frontend

${formatSection("USE CASES")}
  ${formatHighlight("Beginners:")}
    Visual interface is easier than editing YAML
    See immediate feedback on changes

  ${formatHighlight("Complex configurations:")}
    Manage many patches with drag-and-drop
    Preview changes before building

  ${formatHighlight("Team collaboration:")}
    Share web UI on network for team editing
    Visual tool accessible to non-technical users

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark watch")}    Auto-rebuild on changes
  ${formatCommand("kustomark debug")}    Interactive debugging
`;
}

// ============================================================================
// Cache Command Help
// ============================================================================

function getCacheHelp(): string {
  return `
${formatTitle("kustommark cache - Manage resource cache")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark cache")} <command> [pattern] [options]

${formatSection("DESCRIPTION")}
  Cache manages the local cache for remote resources (git repositories
  and HTTP archives). Use it to list cached resources, clear the cache,
  or remove specific cached items.

${formatSection("COMMANDS")}
  ${formatFlag("list")}              List all cached resources (git and HTTP)
  ${formatFlag("clear")}             Clear all caches
  ${formatFlag("clear")} <pattern>   Clear specific resources matching pattern

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <text|json>    Output format (default: text)

${formatSection("EXAMPLES")}
  ${formatExample("# List all cached resources")}
  ${formatCommand("kustomark cache list")}

  ${formatExample("# List with JSON output")}
  ${formatCommand("kustomark cache list --format=json")}

  ${formatExample("# Clear all caches")}
  ${formatCommand("kustomark cache clear")}

  ${formatExample("# Clear specific repository cache")}
  ${formatCommand("kustomark cache clear github.com/org/repo")}

  ${formatExample("# Clear all github.com caches")}
  ${formatCommand("kustomark cache clear github.com")}

${formatSection("CACHE STRUCTURE")}
  ${formatHighlight("Git cache (~/.cache/kustomark/git/):")}
    Stores cloned repositories by URL hash
    Includes refs and checkouts

  ${formatHighlight("HTTP cache (~/.cache/kustomark/http/):")}
    Stores downloaded archives by URL hash
    Includes extracted contents

  ${formatHighlight("Build cache (~/.cache/kustomark/builds/):")}
    Stores incremental build state
    Tracks file hashes and patch changes

${formatSection("WHEN TO CLEAR CACHE")}
  ${formatHighlight("Troubleshooting:")}
    ${formatCommand("kustomark cache clear")}
    Clear all caches if seeing stale content

  ${formatHighlight("Freeing disk space:")}
    ${formatCommand("kustomark cache clear")}
    Remove cached resources no longer needed

  ${formatHighlight("Updating specific resource:")}
    ${formatCommand("kustomark cache clear github.com/org/repo")}
    Clear one resource to re-fetch latest

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark fetch")}    Fetch remote resources
  ${formatCommand("kustomark build")}    Build (uses cache)
`;
}

// ============================================================================
// Schema Command Help
// ============================================================================

function getSchemaHelp(): string {
  return `
${formatTitle("kustomark schema - Export JSON Schema")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark schema")} [options]

${formatSection("DESCRIPTION")}
  Schema generates a JSON Schema definition for kustomark.yaml files.
  This schema can be used by editors like VSCode for autocomplete,
  validation, and documentation while editing configurations.

${formatSection("OPTIONS")}
  ${formatFlag("--format")} <json>    Output format (always JSON for schema)

${formatSection("EXAMPLES")}
  ${formatExample("# Generate schema and save to file")}
  ${formatCommand("kustomark schema > kustomark.schema.json")}

  ${formatExample("# Pretty-print schema")}
  ${formatCommand("kustomark schema | jq .")}

${formatSection("EDITOR INTEGRATION")}
  ${formatHighlight("VSCode:")}
    Install the Kustomark extension for built-in support
    Or configure schema manually in settings.json:

    {
      "yaml.schemas": {
        "./kustomark.schema.json": "kustomark.yaml"
      }
    }

  ${formatHighlight("Other editors:")}
    Most YAML-aware editors support JSON Schema
    Reference the generated schema for your files

${formatSection("SCHEMA FEATURES")}
  - Autocomplete for all fields and operations
  - Validation for required fields
  - Documentation for each property
  - Enum validation for fixed values
  - Pattern validation for regex and globs

${formatSection("USE CASES")}
  ${formatHighlight("IDE setup:")}
    ${formatCommand("kustomark schema > schema.json")}
    Configure editor for autocomplete

  ${formatHighlight("Documentation generation:")}
    Generate schema to create API documentation
    Use tools like json-schema-to-markdown

  ${formatHighlight("Validation in CI/CD:")}
    Validate configs against schema in pipelines

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark validate")} Validate configuration
  ${formatCommand("kustomark web")}      Visual editor with validation
`;
}

// ============================================================================
// Snapshot Command Help
// ============================================================================

function getSnapshotHelp(): string {
  return `
${formatTitle("kustomark snapshot - Create, verify, or update build output snapshots")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark snapshot")} [path] [options]
  ${formatCommand("kustomark snapshot")} [path] ${formatFlag("--verify")} [options]
  ${formatCommand("kustomark snapshot")} [path] ${formatFlag("--update-snapshot")} [options]

${formatSection("DESCRIPTION")}
  Snapshot testing helps detect unintended changes by comparing current build
  output against a saved baseline. Use ${formatFlag("snapshot")} to create a baseline,
  ${formatFlag("--verify")} to check for changes (returns exit code 1 if different),
  and ${formatFlag("--update-snapshot")} to update the baseline after intentional
  modifications.

  Snapshots are stored as .snapshot files alongside your build output, allowing
  you to catch unintended changes in your patches or configuration and verify
  that your builds remain stable across updates.

${formatSection("ARGUMENTS")}
  ${formatFlag("path")}    Path to kustomark.yaml or directory (default: current directory)

${formatSection("OPTIONS")}
  ${formatFlag("--verify")}             Verify current build matches saved snapshot
  ${formatFlag("--update-snapshot")}    Update existing snapshot with current build
  ${formatFlag("--format")} <text|json> Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}       Increase verbosity
  ${formatFlag("-q")}                  Quiet mode (errors only)

  All build options (--parallel, --incremental, --enable-groups, etc.) are
  also supported for snapshot to ensure accurate comparisons.

${formatSection("EXAMPLES")}
  ${formatExample("# Create initial snapshot")}
  ${formatCommand("kustomark snapshot")}

  ${formatExample("# Verify build matches snapshot (useful in CI)")}
  ${formatCommand("kustomark snapshot --verify")}

  ${formatExample("# Update snapshot after intentional changes")}
  ${formatCommand("kustomark snapshot --update-snapshot")}

  ${formatExample("# Snapshot from specific directory")}
  ${formatCommand("kustomark snapshot ./team/")}

  ${formatExample("# Verify with verbose output")}
  ${formatCommand("kustomark snapshot --verify -v")}

  ${formatExample("# JSON output for automation")}
  ${formatCommand("kustomark snapshot --verify --format=json")}

  ${formatExample("# Create snapshot with specific patch groups")}
  ${formatCommand("kustomark snapshot --enable-groups=branding,security")}

${formatSection("MODES")}
  ${formatHighlight("Create mode (default):")}
    ${formatCommand("kustomark snapshot")}
    Creates .snapshot files for each build output
    Useful when setting up snapshot testing for first time

  ${formatHighlight("Verify mode:")}
    ${formatCommand("kustomark snapshot --verify")}
    Compares current build with saved snapshots
    Returns exit code 0 if no differences, 1 if different
    Useful in CI/CD pipelines to detect changes

  ${formatHighlight("Update mode:")}
    ${formatCommand("kustomark snapshot --update-snapshot")}
    Overwrites existing snapshots with current build
    Use after intentional changes and code review
    Creates new snapshots if they don't exist

${formatSection("SNAPSHOT FILES")}
  ${formatHighlight("File naming:")}
    Output files have .snapshot extension added
    Example: guide.md becomes guide.md.snapshot
    Stored alongside original output files

  ${formatHighlight("Snapshot content:")}
    Complete output file content for comparison
    Plain text format for git-friendly diffs
    Can be stored in version control

${formatSection("USE CASES")}
  ${formatHighlight("Regression testing:")}
    ${formatCommand("kustomark snapshot --verify")}
    Ensure patches produce expected output
    Catch unintended changes in configuration

  ${formatHighlight("CI/CD validation:")}
    ${formatCommand("kustomark snapshot --verify")}
    Run in CI pipeline to detect regressions
    Fail build if output changes unexpectedly

  ${formatHighlight("Patch development:")}
    1. ${formatCommand("kustomark snapshot")} - Create baseline
    2. Make changes to patches
    3. ${formatCommand("kustomark snapshot --verify")} - Check impact
    4. ${formatCommand("kustomark snapshot --update-snapshot")} - Accept changes

  ${formatHighlight("Documentation verification:")}
    Create snapshots of generated documentation
    Verify documentation remains consistent
    Catch unintended formatting changes

${formatSection("WORKFLOW EXAMPLES")}
  ${formatHighlight("Initial setup:")}
    1. Finalize your kustomark.yaml configuration
    2. Run ${formatCommand("kustomark build")} to verify everything works
    3. ${formatCommand("kustomark snapshot")} - Create baseline snapshots
    4. Commit ${formatExample(".snapshot")} files to git

  ${formatHighlight("Development workflow:")}
    1. Make changes to patches or configuration
    2. ${formatCommand("kustomark diff")} - Preview changes
    3. ${formatCommand("kustomark build")} - Build if satisfied
    4. ${formatCommand("kustomark snapshot --verify")} - Check if changed

  ${formatHighlight("Snapshot verification:")}
    1. ${formatCommand("kustomark snapshot --verify")} - Check current state
    2. Review any differences with ${formatCommand("kustomark diff")}
    3. ${formatCommand("kustomark snapshot --update-snapshot")} - Accept changes
    4. Commit updated snapshots

  ${formatHighlight("CI/CD integration:")}
    # In your CI script
    ${formatCommand("kustomark build")}  # Build output
    ${formatCommand("kustomark snapshot --verify")}  # Verify no regressions
    # CI fails if snapshots don't match

${formatSection("COMPARISON WITH BUILD")}
  ${formatHighlight("build")}           Writes files to output directory
  ${formatHighlight("snapshot")}       Creates/verifies .snapshot files of output

  The snapshot command uses the same build process but focuses on
  comparing output against saved snapshots rather than writing files.

${formatSection("OUTPUT FORMAT")}
  ${formatHighlight("Text format:")}
    Summary of snapshot operations
    Lists changed, added, and deleted files
    Shows differences for changed files

  ${formatHighlight("JSON format:")}
    {
      "action": "verify|create|update",
      "success": true|false,
      "filesChanged": 3,
      "filesAdded": 1,
      "filesDeleted": 0,
      "differences": [
        {
          "file": "guide.md",
          "status": "modified",
          "diff": "..."
        }
      ]
    }

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Snapshots match (verify) or created/updated successfully
  ${formatHighlight("1")}    Snapshots don't match (verify) or error occurred
  ${formatHighlight("2")}    Configuration file not found or invalid

${formatSection("BEST PRACTICES")}
  ${formatHighlight("Commit snapshots to version control:")}
    Store .snapshot files with your code
    Enables visibility into output changes
    Useful for code reviews

  ${formatHighlight("Review changes before updating:")}
    Always run ${formatCommand("kustomark diff")} before updating snapshots
    Review the differences carefully
    Verify changes are intentional

  ${formatHighlight("Use in CI/CD:")}
    Include ${formatCommand("kustomark snapshot --verify")} in CI pipeline
    Detect unintended changes immediately
    Fail fast to prevent bad deployments

  ${formatHighlight("Regular maintenance:")}
    Update snapshots after intentional changes
    Remove .snapshot files for deleted outputs
    Keep snapshots synchronized with configuration

${formatSection("TIPS")}
  ${formatHighlight("First snapshot creates baseline:")}
    ${formatCommand("kustomark snapshot")} - Creates baseline snapshots
    ${formatCommand("kustomark snapshot --verify")} - Later verifies against baseline

  ${formatHighlight("Use with patch groups:")}
    ${formatCommand("kustomark snapshot --enable-groups=feature")}
    Snapshot specific patch combinations

  ${formatHighlight("Combine with other commands:")}
    ${formatCommand("kustomark snapshot && kustomark diff")}
    See full impact before updating

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark build")}     Build output files
  ${formatCommand("kustomark diff")}      Preview changes
  ${formatCommand("kustomark preview")}   Visual side-by-side comparison
  ${formatCommand("kustomark test")}      Run patch tests
`;
}

// ============================================================================
// Template Command Help
// ============================================================================

function getTemplateHelp(): string {
  return `
${formatTitle("kustomark template - Manage and apply configuration templates")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark template list")} [options]
  ${formatCommand("kustomark template show")} <template> [options]
  ${formatCommand("kustomark template apply")} <template> [options]
  ${formatCommand("kustomark template init")} [path] [options]

${formatSection("DESCRIPTION")}
  Template commands help you discover, inspect, and apply pre-built
  configuration templates. Templates provide starter configurations for
  common use cases, reducing time-to-first-success for new users.

${formatSection("SUBCOMMANDS")}
  ${formatFlag("list")}               List all available templates
  ${formatFlag("show")} <template>    Show detailed information about a template
  ${formatFlag("apply")} <template>   Apply a template to create new configuration
  ${formatFlag("init")} [path]        Create a new custom template (interactive scaffolding)

${formatSection("LIST OPTIONS")}
  ${formatFlag("--category")} <cat>     Filter by category (upstream-fork, documentation, skills, custom)
  ${formatFlag("--tag")} <tag>          Filter by tag
  ${formatFlag("--format")} <text|json> Output format (default: text)

${formatSection("SHOW OPTIONS")}
  ${formatFlag("--format")} <text|json> Output format (default: text)

${formatSection("APPLY OPTIONS")}
  ${formatFlag("-i, --interactive")}      Enable interactive prompts for missing variables
  ${formatFlag("--var")} <KEY=VALUE>       Provide template variable (can be repeated)
  ${formatFlag("--output")} <path>         Output directory (default: current directory)
  ${formatFlag("--dry-run")}              Preview without creating files
  ${formatFlag("--overwrite")}            Replace existing files
  ${formatFlag("--format")} <text|json>    Output format (default: text)

${formatSection("INIT OPTIONS")}
  ${formatFlag("--non-interactive")}       Use defaults instead of prompts
  ${formatFlag("--format")} <text|json>    Output format (default: text)
  ${formatFlag("-v")}                      Verbose output

${formatSection("EXAMPLES")}
  ${formatExample("# List all available templates")}
  ${formatCommand("kustomark template list")}

  ${formatExample("# List templates in a specific category")}
  ${formatCommand("kustomark template list --category=skills")}

  ${formatExample("# Show detailed information about a template")}
  ${formatCommand("kustomark template show upstream-fork")}

  ${formatExample("# Interactive mode - prompts for all variables")}
  ${formatCommand("kustomark template apply upstream-fork")}

  ${formatExample("# Interactive mode with some pre-filled variables")}
  ${formatCommand("kustomark template apply upstream-fork --var project_name=my-docs")}

  ${formatExample("# Explicit interactive mode")}
  ${formatCommand("kustomark template apply upstream-fork --interactive")}

  ${formatExample("# Non-interactive mode - provide all variables")}
  ${formatCommand("kustomark template apply upstream-fork --var project_name=my-docs --var upstream_url=https://github.com/org/repo")}

  ${formatExample("# Apply template to specific directory")}
  ${formatCommand("kustomark template apply skills --output=./my-skills/")}

  ${formatExample("# Dry run - preview without creating files")}
  ${formatCommand("kustomark template apply upstream-fork --dry-run --var project_name=test --var upstream_url=https://example.com")}

  ${formatExample("# Overwrite existing files")}
  ${formatCommand("kustomark template apply documentation --overwrite --var project_name=docs")}

  ${formatExample("# Get template list as JSON")}
  ${formatCommand("kustomark template list --format=json")}

  ${formatExample("# Create a new template interactively")}
  ${formatCommand("kustomark template init my-custom-template")}

  ${formatExample("# Create a template with defaults (non-interactive)")}
  ${formatCommand("kustomark template init my-template --non-interactive")}

${formatSection("INTERACTIVE MODE BEHAVIOR")}
  ${formatHighlight("Auto-interactive mode:")}
    When running ${formatCommand("kustomark template apply")} without ${formatFlag("--var")} flags
    and format is ${formatFlag("text")}, interactive mode is automatically enabled.
    You'll be prompted for any required variables.

  ${formatHighlight("Explicit interactive mode:")}
    Use ${formatFlag("--interactive")} to enable prompts even when some variables
    are provided via ${formatFlag("--var")} flags. This allows you to mix
    command-line arguments with interactive input.

  ${formatHighlight("Non-interactive mode:")}
    Interactive mode is disabled when:
    - ${formatFlag("--format=json")} is used (for automation compatibility)
    - All required variables are provided via ${formatFlag("--var")} flags
    - This ensures templates work in CI/CD pipelines

  ${formatHighlight("User experience:")}
    - Interactive prompts show which variables are already provided
    - Input validation ensures required variables aren't left empty
    - Graceful cancellation with Ctrl+C exits without error
    - Helpful error messages guide you to use ${formatFlag("--var")} or ${formatFlag("--interactive")}

${formatSection("TEMPLATE CATEGORIES")}
  ${formatHighlight("upstream-fork:")}
    Templates for consuming and customizing upstream markdown content
    Example: Fork documentation and apply team-specific patches

  ${formatHighlight("documentation:")}
    Documentation pipeline templates for building doc sites
    Example: API docs, user guides, internal wikis

  ${formatHighlight("skills:")}
    Claude Code skill customization templates
    Example: Team-specific skill variants, custom prompts

  ${formatHighlight("custom:")}
    User-defined custom templates
    Example: Project-specific patterns

${formatSection("TEMPLATE STRUCTURE")}
  Each template contains:
    - ${formatHighlight("template.yaml")}   Template definition with metadata and variables
    - ${formatHighlight("files/")}          Template files to copy (with variable substitution)
    - ${formatHighlight("README.md")}       Template documentation

  ${formatHighlight("Template variables:")}
    Templates can define variables that are substituted in file names
    and content using {{variable_name}} syntax. Variables can be:
    - Required or optional
    - Typed (string, boolean, number, array)
    - Validated with regex patterns
    - Have default values

${formatSection("VARIABLE SUBSTITUTION")}
  Template files use {{variable_name}} placeholders:

  ${formatExample("# kustomark.yaml template file")}
  ${formatExample("apiVersion: kustomark/v1")}
  ${formatExample("kind: Kustomization")}
  ${formatExample("resources:")}
  ${formatExample("  - {{upstream_url}}")}
  ${formatExample("patches:")}
  ${formatExample("  - op: replace")}
  ${formatExample("    old: {{old_name}}")}
  ${formatExample("    new: {{new_name}}")}

  ${formatHighlight("Values file (values.yaml):")}
  ${formatExample("upstream_url: https://github.com/org/repo")}
  ${formatExample("old_name: upstream")}
  ${formatExample("new_name: my-team")}

${formatSection("POST-APPLY COMMANDS")}
  Templates can define commands to run after files are created:
    - Initialize git repository
    - Run initial build
    - Validate configuration
    - Display next steps

  Use --skip-post-apply to prevent these commands from running.

${formatSection("USE CASES")}
  ${formatHighlight("Quick start for new projects:")}
    ${formatCommand("kustomark template list")}
    ${formatCommand("kustomark template show upstream-fork")}
    ${formatCommand("kustomark template apply upstream-fork")}
    Get up and running in seconds

  ${formatHighlight("Team onboarding:")}
    Share templates with team members
    Consistent project structure across team
    Reduce configuration errors

  ${formatHighlight("Documentation as code:")}
    Apply documentation templates
    Customize for your project
    Build and deploy with kustomark

  ${formatHighlight("Skill customization:")}
    Start with base skill template
    Customize for team workflows
    Share across organization

${formatSection("CREATING CUSTOM TEMPLATES")}
  To create your own template:

  1. Create directory with template.yaml:
     ${formatExample("apiVersion: kustomark/v1")}
     ${formatExample("kind: Template")}
     ${formatExample("metadata:")}
     ${formatExample("  name: my-template")}
     ${formatExample("  description: My custom template")}
     ${formatExample("  category: custom")}
     ${formatExample("  version: 1.0.0")}
     ${formatExample("variables:")}
     ${formatExample("  - name: project_name")}
     ${formatExample("    description: Project name")}
     ${formatExample("    type: string")}
     ${formatExample("    required: true")}
     ${formatExample("files:")}
     ${formatExample("  - src: kustomark.yaml.tpl")}
     ${formatExample("    dest: kustomark.yaml")}
     ${formatExample("    substitute: true")}

  2. Add template files with {{variables}}
  3. Test with: kustomark template apply ./my-template

${formatSection("JSON OUTPUT")}
  With --format=json, commands output structured data:

  ${formatHighlight("List:")}
    {"count": 5, "templates": [...]}

  ${formatHighlight("Show:")}
    {template definition with all metadata}

  ${formatHighlight("Apply:")}
    {"success": true, "filesCreated": [...], "errors": [], "warnings": []}

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Command succeeded
  ${formatHighlight("1")}    Command failed or template not found

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark init")}      Create configuration (alternative to templates)
  ${formatCommand("kustomark validate")}  Validate created configuration
  ${formatCommand("kustomark build")}     Build from template-created config
`;
}

// ============================================================================
// Suggest Command Help
// ============================================================================

function getSuggestHelp(): string {
  return `
${formatTitle("kustomark suggest - Generate patch configuration from file differences")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark suggest")} --source <path> --target <path> [options]

${formatSection("DESCRIPTION")}
  Suggest analyzes the differences between source and target files and
  automatically generates patch operations to transform the source into
  the target. This helps you create kustomark.yaml configurations without
  manually writing patches.

  The command intelligently detects:
    - Frontmatter changes (set, remove, rename)
    - Section modifications (rename, remove, replace)
    - Pattern-based replacements (URLs, versions, repeated strings)
    - Line-level edits (insert, delete, replace)

  It assigns confidence scores to each suggestion and generates a complete
  kustomark.yaml configuration that you can review and use.

${formatSection("ARGUMENTS")}
  ${formatFlag("--source")} <path>    Source file or directory (before state)
  ${formatFlag("--target")} <path>    Target file or directory (after state)

${formatSection("OPTIONS")}
  ${formatFlag("--output")} <path>             Write generated config to file
  ${formatFlag("--write")} <path>              Write patches into a config file (creates or merges into existing patches: array)
  ${formatFlag("--min-confidence")} <0.0-1.0>  Filter patches below confidence threshold (0.0-1.0)
  ${formatFlag("--verify")}                   Apply patches to source and compare with target to confirm accuracy
  ${formatFlag("--format")} <text|json>        Output format (default: text)
  ${formatFlag("-v, -vv, -vvv")}              Increase verbosity for more details
  ${formatFlag("-q")}                         Quiet mode (errors only)

${formatSection("HOW IT WORKS")}
  ${formatHighlight("1. File Matching:")}
     For directories, files are matched by relative path
     For single files, direct comparison is performed

  ${formatHighlight("2. Diff Analysis:")}
     Analyzes differences at multiple levels:
     - Frontmatter fields (YAML metadata)
     - Section structure (headers and content)
     - Text patterns (repeated changes)
     - Line-by-line changes

  ${formatHighlight("3. Patch Generation:")}
     Generates the most appropriate patch operations:
     - set-frontmatter: For metadata changes
     - rename-header: For section title changes
     - remove-section: For deleted sections
     - replace-regex: For pattern-based changes
     - replace: For simple string replacements

  ${formatHighlight("4. Confidence Scoring:")}
     High (0.9+):   Frontmatter and section operations
     Medium (0.7+): Pattern-based replacements
     Lower (<0.7):  Line-level edits

${formatSection("EXAMPLES")}
  ${formatExample("# Analyze differences between two files")}
  ${formatCommand("kustomark suggest --source original.md --target modified.md")}

  ${formatExample("# Generate config and save to file")}
  ${formatCommand("kustomark suggest --source docs/ --target customized/ --output kustomark.yaml")}

  ${formatExample("# Write suggested patches to a new config file")}
  ${formatCommand("kustomark suggest --source upstream.md --target modified.md --write kustomark.yaml")}

  ${formatExample("# Merge suggested patches into an existing config file")}
  ${formatCommand("kustomark suggest --source source/ --target target/ --write existing.yaml")}

  ${formatExample("# Analyze directories with verbose output")}
  ${formatCommand("kustomark suggest --source upstream/ --target team-docs/ -v")}

  ${formatExample("# Get suggestions as JSON")}
  ${formatCommand("kustomark suggest --source old.md --target new.md --format=json")}

  ${formatExample("# Compare entire documentation directories")}
  ${formatCommand("kustomark suggest --source vendor-docs/ --target our-docs/")}

  ${formatExample("# Filter low-confidence suggestions (only show patches with 0.8+ confidence)")}
  ${formatCommand("kustomark suggest --source old.md --target new.md --min-confidence=0.8")}

${formatSection("TEXT OUTPUT")}
  Text format displays:
    - Summary of files analyzed
    - Number of patches generated
    - Complete kustomark.yaml configuration
    - Statistics (with -v flag)

  ${formatHighlight("Example output:")}
    ${formatExample("Analyzing differences between source and target...")}
    ${formatExample("")}
    ${formatExample("Found 3 suggested patches:")}
    ${formatExample("")}
    ${formatExample("# Suggested kustomark.yaml")}
    ${formatExample("")}
    ${formatExample("apiVersion: kustomark/v1")}
    ${formatExample("kind: Kustomization")}
    ${formatExample("output: ./output")}
    ${formatExample("resources:")}
    ${formatExample("  - ./original.md")}
    ${formatExample("patches:")}
    ${formatExample("  - op: set-frontmatter")}
    ${formatExample("    key: version")}
    ${formatExample("    value: 2.0.0")}

${formatSection("JSON OUTPUT")}
  With --format=json, outputs structured data:

  ${formatExample("{")}
  ${formatExample('  "config": {')}
  ${formatExample('    "apiVersion": "kustomark/v1",')}
  ${formatExample('    "kind": "Kustomization",')}
  ${formatExample('    "output": "./output",')}
  ${formatExample('    "resources": ["./source"],')}
  ${formatExample('    "patches": [...]')}
  ${formatExample("  },")}
  ${formatExample('  "stats": {')}
  ${formatExample('    "filesAnalyzed": 5,')}
  ${formatExample('    "patchesGenerated": 12,')}
  ${formatExample('    "confidence": "high"')}
  ${formatExample("  }")}
  ${formatExample("}")}

${formatSection("USE CASES")}
  ${formatHighlight("Fork and customize documentation:")}
    Compare upstream docs with your customized version
    Generate patches to automate the customization
    Apply patches when upstream updates

  ${formatHighlight("Learn kustomark syntax:")}
    Make manual changes to markdown files
    Use suggest to see equivalent patch operations
    Understand how different changes map to patches

  ${formatHighlight("Migration from manual editing:")}
    Already customized files manually?
    Use suggest to convert edits to patches
    Move to automated pipeline

  ${formatHighlight("Automate repetitive tasks:")}
    Make changes to one file
    Generate patches automatically
    Apply to multiple files

${formatSection("WORKFLOW EXAMPLES")}
  ${formatHighlight("Example 1: Fork upstream documentation")}
    ${formatCommand("# 1. Clone upstream docs")}
    ${formatCommand("git clone https://github.com/vendor/docs upstream-docs/")}
    ${formatCommand("")}
    ${formatCommand("# 2. Make your customizations manually")}
    ${formatCommand("cp -r upstream-docs/ our-docs/")}
    ${formatCommand("# ... edit files in our-docs/ ...")}
    ${formatCommand("")}
    ${formatCommand("# 3. Generate patches from differences")}
    ${formatCommand("kustomark suggest --source upstream-docs/ --target our-docs/ --output kustomark.yaml")}
    ${formatCommand("")}
    ${formatCommand("# 4. Build using generated config")}
    ${formatCommand("kustomark build")}

  ${formatHighlight("Example 2: Update with upstream changes")}
    ${formatCommand("# 1. Pull latest upstream")}
    ${formatCommand("cd upstream-docs && git pull")}
    ${formatCommand("")}
    ${formatCommand("# 2. Rebuild with existing patches")}
    ${formatCommand("kustomark build")}
    ${formatCommand("")}
    ${formatCommand("# 3. If new changes needed, regenerate patches")}
    ${formatCommand("kustomark suggest --source upstream-docs/ --target our-docs/ --output kustomark.yaml")}

${formatSection("TIPS")}
  ${formatHighlight("Review generated patches:")}
    Suggestions are starting points, not perfect solutions
    Review the generated config before using in production
    Refine patches for better patterns and fewer operations

  ${formatHighlight("Combine with manual edits:")}
    Use suggest to get 80% of patches automatically
    Manually add specialized operations as needed
    Test with kustomark diff to verify behavior

  ${formatHighlight("Start simple:")}
    Begin with single-file comparisons
    Understand the generated patches
    Scale up to directory comparisons

  ${formatHighlight("Use verbosity flags:")}
    Add -v to see statistics and confidence scores
    Helps understand suggestion quality
    Use -vv or -vvv for debugging

${formatSection("LIMITATIONS")}
  - Suggestions are heuristic-based, not perfect
  - Complex structural changes may not be detected optimally
  - May generate multiple patches where one would suffice
  - Manual review and refinement recommended

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Suggestions generated successfully
  ${formatHighlight("1")}    Error (missing arguments, file not found, etc.)

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark build")}     Build using generated configuration
  ${formatCommand("kustomark diff")}      Preview changes before building
  ${formatCommand("kustomark validate")}  Validate generated configuration
`;
}

// ============================================================================
// Profile Command Help
// ============================================================================

function getProfileHelp(): string {
  return `
${formatTitle("kustomark profile - Memory profiling for kustomark operations")}

${formatSection("SYNOPSIS")}
  ${formatCommand("kustomark profile memory")} [options]

${formatSection("DESCRIPTION")}
  Profile provides memory usage analysis and leak detection for kustomark
  operations. It runs predefined or custom scenarios to measure memory
  consumption, track garbage collection activity, and identify potential
  memory leaks.

  The profiler tracks:
    - Memory allocations over time
    - Garbage collection events and effectiveness
    - Heap snapshots at intervals
    - Peak and average memory usage
    - Potential memory leak patterns

${formatSection("SUBCOMMANDS")}
  ${formatCommand("memory")}    Run memory profiling (required)

${formatSection("OPTIONS")}
  ${formatFlag("--scenario")} <name>           Scenario to profile (small, medium, large, custom)
  ${formatFlag("--config")} <path>            Path to profiler config JSON file
  ${formatFlag("--snapshot")}                Enable heap snapshots during profiling
  ${formatFlag("--format")} <text|json>       Output format (default: text)
  ${formatFlag("--output")} <path>            Save report to file
  ${formatFlag("--files")} <count>            Number of files for custom scenario
  ${formatFlag("--operations")} <ops>         Operations to test (custom scenario)
  ${formatFlag("--sampling-interval")} <ms>   Sampling interval in milliseconds

${formatSection("SCENARIOS")}
  ${formatHighlight("small")}     10 files, simple operations (quick test)
  ${formatHighlight("medium")}    50 files, mixed operations (default)
  ${formatHighlight("large")}     200 files, complex operations (stress test)
  ${formatHighlight("custom")}    User-defined via --files and --operations

${formatSection("AVAILABLE OPERATIONS")} (for custom scenario)
  ${formatFlag("append")}           append-to-section operation
  ${formatFlag("prepend")}          prepend-to-section operation
  ${formatFlag("replace")}          string replacement
  ${formatFlag("regex")}            regex-based replacement
  ${formatFlag("replace-section")}  full section replacement

${formatSection("PROFILER CONFIG FILE")}
  You can provide a JSON config file with:
  {
    "trackAllocations": true,      // Track memory allocations
    "trackGC": true,                // Monitor garbage collection
    "heapSnapshots": true,          // Capture heap snapshots
    "samplingInterval": 100         // Sample interval in ms
  }

${formatSection("OUTPUT")}
  The profiler generates a report containing:
    - Peak and average memory usage
    - Garbage collection statistics
    - Memory allocation timeline
    - Heap snapshots (if enabled)
    - Potential memory leak warnings

  Profiles are automatically archived to .kustomark/profiles/ for later analysis.

${formatSection("EXAMPLES")}
  ${formatExample("# Run default profiling scenario")}
  ${formatCommand("kustomark profile memory")}

  ${formatExample("# Profile with large workload and snapshots")}
  ${formatCommand("kustomark profile memory --scenario large --snapshot")}

  ${formatExample("# Custom scenario with specific operations")}
  ${formatCommand("kustomark profile memory --scenario custom --files 100 --operations append,replace,regex")}

  ${formatExample("# Save detailed JSON report")}
  ${formatCommand("kustomark profile memory --format json --output profile-report.json")}

  ${formatExample("# Use custom profiler config")}
  ${formatCommand("kustomark profile memory --config profiler-config.json")}

  ${formatExample("# Quick test with frequent sampling")}
  ${formatCommand("kustomark profile memory --scenario small --sampling-interval 50")}

${formatSection("INTERPRETING RESULTS")}
  ${formatHighlight("Peak Memory:")}
    Maximum heap usage during profiling
    Higher values indicate more memory-intensive operations

  ${formatHighlight("Average Memory:")}
    Mean heap usage across all samples
    Consistent growth may indicate a leak

  ${formatHighlight("GC Events:")}
    Number of garbage collection cycles
    Frequent GCs may indicate memory pressure

  ${formatHighlight("Leak Detection:")}
    Automatic analysis identifies patterns:
      - growing-memory: Memory consistently increasing
      - gc-ineffective: GC not freeing much memory
      - growing-allocations: Recent samples show growth

  ${formatHighlight("Severity Levels:")}
    HIGH:   Immediate attention recommended
    MEDIUM: Worth investigating
    LOW:    Minor or expected behavior

${formatSection("USE CASES")}
  ${formatHighlight("Performance Optimization:")}
    Identify memory-intensive operations
    Compare different patch strategies
    Optimize for large-scale builds

  ${formatHighlight("Regression Testing:")}
    Establish baseline memory profiles
    Compare new code against baselines
    Detect memory regressions early

  ${formatHighlight("Capacity Planning:")}
    Estimate memory requirements
    Plan for production deployments
    Scale infrastructure appropriately

${formatSection("TIPS")}
  ${formatHighlight("Run with GC enabled:")}
    Use --expose-gc flag when running with Bun
    Enables more accurate GC tracking

  ${formatHighlight("Test realistic scenarios:")}
    Match profiling scenarios to actual workloads
    Use representative file counts and operations

  ${formatHighlight("Monitor trends:")}
    Run profiles regularly during development
    Archive results for comparison over time

${formatSection("EXIT CODES")}
  ${formatHighlight("0")}    Profiling completed successfully
  ${formatHighlight("1")}    Error (invalid scenario, config error, etc.)

${formatSection("SEE ALSO")}
  ${formatCommand("kustomark benchmark")}    Performance benchmarking
  ${formatCommand("kustomark analyze")}      Static analysis of patches
  ${formatCommand("kustomark build")}        Standard build command
`;
}

// ============================================================================
// Format Helper
// ============================================================================

/**
 * Apply final formatting to help text
 */
function formatHelp(content: string): string {
  // Remove leading/trailing empty lines
  return content.trim();
}

// ============================================================================
// Export all help functions
// ============================================================================

export const helpCommands = [
  "build",
  "diff",
  "preview",
  "validate",
  "watch",
  "init",
  "debug",
  "fix",
  "lint",
  "explain",
  "analyze",
  "test",
  "fetch",
  "web",
  "cache",
  "schema",
  "snapshot",
  "template",
  "suggest",
  "profile",
] as const;

export type HelpCommand = (typeof helpCommands)[number];

export function isValidHelpCommand(command: string): command is HelpCommand {
  return helpCommands.includes(command as HelpCommand);
}
