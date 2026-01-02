# HTTP Archive Fetcher Module

The HTTP Archive Fetcher module provides functionality for downloading, extracting, and caching HTTP/HTTPS archives in kustomark.

## Features

- **Archive Format Support**: Supports `.tar.gz`, `.tgz`, `.tar`, and `.zip` formats
- **Intelligent Caching**: Downloads are cached in `~/.cache/kustomark/http/` to avoid redundant downloads
- **Subpath Extraction**: Extract only specific subdirectories from archives
- **Checksum Validation**: Verify archive integrity with SHA256 checksums
- **Authentication**: Support for bearer token authentication via environment variables or options
- **Error Handling**: Custom error class with detailed error codes and status codes

## Installation

The module is part of kustomark's core library and requires no additional installation.

## Basic Usage

```typescript
import { fetchHttpArchive } from 'kustomark';

// Fetch and extract a tar.gz archive
const result = await fetchHttpArchive(
  'https://example.com/archive.tar.gz'
);

console.log(`Extracted ${result.files.length} files`);
for (const file of result.files) {
  console.log(`${file.path}: ${file.content.length} bytes`);
}
```

## API Reference

### `fetchHttpArchive(url: string, options?: HttpFetchOptions): Promise<HttpFetchResult>`

Downloads and extracts an HTTP archive.

**Parameters:**
- `url` (string): URL of the archive to fetch (must end with `.tar.gz`, `.tgz`, `.tar`, or `.zip`)
- `options` (HttpFetchOptions, optional):
  - `cacheDir` (string): Custom cache directory (defaults to `~/.cache/kustomark/http`)
  - `authToken` (string): Bearer token for authentication (overrides env vars)
  - `sha256` (string): SHA256 checksum to validate the downloaded file
  - `subpath` (string): Subpath to extract from the archive (e.g., `"docs/"`)
  - `update` (boolean): Whether to update an existing cached archive
  - `timeout` (number): Timeout in milliseconds for HTTP requests (default: 60000)
  - `headers` (Record<string, string>): Additional HTTP headers

**Returns:**
- `HttpFetchResult`:
  - `files` (ExtractedFile[]): Array of extracted files with paths and contents
  - `cached` (boolean): Whether the archive was fetched from cache
  - `checksum` (string): SHA256 checksum of the downloaded archive

**Example:**
```typescript
const result = await fetchHttpArchive(
  'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
  {
    subpath: 'package/',
    sha256: '6a087ac9e5702a0c9d60fbcd48696012646ec8df1491dea472b150e79fcaf804',
    timeout: 60000,
  }
);
```

### `clearHttpCache(cacheDir?: string, pattern?: string): Promise<number>`

Clears the HTTP archive cache.

**Parameters:**
- `cacheDir` (string, optional): Cache directory to clear (defaults to `~/.cache/kustomark/http`)
- `pattern` (string, optional): Optional pattern to match cache keys (partial hash match)

**Returns:**
- Number of cache entries cleared

**Example:**
```typescript
// Clear all cache
const cleared = await clearHttpCache();
console.log(`Cleared ${cleared} cache entries`);

// Clear specific cache entry by pattern
await clearHttpCache(undefined, '462999c3');
```

### `listHttpCache(cacheDir?: string): Promise<string[]>`

Lists cached HTTP archives.

**Parameters:**
- `cacheDir` (string, optional): Cache directory to list (defaults to `~/.cache/kustomark/http`)

**Returns:**
- Array of cache keys (16-character hex strings)

**Example:**
```typescript
const cached = await listHttpCache();
for (const key of cached) {
  console.log(`Cached archive: ${key}`);
}
```

### `getCacheInfo(url: string, cacheDir?: string): Promise<{ exists: boolean; checksum?: string; path?: string } | null>`

Gets metadata about a cached archive.

**Parameters:**
- `url` (string): The URL of the archive
- `cacheDir` (string, optional): Cache directory (defaults to `~/.cache/kustomark/http`)

**Returns:**
- Object with cache information or null if not cached:
  - `exists` (boolean): Whether the cache exists
  - `checksum` (string, optional): SHA256 checksum of the cached file
  - `path` (string, optional): Path to the cached archive file

**Example:**
```typescript
const info = await getCacheInfo('https://example.com/archive.tar.gz');
if (info && info.exists) {
  console.log(`Cached at: ${info.path}`);
  console.log(`Checksum: ${info.checksum}`);
}
```

### `getDefaultCacheDir(): string`

Gets the default cache directory.

**Returns:**
- Path to the default cache directory (`~/.cache/kustomark/http`)

## Authentication

The HTTP fetcher supports bearer token authentication through:

1. **Environment Variable**: Set `KUSTOMARK_HTTP_TOKEN` environment variable
2. **Options Parameter**: Pass `authToken` in the options

```typescript
// Using environment variable
process.env.KUSTOMARK_HTTP_TOKEN = 'your-token-here';
await fetchHttpArchive('https://private.example.com/archive.tar.gz');

// Using options parameter
await fetchHttpArchive(
  'https://private.example.com/archive.tar.gz',
  { authToken: 'your-token-here' }
);
```

## Checksum Validation

Ensure archive integrity by providing a SHA256 checksum:

```typescript
const result = await fetchHttpArchive(
  'https://example.com/archive.tar.gz',
  {
    sha256: 'abc123...', // Expected SHA256 hash
  }
);
```

If the checksum doesn't match, a `HttpFetchError` with code `CHECKSUM_MISMATCH` is thrown.

## Subpath Extraction

Extract only specific subdirectories from archives:

```typescript
const result = await fetchHttpArchive(
  'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
  {
    subpath: 'package/', // Only extract files under package/
  }
);

// Files in result.files will have the subpath stripped
// e.g., "package/index.js" becomes "index.js"
```

## Error Handling

The module uses a custom `HttpFetchError` class with detailed error information:

```typescript
import { fetchHttpArchive, HttpFetchError } from 'kustomark';

try {
  await fetchHttpArchive('https://example.com/archive.tar.gz');
} catch (error) {
  if (error instanceof HttpFetchError) {
    console.error(`Error code: ${error.code}`);
    console.error(`Status code: ${error.statusCode}`);
    console.error(`Message: ${error.message}`);
  }
}
```

**Error Codes:**
- `UNSUPPORTED_FORMAT`: Archive format not supported
- `HTTP_ERROR`: HTTP request failed (check `statusCode` property)
- `TIMEOUT`: Operation timed out
- `DOWNLOAD_FAILED`: Failed to download file
- `EXTRACTION_FAILED`: Failed to extract archive
- `CHECKSUM_MISMATCH`: Checksum validation failed
- `INVALID_COMMAND`: Internal error with command execution

## Supported Archive Formats

The module automatically detects the archive format based on the file extension:

- **`.tar.gz`**: Gzipped tar archive
- **`.tgz`**: Gzipped tar archive (shorthand)
- **`.tar`**: Uncompressed tar archive
- **`.zip`**: ZIP archive

## Cache Structure

The cache is organized as follows:

```
~/.cache/kustomark/http/
├── archives/
│   ├── 462999c3f0f020b2.tgz    # Cached archive files
│   └── a1b2c3d4e5f6g7h8.tar.gz
└── extracted/
    ├── 462999c3f0f020b2/        # Extracted contents
    └── a1b2c3d4e5f6g7h8/
```

Cache keys are generated using the first 16 characters of the SHA256 hash of the URL.

## Performance Considerations

- **Caching**: Archives are cached locally to avoid redundant downloads
- **Extraction**: Files are extracted to a temporary directory and read into memory
- **Binary Files**: Binary files that cannot be read as UTF-8 are skipped
- **Large Archives**: Be aware that all extracted files are loaded into memory

## Examples

See `/examples/http-fetcher-example.ts` for a comprehensive example demonstrating all features.

## Implementation Details

- Uses Bun's native `fetch()` for HTTP requests
- Uses system `tar` and `unzip` commands for extraction
- Uses Bun's `CryptoHasher` for SHA256 checksums
- Follows the same patterns as `git-fetcher.ts` for consistency
