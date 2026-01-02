/**
 * Template Manager Module
 *
 * Handles template discovery, loading, and metadata for kustomark templates.
 * Templates are pre-configured kustomark setups that help users get started quickly.
 */

/**
 * Template metadata
 */
export interface TemplateMetadata {
  /** Unique identifier for the template */
  id: string;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;
  /** Template source (built-in or user) */
  source: "built-in" | "user";
  /** Tags for categorization */
  tags: string[];
  /** List of files in this template */
  files: string[];
}

/**
 * Template file content
 */
export interface TemplateFile {
  /** Relative path within the template */
  path: string;
  /** File content */
  content: string;
}

/**
 * Complete template with metadata and files
 */
export interface Template {
  /** Template metadata */
  metadata: TemplateMetadata;
  /** Template files */
  files: TemplateFile[];
}

/**
 * Template source location info
 */
export interface TemplateSource {
  /** Template ID */
  id: string;
  /** Source type */
  source: "built-in" | "user";
  /** Absolute path to template directory */
  path: string;
}

/**
 * Error thrown when template operations fail
 */
export class TemplateError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TemplateError";
    this.code = code;
  }
}

/**
 * Built-in template definitions
 * These are hard-coded templates that ship with kustomark
 */
const BUILTIN_TEMPLATES: Record<string, TemplateMetadata> = {
  base: {
    id: "base",
    name: "Base Configuration",
    description: "Simple base configuration for markdown processing",
    source: "built-in",
    tags: ["starter", "base"],
    files: ["kustomark.yaml", "README.md"],
  },
  overlay: {
    id: "overlay",
    name: "Overlay Configuration",
    description: "Overlay configuration that extends a base",
    source: "built-in",
    tags: ["starter", "overlay"],
    files: ["kustomark.yaml"],
  },
  "upstream-fork": {
    id: "upstream-fork",
    name: "Upstream Fork",
    description: "Track and customize upstream documentation",
    source: "built-in",
    tags: ["git", "fork", "upstream"],
    files: ["kustomark.yaml", "README.md"],
  },
  "doc-pipeline": {
    id: "doc-pipeline",
    name: "Documentation Pipeline",
    description: "Multi-stage documentation build pipeline",
    source: "built-in",
    tags: ["pipeline", "multi-stage"],
    files: [
      "base/kustomark.yaml",
      "staging/kustomark.yaml",
      "production/kustomark.yaml",
      "README.md",
    ],
  },
};

/**
 * Get built-in template content
 * These are the actual file contents for built-in templates
 */
function getBuiltinTemplateFiles(templateId: string): TemplateFile[] {
  switch (templateId) {
    case "base":
      return [
        {
          path: "kustomark.yaml",
          content: `apiVersion: kustomark/v1
kind: Kustomization

# Define which files to process
resources:
  - "*.md"

# Optional: Add patches to transform content
# patches:
#   - op: replace
#     old: "old text"
#     new: "new text"
`,
        },
        {
          path: "README.md",
          content: `# Kustomark Project

This is a base kustomark configuration.

## Usage

\`\`\`bash
# Build the project
kustomark build .

# Watch for changes
kustomark watch .
\`\`\`

## Configuration

Edit \`kustomark.yaml\` to customize:
- Add resource patterns
- Define patches to transform content
- Configure validators

See the [kustomark documentation](https://github.com/yourusername/kustomark) for more details.
`,
        },
      ];

    case "overlay":
      return [
        {
          path: "kustomark.yaml",
          content: `apiVersion: kustomark/v1
kind: Kustomization

# Reference base configuration
resources:
  - ../base

# Add overlay-specific patches
patches:
  - op: replace
    old: "{{OLD_VALUE}}"
    new: "{{NEW_VALUE}}"
`,
        },
      ];

    case "upstream-fork":
      return [
        {
          path: "kustomark.yaml",
          content: `apiVersion: kustomark/v1
kind: Kustomization

# Fetch from upstream Git repository
resources:
  - "https://github.com/{{ORG}}/{{REPO}}.git//docs?ref={{REF}}"

# Customize upstream content
patches:
  # Add your organization's branding
  - op: set-frontmatter
    key: organization
    value: "{{YOUR_ORG}}"

  # Update contact information
  - op: replace
    old: "support@example.com"
    new: "{{SUPPORT_EMAIL}}"

# Security: only allow specific hosts
security:
  allowedHosts:
    - github.com
  allowedProtocols:
    - https
`,
        },
        {
          path: "README.md",
          content: `# Upstream Fork

This configuration tracks upstream documentation from a Git repository and applies customizations.

## Setup

1. Edit \`kustomark.yaml\`:
   - Replace \`{{ORG}}\` with the upstream organization
   - Replace \`{{REPO}}\` with the repository name
   - Replace \`{{REF}}\` with the branch/tag to track
   - Update patches with your customizations

2. Build the documentation:
   \`\`\`bash
   kustomark build . --output ./docs
   \`\`\`

3. Lock dependencies for reproducible builds:
   \`\`\`bash
   kustomark build . --lock
   \`\`\`

## Updating Upstream

To update to the latest version from upstream:

\`\`\`bash
kustomark build . --update-lock
\`\`\`

## Variables to Replace

- \`{{ORG}}\` - Upstream organization name
- \`{{REPO}}\` - Repository name
- \`{{REF}}\` - Git reference (branch/tag/commit)
- \`{{YOUR_ORG}}\` - Your organization name
- \`{{SUPPORT_EMAIL}}\` - Your support email
`,
        },
      ];

    case "doc-pipeline":
      return [
        {
          path: "base/kustomark.yaml",
          content: `apiVersion: kustomark/v1
kind: Kustomization

# Base documentation
resources:
  - "*.md"

# Common patches for all environments
patches:
  - op: set-frontmatter
    key: version
    value: "{{VERSION}}"
`,
        },
        {
          path: "staging/kustomark.yaml",
          content: `apiVersion: kustomark/v1
kind: Kustomization

# Extend base configuration
resources:
  - ../base

# Staging-specific patches
patches:
  - op: set-frontmatter
    key: environment
    value: "staging"

  - op: prepend-to-section
    id: installation
    content: |
      > **Staging Environment**: This documentation is for staging.
`,
        },
        {
          path: "production/kustomark.yaml",
          content: `apiVersion: kustomark/v1
kind: Kustomization

# Extend base configuration
resources:
  - ../base

# Production-specific patches
patches:
  - op: set-frontmatter
    key: environment
    value: "production"

  # Remove debug sections
  - op: remove-section
    id: debugging
    include: "**/*.md"
`,
        },
        {
          path: "README.md",
          content: `# Documentation Pipeline

Multi-stage documentation build pipeline with base, staging, and production environments.

## Structure

\`\`\`
base/           - Common documentation and patches
staging/        - Staging-specific overlay
production/     - Production-specific overlay
\`\`\`

## Usage

Build for different environments:

\`\`\`bash
# Staging
kustomark build staging/ --output ./dist/staging

# Production
kustomark build production/ --output ./dist/production
\`\`\`

## Variables to Replace

- \`{{VERSION}}\` - Documentation version number
`,
        },
      ];

    default:
      throw new TemplateError(`Unknown built-in template: ${templateId}`, "UNKNOWN_TEMPLATE");
  }
}

/**
 * Template Manager
 * Handles template discovery, loading, and metadata
 */
export class TemplateManager {
  /**
   * List all available templates
   * For now, only returns built-in templates
   *
   * @returns Array of template metadata
   */
  async listTemplates(): Promise<TemplateMetadata[]> {
    // Currently only built-in templates are supported
    return Object.values(BUILTIN_TEMPLATES);
  }

  /**
   * Get a specific template by ID
   *
   * @param id - Template identifier
   * @returns Complete template with metadata and files
   * @throws TemplateError if template not found
   */
  async getTemplate(id: string): Promise<Template> {
    // Check built-in templates
    const metadata = BUILTIN_TEMPLATES[id];
    if (!metadata) {
      throw new TemplateError(`Template not found: ${id}`, "TEMPLATE_NOT_FOUND");
    }

    // Load template files
    const files = getBuiltinTemplateFiles(id);

    return {
      metadata,
      files,
    };
  }

  /**
   * Get template source location information
   *
   * @param id - Template identifier
   * @returns Template source info
   * @throws TemplateError if template not found
   */
  async getTemplateSource(id: string): Promise<TemplateSource> {
    // Check if template exists
    const metadata = BUILTIN_TEMPLATES[id];
    if (!metadata) {
      throw new TemplateError(`Template not found: ${id}`, "TEMPLATE_NOT_FOUND");
    }

    return {
      id,
      source: "built-in",
      path: "<built-in>", // Built-in templates don't have a file path
    };
  }

  /**
   * Check if a template exists
   *
   * @param id - Template identifier
   * @returns True if template exists
   */
  async hasTemplate(id: string): Promise<boolean> {
    return id in BUILTIN_TEMPLATES;
  }
}
