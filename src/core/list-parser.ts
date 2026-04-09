/**
 * List parser for kustomark
 *
 * Handles parsing of GitHub Flavored Markdown lists:
 * - Parse all lists in markdown content (unordered and ordered)
 * - Track line boundaries for top-level items including sub-items
 * - Support task list items ([ ] unchecked, [x]/[X] checked)
 * - Find lists by zero-based index or by section ID
 */

/**
 * The type of a markdown list
 */
export type ListType = "unordered" | "ordered";

/**
 * A single top-level item in a markdown list
 */
export interface ListItem {
  /** Content after the bullet marker (and after the task checkbox prefix if isTask) */
  text: string;
  /** Whether this item is a task list item */
  isTask: boolean;
  /** Whether the task checkbox is checked (always false when isTask is false) */
  checked: boolean;
}

/**
 * A parsed markdown list with its boundaries and structure
 */
export interface MarkdownList {
  /** Start line index (inclusive) of the list */
  startLine: number;
  /** End line index (inclusive) of the list */
  endLine: number;
  /** Whether this is an ordered or unordered list */
  type: ListType;
  /** The bullet style of the first item, e.g. "- ", "* ", "1. " */
  bullet: string;
  /** Top-level items only */
  items: ListItem[];
  /** Line ranges for each top-level item (inclusive on both ends) */
  itemRanges: Array<{ startLine: number; endLine: number }>;
}

/** Regex matching an unordered list marker at column 0 */
const UNORDERED_MARKER = /^([-*+]) /;

/** Regex matching an ordered list marker at column 0 */
const ORDERED_MARKER = /^(\d+)\. /;

/**
 * Determine if a line is a top-level list marker matching the given list type.
 *
 * For unordered lists, any of `- `, `* `, `+ ` qualify.
 * For ordered lists, `\d+. ` qualifies.
 *
 * @param line - The line to test
 * @param type - The list type to match against
 * @returns true if the line starts a new top-level item of the given type
 */
function isTopLevelMarker(line: string, type: ListType): boolean {
  if (type === "unordered") {
    return UNORDERED_MARKER.test(line);
  }
  return ORDERED_MARKER.test(line);
}

/**
 * Extract the bullet string from the first line of a list.
 *
 * @param line - The first line of the list
 * @param type - The list type
 * @returns The bullet string (e.g. "- ", "* ", "1. ") or empty string if not matched
 */
function extractBullet(line: string, type: ListType): string {
  if (type === "unordered") {
    const m = line.match(UNORDERED_MARKER);
    return m ? `${m[1]} ` : "";
  }
  const m = line.match(ORDERED_MARKER);
  return m ? `${m[1]}. ` : "";
}

/**
 * Parse the text after the bullet marker into a ListItem.
 *
 * Detects task list syntax: `[ ] ` (unchecked) or `[x] ` / `[X] ` (checked).
 *
 * @param afterBullet - The content on the line after the bullet marker has been stripped
 * @returns A fully populated ListItem
 */
function parseItemText(afterBullet: string): ListItem {
  // Unchecked task: "[ ] text"
  if (afterBullet.startsWith("[ ] ")) {
    return { text: afterBullet.slice(4), isTask: true, checked: false };
  }
  // Checked task: "[x] text" or "[X] text"
  if (afterBullet.startsWith("[x] ") || afterBullet.startsWith("[X] ")) {
    return { text: afterBullet.slice(4), isTask: true, checked: true };
  }
  return { text: afterBullet, isTask: false, checked: false };
}

/**
 * Parse all lists from markdown content.
 *
 * Identifies every unordered and ordered list block, recording top-level items
 * and the line ranges each item spans (including continuation lines and sub-items).
 *
 * Rules:
 * - A list starts at a line matching a list marker at column 0.
 * - A blank line (empty or whitespace-only) ends the current list.
 * - A line starting with `#` (header) ends the current list.
 * - Top-level items are lines at column 0 that match the list type (unordered
 *   accepts any of `- `, `* `, `+ `; ordered accepts `\d+. `).
 * - All other non-terminating lines (indented lines or unrecognized starters)
 *   are treated as continuation/sub-item lines belonging to the current item.
 *
 * @param content - The markdown content to parse
 * @returns Array of parsed lists with their structure and line boundaries
 *
 * @example
 * ```typescript
 * const markdown = `
 * - First item
 *   - nested
 * - Second item
 * `;
 *
 * const lists = parseLists(markdown);
 * // Returns one MarkdownList with two top-level items
 * ```
 */
export function parseLists(content: string): MarkdownList[] {
  const lines = content.split("\n");
  const lists: MarkdownList[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines and headers between lists
    if (line === undefined || line.trim() === "" || line.startsWith("#")) {
      i++;
      continue;
    }

    // Detect list type for the line at column 0
    let type: ListType | undefined;
    if (UNORDERED_MARKER.test(line)) {
      type = "unordered";
    } else if (ORDERED_MARKER.test(line)) {
      type = "ordered";
    }

    if (!type) {
      i++;
      continue;
    }

    // Parse the list block starting at i
    const list = parseListAt(lines, i, type);
    if (list) {
      lists.push(list);
      i = list.endLine + 1;
    } else {
      i++;
    }
  }

  return lists;
}

/**
 * Parse a single list block starting at a given line index.
 *
 * @param lines - Array of content lines
 * @param startIndex - Line index of the first list marker
 * @param type - The list type already determined for this line
 * @returns A fully populated MarkdownList, or undefined if no items were found
 */
function parseListAt(
  lines: string[],
  startIndex: number,
  type: ListType,
): MarkdownList | undefined {
  const firstLine = lines[startIndex];
  if (!firstLine) return undefined;

  const bullet = extractBullet(firstLine, type);
  if (!bullet) return undefined;

  const items: ListItem[] = [];
  const itemRanges: Array<{ startLine: number; endLine: number }> = [];

  let currentItemStartLine = -1;
  let endLine = startIndex - 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // A blank line or header terminates the list
    if (line === undefined || line.trim() === "" || line.startsWith("#")) {
      break;
    }

    if (isTopLevelMarker(line, type)) {
      // Close the previous item range before starting a new one
      if (currentItemStartLine !== -1) {
        const last = itemRanges.at(-1);
        if (last) last.endLine = i - 1;
      }

      // Determine text after the bullet marker
      const markerLength = bullet.length;
      // For ordered lists the marker length can vary (e.g. "10. " vs "1. ")
      let afterBullet: string;
      if (type === "ordered") {
        const m = line.match(ORDERED_MARKER);
        afterBullet = m ? line.slice(m[0].length) : line;
      } else {
        afterBullet = line.slice(markerLength);
      }

      items.push(parseItemText(afterBullet));
      itemRanges.push({ startLine: i, endLine: i });
      currentItemStartLine = i;
    }
    // Continuation or sub-item line: belongs to the current item
    // (any line that does not start a new top-level marker and is not a terminator)

    endLine = i;
  }

  // Close the last item's range
  const lastRange = itemRanges.at(-1);
  if (lastRange) lastRange.endLine = endLine;

  if (items.length === 0) return undefined;

  return {
    startLine: startIndex,
    endLine,
    type,
    bullet,
    items,
    itemRanges,
  };
}

/**
 * Find a list by zero-based index or by section ID.
 *
 * When `identifier` is a number, returns the N-th list in the document (0-based).
 * When `identifier` is a string, finds the first list within the section whose
 * slug or custom ID matches the identifier.
 *
 * @param content - The markdown content containing lists
 * @param identifier - Zero-based list index (number) or section slug/ID (string)
 * @returns The matching list if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Find the second list in the document
 * const list = findList(content, 1);
 *
 * // Find the first list inside the "shopping-list" section
 * const list = findList(content, 'shopping-list');
 * ```
 */
export function findList(content: string, identifier: string | number): MarkdownList | undefined {
  const lists = parseLists(content);

  if (typeof identifier === "number") {
    return lists[identifier];
  }

  // Find list in section with this slug/ID
  const sections = parseSectionsForList(content);
  const section = sections.find((s) => s.id === identifier);

  if (!section) {
    return undefined;
  }

  // Return the first list whose boundaries fall within the section
  return lists.find(
    (list) => list.startLine >= section.startLine && list.endLine <= section.endLine,
  );
}

/**
 * Simple section parser for list lookup.
 * Minimal version that only extracts section IDs and boundaries.
 *
 * @param content - The markdown content to parse
 * @returns Array of sections with IDs and line boundaries
 */
function parseSectionsForList(content: string): Array<{
  id: string;
  level: number;
  startLine: number;
  endLine: number;
}> {
  const lines = content.split("\n");
  const sections: Array<{ id: string; level: number; startLine: number; endLine: number }> = [];

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
      headerText = headerText.replace(/\s*\{#[a-zA-Z0-9_-]+\}\s*$/, "").trim();
    } else {
      // Generate GitHub-style slug
      id = generateSlugForList(headerText);
    }

    sections.push({
      id,
      level,
      startLine: i,
      endLine: -1,
    });
  }

  // Set end boundaries for each section
  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i];
    if (!currentSection) continue;

    let endLine = lines.length - 1;
    for (let j = i + 1; j < sections.length; j++) {
      const nextSection = sections[j];
      if (!nextSection) continue;
      if (nextSection.level <= currentSection.level) {
        endLine = nextSection.startLine - 1;
        break;
      }
    }

    currentSection.endLine = endLine;
  }

  return sections;
}

/**
 * Generate a GitHub-style slug from header text for list lookup.
 *
 * @param text - The header text to convert into a slug
 * @returns The generated slug
 */
function generateSlugForList(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
