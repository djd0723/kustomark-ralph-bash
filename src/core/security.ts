/**
 * Security validation for remote resources
 */

import type { SecurityConfig } from "./types.js";

/**
 * Error thrown when a resource fails security validation
 */
export class SecurityValidationError extends Error {
  public readonly resourceUrl: string;
  public readonly violationType: "host" | "protocol";

  constructor(message: string, resourceUrl: string, violationType: "host" | "protocol") {
    super(message);
    this.name = "SecurityValidationError";
    this.resourceUrl = resourceUrl;
    this.violationType = violationType;
  }
}

/**
 * Extracts the protocol from a URL or resource string
 *
 * @param resourceUrl - The resource URL to extract the protocol from
 * @returns The protocol (e.g., 'https', 'git', 'ssh') or null if not found
 */
function extractProtocol(resourceUrl: string): string | null {
  // Handle git:: prefix (e.g., git::https://...)
  if (resourceUrl.startsWith("git::")) {
    const afterGit = resourceUrl.slice(5);
    const protocolMatch = afterGit.match(/^([a-z]+):\/\//);
    if (protocolMatch?.[1]) {
      return protocolMatch[1];
    }
    // git::git@... is SSH
    if (afterGit.startsWith("git@")) {
      return "ssh";
    }
    return "git";
  }

  // Handle standard URLs with protocol (https://, http://, etc.)
  const urlMatch = resourceUrl.match(/^([a-z]+):\/\//);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  // Handle SSH format (git@github.com:...)
  if (resourceUrl.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:/)) {
    return "ssh";
  }

  // Handle GitHub shorthand (github.com/org/repo)
  if (resourceUrl.match(/^github\.com\//)) {
    return "https";
  }

  return null;
}

/**
 * Strips authentication credentials and port numbers from a hostname
 *
 * @param hostPart - The hostname part that may include user:pass@ or :port
 * @returns The clean hostname
 */
function cleanHostname(hostPart: string): string {
  // Remove authentication credentials (user:pass@)
  const withoutAuth = hostPart.replace(/^[^@]+@/, "");

  // Remove port number (:8080)
  const withoutPort = withoutAuth.replace(/:\d+$/, "");

  return withoutPort;
}

/**
 * Extracts the hostname from a URL or resource string
 *
 * @param resourceUrl - The resource URL to extract the hostname from
 * @returns The hostname (e.g., 'github.com', 'example.com') or null if not found
 */
function extractHost(resourceUrl: string): string | null {
  // Handle git:: prefix (e.g., git::https://github.com/...)
  if (resourceUrl.startsWith("git::")) {
    const afterGit = resourceUrl.slice(5);

    // git::https://github.com/... or git::http://...
    const httpMatch = afterGit.match(/^https?:\/\/([^/]+)/);
    if (httpMatch?.[1]) {
      return cleanHostname(httpMatch[1]);
    }

    // git::git@github.com:...
    const sshMatch = afterGit.match(/^git@([^:]+):/);
    if (sshMatch?.[1]) {
      return cleanHostname(sshMatch[1]);
    }
  }

  // Handle standard URLs (https://github.com/...)
  const urlMatch = resourceUrl.match(/^[a-z]+:\/\/([^/]+)/);
  if (urlMatch?.[1]) {
    return cleanHostname(urlMatch[1]);
  }

  // Handle SSH format (git@github.com:...)
  const sshMatch = resourceUrl.match(/^[a-zA-Z0-9._-]+@([^:]+):/);
  if (sshMatch?.[1]) {
    return cleanHostname(sshMatch[1]);
  }

  // Handle GitHub shorthand (github.com/org/repo)
  const githubMatch = resourceUrl.match(/^([a-zA-Z0-9.-]+)\//);
  if (githubMatch?.[1]) {
    return cleanHostname(githubMatch[1]);
  }

  return null;
}

/**
 * Validates a resource URL against security configuration
 *
 * @param resourceUrl - The resource URL to validate
 * @param security - Optional security configuration with allowedHosts and allowedProtocols
 * @throws {SecurityValidationError} If the resource fails security validation
 *
 * @example
 * ```typescript
 * const security = {
 *   allowedHosts: ['github.com', 'internal.company.com'],
 *   allowedProtocols: ['https', 'git']
 * };
 *
 * // This will pass
 * validateResourceSecurity('https://github.com/org/repo', security);
 *
 * // This will throw SecurityValidationError
 * validateResourceSecurity('https://malicious.com/repo', security);
 * ```
 */
export function validateResourceSecurity(resourceUrl: string, security?: SecurityConfig): void {
  // If no security config, allow everything
  if (!security) {
    return;
  }

  // Validate protocol if allowedProtocols is specified
  if (security.allowedProtocols && security.allowedProtocols.length > 0) {
    const protocol = extractProtocol(resourceUrl);

    if (!protocol) {
      throw new SecurityValidationError(
        `Cannot determine protocol from resource URL: ${resourceUrl}`,
        resourceUrl,
        "protocol",
      );
    }

    if (!security.allowedProtocols.includes(protocol)) {
      throw new SecurityValidationError(
        `Protocol "${protocol}" is not allowed. Allowed protocols: ${security.allowedProtocols.join(", ")}`,
        resourceUrl,
        "protocol",
      );
    }
  }

  // Validate host if allowedHosts is specified
  if (security.allowedHosts && security.allowedHosts.length > 0) {
    const host = extractHost(resourceUrl);

    if (!host) {
      throw new SecurityValidationError(
        `Cannot determine host from resource URL: ${resourceUrl}`,
        resourceUrl,
        "host",
      );
    }

    if (!security.allowedHosts.includes(host)) {
      throw new SecurityValidationError(
        `Host "${host}" is not allowed. Allowed hosts: ${security.allowedHosts.join(", ")}`,
        resourceUrl,
        "host",
      );
    }
  }
}
