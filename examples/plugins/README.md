# Example Plugins

This directory contains production-ready example plugins for kustomark. Each plugin demonstrates different features and best practices of the plugin system.

## Available Plugins

### toc-generator.js

Generates a table of contents from markdown headers with configurable depth and positioning.

**Features:**
- Customizable heading depth (1-6)
- Multiple position options (top, after-title, bottom)
- Minimum header threshold
- Custom TOC title
- Automatic anchor generation

**Example:**
```yaml
plugins:
  - name: toc-generator
    source: ./examples/plugins/toc-generator.js

patches:
  - op: exec
    plugin: toc-generator
    params:
      maxDepth: 3
      title: "Contents"
      position: "after-title"
      minHeaders: 2
```

### word-counter.js

Adds word count, character count, and reading time statistics to markdown files.

**Features:**
- Word count (excluding code blocks)
- Character count
- Reading time calculation
- Multiple output formats (markdown, HTML, badges)
- Position control (top/bottom)

**Example:**
```yaml
plugins:
  - name: word-counter
    source: ./examples/plugins/word-counter.js

patches:
  - op: exec
    plugin: word-counter
    params:
      showWords: true
      showChars: true
      showReadingTime: true
      wordsPerMinute: 200
      format: "markdown"
```

### link-validator.js

Validates internal links and reports broken references, including anchor links.

**Features:**
- Checks anchor link targets
- Validates internal file references
- Optional HTML comments for broken links
- Can fail build on broken links
- Suggests available anchors

**Example:**
```yaml
plugins:
  - name: link-validator
    source: ./examples/plugins/link-validator.js

patches:
  - op: exec
    plugin: link-validator
    params:
      checkAnchors: true
      addComments: true
      failOnBroken: false
      ignoreExternal: true
```

### code-formatter.js

Formats code blocks with syntax highlighting hints, line numbers, and metadata.

**Features:**
- Optional line numbers
- Language labels
- Default language for unlabeled blocks
- Copy button hints
- Line wrapping control

**Example:**
```yaml
plugins:
  - name: code-formatter
    source: ./examples/plugins/code-formatter.js

patches:
  - op: exec
    plugin: code-formatter
    params:
      addLineNumbers: true
      showLanguage: true
      defaultLanguage: "text"
      addCopyButton: true
```

### frontmatter-enhancer.js

Automatically populates frontmatter with computed metadata like word counts, dates, and file information.

**Features:**
- Word count metadata
- Reading time calculation
- Automatic date stamping
- File path/name information
- Selective field updates

**Example:**
```yaml
plugins:
  - name: frontmatter-enhancer
    source: ./examples/plugins/frontmatter-enhancer.js

patches:
  - op: exec
    plugin: frontmatter-enhancer
    params:
      addWordCount: true
      addReadingTime: true
      addModifiedDate: true
      addFileInfo: true
      updateExisting: false
```

## Usage Patterns

### Basic Usage

```yaml
apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "docs/**/*.md"

plugins:
  - name: toc-generator
    source: ./examples/plugins/toc-generator.js

patches:
  - op: exec
    plugin: toc-generator
```

### With Selectors

Apply plugins to specific files:

```yaml
patches:
  - op: exec
    plugin: word-counter
    selector:
      files:
        - "docs/**/*.md"
        - "!docs/drafts/**"
```

### Chaining Plugins

Apply multiple plugins in sequence:

```yaml
patches:
  - op: exec
    plugin: frontmatter-enhancer
    params:
      addWordCount: true

  - op: exec
    plugin: toc-generator
    params:
      maxDepth: 3

  - op: exec
    plugin: word-counter
    params:
      position: "bottom"
```

### Conditional Execution

Apply plugins based on frontmatter:

```yaml
patches:
  - op: exec
    plugin: toc-generator
    condition:
      frontmatter:
        toc: true
    params:
      maxDepth: 3
```

## Customization

All example plugins are designed to be customized. You can:

1. Copy the plugin to your project
2. Modify the logic to suit your needs
3. Add new parameters
4. Extend functionality

Example customization:

```javascript
// Modified toc-generator.js
export const apply = (content, params, context) => {
  // Your custom logic here
  const maxDepth = params.maxDepth || 3;

  // Add custom feature
  if (params.excludePattern) {
    // Filter headers based on pattern
  }

  // Original logic...
};
```

## Testing Your Plugins

Test plugins using the test fixtures pattern:

```javascript
import { test, expect } from 'bun:test';
import { apply } from './plugins/my-plugin.js';

test('transforms content correctly', () => {
  const input = '# Header\n\nContent';
  const result = apply(input, {}, mockContext);

  expect(result).toContain('transformed');
});
```

## Best Practices

1. **Validate Parameters**: Always implement parameter validation
2. **Handle Edge Cases**: Check for empty content, missing data
3. **Provide Defaults**: Use sensible default values
4. **Document Parameters**: Include param schema for documentation
5. **Test Thoroughly**: Write tests for success and error cases
6. **Performance**: Avoid expensive operations in loops
7. **Error Messages**: Provide clear, actionable error messages

## Resources

- [Plugin Documentation](../../docs/plugins.md)
- [Test Fixtures](../../tests/fixtures/plugins/)
- [Integration Tests](../../tests/core/plugin-integration.test.ts)
- [Plugin Types](../../src/core/plugin-types.ts)

## Contributing

Have a useful plugin to share? Consider:

1. Creating a standalone npm package
2. Adding comprehensive tests
3. Including TypeScript types
4. Writing detailed documentation
5. Submitting to the plugin registry

## License

These examples are provided as-is for reference and modification. Use them as a starting point for your own plugins.
