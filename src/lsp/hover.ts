/**
 * Hover provider for Kustomark YAML files
 *
 * Provides rich documentation when hovering over:
 * - Root-level fields
 * - Patch operation types
 * - Common patch fields
 * - Enum values
 */

import { type Hover, MarkupKind, type Position, type TextDocument } from "vscode-languageserver";

/**
 * Documentation for all patch operations
 */
const OPERATION_DOCS: Record<string, string> = {
  replace: `# replace

Simple string replacement operation.

**Fields:**
- \`old\` (string, required): Exact string to find
- \`new\` (string, required): Replacement string

**Example:**
\`\`\`yaml
- op: replace
  old: "TODO"
  new: "DONE"
  include: "*.md"
\`\`\`

Replaces all instances of the old string with the new string.`,

  "replace-regex": `# replace-regex

Regex-based replacement operation with pattern matching.

**Fields:**
- \`pattern\` (string, required): Regular expression pattern
- \`replacement\` (string, required): Replacement string (can use capture groups)
- \`flags\` (string, optional): Regex flags (g=global, i=case-insensitive, m=multiline, s=dotall)

**Example:**
\`\`\`yaml
- op: replace-regex
  pattern: "v\\\\d+\\\\.\\\\d+\\\\.\\\\d+"
  replacement: "v2.0.0"
  flags: "g"
\`\`\`

Supports capture groups in replacement: \`$1\`, \`$2\`, etc.`,

  "remove-section": `# remove-section

Removes a markdown section by ID.

**Fields:**
- \`id\` (string, required): Section ID (GitHub-style slug or explicit {#custom-id})
- \`includeChildren\` (boolean, optional): Whether to include child sections (default: true)

**Example:**
\`\`\`yaml
- op: remove-section
  id: "deprecated-section"
  includeChildren: true
\`\`\`

Removes the entire section including its header and content.`,

  "replace-section": `# replace-section

Replaces the content of a markdown section.

**Fields:**
- \`id\` (string, required): Section ID (GitHub-style slug or explicit {#custom-id})
- \`content\` (string, required): New content for the section

**Example:**
\`\`\`yaml
- op: replace-section
  id: "installation"
  content: |
    ## Installation
    Run: npm install my-package
\`\`\`

Replaces the entire section including the header.`,

  "prepend-to-section": `# prepend-to-section

Adds content to the beginning of a section (after the header).

**Fields:**
- \`id\` (string, required): Section ID (GitHub-style slug or explicit {#custom-id})
- \`content\` (string, required): Content to prepend

**Example:**
\`\`\`yaml
- op: prepend-to-section
  id: "getting-started"
  content: |
    > **Note:** This is a beta feature.
\`\`\`

Inserts content right after the section header.`,

  "append-to-section": `# append-to-section

Adds content to the end of a section.

**Fields:**
- \`id\` (string, required): Section ID (GitHub-style slug or explicit {#custom-id})
- \`content\` (string, required): Content to append

**Example:**
\`\`\`yaml
- op: append-to-section
  id: "examples"
  content: |
    See also: [Advanced Guide](./advanced.md)
\`\`\`

Inserts content at the end of the section, before any subsections.`,

  "set-frontmatter": `# set-frontmatter

Sets or updates a frontmatter field.

**Fields:**
- \`key\` (string, required): Frontmatter field name
- \`value\` (any, required): Value to set

**Example:**
\`\`\`yaml
- op: set-frontmatter
  key: "author"
  value: "John Doe"
\`\`\`

Creates the field if it doesn't exist, updates it if it does.`,

  "remove-frontmatter": `# remove-frontmatter

Removes a field from frontmatter.

**Fields:**
- \`key\` (string, required): Frontmatter field name to remove

**Example:**
\`\`\`yaml
- op: remove-frontmatter
  key: "draft"
\`\`\`

Removes the specified field from the document's frontmatter.`,

  "rename-frontmatter": `# rename-frontmatter

Renames a frontmatter field.

**Fields:**
- \`old\` (string, required): Current field name
- \`new\` (string, required): New field name

**Example:**
\`\`\`yaml
- op: rename-frontmatter
  old: "date"
  new: "publishDate"
\`\`\`

Preserves the value while changing the field name.`,

  "merge-frontmatter": `# merge-frontmatter

Merges multiple key-value pairs into frontmatter.

**Fields:**
- \`values\` (object, required): Key-value pairs to merge

**Example:**
\`\`\`yaml
- op: merge-frontmatter
  values:
    author: "Jane Doe"
    tags: ["tutorial", "guide"]
    version: 2.0
\`\`\`

Merges all provided values into the frontmatter, overwriting existing keys.`,

  "delete-between": `# delete-between

Deletes content between two marker strings.

**Fields:**
- \`start\` (string, required): Start marker string
- \`end\` (string, required): End marker string
- \`inclusive\` (boolean, optional): Include marker lines in deletion (default: true)

**Example:**
\`\`\`yaml
- op: delete-between
  start: "<!-- BEGIN AUTO-GENERATED -->"
  end: "<!-- END AUTO-GENERATED -->"
  inclusive: true
\`\`\`

Deletes everything between (and including) the markers.`,

  "replace-between": `# replace-between

Replaces content between two marker strings.

**Fields:**
- \`start\` (string, required): Start marker string
- \`end\` (string, required): End marker string
- \`content\` (string, required): Replacement content
- \`inclusive\` (boolean, optional): Include markers in replacement (default: true)

**Example:**
\`\`\`yaml
- op: replace-between
  start: "<!-- VERSION -->"
  end: "<!-- /VERSION -->"
  content: "Version: 2.0.0"
  inclusive: false
\`\`\`

Replaces content between markers, optionally preserving the markers.`,

  "replace-line": `# replace-line

Replaces entire lines that match exactly.

**Fields:**
- \`match\` (string, required): Exact line to match
- \`replacement\` (string, required): Replacement line

**Example:**
\`\`\`yaml
- op: replace-line
  match: "status: draft"
  replacement: "status: published"
\`\`\`

Matches the entire line (whitespace included) and replaces it.`,

  "insert-after-line": `# insert-after-line

Inserts content after a matching line.

**Fields:**
- \`match\` (string, optional): Exact string to match (mutually exclusive with pattern)
- \`pattern\` (string, optional): Regex pattern to match (mutually exclusive with match)
- \`regex\` (boolean, optional): Whether pattern is a regex (default: false)
- \`content\` (string, required): Content to insert

**Example:**
\`\`\`yaml
- op: insert-after-line
  match: "## Installation"
  content: |
    > Prerequisites: Node.js 18+
\`\`\`

Inserts content on a new line after the matching line.`,

  "insert-before-line": `# insert-before-line

Inserts content before a matching line.

**Fields:**
- \`match\` (string, optional): Exact string to match (mutually exclusive with pattern)
- \`pattern\` (string, optional): Regex pattern to match (mutually exclusive with match)
- \`regex\` (boolean, optional): Whether pattern is a regex (default: false)
- \`content\` (string, required): Content to insert

**Example:**
\`\`\`yaml
- op: insert-before-line
  pattern: "^##\\\\s+License"
  regex: true
  content: |
    ## Contributors
    Thanks to all contributors!
\`\`\`

Inserts content on a new line before the matching line.`,

  "move-section": `# move-section

Moves a markdown section to after another section.

**Fields:**
- \`id\` (string, required): Section ID to move
- \`after\` (string, required): Section ID to move after

**Example:**
\`\`\`yaml
- op: move-section
  id: "troubleshooting"
  after: "installation"
\`\`\`

Moves the entire section (including children) to a new position.`,

  "rename-header": `# rename-header

Renames a section header while preserving its level.

**Fields:**
- \`id\` (string, required): Section ID
- \`new\` (string, required): New header text

**Example:**
\`\`\`yaml
- op: rename-header
  id: "getting-started"
  new: "Quick Start Guide"
\`\`\`

Changes the header text while keeping the same heading level (# count).`,

  "change-section-level": `# change-section-level

Changes the heading level of a section.

**Fields:**
- \`id\` (string, required): Section ID
- \`delta\` (number, required): Level change (-1 to promote, +1 to demote)

**Example:**
\`\`\`yaml
- op: change-section-level
  id: "advanced-topics"
  delta: -1
\`\`\`

Adjusts heading level: -1 promotes (### → ##), +1 demotes (## → ###).`,

  "copy-file": `# copy-file

Copy a file from source to destination.

**Fields:**
- \`src\` (string, required): Source file path
- \`dest\` (string, required): Destination file path

**Example:**
\`\`\`yaml
- op: copy-file
  src: "README.md"
  dest: "docs/README.md"
\`\`\`

Creates a copy of the source file at the destination path.`,

  "rename-file": `# rename-file

Rename files matching a pattern.

**Fields:**
- \`match\` (string, required): Pattern to match files
- \`rename\` (string, required): New name pattern

**Example:**
\`\`\`yaml
- op: rename-file
  match: "*.draft.md"
  rename: "*.md"
\`\`\`

Renames all files matching the pattern.`,

  "delete-file": `# delete-file

Delete files matching a pattern.

**Fields:**
- \`match\` (string, required): Pattern to match files to delete

**Example:**
\`\`\`yaml
- op: delete-file
  match: "*.tmp.md"
\`\`\`

Deletes all files matching the pattern.`,

  "move-file": `# move-file

Move files to a destination directory.

**Fields:**
- \`match\` (string, required): Pattern to match files to move
- \`dest\` (string, required): Destination directory path

**Example:**
\`\`\`yaml
- op: move-file
  match: "*.draft.md"
  dest: "drafts/"
\`\`\`

Moves all matching files to the destination directory.`,
};

/**
 * Documentation for root-level fields
 */
const ROOT_FIELD_DOCS: Record<string, string> = {
  apiVersion: `# apiVersion

The API version for the Kustomark configuration file.

**Type:** string
**Required:** Yes
**Value:** Must be \`"kustomark/v1"\`

**Example:**
\`\`\`yaml
apiVersion: "kustomark/v1"
\`\`\``,

  kind: `# kind

The kind of resource being defined.

**Type:** string
**Required:** Yes
**Value:** Must be \`"Kustomization"\`

**Example:**
\`\`\`yaml
kind: "Kustomization"
\`\`\``,

  output: `# output

The directory where processed markdown files will be written.

**Type:** string
**Required:** For build command
**Default:** None

**Example:**
\`\`\`yaml
output: "./dist"
\`\`\`

All processed files maintain their directory structure relative to this output directory.`,

  resources: `# resources

List of resource patterns, file paths, or kustomark configs to process.

**Type:** array of strings
**Required:** Yes

**Examples:**
\`\`\`yaml
resources:
  - "docs/**/*.md"
  - "./templates/README.md"
  - "github.com/org/repo//docs?ref=main"
  - "kustomization.yaml"
\`\`\`

Supports:
- Glob patterns
- File paths
- Git URLs with refs
- HTTP archive URLs
- Other kustomark configs (for composition)`,

  patches: `# patches

Ordered list of patch operations to apply to resources.

**Type:** array of patch objects
**Required:** No
**Default:** []

**Example:**
\`\`\`yaml
patches:
  - op: replace
    old: "v1.0.0"
    new: "v2.0.0"
  - op: remove-section
    id: "deprecated"
\`\`\`

Each patch requires an \`op\` field specifying the operation type.
Patches are applied in order, and later patches see the results of earlier ones.`,

  validators: `# validators

Global validation rules to run on all processed resources.

**Type:** array of validator objects
**Required:** No
**Default:** []

**Example:**
\`\`\`yaml
validators:
  - name: "no-todos"
    notContains: "TODO"
  - name: "required-frontmatter"
    frontmatterRequired: ["title", "author"]
\`\`\`

Validators fail the build if any resource violates the rules.`,

  onNoMatch: `# onNoMatch

Default strategy for handling patches that don't match any content.

**Type:** string
**Required:** No
**Default:** "skip"
**Values:** \`skip\`, \`warn\`, \`error\`

- \`skip\`: Silently skip patches that don't match
- \`warn\`: Show a warning for patches that don't match
- \`error\`: Fail the build if patches don't match

**Example:**
\`\`\`yaml
onNoMatch: warn
\`\`\`

Can be overridden per-patch using the same field.`,
};

/**
 * Documentation for common patch fields
 */
const PATCH_FIELD_DOCS: Record<string, string> = {
  op: `# op

The type of patch operation to perform.

**Type:** string
**Required:** Yes

**Available operations:**
- Text: \`replace\`, \`replace-regex\`, \`replace-line\`
- Sections: \`remove-section\`, \`replace-section\`, \`prepend-to-section\`, \`append-to-section\`
- Section manipulation: \`move-section\`, \`rename-header\`, \`change-section-level\`
- Frontmatter: \`set-frontmatter\`, \`remove-frontmatter\`, \`rename-frontmatter\`, \`merge-frontmatter\`
- Markers: \`delete-between\`, \`replace-between\`
- Lines: \`insert-after-line\`, \`insert-before-line\`
- File operations: \`copy-file\`, \`rename-file\`, \`delete-file\`, \`move-file\`

**Example:**
\`\`\`yaml
- op: replace
  old: "foo"
  new: "bar"
\`\`\``,

  id: `# id

Unique identifier for this patch, used for inheritance.

**Type:** string
**Required:** No

**Example:**
\`\`\`yaml
- id: "base-replacement"
  op: replace
  old: "foo"
  new: "bar"
\`\`\`

Other patches can extend this patch using the \`extends\` field.`,

  extends: `# extends

Inherit configuration from one or more patches.

**Type:** string | array of strings
**Required:** No

**Examples:**
\`\`\`yaml
# Single parent
- extends: "base-replacement"
  op: replace
  include: "README.md"

# Multiple parents
- extends: ["base-config", "extra-rules"]
  op: replace
\`\`\`

Child patches inherit all fields from parent patches, and can override them.`,

  include: `# include

Glob pattern(s) to include specific files.

**Type:** string | array of strings
**Required:** No

**Examples:**
\`\`\`yaml
# Single pattern
include: "docs/**/*.md"

# Multiple patterns
include:
  - "*.md"
  - "!internal.md"
\`\`\`

Only files matching these patterns will be affected by this patch.
Supports negation patterns with \`!\` prefix.`,

  exclude: `# exclude

Glob pattern(s) to exclude specific files.

**Type:** string | array of strings
**Required:** No

**Examples:**
\`\`\`yaml
# Single pattern
exclude: "internal/**"

# Multiple patterns
exclude:
  - "*.draft.md"
  - "temp/**"
\`\`\`

Files matching these patterns will not be affected by this patch.
Applied after \`include\` filtering.`,

  onNoMatch: `# onNoMatch (patch-level)

Override the default strategy for this specific patch when it doesn't match.

**Type:** string
**Required:** No
**Values:** \`skip\`, \`warn\`, \`error\`

- \`skip\`: Silently skip if this patch doesn't match
- \`warn\`: Show a warning if this patch doesn't match
- \`error\`: Fail the build if this patch doesn't match

**Example:**
\`\`\`yaml
- op: replace
  old: "critical-text"
  new: "new-text"
  onNoMatch: error  # Must match or build fails
\`\`\``,

  group: `# group

Optional group name for selective patch application.

**Type:** string
**Required:** No

**Example:**
\`\`\`yaml
- op: replace
  old: "dev"
  new: "prod"
  group: "production"
\`\`\`

Can be used with the \`--groups\` CLI flag to selectively apply patches:
\`\`\`bash
kustomark build --groups production
\`\`\``,

  validate: `# validate

Per-patch validation rules to run after applying this patch.

**Type:** object
**Required:** No

**Fields:**
- \`notContains\`: Ensure result doesn't contain this string

**Example:**
\`\`\`yaml
- op: replace
  old: "password123"
  new: "***"
  validate:
    notContains: "password123"
\`\`\`

Validates that the patch was successfully applied.`,
};

/**
 * Provides hover documentation for Kustomark YAML files
 */
export class HoverProvider {
  /**
   * Provide hover information at the given position
   */
  provideHover(document: TextDocument, position: Position): Hover | null {
    const text = document.getText();
    const lines = text.split("\n");
    const currentLine = lines[position.line] || "";

    // Get the word at the cursor position
    const wordRange = this.getWordRangeAtPosition(currentLine, position.character);
    if (!wordRange) {
      return null;
    }

    const word = currentLine.substring(wordRange.start, wordRange.end);

    // Check if it's a field name (has : after it)
    const isField = currentLine.substring(wordRange.end).trim().startsWith(":");

    // Check if it's a value (comes after :)
    const beforeWord = currentLine.substring(0, wordRange.start);
    const isValue = beforeWord.includes(":");

    // Try to get documentation
    let documentation: string | null = null;

    if (isField) {
      // Check root-level fields
      documentation = ROOT_FIELD_DOCS[word] ?? null;

      // Check patch-level fields if not found
      if (!documentation) {
        documentation = PATCH_FIELD_DOCS[word] ?? null;
      }
    } else if (isValue) {
      // Check if it's an operation value
      documentation = OPERATION_DOCS[word] ?? null;

      // Check if it's an onNoMatch value
      if (!documentation && ["skip", "warn", "error"].includes(word)) {
        documentation = this.getOnNoMatchValueDoc(word);
      }
    }

    if (!documentation) {
      return null;
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: documentation,
      },
    };
  }

  /**
   * Get the range of a word at the given character position
   */
  private getWordRangeAtPosition(
    line: string,
    character: number,
  ): { start: number; end: number } | null {
    // Find word boundaries (alphanumeric, hyphens, underscores)
    const wordRegex = /[\w-]+/g;
    let match: RegExpExecArray | null = wordRegex.exec(line);

    while (match !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (start <= character && character <= end) {
        return { start, end };
      }

      match = wordRegex.exec(line);
    }

    return null;
  }

  /**
   * Get documentation for onNoMatch values
   */
  private getOnNoMatchValueDoc(value: string): string {
    const docs: Record<string, string> = {
      skip: `# skip

Skip patches that don't match without any notification.

Use this when patches are optional and it's acceptable for them not to match.`,

      warn: `# warn

Show a warning when patches don't match.

Use this when patches should match but it's not critical if they don't.
The build will continue but warnings will be visible in the output.`,

      error: `# error

Fail the build when patches don't match.

Use this when patches must match for the build to be valid.
The build will stop with an error if any patch doesn't match.`,
    };

    return docs[value] || "";
  }
}
