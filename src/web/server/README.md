# Kustomark Web Server

Complete server-side infrastructure for the kustomark web UI, providing a REST API and WebSocket support for real-time updates.

## Architecture

```
src/web/server/
├── index.ts                    # Main entry point with server startup
├── server.ts                   # Express app factory and configuration
├── types.ts                    # TypeScript type definitions
├── package.json                # Server dependencies
├── middleware/
│   ├── validation.ts          # Request validation middleware
│   └── error-handler.ts       # Global error handling
├── routes/
│   ├── build.ts               # Build execution endpoints
│   └── config.ts              # Config CRUD endpoints
└── services/
    ├── build-service.ts       # Build execution logic
    ├── config-service.ts      # Config management logic
    └── file-service.ts        # File operations with security

```

## Components

### Main Server (`index.ts`, `server.ts`)

- **Express App Factory**: Creates and configures the Express application
- **Middleware Setup**: JSON parsing, CORS, request logging
- **Route Registration**: Mounts API routes under `/api/*`
- **WebSocket Support**: Optional WebSocket server for live updates
- **Health Check**: `/health` endpoint for monitoring
- **Graceful Shutdown**: Handles SIGTERM/SIGINT signals

### Type Definitions (`types.ts`)

Core types for the server:

- `ServerConfig`: Server configuration options
- `TypedRequest<T>`: Type-safe Express request wrapper
- `BuildRequest`/`BuildResponse`: Build API types
- `ConfigSaveRequest`/`ConfigSaveResponse`: Config save API types
- `FileContent`: File read response
- `ValidateResponse`: Config validation response
- `WebSocketMessage`: WebSocket message types
- `ErrorResponse`: Error response structure

### Middleware

#### Validation (`middleware/validation.ts`)

Request validation middleware functions:

- `validateRequiredFields(fields)`: Ensures required fields exist
- `validateString(field)`: Validates field is a string
- `validateBoolean(field)`: Validates field is a boolean
- `validateNumber(field)`: Validates field is a number
- `validateStringArray(field)`: Validates field is an array of strings
- `validateObject(field)`: Validates field is an object

#### Error Handler (`middleware/error-handler.ts`)

Global error handling:

- `HttpError`: Custom error class with status codes
- `errorHandler`: Global error middleware (catches all errors)
- `notFoundHandler`: 404 handler for unknown routes
- `asyncHandler`: Wrapper for async route handlers

### Routes

#### Build Routes (`routes/build.ts`)

**POST `/api/build`**
- Executes a kustomark build
- Request body:
  - `configPath`: Path to config file (required)
  - `incremental`: Enable incremental build (optional)
  - `clean`: Clean build (optional)
  - `enableGroups`: Array of groups to enable (optional)
  - `disableGroups`: Array of groups to disable (optional)
- Response: Build result with stats

#### Config Routes (`routes/config.ts`)

**GET `/api/config`**
- Get config file content
- Query params: `path` (required)
- Response: File content

**POST `/api/config`**
- Save config file
- Request body:
  - `path`: Config file path (required)
  - `content`: YAML content (required)
- Response: Success status

**POST `/api/config/validate`**
- Validate config file or content
- Request body (one of):
  - `path`: Config file path to validate
  - `content`: YAML content to validate
- Response: Validation result with errors/warnings

**GET `/api/config/schema`**
- Get JSON schema for kustomark config
- Response: JSON schema object

### Services

#### Build Service (`services/build-service.ts`)

Core build execution logic:

- `executeBuild()`: Main build function
  - Validates config has output directory
  - Resolves resources using core library
  - Applies patch inheritance
  - Filters patches by group
  - Applies patches to resources
  - Runs global validators
  - Writes output files
  - Returns build statistics
- Helper functions:
  - `applyPatchesToResources()`: Apply patches to resource map
  - `shouldApplyPatchGroup()`: Group filtering logic
  - `shouldApplyPatch()`: File pattern matching

#### Config Service (`services/config-service.ts`)

Config file management:

- `loadConfig()`: Load and validate config file
- `saveConfig()`: Save and validate config file
- `validateConfigFile()`: Validate config file
- `validateConfigContent()`: Validate YAML content
- `getConfigSchema()`: Get JSON schema for configs

#### File Service (`services/file-service.ts`)

Safe file operations with path traversal protection:

- `readFile()`: Read file with security checks
- `writeFile()`: Write file with directory creation
- `listDirectory()`: List directory contents
- `fileExists()`: Check file existence
- `validatePath()`: Prevent path traversal attacks

## Security Features

### Path Traversal Protection

All file operations validate paths to prevent access outside the base directory:

```typescript
// Blocks paths like: ../../../etc/passwd
validatePath(baseDir, filePath)
```

### Request Validation

All API endpoints validate input:

```typescript
router.post(
  "/api/build",
  validateRequiredFields(["configPath"]),
  validateString("configPath"),
  // ... handler
);
```

### Error Handling

Errors are sanitized before being sent to clients:

- 400: Bad Request (validation errors)
- 403: Forbidden (path traversal detected)
- 404: Not Found (file not found)
- 500: Internal Server Error (other errors)

## Integration with Core Library

The server integrates directly with the kustomark core library:

```typescript
import { parseConfig, validateConfig } from "../../../core/config-parser.js";
import { resolveResources } from "../../../core/resource-resolver.js";
import { applyPatches } from "../../../core/patch-engine.js";
import { resolveInheritance } from "../../../core/patch-inheritance.js";
import { runValidators } from "../../../core/validators.js";
```

This provides:
- Native performance (no CLI subprocess)
- Direct access to all features
- Consistent error handling
- Type safety across the stack

## WebSocket Support

Optional WebSocket server for live updates:

```typescript
// Server broadcasts messages to all connected clients
broadcast({
  type: "build-completed",
  result: buildResponse
});

// Client receives real-time updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle build-started, build-completed, build-error, file-changed
};
```

## Configuration

Server configuration via environment variables:

- `KUSTOMARK_PORT`: Server port (default: 3000)
- `KUSTOMARK_HOST`: Host to bind (default: localhost)
- `KUSTOMARK_BASE_DIR`: Base directory for file operations (default: cwd)
- `KUSTOMARK_CORS`: Enable CORS (default: true)
- `KUSTOMARK_VERBOSE`: Enable verbose logging (default: false)
- `KUSTOMARK_WEBSOCKET`: Enable WebSocket (default: true)

Or via command-line arguments:

```bash
bun src/web/server/index.ts --port 3000 --host localhost --base-dir /path/to/project --verbose
```

## Running the Server

### Development

```bash
# Run with Bun
bun src/web/server/index.ts

# Run with auto-reload
bun --watch src/web/server/index.ts

# With options
bun src/web/server/index.ts --port 8080 --verbose
```

### Production

```bash
# Build
bun build src/web/server/index.ts --outdir dist/server --target node

# Run
node dist/server/index.js
```

## API Examples

### Execute Build

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "kustomark.yaml",
    "enableGroups": ["prod"]
  }'
```

### Get Config

```bash
curl "http://localhost:3000/api/config?path=kustomark.yaml"
```

### Save Config

```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "path": "kustomark.yaml",
    "content": "apiVersion: kustomark/v1\nkind: Kustomization\n..."
  }'
```

### Validate Config

```bash
curl -X POST http://localhost:3000/api/config/validate \
  -H "Content-Type: application/json" \
  -d '{
    "content": "apiVersion: kustomark/v1\nkind: Kustomization\n..."
  }'
```

## Dependencies

Core dependencies (defined in `package.json`):

- `express`: Web framework
- `cors`: CORS middleware
- `ws`: WebSocket server
- `js-yaml`: YAML parsing
- `micromatch`: Glob pattern matching

All dependencies are already included in the root `package.json`.

## Testing

The server can be tested using:

1. **Unit tests**: Test individual services and middleware
2. **Integration tests**: Test API endpoints with supertest
3. **Manual testing**: Use curl or Postman

Example test structure:

```typescript
import { createApp } from "./server.js";
import request from "supertest";

describe("Build API", () => {
  it("should execute a build", async () => {
    const app = createApp(config);
    const response = await request(app)
      .post("/api/build")
      .send({ configPath: "test/kustomark.yaml" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

## Future Enhancements

Potential improvements:

1. **Authentication**: Add user authentication and authorization
2. **Rate Limiting**: Prevent abuse with rate limiting
3. **Caching**: Cache config validation results
4. **Streaming**: Stream large build outputs
5. **Incremental Builds**: Full incremental build support
6. **Watch Mode**: Auto-rebuild on file changes
7. **Metrics**: Prometheus metrics endpoint
8. **Logging**: Structured logging with log levels
