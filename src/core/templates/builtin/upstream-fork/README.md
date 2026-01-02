# Upstream Fork Template

This template helps you consume markdown content from upstream sources while maintaining local customizations without forking the repository.

## Use Case

Perfect for scenarios where you need to:
- Track upstream documentation while applying local branding
- Customize third-party markdown content without losing sync
- Maintain reproducible patches to external markdown sources
- Test your customizations before deploying

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Upstream Git  │     │  Your Patches   │     │  Custom Output  │
│   Repository    │ ──▶ │  (kustomark)    │ ──▶ │   Directory     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Template Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `UPSTREAM_URL` | string | Yes | - | Git URL of the upstream repository to fetch content from |
| `OUTPUT_DIR` | string | Yes | `./output` | Directory where customized markdown will be written |
| `BRANDING_OLD` | string | No | - | Old branding/product name to replace (optional) |
| `BRANDING_NEW` | string | No | - | New branding/product name to use as replacement (optional) |

## Usage

### Interactive Mode

Run the template initialization wizard:

```bash
kustomark init --template upstream-fork
```

You'll be prompted for:
1. Upstream repository URL (e.g., `https://github.com/example/docs.git`)
2. Output directory path (default: `./output`)
3. Old branding name (optional, press Enter to skip)
4. New branding name (optional, press Enter to skip)

### Non-Interactive Mode

Provide all variables via command-line flags:

```bash
kustomark init --template upstream-fork \
  --var UPSTREAM_URL=https://github.com/example/docs.git \
  --var OUTPUT_DIR=./my-docs \
  --var BRANDING_OLD=UpstreamProduct \
  --var BRANDING_NEW=MyProduct
```

### Skip Branding Replacement

If you don't need branding replacement, simply omit those variables:

```bash
kustomark init --template upstream-fork \
  --var UPSTREAM_URL=https://github.com/example/docs.git \
  --var OUTPUT_DIR=./my-docs
```

## What Gets Created

After initialization, you'll have:

1. **kustomark.yaml** - Configuration file with:
   - Upstream resource reference
   - Patch definitions for customization
   - Conditional logic for branding replacement
   - Error handling configuration

2. **README.md** - This documentation file

3. **example/** directory with:
   - `source.md` - Example showing the pattern
   - `upstream.md` - Example upstream content

## Next Steps

### 1. Review and Customize Patches

Edit `kustomark.yaml` to add your own patches:

```yaml
patches:
  # Add custom patches here
  - op: replace
    old: "Original Text"
    new: "Custom Text"

  - op: remove-section
    id: section-to-remove

  - op: set-frontmatter
    key: custom_field
    value: custom_value
```

### 2. Fetch Upstream Content

Fetch the latest content from upstream:

```bash
kustomark fetch
```

This downloads the upstream repository to a local cache.

### 3. Preview Changes

See what patches will be applied:

```bash
kustomark diff
```

### 4. Build Customized Output

Apply patches and generate customized files:

```bash
kustomark build
```

Your customized markdown will be in the output directory.

### 5. Test Your Configuration

Create a test suite to verify your patches:

```bash
kustomark test
```

### 6. Watch for Changes

Automatically rebuild when upstream or patches change:

```bash
kustomark watch
```

## Advanced Customization

### Adding More Patches

You can add any of the 22+ patch operations supported by kustomark:

- **Content operations**: `replace`, `replace-regex`, `replace-section`
- **Section operations**: `remove-section`, `move-section`, `rename-header`, `change-section-level`
- **Frontmatter operations**: `set-frontmatter`, `remove-frontmatter`, `merge-frontmatter`
- **Line operations**: `insert-before-line`, `insert-after-line`, `delete-between`
- **File operations**: `copy-file`, `delete-file`, `rename-file`

See the [full documentation](https://github.com/yourusername/kustomark) for details.

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

### Patch Groups

Organize related patches into groups:

```yaml
patchGroups:
  - name: branding
    patches:
      - op: replace
        old: "{{BRANDING_OLD}}"
        new: "{{BRANDING_NEW}}"

  - name: custom-sections
    patches:
      - op: remove-section
        id: unwanted-section
```

### Multiple Upstream Sources

Combine content from multiple sources:

```yaml
resources:
  - https://github.com/example/docs.git
  - https://github.com/example/guides.git
  - ./local-overrides/
```

## Updating from Upstream

When upstream content changes:

```bash
# Fetch latest upstream
kustomark fetch --update

# Preview what changed
kustomark diff

# Rebuild with new content
kustomark build
```

## Troubleshooting

### Patches Not Applying

Check the diff output to see which patches matched:

```bash
kustomark diff --verbose
```

### Upstream Fetch Fails

Verify the git URL and network connectivity:

```bash
git ls-remote {{UPSTREAM_URL}}
```

### Unexpected Output

Use test mode to verify patch behavior:

```bash
kustomark test --verbose
```

## Learn More

- [Kustomark Documentation](https://github.com/yourusername/kustomark)
- [Patch Operations Reference](https://github.com/yourusername/kustomark#patch-operations)
- [Configuration Schema](https://github.com/yourusername/kustomark#configuration)
- [CLI Commands](https://github.com/yourusername/kustomark#cli-commands)
