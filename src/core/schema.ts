/**
 * JSON Schema generation for Kustomark configuration
 * Used by the `kustomark schema` command for editor integration
 */

/**
 * Generates a comprehensive JSON Schema for kustomark.yaml files
 */
export function generateSchema(): object {
  // Condition schema definition (recursive structure)
  const conditionSchema = {
    oneOf: [
      {
        type: "object",
        required: ["type", "value"],
        properties: {
          type: {
            type: "string",
            const: "fileContains",
            description: "Check if file content contains a string",
          },
          value: {
            type: "string",
            description: "String to search for in file content",
          },
        },
        additionalProperties: false,
      },
      {
        type: "object",
        required: ["type", "pattern"],
        properties: {
          type: {
            type: "string",
            const: "fileMatches",
            description: "Check if file content matches a regex pattern",
          },
          pattern: {
            type: "string",
            description: "Regex pattern to match against file content",
          },
        },
        additionalProperties: false,
      },
      {
        type: "object",
        required: ["type", "key", "value"],
        properties: {
          type: {
            type: "string",
            const: "frontmatterEquals",
            description: "Check if frontmatter field equals a value",
          },
          key: {
            type: "string",
            description: "Frontmatter key to check",
          },
          value: {
            description: "Expected value (can be string, number, boolean, array, or object)",
          },
        },
        additionalProperties: false,
      },
      {
        type: "object",
        required: ["type", "key"],
        properties: {
          type: {
            type: "string",
            const: "frontmatterExists",
            description: "Check if frontmatter key exists",
          },
          key: {
            type: "string",
            description: "Frontmatter key to check for existence",
          },
        },
        additionalProperties: false,
      },
      {
        type: "object",
        required: ["type", "condition"],
        properties: {
          type: {
            type: "string",
            const: "not",
            description: "Logical NOT - negates another condition",
          },
          condition: {
            $ref: "#/$defs/condition",
            description: "Condition to negate",
          },
        },
        additionalProperties: false,
      },
      {
        type: "object",
        required: ["type", "conditions"],
        properties: {
          type: {
            type: "string",
            const: "anyOf",
            description: "Logical OR - matches if any sub-condition matches",
          },
          conditions: {
            type: "array",
            description: "List of conditions to check (matches if any is true)",
            items: {
              $ref: "#/$defs/condition",
            },
            minItems: 1,
          },
        },
        additionalProperties: false,
      },
      {
        type: "object",
        required: ["type", "conditions"],
        properties: {
          type: {
            type: "string",
            const: "allOf",
            description: "Logical AND - matches if all sub-conditions match",
          },
          conditions: {
            type: "array",
            description: "List of conditions to check (matches if all are true)",
            items: {
              $ref: "#/$defs/condition",
            },
            minItems: 1,
          },
        },
        additionalProperties: false,
      },
    ],
  };

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://kustomark.dev/schema/v1/kustomark.json",
    title: "Kustomark Configuration",
    description: "Configuration file for Kustomark - declarative markdown patching pipeline",
    type: "object",
    required: ["apiVersion", "kind", "resources"],
    $defs: {
      condition: conditionSchema,
    },
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
          oneOf: [
            {
              type: "string",
              description:
                "Resource pattern (glob), local path, kustomark directory, git URL (github.com/org/repo//path?ref=branch), or HTTP archive URL",
            },
            {
              type: "object",
              description:
                "Resource object with URL and optional authentication/integrity metadata",
              required: ["url"],
              properties: {
                url: {
                  type: "string",
                  description:
                    "Resource URL - supports glob patterns, local paths, git URLs (github.com/org/repo//path?ref=branch), or HTTP archive URLs",
                },
                sha256: {
                  type: "string",
                  description:
                    "SHA-256 hash for resource integrity verification. When specified, the downloaded resource must match this hash.",
                  pattern: "^[a-fA-F0-9]{64}$",
                },
                auth: {
                  type: "object",
                  description: "Authentication configuration for accessing protected resources",
                  required: ["type"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["bearer", "basic"],
                      description:
                        "Authentication type: 'bearer' for token-based auth, 'basic' for username/password auth",
                    },
                    tokenEnv: {
                      type: "string",
                      description:
                        "Environment variable name containing the bearer token (used when type is 'bearer')",
                    },
                    username: {
                      type: "string",
                      description: "Username for basic authentication (used when type is 'basic')",
                    },
                    passwordEnv: {
                      type: "string",
                      description:
                        "Environment variable name containing the password for basic authentication (used when type is 'basic')",
                    },
                  },
                  additionalProperties: false,
                },
              },
              additionalProperties: false,
            },
          ],
        },
      },
      vars: {
        type: "object",
        description:
          "Variable definitions for substitution in patch values. Reference as $" + "{varName}.",
        additionalProperties: { type: "string" },
      },
      envVars: {
        type: "array",
        description:
          "Whitelist of environment variable names to expose for substitution in patch values. Reference as $" +
          "{NAME}. Resolved from process.env at build time. Lower priority than vars: and --var flags.",
        items: { type: "string" },
        uniqueItems: true,
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "src", "dest"],
              properties: {
                op: {
                  type: "string",
                  const: "copy-file",
                  description: "Copy a file to a new location",
                },
                src: {
                  type: "string",
                  description: "Source file path",
                },
                dest: {
                  type: "string",
                  description: "Destination file path",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "match", "rename"],
              properties: {
                op: {
                  type: "string",
                  const: "rename-file",
                  description: "Rename files matching a pattern",
                },
                match: {
                  type: "string",
                  description: "Glob pattern to match files",
                },
                rename: {
                  type: "string",
                  description: "New filename (basename only, not full path)",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "match"],
              properties: {
                op: {
                  type: "string",
                  const: "delete-file",
                  description: "Delete files matching a pattern",
                },
                match: {
                  type: "string",
                  description: "Glob pattern to match files to delete",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "match", "dest"],
              properties: {
                op: {
                  type: "string",
                  const: "move-file",
                  description: "Move files matching a pattern to a destination",
                },
                match: {
                  type: "string",
                  description: "Glob pattern to match files",
                },
                dest: {
                  type: "string",
                  description: "Destination directory path",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "table", "row", "column", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "replace-table-cell",
                  description: "Replace content in a specific table cell",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                row: {
                  oneOf: [
                    { type: "number" },
                    {
                      type: "object",
                      required: ["column", "value"],
                      properties: {
                        column: {
                          oneOf: [{ type: "number" }, { type: "string" }],
                          description: "Column identifier (0-based index or header name)",
                        },
                        value: {
                          type: "string",
                          description: "Value to match in the specified column",
                        },
                      },
                      additionalProperties: false,
                    },
                  ],
                  description:
                    "Row identifier (0-based index or object with column and value to match)",
                },
                column: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Column identifier (0-based index or header name)",
                },
                content: {
                  type: "string",
                  description: "New content for the cell",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "table", "values"],
              properties: {
                op: {
                  type: "string",
                  const: "add-table-row",
                  description: "Add a new row to a table",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                values: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of cell values for the new row",
                },
                position: {
                  type: "number",
                  description: "Position to insert the row (0-based index, default: append to end)",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "table", "row"],
              properties: {
                op: {
                  type: "string",
                  const: "remove-table-row",
                  description: "Remove a row from a table",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                row: {
                  oneOf: [
                    { type: "number" },
                    {
                      type: "object",
                      required: ["column", "value"],
                      properties: {
                        column: {
                          oneOf: [{ type: "number" }, { type: "string" }],
                          description: "Column identifier (0-based index or header name)",
                        },
                        value: {
                          type: "string",
                          description: "Value to match in the specified column",
                        },
                      },
                      additionalProperties: false,
                    },
                  ],
                  description:
                    "Row identifier (0-based index or object with column and value to match)",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "table", "header"],
              properties: {
                op: {
                  type: "string",
                  const: "add-table-column",
                  description: "Add a new column to a table",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                header: {
                  type: "string",
                  description: "Header name for the new column",
                },
                defaultValue: {
                  type: "string",
                  description: "Default value for existing rows (default: empty string)",
                },
                position: {
                  type: "number",
                  description:
                    "Position to insert the column (0-based index, default: append to end)",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "table", "column"],
              properties: {
                op: {
                  type: "string",
                  const: "remove-table-column",
                  description: "Remove a column from a table",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                column: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Column identifier (0-based index or header name)",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // rename-table-column
            {
              type: "object",
              required: ["op", "table", "column", "new"],
              properties: {
                op: {
                  type: "string",
                  const: "rename-table-column",
                  description: "Rename a column header in a table while preserving all data",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                column: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Column to rename (0-based index or current header name)",
                },
                new: {
                  type: "string",
                  description: "New header name for the column",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // reorder-table-columns
            {
              type: "object",
              required: ["op", "table", "columns"],
              properties: {
                op: {
                  type: "string",
                  const: "reorder-table-columns",
                  description: "Reorder columns in a markdown table",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                columns: {
                  type: "array",
                  items: {
                    oneOf: [{ type: "number" }, { type: "string" }],
                  },
                  description: "New column order as array of header names or 0-based indices",
                  minItems: 1,
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // sort-table
            {
              type: "object",
              required: ["op", "table", "column"],
              properties: {
                op: {
                  type: "string",
                  const: "sort-table",
                  description: "Sort table rows by a column",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (0-based index or heading text)",
                },
                column: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Column to sort by (0-based index or header name)",
                },
                direction: {
                  type: "string",
                  enum: ["asc", "desc"],
                  description: "Sort direction (default: asc)",
                },
                type: {
                  type: "string",
                  enum: ["string", "number", "date"],
                  description: "Comparison type for sorting (default: string)",
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // filter-table-rows
            {
              type: "object",
              required: ["op", "table", "column"],
              properties: {
                op: {
                  type: "string",
                  const: "filter-table-rows",
                  description:
                    "Filter table rows, keeping only rows where a column matches a value or pattern",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (line number or section heading ID)",
                },
                column: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Column to filter on (0-based index or header name)",
                },
                match: {
                  type: "string",
                  description: "Exact value to match (case-sensitive)",
                },
                pattern: {
                  type: "string",
                  description: "Regex pattern to match against column value",
                },
                invert: {
                  type: "boolean",
                  description: "When true, keep rows that do NOT match the filter (default: false)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // deduplicate-table-rows
            {
              type: "object",
              required: ["op", "table"],
              properties: {
                op: {
                  type: "string",
                  const: "deduplicate-table-rows",
                  description: "Remove duplicate rows from a markdown table",
                },
                table: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description: "Table identifier (line number or section heading ID)",
                },
                column: {
                  oneOf: [{ type: "number" }, { type: "string" }],
                  description:
                    "Optional column to deduplicate by (0-based index or header name). If omitted, compares all columns.",
                },
                keep: {
                  type: "string",
                  enum: ["first", "last"],
                  description: 'Which occurrence to keep when duplicates found (default: "first")',
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // add-list-item
            {
              type: "object",
              required: ["op", "list", "item"],
              properties: {
                op: {
                  type: "string",
                  const: "add-list-item",
                  description: "Add a new item to a markdown list",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                item: {
                  type: "string",
                  description: "Text of the item to add (without bullet prefix)",
                },
                position: {
                  type: "integer",
                  description:
                    "Where to insert: 0 = beginning, -1 or omit = end, N = after N-th item (0-based)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // remove-list-item
            {
              type: "object",
              required: ["op", "list", "item"],
              properties: {
                op: {
                  type: "string",
                  const: "remove-list-item",
                  description: "Remove an item from a markdown list",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                item: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based item index",
                    },
                    {
                      type: "string",
                      description: "Exact text of the item to remove",
                    },
                  ],
                  description: "Item to remove: zero-based index or exact text to match",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // sort-list
            {
              type: "object",
              required: ["op", "list"],
              properties: {
                op: {
                  type: "string",
                  const: "sort-list",
                  description: "Sort items in a markdown list",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                direction: {
                  type: "string",
                  enum: ["asc", "desc"],
                  description: "Sort direction (default: asc)",
                },
                type: {
                  type: "string",
                  enum: ["string", "number"],
                  description: "Comparison type for sorting (default: string)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // filter-list-items
            {
              type: "object",
              required: ["op", "list"],
              properties: {
                op: {
                  type: "string",
                  const: "filter-list-items",
                  description:
                    "Filter list items, keeping only items that match a value or pattern",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                match: {
                  type: "string",
                  description: "Exact value to match against item text (case-sensitive)",
                },
                pattern: {
                  type: "string",
                  description: "Regex pattern to match against item text",
                },
                invert: {
                  type: "boolean",
                  description:
                    "When true, keep items that do NOT match the filter (default: false)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // deduplicate-list-items
            {
              type: "object",
              required: ["op", "list"],
              properties: {
                op: {
                  type: "string",
                  const: "deduplicate-list-items",
                  description: "Remove duplicate items from a markdown list",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                keep: {
                  type: "string",
                  enum: ["first", "last"],
                  description: 'Which occurrence to keep when duplicates found (default: "first")',
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // reorder-list-items
            {
              type: "object",
              required: ["op", "list", "order"],
              properties: {
                op: {
                  type: "string",
                  const: "reorder-list-items",
                  description: "Reorder items in a markdown list to a specified order",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                order: {
                  type: "array",
                  items: {
                    oneOf: [
                      {
                        type: "integer",
                        minimum: 0,
                        description: "Zero-based item index",
                      },
                      {
                        type: "string",
                        description: "Exact item text to match",
                      },
                    ],
                  },
                  description:
                    "New item order as array of 0-based indices or exact item text strings",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // set-list-item
            {
              type: "object",
              required: ["op", "list", "item", "new"],
              properties: {
                op: {
                  type: "string",
                  const: "set-list-item",
                  description: "Replace an item in a markdown list",
                },
                list: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based list index (0 = first list in file)",
                    },
                    {
                      type: "string",
                      description: "Section ID containing the list",
                    },
                  ],
                  description: "List identifier: zero-based index or section ID",
                },
                item: {
                  oneOf: [
                    {
                      type: "integer",
                      minimum: 0,
                      description: "Zero-based item index",
                    },
                    {
                      type: "string",
                      description: "Exact text of the item to replace",
                    },
                  ],
                  description: "Item to replace: zero-based index or exact text to match",
                },
                new: {
                  type: "string",
                  description: "New text for the item (without bullet prefix)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "command"],
              properties: {
                op: {
                  type: "string",
                  const: "exec",
                  description: "Execute a shell command to transform content via stdin/stdout",
                },
                command: {
                  type: "string",
                  description:
                    "Shell command to execute. Content is piped to stdin, transformed output is read from stdout. Command must exit with code 0 for success.",
                },
                timeout: {
                  type: "number",
                  description: "Timeout in milliseconds (default: 30000)",
                  default: 30000,
                  minimum: 100,
                  maximum: 300000,
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "plugin"],
              properties: {
                op: {
                  type: "string",
                  const: "plugin",
                  description: "Execute a custom plugin to transform content",
                },
                plugin: {
                  type: "string",
                  description:
                    "Name of the plugin to execute (must be defined in the plugins array)",
                },
                params: {
                  type: "object",
                  description: "Parameters to pass to the plugin",
                  additionalProperties: true,
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
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
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "path", "value"],
              properties: {
                op: {
                  type: "string",
                  const: "json-set",
                  description:
                    "Set a value at a dot-notation path in a JSON, YAML, TOML, .env, or .properties file",
                },
                path: {
                  type: "string",
                  description: 'Dot-notation path to set (e.g. "server.port" or "users[0].name")',
                },
                value: {
                  description: "Value to set at the path",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "path"],
              properties: {
                op: {
                  type: "string",
                  const: "json-delete",
                  description:
                    "Delete a key at a dot-notation path in a JSON, YAML, TOML, .env, or .properties file",
                },
                path: {
                  type: "string",
                  description: 'Dot-notation path to delete (e.g. "server.debug")',
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["op", "value"],
              properties: {
                op: {
                  type: "string",
                  const: "json-merge",
                  description:
                    "Deep merge an object into a JSON, YAML, TOML, .env, or .properties file at root or at a given path",
                },
                value: {
                  type: "object",
                  description: "Object to deep merge",
                  additionalProperties: true,
                },
                path: {
                  type: "string",
                  description: "Optional dot-notation path to merge into (defaults to root)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // modify-links
            {
              type: "object",
              required: ["op"],
              properties: {
                op: {
                  type: "string",
                  const: "modify-links",
                  description: "Find inline markdown links by URL or text and replace them",
                },
                urlMatch: {
                  type: "string",
                  description: "Exact URL to match",
                },
                urlPattern: {
                  type: "string",
                  description: "Regex pattern to match URL",
                },
                textMatch: {
                  type: "string",
                  description: "Exact link text to match",
                },
                textPattern: {
                  type: "string",
                  description: "Regex pattern to match link text",
                },
                newUrl: {
                  type: "string",
                  description: "Replacement URL",
                },
                urlReplacement: {
                  type: "string",
                  description: "Regex replacement string for URL (supports $1, $2 etc.)",
                },
                newText: {
                  type: "string",
                  description: "Replacement link text",
                },
                textReplacement: {
                  type: "string",
                  description: "Regex replacement string for link text (supports $1, $2 etc.)",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // update-toc
            {
              type: "object",
              required: ["op"],
              properties: {
                op: {
                  type: "string",
                  const: "update-toc",
                  description: "Regenerate table of contents between HTML comment markers",
                },
                marker: {
                  type: "string",
                  description: 'Opening TOC marker (default: "<!-- TOC -->")',
                },
                endMarker: {
                  type: "string",
                  description: 'Closing TOC marker (default: "<!-- /TOC -->")',
                },
                minLevel: {
                  type: "integer",
                  minimum: 1,
                  maximum: 6,
                  description: "Minimum heading level to include (default: 2)",
                },
                maxLevel: {
                  type: "integer",
                  minimum: 1,
                  maximum: 6,
                  description: "Maximum heading level to include (default: 4)",
                },
                ordered: {
                  type: "boolean",
                  description: "Use ordered (numbered) list (default: false)",
                },
                indent: {
                  type: "string",
                  description: 'Indentation string per level (default: "  ")',
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                id: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // replace-in-section
            {
              type: "object",
              required: ["op", "id", "old", "new"],
              properties: {
                op: {
                  type: "string",
                  const: "replace-in-section",
                  description:
                    "Replace text within a specific section only, leaving other sections unchanged",
                },
                id: {
                  type: "string",
                  description: "Section ID (slug or custom ID) to scope the replacement to",
                },
                old: {
                  type: "string",
                  description: "Exact text to find within the section",
                },
                new: {
                  type: "string",
                  description: "Replacement text",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // prepend-to-file
            {
              type: "object",
              required: ["op", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "prepend-to-file",
                  description: "Add content to the very beginning of a file",
                },
                content: {
                  type: "string",
                  description: "Content to prepend at the start of the file",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
                },
              },
              additionalProperties: false,
            },
            // append-to-file
            {
              type: "object",
              required: ["op", "content"],
              properties: {
                op: {
                  type: "string",
                  const: "append-to-file",
                  description: "Add content to the very end of a file",
                },
                content: {
                  type: "string",
                  description: "Content to append at the end of the file",
                },
                include: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Glob pattern(s) to include specific files",
                },
                exclude: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
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
                    contains: {
                      type: "string",
                      description: "Validate that the result contains this string",
                    },
                    matchesRegex: {
                      type: "string",
                      description: "Validate that the result matches this regex pattern",
                    },
                    notMatchesRegex: {
                      type: "string",
                      description: "Validate that the result does NOT match this regex pattern",
                    },
                    frontmatterRequired: {
                      type: "array",
                      description: "Validate that the result has these required frontmatter keys",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                group: {
                  type: "string",
                  description:
                    "Optional group name for selective patch application via --enable-groups or --disable-groups",
                },
                patchId: {
                  type: "string",
                  description: "Unique identifier for this patch (for inheritance)",
                  pattern: "^[a-zA-Z0-9_-]+$",
                },
                extends: {
                  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                  description: "Patch ID(s) to extend from (inherit fields)",
                },
                when: {
                  $ref: "#/$defs/condition",
                  description:
                    "Optional condition - patch only applies if condition evaluates to true",
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
            contains: {
              type: "string",
              description: "Validate that content contains this string",
            },
            matchesRegex: {
              type: "string",
              description: "Validate that content matches this regex pattern",
            },
            notMatchesRegex: {
              type: "string",
              description: "Validate that content does NOT match this regex pattern",
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
      watch: {
        type: "object",
        description: "Watch mode hooks - shell commands triggered on build events",
        properties: {
          onBuild: {
            type: "array",
            description: "Commands to execute after successful build (run sequentially)",
            items: {
              type: "string",
              description:
                "Shell command with optional template variables: {{file}}, {{exitCode}}, {{timestamp}}",
            },
          },
          onError: {
            type: "array",
            description: "Commands to execute when build fails",
            items: {
              type: "string",
              description:
                "Shell command with optional template variables: {{error}}, {{exitCode}}, {{timestamp}}",
            },
          },
          onChange: {
            type: "array",
            description: "Commands to execute when file changes are detected (before build)",
            items: {
              type: "string",
              description:
                "Shell command with optional template variables: {{file}}, {{timestamp}}",
            },
          },
        },
        additionalProperties: false,
      },
      security: {
        type: "object",
        description:
          "Security configuration for remote resource validation. Use this to restrict which hosts and protocols can be accessed when fetching remote resources.",
        properties: {
          allowedHosts: {
            type: "array",
            description:
              "List of allowed hostnames for remote resources (e.g., github.com, internal.company.com). If specified, only resources from these hosts will be allowed.",
            items: {
              type: "string",
              description: "Hostname (e.g., github.com, gitlab.com, internal.company.com)",
            },
          },
          allowedProtocols: {
            type: "array",
            description:
              "List of allowed protocols for remote resources (e.g., https, git, ssh). If specified, only resources using these protocols will be allowed.",
            items: {
              type: "string",
              description: "Protocol name (e.g., https, http, git, ssh)",
              enum: ["https", "http", "git", "ssh"],
            },
          },
        },
        additionalProperties: false,
      },
      plugins: {
        type: "array",
        description: "Plugin configurations for custom content transformations",
        items: {
          type: "object",
          required: ["name", "source"],
          properties: {
            name: {
              type: "string",
              description: "Unique name for the plugin (alphanumeric, dashes, underscores)",
              pattern: "^[a-zA-Z0-9_-]+$",
            },
            source: {
              type: "string",
              description: "Plugin source path (local file or npm package name)",
            },
            version: {
              type: "string",
              description: "Plugin version (semver format)",
              pattern: "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$",
            },
            checksum: {
              type: "string",
              description:
                "SHA256 checksum of plugin source for verification (optional 'sha256:' prefix)",
              pattern: "^(sha256:)?[a-fA-F0-9]{64}$",
            },
            timeout: {
              type: "number",
              description: "Plugin execution timeout in milliseconds (default: 30000)",
              minimum: 1,
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}
