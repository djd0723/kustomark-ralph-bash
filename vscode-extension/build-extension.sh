#!/bin/bash
set -e

echo "Building Kustomark VSCode Extension..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Build the LSP server
echo "Building LSP server..."
bun run build:lsp

# Copy LSP server to extension directory
echo "Copying LSP server to extension..."
mkdir -p vscode-extension/dist/lsp
cp dist/lsp/server.js vscode-extension/dist/lsp/

# Navigate to extension directory
cd vscode-extension

# Install dependencies
echo "Installing extension dependencies..."
npm install

# Generate JSON schema
echo "Generating JSON schema..."
cd ..
bun run src/cli/index.ts schema > vscode-extension/schemas/kustomark.schema.json
cd vscode-extension

# Compile TypeScript
echo "Compiling extension..."
npm run compile

# Package extension
echo "Packaging extension..."
npm run package

echo "Build complete! VSIX file created: kustomark-vscode-0.1.0.vsix"
echo ""
echo "To install:"
echo "  1. Open VSCode"
echo "  2. Press Ctrl+Shift+P (Cmd+Shift+P on Mac)"
echo "  3. Type 'Extensions: Install from VSIX'"
echo "  4. Select the kustomark-vscode-0.1.0.vsix file"
