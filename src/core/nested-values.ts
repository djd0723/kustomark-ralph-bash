/**
 * Utilities for getting, setting, and deleting nested values in objects using dot notation.
 *
 * These functions provide a centralized implementation for working with nested object
 * properties using dot-separated paths (e.g., "metadata.author.name").
 *
 * @module nested-values
 */

/**
 * Get a nested value from an object using dot notation
 *
 * Traverses the object following the dot-separated path and returns the value
 * at that location, or undefined if any part of the path doesn't exist.
 *
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., "metadata.author.name")
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * ```typescript
 * const obj = { metadata: { author: { name: "Alice" } } };
 * getNestedValue(obj, "metadata.author.name"); // "Alice"
 * getNestedValue(obj, "metadata.title"); // undefined
 * getNestedValue(obj, "metadata.author"); // { name: "Alice" }
 * ```
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    // Check if current is null or undefined
    if (current === null || current === undefined) {
      return undefined;
    }

    // Check if current is an object (not an array or primitive)
    if (typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    // Navigate to the next level
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 *
 * Traverses the object following the dot-separated path and sets the value
 * at that location. Creates intermediate objects as needed.
 *
 * @param obj - Object to set value in
 * @param path - Dot-separated path (e.g., "metadata.author.name")
 * @param value - Value to set
 * @throws {Error} If path is empty
 *
 * @example
 * ```typescript
 * const obj = {};
 * setNestedValue(obj, "metadata.author.name", "Alice");
 * // obj is now { metadata: { author: { name: "Alice" } } }
 *
 * setNestedValue(obj, "metadata.title", "My Post");
 * // obj is now { metadata: { author: { name: "Alice" }, title: "My Post" } }
 * ```
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  const lastKey = keys.pop();

  if (!lastKey) {
    throw new Error("Path cannot be empty");
  }

  let current: Record<string, unknown> = obj;

  // Navigate to the parent of the target, creating intermediate objects as needed
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }

    const next = current[key];

    // If the next value is not an object (or is an array), replace it with an object
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  // Set the final value
  current[lastKey] = value;
}

/**
 * Delete a nested value from an object using dot notation
 *
 * Traverses the object following the dot-separated path and deletes the value
 * at that location. Returns true if the value was deleted, false if the path
 * didn't exist.
 *
 * @param obj - Object to delete value from
 * @param path - Dot-separated path (e.g., "metadata.author.name")
 * @returns true if the value was deleted, false if the path didn't exist
 * @throws {Error} If path is empty
 *
 * @example
 * ```typescript
 * const obj = { metadata: { author: { name: "Alice" }, title: "My Post" } };
 *
 * deleteNestedValue(obj, "metadata.author.name"); // true
 * // obj is now { metadata: { author: {}, title: "My Post" } }
 *
 * deleteNestedValue(obj, "metadata.author.name"); // false (already deleted)
 *
 * deleteNestedValue(obj, "metadata.nonexistent"); // false (never existed)
 * ```
 */
export function deleteNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const keys = path.split(".");
  const lastKey = keys.pop();

  if (!lastKey) {
    throw new Error("Path cannot be empty");
  }

  let current: unknown = obj;

  // Navigate to the parent of the target
  for (const key of keys) {
    if (current === null || current === undefined) {
      return false;
    }

    if (typeof current !== "object" || Array.isArray(current)) {
      return false;
    }

    current = (current as Record<string, unknown>)[key];
  }

  // Check if the final value exists and delete it
  if (
    current !== null &&
    current !== undefined &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    lastKey in (current as Record<string, unknown>)
  ) {
    delete (current as Record<string, unknown>)[lastKey];
    return true;
  }

  return false;
}
