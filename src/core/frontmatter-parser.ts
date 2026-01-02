/**
 * Frontmatter parser for kustomark
 *
 * Handles YAML frontmatter in markdown files:
 * - Parse YAML frontmatter from markdown content
 * - Convert objects back to YAML frontmatter format
 * - Extract frontmatter and body separately
 * - Insert/replace frontmatter in content
 * - Support for nested key operations with dot notation
 */

import yaml from "js-yaml";
import { deleteNestedValue, getNestedValue, setNestedValue } from "./nested-values.js";

/**
 * Frontmatter extraction result
 */
export interface FrontmatterResult {
  /** Parsed frontmatter data */
  data: Record<string, unknown>;
  /** Markdown content without frontmatter */
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * Frontmatter must be at the start of the document and enclosed in --- delimiters.
 * Returns an empty object if no frontmatter is found.
 *
 * @param content - The markdown content with frontmatter
 * @returns Parsed frontmatter object, or empty object if no frontmatter found
 * @throws {Error} If frontmatter YAML is malformed or invalid
 *
 * @example
 * ```typescript
 * const markdown = `---
 * title: My Post
 * author: Alice
 * ---
 * # Content here`;
 *
 * const frontmatter = parseFrontmatter(markdown);
 * console.log(frontmatter); // { title: 'My Post', author: 'Alice' }
 * ```
 *
 * @example
 * ```typescript
 * // No frontmatter
 * const markdown = '# Just content';
 * const frontmatter = parseFrontmatter(markdown);
 * console.log(frontmatter); // {}
 * ```
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const result = extractFrontmatter(content);
  return result.data;
}

/**
 * Convert an object to YAML frontmatter format
 *
 * Produces a string wrapped in --- delimiters. Returns an empty string if the
 * data object is empty or null. Key order is preserved during serialization.
 *
 * @param data - The object to convert to frontmatter
 * @returns YAML frontmatter string with delimiters, or empty string if data is empty
 * @throws {Error} If data cannot be serialized to YAML
 *
 * @example
 * ```typescript
 * const data = {
 *   title: 'My Post',
 *   author: 'Alice',
 *   metadata: {
 *     tags: ['javascript', 'typescript']
 *   }
 * };
 *
 * const yaml = stringifyFrontmatter(data);
 * console.log(yaml);
 * // ---
 * // title: My Post
 * // author: Alice
 * // metadata:
 * //   tags:
 * //     - javascript
 * //     - typescript
 * // ---
 * ```
 *
 * @example
 * ```typescript
 * // Empty object returns empty string
 * const yaml = stringifyFrontmatter({});
 * console.log(yaml); // ""
 * ```
 */
export function stringifyFrontmatter(data: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) {
    return "";
  }

  try {
    const yamlStr = yaml.dump(data, {
      indent: 2,
      lineWidth: -1, // Don't wrap lines
      noRefs: true, // Don't use anchors/aliases
      sortKeys: false, // Preserve key order
    });

    return `---\n${yamlStr}---\n`;
  } catch (error) {
    throw new Error(
      `Failed to serialize frontmatter to YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extract frontmatter and body separately from markdown content
 *
 * Splits markdown content into frontmatter data and body text. If no frontmatter
 * is present, returns an empty object for data and the entire content as body.
 *
 * @param content - The markdown content to parse
 * @returns Object with parsed frontmatter data and body content
 * @throws {Error} If frontmatter YAML is malformed or not a valid object
 *
 * @example
 * ```typescript
 * const markdown = `---
 * title: My Post
 * author: Alice
 * ---
 * # Introduction
 *
 * This is the content.`;
 *
 * const result = extractFrontmatter(markdown);
 * console.log(result.data); // { title: 'My Post', author: 'Alice' }
 * console.log(result.body); // "# Introduction\n\nThis is the content."
 * ```
 *
 * @example
 * ```typescript
 * // No frontmatter
 * const markdown = '# Just content';
 * const result = extractFrontmatter(markdown);
 * console.log(result.data); // {}
 * console.log(result.body); // "# Just content"
 * ```
 */
export function extractFrontmatter(content: string): FrontmatterResult {
  // Match frontmatter pattern: starts with ---, content, ends with ---
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter found
    return {
      data: {},
      body: content,
    };
  }

  const yamlContent = match[1] || "";
  const body = content.slice(match[0].length);

  // Parse YAML, handling empty frontmatter
  let data: Record<string, unknown>;
  try {
    if (yamlContent.trim() === "") {
      data = {};
    } else {
      const parsed = yaml.load(yamlContent);
      // Ensure we return an object, not a primitive or array
      if (parsed === null || parsed === undefined) {
        data = {};
      } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      } else {
        throw new Error(
          "Frontmatter must be a YAML object (key-value pairs), not a primitive or array",
        );
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to parse frontmatter YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    data,
    body,
  };
}

/**
 * Insert or replace frontmatter in markdown content
 *
 * If content already has frontmatter, it will be replaced with the new frontmatter.
 * If content has no frontmatter, the new frontmatter will be added at the beginning.
 * If the frontmatter object is empty, any existing frontmatter will be removed.
 *
 * @param content - The markdown content to modify
 * @param frontmatter - The frontmatter object to insert or replace
 * @returns Content with frontmatter inserted/replaced, or just body if frontmatter is empty
 * @throws {Error} If frontmatter cannot be serialized to YAML
 *
 * @example
 * ```typescript
 * // Add frontmatter to content without it
 * const content = '# My Post\n\nContent here.';
 * const newContent = insertFrontmatter(content, { title: 'My Post', author: 'Alice' });
 * console.log(newContent);
 * // ---
 * // title: My Post
 * // author: Alice
 * // ---
 * // # My Post
 * //
 * // Content here.
 * ```
 *
 * @example
 * ```typescript
 * // Replace existing frontmatter
 * const content = `---
 * title: Old Title
 * ---
 * Content`;
 *
 * const newContent = insertFrontmatter(content, { title: 'New Title', author: 'Bob' });
 * // Frontmatter is replaced, content remains
 * ```
 *
 * @example
 * ```typescript
 * // Remove frontmatter by passing empty object
 * const content = `---
 * title: My Post
 * ---
 * Content`;
 *
 * const newContent = insertFrontmatter(content, {});
 * console.log(newContent); // "Content"
 * ```
 */
export function insertFrontmatter(content: string, frontmatter: Record<string, unknown>): string {
  const { body } = extractFrontmatter(content);
  const frontmatterStr = stringifyFrontmatter(frontmatter);

  // If frontmatter is empty, just return the body
  if (!frontmatterStr) {
    return body;
  }

  return `${frontmatterStr}${body}`;
}

// Re-export nested value utilities for backward compatibility
// These are now imported from nested-values.ts
export { deleteNestedValue, getNestedValue, setNestedValue };
