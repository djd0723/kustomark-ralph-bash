# Changelog Aggregator Template

This template helps you aggregate changelogs from multiple repositories into a unified release notes document.

## Use Case

Perfect for scenarios where you need to:
- Combine changelogs from microservices into unified release notes
- Aggregate changes across multiple repositories for a product release
- Generate customer-facing release notes from internal changelogs
- Create quarterly or annual release summaries
- Maintain a master changelog for a multi-repo project

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Repo A         │     │                 │     │   Unified       │
│  CHANGELOG.md   │ ──▶ │                 │     │   Release       │
└─────────────────┘     │                 │     │   Notes         │
┌─────────────────┐     │  Kustomark      │ ──▶ │                 │
│  Repo B         │ ──▶ │  Aggregator     │     │  CHANGELOG.md   │
│  CHANGELOG.md   │     │                 │     │                 │
└─────────────────┘     │                 │     └─────────────────┘
┌─────────────────┐     │                 │
│  Repo C         │ ──▶ │                 │
│  CHANGELOG.md   │     └─────────────────┘
└─────────────────┘
```

## Template Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PROJECT_NAME` | string | Yes | - | Name of the project or product |
| `VERSION` | string | Yes | - | Version number for this release |
| `RELEASE_DATE` | string | Yes | - | Release date (YYYY-MM-DD) |
| `OUTPUT_DIR` | string | Yes | `./output` | Directory where aggregated changelog will be written |

## Usage

### Interactive Mode

Run the template initialization wizard:

```bash
kustomark init --template changelog-aggregator
```

You'll be prompted for:
1. Project name (e.g., `MyProduct`)
2. Version number (e.g., `1.2.0`)
3. Release date (e.g., `2024-03-15`)
4. Output directory (default: `./output`)

### Non-Interactive Mode

Provide all variables via command-line flags:

```bash
kustomark init --template changelog-aggregator \
  --var PROJECT_NAME=MyProduct \
  --var VERSION=1.2.0 \
  --var RELEASE_DATE=2024-03-15 \
  --var OUTPUT_DIR=./release-notes
```

## What Gets Created

After initialization, you'll have:

1. **kustomark.yaml** - Configuration file with:
   - Resource references to individual changelogs
   - Patch operations to extract and organize sections
   - Component headers for each source
   - Release header and footer
   - Merge configuration

2. **README.md** - This documentation file

3. **example/** directory with:
   - `CHANGELOG-backend.md` - Example backend changelog
   - `CHANGELOG-frontend.md` - Example frontend changelog
   - `CHANGELOG-api.md` - Example API changelog

## Changelog Format

Each source changelog should follow this format:

```markdown
# Changelog

## [1.2.0] - 2024-03-15

### Added
- New feature X
- New feature Y

### Changed
- Updated component Z

### Fixed
- Bug fix A
- Bug fix B

## [1.1.0] - 2024-02-01
...
```

The aggregator will extract the version-specific section and combine them.

## Next Steps

### 1. Configure Your Repositories

Edit `kustomark.yaml` to reference your actual changelogs:

```yaml
resources:
  # Git URLs with path to changelog
  - https://github.com/myorg/backend.git//CHANGELOG.md?ref=main
  - https://github.com/myorg/frontend.git//CHANGELOG.md?ref=main
  - https://github.com/myorg/api.git//CHANGELOG.md?ref=main

  # Or local files
  - ../backend/CHANGELOG.md
  - ../frontend/CHANGELOG.md
  - ../api/CHANGELOG.md
```

### 2. Customize Component Headers

Update the component headers to match your services:

```yaml
patches:
  - op: prepend-to-section
    id: "version-{{VERSION}}"
    content: |
      ### Authentication Service
    include: "**/backend-auth-CHANGELOG.md"

  - op: prepend-to-section
    id: "version-{{VERSION}}"
    content: |
      ### Web Dashboard
    include: "**/frontend-dashboard-CHANGELOG.md"
```

### 3. Build Aggregated Changelog

Generate the unified changelog:

```bash
kustomark build
```

Your aggregated changelog will be in the output directory.

### 4. Preview Changes

See what will be extracted and combined:

```bash
kustomark diff
```

### 5. Automate for CI/CD

Add to your release pipeline:

```yaml
# .github/workflows/release.yml
steps:
  - name: Aggregate Changelogs
    run: |
      kustomark init --template changelog-aggregator \
        --var PROJECT_NAME=MyProduct \
        --var VERSION=${{ github.event.release.tag_name }} \
        --var RELEASE_DATE=$(date +%Y-%m-%d) \
        --var OUTPUT_DIR=./release-notes
      kustomark build

  - name: Upload Release Notes
    uses: actions/upload-artifact@v3
    with:
      name: release-notes
      path: release-notes/CHANGELOG.md
```

## Advanced Customization

### Filtering Sections

Extract only specific change types:

```yaml
patches:
  # Extract only "Added" and "Fixed" sections
  - op: extract-section
    id: added

  - op: extract-section
    id: fixed

  - op: remove-section
    id: changed

  - op: remove-section
    id: deprecated
```

### Adding Summary Statistics

Count changes across components:

```yaml
patches:
  - op: prepend-to-file
    content: |
      ## Release Summary

      This release includes:
      - {{BACKEND_FEATURES}} backend features
      - {{FRONTEND_FEATURES}} frontend features
      - {{TOTAL_FIXES}} bug fixes across all components
```

### Custom Formatting

Transform changelog entries:

```yaml
patches:
  # Add emoji indicators
  - op: replace-regex
    pattern: '^- (Added|New feature):'
    replacement: '- ✨ $1:'
    flags: gm

  - op: replace-regex
    pattern: '^- (Fixed|Bug fix):'
    replacement: '- 🐛 $1:'
    flags: gm

  - op: replace-regex
    pattern: '^- (Changed|Updated):'
    replacement: '- 🔄 $1:'
    flags: gm
```

### Multiple Output Formats

Generate different formats for different audiences:

```yaml
# Internal detailed version
output: ./internal/CHANGELOG.md

# Customer-facing summary
patches:
  - op: remove-section
    id: internal-notes

  - op: replace-regex
    pattern: '\[INTERNAL\].*'
    replacement: ''
```

## Common Patterns

### Microservices Architecture

For 10+ microservices:

```yaml
resources:
  - https://github.com/org/auth-service.git//CHANGELOG.md
  - https://github.com/org/user-service.git//CHANGELOG.md
  - https://github.com/org/payment-service.git//CHANGELOG.md
  - https://github.com/org/notification-service.git//CHANGELOG.md
  # ... more services

patches:
  # Group by category
  - op: prepend-to-file
    content: |
      ### Core Services

  - op: prepend-to-file
    content: |
      ### Business Services

  - op: prepend-to-file
    content: |
      ### Infrastructure Services
```

### Quarterly Release Notes

Aggregate multiple versions:

```yaml
patches:
  - op: extract-section
    id: "version-1.1.0"

  - op: extract-section
    id: "version-1.2.0"

  - op: extract-section
    id: "version-1.3.0"

  - op: prepend-to-file
    content: |
      # Q1 2024 Release Notes

      Summary of all releases in Q1 2024.
```

### Migration Notes

Add migration instructions:

```yaml
patches:
  - op: append-to-section
    id: "version-{{VERSION}}"
    content: |

      ### Migration Guide

      To migrate from version {{PREVIOUS_VERSION}} to {{VERSION}}:

      1. Back up your data
      2. Run database migrations: `npm run migrate`
      3. Update environment variables (see `.env.example`)
      4. Restart all services

      **Breaking Changes**: See individual component changelogs for breaking changes.
```

## Troubleshooting

### Changelogs Not Found

If changelogs aren't being fetched:

```bash
# Verify git URLs are accessible
git ls-remote https://github.com/org/repo.git

# Check local file paths
ls -la ../backend/CHANGELOG.md
```

### Version Sections Not Extracted

Ensure your changelog format matches:

```markdown
# Must have this exact format
## [1.2.0] - 2024-03-15

# Or this format
## 1.2.0 (2024-03-15)

# Or this format
## Version 1.2.0 - March 15, 2024
```

Update the extraction pattern in `kustomark.yaml`:

```yaml
patches:
  - op: extract-section
    id: "version-{{VERSION}}"
    # Or use regex for flexible matching
    pattern: "\\[?{{VERSION}}\\]?"
```

### Merge Not Working

Check merge configuration:

```yaml
merge:
  enabled: true
  strategy: concatenate  # or 'smart', 'custom'
  output: CHANGELOG.md
  separator: "\n\n---\n\n"  # Optional separator between sections
```

### Formatting Issues

Standardize formatting across sources:

```yaml
patches:
  # Normalize header levels
  - op: change-section-level
    delta: 1  # Increase all headers by 1 level

  # Standardize bullet points
  - op: replace-regex
    pattern: '^\*\s+'
    replacement: '- '
    flags: gm

  # Remove extra whitespace
  - op: replace-regex
    pattern: '\n{3,}'
    replacement: '\n\n'
    flags: g
```

## Examples

See the `example/` directory for working examples demonstrating:

- Multi-repository changelog aggregation
- Component-based organization
- Version-specific extraction
- Standardized formatting
- Release header and footer

Build the example:

```bash
cd example
kustomark build
cat ../output/CHANGELOG.md
```

## Learn More

- [Kustomark Documentation](https://github.com/yourusername/kustomark)
- [Keep a Changelog](https://keepachangelog.com/) - Changelog format standard
- [Semantic Versioning](https://semver.org/) - Version numbering
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
