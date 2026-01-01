# Kustomark Core Library

Pure functional transforms with no I/O dependencies.

## Resource Resolver

The resource resolver (`resource-resolver.ts`) is responsible for resolving resource patterns into a flat list of markdown files.

### Features

- **Glob Pattern Support**: Resolves patterns like `**/*.md`, `docs/*.md`, etc. using micromatch
- **Negation Patterns**: Excludes files using patterns starting with `!` (e.g., `!**/README.md`)
- **Directory References**: Recursively resolves references to other kustomark configs
- **Circular Reference Detection**: Prevents infinite loops when configs reference each other
- **Pure Function**: Takes a file map as input (no I/O), making it testable and composable

### Usage

```typescript
import { resolveResources } from "./resource-resolver";

// Create a file map (path -> content)
const fileMap = new Map([
  ['/project/docs/api.md', '# API Documentation'],
  ['/project/docs/guide.md', '# User Guide'],
  ['/project/docs/README.md', '# Docs README'],
]);

// Resolve resources
const resources = resolveResources(
  ['docs/**/*.md', '!docs/README.md'],
  '/project',
  fileMap
);

// Result:
// [
//   { path: '/project/docs/api.md', content: '# API Documentation', source: 'docs/**/*.md' },
//   { path: '/project/docs/guide.md', content: '# User Guide', source: 'docs/**/*.md' }
// ]
```

### Recursive Config Resolution

```typescript
// Base config at /base/kustomark.yaml:
// resources:
//   - "**/*.md"

// Overlay config at /overlay/kustomark.yaml:
// resources:
//   - ../base/
//   - custom.md

const fileMap = new Map([
  ['/base/kustomark.yaml', 'resources:\n  - "**/*.md"'],
  ['/base/api.md', '# API'],
  ['/overlay/kustomark.yaml', 'resources:\n  - ../base/\n  - custom.md'],
  ['/overlay/custom.md', '# Custom'],
]);

const resources = resolveResources(
  ['../base/', 'custom.md'],
  '/overlay',
  fileMap
);

// Resolves:
// - /base/api.md (from base config)
// - /overlay/custom.md (direct reference)
```

### Error Handling

The resolver throws `ResourceResolutionError` in these cases:

- Circular references detected
- Maximum recursion depth exceeded
- Referenced kustomark config not found
- Config file parsing errors

```typescript
import { ResourceResolutionError } from "./resource-resolver";

try {
  const resources = resolveResources(patterns, baseDir, fileMap);
} catch (error) {
  if (error instanceof ResourceResolutionError) {
    console.error(`Failed to resolve ${error.resource}: ${error.message}`);
  }
}
```

### Types

#### ResolvedResource

```typescript
interface ResolvedResource {
  path: string;      // Absolute path to the markdown file
  content: string;   // Content of the markdown file
  source: string;    // Source pattern that resolved to this resource
}
```

#### ResolveOptions

```typescript
interface ResolveOptions {
  maxDepth?: number;        // Maximum recursion depth (default: 10)
  currentDepth?: number;    // Internal: current depth
  visited?: Set<string>;    // Internal: visited configs
}
```
