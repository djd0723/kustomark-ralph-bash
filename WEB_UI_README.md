# Kustomark Web UI

Visual editor for Kustomark configurations with real-time preview and validation.

## Features

- **Visual Patch Editor**: Create and edit patches through an intuitive UI
- **Live Validation**: Real-time configuration validation with error highlighting
- **YAML Editor**: Direct YAML editing with syntax highlighting
- **Diff Viewer**: Compare changes before saving
- **Build Integration**: Execute builds directly from the UI
- **WebSocket Support**: Live updates and notifications

## Quick Start

### Development Mode

Run both client and server in development mode with hot reload:

```bash
# Using the CLI
bun run dist/cli/index.js web --dev

# Or using npm scripts
bun run dev:web
```

This will start:
- Backend API server at `http://localhost:3000`
- Frontend dev server at `http://localhost:5173` (with Vite HMR)

### Production Mode

Build and run the optimized production server:

```bash
# Build everything
bun run build:all

# Run production server
bun run start:web

# Or using the CLI
bun run dist/cli/index.js web
```

The production server serves both the API and static client files at `http://localhost:3000`.

## Build Scripts

### Root package.json Scripts

- `build:web:client` - Build the React client with Vite
- `build:web:server` - Build the Express server
- `build:web` - Build both client and server
- `dev:web:client` - Run Vite dev server for client
- `dev:web:server` - Run development server
- `dev:web` - Run both client and server in dev mode
- `start:web` - Run production server

### Client-specific Scripts (in src/web/client)

- `dev` - Start Vite dev server
- `build` - Build for production
- `preview` - Preview production build
- `type-check` - Run TypeScript type checking

## CLI Usage

### Basic Usage

```bash
# Launch web UI in current directory
kustomark web

# Launch in specific directory
kustomark web ./my-project

# Development mode with hot reload
kustomark web --dev

# Custom port and host
kustomark web --port 8080 --host 0.0.0.0
```

### CLI Options

- `--dev, -d` - Run in development mode with hot reload
- `--port <port>` - Server port (default: 3000)
- `--host <host>` - Server host (default: localhost)
- `--open, -o` - Open browser automatically
- `-v` - Verbose logging

## Architecture

### Directory Structure

```
src/web/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API client
│   │   ├── types/       # TypeScript types
│   │   ├── App.tsx      # Main app component
│   │   ├── main.tsx     # Entry point
│   │   └── index.css    # Global styles
│   ├── package.json     # Client dependencies
│   ├── vite.config.ts   # Vite configuration
│   └── tsconfig.json    # TypeScript config
│
└── server/              # Express backend
    ├── routes/          # API routes
    │   ├── config.ts    # Config CRUD operations
    │   └── build.ts     # Build execution
    ├── services/        # Business logic
    │   ├── config-service.ts
    │   ├── file-service.ts
    │   └── build-service.ts
    ├── middleware/      # Express middleware
    │   ├── error-handler.ts
    │   └── validation.ts
    ├── types.ts         # Server TypeScript types
    └── index.ts         # Server entry point
```

### API Endpoints

#### Config Management

- `GET /api/config?path=<path>` - Get config file content
- `POST /api/config` - Save config file
- `POST /api/config/validate` - Validate config
- `GET /api/config/schema` - Get JSON schema

#### Build Operations

- `POST /api/build` - Execute a build

#### WebSocket

- `ws://localhost:3000/ws` - WebSocket endpoint for live updates

### Tech Stack

#### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Monaco Editor for code editing
- React Markdown for previews
- React Diff Viewer for diffs

#### Backend
- Express.js for HTTP server
- WebSocket (ws) for real-time updates
- CORS support for development
- Built-in file validation and security

## Configuration

### Environment Variables

Server configuration can be customized via environment variables:

```bash
KUSTOMARK_PORT=3000          # Server port
KUSTOMARK_HOST=localhost     # Server host
KUSTOMARK_BASE_DIR=.         # Base directory for file operations
KUSTOMARK_CORS=true          # Enable CORS
KUSTOMARK_VERBOSE=false      # Enable verbose logging
KUSTOMARK_WEBSOCKET=true     # Enable WebSocket support
```

### Vite Proxy Configuration

The client dev server proxies API requests to the backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/ws': { target: 'http://localhost:3000', ws: true }
  }
}
```

## Development

### Setup

1. Install dependencies:
```bash
# Root dependencies (server)
bun install

# Client dependencies
cd src/web/client
bun install
cd ../../..
```

2. Build the CLI:
```bash
bun run build
```

3. Start development servers:
```bash
bun run dev:web
```

### Hot Reload

In development mode:
- **Client**: Vite provides instant HMR for React components
- **Server**: Restart required for server changes (use `bun run dev:web:server`)

### Adding New API Endpoints

1. Create route handler in `src/web/server/routes/`
2. Add types to `src/web/server/types.ts`
3. Register route in `src/web/server/index.ts`
4. Update API client in `src/web/client/src/services/api.ts`

### Adding New UI Components

1. Create component in `src/web/client/src/components/`
2. Add types to `src/web/client/src/types/`
3. Import and use in `App.tsx` or other components

## Security

### Path Traversal Protection

The server validates all file paths to prevent directory traversal attacks:
- All paths are resolved relative to `KUSTOMARK_BASE_DIR`
- Paths attempting to access parent directories are rejected
- File operations are restricted to the base directory tree

### CORS

CORS is enabled by default in development. For production, configure allowed origins:

```typescript
// src/web/server/index.ts
cors({
  origin: ['https://your-domain.com'],
  credentials: true
})
```

## Troubleshooting

### Port Already in Use

If port 3000 is in use:
```bash
kustomark web --port 8080
```

### Build Errors

1. Clean build artifacts:
```bash
rm -rf dist/web
bun run build:web
```

2. Reinstall dependencies:
```bash
bun install
cd src/web/client && bun install
```

### WebSocket Connection Issues

- Check firewall settings
- Ensure `KUSTOMARK_WEBSOCKET=true`
- Verify proxy configuration in Vite

## Future Enhancements

- [ ] File explorer sidebar
- [ ] Multi-file editing
- [ ] Drag-and-drop patch reordering
- [ ] Visual merge conflict resolution
- [ ] Build history and rollback
- [ ] Collaborative editing support
- [ ] Plugin system for custom operations

## Contributing

See the main project README for contribution guidelines.

## License

Same as the main Kustomark project.
