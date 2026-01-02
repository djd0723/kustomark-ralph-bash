/**
 * JSON Schema generation for Kustomark configuration
 * Used by the `kustomark schema` command for editor integration
 */

/**
 * Generates a comprehensive JSON Schema for kustomark.yaml files
 */
export function generateSchema(): object {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://kustomark.dev/schema/v1/kustomark.json",
    title: "Kustomark Configuration",
    description: "Configuration file for Kustomark - declarative markdown patching pipeline",
    type: "object",
    required: ["apiVersion", "kind", "resources"],
    properties: {
      apiVersion: {
        type: "string",
        const: "kustomark/v1",
        description: "API version for the Kustomark configuration format",
      },
      kind: {
        type: "string",
        const: "Kustomization",
        description: "Kind of configuration - must be 'Kustomization'",
      },
      output: {
        type: "string",
        description:
          "Output directory for built files (required for build command, relative to config file)",
      },
      resources: {
        type: "array",
        description:
          "List of resource patterns, file paths, or kustomark configs to include. Supports glob patterns, local paths, git URLs, and HTTP archives.",
        minItems: 1,
        items: {
          type: "string",
          description:
            "Resource pattern (glob), local path, kustomark directory, git URL (github.com/org/repo//path?ref=branch), or HTTP archive URL",
        },
      },
      onNoMatch: {
        type: "string",
        enum: ["skip", "warn", "error"],
        description:
          "Default strategy for handling patches that don't match any content. 'skip' ignores silently, 'warn' shows warnings, 'error' fails the build.",
        default: "warn",
      },
      patches: {
        type: "array",
        description: "Ordered list of patch operations to apply to resources",
        items: {
          oneOf: [
            {
              type: "object",
              required: ["op", "old", "new"],
              properties: {
                op: {
                  type: "string",
                  const: "replace",
                  description: "Simple string replacement operation",
                },
                old: {
                  type: "string",
                  description: "String to find and replace",
                },
                new: {
                  type: "string",
                  description: "Replacement string",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description:
                    "Glob pattern(s) to include specific files. Only files matching this pattern will have this patch applied.",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files from this patch",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this specific patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "pattern", "replacement"],
              properties: {
                op: {
                  type: "string",
                  const: "replace-regex",
                  description: "Regex-based replacement operation",
                },
                pattern: {
                  type: "string",
                  description: "Regular expression pattern to match",
                },
                replacement: {
                  type: "string",
                  description: "Replacement string (supports regex capture groups like $1, $2)",
                },
                flags: {
                  type: "string",
                  description: "Regex flags: g=global, i=case-insensitive, m=multiline, s=dotall",
                  pattern: "^[gims]*$",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id"],
              properties: {
                op: {
                  type: "string",
                  const: "remove-section",
                  description: "Remove a markdown section by ID",
                },
                id: {
                  type: "string",
                  description:
                    "Section ID (GitHub-style slug like 'getting-started' or explicit {#custom-id})",
                },
                includeChildren: {
                  type: "boolean",
                  description: "Whether to include child sections in the removal (default: true)",
                  default: true,
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "replace-section",
                  description: "Replace entire section content",
                },
                id: {
                  type: "string",
                  description: "Section ID (GitHub-style slug or explicit {#custom-id})",
                },
                content: {
                  type: "string",
                  description: "New content for the section",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "prepend-to-section",
                  description: "Add content to the beginning of a section",
                },
                id: {
                  type: "string",
                  description: "Section ID (GitHub-style slug or explicit {#custom-id})",
                },
                content: {
                  type: "string",
                  description: "Content to prepend",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "append-to-section",
                  description: "Add content to the end of a section",
                },
                id: {
                  type: "string",
                  description: "Section ID (GitHub-style slug or explicit {#custom-id})",
                },
                content: {
                  type: "string",
                  description: "Content to append",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "key", "value"],
              properties: {
                op: {
                  type: "string",
                  const: "set-frontmatter",
                  description: "Set a frontmatter field",
                },
                key: {
                  type: "string",
                  description: "Frontmatter key to set",
                },
                value: {
                  description: "Value to set (can be string, number, boolean, array, or object)",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "key"],
              properties: {
                op: {
                  type: "string",
                  const: "remove-frontmatter",
                  description: "Remove a frontmatter field",
                },
                key: {
                  type: "string",
                  description: "Frontmatter key to remove",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "old", "new"],
              properties: {
                op: {
                  type: "string",
                  const: "rename-frontmatter",
                  description: "Rename a frontmatter field",
                },
                old: {
                  type: "string",
                  description: "Old key name",
                },
                new: {
                  type: "string",
                  description: "New key name",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "values"],
              properties: {
                op: {
                  type: "string",
                  const: "merge-frontmatter",
                  description: "Merge multiple values into frontmatter",
                },
                values: {
                  type: "object",
                  description: "Key-value pairs to merge into frontmatter",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "start", "end"],
              properties: {
                op: {
                  type: "string",
                  const: "delete-between",
                  description: "Delete content between two markers",
                },
                start: {
                  type: "string",
                  description: "Start marker string",
                },
                end: {
                  type: "string",
                  description: "End marker string",
                },
                inclusive: {
                  type: "boolean",
                  description: "Whether to include the marker lines in deletion (default: true)",
                  default: true,
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "start", "end", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "replace-between",
                  description: "Replace content between two markers",
                },
                start: {
                  type: "string",
                  description: "Start marker string",
                },
                end: {
                  type: "string",
                  description: "End marker string",
                },
                content: {
                  type: "string",
                  description: "Replacement content",
                },
                inclusive: {
                  type: "boolean",
                  description: "Whether to include the marker lines in replacement (default: true)",
                  default: true,
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "match", "replacement"],
              properties: {
                op: {
                  type: "string",
                  const: "replace-line",
                  description: "Replace entire lines that match",
                },
                match: {
                  type: "string",
                  description: "Exact string to match (entire line)",
                },
                replacement: {
                  type: "string",
                  description: "Replacement line content",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "insert-after-line",
                  description: "Insert content after a matching line",
                },
                match: {
                  type: "string",
                  description: "Exact string to match (mutually exclusive with pattern)",
                },
                pattern: {
                  type: "string",
                  description: "Regex pattern to match (mutually exclusive with match)",
                },
                regex: {
                  type: "boolean",
                  description: "Whether pattern is a regex (default: false)",
                  default: false,
                },
                content: {
                  type: "string",
                  description: "Content to insert after the matching line",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "insert-before-line",
                  description: "Insert content before a matching line",
                },
                match: {
                  type: "string",
                  description: "Exact string to match (mutually exclusive with pattern)",
                },
                pattern: {
                  type: "string",
                  description: "Regex pattern to match (mutually exclusive with match)",
                },
                regex: {
                  type: "boolean",
                  description: "Whether pattern is a regex (default: false)",
                  default: false,
                },
                content: {
                  type: "string",
                  description: "Content to insert before the matching line",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id", "after"],
              properties: {
                op: {
                  type: "string",
                  const: "move-section",
                  description: "Move a section after another section",
                },
                id: {
                  type: "string",
                  description: "Section ID to move (GitHub-style slug or explicit {#custom-id})",
                },
                after: {
                  type: "string",
                  description:
                    "Section ID to move after (GitHub-style slug or explicit {#custom-id})",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id", "new"],
              properties: {
                op: {
                  type: "string",
                  const: "rename-header",
                  description: "Rename a section header while preserving level",
                },
                id: {
                  type: "string",
                  description: "Section ID (GitHub-style slug or explicit {#custom-id})",
                },
                new: {
                  type: "string",
                  description: "New header text",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "id", "delta"],
              properties: {
                op: {
                  type: "string",
                  const: "change-section-level",
                  description: "Change the heading level of a section",
                },
                id: {
                  type: "string",
                  description: "Section ID (GitHub-style slug or explicit {#custom-id})",
                },
                delta: {
                  type: "integer",
                  description:
                    "Level change delta (e.g., -1 to promote ### → ##, +1 to demote ## → ###)",
                },
                include: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Glob pattern(s) to exclude specific files",
                },
                onNoMatch: {
                  type: "string",
                  enum: ["skip", "warn", "error"],
                  description: "Override the default onNoMatch behavior for this patch",
                },
                validate: {
                  type: "object",
                  description: "Per-patch validation rules",
                  properties: {
                    notContains: {
                      type: "string",
                      description: "Validate that the result does not contain this string",
                    },
                  },
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "array",
                      items: { type: "string" },
                    },
                  ],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
              },
              additionalProperties: false,
            },
          ],
        },
      },
      validators: {
        type: "array",
        description: "Global validators to run on all resources after patching",
        items: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              description: "Unique name for this validator",
            },
            notContains: {
              type: "string",
              description: "Validate that content does not contain this string",
            },
            frontmatterRequired: {
              type: "array",
              description: "Validate that frontmatter has these required fields",
              items: {
                type: "string",
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}
