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
 * @param url - The URL to check
 * @returns True if the URL is an HTTP archive URL
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
 * Supports formats:
 * - https://example.com/releases/v1.0.0/skills.tar.gz
 * - https://example.com/release.tar.gz//subdir/
 *
 * @param url - The HTTP archive URL to parse
 * @returns Parsed HTTP archive URL object or null if invalid
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
