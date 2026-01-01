import { isAbsolute, join, normalize, resolve } from "node:path";
import micromatch from "micromatch";
import { isGitUrl, parseGitUrl } from "./git-url-parser.js";

/**
 * Represents a resolved markdown file resource
 */
export interface ResolvedResource {
  /** Absolute path to the markdown file */
  path: string;
  /** Content of the markdown file */
  content: string;
  /** Source pattern or config that resolved to this resource */
  source: string;
}

/**
 * Error thrown when resource resolution fails
 */
export class ResourceResolutionError extends Error {
  public readonly resource: string;
  public override readonly cause?: Error;

  constructor(message: string, resource: string, cause?: Error) {
    super(message);
    this.name = "ResourceResolutionError";
    this.resource = resource;
    this.cause = cause;
  }
}

/**
 * Represents a kustomark configuration structure
 */
interface KustomarkConfig {
  resources?: string[];
  [key: string]: unknown;
}

/**
 * Options for resource resolution
 */
interface ResolveOptions {
  /** Maximum depth for recursive config resolution (prevents infinite loops) */
  maxDepth?: number;
  /** Current recursion depth (internal use) */
  currentDepth?: number;
  /** Set of visited config paths to detect cycles */
  visited?: Set<string>;
}

/**
 * Resolves resource patterns to a flat list of markdown files
 *
 * @param resources - Array of glob patterns, file paths, or directory references
 * @param baseDir - Base directory to resolve relative paths against (absolute path)
 * @param fileMap - Map of absolute file paths to their content
 * @param options - Resolution options
 * @returns Array of resolved markdown resources
 * @throws {ResourceResolutionError} If resource resolution fails
 *
 * @example
 * ```typescript
 * const fileMap = new Map([
 *   ['/project/docs/api.md', '# API Docs'],
 *   ['/project/docs/README.md', '# README'],
 * ]);
 *
 * const resources = resolveResources(
 *   ['**\/*.md', '!**\/README.md'],
 *   '/project',
 *   fileMap
 * );
 * ```
 */
export function resolveResources(
  resources: string[],
  baseDir: string,
  fileMap: Map<string, string>,
  options: ResolveOptions = {},
): ResolvedResource[] {
  const { maxDepth = 10, currentDepth = 0, visited = new Set<string>() } = options;

  // Normalize base directory to absolute path
  const normalizedBaseDir = isAbsolute(baseDir) ? normalize(baseDir) : resolve(baseDir);

  // Check recursion depth to prevent infinite loops
  if (currentDepth >= maxDepth) {
    throw new ResourceResolutionError(
      `Maximum recursion depth (${maxDepth}) exceeded. Possible circular reference in resources.`,
      normalizedBaseDir,
    );
  }

  const resolvedResources: ResolvedResource[] = [];
  const negationPatterns: string[] = [];
  const positivePatterns: string[] = [];

  // Separate positive and negation patterns
  for (const resource of resources) {
    const trimmed = resource.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("!")) {
      negationPatterns.push(trimmed.slice(1));
    } else {
      positivePatterns.push(trimmed);
    }
  }

  // Get all markdown files from fileMap that are under baseDir
  const allFiles = Array.from(fileMap.keys()).filter((filePath) => {
    const normalizedPath = normalize(filePath);
    return normalizedPath.startsWith(normalizedBaseDir) && normalizedPath.endsWith(".md");
  });

  // Process each positive pattern
  for (const pattern of positivePatterns) {
    // Check if pattern is a git URL
    if (isGitUrl(pattern)) {
      // Validate that the git URL is parseable
      const parsedGit = parseGitUrl(pattern);
      if (!parsedGit) {
        throw new ResourceResolutionError(
          `Malformed git URL: ${pattern}. Please check the URL format.`,
          pattern,
        );
      }

      // TODO: Implement git URL fetching in a future task
      // For now, we just validate that the URL is parseable
      // Future implementation will:
      // 1. Clone the repository (or use existing cache)
      // 2. Checkout the specified ref (branch/tag/commit)
      // 3. Extract files from the specified path
      // 4. Add resolved markdown files to resolvedResources
      throw new ResourceResolutionError(
        `Git URL resolution not yet implemented: ${pattern}. Git fetching will be added in a future update.`,
        pattern,
      );
    }

    // Check if pattern is a reference to another kustomark config (directory)
    if (isDirectoryReference(pattern)) {
      const resolvedDir = resolvePathFromBase(pattern, normalizedBaseDir);

      // Detect circular references
      if (visited.has(resolvedDir)) {
        throw new ResourceResolutionError(
          `Circular reference detected: ${resolvedDir} is already in the resolution chain`,
          pattern,
        );
      }

      // Look for kustomark.yaml or kustomark.yml in the directory
      const configPath = findKustomarkConfig(resolvedDir, fileMap);

      if (configPath) {
        const configContent = fileMap.get(configPath);
        if (!configContent) {
          throw new ResourceResolutionError(
            `Config file exists but has no content: ${configPath}`,
            pattern,
          );
        }

        // Parse the config and recursively resolve its resources
        try {
          const config = parseKustomarkConfig(configContent);

          if (config.resources && Array.isArray(config.resources)) {
            // Create new visited set with current path
            const newVisited = new Set(visited);
            newVisited.add(resolvedDir);

            const nestedResources = resolveResources(config.resources, resolvedDir, fileMap, {
              maxDepth,
              currentDepth: currentDepth + 1,
              visited: newVisited,
            });

            resolvedResources.push(...nestedResources);
          }
        } catch (error) {
          throw new ResourceResolutionError(
            `Failed to parse or resolve config: ${configPath}`,
            pattern,
            error instanceof Error ? error : undefined,
          );
        }
      } else {
        throw new ResourceResolutionError(
          `No kustomark.yaml or kustomark.yml found in directory: ${resolvedDir}`,
          pattern,
        );
      }
    } else {
      // It's a glob pattern or file path
      const matchedFiles = matchGlobPattern(pattern, allFiles, normalizedBaseDir);

      for (const filePath of matchedFiles) {
        const content = fileMap.get(filePath);
        if (content !== undefined) {
          resolvedResources.push({
            path: filePath,
            content,
            source: pattern,
          });
        }
      }
    }
  }

  // Apply negation patterns to filter out excluded files
  if (negationPatterns.length > 0) {
    const filtered = filterWithNegationPatterns(
      resolvedResources,
      negationPatterns,
      normalizedBaseDir,
    );
    return deduplicateResources(filtered);
  }

  return deduplicateResources(resolvedResources);
}

/**
 * Checks if a pattern is a directory reference (ends with / or looks like a path)
 */
function isDirectoryReference(pattern: string): boolean {
  // If it has glob characters, it's a glob pattern, not a directory
  if (hasGlobCharacters(pattern)) {
    return false;
  }

  // If it ends with a file extension like .md, it's a file
  if (pattern.endsWith(".md") || /\.\w+$/.test(pattern)) {
    return false;
  }

  // Ends with / or starts with ./ or ../
  return pattern.endsWith("/") || pattern.startsWith("./") || pattern.startsWith("../");
}

/**
 * Checks if a pattern contains glob characters
 */
function hasGlobCharacters(pattern: string): boolean {
  return /[*?[\]{}!]/.test(pattern);
}

/**
 * Resolves a path relative to a base directory
 */
function resolvePathFromBase(path: string, baseDir: string): string {
  // Remove trailing slash if present
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
  return normalize(resolve(baseDir, cleanPath));
}

/**
 * Finds kustomark.yaml or kustomark.yml in a directory
 */
function findKustomarkConfig(dir: string, fileMap: Map<string, string>): string | null {
  const yamlPath = join(dir, "kustomark.yaml");
  const ymlPath = join(dir, "kustomark.yml");

  if (fileMap.has(normalize(yamlPath))) {
    return normalize(yamlPath);
  }
  if (fileMap.has(normalize(ymlPath))) {
    return normalize(ymlPath);
  }

  return null;
}

/**
 * Parses a kustomark config YAML string
 */
function parseKustomarkConfig(content: string): KustomarkConfig {
  // Simple YAML parser for the resources field
  // For MVP, we'll do a basic parse. In production, use js-yaml
  try {
    // This is a simplified parser - in real implementation, use js-yaml
    const yaml = require("js-yaml");
    return yaml.load(content) as KustomarkConfig;
  } catch (error) {
    throw new Error(
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Matches files against a glob pattern
 */
function matchGlobPattern(pattern: string, allFiles: string[], baseDir: string): string[] {
  // If pattern is a specific file path (not a glob), resolve it directly
  if (!hasGlobCharacters(pattern)) {
    const resolvedPath = resolvePathFromBase(pattern, baseDir);
    const normalizedPath = normalize(resolvedPath);

    // Check if the file exists in our fileMap
    if (allFiles.includes(normalizedPath)) {
      return [normalizedPath];
    }
    return [];
  }

  // For glob patterns, convert absolute paths to relative paths for matching
  const relativePaths = allFiles.map((filePath) => {
    const normalized = normalize(filePath);
    if (normalized.startsWith(baseDir)) {
      const relative = normalized.slice(baseDir.length);
      // Remove leading slash
      return relative.startsWith("/") ? relative.slice(1) : relative;
    }
    return normalized;
  });

  // Match using micromatch
  const matched = micromatch(relativePaths, pattern, {
    dot: true,
    matchBase: false,
  });

  // Convert matched relative paths back to absolute paths
  return matched.map((relativePath) => {
    const absolutePath = join(baseDir, relativePath);
    return normalize(absolutePath);
  });
}

/**
 * Filters resources using negation patterns
 */
function filterWithNegationPatterns(
  resources: ResolvedResource[],
  negationPatterns: string[],
  baseDir: string,
): ResolvedResource[] {
  return resources.filter((resource) => {
    const normalized = normalize(resource.path);
    const relativePath = normalized.startsWith(baseDir)
      ? normalized.slice(baseDir.length).replace(/^\//, "")
      : normalized;

    // Check if this file matches any negation pattern
    const isExcluded = micromatch.isMatch(relativePath, negationPatterns, {
      dot: true,
    });

    return !isExcluded;
  });
}

/**
 * Deduplicates resources by path (last occurrence wins)
 */
function deduplicateResources(resources: ResolvedResource[]): ResolvedResource[] {
  const seen = new Map<string, ResolvedResource>();

  // Iterate in order, last one wins for each path
  for (const resource of resources) {
    const normalizedPath = normalize(resource.path);
    seen.set(normalizedPath, resource);
  }

  return Array.from(seen.values());
}
