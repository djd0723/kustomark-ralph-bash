/**
 * File service for safe file operations
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { HttpError } from "../middleware/error-handler.js";
import type { FileContent } from "../types.js";

/**
 * Read a file safely within the base directory
 *
 * @param baseDir - Base directory for resolving paths
 * @param filePath - Path to file (relative to baseDir)
 * @returns File content
 * @throws HttpError if file not found or path traversal detected
 */
export function readFile(baseDir: string, filePath: string): FileContent {
  // Resolve and validate path
  const absolutePath = validatePath(baseDir, filePath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    throw new HttpError(404, `File not found: ${filePath}`);
  }

  // Check if it's a file (not a directory)
  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    throw new HttpError(400, `Path is not a file: ${filePath}`);
  }

  try {
    const content = readFileSync(absolutePath, "utf-8");
    return {
      content,
      path: filePath,
    };
  } catch (error) {
    throw new HttpError(
      500,
      `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Write a file safely within the base directory
 *
 * @param baseDir - Base directory for resolving paths
 * @param filePath - Path to file (relative to baseDir)
 * @param content - File content
 * @throws HttpError if path traversal detected or write fails
 */
export function writeFile(baseDir: string, filePath: string, content: string): void {
  // Resolve and validate path
  const absolutePath = validatePath(baseDir, filePath);

  try {
    // Ensure directory exists
    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      mkdir(dir, { recursive: true });
    }

    // Write file
    writeFileSync(absolutePath, content, "utf-8");
  } catch (error) {
    throw new HttpError(
      500,
      `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * List files in a directory
 *
 * @param baseDir - Base directory for resolving paths
 * @param dirPath - Path to directory (relative to baseDir, defaults to ".")
 * @returns Array of file/directory names
 * @throws HttpError if directory not found or path traversal detected
 */
export function listDirectory(baseDir: string, dirPath = "."): string[] {
  // Resolve and validate path
  const absolutePath = validatePath(baseDir, dirPath);

  // Check if directory exists
  if (!existsSync(absolutePath)) {
    throw new HttpError(404, `Directory not found: ${dirPath}`);
  }

  // Check if it's a directory
  const stats = statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new HttpError(400, `Path is not a directory: ${dirPath}`);
  }

  try {
    return readdirSync(absolutePath);
  } catch (error) {
    throw new HttpError(
      500,
      `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Check if a file exists
 *
 * @param baseDir - Base directory for resolving paths
 * @param filePath - Path to file (relative to baseDir)
 * @returns True if file exists
 */
export function fileExists(baseDir: string, filePath: string): boolean {
  try {
    const absolutePath = validatePath(baseDir, filePath);
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Validate and resolve a path to prevent path traversal attacks
 *
 * @param baseDir - Base directory for resolving paths
 * @param filePath - Path to validate (relative to baseDir)
 * @returns Absolute path if valid
 * @throws HttpError if path traversal detected
 */
function validatePath(baseDir: string, filePath: string): string {
  // Normalize and resolve paths
  const absoluteBase = resolve(baseDir);
  const absolutePath = resolve(absoluteBase, filePath);

  // Check for path traversal
  const relativePath = relative(absoluteBase, absolutePath);
  // Empty string means we're accessing the base directory itself (valid)
  // Otherwise, check for parent directory traversal
  if (
    relativePath !== "" &&
    (relativePath.startsWith("..") || normalize(relativePath) !== relativePath)
  ) {
    throw new HttpError(403, `Path traversal detected: ${filePath}`);
  }

  return absolutePath;
}
