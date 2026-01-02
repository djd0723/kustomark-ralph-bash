/**
 * Document lifecycle management and caching for LSP server
 */

import { TextDocuments } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocument as TextDocumentImpl } from "vscode-languageserver-textdocument";
import { parseConfig } from "../core/config-parser.js";
import type { KustomarkConfig } from "../core/types.js";

/**
 * Manages document lifecycle and caches parsed configurations
 * Provides efficient access to parsed configs without re-parsing on every request
 */
export class DocumentManager {
  /** Map of document URIs to TextDocument instances */
  private documents: Map<string, TextDocument>;

  /** Cache of parsed KustomarkConfig objects by document URI */
  private configCache: Map<string, KustomarkConfig>;

  /** Cache of parse errors by document URI */
  private parseErrorCache: Map<string, Error>;

  constructor() {
    this.documents = new Map();
    this.configCache = new Map();
    this.parseErrorCache = new Map();
  }

  /**
   * Called when a document is opened in the editor
   * Stores the document and parses its config
   *
   * @param document - The opened text document
   */
  onDocumentOpen(document: TextDocument): void {
    const uri = document.uri;
    this.documents.set(uri, document);

    // Parse and cache the config
    this.parseAndCacheConfig(uri, document.getText());
  }

  /**
   * Called when a document's content changes
   * Updates the cached document and re-parses the config
   *
   * @param document - The updated text document
   */
  onDocumentChange(document: TextDocument): void {
    const uri = document.uri;
    this.documents.set(uri, document);

    // Re-parse and update cache
    this.parseAndCacheConfig(uri, document.getText());
  }

  /**
   * Called when a document is closed
   * Cleans up cached data
   *
   * @param uri - URI of the closed document
   */
  onDocumentClose(uri: string): void {
    this.documents.delete(uri);
    this.configCache.delete(uri);
    this.parseErrorCache.delete(uri);
  }

  /**
   * Gets a TextDocument by URI
   *
   * @param uri - Document URI
   * @returns The TextDocument, or undefined if not found
   */
  getDocument(uri: string): TextDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Gets the parsed KustomarkConfig for a document
   * Returns cached version if available, otherwise parses and caches
   *
   * @param uri - Document URI
   * @returns The parsed config, or null if parsing failed
   */
  getParsedConfig(uri: string): KustomarkConfig | null {
    // Check if we have a cached config
    const cachedConfig = this.configCache.get(uri);
    if (cachedConfig) {
      return cachedConfig;
    }

    // Check if we have a cached parse error
    if (this.parseErrorCache.has(uri)) {
      return null;
    }

    // Try to parse the document
    const document = this.documents.get(uri);
    if (!document) {
      return null;
    }

    return this.parseAndCacheConfig(uri, document.getText());
  }

  /**
   * Gets the parse error for a document, if any
   *
   * @param uri - Document URI
   * @returns The parse error, or undefined if no error
   */
  getParseError(uri: string): Error | undefined {
    return this.parseErrorCache.get(uri);
  }

  /**
   * Checks if a document has a parse error
   *
   * @param uri - Document URI
   * @returns True if the document has a parse error
   */
  hasParseError(uri: string): boolean {
    return this.parseErrorCache.has(uri);
  }

  /**
   * Gets all managed document URIs
   *
   * @returns Array of document URIs
   */
  getAllDocumentUris(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Clears all caches
   * Useful for testing or when you want to force re-parsing
   */
  clearCache(): void {
    this.configCache.clear();
    this.parseErrorCache.clear();
  }

  /**
   * Parses document content and updates the cache
   *
   * @param uri - Document URI
   * @param content - Document content
   * @returns The parsed config, or null if parsing failed
   */
  private parseAndCacheConfig(uri: string, content: string): KustomarkConfig | null {
    try {
      const config = parseConfig(content);

      // Cache the successful parse
      this.configCache.set(uri, config);
      this.parseErrorCache.delete(uri);

      return config;
    } catch (error) {
      // Cache the error
      this.parseErrorCache.set(uri, error instanceof Error ? error : new Error(String(error)));
      this.configCache.delete(uri);

      return null;
    }
  }
}

/**
 * Creates a TextDocuments manager that integrates with the DocumentManager
 * This provides the standard LSP document sync capabilities
 *
 * @param documentManager - The DocumentManager instance to integrate with
 * @returns A configured TextDocuments instance
 */
export function createTextDocumentsManager(
  documentManager: DocumentManager,
): TextDocuments<TextDocument> {
  const textDocuments = new TextDocuments(TextDocumentImpl);

  // Hook into document lifecycle events
  textDocuments.onDidOpen((event) => {
    documentManager.onDocumentOpen(event.document);
  });

  textDocuments.onDidChangeContent((event) => {
    documentManager.onDocumentChange(event.document);
  });

  textDocuments.onDidClose((event) => {
    documentManager.onDocumentClose(event.document.uri);
  });

  return textDocuments;
}
