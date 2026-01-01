/**
 * Core patch engine for kustomark
 *
 * Implements patch operations on markdown content:
 * - String replacement (exact and regex)
 * - Section operations (remove, replace, prepend, append)
 * - GitHub-style header slug parsing
 * - Custom ID support with {#custom-id} syntax
 */

import type { MarkdownSection, OnNoMatchStrategy, PatchOperation, PatchResult } from "./types.js";

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
 * Apply a single patch operation to content
 *
 * @param content - The content to patch
 * @param patch - The patch operation to apply
 * @param defaultOnNoMatch - Default behavior when patch doesn't match
 * @returns Object with patched content, count, and optional warning
 */
export function applySinglePatch(
  content: string,
  patch: PatchOperation,
  defaultOnNoMatch: OnNoMatchStrategy = "warn",
): { content: string; count: number; warning?: string } {
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

  return {
    content: result.content,
    count: result.count,
    warning,
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
    default:
      return "unknown patch";
  }
}

/**
 * Apply multiple patches to content in order
 *
 * Patches are applied sequentially, with each patch operating on the result
 * of the previous patch.
 *
 * @param content - The content to patch
 * @param patches - Array of patch operations to apply
 * @param defaultOnNoMatch - Default behavior when patches don't match (default: 'warn')
 * @returns PatchResult with patched content, count of applied patches, and warnings
 */
export function applyPatches(
  content: string,
  patches: PatchOperation[],
  defaultOnNoMatch: OnNoMatchStrategy = "warn",
): PatchResult {
  let currentContent = content;
  let appliedCount = 0;
  const warnings: string[] = [];

  for (const patch of patches) {
    const result = applySinglePatch(currentContent, patch, defaultOnNoMatch);
    currentContent = result.content;

    if (result.count > 0) {
      appliedCount++;
    }

    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  return {
    content: currentContent,
    applied: appliedCount,
    warnings,
  };
}
