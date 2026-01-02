/**
 * LSP Definition Provider
 *
 * Provides go-to-definition functionality for:
 * - Resource paths (file paths in resources array)
 * - Base config references in overlays
 */

import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Definition, Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Definition provider for kustomark.yaml files
 */
export class DefinitionProvider {
  /**
   * Provide definition location for the symbol at the given position
   *
   * Supports:
   * - Resource paths (files, directories)
   * - Base config references
   *
   * @param document - The text document
   * @param position - The cursor position
   * @returns Definition location(s) or null
   */
  provideDefinition(document: TextDocument, position: Position): Definition | null {
    const text = document.getText();
    const lines = text.split("\n");
    const currentLine = lines[position.line] || "";

    // Extract the value from the current line
    // Look for patterns like: "- path/to/file.md" or "  - kustomark://config.yaml"
    const value = this.extractPathValue(currentLine);
    if (!value) {
      return null;
    }

    // Skip git URLs, HTTP URLs, and glob patterns
    if (
      value.startsWith("git::") ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.includes("github.com/") ||
      value.includes("*")
    ) {
      return null;
    }

    // Handle kustomark:// references
    let filePath = value;
    if (value.startsWith("kustomark://")) {
      filePath = value.replace("kustomark://", "");
    }

    // Resolve the file path
    return this.resolveFilePath(document, filePath);
  }

  /**
   * Extract a path value from a YAML line
   * Handles both quoted and unquoted strings
   *
   * @param line - The line to extract from
   * @returns The extracted path or null
   */
  private extractPathValue(line: string): string | null {
    // Match patterns like:
    // - "path/to/file.md"
    // - 'path/to/file.md'
    // - path/to/file.md
    // - kustomark://config.yaml

    // First, check if it's in the resources array (starts with -)
    const resourceMatch = line.match(/^\s*-\s+["']?([^"'\n]+?)["']?\s*$/);
    if (resourceMatch?.[1]) {
      return resourceMatch[1].trim();
    }

    // Also check for field values like "output: path/to/dir"
    const fieldMatch = line.match(/:\s+["']?([^"'\n]+?)["']?\s*$/);
    if (fieldMatch?.[1]) {
      return fieldMatch[1].trim();
    }

    return null;
  }

  /**
   * Resolve a file path to a definition location
   *
   * @param document - The source document
   * @param filePath - The file or directory path
   * @returns Definition location or null
   */
  private resolveFilePath(document: TextDocument, filePath: string): Definition | null {
    try {
      // Get the directory containing the config file
      const configUri = document.uri;
      const configPath = fileURLToPath(configUri);
      const configDir = dirname(configPath);

      // Resolve the path relative to the config directory
      const absolutePath = isAbsolute(filePath) ? filePath : join(configDir, filePath);

      // Check if the path exists
      if (!existsSync(absolutePath)) {
        return null;
      }

      // Get file stats to determine if it's a file or directory
      const stats = statSync(absolutePath);

      // For files, return the location
      if (stats.isFile()) {
        const targetUri = pathToFileURL(absolutePath).href;
        return {
          uri: targetUri,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
        };
      }

      // For directories, we can't provide a single definition
      // In the future, we could show a list of files or open the directory
      return null;
    } catch (_error) {
      // Path doesn't exist or can't be accessed
      return null;
    }
  }
}
