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

  "insert-section": `# insert-section

Inserts a new markdown section before or after a reference section.

**Fields:**
- \`id\` (string, required): Section ID of the reference section
- \`header\` (string, required): Header line for the new section (e.g. "## New Section")
- \`content\` (string, optional): Body content for the new section
- \`position\` (string, optional): "before" or "after" the reference section (default: "after")

**Example:**
\`\`\`yaml
- op: insert-section
  id: "installation"
  position: after
  header: "## Quick Start"
  content: |
    Run the following to get started quickly.
\`\`\`

Inserts the new section adjacent to the referenced section.`,

  "add-list-item": `# add-list-item

Adds a new item to a markdown list.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`item\` (string, required): Text of the new list item
- \`position\` (number, optional): Zero-based index at which to insert the item (default: end)

**Example:**
\`\`\`yaml
- op: add-list-item
  list: 0
  item: "New feature"
  position: 0
\`\`\`

Inserts a new item into the specified list.`,

  "remove-list-item": `# remove-list-item

Removes an item from a markdown list.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`match\` (string, optional): Exact text of the item to remove (mutually exclusive with pattern/index)
- \`pattern\` (string, optional): Regex pattern to match the item text
- \`index\` (number, optional): Zero-based index of the item to remove

**Example:**
\`\`\`yaml
- op: remove-list-item
  list: 0
  match: "Outdated item"
\`\`\`

Removes the first matching item from the list.`,

  "set-list-item": `# set-list-item

Replaces an existing list item with new text.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`index\` (number, optional): Zero-based index of the item to replace
- \`match\` (string, optional): Find the item with this exact text
- \`new\` (string, required): Replacement text for the item

**Example:**
\`\`\`yaml
- op: set-list-item
  list: 0
  index: 2
  new: "Updated item text"
\`\`\`

Replaces the targeted item with the new value.`,

  "sort-list": `# sort-list

Sorts items in a markdown list.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`direction\` (string, required): "asc" or "desc"
- \`type\` (string, optional): "string", "number", or "date" (default: "string")

**Example:**
\`\`\`yaml
- op: sort-list
  list: 0
  direction: asc
  type: string
\`\`\`

Sorts all items in the list alphabetically, numerically, or by date.`,

  "filter-list-items": `# filter-list-items

Keeps or removes list items that match a pattern.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`match\` (string, optional): Keep items whose text equals this exactly
- \`pattern\` (string, optional): Keep items whose text matches this regex
- \`invert\` (boolean, optional): When true, remove matching items instead of keeping them

**Example:**
\`\`\`yaml
- op: filter-list-items
  list: 0
  pattern: "^TODO"
  invert: true
\`\`\`

Removes or retains items based on the match condition.`,

  "deduplicate-list-items": `# deduplicate-list-items

Removes duplicate items from a markdown list.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`keep\` (string, optional): Which occurrence to keep: "first" or "last" (default: "first")

**Example:**
\`\`\`yaml
- op: deduplicate-list-items
  list: 0
  keep: first
\`\`\`

Deduplicates the list, preserving order of retained items.`,

  "reorder-list-items": `# reorder-list-items

Reorders items in a markdown list to a specified sequence.

**Fields:**
- \`list\` (number | string, required): Zero-based list index or section ID containing the list
- \`order\` (array, required): Array of zero-based indices or exact item text strings in the desired order

**Example:**
\`\`\`yaml
- op: reorder-list-items
  list: 0
  order:
    - 2
    - 0
    - 1
\`\`\`

Rearranges list items into the specified order.`,

  "modify-links": `# modify-links

Finds and modifies inline markdown links.

**Fields:**
- \`urlMatch\` (string, optional): Match links whose URL equals this exactly
- \`urlPattern\` (string, optional): Match links whose URL matches this regex
- \`textMatch\` (string, optional): Match links whose display text equals this exactly
- \`textPattern\` (string, optional): Match links whose display text matches this regex
- \`newUrl\` (string, optional): Replace the matched URL with this value
- \`urlReplacement\` (string, optional): Regex replacement string for URL (supports $1, $2)
- \`newText\` (string, optional): Replace the matched display text with this value
- \`textReplacement\` (string, optional): Regex replacement string for link text (supports $1, $2)

**Example:**
\`\`\`yaml
- op: modify-links
  urlPattern: "^http://"
  urlReplacement: "https://"
\`\`\`

Matches links by URL or text and replaces their URL, text, or both.`,

  "update-toc": `# update-toc

Regenerates a table of contents between marker comments.

**Fields:**
- \`marker\` (string, optional): Opening marker comment (default: "<!-- TOC -->")
- \`endMarker\` (string, optional): Closing marker comment (default: "<!-- /TOC -->")
- \`minLevel\` (number, optional): Minimum heading level to include (default: 2)
- \`maxLevel\` (number, optional): Maximum heading level to include (default: 4)
- \`ordered\` (boolean, optional): Use numbered list instead of bullets (default: false)
- \`indent\` (string, optional): Indentation string per heading level (default: "  ")

**Example:**
\`\`\`yaml
- op: update-toc
  minLevel: 2
  maxLevel: 3
  ordered: false
\`\`\`

Replaces the content between the TOC markers with a freshly generated TOC.`,

  "replace-in-section": `# replace-in-section

Replaces text within a specific markdown section only.

**Fields:**
- \`id\` (string, required): Section slug or custom ID to scope the replacement to
- \`old\` (string, required): Exact text to find within the section
- \`new\` (string, required): Replacement text

**Example:**
\`\`\`yaml
- op: replace-in-section
  id: "installation"
  old: "npm install"
  new: "bun install"
\`\`\`

Like \`replace\`, but only affects the content of the specified section.`,

  "replace-code-block": `# replace-code-block

Replaces the content (and optionally the language tag) of a fenced code block.

**Fields:**
- \`index\` (number, required): Zero-based index of the fenced code block to replace
- \`content\` (string, required): New body content for the code block (without the fences)
- \`language\` (string, optional): Change the language tag on the opening fence

**Example:**
\`\`\`yaml
- op: replace-code-block
  index: 0
  content: |
    console.log('updated');
  language: typescript
\`\`\`

Supports both backtick (\`\`\`) and tilde (~~~) fences. Use \`language\` only when you also want to change the syntax highlighting tag.`,

  "prepend-to-file": `# prepend-to-file

Inserts content at the very beginning of a file.

**Fields:**
- \`content\` (string, required): Content to insert before the first character of the file

**Example:**
\`\`\`yaml
- op: prepend-to-file
  content: |
    <!-- AUTO-GENERATED: do not edit -->
\`\`\`

Useful for adding headers, disclaimers, or watermarks to files.`,

  "append-to-file": `# append-to-file

Appends content at the very end of a file.

**Fields:**
- \`content\` (string, required): Content to insert after the last character of the file

**Example:**
\`\`\`yaml
- op: append-to-file
  content: |
    ---
    Generated by kustomark.
\`\`\`

Useful for footers, signatures, or auto-generation notices.`,

  "replace-table-cell": `# replace-table-cell

Replaces the value of a specific cell in a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`row\` (number, required): Zero-based row index (not counting the header row)
- \`column\` (number | string, required): Zero-based column index or the column header name
- \`content\` (string, required): The new text content for the cell

**Example:**
\`\`\`yaml
- op: replace-table-cell
  table: 0
  row: 1
  column: "Status"
  content: "Done"
\`\`\`

Replaces the targeted cell without affecting other rows or columns.`,

  "add-table-row": `# add-table-row

Adds a new row to a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`values\` (array, required): Array of cell strings for the new row
- \`position\` (number, optional): Zero-based index at which to insert the row (default: end)

**Example:**
\`\`\`yaml
- op: add-table-row
  table: 0
  values:
    - "v2.0.0"
    - "2024-01-01"
    - "Stable"
\`\`\`

Appends or inserts a row with the given cell values.`,

  "remove-table-row": `# remove-table-row

Removes a row from a markdown table by index.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`row\` (number, required): Zero-based row index of the row to remove

**Example:**
\`\`\`yaml
- op: remove-table-row
  table: 0
  row: 2
\`\`\`

Removes the specified row. All subsequent rows shift up by one.`,

  "add-table-column": `# add-table-column

Adds a new column to a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`header\` (string, required): Header text for the new column
- \`defaultValue\` (string, optional): Value to populate in existing rows for this column
- \`position\` (number, optional): Zero-based index at which to insert the column (default: end)

**Example:**
\`\`\`yaml
- op: add-table-column
  table: 0
  header: "Notes"
  defaultValue: ""
\`\`\`

Adds the column to the header row and fills existing rows with the default value.`,

  "remove-table-column": `# remove-table-column

Removes a column from a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`column\` (number | string, required): Zero-based column index or the column header name to remove

**Example:**
\`\`\`yaml
- op: remove-table-column
  table: 0
  column: "Deprecated"
\`\`\`

Removes the header and all cell values for the specified column.`,

  "sort-table": `# sort-table

Sorts rows in a markdown table by a column value.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`column\` (number | string, required): Zero-based column index or header name to sort by
- \`direction\` (string, optional): "asc" or "desc" (default: "asc")
- \`type\` (string, optional): "string", "number", or "date" (default: "string")

**Example:**
\`\`\`yaml
- op: sort-table
  table: 0
  column: "Version"
  direction: desc
  type: string
\`\`\`

Sorts all data rows; the header row is preserved in place.`,

  "rename-table-column": `# rename-table-column

Renames a column header in a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`column\` (number | string, required): Current header name or zero-based column index
- \`new\` (string, required): New header text for the column

**Example:**
\`\`\`yaml
- op: rename-table-column
  table: 0
  column: "Name"
  new: "Full Name"
\`\`\`

Only the header cell is changed; data cells are untouched.`,

  "reorder-table-columns": `# reorder-table-columns

Reorders the columns of a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`columns\` (array, required): Array of header names or zero-based indices in the desired order

**Example:**
\`\`\`yaml
- op: reorder-table-columns
  table: 0
  columns:
    - "Status"
    - "Name"
    - "Version"
\`\`\`

Rearranges all rows (header and data) to match the specified column order.`,

  "filter-table-rows": `# filter-table-rows

Keeps or removes rows in a markdown table based on a column value.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`column\` (number | string, required): Zero-based column index or header name to filter on
- \`match\` (string, optional): Keep rows where the column value equals this exactly
- \`pattern\` (string, optional): Keep rows where the column value matches this regex
- \`invert\` (boolean, optional): When true, remove matching rows instead of keeping them

**Example:**
\`\`\`yaml
- op: filter-table-rows
  table: 0
  column: "Status"
  match: "Done"
  invert: true
\`\`\`

The header row is always preserved.`,

  "deduplicate-table-rows": `# deduplicate-table-rows

Removes duplicate rows from a markdown table.

**Fields:**
- \`table\` (number | string, required): Zero-based table index or section ID containing the table
- \`column\` (number | string, optional): Deduplicate based on this column only (default: entire row)
- \`keep\` (string, optional): Keep "first" or "last" occurrence of each duplicate (default: "first")

**Example:**
\`\`\`yaml
- op: deduplicate-table-rows
  table: 0
  column: "Name"
  keep: first
\`\`\`

The header row is always preserved.`,

  exec: `# exec

Executes an arbitrary shell command as a patch step.

**Fields:**
- \`command\` (string, required): The shell command to execute
- \`timeout\` (number, optional): Maximum execution time in milliseconds (default: 30000)

**Example:**
\`\`\`yaml
- op: exec
  command: "node scripts/update-version.js"
  timeout: 10000
\`\`\`

The command runs in the working directory of the kustomark config file.`,

  plugin: `# plugin

Invokes a registered kustomark plugin.

**Fields:**
- \`plugin\` (string, required): The registered name of the plugin to invoke
- \`params\` (object, optional): Key-value map of parameters to pass to the plugin

**Example:**
\`\`\`yaml
- op: plugin
  plugin: "my-transform"
  params:
    mode: strict
    output: html
\`\`\`

Plugins extend kustomark with custom transformation logic.`,

  "json-set": `# json-set

Sets a value at a dot-notation path in a JSON file.

**Fields:**
- \`path\` (string, required): Dot-notation path to the key (e.g. "config.version")
- \`value\` (any, required): The value to assign at the path

**Example:**
\`\`\`yaml
- op: json-set
  path: "version"
  value: "2.0.0"
  include: "package.json"
\`\`\`

Creates intermediate objects as needed. Overwrites existing values.`,

  "json-delete": `# json-delete

Deletes a key at a dot-notation path from a JSON file.

**Fields:**
- \`path\` (string, required): Dot-notation path to the key to delete (e.g. "config.debug")

**Example:**
\`\`\`yaml
- op: json-delete
  path: "scripts.pretest"
  include: "package.json"
\`\`\`

Removes the key and its value. No-ops silently if the path does not exist.`,

  "json-merge": `# json-merge

Deep-merges an object into a JSON file.

**Fields:**
- \`value\` (object, required): Key-value object to deep-merge into the JSON file
- \`path\` (string, optional): Dot-notation path to merge into a sub-object instead of root

**Example:**
\`\`\`yaml
- op: json-merge
  value:
    scripts:
      lint: "eslint ."
  include: "package.json"
\`\`\`

Existing keys not present in value are preserved.`,
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
- \`contains\`: Ensure result includes this string
- \`notContains\`: Ensure result doesn't contain this string
- \`matchesRegex\`: Ensure result matches this regex pattern
- \`notMatchesRegex\`: Ensure result does not match this regex pattern
- \`frontmatterRequired\`: Ensure result has these frontmatter keys (array of strings)
- \`minWordCount\`: Minimum number of words in the result (integer)
- \`maxWordCount\`: Maximum number of words in the result (integer)
- \`minLineCount\`: Minimum number of lines in the result (integer)
- \`maxLineCount\`: Maximum number of lines in the result (integer)

**Example:**
\`\`\`yaml
- op: replace
  old: "npm install"
  new: "bun install"
  validate:
    contains: "bun"
    notMatchesRegex: "npm"
    minWordCount: 10
\`\`\`

Validates that the patch was successfully applied.`,

  when: `# when

Apply this patch only when the condition evaluates to true for the current file.

**Type:** condition object
**Required:** No

**Condition types:**

- \`fileContains\`: Match if file content contains a string
  \`\`\`yaml
  when:
    type: fileContains
    value: "production"
  \`\`\`

- \`fileMatches\`: Match if file content matches a regex pattern
  \`\`\`yaml
  when:
    type: fileMatches
    pattern: "/v\\\\d+\\\\.\\\\d+/"
  \`\`\`

- \`frontmatterEquals\`: Match if a frontmatter field equals a value
  \`\`\`yaml
  when:
    type: frontmatterEquals
    key: "status"
    value: "draft"
  \`\`\`

- \`frontmatterExists\`: Match if a frontmatter key exists
  \`\`\`yaml
  when:
    type: frontmatterExists
    key: "tags"
  \`\`\`

- \`not\`: Negate another condition
  \`\`\`yaml
  when:
    type: not
    condition:
      type: fileContains
      value: "SKIP"
  \`\`\`

- \`anyOf\`: Match if any sub-condition matches (logical OR)
  \`\`\`yaml
  when:
    type: anyOf
    conditions:
      - type: fileContains
        value: "production"
      - type: frontmatterEquals
        key: "env"
        value: "prod"
  \`\`\`

- \`allOf\`: Match if all sub-conditions match (logical AND)
  \`\`\`yaml
  when:
    type: allOf
    conditions:
      - type: fileContains
        value: "production"
      - type: frontmatterExists
        key: "title"
  \`\`\``,
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
