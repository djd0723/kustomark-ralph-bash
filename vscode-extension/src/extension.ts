import * as path from "node:path";
import type { ExtensionContext } from "vscode";
import {
	type LanguageClientOptions,
	LanguageClient,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
	// Get the LSP server module path
	// The server is built separately and should be in the extension's dist folder
	const serverModule = context.asAbsolutePath(
		path.join("..", "dist", "lsp", "server.js"),
	);

	// Debug options for the server
	const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

	// Server options: run the LSP server using Node.js
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.stdio,
		},
		debug: {
			module: serverModule,
			transport: TransportKind.stdio,
			options: debugOptions,
		},
	};

	// Client options: configure which files the LSP should handle
	const clientOptions: LanguageClientOptions = {
		// Register the server for kustomark.yaml files
		documentSelector: [
			{
				scheme: "file",
				pattern: "**/kustomark.{yaml,yml}",
			},
		],
		synchronize: {
			// Notify the server about file changes to kustomark.yaml files
			fileEvents: [],
		},
	};

	// Create and start the language client
	client = new LanguageClient(
		"kustomark",
		"Kustomark Language Server",
		serverOptions,
		clientOptions,
	);

	// Start the client (and launch the server)
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
