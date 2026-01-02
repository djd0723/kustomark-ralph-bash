/**
 * Core patch engine for kustomark
 *
 * Implements patch operations on markdown content:
 * - String replacement (exact and regex)
 * - Section operations (remove, replace, prepend, append)
 * - Frontmatter operations (set, remove, rename, merge)
 * - GitHub-style header slug parsing
 * - Custom ID support with {#custom-id} syntax
 */

import * as yaml from "js-yaml";
import { evaluateCondition } from "./condition-evaluator.js";
import { deleteNestedValue, getNestedValue, setNestedValue } from "./nested-values.js";
import { resolveInheritance } from "./patch-inheritance.js";
import { generatePatchSuggestions } from "./suggestion-engine.js";
import type {
  MarkdownSection,
  OnNoMatchStrategy,
  PatchOperation,
  PatchResult,
  ValidationError,
  ValidationWarning,
} from "./types.js";
import { validateNotContains } from "./validators.js";

/**
 * Parse markdown content to find all sections with their boundaries.
 *
 * This function identifies all markdown headers (levels 1-6) and creates section
 * objects that include the header ID, level, and line boundaries. It supports both
 * GitHub-style auto-generated slugs and custom IDs using the {#custom-id} syntax.
 *
 * Section boundaries are determined by finding the next header at the same or higher
 * level (lower number). Child sections (higher level numbers) are included within
 * their parent section's boundaries.
 *
 * @param content - The markdown content to parse
 * @returns Array of sections with their IDs, levels, and line boundaries
 *
 * @example
 * ```typescript
 * const markdown = `# Introduction
 * Some intro text
 *
 * ## Getting Started {#start}
 * Setup instructions
 *
 * # Usage
 * Usage details`;
 *
 * const sections = parseSections(markdown);
 * // Returns:
 * // [
 * //   { id: 'introduction', level: 1, startLine: 0, endLine: 5, headerText: '# Introduction' },
 * //   { id: 'start', level: 2, startLine: 3, endLine: 5, headerText: '## Getting Started {#start}' },
 * //   { id: 'usage', level: 1, startLine: 5, endLine: 7, headerText: '# Usage' }
 * // ]
 * ```
 */
export function parseSections(content: string): MarkdownSection[] {
  const lines = content.split("\n");
  const sections: MarkdownSection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Match markdown headers (# to ######)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (!headerMatch) continue;

    const hashMarks = headerMatch[1];
    const textPart = headerMatch[2];
    if (!hashMarks || !textPart) continue;

    const level = hashMarks.length;
    let headerText = textPart.trim();
    let id: string;

    // Check for custom ID syntax: {#custom-id}
    const customIdMatch = headerText.match(/\{#([a-zA-Z0-9_-]+)\}\s*$/);
    if (customIdMatch?.[1]) {
      id = customIdMatch[1];
      // Remove the custom ID from header text
      headerText = headerText.replace(/\s*\{#[a-zA-Z0-9_-]+\}\s*$/, "").trim();
    } else {
      // Generate GitHub-style slug
      id = generateSlug(headerText);
    }

    sections.push({
      id,
      level,
      startLine: i,
      endLine: -1, // Will be set when we find the next header or end
      headerText: line,
    });
  }

  // Set end boundaries for each section
  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i];
    if (!currentSection) continue;

    // Find the next section at the same or higher level
    let endLine = lines.length;
    for (let j = i + 1; j < sections.length; j++) {
      const nextSection = sections[j];
      if (!nextSection) continue;
      if (nextSection.level <= currentSection.level) {
        endLine = nextSection.startLine;
        break;
      }
    }

    currentSection.endLine = endLine;
  }

  return sections;
}

/**
 * Generate a GitHub-style slug from header text.
 *
 * This function converts header text into a URL-friendly slug following GitHub's
 * markdown anchor link conventions. The slug can be used as a section ID for
 * linking and patch operations.
 *
 * Transformation rules:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens and underscores
 * - Collapse multiple consecutive hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @param text - The header text to convert into a slug
 * @returns The generated slug
 *
 * @example
 * ```typescript
 * generateSlug('Getting Started')
 * // Returns: 'getting-started'
 *
 * generateSlug('API Reference (v2.0)')
 * // Returns: 'api-reference-v20'
 *
 * generateSlug('  Multiple   Spaces  ')
 * // Returns: 'multiple-spaces'
 * ```
 */
export function generateSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      // Replace spaces with hyphens
      .replace(/\s+/g, "-")
      // Remove special characters except hyphens and underscores
      .replace(/[^a-z0-9_-]/g, "")
      // Remove multiple consecutive hyphens
      .replace(/-+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Find a section by ID within an array of parsed sections.
 *
 * This is a utility function that searches for a section with a matching ID.
 * IDs can be either auto-generated slugs or custom IDs defined in the markdown.
 *
 * @param sections - Array of sections to search through
 * @param id - The section ID to find (case-sensitive)
 * @returns The matching section if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const sections = parseSections(markdown);
 * const section = findSection(sections, 'getting-started');
 *
 * if (section) {
 *   console.log(`Found section at line ${section.startLine}`);
 * }
 * ```
 */
export function findSection(sections: MarkdownSection[], id: string): MarkdownSection | undefined {
  return sections.find((section) => section.id === id);
}

/**
 * Apply a replace patch operation using exact string matching.
 *
 * This function replaces all occurrences of an exact string with a new string.
 * The search is case-sensitive and matches the literal text without any special
 * character interpretation. All occurrences in the content are replaced.
 *
 * @param content - The content to patch
 * @param old - The exact string to find and replace
 * @param newStr - The string to replace with
 * @returns Object with patched content and the number of replacements made
 *
 * @example
 * ```typescript
 * const content = 'Hello world! Hello everyone!';
 * const result = applyReplace(content, 'Hello', 'Hi');
 * console.log(result.content); // 'Hi world! Hi everyone!'
 * console.log(result.count);   // 2
 * ```
 */
export function applyReplace(
  content: string,
  old: string,
  newStr: string,
): { content: string; count: number } {
  let count = 0;
  let result = content;

  // Count occurrences
  const escaped = old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "g");
  const matches = content.match(regex);
  count = matches ? matches.length : 0;

  // Replace all occurrences
  if (count > 0) {
    result = content.split(old).join(newStr);
  }

  return { content: result, count };
}

/**
 * Apply a replace-regex patch operation using regular expressions.
 *
 * This function replaces text matching a regular expression pattern with a replacement
 * string. The replacement string can include special regex replacement patterns like
 * $1, $2 for captured groups. The global flag is automatically added to ensure all
 * matches are replaced and counted.
 *
 * @param content - The content to patch
 * @param pattern - The regex pattern to match (as a string)
 * @param replacement - The replacement string (supports regex capture groups like $1, $2)
 * @param flags - Optional regex flags (i for case-insensitive, m for multiline, s for dotall). The 'g' flag is automatically added.
 * @returns Object with patched content and the number of replacements made
 *
 * @example
 * ```typescript
 * // Simple pattern matching
 * const content = 'Error: File not found\nWarning: Deprecated API';
 * const result = applyReplaceRegex(content, 'Error|Warning', 'Notice');
 * console.log(result.content); // 'Notice: File not found\nNotice: Deprecated API'
 * console.log(result.count);   // 2
 *
 * // Using capture groups
 * const content2 = 'v1.0.0 and v2.5.3';
 * const result2 = applyReplaceRegex(content2, 'v(\\d+\\.\\d+\\.\\d+)', 'version $1');
 * console.log(result2.content); // 'version 1.0.0 and version 2.5.3'
 * ```
 *
 * @throws {SyntaxError} If the regex pattern is invalid
 */
export function applyReplaceRegex(
  content: string,
  pattern: string,
  replacement: string,
  flags?: string,
): { content: string; count: number } {
  // Ensure global flag is set for counting
  const flagsWithGlobal = flags?.includes("g") ? flags : `${flags || ""}g`;
  const regex = new RegExp(pattern, flagsWithGlobal);

  const matches = content.match(regex);
  const count = matches ? matches.length : 0;

  const result = content.replace(regex, replacement);

  return { content: result, count };
}

/**
 * Apply a remove-section patch operation to delete a markdown section.
 *
 * This function removes a markdown section (header and content) identified by its ID.
 * By default, it also removes all child sections (subsections). If includeChildren is
 * false, only the content up to the first child section is removed, preserving the
 * child sections.
 *
 * @param content - The markdown content to patch
 * @param id - The section ID to remove (slug or custom ID)
 * @param includeChildren - Whether to remove child sections along with the parent (default: true)
 * @returns Object with patched content and count (1 if removed, 0 if section not found)
 *
 * @example
 * ```typescript
 * const markdown = `# Introduction
 * Intro text
 *
 * ## Getting Started
 * Setup info
 *
 * # Usage
 * Usage info`;
 *
 * // Remove section with children
 * const result1 = applyRemoveSection(markdown, 'introduction', true);
 * // Removes "# Introduction" and "## Getting Started"
 *
 * // Remove section without children
 * const result2 = applyRemoveSection(markdown, 'introduction', false);
 * // Removes only "# Introduction" header and "Intro text", keeps "## Getting Started"
 * ```
 */
export function applyRemoveSection(
  content: string,
  id: string,
  includeChildren = true,
): { content: string; count: number } {
  const sections = parseSections(content);
  const section = findSection(sections, id);

  if (!section) {
    return { content, count: 0 };
  }

  const lines = content.split("\n");
  const startLine = section.startLine;
  let endLine = section.endLine;

  if (!includeChildren) {
    // Only remove until the first child section
    for (let i = startLine + 1; i < section.endLine; i++) {
      const line = lines[i];
      if (!line) continue;
      const headerMatch = line.match(/^(#{1,6})\s+/);
      const hashMarks = headerMatch?.[1];
      if (hashMarks && hashMarks.length > section.level) {
        endLine = i;
        break;
      }
    }
  }

  // Remove the section lines
  lines.splice(startLine, endLine - startLine);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a replace-section patch operation to replace a section's content.
 *
 * This function replaces the content of a markdown section while keeping its header.
 * The section header itself is preserved, but all content from after the header up to
 * the next section (or end of document) is replaced with the new content. Child sections
 * are removed.
 *
 * @param content - The markdown content to patch
 * @param id - The section ID to find (slug or custom ID)
 * @param newContent - The new content to insert after the header
 * @returns Object with patched content and count (1 if replaced, 0 if section not found)
 *
 * @example
 * ```typescript
 * const markdown = `# Installation
 * Old installation steps
 *
 * ## Prerequisites
 * Old prereqs
 *
 * # Usage
 * Usage info`;
 *
 * const result = applyReplaceSection(markdown, 'installation', 'New installation steps\n');
 * // Result:
 * // # Installation
 * // New installation steps
 * //
 * // # Usage
 * // Usage info
 * ```
 */
export function applyReplaceSection(
  content: string,
  id: string,
  newContent: string,
): { content: string; count: number } {
  const sections = parseSections(content);
  const section = findSection(sections, id);

  if (!section) {
    return { content, count: 0 };
  }

  const lines = content.split("\n");

  // Keep the header line, replace everything after until the next section
  const contentStartLine = section.startLine + 1;
  const contentEndLine = section.endLine;

  // Remove old content (but keep the header)
  lines.splice(contentStartLine, contentEndLine - contentStartLine);

  // Insert new content after the header
  const newContentLines = newContent.split("\n");
  lines.splice(contentStartLine, 0, ...newContentLines);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a prepend-to-section patch operation to add content at the start of a section.
 *
 * This function inserts new content immediately after the section header, before any
 * existing content. The section header is preserved, and all existing content is pushed
 * down.
 *
 * @param content - The markdown content to patch
 * @param id - The section ID to prepend to (slug or custom ID)
 * @param prependContent - The content to insert at the beginning of the section
 * @returns Object with patched content and count (1 if prepended, 0 if section not found)
 *
 * @example
 * ```typescript
 * const markdown = `# Installation
 * Follow these steps:
 *
 * 1. Download
 * 2. Install`;
 *
 * const result = applyPrependToSection(
 *   markdown,
 *   'installation',
 *   '**Note:** Requires Node.js 18+\n\n'
 * );
 * // Result:
 * // # Installation
 * // **Note:** Requires Node.js 18+
 * //
 * // Follow these steps:
 * //
 * // 1. Download
 * // 2. Install
 * ```
 */
export function applyPrependToSection(
  content: string,
  id: string,
  prependContent: string,
): { content: string; count: number } {
  const sections = parseSections(content);
  const section = findSection(sections, id);

  if (!section) {
    return { content, count: 0 };
  }

  const lines = content.split("\n");
  const insertLine = section.startLine + 1;

  const prependLines = prependContent.split("\n");
  lines.splice(insertLine, 0, ...prependLines);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply an append-to-section patch operation to add content at the end of a section.
 *
 * This function inserts new content at the end of a section, right before the next
 * section header (or end of document). The content is inserted after all existing
 * content in the section.
 *
 * @param content - The markdown content to patch
 * @param id - The section ID to append to (slug or custom ID)
 * @param appendContent - The content to insert at the end of the section
 * @returns Object with patched content and count (1 if appended, 0 if section not found)
 *
 * @example
 * ```typescript
 * const markdown = `# Installation
 * Download and install the package.
 *
 * # Usage
 * Run the application.`;
 *
 * const result = applyAppendToSection(
 *   markdown,
 *   'installation',
 *   '\n**Tip:** Use --verbose for detailed output.\n'
 * );
 * // Result:
 * // # Installation
 * // Download and install the package.
 * //
 * // **Tip:** Use --verbose for detailed output.
 * //
 * // # Usage
 * // Run the application.
 * ```
 */
export function applyAppendToSection(
  content: string,
  id: string,
  appendContent: string,
): { content: string; count: number } {
  const sections = parseSections(content);
  const section = findSection(sections, id);

  if (!section) {
    return { content, count: 0 };
  }

  const lines = content.split("\n");
  const insertLine = section.endLine;

  const appendLines = appendContent.split("\n");
  lines.splice(insertLine, 0, ...appendLines);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Parse frontmatter from markdown content
 *
 * @param content - The markdown content
 * @returns Object with frontmatter data, body content, and whether frontmatter exists
 */
export function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
} {
  const lines = content.split("\n");

  // Check if content starts with ---
  if (lines[0] !== "---") {
    return { data: {}, body: content, hasFrontmatter: false };
  }

  // Find the closing ---
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    // No closing delimiter found
    return { data: {}, body: content, hasFrontmatter: false };
  }

  // Extract frontmatter YAML
  const frontmatterLines = lines.slice(1, closingIndex);
  const frontmatterYaml = frontmatterLines.join("\n");

  // Parse YAML
  let data: Record<string, unknown> = {};
  try {
    const parsed = yaml.load(frontmatterYaml);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // If YAML parsing fails, treat as no frontmatter
    return { data: {}, body: content, hasFrontmatter: false };
  }

  // Get body content (everything after closing ---)
  const body = lines.slice(closingIndex + 1).join("\n");

  return { data, body, hasFrontmatter: true };
}

/**
 * Serialize frontmatter and body back to markdown
 *
 * @param data - Frontmatter data object
 * @param body - Body content
 * @returns Complete markdown content with frontmatter
 */
export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  const frontmatterYaml = yaml.dump(data, { lineWidth: -1, noRefs: true });
  return `---\n${frontmatterYaml}---\n${body}`;
}

// Nested value operations are now imported from nested-values.ts

/**
 * Apply a set-frontmatter patch operation
 *
 * @param content - The content to patch
 * @param key - The frontmatter key (supports dot notation)
 * @param value - The value to set
 * @returns Object with patched content and count (1 if set, 0 if no frontmatter and creation failed)
 */
export function applySetFrontmatter(
  content: string,
  key: string,
  value: unknown,
): { content: string; count: number } {
  const { data, body } = parseFrontmatter(content);

  // Set the value using dot notation
  setNestedValue(data, key, value);

  // Serialize back
  const result = serializeFrontmatter(data, body);

  return { content: result, count: 1 };
}

/**
 * Apply a remove-frontmatter patch operation
 *
 * @param content - The content to patch
 * @param key - The frontmatter key to remove (supports dot notation)
 * @returns Object with patched content and count (1 if removed, 0 if key didn't exist)
 */
export function applyRemoveFrontmatter(
  content: string,
  key: string,
): { content: string; count: number } {
  const { data, body, hasFrontmatter } = parseFrontmatter(content);

  if (!hasFrontmatter) {
    return { content, count: 0 };
  }

  // Try to delete the key
  const deleted = deleteNestedValue(data, key);

  if (!deleted) {
    return { content, count: 0 };
  }

  // If data is now empty, remove frontmatter entirely
  if (Object.keys(data).length === 0) {
    return { content: body, count: 1 };
  }

  // Serialize back
  const result = serializeFrontmatter(data, body);

  return { content: result, count: 1 };
}

/**
 * Apply a rename-frontmatter patch operation
 *
 * @param content - The content to patch
 * @param oldKey - The old frontmatter key
 * @param newKey - The new frontmatter key
 * @returns Object with patched content and count (1 if renamed, 0 if old key didn't exist)
 */
export function applyRenameFrontmatter(
  content: string,
  oldKey: string,
  newKey: string,
): { content: string; count: number } {
  const { data, body, hasFrontmatter } = parseFrontmatter(content);

  if (!hasFrontmatter) {
    return { content, count: 0 };
  }

  // Get the value at oldKey
  const value = getNestedValue(data, oldKey);

  if (value === undefined) {
    return { content, count: 0 };
  }

  // Delete old key and set new key
  deleteNestedValue(data, oldKey);
  setNestedValue(data, newKey, value);

  // Serialize back
  const result = serializeFrontmatter(data, body);

  return { content: result, count: 1 };
}

/**
 * Apply a merge-frontmatter patch operation
 *
 * @param content - The content to patch
 * @param values - Key-value pairs to merge into frontmatter
 * @returns Object with patched content and count (1 if merged, 0 otherwise)
 */
export function applyMergeFrontmatter(
  content: string,
  values: Record<string, unknown>,
): { content: string; count: number } {
  const { data, body } = parseFrontmatter(content);

  // Merge values into data
  for (const [key, value] of Object.entries(values)) {
    setNestedValue(data, key, value);
  }

  // Serialize back
  const result = serializeFrontmatter(data, body);

  return { content: result, count: 1 };
}

/**
 * Apply a delete-between patch operation
 *
 * @param content - The content to patch
 * @param start - The start marker string
 * @param end - The end marker string
 * @param inclusive - Whether to include the marker lines (default: true)
 * @returns Object with patched content and count (1 if deleted, 0 if markers not found)
 */
export function applyDeleteBetween(
  content: string,
  start: string,
  end: string,
  inclusive = true,
): { content: string; count: number } {
  const lines = content.split("\n");

  // Find first occurrence of start marker
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.includes(start)) {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) {
    return { content, count: 0 };
  }

  // Find end marker after start marker
  let endLine = -1;
  for (let i = startLine + 1; i < lines.length; i++) {
    if (lines[i]?.includes(end)) {
      endLine = i;
      break;
    }
  }

  if (endLine === -1) {
    return { content, count: 0 };
  }

  // Determine what to delete based on inclusive flag
  const deleteStart = inclusive ? startLine : startLine + 1;
  const deleteEnd = inclusive ? endLine + 1 : endLine;

  // Delete the lines
  lines.splice(deleteStart, deleteEnd - deleteStart);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a replace-between patch operation
 *
 * @param content - The content to patch
 * @param start - The start marker string
 * @param end - The end marker string
 * @param newContent - The replacement content
 * @param inclusive - Whether to include the marker lines (default: true)
 * @returns Object with patched content and count (1 if replaced, 0 if markers not found)
 */
export function applyReplaceBetween(
  content: string,
  start: string,
  end: string,
  newContent: string,
  inclusive = true,
): { content: string; count: number } {
  const lines = content.split("\n");

  // Find first occurrence of start marker
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.includes(start)) {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) {
    return { content, count: 0 };
  }

  // Find end marker after start marker
  let endLine = -1;
  for (let i = startLine + 1; i < lines.length; i++) {
    if (lines[i]?.includes(end)) {
      endLine = i;
      break;
    }
  }

  if (endLine === -1) {
    return { content, count: 0 };
  }

  // Determine what to replace based on inclusive flag
  const replaceStart = inclusive ? startLine : startLine + 1;
  const replaceEnd = inclusive ? endLine + 1 : endLine;

  // Replace the lines with new content
  const newContentLines = newContent.split("\n");
  lines.splice(replaceStart, replaceEnd - replaceStart, ...newContentLines);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a replace-line patch operation
 *
 * @param content - The content to patch
 * @param match - The exact line content to match
 * @param replacement - The replacement line content
 * @returns Object with patched content and number of lines replaced
 */
export function applyReplaceLine(
  content: string,
  match: string,
  replacement: string,
): { content: string; count: number } {
  const lines = content.split("\n");
  let count = 0;

  // Replace all lines that match exactly
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === match) {
      lines[i] = replacement;
      count++;
    }
  }

  return { content: lines.join("\n"), count };
}

/**
 * Apply an insert-after-line patch operation
 *
 * @param content - The content to patch
 * @param match - Exact string to match (mutually exclusive with pattern)
 * @param pattern - Regex pattern to match (mutually exclusive with match)
 * @param regex - Whether pattern is a regex
 * @param insertContent - Content to insert after the matching line
 * @returns Object with patched content and number of insertions
 */
export function applyInsertAfterLine(
  content: string,
  match: string | undefined,
  pattern: string | undefined,
  regex: boolean | undefined,
  insertContent: string,
): { content: string; count: number } {
  const lines = content.split("\n");
  let count = 0;
  const result: string[] = [];

  for (const line of lines) {
    result.push(line);

    // Check if this line matches
    let isMatch = false;
    if (match !== undefined) {
      // Exact string matching
      isMatch = line === match;
    } else if (pattern !== undefined && regex) {
      // Regex matching
      const regexPattern = new RegExp(pattern);
      isMatch = regexPattern.test(line);
    }

    if (isMatch) {
      count++;
      // Insert content after this line
      const insertLines = insertContent.split("\n");
      result.push(...insertLines);
    }
  }

  return { content: result.join("\n"), count };
}

/**
 * Apply an insert-before-line patch operation
 *
 * @param content - The content to patch
 * @param match - Exact string to match (mutually exclusive with pattern)
 * @param pattern - Regex pattern to match (mutually exclusive with match)
 * @param regex - Whether pattern is a regex
 * @param insertContent - Content to insert before the matching line
 * @returns Object with patched content and number of insertions
 */
export function applyInsertBeforeLine(
  content: string,
  match: string | undefined,
  pattern: string | undefined,
  regex: boolean | undefined,
  insertContent: string,
): { content: string; count: number } {
  const lines = content.split("\n");
  let count = 0;
  const result: string[] = [];

  for (const line of lines) {
    // Check if this line matches
    let isMatch = false;
    if (match !== undefined) {
      // Exact string matching
      isMatch = line === match;
    } else if (pattern !== undefined && regex) {
      // Regex matching
      const regexPattern = new RegExp(pattern);
      isMatch = regexPattern.test(line);
    }

    if (isMatch) {
      count++;
      // Insert content before this line
      const insertLines = insertContent.split("\n");
      result.push(...insertLines);
    }

    result.push(line);
  }

  return { content: result.join("\n"), count };
}

/**
 * Apply a rename-header patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to find
 * @param newHeaderText - The new header text
 * @returns Object with patched content and count (1 if renamed, 0 if not found)
 */
export function applyRenameHeader(
  content: string,
  id: string,
  newHeaderText: string,
): { content: string; count: number } {
  const sections = parseSections(content);
  const section = findSection(sections, id);

  if (!section) {
    return { content, count: 0 };
  }

  const lines = content.split("\n");
  const headerLine = lines[section.startLine];

  if (!headerLine) {
    return { content, count: 0 };
  }

  // Extract the header level (# symbols)
  const headerMatch = headerLine.match(/^(#{1,6})\s+/);
  if (!headerMatch?.[1]) {
    return { content, count: 0 };
  }

  const hashMarks = headerMatch[1];

  // Create the new header line (handle empty string case)
  lines[section.startLine] = newHeaderText ? `${hashMarks} ${newHeaderText}` : hashMarks;

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a move-section patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to move
 * @param afterId - The section ID to move after
 * @returns Object with patched content and count (1 if moved, 0 if not found)
 */
export function applyMoveSection(
  content: string,
  id: string,
  afterId: string,
): { content: string; count: number } {
  const sections = parseSections(content);
  const sourceSection = findSection(sections, id);
  const targetSection = findSection(sections, afterId);

  // Return early if either section not found
  if (!sourceSection || !targetSection) {
    return { content, count: 0 };
  }

  // Handle edge case: trying to move a section after itself
  if (id === afterId) {
    return { content, count: 0 };
  }

  // Check if moving a section after one of its descendants or itself
  // This would create an invalid structure
  if (
    targetSection.startLine >= sourceSection.startLine &&
    targetSection.startLine < sourceSection.endLine
  ) {
    // Target is a child of source - invalid move
    return { content, count: 0 };
  }

  const lines = content.split("\n");

  // Extract the source section (including all children)
  const sectionLines = lines.slice(sourceSection.startLine, sourceSection.endLine);

  // Remove source section from its current position
  lines.splice(sourceSection.startLine, sourceSection.endLine - sourceSection.startLine);

  // Recalculate target position after removal
  // If target was after source, its position shifted up
  let _insertAfterLine = targetSection.startLine;
  if (targetSection.startLine > sourceSection.startLine) {
    _insertAfterLine -= sourceSection.endLine - sourceSection.startLine;
  }

  // Find the end of the target section after the removal
  // Need to re-parse to get accurate boundaries
  const tempContent = lines.join("\n");
  const updatedSections = parseSections(tempContent);
  const updatedTarget = findSection(updatedSections, afterId);

  if (!updatedTarget) {
    // This shouldn't happen, but handle it gracefully
    return { content, count: 0 };
  }

  // Insert the section after the target section's end
  lines.splice(updatedTarget.endLine, 0, ...sectionLines);

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a change-section-level patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to find
 * @param delta - The level change (negative to promote, positive to demote)
 * @returns Object with patched content and count (1 if changed, 0 if not found)
 */
export function applyChangeSectionLevel(
  content: string,
  id: string,
  delta: number,
): { content: string; count: number } {
  const sections = parseSections(content);
  const section = findSection(sections, id);

  if (!section) {
    return { content, count: 0 };
  }

  const lines = content.split("\n");
  const headerLine = lines[section.startLine];

  if (!headerLine) {
    return { content, count: 0 };
  }

  // Extract the header level (# symbols) and text
  const headerMatch = headerLine.match(/^(#{1,6})\s+(.*)$/);
  if (!headerMatch?.[1]) {
    return { content, count: 0 };
  }

  const currentLevel = headerMatch[1].length;
  const headerText = headerMatch[2] || "";

  // Calculate new level and clamp to valid range (1-6)
  const newLevel = Math.max(1, Math.min(6, currentLevel + delta));

  // If level didn't actually change (due to clamping or zero delta), still count as success
  const newHashMarks = "#".repeat(newLevel);

  // Create the new header line (handle empty text case)
  lines[section.startLine] = headerText ? `${newHashMarks} ${headerText}` : newHashMarks;

  return { content: lines.join("\n"), count: 1 };
}

/**
 * Apply a single patch operation to content.
 *
 * This function applies one patch operation to the provided content. It handles:
 * - Conditional execution based on the patch's 'when' condition
 * - Per-patch validation after application
 * - No-match handling strategies (warn, error, skip)
 * - Generation of helpful suggestions when patches fail to match
 *
 * If a patch has a 'when' condition that is not met, the patch is skipped and the
 * content is returned unchanged. Validation is only performed if the patch actually
 * modifies the content (count > 0).
 *
 * @param content - The content to patch
 * @param patch - The patch operation to apply
 * @param defaultOnNoMatch - Default behavior when patch doesn't match: 'warn' (default), 'error', or 'skip'
 * @param verbose - Whether to log verbose messages to console (for condition skipping)
 * @returns Object containing the patched content, count of changes, optional warning, validation errors, and conditionSkipped flag
 *
 * @example
 * ```typescript
 * const content = 'Hello world';
 * const patch: PatchOperation = {
 *   op: 'replace',
 *   old: 'world',
 *   new: 'kustomark'
 * };
 *
 * const result = applySinglePatch(content, patch);
 * console.log(result.content); // 'Hello kustomark'
 * console.log(result.count);   // 1
 * console.log(result.conditionSkipped); // false
 * ```
 *
 * @example
 * ```typescript
 * // Example with condition
 * const patch: PatchOperation = {
 *   op: 'replace',
 *   old: 'foo',
 *   new: 'bar',
 *   when: { contains: 'special' }
 * };
 *
 * const result = applySinglePatch('normal content', patch);
 * // Patch is skipped because content doesn't contain 'special'
 * console.log(result.conditionSkipped); // true
 * console.log(result.count); // 0
 * ```
 *
 * @throws {Error} If the patch operation type is unknown or if onNoMatch is 'error' and the patch doesn't match
 */
export function applySinglePatch(
  content: string,
  patch: PatchOperation,
  defaultOnNoMatch: OnNoMatchStrategy = "warn",
  verbose = false,
): {
  content: string;
  count: number;
  warning?: ValidationWarning;
  validationErrors: ValidationError[];
  conditionSkipped: boolean;
} {
  // Check if patch has a condition
  if (patch.when) {
    const conditionMet = evaluateCondition(content, patch.when);
    if (!conditionMet) {
      // Condition not met - skip patch
      if (verbose) {
        const patchDesc = getPatchDescription(patch);
        console.log(`Skipping patch '${patchDesc}' due to condition not being met`);
      }
      return {
        content,
        count: 0,
        validationErrors: [],
        conditionSkipped: true,
      };
    }
  }

  const onNoMatch = patch.onNoMatch ?? defaultOnNoMatch;
  let result: { content: string; count: number };

  switch (patch.op) {
    case "replace":
      result = applyReplace(content, patch.old, patch.new);
      break;

    case "replace-regex":
      result = applyReplaceRegex(content, patch.pattern, patch.replacement, patch.flags);
      break;

    case "remove-section":
      result = applyRemoveSection(content, patch.id, patch.includeChildren);
      break;

    case "replace-section":
      result = applyReplaceSection(content, patch.id, patch.content);
      break;

    case "prepend-to-section":
      result = applyPrependToSection(content, patch.id, patch.content);
      break;

    case "append-to-section":
      result = applyAppendToSection(content, patch.id, patch.content);
      break;

    case "set-frontmatter":
      result = applySetFrontmatter(content, patch.key, patch.value);
      break;

    case "remove-frontmatter":
      result = applyRemoveFrontmatter(content, patch.key);
      break;

    case "rename-frontmatter":
      result = applyRenameFrontmatter(content, patch.old, patch.new);
      break;

    case "merge-frontmatter":
      result = applyMergeFrontmatter(content, patch.values);
      break;

    case "delete-between":
      result = applyDeleteBetween(content, patch.start, patch.end, patch.inclusive);
      break;

    case "replace-between":
      result = applyReplaceBetween(content, patch.start, patch.end, patch.content, patch.inclusive);
      break;

    case "replace-line":
      result = applyReplaceLine(content, patch.match, patch.replacement);
      break;

    case "insert-after-line":
      result = applyInsertAfterLine(
        content,
        patch.match,
        patch.pattern,
        patch.regex,
        patch.content,
      );
      break;

    case "insert-before-line":
      result = applyInsertBeforeLine(
        content,
        patch.match,
        patch.pattern,
        patch.regex,
        patch.content,
      );
      break;

    case "rename-header":
      result = applyRenameHeader(content, patch.id, patch.new);
      break;

    case "move-section":
      result = applyMoveSection(content, patch.id, patch.after);
      break;

    case "change-section-level":
      result = applyChangeSectionLevel(content, patch.id, patch.delta);
      break;

    case "copy-file":
    case "rename-file":
    case "delete-file":
    case "move-file":
      // File operations should be processed by the file operations engine, not the patch engine
      throw new Error(
        `File operation '${patch.op}' should be processed by the file operations engine, not the patch engine`,
      );

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = patch;
      throw new Error(`Unknown patch operation: ${(_exhaustive as PatchOperation).op}`);
    }
  }

  // Handle no-match scenarios
  let warning: ValidationWarning | undefined;
  if (result.count === 0) {
    const patchDesc = getPatchDescription(patch);
    const errorMsg = `Patch '${patchDesc}' matched 0 times`;

    if (onNoMatch === "error") {
      throw new Error(errorMsg);
    }
    if (onNoMatch === "warn") {
      // Generate intelligent suggestions for the failed patch
      const suggestions = generatePatchSuggestions(patch, content, errorMsg);
      warning = {
        message: errorMsg,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    }
    // 'skip' - no warning or error
  }

  // Run per-patch validation if specified
  const validationErrors: ValidationError[] = [];
  if (patch.validate && result.count > 0) {
    // Only validate if the patch was actually applied
    const patchDesc = getPatchDescription(patch);

    // Check notContains validation
    if (patch.validate.notContains !== undefined) {
      const isValid = validateNotContains(result.content, patch.validate.notContains);
      if (!isValid) {
        validationErrors.push({
          message: `Patch '${patchDesc}' validation failed: content contains forbidden pattern '${patch.validate.notContains}'`,
        });
      }
    }
  }

  return {
    content: result.content,
    count: result.count,
    warning,
    validationErrors,
    conditionSkipped: false,
  };
}

/**
 * Get a human-readable description of a patch for warnings/errors
 *
 * @param patch - The patch operation
 * @returns A description string
 */
function getPatchDescription(patch: PatchOperation): string {
  switch (patch.op) {
    case "replace":
      return `replace '${patch.old}' with '${patch.new}'`;
    case "replace-regex":
      return `replace-regex '${patch.pattern}'`;
    case "remove-section":
      return `remove-section '${patch.id}'`;
    case "replace-section":
      return `replace-section '${patch.id}'`;
    case "prepend-to-section":
      return `prepend-to-section '${patch.id}'`;
    case "append-to-section":
      return `append-to-section '${patch.id}'`;
    case "set-frontmatter":
      return `set-frontmatter '${patch.key}'`;
    case "remove-frontmatter":
      return `remove-frontmatter '${patch.key}'`;
    case "rename-frontmatter":
      return `rename-frontmatter '${patch.old}' to '${patch.new}'`;
    case "merge-frontmatter":
      return "merge-frontmatter";
    case "delete-between":
      return `delete-between '${patch.start}' and '${patch.end}'`;
    case "replace-between":
      return `replace-between '${patch.start}' and '${patch.end}'`;
    case "replace-line":
      return `replace-line '${patch.match}'`;
    case "insert-after-line":
      return `insert-after-line ${patch.match ? `'${patch.match}'` : `pattern '${patch.pattern}'`}`;
    case "insert-before-line":
      return `insert-before-line ${patch.match ? `'${patch.match}'` : `pattern '${patch.pattern}'`}`;
    case "rename-header":
      return `rename-header '${patch.id}' to '${patch.new}'`;
    case "move-section":
      return `move-section '${patch.id}' after '${patch.after}'`;
    case "change-section-level":
      return `change-section-level '${patch.id}' by ${patch.delta}`;
    case "copy-file":
      return `copy-file '${patch.src}' to '${patch.dest}'`;
    case "rename-file":
      return `rename-file match='${patch.match}' rename='${patch.rename}'`;
    case "delete-file":
      return `delete-file match='${patch.match}'`;
    case "move-file":
      return `move-file match='${patch.match}' to '${patch.dest}'`;
    default:
      return "unknown patch";
  }
}

/**
 * Apply multiple patches to content in order.
 *
 * This is the main entry point for applying a series of patch operations to content.
 * Patches are applied sequentially, with each patch operating on the result of the
 * previous patch. This function handles:
 * - Patch inheritance resolution (extends field)
 * - Sequential application of all patches
 * - Collection of warnings for patches that don't match
 * - Collection of validation errors
 * - Tracking of condition-skipped patches
 *
 * The function first resolves any patch inheritance (patches with 'extends' fields),
 * then applies each patch in order. Validation happens after each patch is applied,
 * and any validation errors are collected and returned.
 *
 * @param content - The initial content to patch
 * @param patches - Array of patch operations to apply in order
 * @param defaultOnNoMatch - Default behavior when patches don't match: 'warn' (default), 'error', or 'skip'
 * @param verbose - Whether to log verbose messages to console (for condition skipping)
 * @returns PatchResult object with the final patched content, count of successfully applied patches,
 *          array of warnings, array of validation errors, and count of condition-skipped patches
 *
 * @example
 * ```typescript
 * const content = `# Introduction
 * Welcome to the guide.
 *
 * # Installation
 * Install steps here.`;
 *
 * const patches: PatchOperation[] = [
 *   {
 *     op: 'replace',
 *     old: 'guide',
 *     new: 'documentation'
 *   },
 *   {
 *     op: 'append-to-section',
 *     id: 'installation',
 *     content: '\nRun: npm install'
 *   }
 * ];
 *
 * const result = applyPatches(content, patches);
 * console.log(result.applied); // 2
 * console.log(result.warnings.length); // 0
 * console.log(result.validationErrors.length); // 0
 * ```
 *
 * @example
 * ```typescript
 * // Example with validation errors
 * const patches: PatchOperation[] = [
 *   {
 *     op: 'replace',
 *     old: 'foo',
 *     new: 'bar',
 *     validate: {
 *       notContains: 'baz'
 *     }
 *   }
 * ];
 *
 * const result = applyPatches('foo and baz', patches);
 * console.log(result.validationErrors.length); // 1 (because result contains 'baz')
 * ```
 *
 * @throws {Error} If any patch operation is unknown or if a patch with onNoMatch='error' doesn't match
 */
export function applyPatches(
  content: string,
  patches: PatchOperation[],
  defaultOnNoMatch: OnNoMatchStrategy = "warn",
  verbose = false,
): PatchResult {
  // Resolve inheritance before applying patches
  const resolvedPatches = resolveInheritance(patches);

  let currentContent = content;
  let appliedCount = 0;
  let conditionSkippedCount = 0;
  const warnings: ValidationWarning[] = [];
  const validationErrors: ValidationError[] = [];

  for (const patch of resolvedPatches) {
    const result = applySinglePatch(currentContent, patch, defaultOnNoMatch, verbose);
    currentContent = result.content;

    if (result.conditionSkipped) {
      conditionSkippedCount++;
    } else if (result.count > 0) {
      appliedCount++;
    }

    if (result.warning) {
      warnings.push(result.warning);
    }

    // Collect validation errors from per-patch validation
    if (result.validationErrors.length > 0) {
      validationErrors.push(...result.validationErrors);
    }
  }

  return {
    content: currentContent,
    applied: appliedCount,
    warnings,
    validationErrors,
    conditionSkipped: conditionSkippedCount,
  };
}
