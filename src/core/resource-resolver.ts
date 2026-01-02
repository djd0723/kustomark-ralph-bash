import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, normalize, resolve } from "node:path";
import micromatch from "micromatch";
import { fetchGitRepository, type GitFetchOptions } from "./git-fetcher.js";
import { isGitUrl, parseGitUrl } from "./git-url-parser.js";
import { fetchHttpArchive, type HttpFetchOptions } from "./http-fetcher.js";
import { isHttpArchiveUrl, parseHttpArchiveUrl } from "./http-url-parser.js";
import { SecurityValidationError, validateResourceSecurity } from "./security.js";
import type { LockFile, LockFileEntry, SecurityConfig } from "./types.js";

/**
 * Represents a resolved markdown file resource.
 *
 * This interface describes a markdown file that has been successfully resolved
 * from a resource pattern. It contains both the file's location and content,
 * along with metadata about how it was resolved.
 *
 * @example
 * ```typescript
 * const resource: ResolvedResource = {
 *   path: '/project/docs/api.md',
 *   content: '# API Documentation\n\n...',
 *   source: 'docs/**.md',
 *   baseDir: '/project'
 * };
 * ```
 */
export interface ResolvedResource {
  /**
   * Absolute path to the markdown file on the filesystem
   */
  path: string;

  /**
   * The complete content of the markdown file as a string
   */
  content: string;

  /**
   * The original resource pattern or URL that resolved to this file.
   * This helps trace which configuration entry led to this resource.
   *
   * @example 'docs/**.md'
   * @example 'git@github.com:user/repo.git//docs'
   * @example './README.md'
   */
  source: string;

  /**
   * The base directory used to resolve relative paths for this resource.
   * Optional - primarily used for resources from nested configs or remote sources.
   *
   * @example '/project'
   * @example '/tmp/git-cache/repo-abc123'
   */
  baseDir?: string;
}

/**
 * Error thrown when resource resolution fails.
 *
 * This custom error class provides additional context about which resource
 * failed to resolve and optionally includes the underlying cause of the failure.
 *
 * @example
 * ```typescript
 * try {
 *   await resolveResources(resources, baseDir, fileMap);
 * } catch (error) {
 *   if (error instanceof ResourceResolutionError) {
 *     console.error(`Failed to resolve: ${error.resource}`);
 *     console.error(`Reason: ${error.message}`);
 *     if (error.cause) {
 *       console.error(`Caused by: ${error.cause.message}`);
 *     }
 *   }
 * }
 * ```
 */
export class ResourceResolutionError extends Error {
  /**
   * The resource pattern or URL that failed to resolve
   */
  public readonly resource: string;

  /**
   * The underlying error that caused this resolution to fail, if any
   */
  public override readonly cause?: Error;

  /**
   * Creates a new ResourceResolutionError.
   *
   * @param message - A descriptive error message explaining what went wrong
   * @param resource - The resource pattern or URL that failed to resolve
   * @param cause - Optional underlying error that caused the resolution failure
   */
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
  resources?: (string | import("./types.js").ResourceObject)[];
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
  /** Git fetch options */
  gitFetchOptions?: GitFetchOptions;
  /** HTTP fetch options */
  httpFetchOptions?: HttpFetchOptions;
  /** Lock file to use for resolution */
  lockFile?: LockFile;
  /** Whether to update the lock file with new entries */
  updateLock?: boolean;
  /** Array to collect lock entries (mutated by function) */
  lockEntries?: LockFileEntry[];
  /** Security configuration for remote resource validation */
  security?: SecurityConfig;
}

/**
 * Resolves resource patterns to a flat list of markdown files.
 *
 * This is the core function for resolving Kustomark resources. It handles multiple
 * resource types including:
 * - Glob patterns (e.g., `**\/*.md`, `docs/*.md`)
 * - Direct file paths (e.g., `./README.md`)
 * - Directory references with kustomark.yaml (e.g., `./docs/`)
 * - Git repository URLs (e.g., `git@github.com:user/repo.git//path`)
 * - HTTP archive URLs (e.g., `https://example.com/archive.tar.gz//subpath`)
 * - Resource objects with authentication and integrity checking
 *
 * The function also handles:
 * - Negation patterns (prefixed with `!`) to exclude files
 * - Recursive config resolution with circular reference detection
 * - Lock file generation for reproducible builds
 * - Security validation for remote resources
 * - Deduplication of resolved files
 *
 * @param resources - Array of resource patterns, which can be:
 *   - String patterns (glob, file path, directory, or URL)
 *   - ResourceObject with url, auth, and sha256 fields
 * @param baseDir - Absolute path to the base directory for resolving relative paths
 * @param fileMap - Map containing file paths as keys and their content as values.
 *   This map is mutated by adding newly fetched files.
 * @param options - Optional configuration object with properties:
 *   - maxDepth: Maximum recursion depth for nested configs (default: 10)
 *   - currentDepth: Internal tracking of current recursion level
 *   - visited: Set of visited config paths for cycle detection
 *   - gitFetchOptions: Options for git repository fetching
 *   - httpFetchOptions: Options for HTTP archive fetching
 *   - lockFile: Existing lock file to use for resolution
 *   - updateLock: Whether to generate lock entries for new fetches
 *   - lockEntries: Array to collect lock entries (mutated)
 *   - security: Security configuration for validating remote resources
 *
 * @returns Promise that resolves to an array of ResolvedResource objects, each containing:
 *   - path: Absolute path to the markdown file
 *   - content: The file's content as a string
 *   - source: The original pattern that resolved to this file
 *   - baseDir: The base directory used for relative path resolution
 *
 * @throws {ResourceResolutionError} When:
 *   - Maximum recursion depth is exceeded (circular references)
 *   - A resource pattern cannot be resolved
 *   - A git repository cannot be fetched
 *   - An HTTP archive cannot be downloaded
 *   - Security validation fails
 *   - A referenced kustomark config is invalid
 *
 * @example
 * ```typescript
 * // Basic usage with glob patterns
 * const fileMap = new Map([
 *   ['/project/docs/api.md', '# API Docs'],
 *   ['/project/docs/README.md', '# README'],
 *   ['/project/docs/guide.md', '# Guide'],
 * ]);
 *
 * const resources = await resolveResources(
 *   ['docs/**.md', '!docs/README.md'],
 *   '/project',
 *   fileMap
 * );
 * // Returns: [api.md, guide.md] (README.md excluded)
 * ```
 *
 * @example
 * ```typescript
 * // Fetching from Git repository
 * const fileMap = new Map();
 * const resources = await resolveResources(
 *   ['git@github.com:user/repo.git//docs'],
 *   '/project',
 *   fileMap,
 *   { gitFetchOptions: { cacheDir: '/tmp/cache' } }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Using resource objects with authentication
 * const resources = await resolveResources(
 *   [{
 *     url: 'https://example.com/docs.tar.gz//content',
 *     auth: { type: 'bearer', tokenEnv: 'API_TOKEN' },
 *     sha256: 'abc123...'
 *   }],
 *   '/project',
 *   new Map()
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Recursive config resolution
 * const resources = await resolveResources(
 *   ['./subproject/'], // References ./subproject/kustomark.yaml
 *   '/project',
 *   fileMap,
 *   { maxDepth: 5 }
 * );
 * ```
 */
export async function resolveResources(
  resources: (string | import("./types.js").ResourceObject)[],
  baseDir: string,
  fileMap: Map<string, string>,
  options: ResolveOptions = {},
): Promise<ResolvedResource[]> {
  const {
    maxDepth = 10,
    currentDepth = 0,
    visited = new Set<string>(),
    lockFile,
    updateLock,
    lockEntries = [],
  } = options;

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
  // Also normalize resources to extract URL from objects
  const normalizedResources: Array<{
    pattern: string;
    auth?: import("./types.js").ResourceAuth;
    sha256?: string;
  }> = [];

  for (const resource of resources) {
    let pattern: string;
    let auth: import("./types.js").ResourceAuth | undefined;
    let sha256: string | undefined;

    // Check if resource is an object or string
    if (typeof resource === "string") {
      pattern = resource.trim();
    } else {
      // It's a ResourceObject
      pattern = resource.url.trim();
      auth = resource.auth;
      sha256 = resource.sha256;
    }

    if (!pattern) continue;

    if (pattern.startsWith("!")) {
      negationPatterns.push(pattern.slice(1));
    } else {
      positivePatterns.push(pattern);
      normalizedResources.push({ pattern, auth, sha256 });
    }
  }

  // Get all markdown files from fileMap that are under baseDir
  const allFiles = Array.from(fileMap.keys()).filter((filePath) => {
    const normalizedPath = normalize(filePath);
    return normalizedPath.startsWith(normalizedBaseDir) && normalizedPath.endsWith(".md");
  });

  // Process each positive pattern
  for (const resourceInfo of normalizedResources) {
    const { pattern, auth, sha256 } = resourceInfo;

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

      try {
        // Validate security before fetching
        validateResourceSecurity(pattern, options.security);

        // Prepare git fetch options with auth if provided
        const gitOptions: GitFetchOptions = {
          ...options.gitFetchOptions,
          update: updateLock,
        };

        // Add auth token from resource object if available
        if (auth) {
          if (auth.type === "bearer" && auth.tokenEnv) {
            const token = process.env[auth.tokenEnv];
            if (token) {
              gitOptions.authToken = token;
            }
          } else if (auth.type === "basic" && auth.username && auth.passwordEnv) {
            const password = process.env[auth.passwordEnv];
            if (password) {
              // For basic auth, we can construct a token in the format username:password
              gitOptions.authToken = `${auth.username}:${password}`;
            }
          }
        }

        // Fetch the git repository
        const fetchResult = await fetchGitRepository(pattern, gitOptions);

        // Collect lock entry if requested
        if ((updateLock || lockFile) && lockEntries) {
          lockEntries.push({
            url: pattern,
            resolved: fetchResult.resolvedSha,
            integrity: `sha256-${fetchResult.resolvedSha}`,
            fetched: new Date().toISOString(),
          });
        }

        // Determine the directory to search for markdown files
        const searchDir = parsedGit.path
          ? join(fetchResult.repoPath, parsedGit.path)
          : fetchResult.repoPath;

        // Verify the directory exists
        if (!existsSync(searchDir)) {
          throw new ResourceResolutionError(
            `Path not found in repository: ${parsedGit.path ?? "(root)"}`,
            pattern,
          );
        }

        // Recursively find all markdown files in the directory
        const gitMarkdownFiles = await findMarkdownFiles(searchDir);

        // Create file map entries for git files
        for (const filePath of gitMarkdownFiles) {
          const content = await readFile(filePath, "utf-8");
          fileMap.set(normalize(filePath), content);

          resolvedResources.push({
            path: normalize(filePath),
            content,
            source: pattern,
            baseDir: searchDir,
          });
        }
      } catch (error) {
        if (error instanceof ResourceResolutionError) {
          throw error;
        }
        if (error instanceof SecurityValidationError) {
          throw new ResourceResolutionError(
            `Security validation failed: ${error.message}`,
            pattern,
            error,
          );
        }
        throw new ResourceResolutionError(
          `Failed to fetch git repository: ${error instanceof Error ? error.message : String(error)}`,
          pattern,
          error instanceof Error ? error : undefined,
        );
      }
      continue; // Skip to next pattern after processing git URL
    }

    // Check if pattern is an HTTP archive URL
    if (isHttpArchiveUrl(pattern)) {
      // Validate that the HTTP archive URL is parseable
      const parsedHttp = parseHttpArchiveUrl(pattern);
      if (!parsedHttp) {
        throw new ResourceResolutionError(
          `Malformed HTTP archive URL: ${pattern}. Please check the URL format.`,
          pattern,
        );
      }

      try {
        // Validate security before fetching
        validateResourceSecurity(pattern, options.security);

        // Prepare HTTP fetch options with auth and sha256 if provided
        const httpOptions: HttpFetchOptions = {
          ...options.httpFetchOptions,
          subpath: parsedHttp.subpath,
          update: updateLock,
        };

        // Add auth token from resource object if available
        if (auth) {
          if (auth.type === "bearer" && auth.tokenEnv) {
            const token = process.env[auth.tokenEnv];
            if (token) {
              httpOptions.authToken = token;
            }
          } else if (auth.type === "basic" && auth.username && auth.passwordEnv) {
            const password = process.env[auth.passwordEnv];
            if (password) {
              // For HTTP basic auth, we can set headers
              const basicAuthHeader = `Basic ${Buffer.from(`${auth.username}:${password}`).toString("base64")}`;
              httpOptions.headers = {
                ...httpOptions.headers,
                Authorization: basicAuthHeader,
              };
            }
          }
        }

        // Add sha256 checksum if provided
        if (sha256) {
          httpOptions.sha256 = sha256;
        }

        // Fetch and extract the HTTP archive
        const fetchResult = await fetchHttpArchive(pattern, httpOptions);

        // Collect lock entry if requested
        if ((updateLock || lockFile) && lockEntries) {
          lockEntries.push({
            url: pattern,
            resolved: fetchResult.checksum,
            integrity: `sha256-${fetchResult.checksum}`,
            fetched: new Date().toISOString(),
          });
        }

        // Add each extracted file to the file map and resolved resources
        for (const file of fetchResult.files) {
          // Create a normalized path for the file
          const normalizedPath = normalize(join(normalizedBaseDir, file.path));

          // Add to file map
          fileMap.set(normalizedPath, file.content);

          // Add to resolved resources
          resolvedResources.push({
            path: normalizedPath,
            content: file.content,
            source: pattern,
            baseDir: normalizedBaseDir,
          });
        }
      } catch (error) {
        if (error instanceof ResourceResolutionError) {
          throw error;
        }
        if (error instanceof SecurityValidationError) {
          throw new ResourceResolutionError(
            `Security validation failed: ${error.message}`,
            pattern,
            error,
          );
        }
        throw new ResourceResolutionError(
          `Failed to fetch HTTP archive: ${error instanceof Error ? error.message : String(error)}`,
          pattern,
          error instanceof Error ? error : undefined,
        );
      }
      continue; // Skip to next pattern after processing HTTP URL
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

            const nestedResources = await resolveResources(config.resources, resolvedDir, fileMap, {
              maxDepth,
              currentDepth: currentDepth + 1,
              visited: newVisited,
              gitFetchOptions: options.gitFetchOptions,
              httpFetchOptions: options.httpFetchOptions,
              lockFile,
              updateLock,
              lockEntries,
              security: options.security,
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
            baseDir: normalizedBaseDir,
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

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      // Skip .git directory
      if (entry.name === ".git") {
        continue;
      }

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  await scan(dir);
  return results;
}
