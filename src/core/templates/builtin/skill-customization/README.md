# Skill Customization Template

This template helps you customize Claude AI skills while maintaining sync with upstream sources.

## Use Case

Perfect for scenarios where you need to:
- Customize third-party Claude skills for your organization
- Add organization-specific guidelines to skills
- Rename tools to avoid conflicts with other skills
- Track upstream skill updates while preserving customizations
- Test and validate skill modifications

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Upstream Skill │     │  Your Patches   │     │  Custom Skill   │
│   Repository    │ ──▶ │  (kustomark)    │ ──▶ │   Directory     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Template Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SKILL_NAME` | string | Yes | - | Name of the skill to customize |
| `SKILL_DESCRIPTION` | string | Yes | - | Description of what the skill does |
| `ORG_NAME` | string | Yes | - | Your organization name |
| `ORG_PREFIX` | string | Yes | - | Prefix for tool names (lowercase) |
| `UPSTREAM_URL` | string | No | - | Git URL of upstream skill repository |
| `OUTPUT_DIR` | string | Yes | `./customized` | Directory for customized skill |

## Usage

### Interactive Mode

Run the template initialization wizard:

```bash
kustomark init --template skill-customization
```

You'll be prompted for:
1. Skill name (e.g., `code-analyzer`)
2. Skill description (e.g., `Analyzes code for quality and best practices`)
3. Organization name (e.g., `ACME Corp`)
4. Organization prefix (e.g., `acme`)
5. Upstream URL (optional, e.g., `https://github.com/anthropics/skills.git`)
6. Output directory (default: `./customized`)

### Non-Interactive Mode

Provide all variables via command-line flags:

```bash
kustomark init --template skill-customization \
  --var SKILL_NAME=code-analyzer \
  --var SKILL_DESCRIPTION="Analyzes code for quality and best practices" \
  --var ORG_NAME="ACME Corp" \
  --var ORG_PREFIX=acme \
  --var UPSTREAM_URL=https://github.com/anthropics/skills.git \
  --var OUTPUT_DIR=./my-skills
```

### Local Skill Customization

If you already have a skill file locally:

```bash
kustomark init --template skill-customization \
  --var SKILL_NAME=my-skill \
  --var SKILL_DESCRIPTION="My custom skill" \
  --var ORG_NAME="My Company" \
  --var ORG_PREFIX=myco \
  --var UPSTREAM_URL=./local-skill.md \
  --var OUTPUT_DIR=./customized
```

## What Gets Created

After initialization, you'll have:

1. **kustomark.yaml** - Configuration file with:
   - Upstream skill reference
   - Patch definitions for customization
   - Tool renaming patterns
   - Organization-specific additions

2. **README.md** - This documentation file

3. **example/** directory with:
   - `kustomark.yaml` - Example configuration
   - `README.md` - Example documentation
   - `skill.md` - Example skill file

## Customizations Applied

The template automatically applies these customizations:

### 1. Skill Metadata Updates

- Renames skill to `{{ORG_PREFIX}}-{{SKILL_NAME}}`
- Updates description
- Adds organization tag
- Marks as customized

### 2. Tool Renaming

All tool functions are prefixed with your organization prefix:
- `function analyze()` → `function {{ORG_PREFIX}}_analyze()`
- `await scan()` → `await {{ORG_PREFIX}}_scan()`

This prevents naming conflicts when using multiple skills.

### 3. Organization Guidelines

Adds a section with your organization's guidelines and best practices.

### 4. Custom Configuration

Adds organization-specific configuration section.

### 5. Attribution

Adds attribution tracking the original source and customization.

## Next Steps

### 1. Review and Customize Patches

Edit `kustomark.yaml` to add your own patches:

```yaml
patches:
  # Add custom security checks
  - op: append-to-section
    id: instructions
    content: |

      ### Security Requirements

      - All API calls must use authentication
      - No hardcoded credentials
      - Validate all inputs
```

### 2. Fetch Upstream Skill

If using a Git URL:

```bash
kustomark fetch
```

This downloads the upstream skill to a local cache.

### 3. Preview Changes

See what patches will be applied:

```bash
kustomark diff
```

### 4. Build Customized Skill

Apply patches and generate customized skill:

```bash
kustomark build
```

Your customized skill will be in the output directory.

### 5. Validate the Output

Ensure the customized skill is valid:

```bash
kustomark validate
```

### 6. Test the Skill

Create test cases to verify behavior:

```bash
kustomark test
```

## Advanced Customization

### Adding More Patches

You can add any of the 22+ patch operations supported by kustomark:

```yaml
patches:
  # Remove unwanted sections
  - op: remove-section
    id: advanced-features

  # Update examples
  - op: replace-section
    id: examples
    content: |
      ## Examples

      ### {{ORG_NAME}} Example

      ```typescript
      const result = await {{ORG_PREFIX}}_analyze(file);
      ```

  # Add new sections
  - op: append-to-section
    id: configuration
    content: |

      ### {{ORG_NAME}} Defaults

      All tools use {{ORG_NAME}} defaults automatically.
```

### Conditional Patches

Apply patches only when certain conditions are met:

```yaml
patches:
  - op: replace
    old: "text"
    new: "replacement"
    when:
      type: fileContains
      value: "specific marker"
```

### Multiple Skills

Customize multiple skills in one configuration:

```yaml
resources:
  - https://github.com/anthropics/skills/code-analyzer.git
  - https://github.com/anthropics/skills/data-processor.git
```

## Using the Customized Skill

### Install in Claude

Copy to Claude skills directory:

```bash
cp {{OUTPUT_DIR}}/{{SKILL_NAME}}.md ~/.claude/skills/{{ORG_PREFIX}}-{{SKILL_NAME}}.md
```

### Use in Claude

```
Use the {{ORG_PREFIX}}-{{SKILL_NAME}} skill to analyze my code.
```

### Distribution

Package and distribute to your team:

```bash
# Build and package
kustomark build
tar -czf {{ORG_PREFIX}}-{{SKILL_NAME}}.tar.gz {{OUTPUT_DIR}}/

# Team members install
tar -xzf {{ORG_PREFIX}}-{{SKILL_NAME}}.tar.gz -C ~/.claude/skills/
```

## Updating from Upstream

When upstream skill changes:

```bash
# Fetch latest version
kustomark fetch --update

# Preview changes
kustomark diff

# Rebuild with new version
kustomark build

# Validate
kustomark validate
```

## Troubleshooting

### Tools Not Renamed

If tools keep their original names:

1. Check regex patterns in `kustomark.yaml`
2. Verify function syntax matches patterns
3. Run with verbose output: `kustomark build -vv`

### Patches Not Applying

Check which patches matched:

```bash
kustomark diff --verbose
```

### Frontmatter Issues

If frontmatter fails to parse:

1. Ensure valid YAML syntax
2. Check for special characters
3. Run `kustomark validate` for details

### Upstream Fetch Fails

Verify the Git URL:

```bash
git ls-remote {{UPSTREAM_URL}}
```

## Examples

See the `example/` directory for a complete working example that demonstrates:

- Tool renaming with organization prefix
- Adding organization guidelines
- Custom configuration sections
- Attribution tracking

## Learn More

- [Kustomark Documentation](https://github.com/yourusername/kustomark)
- [Patch Operations Reference](https://github.com/yourusername/kustomark#patch-operations)
- [Claude Skills Guide](https://docs.anthropic.com/claude/docs/skills)
- [Template System](https://github.com/yourusername/kustomark#templates)
