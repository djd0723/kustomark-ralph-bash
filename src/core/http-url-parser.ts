/**
 * HTTP archive URL parser for remote sources
 *
 * Supports HTTP archive URLs:
 * - Direct archives: https://example.com/releases/v1.0.0/skills.tar.gz
 * - With subpath: https://example.com/release.tar.gz//subdir/
 * - Supported formats: .tar.gz, .tgz, .tar, .zip
 */

import type { ParsedHttpArchiveUrl } from "./types.js";

/**
 * Archive file extensions supported by the parser
 */
const ARCHIVE_EXTENSIONS = [".tar.gz", ".tgz", ".tar", ".zip"] as const;

/**
 * Archive type union
 */
export type ArchiveType = "tar.gz" | "tgz" | "tar" | "zip";

/**
 * Checks if a URL string is an HTTP archive URL
 *
 * Determines whether a URL points to a supported archive file by checking
 * if it starts with http:// or https:// and contains a recognized archive
 * extension (.tar.gz, .tgz, .tar, or .zip).
 *
 * @param {string} url - The URL to check
 * @returns {boolean} true if the URL is an HTTP archive URL, false otherwise
 *
 * @example
 * ```typescript
 * isHttpArchiveUrl('https://example.com/archive.tar.gz'); // true
 * isHttpArchiveUrl('https://example.com/package.zip'); // true
 * isHttpArchiveUrl('git::https://github.com/org/repo.git'); // false
 * isHttpArchiveUrl('https://example.com/file.txt'); // false
 * ```
 *
 * @example
 * ```typescript
 * // Check URL type before parsing
 * if (isHttpArchiveUrl(url)) {
 *   const parsed = parseHttpArchiveUrl(url);
 * }
 * ```
 */
export function isHttpArchiveUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Must start with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  // Check if URL contains any supported archive extension
  for (const ext of ARCHIVE_EXTENSIONS) {
    if (url.includes(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses an HTTP archive URL into its components
 *
 * Parses an HTTP archive URL and extracts all relevant components including
 * the base URL, archive type, optional subpath, and query parameters. The URL
 * must point to a supported archive format and can optionally specify a
 * subdirectory to extract using the '//' delimiter.
 *
 * @param {string} url - The HTTP archive URL to parse. Supported formats:
 *   - Direct: `https://example.com/releases/v1.0.0/package.tar.gz`
 *   - With subpath: `https://example.com/archive.tar.gz//subdir/`
 *   - With query params: `https://example.com/file.zip?token=abc`
 *   - Combined: `https://example.com/archive.tar.gz?token=abc//subdir/`
 * @returns {ParsedHttpArchiveUrl | null} Parsed HTTP archive URL object containing:
 *   - type: Always 'http-archive'
 *   - url: The base URL to the archive file (without subpath or query params)
 *   - subpath: Optional subdirectory path to extract from the archive
 *   - archiveType: The archive format ('tar.gz', 'tgz', 'tar', or 'zip')
 *   - queryParams: Object containing query parameters from the URL
 *   Returns null if the URL is invalid or has an unsupported format.
 *
 * @example
 * ```typescript
 * // Parse simple archive URL
 * const parsed = parseHttpArchiveUrl('https://example.com/release-v1.0.0.tar.gz');
 * console.log(parsed);
 * // {
 * //   type: 'http-archive',
 * //   url: 'https://example.com/release-v1.0.0.tar.gz',
 * //   archiveType: 'tar.gz',
 * //   queryParams: {}
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Parse with subpath
 * const parsed = parseHttpArchiveUrl('https://example.com/archive.tar.gz//docs/api/');
 * console.log(parsed?.subpath); // 'docs/api/'
 * console.log(parsed?.archiveType); // 'tar.gz'
 * ```
 *
 * @example
 * ```typescript
 * // Parse with query parameters
 * const parsed = parseHttpArchiveUrl('https://api.github.com/repos/org/repo/tarball?token=abc123');
 * console.log(parsed?.queryParams); // { token: 'abc123' }
 * ```
 *
 * @example
 * ```typescript
 * // Parse zip archive with subpath and query
 * const parsed = parseHttpArchiveUrl('https://example.com/package.zip?v=1.0//lib/');
 * console.log(parsed);
 * // {
 * //   type: 'http-archive',
 * //   url: 'https://example.com/package.zip',
 * //   subpath: 'lib/',
 * //   archiveType: 'zip',
 * //   queryParams: { v: '1.0' }
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Invalid URL returns null
 * const parsed = parseHttpArchiveUrl('https://example.com/file.txt');
 * console.log(parsed); // null (not an archive)
 * ```
 */
export function parseHttpArchiveUrl(url: string): ParsedHttpArchiveUrl | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  if (!isHttpArchiveUrl(url)) {
    return null;
  }

  try {
    // Detect archive type and find the position of the archive extension
    let archiveType: ArchiveType | null = null;
    let archiveExtIndex = -1;

    // Check for .tar.gz first (longest extension)
    for (const ext of ARCHIVE_EXTENSIONS) {
      const index = url.indexOf(ext);
      if (index !== -1) {
        // Map extension to archive type
        archiveType = ext.slice(1) as ArchiveType; // Remove leading dot
        archiveExtIndex = index;
        break;
      }
    }

    if (!archiveType || archiveExtIndex === -1) {
      return null;
    }

    // Calculate where the archive URL ends (after the extension)
    const archiveExtLength = `.${archiveType}`.length;
    const archiveEndIndex = archiveExtIndex + archiveExtLength;

    // Check if there's a subpath delimiter (//) anywhere in the remaining URL
    const remainingUrl = url.slice(archiveEndIndex);
    let baseUrl: string;
    let subpath: string | undefined;
    let queryParams: Record<string, string> = {};

    // Look for // delimiter in the remaining URL (could be after query params)
    const subpathDelimiterIndex = remainingUrl.indexOf("//");

    if (subpathDelimiterIndex !== -1) {
      // Has subpath - extract base URL + query params before //, and subpath after
      const beforeDelimiter = remainingUrl.slice(0, subpathDelimiterIndex);
      const afterDelimiter = remainingUrl.slice(subpathDelimiterIndex + 2); // Skip '//'

      // Parse base URL with query params
      const baseUrlWithQuery = url.slice(0, archiveEndIndex) + beforeDelimiter;
      const baseUrlParsed = extractQueryParams(baseUrlWithQuery);
      baseUrl = baseUrlParsed.baseUrl;
      queryParams = baseUrlParsed.queryParams;

      // Extract subpath (remove query params if present after //)
      const { baseUrl: cleanSubpath } = extractQueryParams(afterDelimiter);
      subpath = cleanSubpath || undefined;
    } else if (remainingUrl === "" || remainingUrl.startsWith("?")) {
      // No subpath, may have query params at the end
      const fullUrl = url.slice(0, archiveEndIndex) + remainingUrl;
      const parsed = extractQueryParams(fullUrl);
      baseUrl = parsed.baseUrl;
      queryParams = parsed.queryParams;
      subpath = undefined;
    } else {
      // Archive extension is in the middle of the URL but no // delimiter
      // This is not a valid archive URL format
      return null;
    }

    return {
      type: "http-archive",
      url: baseUrl,
      subpath,
      archiveType,
      queryParams,
    };
  } catch (error) {
    // Return null for any parsing errors
    return null;
  }
}

/**
 * Extracts query parameters from URL and returns base URL without query string
 *
 * @param url - URL with potential query string
 * @returns Object with baseUrl and queryParams
 */
function extractQueryParams(url: string): {
  baseUrl: string;
  queryParams: Record<string, string>;
} {
  const queryIndex = url.indexOf("?");

  if (queryIndex === -1) {
    return { baseUrl: url, queryParams: {} };
  }

  const baseUrl = url.slice(0, queryIndex);
  const queryString = url.slice(queryIndex + 1);

  // Parse query string into object
  const queryParams: Record<string, string> = {};
  const params = new URLSearchParams(queryString);

  for (const [key, value] of params.entries()) {
    queryParams[key] = value;
  }

  return { baseUrl, queryParams };
}
