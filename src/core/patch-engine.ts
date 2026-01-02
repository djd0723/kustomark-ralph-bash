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
import { resolveInheritance } from "./patch-inheritance.js";
import type {
  MarkdownSection,
  OnNoMatchStrategy,
  PatchOperation,
  PatchResult,
  ValidationError,
} from "./types.js";
import { validateNotContains } from "./validators.js";

/**
 * Parse markdown content to find all sections with their boundaries
 *
 * Supports:
 * - GitHub-style header slugs (auto-generated from header text)
 * - Custom IDs with {#custom-id} syntax
 *
 * @param content - The markdown content to parse
 * @returns Array of sections with their IDs and boundaries
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
 * Generate a GitHub-style slug from header text
 *
 * Rules:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens and underscores
 * - Remove leading/trailing hyphens
 *
 * @param text - The header text
 * @returns The slug
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
 * Find a section by ID
 *
 * @param sections - Array of sections
 * @param id - The section ID to find
 * @returns The section if found, undefined otherwise
 */
export function findSection(sections: MarkdownSection[], id: string): MarkdownSection | undefined {
  return sections.find((section) => section.id === id);
}

/**
 * Apply a replace patch operation
 *
 * @param content - The content to patch
 * @param old - The string to find
 * @param newStr - The string to replace with
 * @returns Object with patched content and number of replacements
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
 * Apply a replace-regex patch operation
 *
 * @param content - The content to patch
 * @param pattern - The regex pattern
 * @param replacement - The replacement string
 * @param flags - Regex flags (g, i, m, s)
 * @returns Object with patched content and number of replacements
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
 * Apply a remove-section patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to remove
 * @param includeChildren - Whether to remove child sections (default: true)
 * @returns Object with patched content and number of sections removed
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
 * Apply a replace-section patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to replace
 * @param newContent - The new content for the section
 * @returns Object with patched content and count (1 if replaced, 0 if not found)
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
 * Apply a prepend-to-section patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to prepend to
 * @param prependContent - The content to prepend
 * @returns Object with patched content and count (1 if prepended, 0 if not found)
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
 * Apply an append-to-section patch operation
 *
 * @param content - The content to patch
 * @param id - The section ID to append to
 * @param appendContent - The content to append
 * @returns Object with patched content and count (1 if appended, 0 if not found)
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

/**
 * Get a nested value from an object using dot notation
 *
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., "metadata.author")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 *
 * @param obj - Object to set value in
 * @param path - Dot-separated path (e.g., "metadata.author")
 * @param value - Value to set
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current: unknown = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!key) continue;

    const currentObj = current as Record<string, unknown>;
    if (!currentObj[key] || typeof currentObj[key] !== "object" || Array.isArray(currentObj[key])) {
      currentObj[key] = {};
    }
    current = currentObj[key];
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    (current as Record<string, unknown>)[lastKey] = value;
  }
}

/**
 * Delete a nested value from an object using dot notation
 *
 * @param obj - Object to delete value from
 * @param path - Dot-separated path (e.g., "metadata.author")
 * @returns true if the key existed and was deleted, false otherwise
 */
function deleteNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const keys = path.split(".");
  let current: unknown = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!key) continue;

    if (!current || typeof current !== "object" || !(key in (current as Record<string, unknown>))) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  const lastKey = keys[keys.length - 1];
  if (
    lastKey &&
    current &&
    typeof current === "object" &&
    lastKey in (current as Record<string, unknown>)
  ) {
    delete (current as Record<string, unknown>)[lastKey];
    return true;
  }

  return false;
}

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
  let insertAfterLine = targetSection.startLine;
  if (targetSection.startLine > sourceSection.startLine) {
    insertAfterLine -= sourceSection.endLine - sourceSection.startLine;
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
 * Apply a single patch operation to content
 *
 * @param content - The content to patch
 * @param patch - The patch operation to apply
 * @param defaultOnNoMatch - Default behavior when patch doesn't match
 * @param verbose - Whether to log verbose messages (for condition skipping)
 * @returns Object with patched content, count, optional warning, validation errors, and conditionSkipped flag
 */
export function applySinglePatch(
  content: string,
  patch: PatchOperation,
  defaultOnNoMatch: OnNoMatchStrategy = "warn",
  verbose = false,
): {
  content: string;
  count: number;
  warning?: string;
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
  let warning: string | undefined;
  if (result.count === 0) {
    const patchDesc = getPatchDescription(patch);

    if (onNoMatch === "error") {
      throw new Error(`Patch '${patchDesc}' matched 0 times`);
    }
    if (onNoMatch === "warn") {
      warning = `Patch '${patchDesc}' matched 0 times`;
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
 * Apply multiple patches to content in order
 *
 * Patches are applied sequentially, with each patch operating on the result
 * of the previous patch. Validation happens after each patch is applied.
 *
 * @param content - The content to patch
 * @param patches - Array of patch operations to apply
 * @param defaultOnNoMatch - Default behavior when patches don't match (default: 'warn')
 * @param verbose - Whether to log verbose messages (for condition skipping)
 * @returns PatchResult with patched content, count of applied patches, warnings, validation errors, and condition-skipped count
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
  const warnings: string[] = [];
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
