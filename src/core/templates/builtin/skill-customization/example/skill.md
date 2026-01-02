---
name: code-analyzer
version: 1.0.0
description: Analyzes code for quality and best practices
author: Claude Team
tags:
  - code
  - analysis
  - quality
---

# Code Analyzer Skill

A comprehensive skill for analyzing code quality, detecting issues, and suggesting improvements.

## Overview

This skill provides tools to analyze code files for:
- Code quality issues
- Best practice violations
- Security vulnerabilities
- Performance problems
- Style inconsistencies

## Instructions

When using this skill to analyze code:

1. **Understand Context**: Ask about the project type and language
2. **Analyze Thoroughly**: Check for bugs, security issues, and performance
3. **Provide Actionable Feedback**: Give specific, helpful suggestions
4. **Prioritize Issues**: Focus on critical issues first
5. **Be Constructive**: Frame feedback positively

## Tools

### analyze

Analyzes a single code file for quality and best practices.

```typescript
async function analyze(
  filePath: string,
  language: string,
  config?: AnalysisConfig
): Promise<AnalysisReport>
```

Parameters:
- `filePath`: Path to the file to analyze
- `language`: Programming language (javascript, typescript, python, java, etc.)
- `config`: Optional configuration for analysis rules

Returns:
- `AnalysisReport`: Detailed analysis results with issues and suggestions

### scan

Scans a directory for code files to analyze.

```typescript
async function scan(
  directory: string,
  options?: ScanOptions
): Promise<string[]>
```

Parameters:
- `directory`: Directory to scan
- `options`: Optional scan configuration (recursive, file patterns, etc.)

Returns:
- Array of file paths found

### report

Generates a formatted report from analysis results.

```typescript
async function report(
  results: AnalysisReport[],
  format: 'text' | 'json' | 'html'
): Promise<string>
```

Parameters:
- `results`: Array of analysis reports
- `format`: Output format (text, json, or html)

Returns:
- Formatted report string

## Configuration

The skill can be configured with custom rules and settings:

```yaml
name: code-analyzer
config:
  severity: warning  # Minimum severity to report (info, warning, error)
  rules:
    no-console: warning
    no-eval: error
    no-var: warning
    max-complexity: 10
    max-lines: 500
  excludePatterns:
    - '**/*.test.ts'
    - '**/*.spec.ts'
    - '**/node_modules/**'
```

## Examples

### Analyze a Single File

```typescript
const result = await analyze('./src/main.ts', 'typescript');
console.log(await report([result], 'text'));
```

### Scan and Analyze Directory

```typescript
const files = await scan('./src', { recursive: true });
const results = await Promise.all(
  files.map(file => analyze(file, detectLanguage(file)))
);
console.log(await report(results, 'html'));
```

### With Custom Configuration

```typescript
const config = {
  severity: 'error',
  rules: {
    maxComplexity: 5,
    maxLines: 200,
  },
};

const result = await analyze('./src/main.ts', 'typescript', config);
```

## Supported Languages

- JavaScript (ES5, ES6+)
- TypeScript
- Python 2 and 3
- Java
- Go
- Rust
- C/C++
- Ruby
- PHP

## Limitations

- Large files (>1MB) may be slow to analyze
- Some language-specific features may not be detected
- Accuracy depends on code clarity and structure
- Does not execute code, only static analysis

## Best Practices

When using this skill:

1. **Start Small**: Analyze individual files before entire projects
2. **Configure Appropriately**: Adjust rules for your project's needs
3. **Review Results**: Not all suggestions may apply to your context
4. **Iterative Improvement**: Fix critical issues first, then refine
5. **Combine with Tests**: Use alongside automated testing

## Attribution

Original skill from Claude Skills Library.
