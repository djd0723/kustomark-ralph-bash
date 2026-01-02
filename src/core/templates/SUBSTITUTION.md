# Template Variable Substitution

This module provides comprehensive variable substitution functionality for the Kustomark template system.

## Overview

The substitution module handles replacing `{{VARIABLE_NAME}}` placeholders in template content with actual values. It supports:

- Variable substitution in content and file paths
- Validation of required variables
- Detection of unused variables
- Default value application
- Type checking and pattern validation
- Escaping variables to prevent substitution

## Variable Syntax

Variables must follow these rules:
- Enclosed in double curly braces: `{{VARIABLE_NAME}}`
- All uppercase letters
- Can contain underscores and numbers
- Must start with a letter or underscore
- Case sensitive

Valid examples:
- `{{NAME}}`
- `{{ORG_NAME}}`
- `{{API_KEY_V2}}`
- `{{_PRIVATE}}`

Invalid examples:
- `{{name}}` (lowercase)
- `{{Name}}` (mixed case)
- `{{my-var}}` (hyphens not allowed)
- `{{2VAR}}` (can't start with number)

## Basic Usage

### Substitute Variables in Content

```typescript
import { substituteVariables } from "./substitution.js";

const content = `# {{TITLE}}

Welcome to {{ORG}}!

Contact: {{EMAIL}}`;

const variables = {
  TITLE: "My Documentation",
  ORG: "Acme Corp",
  EMAIL: "support@acme.com"
};

const result = substituteVariables(content, variables);
// Returns:
// # My Documentation
//
// Welcome to Acme Corp!
//
// Contact: support@acme.com
```

### Extract Variables from Content

```typescript
import { extractVariableNames } from "./substitution.js";

const content = "Hello {{NAME}}, welcome to {{ORG}}! Your {{ROLE}} is {{ROLE}}.";
const variables = extractVariableNames(content);
// Returns: ["NAME", "ORG", "ROLE"]
```

### Validate Required Variables

```typescript
import { validateRequiredVariables } from "./substitution.js";
import type { TemplateVariable } from "./types.js";

const template: TemplateVariable[] = [
  {
    name: "NAME",
    required: true,
    type: "string",
    description: "User name"
  },
  {
    name: "EMAIL",
    required: true,
    type: "string",
    description: "Email address",
    pattern: "^[a-z]+@[a-z]+\\.[a-z]+$"
  }
];

const provided = { NAME: "Alice" };
const errors = validateRequiredVariables(template, provided);
// Returns: [{ field: "variables.EMAIL", message: "Required variable 'EMAIL' not provided..." }]
```

### Detect Unused Variables

```typescript
import { detectUnusedVariables } from "./substitution.js";

const provided = { NAME: "Alice", ORG: "Acme", EXTRA: "unused" };
const found = ["NAME", "ORG"];
const warnings = detectUnusedVariables(provided, found);
// Returns: [{ field: "variables.EXTRA", message: "Variable 'EXTRA' provided but not used..." }]
```

### Apply Default Values

```typescript
import { applyDefaultValues } from "./substitution.js";
import type { TemplateVariable } from "./types.js";

const template: TemplateVariable[] = [
  {
    name: "NAME",
    required: true,
    type: "string",
    description: "Name"
  },
  {
    name: "VERSION",
    required: false,
    type: "string",
    description: "Version",
    default: "1.0.0"
  }
];

const provided = { NAME: "Alice" };
const withDefaults = applyDefaultValues(template, provided);
// Returns: { NAME: "Alice", VERSION: "1.0.0" }
```

### Substitute Variables in File Paths

```typescript
import { substitutePathVariables, validatePathVariables } from "./substitution.js";

const destPath = "{{ORG}}/{{REPO}}/docs/{{SECTION}}.md";
const variables = { ORG: "acme", REPO: "widget", SECTION: "intro" };

// First validate
const errors = validatePathVariables(destPath, variables);
if (errors.length > 0) {
  console.error("Path validation errors:", errors);
}

// Then substitute
const result = substitutePathVariables(destPath, variables);
// Returns: "acme/widget/docs/intro.md"
```

## Advanced Features

### Escaping Variables

Use a backslash to prevent variable substitution:

```typescript
import { substituteVariables } from "./substitution.js";

const content = "Use \\{{VARIABLE}} syntax for variables, like {{NAME}}";
const variables = { NAME: "Alice", VARIABLE: "should-not-substitute" };
const result = substituteVariables(content, variables);
// Returns: "Use {{VARIABLE}} syntax for variables, like Alice"
```

### Type Support

Variables support multiple types:

```typescript
const variables = {
  NAME: "Alice",              // string
  PORT: 8080,                 // number
  DEBUG: true,                // boolean
  TAGS: ["foo", "bar", "baz"] // array (joined with ", ")
};

const content = `
Name: {{NAME}}
Port: {{PORT}}
Debug: {{DEBUG}}
Tags: {{TAGS}}
`;

const result = substituteVariables(content, variables);
// Returns:
// Name: Alice
// Port: 8080
// Debug: true
// Tags: foo, bar, baz
```

### Pattern Validation

Validate string values match a regex pattern:

```typescript
const template: TemplateVariable[] = [
  {
    name: "SEMVER",
    required: true,
    type: "string",
    description: "Semantic version",
    pattern: "^\\d+\\.\\d+\\.\\d+$"
  }
];

const valid = { SEMVER: "1.2.3" };
const errors1 = validateRequiredVariables(template, valid);
// Returns: []

const invalid = { SEMVER: "v1.2.3" };
const errors2 = validateRequiredVariables(template, invalid);
// Returns: [{ message: "...does not match required pattern..." }]
```

## Complete Example

Here's a complete example showing a typical workflow:

```typescript
import {
  substituteVariables,
  extractVariableNames,
  validateRequiredVariables,
  detectUnusedVariables,
  applyDefaultValues,
} from "./substitution.js";
import type { TemplateVariable, TemplateValues } from "./types.js";

// Define template
const templateDef: TemplateVariable[] = [
  {
    name: "ORG",
    required: true,
    type: "string",
    description: "Organization name"
  },
  {
    name: "REPO",
    required: true,
    type: "string",
    description: "Repository name"
  },
  {
    name: "VERSION",
    required: false,
    type: "string",
    description: "Version",
    default: "1.0.0"
  }
];

const templateContent = `# {{ORG}}/{{REPO}}

Version: {{VERSION}}

Welcome to the {{ORG}} {{REPO}} documentation!`;

// User provides values
const userValues: TemplateValues = {
  ORG: "acme",
  REPO: "widget",
  // VERSION not provided, will use default
};

// Apply defaults
const values = applyDefaultValues(templateDef, userValues);

// Validate required variables
const errors = validateRequiredVariables(templateDef, values);
if (errors.length > 0) {
  console.error("Validation errors:", errors);
  process.exit(1);
}

// Check for unused variables
const usedVars = extractVariableNames(templateContent);
const warnings = detectUnusedVariables(values, usedVars);
if (warnings.length > 0) {
  console.warn("Warnings:", warnings);
}

// Substitute variables
const result = substituteVariables(templateContent, values);
console.log(result);
// Output:
// # acme/widget
//
// Version: 1.0.0
//
// Welcome to the acme widget documentation!
```

## Error Handling

All validation functions return `ValidationError[]` with this structure:

```typescript
interface ValidationError {
  field?: string;      // e.g., "variables.NAME"
  file?: string;       // e.g., "{{ORG}}/README.md"
  message: string;     // Human-readable error message
}
```

Warnings use `ValidationWarning[]` with the same structure.

## Integration with Template System

This module integrates with the template types from `types.ts`:

```typescript
import type {
  TemplateVariable,
  TemplateValues,
  TemplateFile
} from "./types.js";
```

And uses the core validation types from `../types.js`:

```typescript
import type {
  ValidationError,
  ValidationWarning
} from "../types.js";
```

## Testing

The module includes comprehensive tests in `substitution.test.ts`:

```bash
bun test src/core/templates/substitution.test.ts
```

All 43 tests should pass, covering:
- Basic substitution
- Variable extraction
- Required variable validation
- Type checking
- Pattern validation
- Default values
- Unused variable detection
- Path substitution
- Escaping
- Edge cases
