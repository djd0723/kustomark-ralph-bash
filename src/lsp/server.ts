#!/usr/bin/env bun

/**
 * Kustomark Language Server
 *
 * Provides LSP features for kustomark.yaml files:
 * - Real-time validation and diagnostics
 * - Autocomplete for fields and operations
 * - Hover documentation
 * - Go-to-definition for resource paths
 * - Document symbols (outline view)
 */

import {
  type CodeAction,
  type CodeActionParams,
  type CompletionItem,
  createConnection,
  type Hover,
  type InitializeParams,
  type InitializeResult,
  ProposedFeatures,
  type TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CodeActionsProvider } from "./code-actions.js";
import { CompletionProvider } from "./completion.js";
import { DefinitionProvider } from "./definition.js";
import { DiagnosticsProvider } from "./diagnostics.js";
import { DocumentManager } from "./document-manager.js";
import { DocumentSymbolsProvider } from "./document-symbols.js";
import { HoverProvider } from "./hover.js";

// Create LSP connection (stdio transport)
const connection = createConnection(ProposedFeatures.all);

// Create text document manager
const documents = new TextDocuments(TextDocument);

// Initialize providers
const documentManager = new DocumentManager();
const diagnosticsProvider = new DiagnosticsProvider();
const completionProvider = new CompletionProvider();
const hoverProvider = new HoverProvider();
const definitionProvider = new DefinitionProvider();
const documentSymbolsProvider = new DocumentSymbolsProvider();
const codeActionsProvider = new CodeActionsProvider();

// Server initialization
connection.onInitialize((_params: InitializeParams): InitializeResult => {
  connection.console.log("Kustomark LSP Server initializing...");

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ["-", " ", ":", "\n"],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      codeActionProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("Kustomark LSP Server initialized successfully");
});

// Document lifecycle handlers
documents.onDidOpen((e) => {
  connection.console.log(`Document opened: ${e.document.uri}`);
  documentManager.onDocumentOpen(e.document);
  validateDocument(e.document);
});

documents.onDidChangeContent((e) => {
  connection.console.log(`Document changed: ${e.document.uri}`);
  documentManager.onDocumentChange(e.document);
  validateDocument(e.document);
});

documents.onDidClose((e) => {
  connection.console.log(`Document closed: ${e.document.uri}`);
  documentManager.onDocumentClose(e.document.uri);
  // Clear diagnostics for closed document
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

/**
 * Validate a document and send diagnostics
 */
function validateDocument(document: TextDocument): void {
  try {
    const diagnostics = diagnosticsProvider.provideDiagnostics(document.uri, document.getText());
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
  } catch (error) {
    connection.console.error(`Error validating document ${document.uri}: ${error}`);
  }
}

// Completion handler
connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    return completionProvider.provideCompletions(document, params.position);
  } catch (error) {
    connection.console.error(`Error providing completions: ${error}`);
    return [];
  }
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  try {
    return completionProvider.resolveCompletion(item);
  } catch (error) {
    connection.console.error(`Error resolving completion: ${error}`);
    return item;
  }
});

// Hover handler
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    return hoverProvider.provideHover(document, params.position);
  } catch (error) {
    connection.console.error(`Error providing hover: ${error}`);
    return null;
  }
});

// Definition handler
connection.onDefinition((params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    return definitionProvider.provideDefinition(document, params.position);
  } catch (error) {
    connection.console.error(`Error providing definition: ${error}`);
    return null;
  }
});

// Code actions handler
connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    return codeActionsProvider.provideCodeActions(document, params);
  } catch (error) {
    connection.console.error(`Error providing code actions: ${error}`);
    return [];
  }
});

// Document symbols handler
connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    return documentSymbolsProvider.provideDocumentSymbols(document);
  } catch (error) {
    connection.console.error(`Error providing document symbols: ${error}`);
    return [];
  }
});

// Start listening for connections
documents.listen(connection);
connection.listen();

connection.console.log("Kustomark LSP Server started and listening...");
