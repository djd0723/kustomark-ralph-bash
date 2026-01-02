# Contributing to Kustomark

Thank you for your interest in contributing to Kustomark! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, constructive, and professional in all interactions.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0.0 or later
- Git

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kustomark-ralph-bash.git
   cd kustomark-ralph-bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run tests to verify setup:
   ```bash
   bun test
   ```

4. Run linting:
   ```bash
   bun check
   ```

## Development Workflow

### Project Structure

```
kustomark-ralph-bash/
├── src/
│   ├── cli/           # CLI commands and argument parsing
│   ├── core/          # Core library (config, patches, validation)
│   ├── lsp/           # Language Server Protocol implementation
│   └── web/           # Web UI (client + server)
├── tests/             # Test files (mirrors src/ structure)
├── specs/             # Feature specifications
└── IMPLEMENTATION_PLAN.md  # Development roadmap
```

### Making Changes

1. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following the style guide

3. **Write tests** for new functionality:
   - Unit tests in `tests/core/` for core logic
   - Integration tests in `tests/cli/` for CLI commands
   - Use existing tests as examples

4. **Run tests and linting**:
   ```bash
   bun test
   bun check
   ```

5. **Build all artifacts** to verify:
   ```bash
   bun run build          # CLI
   bun run build:lsp      # LSP server
   bun run build:web      # Web UI (optional)
   ```

6. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

   Use conventional commit format:
   - `feat: Add new patch operation`
   - `fix: Resolve parsing error in frontmatter`
   - `docs: Update README with new examples`
   - `test: Add coverage for edge cases`
   - `refactor: Simplify validation logic`
   - `perf: Optimize resource resolution`
   - `chore: Update dependencies`

7. **Push and create a PR**:
   ```bash
   git push origin your-branch-name
   ```

## Style Guide

### TypeScript

- Use TypeScript strict mode (already configured)
- Prefer explicit types over `any` (use `unknown` when type is truly unknown)
- Use functional programming patterns where appropriate
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Code Organization

- **Core library** (`src/core/`): No I/O operations, pure functions
- **CLI** (`src/cli/`): Handles all I/O, calls core library
- **Tests**: Mirror the `src/` directory structure

### Testing

- Write tests for all new functionality
- Aim for high coverage (current: 1945+ tests)
- Use descriptive test names: `"should handle empty frontmatter gracefully"`
- Group related tests with `describe()` blocks
- Test edge cases and error conditions

### Example Test Structure

```typescript
import { describe, test, expect } from "bun:test";
import { yourFunction } from "../src/core/your-module";

describe("yourFunction", () => {
  test("should handle basic case", () => {
    const result = yourFunction("input");
    expect(result).toBe("expected");
  });

  test("should throw on invalid input", () => {
    expect(() => yourFunction("")).toThrow("Error message");
  });
});
```

## Adding New Features

### Patch Operations

To add a new patch operation:

1. Define the interface in `src/core/types.ts`
2. Implement the operation in `src/core/patch-operations/`
3. Add to the operation executor in `src/core/patch-engine.ts`
4. Update JSON schema in `src/cli/schema-command.ts`
5. Add LSP completion in `src/lsp/completion.ts`
6. Add hover docs in `src/lsp/hover.ts`
7. Write comprehensive tests
8. Update README with examples
9. Add entry to IMPLEMENTATION_PLAN.md

### CLI Commands

To add a new CLI command:

1. Create command file in `src/cli/your-command.ts`
2. Export command function following existing patterns
3. Add command case to `src/cli/index.ts`
4. Add help text in `src/cli/help.ts`
5. Write integration tests in `tests/cli/your-command.test.ts`
6. Update README

## Pull Request Process

1. **Fill out the PR template** completely
2. **Ensure CI passes** (all tests, linting, builds)
3. **Keep PRs focused** - one feature or fix per PR
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Respond to review feedback** promptly

### PR Checklist

- [ ] Tests pass locally (`bun test`)
- [ ] Linting passes (`bun check`)
- [ ] New tests added for new features
- [ ] Documentation updated (README, comments, etc.)
- [ ] IMPLEMENTATION_PLAN.md updated (for significant features)
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages follow conventional format

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Bun version, Kustomark version)
- Sample configuration files (if applicable)

## Requesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- Clear description of the feature
- Problem it solves
- Use case examples
- Proposed solution

## Questions?

- Check the [README](../README.md) for usage documentation
- Review [existing issues](https://github.com/dexhorthy/kustomark-ralph-bash/issues)
- Read the specs in `specs/` for design rationale
- Look at `IMPLEMENTATION_PLAN.md` for roadmap

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Recognition

Contributors will be recognized in release notes and documentation. Thank you for helping make Kustomark better!
