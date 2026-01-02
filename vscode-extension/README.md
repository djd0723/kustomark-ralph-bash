# Kustomark VSCode Extension

Language support for Kustomark configuration files with LSP-powered features.

## Features

- **Autocomplete**: Intelligent suggestions for patch operations, fields, and enum values
- **Real-time Validation**: Instant feedback on configuration errors and warnings
- **Hover Documentation**: Rich markdown documentation for all fields and operations
- **JSON Schema Integration**: Editor validation for `kustomark.yaml` files

## Installation

### From VSIX (Local Development)

1. Build the extension:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npm run package
   ```

2. Install the generated `.vsix` file:
   - Open VSCode
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Extensions: Install from VSIX"
   - Select the generated `kustomark-vscode-0.1.0.vsix` file

### From VSCode Marketplace (Coming Soon)

Search for "Kustomark" in the VSCode Extensions marketplace.

## Usage

The extension automatically activates when you open a `kustomark.yaml` or `kustomark.yml` file.

### Available Features

1. **Autocomplete**: Start typing in a `kustomark.yaml` file to see suggestions:
   - Root fields: `apiVersion`, `kind`, `output`, `resources`, `patches`, `validators`
   - Patch operations: All 18 operations (replace, remove-section, etc.)
   - Common fields: `include`, `exclude`, `onNoMatch`, `group`, `id`, `extends`, `validate`

2. **Validation**: Real-time error and warning messages as you type:
   - Missing required fields
   - Invalid field values
   - Malformed git URLs
   - Schema validation

3. **Hover Documentation**: Hover over any field to see detailed documentation

## Configuration

The extension contributes the following settings:

- `kustomark.trace.server`: Trace LSP communication (off/messages/verbose)
- `kustomark.lsp.enabled`: Enable/disable the LSP server (default: true)
- `kustomark.validation.enabled`: Enable/disable real-time validation (default: true)

## Requirements

- VSCode version 1.75.0 or higher
- The Kustomark LSP server is bundled with this extension

## Known Issues

None at this time. Please report issues at: https://github.com/dexhorthy/kustomark-ralph-bash/issues

## Release Notes

### 0.1.0

Initial release with:
- LSP server integration
- Autocomplete for all patch operations
- Real-time validation
- Hover documentation
- JSON Schema support

## License

MIT
