# Example: Skill Customization

This example demonstrates how to use the skill-customization template to customize a Claude AI skill for ACME Corp.

## Files

- **skill.md** - Example upstream skill (code analyzer)
- **kustomark.yaml** - Customization configuration
- **README.md** - This file

## What This Example Does

The example configuration:

1. Renames the skill to "acme-code-analyzer"
2. Adds ACME Corp to the tags
3. Renames all tools with `acme_` prefix:
   - `analyze()` → `acme_analyze()`
   - `scan()` → `acme_scan()`
   - `report()` → `acme_report()`
4. Adds ACME-specific guidelines to instructions
5. Adds ACME-specific configuration defaults
6. Updates examples to use ACME-prefixed functions
7. Adds ACME limitations and attribution

## Running This Example

### 1. Build the Customized Skill

From this directory:

```bash
kustomark build
```

This will create `./customized/skill.md` with all customizations applied.

### 2. Review the Diff

See what changed:

```bash
kustomark diff
```

### 3. Validate the Output

Check that the customization is valid:

```bash
kustomark validate
```

## Expected Output

The output file `./customized/skill.md` will have:

### Updated Frontmatter
```yaml
---
name: acme-code-analyzer
version: 1.0.0-acme
description: Analyzes code for quality and best practices
author: Claude Team
tags:
  - code
  - analysis
  - quality
  - acme
customized: true
---
```

### Renamed Functions
```typescript
// Before
async function analyze(filePath: string, language: string): Promise<AnalysisReport>

// After
async function acme_analyze(filePath: string, language: string): Promise<AnalysisReport>
```

### Additional Instructions
```markdown
### ACME Corp Guidelines

When analyzing code for ACME Corp:

1. **Security First**: Always check for OWASP Top 10 vulnerabilities
2. **Performance**: Flag O(n²) or worse algorithms
...
```

### Updated Examples
```typescript
// Before
const result = await analyze('./src/main.ts', 'typescript');

// After
const result = await acme_analyze('./src/main.ts', 'typescript');
```

## Customizing Further

To add your own customizations:

1. Edit `kustomark.yaml`
2. Add new patches or modify existing ones
3. Run `kustomark build` to regenerate
4. Run `kustomark diff` to review changes

### Example: Add a Custom Section

```yaml
patches:
  - op: append-to-section
    id: examples
    content: |

      ### ACME Internal Example

      This example uses our internal tools:

      \`\`\`typescript
      const result = await acme_analyze(
        './src/main.ts',
        'typescript',
        { acmeInternal: true }
      );
      \`\`\`
```

### Example: Replace a Section

```yaml
patches:
  - op: replace-section
    id: limitations
    content: |
      ## Limitations

      ACME Corp customizations:
      - Internal use only
      - Requires ACME VPN
      - Subject to ACME data policies

      Original limitations:
      - Supports JavaScript, TypeScript, Python, and Java
      - Large files (>1MB) may be slow
```

## Testing the Customized Skill

### 1. Build the Output

```bash
kustomark build
```

### 2. Review the Output

```bash
cat customized/skill.md
```

### 3. Test with Claude

Copy to Claude skills directory:

```bash
cp customized/skill.md ~/.claude/skills/acme-code-analyzer.md
```

Then in Claude:

```
Use the acme-code-analyzer skill to analyze my code.
```

## Real-World Usage

In production, you would:

1. Use a Git URL instead of a local file:
   ```yaml
   resources:
     - https://github.com/user/code-analyzer-skill.git
   ```

2. Set up automation to sync with upstream:
   ```bash
   # In CI/CD
   kustomark build --clean
   ```

3. Distribute to your team:
   ```bash
   # Build and package
   kustomark build
   tar -czf acme-code-analyzer.tar.gz customized/

   # Team members extract
   tar -xzf acme-code-analyzer.tar.gz -C ~/.claude/skills/
   ```

## Troubleshooting

### Tools Not Renamed

If tools keep their original names, check:

1. The regex patterns in `kustomark.yaml` match your function syntax
2. Run with verbose output: `kustomark build -vv`

### Custom Instructions Not Added

If custom instructions don't appear:

1. Check that the Instructions section ID matches: `id: instructions`
2. Try using `replace-section` instead of `append-to-section`

### Frontmatter Parse Error

If frontmatter fails to parse:

1. Ensure the frontmatter is valid YAML
2. Check for special characters that need escaping
3. Run `kustomark validate` for detailed errors

## Next Steps

- Read the [Template Documentation](../README.md)
- Explore other patches in [Kustomark Docs](../../../../../README.md)
- Create your own custom templates
- Share your customizations with your team
