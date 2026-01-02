# Kustomark Help System Documentation

This document describes the comprehensive help command system implemented for the Kustomark CLI.

## Overview

The help system provides detailed, colorized documentation for all Kustomark commands directly in the terminal. It includes:

- Main help overview with command listing
- Detailed help for each individual command
- Colorized output for better readability
- Extensive examples and use cases
- Cross-references between related commands

## Features

### 1. Colorized Terminal Output

The help system uses ANSI color codes to make the documentation more readable:

- **Cyan** - Titles and headings
- **Blue** - Section headers (SYNOPSIS, DESCRIPTION, etc.)
- **Green** - Commands
- **Yellow** - Flags and options
- **Magenta** - Important values and highlights
- **Gray** - Examples and code snippets

### 2. Multiple Access Methods

Users can access help in several ways:

```bash
# Main help
kustomark help
kustomark --help
kustomark -h
kustomark

# Command-specific help
kustomark help <command>
kustomark <command> --help
kustomark <command> -h
```

### 3. Comprehensive Documentation

Each command help includes:

- **SYNOPSIS** - Command syntax
- **DESCRIPTION** - What the command does
- **ARGUMENTS** - Positional arguments
- **OPTIONS** - Available flags and options
- **EXAMPLES** - 2-3 practical examples
- **USE CASES** - Common workflows
- **EXIT CODES** - Return values
- **SEE ALSO** - Related commands

## Usage Examples

### Getting Main Help

```bash
$ kustomark help
```

Shows:
- List of all commands (core and advanced)
- Common flags
- Quick start guide
- Exit codes
- Basic examples

### Getting Command-Specific Help

```bash
$ kustomark help build
$ kustomark build --help
```

Shows detailed documentation for the build command including:
- All build options
- Performance flags (--parallel, --incremental)
- Group filtering (--enable-groups, --disable-groups)
- Lock file options
- Workflows for different scenarios
- Multiple examples

### Exploring Commands

```bash
# Learn about watch mode
$ kustomark help watch

# Understand debug mode
$ kustomark help debug

# Get help on the web UI
$ kustomark help web
```

## Available Commands

The help system provides documentation for all 12 commands:

### Core Commands
1. **build** - Build and write output files
2. **diff** - Show what would change without writing files
3. **validate** - Validate configuration without building
4. **watch** - Monitor files and rebuild on changes
5. **init** - Create a new kustomark.yaml config

### Advanced Commands
6. **debug** - Interactive patch debugging mode
7. **lint** - Check for common issues in configuration
8. **explain** - Show resolution chain and patch details
9. **fetch** - Fetch remote resources without building
10. **web** - Launch web UI for visual editing
11. **cache** - Manage cache for remote resources
12. **schema** - Export JSON Schema for editor integration

## Help Content Structure

### Main Help (`getMainHelp()`)

```
TITLE
  Kustomark - Declarative markdown patching pipeline

USAGE
  Command syntax

CORE COMMANDS
  Essential commands list

ADVANCED COMMANDS
  Advanced feature commands

GETTING HELP
  How to access help

COMMON FLAGS
  Flags available across commands

EXIT CODES
  Standard exit codes

EXAMPLES
  Quick examples

QUICK START
  Getting started steps

DOCUMENTATION
  Links to further resources
```

### Command Help (`getCommandHelp(command)`)

```
TITLE
  kustomark <command> - Short description

SYNOPSIS
  Command syntax

DESCRIPTION
  Detailed explanation

ARGUMENTS
  Positional arguments

OPTIONS
  Available flags

EXAMPLES
  2-3 practical examples

WORKFLOWS (for complex commands)
  Common usage patterns

USE CASES
  Real-world scenarios

EXIT CODES
  Command-specific exit codes

SEE ALSO
  Related commands
```

## Special Sections

### Build Command
- **PERFORMANCE OPTIONS** - Parallel and incremental builds
- **GROUP FILTERING** - Selective patch application
- **LOCK FILE OPTIONS** - Dependency management
- **WORKFLOWS** - Development, production, performance workflows

### Watch Command
- **WATCH HOOKS** - Event-driven automation
- **USE CASES** - Development workflows
- **JSON OUTPUT** - Integration with other tools

### Init Command
- **MODES** - Interactive vs non-interactive
- **CONFIGURATION TYPES** - Base vs overlay configs
- **INTERACTIVE WIZARD** - Step-by-step guidance

### Debug Command
- **INTERACTIVE MODE** - Step-through debugging
- **DECISION FILES** - Save/replay debugging sessions

### Web Command
- **FEATURES** - All UI capabilities
- **DEVELOPMENT MODE** - Hot reload setup
- **PRODUCTION MODE** - Optimized serving

### Cache Command
- **CACHE STRUCTURE** - Organization of cached resources
- **WHEN TO CLEAR CACHE** - Troubleshooting guide

## Implementation

### File Structure

```
src/cli/help.ts          # Main help system implementation
src/cli/help.test.ts     # Comprehensive test suite
src/cli/index.ts         # CLI integration
```

### Functions

**Exported:**
- `getMainHelp(): string` - Returns main help text
- `getCommandHelp(command: string): string` - Returns command-specific help
- `isValidHelpCommand(command: string): boolean` - Validates command name
- `helpCommands: readonly string[]` - List of all commands

**Internal:**
- Formatting helpers (formatTitle, formatCommand, formatFlag, etc.)
- Individual help functions for each command

### Color Codes

```typescript
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",      // Titles
  green: "\x1b[32m",     // Commands
  yellow: "\x1b[33m",    // Flags
  blue: "\x1b[34m",      // Sections
  magenta: "\x1b[35m",   // Highlights
  gray: "\x1b[90m",      // Examples
};
```

## Testing

The help system includes comprehensive tests:

```bash
# Run help system tests
bun test src/cli/help.test.ts
```

Test coverage includes:
- Main help content
- All command helps
- Validation of command names
- Content quality checks
- Formatting verification
- 29 tests with 164 assertions

## Integration

The help system is integrated into the main CLI:

1. **Argument parsing** - Detects help flags early
2. **Command routing** - Routes to help before executing commands
3. **Error handling** - Shows help for unknown commands

### Integration Points

```typescript
// In main()
if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
  if (args[0] === "help" && args.length > 1) {
    // kustomark help <command>
    console.log(getCommandHelp(args[1]));
  } else {
    // kustomark help
    console.log(getMainHelp());
  }
  return 0;
}

// After parseArgs
if (args.includes("--help") || args.includes("-h")) {
  if (command && isValidHelpCommand(command)) {
    console.log(getCommandHelp(command));
    return 0;
  }
}
```

## Benefits

1. **Self-documenting** - No need to search external docs for common tasks
2. **Always available** - Works offline, no internet required
3. **Context-aware** - Shows exactly what's relevant for each command
4. **Discoverable** - Easy to explore all features
5. **Consistent** - Same structure across all commands
6. **Professional** - Colorized, well-formatted output
7. **Comprehensive** - Includes examples, workflows, and use cases

## Maintenance

When adding new commands:

1. Add command to `helpCommands` array
2. Create help function (e.g., `getNewCommandHelp()`)
3. Add to `helpFunctions` map in `getCommandHelp()`
4. Add tests in `help.test.ts`
5. Update this documentation

When updating commands:

1. Update corresponding help function
2. Ensure examples match current syntax
3. Update tests if behavior changed
4. Verify help text accuracy with actual command

## Future Enhancements

Possible future improvements:

1. **Man page generation** - Generate man pages from help text
2. **HTML documentation** - Export help as HTML
3. **Search functionality** - Search across all help content
4. **Contextual suggestions** - Suggest related commands based on usage
5. **Internationalization** - Support multiple languages
6. **Interactive help** - Arrow key navigation through sections

## Conclusion

The Kustomark help system provides comprehensive, colorized, terminal-based documentation for all CLI commands. It's designed to be the primary reference for users learning Kustomark, offering detailed explanations, practical examples, and workflow guidance directly in the terminal.

For implementation details, see `/home/dex/kustomark-ralph-bash/src/cli/help.ts`.
