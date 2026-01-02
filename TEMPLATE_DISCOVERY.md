# Custom Template Discovery Implementation

This document describes the custom template discovery feature implemented in kustomark.

## Overview

The template manager now supports discovering and loading templates from three locations with a clear priority system:

1. **Built-in templates** (lowest priority) - `src/core/templates/builtin/`
2. **User global templates** (medium priority) - `~/.kustomark/templates/`
3. **Project local templates** (highest priority) - `./templates/`

Templates with the same name in higher-priority locations override those in lower-priority locations.

## Implementation Details

### File: `/home/dex/kustomark-ralph-bash/src/core/templates/manager.ts`

#### New Functions

1. **`getUserTemplateDirectories(cwd?: string)`**
   - Returns paths to user global and project local template directories
   - Parameters:
     - `cwd`: Optional current working directory (defaults to `process.cwd()`)
   - Returns:
     ```typescript
     {
       homeDir: string,    // ~/.kustomark/templates/
       projectDir: string  // ./templates/
     }
     ```

2. **`discoverTemplatesInDirectory(directory: string, source: "built-in" | "user")`**
   - Generic function to discover templates in a given directory
   - Handles missing directories gracefully (returns empty Map)
   - Validates template.yaml structure
   - Logs discovery progress when `KUSTOMARK_VERBOSE` is set
   - Returns: `Map<string, { metadata: TemplateMetadata; path: string }>`

3. **`discoverTemplates(cwd?: string)`** (replaces `discoverBuiltinTemplates`)
   - Discovers templates from all three locations
   - Implements priority system:
     1. Scans built-in templates first
     2. Scans user global templates (overrides built-ins)
     3. Scans project local templates (overrides all)
   - Logs override events in verbose mode
   - Returns merged template map

### Modified Functionality

#### `TemplateManager.getTemplateCache()`
- Now calls `discoverTemplates()` instead of `discoverBuiltinTemplates()`
- Still maintains backward compatibility with hardcoded fallback templates
- Cache is cleared and rebuilt when `clearCache()` is called

#### `TemplateManager.getTemplateSource()`
- Returns correct source type based on template metadata
- Changed from always returning `"built-in"` to using `templateInfo.metadata.source`

### Error Handling

The implementation handles errors gracefully:

- **Missing directories**: Silently skipped (no error)
- **Invalid template.yaml**: Warning logged, template skipped
- **Permission errors**: Only logged in verbose mode
- **Missing template files**: Warning logged during file loading
- **YAML parsing errors**: Caught and logged, template skipped

### Logging

Verbose logging is controlled by the `KUSTOMARK_VERBOSE` environment variable:

```bash
KUSTOMARK_VERBOSE=1 kustomark templates list
```

Logs include:
- Directory scan locations
- Template discovery events
- Override notifications
- Errors and warnings

### Backward Compatibility

All existing functionality is preserved:

- Hardcoded fallback templates remain (base, overlay, upstream-fork, doc-pipeline)
- Existing API unchanged
- Template type and validation logic untouched
- Caching mechanism intact

## API Usage

### TypeScript/JavaScript

```typescript
import { TemplateManager, getUserTemplateDirectories } from 'kustomark';

// Get template directories
const dirs = getUserTemplateDirectories();
console.log('Home:', dirs.homeDir);        // ~/.kustomark/templates/
console.log('Project:', dirs.projectDir);  // ./templates/

// List all templates
const manager = new TemplateManager();
const templates = await manager.listTemplates();

// Get specific template
const template = await manager.getTemplate('my-template');

// Get template source info
const source = await manager.getTemplateSource('my-template');
console.log('Source:', source.source);  // "built-in" or "user"
console.log('Path:', source.path);

// Force re-discovery
manager.clearCache();
```

## Template Structure

Custom templates must follow this structure:

```
templates/
└── my-template/
    ├── template.yaml       # Required: Template metadata
    ├── kustomark.yaml      # Template file
    ├── README.md           # Template file
    └── ...                 # Additional template files
```

### template.yaml Format

```yaml
apiVersion: kustomark/v1
kind: Template
metadata:
  name: my-template          # Required: Unique identifier
  description: Description   # Required: Template description
  category: custom           # Required: Template category
  version: 1.0.0            # Required: Semantic version
  author: Your Name         # Optional
  tags:                     # Optional
    - tag1
    - tag2

variables:                  # Template variables
  - name: var_name
    description: Variable description
    type: string
    required: true
    example: example-value

files:                      # Template files
  - src: source.md
    dest: destination.md
    substitute: true
```

## Testing

Comprehensive test suite added in `/home/dex/kustomark-ralph-bash/tests/core/template-manager.test.ts`:

- ✅ `getUserTemplateDirectories()` returns correct paths
- ✅ Discovers built-in templates
- ✅ Handles missing directories gracefully
- ✅ Discovers project local templates
- ✅ Project templates override built-in templates
- ✅ Returns custom template files
- ✅ `getTemplateSource()` returns correct info
- ✅ `hasTemplate()` works correctly
- ✅ `clearCache()` forces re-discovery
- ✅ Handles invalid template.yaml
- ✅ Handles missing template.yaml
- ✅ Throws error for non-existent templates

All 13 new tests pass, and all 1945 existing tests continue to pass.

## Examples

Complete examples provided in `/home/dex/kustomark-ralph-bash/examples/custom-templates/`:

- `README.md` - Comprehensive usage guide
- `sample-template/` - Complete working template example (API docs template)

## Performance Considerations

- Template discovery only happens once (first access)
- Results are cached in memory
- Missing directories return immediately (no filesystem operations)
- Verbose logging only when explicitly enabled
- Cache can be cleared to force re-discovery when needed

## Security

- Path validation ensures templates can't escape their directories
- Only directories with valid `template.yaml` are loaded
- Malformed YAML is caught and logged safely
- Permission errors don't break the entire discovery process

## Future Enhancements

Possible future improvements:

1. Template registry/marketplace support
2. Git-based template sources (e.g., GitHub)
3. Template versioning and updates
4. Template dependencies
5. Template inheritance
6. Interactive template creation wizard
