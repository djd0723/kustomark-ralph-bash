# Kustomark Help System - Quick Reference

## Getting Help

### Main Help
```bash
kustomark help          # Show all commands
kustomark --help        # Same as above
kustomark -h            # Short form
kustomark               # No args shows help
```

### Command-Specific Help
```bash
kustomark help <command>     # Detailed help for a command
kustomark <command> --help   # Same as above
kustomark <command> -h       # Short form
```

## Examples

```bash
# Learn about building
kustomark help build

# Learn about watch mode
kustomark help watch

# Learn about the web UI
kustomark help web

# Get help on debugging
kustomark help debug
```

## All Available Commands

### Core Commands
- `build` - Build and write output files
- `diff` - Show what would change without writing files
- `validate` - Validate configuration without building
- `watch` - Monitor files and rebuild on changes
- `init` - Create a new kustomark.yaml config

### Advanced Commands
- `debug` - Interactive patch debugging mode
- `lint` - Check for common issues in configuration
- `explain` - Show resolution chain and patch details
- `fetch` - Fetch remote resources without building
- `web` - Launch web UI for visual editing
- `cache` - Manage cache for remote resources
- `schema` - Export JSON Schema for editor integration

## Help Output Sections

Each command help includes:

- **SYNOPSIS** - Command syntax
- **DESCRIPTION** - What the command does
- **ARGUMENTS** - Positional arguments
- **OPTIONS** - Available flags
- **EXAMPLES** - Practical examples
- **USE CASES** - Common workflows
- **EXIT CODES** - Return values
- **SEE ALSO** - Related commands

## Color Coding

The help system uses colors for readability:

- **Cyan** - Titles and headings
- **Blue** - Section headers
- **Green** - Commands
- **Yellow** - Flags and options
- **Magenta** - Important values
- **Gray** - Examples and code

## Quick Tips

1. **Start with main help**: `kustomark help` to see all commands
2. **Explore commands**: `kustomark help <command>` for details
3. **Use examples**: Each command includes practical examples
4. **Follow workflows**: Some commands include step-by-step workflows
5. **Check related commands**: "SEE ALSO" section links to related features

## Common Help Queries

```bash
# How do I build?
kustomark help build

# What are all the build options?
kustomark build --help

# How do I debug patches?
kustomark help debug

# How do I set up watch mode?
kustomark help watch

# What cache commands exist?
kustomark help cache

# How do I create a config?
kustomark help init
```

## Integration with Workflow

```bash
# 1. Learn about init
kustomark help init

# 2. Create config interactively
kustomark init -i

# 3. Learn about build
kustomark help build

# 4. Build your project
kustomark build .

# 5. Learn about watch for development
kustomark help watch

# 6. Use watch mode
kustomark watch .
```

## Getting Started

If you're new to Kustomark:

1. Run `kustomark help` to see the overview
2. Read the QUICK START section
3. Run `kustomark help init` to learn about creating configs
4. Run `kustomark init -i` for an interactive wizard
5. Run `kustomark help build` to learn about building
6. Run `kustomark build .` to build your first project

## Help System Features

- ✅ Works offline (no internet required)
- ✅ Colorized output for readability
- ✅ Comprehensive examples
- ✅ Common workflows documented
- ✅ Cross-references between commands
- ✅ Exit codes documented
- ✅ Flag descriptions included
- ✅ Use cases for each command

## Need More Help?

- Check the full documentation: [README.md](./README.md)
- Review the help system docs: [HELP_SYSTEM.md](./HELP_SYSTEM.md)
- Visit the GitHub repository for issues and discussions
