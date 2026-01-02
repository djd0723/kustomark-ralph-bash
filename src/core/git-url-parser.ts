/**
 * Git URL parser for remote sources
 *
 * Supports three Git URL formats:
 * - GitHub shorthand: github.com/org/repo//path?ref=v1.2.0
 * - Full git URL: git::https://github.com/org/repo.git//subdir?ref=main
 * - SSH URL: git::git@github.com:org/repo.git//path?ref=abc1234
 */

import type { ParsedGitUrl } from "./types.js";

/**
 * Checks if a URL string is a Git URL
 */
export function isGitUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Check for git:: prefix
  if (url.startsWith("git::")) {
    return true;
  }

  // Check for GitHub shorthand pattern (starts with github.com/)
  if (url.startsWith("github.com/")) {
    return true;
  }

  return false;
}

/**
 * Parses a Git URL into its components
 *
 * @param url - The Git URL to parse
 * @returns Parsed Git URL object or null if invalid
 */
export function parseGitUrl(url: string): ParsedGitUrl | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  if (!isGitUrl(url)) {
    return null;
  }

  try {
    // Handle GitHub shorthand: github.com/org/repo//path?ref=v1.2.0
    if (url.startsWith("github.com/")) {
      return parseGitHubShorthand(url);
    }

    // Handle git:: prefixed URLs
    if (url.startsWith("git::")) {
      const urlWithoutPrefix = url.slice(5); // Remove 'git::'

      // Detect SSH vs HTTPS
      if (urlWithoutPrefix.startsWith("git@")) {
        return parseGitSshUrl(urlWithoutPrefix);
      }
      if (urlWithoutPrefix.startsWith("https://") || urlWithoutPrefix.startsWith("http://")) {
        return parseGitHttpsUrl(urlWithoutPrefix);
      }
    }

    return null;
  } catch (error) {
    // Return null for any parsing errors
    return null;
  }
}

/**
 * Parses GitHub shorthand format: github.com/org/repo//path?ref=v1.2.0
 */
function parseGitHubShorthand(url: string): ParsedGitUrl | null {
  // Split on '//' to separate repo URL from path, but we need to extract
  // ref from both parts to handle cases like:
  // - github.com/org/repo?ref=v1//path
  // - github.com/org/repo//path?ref=v1
  // - github.com/org/repo?ref=v1//path?ref=v2 (v2 wins)

  const parts = url.split("//");
  const repoPartWithQuery = parts[0];
  const subpathWithQuery = parts.length > 1 ? parts.slice(1).join("//") : undefined;

  if (!repoPartWithQuery) {
    return null;
  }

  // Extract ref from repo part
  const { baseUrl: repoUrl, ref: refFromRepo } = extractRefFromQuery(repoPartWithQuery);

  // Extract ref and path from subpath part
  let subpath: string | undefined;
  let refFromSubpath: string | undefined;

  if (subpathWithQuery) {
    const extracted = extractRefFromQuery(subpathWithQuery);
    subpath = extracted.baseUrl || undefined;
    refFromSubpath = extracted.ref;
  }

  // Prefer ref from subpath, fall back to repo ref, then default to main
  const ref = refFromSubpath || refFromRepo || "main";

  // Parse: github.com/org/repo
  const urlParts = repoUrl.split("/");
  if (urlParts.length < 3) {
    return null;
  }

  const host = urlParts[0];
  const org = urlParts[1];
  const repo = urlParts[2];

  if (!host || !org || !repo) {
    return null;
  }

  // Remove .git suffix if present
  const cleanRepo = repo.endsWith(".git") ? repo.slice(0, -4) : repo;

  const fullUrl = `https://${host}/${org}/${cleanRepo}.git`;

  return {
    type: "git",
    protocol: "https",
    host,
    org,
    repo: cleanRepo,
    path: subpath,
    ref,
    fullUrl,
    cloneUrl: fullUrl,
  };
}

/**
 * Parses git HTTPS URL: https://github.com/org/repo.git//subdir?ref=main
 */
function parseGitHttpsUrl(url: string): ParsedGitUrl | null {
  // Special handling: If URL has no subpath, it won't have '//' delimiter after the protocol
  // We need to preserve the protocol:// part and extract ref from both repo and subpath parts

  // Check if there's a subpath delimiter (// after the repo URL)
  // The first // is the protocol (https://), so we look for additional //
  const protocolEndIndex = url.indexOf("://");
  if (protocolEndIndex === -1) {
    return null;
  }

  const afterProtocol = url.slice(protocolEndIndex + 3); // Skip past '://'
  const subpathIndex = afterProtocol.indexOf("//");

  let repoPartWithQuery: string;
  let subpathWithQuery: string | undefined;

  if (subpathIndex !== -1) {
    // Has subpath
    repoPartWithQuery = url.slice(0, protocolEndIndex + 3 + subpathIndex);
    subpathWithQuery = afterProtocol.slice(subpathIndex + 2); // Skip past '//'
  } else {
    // No subpath
    repoPartWithQuery = url;
    subpathWithQuery = undefined;
  }

  // Extract ref from repo part
  const { baseUrl: repoUrl, ref: refFromRepo } = extractRefFromQuery(repoPartWithQuery);

  // Extract ref and path from subpath part
  let subpath: string | undefined;
  let refFromSubpath: string | undefined;

  if (subpathWithQuery) {
    const extracted = extractRefFromQuery(subpathWithQuery);
    subpath = extracted.baseUrl || undefined;
    refFromSubpath = extracted.ref;
  }

  // Prefer ref from subpath, fall back to repo ref, then default to main
  const ref = refFromSubpath || refFromRepo || "main";

  // Handle protocol
  const httpsMatch = repoUrl.match(/^(https?):\/\/(.+)$/);
  if (!httpsMatch) {
    return null;
  }

  // Always use https protocol (httpsMatch[1] is either 'http' or 'https')
  const remainingUrl = httpsMatch[2];

  if (!remainingUrl) {
    return null;
  }

  // Parse host/org/repo
  const urlParts = remainingUrl.split("/");
  if (urlParts.length < 3) {
    return null;
  }

  const host = urlParts[0];
  const org = urlParts[1];
  const repoWithGit = urlParts[2];

  if (!host || !org || !repoWithGit) {
    return null;
  }

  // Remove .git suffix
  const repo = repoWithGit.endsWith(".git") ? repoWithGit.slice(0, -4) : repoWithGit;

  const fullUrl = `https://${host}/${org}/${repo}.git`;

  return {
    type: "git",
    protocol: "https",
    host,
    org,
    repo,
    path: subpath,
    ref,
    fullUrl,
    cloneUrl: fullUrl,
  };
}

/**
 * Parses git SSH URL: git@github.com:org/repo.git//path?ref=abc1234
 */
function parseGitSshUrl(url: string): ParsedGitUrl | null {
  // Split on '//' to separate repo URL from path, and extract ref from both parts

  const parts = url.split("//");
  const repoPartWithQuery = parts[0];
  const subpathWithQuery = parts.length > 1 ? parts.slice(1).join("//") : undefined;

  if (!repoPartWithQuery) {
    return null;
  }

  // Extract ref from repo part
  const { baseUrl: repoUrl, ref: refFromRepo } = extractRefFromQuery(repoPartWithQuery);

  // Extract ref and path from subpath part
  let subpath: string | undefined;
  let refFromSubpath: string | undefined;

  if (subpathWithQuery) {
    const extracted = extractRefFromQuery(subpathWithQuery);
    subpath = extracted.baseUrl || undefined;
    refFromSubpath = extracted.ref;
  }

  // Prefer ref from subpath, fall back to repo ref, then default to main
  const ref = refFromSubpath || refFromRepo || "main";

  // Parse: git@github.com:org/repo.git
  const sshMatch = repoUrl.match(/^git@([^:]+):(.+)$/);
  if (!sshMatch) {
    return null;
  }

  const host = sshMatch[1];
  const repoPath = sshMatch[2];

  if (!host || !repoPath) {
    return null;
  }

  // Parse org/repo.git
  const repoParts = repoPath.split("/");
  if (repoParts.length < 2) {
    return null;
  }

  const org = repoParts[0];
  const repoWithGit = repoParts[1];

  if (!org || !repoWithGit) {
    return null;
  }

  // Remove .git suffix
  const repo = repoWithGit.endsWith(".git") ? repoWithGit.slice(0, -4) : repoWithGit;

  const fullUrl = `https://${host}/${org}/${repo}.git`; // Always return HTTPS URL for clone

  return {
    type: "git",
    protocol: "ssh",
    host,
    org,
    repo,
    path: subpath,
    ref,
    fullUrl,
    cloneUrl: fullUrl,
  };
}

/**
 * Extracts ref query parameter from URL and returns base URL without query
 */
function extractRefFromQuery(url: string): { baseUrl: string; ref?: string } {
  const queryIndex = url.indexOf("?");

  if (queryIndex === -1) {
    return { baseUrl: url, ref: undefined };
  }

  const baseUrl = url.slice(0, queryIndex);
  const queryString = url.slice(queryIndex + 1);

  // Parse query string for ref parameter
  const params = new URLSearchParams(queryString);
  const ref = params.get("ref") || undefined;

  return { baseUrl, ref };
}
