/**
 * File browser API endpoints
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { normalize, relative, resolve } from "node:path";
import type { Response } from "express";
import { Router } from "express";
import { asyncHandler, HttpError } from "../middleware/error-handler.js";
import { listDirectory, readFile } from "../services/file-service.js";
import type { FileContent, ServerConfig, TypedRequest } from "../types.js";

/**
 * File node representing a file or directory in the tree
 */
export interface FileNode {
  /** File or directory name */
  name: string;
  /** Relative path from base directory */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File size in bytes (0 for directories) */
  size: number;
  /** Child nodes (only for directories) */
  children?: FileNode[];
}

/**
 * File list response
 */
interface FileListResponse {
  /** Array of file nodes */
  files: FileNode[];
  /** Directory path */
  path: string;
}

/**
 * File tree response
 */
interface FileTreeResponse {
  /** Root file node with recursive children */
  tree: FileNode;
  /** Root path */
  path: string;
}

/**
 * Maximum depth for recursive tree traversal (to prevent DoS)
 */
const MAX_TREE_DEPTH = 10;

/**
 * Directories to filter out from tree/list results
 */
const FILTERED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  ".next",
  "build",
  ".cache",
  "coverage",
  ".nyc_output",
]);

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

/**
 * Get file node information for a given path
 *
 * @param baseDir - Base directory
 * @param relativePath - Relative path from baseDir
 * @returns FileNode with basic information
 */
function getFileNode(baseDir: string, relativePath: string): FileNode {
  const absolutePath = validatePath(baseDir, relativePath);

  if (!existsSync(absolutePath)) {
    throw new HttpError(404, `Path not found: ${relativePath}`);
  }

  const stats = statSync(absolutePath);
  const name = relativePath === "." ? "." : relativePath.split("/").pop() || relativePath;

  return {
    name,
    path: relativePath,
    isDirectory: stats.isDirectory(),
    size: stats.isFile() ? stats.size : 0,
  };
}

/**
 * Build a recursive file tree
 *
 * @param baseDir - Base directory
 * @param relativePath - Relative path from baseDir
 * @param currentDepth - Current recursion depth
 * @returns FileNode with recursive children
 * @throws HttpError if max depth exceeded or path invalid
 */
function buildFileTree(baseDir: string, relativePath: string, currentDepth = 0): FileNode {
  // Check depth limit
  if (currentDepth > MAX_TREE_DEPTH) {
    throw new HttpError(400, `Maximum tree depth (${MAX_TREE_DEPTH}) exceeded`);
  }

  // Get node information
  const node = getFileNode(baseDir, relativePath);

  // If it's a file, return as-is
  if (!node.isDirectory) {
    return node;
  }

  // For directories, get children
  const absolutePath = validatePath(baseDir, relativePath);

  try {
    const entries = readdirSync(absolutePath);

    // Build child nodes
    const children: FileNode[] = [];

    for (const entry of entries) {
      // Skip filtered directories
      if (FILTERED_DIRECTORIES.has(entry)) {
        continue;
      }

      const childRelativePath = relativePath === "." ? entry : `${relativePath}/${entry}`;

      try {
        const childNode = buildFileTree(baseDir, childRelativePath, currentDepth + 1);
        children.push(childNode);
      } catch (_error) {}
    }

    // Sort children: directories first, then alphabetically
    children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    node.children = children;
    return node;
  } catch (error) {
    throw new HttpError(
      500,
      `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create file browser routes
 */
export function createFileRoutes(config: ServerConfig): Router {
  const router = Router();

  /**
   * GET /api/files
   * Get file content
   * Query params:
   *   - path: File path (relative to base directory, required)
   */
  router.get(
    "/",
    asyncHandler(async (req: TypedRequest, res: Response<FileContent>) => {
      const path = req.query.path;

      if (!path || typeof path !== "string") {
        throw new HttpError(400, "Missing or invalid 'path' query parameter");
      }

      if (config.verbose) {
        console.log(`File read requested for: ${path}`);
      }

      const content = readFile(config.baseDir, path);
      res.json(content);
    }),
  );

  /**
   * GET /api/files/list
   * List files in a directory
   * Query params:
   *   - path: Directory path (relative to base directory, defaults to ".")
   */
  router.get(
    "/list",
    asyncHandler(async (req: TypedRequest, res: Response<FileListResponse>) => {
      const path = typeof req.query.path === "string" ? req.query.path : ".";

      if (config.verbose) {
        console.log(`Directory list requested for: ${path}`);
      }

      // Validate path
      const absolutePath = validatePath(config.baseDir, path);

      // Check if directory exists
      if (!existsSync(absolutePath)) {
        throw new HttpError(404, `Directory not found: ${path}`);
      }

      // Check if it's a directory
      const stats = statSync(absolutePath);
      if (!stats.isDirectory()) {
        throw new HttpError(400, `Path is not a directory: ${path}`);
      }

      // Get directory entries
      const entries = listDirectory(config.baseDir, path);

      // Build file nodes
      const files: FileNode[] = [];

      for (const entry of entries) {
        // Skip filtered directories
        if (FILTERED_DIRECTORIES.has(entry)) {
          continue;
        }

        const entryPath = path === "." ? entry : `${path}/${entry}`;

        try {
          const node = getFileNode(config.baseDir, entryPath);
          files.push(node);
        } catch (_error) {}
      }

      // Sort files: directories first, then alphabetically
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        files,
        path,
      });
    }),
  );

  /**
   * GET /api/files/tree
   * Get recursive directory tree
   * Query params:
   *   - path: Root directory path (relative to base directory, defaults to ".")
   */
  router.get(
    "/tree",
    asyncHandler(async (req: TypedRequest, res: Response<FileTreeResponse>) => {
      const path = typeof req.query.path === "string" ? req.query.path : ".";

      if (config.verbose) {
        console.log(`Directory tree requested for: ${path}`);
      }

      // Build recursive tree
      const tree = buildFileTree(config.baseDir, path);

      res.json({
        tree,
        path,
      });
    }),
  );

  return router;
}
