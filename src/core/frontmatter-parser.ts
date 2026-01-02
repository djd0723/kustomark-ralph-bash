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
 * Frontmatter must be at the start of the document and enclosed in --- delimiters:
 * ```
 * ---
 * key: value
 * ---
 * Content here
 * ```
 *
 * @param content - The markdown content with frontmatter
 * @returns Parsed frontmatter object, or empty object if no frontmatter found
 * @throws Error if frontmatter YAML is malformed
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const result = extractFrontmatter(content);
  return result.data;
}

/**
 * Convert an object to YAML frontmatter format
 *
 * Produces a string wrapped in --- delimiters:
 * ```
 * ---
 * key: value
 * nested:
 *   key: value
 * ---
 * ```
 *
 * @param data - The object to convert to frontmatter
 * @returns YAML frontmatter string with delimiters
 * @throws Error if data cannot be serialized to YAML
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
 * @param content - The markdown content
 * @returns Object with parsed frontmatter data and body content
 * @throws Error if frontmatter YAML is malformed
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
 * If content already has frontmatter, it will be replaced.
 * If content has no frontmatter, it will be added at the beginning.
 * If frontmatter data is empty, existing frontmatter will be removed.
 *
 * @param content - The markdown content
 * @param frontmatter - The frontmatter object to insert
 * @returns Content with frontmatter inserted/replaced
 * @throws Error if frontmatter cannot be serialized
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
