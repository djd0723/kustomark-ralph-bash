# Custom Template Discovery Example

This example demonstrates how kustomark discovers and loads templates from multiple sources.

## Template Discovery Locations

Kustomark searches for templates in three locations (in priority order):

1. **Built-in templates** (lowest priority)
   - Location: `src/core/templates/builtin/`
   - Included with kustomark installation
   - Example: `base`, `overlay`, `upstream-fork`, `doc-pipeline`

2. **User global templates** (medium priority)
   - Location: `~/.kustomark/templates/`
   - Available across all your projects
   - Can override built-in templates

3. **Project local templates** (highest priority)
   - Location: `./templates/` (relative to current directory)
   - Project-specific templates
   - Can override both built-in and user global templates

## Creating a Custom Template

### Project Local Template

Create a template in your project:

```bash
mkdir -p ./templates/my-custom-template
cd ./templates/my-custom-template
```

Create a `template.yaml`:

```yaml
apiVersion: kustomark/v1
kind: Template
metadata:
  name: my-custom-template
  description: My custom project template
  category: custom
  version: 1.0.0
  tags:
    - custom
    - project

variables:
  - name: project_name
    description: Name of your project
    type: string
    required: true
    example: my-awesome-project

files:
  - src: kustomark.yaml
    dest: kustomark.yaml
    substitute: true
  - src: README.md
    dest: README.md
    substitute: true
```

Create template files:

**kustomark.yaml:**
```yaml
apiVersion: kustomark/v1
kind: Kustomization

# Project: {{project_name}}
resources:
  - "*.md"

patches:
  - op: set-frontmatter
    key: project
    value: "{{project_name}}"
```

**README.md:**
```markdown
# {{project_name}}

This is a custom template for {{project_name}}.

## Getting Started

```bash
kustomark build .
```
```

### User Global Template

Create a template available to all projects:

```bash
mkdir -p ~/.kustomark/templates/my-global-template
cd ~/.kustomark/templates/my-global-template
```

Create your `template.yaml` and template files following the same structure as above.

## Overriding Built-in Templates

You can override built-in templates by creating a template with the same name:

```bash
# Override the built-in "base" template
mkdir -p ./templates/base

# Create your custom template.yaml with name: "base"
cat > ./templates/base/template.yaml << EOF
apiVersion: kustomark/v1
kind: Template
metadata:
  name: base
  description: Custom base template - overrides built-in
  category: custom
  version: 2.0.0
EOF
```

Now when you use `kustomark init base`, it will use your custom template instead of the built-in one.

## Using the API

You can also use the template manager programmatically:

```typescript
import { TemplateManager, getUserTemplateDirectories } from 'kustomark';

// Get template directories
const dirs = getUserTemplateDirectories();
console.log('User global:', dirs.homeDir);
console.log('Project local:', dirs.projectDir);

// List all available templates
const manager = new TemplateManager();
const templates = await manager.listTemplates();

for (const template of templates) {
  console.log(`${template.id} (${template.source}): ${template.description}`);
}

// Get a specific template
const template = await manager.getTemplate('my-custom-template');
console.log('Template files:', template.files);

// Get template source information
const source = await manager.getTemplateSource('my-custom-template');
console.log('Source type:', source.source);
console.log('Path:', source.path);
```

## Verbose Mode

To see detailed template discovery logs, set the `KUSTOMARK_VERBOSE` environment variable:

```bash
KUSTOMARK_VERBOSE=1 kustomark templates list
```

This will show:
- Which directories are being scanned
- Which templates are discovered
- When templates override each other
- Any errors encountered during discovery

## Best Practices

1. **Use semantic versioning** for your templates
2. **Document template variables** clearly in template.yaml
3. **Test templates locally** before moving to global directory
4. **Use descriptive tags** for better discoverability
5. **Keep templates focused** - one template per use case

## Error Handling

The template manager handles errors gracefully:
- Missing directories are silently skipped
- Invalid template.yaml files trigger warnings but don't break discovery
- Permission errors are only logged in verbose mode
- Missing template files are reported but don't prevent loading other templates
