/**
 * File operations engine for kustomark
 *
 * Implements file manipulation operations:
 * - Copy files
 * - Rename files
 * - Delete files
 * - Move files
 *
 * All operations work with a fileMap (Map<src, dest>) and support glob patterns.
 */

import * as path from "node:path";
import micromatch from "micromatch";

/**
 * Result of a file operation
 */
export interface FileOperationResult {
  /** Updated file map after the operation */
  fileMap: Map<string, string>;
  /** Number of files affected by this operation */
  count: number;
}

/**
 * Validates a path to prevent path traversal attacks
 *
 * Ensures that a given file path does not escape the base directory using ".." or
 * other path traversal techniques. This is a critical security function that prevents
 * malicious templates from accessing files outside their allowed scope.
 *
 * @param filePath - The path to validate (can be relative or absolute)
 * @param baseDir - The base directory that the path should be relative to
 * @throws {Error} If the path attempts to escape the base directory
 *
 * @example
 * ```typescript
 * // Valid path
 * validatePath('docs/readme.md', '/home/user/project');
 * // No error
 * ```
 *
 * @example
 * ```typescript
 * // Invalid path - attempts to escape
 * try {
 *   validatePath('../../etc/passwd', '/home/user/project');
 * } catch (error) {
 *   console.error(error.message); // "Path traversal detected..."
 * }
 * ```
 */
export function validatePath(filePath: string, baseDir: string): void {
  // Resolve both paths to absolute paths
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, filePath);

  // Check if the resolved path starts with the base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error(`Path traversal detected: "${filePath}" escapes base directory "${baseDir}"`);
  }

  // Additional check for suspicious patterns
  if (filePath.includes("..")) {
    const normalized = path.normalize(filePath);
    if (normalized.includes("..")) {
      throw new Error(`Path traversal detected: "${filePath}" contains suspicious patterns`);
    }
  }
}

/**
 * Apply a copy-file operation
 *
 * Copies a single source file to a destination path. The source file is added to the
 * file map with the new destination, while keeping the original mapping intact.
 * Both paths are validated to prevent path traversal attacks.
 *
 * @param fileMap - Current file map (src -> dest)
 * @param src - Source file path (relative to project root)
 * @param dest - Destination file path (relative to output directory)
 * @param baseDir - Base directory for path validation (project root)
 * @returns Updated file map and count of files copied (always 1)
 * @throws {Error} If paths fail validation (path traversal attempt)
 *
 * @example
 * ```typescript
 * const fileMap = new Map([
 *   ['src/readme.md', 'readme.md']
 * ]);
 *
 * const result = applyCopyFile(
 *   fileMap,
 *   'src/readme.md',
 *   'docs/readme.md',
 *   '/home/user/project'
 * );
 *
 * console.log(result.count); // 1
 * console.log(result.fileMap.get('src/readme.md')); // "docs/readme.md"
 * ```
 */
export function applyCopyFile(
  fileMap: Map<string, string>,
  src: string,
  dest: string,
  baseDir: string,
): FileOperationResult {
  // Validate paths to prevent path traversal
  validatePath(src, baseDir);
  validatePath(dest, baseDir);

  // Create a new map to avoid mutating the input
  const newMap = new Map(fileMap);

  // Add the copy operation to the map
  // The source file remains in the map with its original destination
  // We add a new entry for the copied file
  newMap.set(src, dest);

  return {
    fileMap: newMap,
    count: 1,
  };
}

/**
 * Apply a rename-file operation
 *
 * Renames files matching a glob pattern. Only the filename is replaced, not the entire path.
 * The directory structure is preserved. All matching files are renamed to the same filename.
 * The rename parameter must be a filename only, not a path.
 *
 * @param fileMap - Current file map (src -> dest)
 * @param match - Glob pattern to match source files
 * @param rename - New filename (not a full path, just the filename)
 * @param baseDir - Base directory for path validation (project root)
 * @returns Updated file map and count of files renamed
 * @throws {Error} If rename contains path separators or path traversal patterns
 *
 * @example
 * ```typescript
 * const fileMap = new Map([
 *   ['docs/guide.md', 'docs/guide.md'],
 *   ['docs/api.md', 'docs/api.md'],
 *   ['src/index.ts', 'src/index.ts']
 * ]);
 *
 * const result = applyRenameFile(fileMap, '*.md', 'README.md', '/project');
 *
 * console.log(result.count); // 2
 * console.log(result.fileMap.get('docs/guide.md')); // "docs/README.md"
 * console.log(result.fileMap.get('docs/api.md')); // "docs/README.md"
 * console.log(result.fileMap.get('src/index.ts')); // "src/index.ts" (unchanged)
 * ```
 *
 * @example
 * ```typescript
 * // Invalid rename target throws error
 * try {
 *   applyRenameFile(fileMap, '*.md', 'path/to/file.md', '/project');
 * } catch (error) {
 *   console.error(error.message); // "Invalid rename target..."
 * }
 * ```
 */
export function applyRenameFile(
  fileMap: Map<string, string>,
  match: string,
  rename: string,
  baseDir: string,
): FileOperationResult {
  // Validate the new filename doesn't contain path separators or traversal
  if (rename.includes("/") || rename.includes("\\") || rename.includes("..")) {
    throw new Error(`Invalid rename target: "${rename}" must be a filename, not a path`);
  }

  // Create a new map to avoid mutating the input
  const newMap = new Map<string, string>();

  // Get all source files from the current map
  const sourceFiles = Array.from(fileMap.keys());

  // Find files matching the glob pattern
  const matchedFiles = micromatch(sourceFiles, match);

  let count = 0;

  // Process all files
  for (const [src, dest] of fileMap.entries()) {
    if (matchedFiles.includes(src)) {
      // This file matches - rename it by replacing just the filename
      const destDir = path.dirname(dest);
      const newDest = path.join(destDir, rename);

      // Validate the new destination path
      validatePath(newDest, baseDir);

      newMap.set(src, newDest);
      count++;
    } else {
      // This file doesn't match - keep it unchanged
      newMap.set(src, dest);
    }
  }

  return {
    fileMap: newMap,
    count,
  };
}

/**
 * Apply a delete-file operation
 *
 * Removes files matching a glob pattern from the file map. Matched files are excluded
 * from the output. The glob pattern is matched against the source file paths.
 *
 * @param fileMap - Current file map (src -> dest)
 * @param match - Glob pattern to match files to delete
 * @param _baseDir - Base directory for path validation (project root) - unused but kept for API consistency
 * @returns Updated file map and count of files deleted
 *
 * @example
 * ```typescript
 * const fileMap = new Map([
 *   ['readme.md', 'readme.md'],
 *   ['temp.tmp', 'temp.tmp'],
 *   ['notes.txt', 'notes.txt']
 * ]);
 *
 * const result = applyDeleteFile(fileMap, '*.tmp', '/project');
 *
 * console.log(result.count); // 1
 * console.log(result.fileMap.has('temp.tmp')); // false
 * console.log(result.fileMap.has('readme.md')); // true
 * ```
 *
 * @example
 * ```typescript
 * // Delete multiple files with glob pattern
 * const result = applyDeleteFile(fileMap, 'deep glob pattern', '/project');
 * // Deletes matching files in any directory
 * ```
 */
export function applyDeleteFile(
  fileMap: Map<string, string>,
  match: string,
  _baseDir: string,
): FileOperationResult {
  // Create a new map to avoid mutating the input
  const newMap = new Map<string, string>();

  // Get all source files from the current map
  const sourceFiles = Array.from(fileMap.keys());

  // Find files matching the glob pattern
  const matchedFiles = micromatch(sourceFiles, match);

  let count = 0;

  // Process all files
  for (const [src, dest] of fileMap.entries()) {
    if (matchedFiles.includes(src)) {
      // This file matches - delete it (don't add to new map)
      count++;
    } else {
      // This file doesn't match - keep it
      newMap.set(src, dest);
    }
  }

  return {
    fileMap: newMap,
    count,
  };
}

/**
 * Apply a move-file operation
 *
 * Moves files matching a glob pattern to a new destination directory. The filename
 * is preserved, only the directory path changes. All matched files are moved to the
 * same destination directory.
 *
 * @param fileMap - Current file map (src -> dest)
 * @param match - Glob pattern to match files to move
 * @param dest - Destination directory (relative to output directory)
 * @param baseDir - Base directory for path validation (project root)
 * @returns Updated file map and count of files moved
 * @throws {Error} If destination path fails validation (path traversal attempt)
 *
 * @example
 * ```typescript
 * const fileMap = new Map([
 *   ['src/readme.md', 'src/readme.md'],
 *   ['src/guide.md', 'src/guide.md'],
 *   ['index.html', 'index.html']
 * ]);
 *
 * const result = applyMoveFile(fileMap, 'src/*.md', 'docs', '/project');
 *
 * console.log(result.count); // 2
 * console.log(result.fileMap.get('src/readme.md')); // "docs/readme.md"
 * console.log(result.fileMap.get('src/guide.md')); // "docs/guide.md"
 * console.log(result.fileMap.get('index.html')); // "index.html" (unchanged)
 * ```
 *
 * @example
 * ```typescript
 * // Move all markdown files to a new location
 * const result = applyMoveFile(fileMap, 'deep glob pattern', 'documentation', '/project');
 * // All matching .md files moved to documentation/ directory
 * ```
 */
export function applyMoveFile(
  fileMap: Map<string, string>,
  match: string,
  dest: string,
  baseDir: string,
): FileOperationResult {
  // Validate the destination directory
  validatePath(dest, baseDir);

  // Create a new map to avoid mutating the input
  const newMap = new Map<string, string>();

  // Get all source files from the current map
  const sourceFiles = Array.from(fileMap.keys());

  // Find files matching the glob pattern
  const matchedFiles = micromatch(sourceFiles, match);

  let count = 0;

  // Process all files
  for (const [src, originalDest] of fileMap.entries()) {
    if (matchedFiles.includes(src)) {
      // This file matches - move it by changing the directory
      const filename = path.basename(originalDest);
      const newDest = path.join(dest, filename);

      // Validate the new destination path
      validatePath(newDest, baseDir);

      newMap.set(src, newDest);
      count++;
    } else {
      // This file doesn't match - keep it unchanged
      newMap.set(src, originalDest);
    }
  }

  return {
    fileMap: newMap,
    count,
  };
}
