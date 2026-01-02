# Template Discovery Architecture

## Template Discovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    TemplateManager                          │
│                 .getTemplateCache()                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
              ┌───────────────────────┐
              │  discoverTemplates()  │
              └───────────┬───────────┘
                          │
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
    ┌─────────┐    ┌──────────┐    ┌──────────┐
    │Built-in │    │User      │    │Project   │
    │Priority │    │Global    │    │Local     │
    │   #1    │    │Priority  │    │Priority  │
    │(lowest) │    │   #2     │    │   #3     │
    │         │    │          │    │(highest) │
    └────┬────┘    └────┬─────┘    └────┬─────┘
         │              │               │
         ↓              ↓               ↓
    ┌─────────────────────────────────────────┐
    │ discoverTemplatesInDirectory()          │
    │                                         │
    │ • Check directory exists                │
    │ • Read subdirectories                   │
    │ • Find template.yaml files              │
    │ • Parse and validate                    │
    │ • Return template metadata              │
    └─────────────────┬───────────────────────┘
                      │
                      ↓
              ┌───────────────┐
              │ Merged Map    │
              │ (later wins)  │
              └───────┬───────┘
                      │
                      ↓
            ┌─────────────────────┐
            │ + Hardcoded         │
            │   Fallbacks         │
            │   (if missing)      │
            └─────────┬───────────┘
                      │
                      ↓
              ┌───────────────┐
              │ Cached Result │
              └───────────────┘
```

## Template Priority Example

Given these templates:

```
Built-in:     base, overlay, upstream-fork, doc-pipeline
User Global:  base, my-global-template
Project:      base, my-project-template
```

Final result:
```
base                 → Project version (overrides both)
overlay              → Built-in version
upstream-fork        → Built-in version
doc-pipeline         → Built-in version
my-global-template   → User Global version
my-project-template  → Project version
```

## Directory Structure

```
# Built-in (shipped with kustomark)
kustomark/
└── src/core/templates/builtin/
    ├── base/
    │   ├── template.yaml
    │   ├── kustomark.yaml
    │   └── README.md
    ├── overlay/
    └── ...

# User Global (cross-project)
~/.kustomark/templates/
├── my-template-1/
│   ├── template.yaml
│   └── ...
└── my-template-2/
    ├── template.yaml
    └── ...

# Project Local (this project only)
./templates/
├── custom-template/
│   ├── template.yaml
│   └── ...
└── another-template/
    ├── template.yaml
    └── ...
```

## API Call Flow

### Listing Templates

```
User Code:
  manager.listTemplates()
        ↓
  getTemplateCache()
        ↓
  discoverTemplates()
        ↓
  [Scan 3 directories]
        ↓
  [Merge with priority]
        ↓
  [Add fallbacks]
        ↓
  [Cache result]
        ↓
  Return metadata array
```

### Getting a Template

```
User Code:
  manager.getTemplate("my-template")
        ↓
  getTemplateCache()
        ↓
  [Get from cache]
        ↓
  Check if filesystem or hardcoded
        ↓
  Load template files
        ↓
  Return Template object
```

## Code Modules

### Main Functions

```typescript
// Public API
export function getUserTemplateDirectories(cwd?: string)
export class TemplateManager {
  async listTemplates()
  async getTemplate(id: string)
  async getTemplateSource(id: string)
  async hasTemplate(id: string)
  clearCache()
}

// Internal Functions
function discoverTemplates(cwd?: string)
function discoverTemplatesInDirectory(directory, source)
function loadTemplateFiles(templatePath, templateYaml)
function getBuiltinTemplateFiles(templateId)
```

### Data Structures

```typescript
interface TemplateMetadata {
  id: string
  name: string
  description: string
  source: "built-in" | "user"
  tags: string[]
  files: string[]
}

interface Template {
  metadata: TemplateMetadata
  files: TemplateFile[]
}

interface TemplateFile {
  path: string
  content: string
}
```

## Error Handling Strategy

```
Directory Missing
  ↓
  [Return empty Map]
  ↓
  [Continue with other directories]

Invalid YAML
  ↓
  [Log warning]
  ↓
  [Skip template]
  ↓
  [Continue with other templates]

Permission Error
  ↓
  [Log if VERBOSE]
  ↓
  [Return templates found so far]
```

## Caching Strategy

```
First Access:
  • Discovery runs
  • Results cached in memory
  • Subsequent calls use cache

On clearCache():
  • Cache set to null
  • Next access triggers re-discovery

Benefits:
  • Fast repeated access
  • No redundant filesystem operations
  • Can force refresh when needed
```

## Verbose Logging Points

```
KUSTOMARK_VERBOSE=1 enables logging at:

1. Directory scan start
   → "Scanning built-in templates at: /path"

2. Template discovery
   → "Discovered user template: my-template at /path"

3. Override events
   → "Project local template 'base' overrides built-in template"

4. Errors (always logged)
   → "Error parsing template.yaml in name: message"

5. Warnings (always logged)
   → "Template directory missing template.yaml, skipping"
```

## Performance Characteristics

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| First listTemplates() | O(n) | n = total templates in all dirs |
| Subsequent listTemplates() | O(1) | Returns cached result |
| getTemplate() | O(1) + O(f) | Map lookup + file reading |
| clearCache() | O(1) | Just sets cache to null |
| discoverTemplates() | O(d × t) | d = dirs, t = templates per dir |

Where:
- n = total number of templates across all directories
- f = number of files in a template
- d = number of directories scanned (3)
- t = average templates per directory
