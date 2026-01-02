# Snapshot Manager

The snapshot manager provides snapshot functionality for capturing and verifying build outputs, enabling regression testing and ensuring consistent build results across changes.

## Overview

Snapshots capture the complete state of your build output at a point in time. This allows you to:

1. **Verify builds** - Ensure that changes to your configuration or patches don't unexpectedly modify output
2. **Detect regressions** - Quickly identify when build output changes
3. **Baseline tracking** - Maintain known-good states of your build output
4. **CI/CD integration** - Automatically verify builds in continuous integration pipelines

## Key Features

- **File hashing** - SHA256 hashing for reliable content comparison
- **Manifest tracking** - Metadata storage with timestamps and version info
- **Detailed diffs** - Precise information about added, removed, and modified files
- **Incremental updates** - Update snapshots when intentional changes are made

## Core Functions

### `createSnapshot(buildResult, snapshotDir)`

Creates a new snapshot from build output.

```typescript
import { createSnapshot } from "./core/snapshot-manager.js";

const buildResult = {
  files: new Map([
    ["readme.md", "# My Project\n\nDocumentation"],
    ["docs/guide.md", "# Guide\n\nInstructions"],
  ]),
  success: true,
};

const manifest = await createSnapshot(buildResult, ".kustomark/snapshots");
console.log(`Created snapshot with ${manifest.fileCount} files`);
console.log(`Version: ${manifest.version}`);
console.log(`Timestamp: ${manifest.timestamp}`);
```

**Output:**
- Creates `.kustomark/snapshots/manifest.json` with metadata
- Copies all files to `.kustomark/snapshots/` preserving directory structure
- Returns manifest with file hashes, count, timestamp, and version

### `verifySnapshot(buildResult, snapshotDir)`

Compares current build output against a saved snapshot.

```typescript
import { verifySnapshot } from "./core/snapshot-manager.js";

const currentBuild = {
  files: new Map([
    ["readme.md", "# My Project\n\nUpdated docs"],
    ["docs/guide.md", "# Guide\n\nInstructions"],
    ["docs/api.md", "# API\n\nNew file"],
  ]),
  success: true,
};

const result = await verifySnapshot(currentBuild, ".kustomark/snapshots");

if (!result.matches) {
  console.log("Snapshot verification failed!");
  console.log(`Added: ${result.added.length} files`);
  console.log(`Removed: ${result.removed.length} files`);
  console.log(`Modified: ${result.modified.length} files`);

  for (const mod of result.modified) {
    console.log(`  - ${mod.file}`);
    console.log(`    Expected: ${mod.expectedHash}`);
    console.log(`    Actual:   ${mod.actualHash}`);
  }
}
```

**Returns:**
```typescript
{
  matches: false,
  added: ["docs/api.md"],
  removed: [],
  modified: [
    {
      file: "readme.md",
      expectedHash: "a1b2c3...",
      actualHash: "d4e5f6..."
    }
  ],
  manifest: { /* snapshot manifest */ }
}
```

### `updateSnapshot(buildResult, snapshotDir)`

Updates an existing snapshot with new build output.

```typescript
import { updateSnapshot } from "./core/snapshot-manager.js";

const newBuild = {
  files: new Map([
    ["readme.md", "# My Project\n\nUpdated baseline"],
    ["docs/api.md", "# API\n\nNew accepted state"],
  ]),
  success: true,
};

// Update the snapshot to accept these changes as the new baseline
const manifest = await updateSnapshot(newBuild, ".kustomark/snapshots");
console.log(`Updated snapshot at ${manifest.timestamp}`);
```

### `loadSnapshot(snapshotDir)`

Loads an existing snapshot manifest from disk.

```typescript
import { loadSnapshot } from "./core/snapshot-manager.js";

const manifest = await loadSnapshot(".kustomark/snapshots");

if (manifest) {
  console.log(`Snapshot created at: ${manifest.timestamp}`);
  console.log(`Kustomark version: ${manifest.version}`);
  console.log(`File count: ${manifest.fileCount}`);
  console.log("Files:");
  for (const [path, hash] of Object.entries(manifest.fileHashes)) {
    console.log(`  ${path}: ${hash.slice(0, 8)}...`);
  }
} else {
  console.log("No snapshot found");
}
```

### `calculateFileHash(content)`

Calculates SHA256 hash of file content.

```typescript
import { calculateFileHash } from "./core/snapshot-manager.js";

const content = "# Hello World\n\nThis is a test.";
const hash = calculateFileHash(content);
console.log(hash); // "315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3"
```

## Snapshot Manifest Format

The `manifest.json` file contains:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "0.1.0",
  "fileHashes": {
    "readme.md": "315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3",
    "docs/guide.md": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890"
  },
  "fileCount": 2
}
```

**Fields:**
- `timestamp` - ISO 8601 timestamp when snapshot was created
- `version` - Kustomark version used to create the snapshot
- `fileHashes` - Map of file paths to SHA256 hashes
- `fileCount` - Total number of files in the snapshot

## Workflow Examples

### Basic Build Verification

```typescript
import { createSnapshot, verifySnapshot } from "./core/snapshot-manager.js";

// Step 1: Create initial snapshot
const initialBuild = await runBuild();
await createSnapshot(initialBuild, ".kustomark/snapshots");

// Step 2: Make some changes to your config
// ... modify kustomark.config.ts ...

// Step 3: Verify new build matches snapshot
const newBuild = await runBuild();
const result = await verifySnapshot(newBuild, ".kustomark/snapshots");

if (!result.matches) {
  console.error("Build output changed unexpectedly!");
  process.exit(1);
}
```

### Intentional Updates

```typescript
import { verifySnapshot, updateSnapshot } from "./core/snapshot-manager.js";

const build = await runBuild();
const result = await verifySnapshot(build, ".kustomark/snapshots");

if (!result.matches) {
  console.log("Changes detected:");
  console.log(`  Added: ${result.added.join(", ")}`);
  console.log(`  Modified: ${result.modified.map(m => m.file).join(", ")}`);

  // Prompt user or check if running in CI
  const shouldUpdate = await promptUser("Update snapshot?");

  if (shouldUpdate) {
    await updateSnapshot(build, ".kustomark/snapshots");
    console.log("Snapshot updated successfully");
  }
}
```

### CI/CD Integration

```typescript
// In your CI pipeline
import { verifySnapshot } from "./core/snapshot-manager.js";

async function ciVerifyBuild() {
  const build = await runBuild();

  try {
    const result = await verifySnapshot(build, ".kustomark/snapshots");

    if (!result.matches) {
      console.error("❌ Snapshot verification failed!");

      if (result.added.length > 0) {
        console.error(`Added files: ${result.added.join(", ")}`);
      }

      if (result.removed.length > 0) {
        console.error(`Removed files: ${result.removed.join(", ")}`);
      }

      if (result.modified.length > 0) {
        console.error("Modified files:");
        for (const mod of result.modified) {
          console.error(`  - ${mod.file}`);
        }
      }

      process.exit(1);
    }

    console.log("✓ Snapshot verification passed");
  } catch (error) {
    console.error("Error during snapshot verification:", error);
    process.exit(1);
  }
}
```

## Directory Structure

Typical snapshot directory layout:

```
.kustomark/snapshots/
├── manifest.json              # Snapshot metadata
├── readme.md                  # Snapshotted file
├── docs/
│   ├── guide.md              # Snapshotted file
│   └── api.md                # Snapshotted file
└── assets/
    └── logo.png              # Snapshotted file
```

## Error Handling

### Missing Snapshot

```typescript
try {
  const result = await verifySnapshot(build, ".kustomark/snapshots");
} catch (error) {
  if (error.message.includes("No snapshot found")) {
    console.log("Creating initial snapshot...");
    await createSnapshot(build, ".kustomark/snapshots");
  } else {
    throw error;
  }
}
```

### Invalid Manifest

If the manifest is corrupted or invalid, `loadSnapshot()` returns `null`:

```typescript
const manifest = await loadSnapshot(".kustomark/snapshots");

if (!manifest) {
  console.log("Invalid or missing snapshot, recreating...");
  await createSnapshot(build, ".kustomark/snapshots");
}
```

## Best Practices

1. **Version Control** - Commit snapshots to version control for team consistency
2. **Regular Updates** - Update snapshots when intentionally changing output
3. **CI Integration** - Run snapshot verification in CI to catch unintended changes
4. **Clear Diffs** - Use verification results to understand what changed
5. **Separate Environments** - Consider different snapshots for dev/staging/prod

## Performance Considerations

- **Hashing** - Uses Bun's native `CryptoHasher` for fast SHA256 computation
- **Streaming** - Files are read and written individually to minimize memory usage
- **Incremental** - Only modified files need to be re-hashed during verification
- **Disk Space** - Snapshots store full copies of files; clean old snapshots regularly

## Testing

The snapshot manager includes comprehensive tests covering:

- Hash calculation and consistency
- Snapshot creation and loading
- Verification with various change types
- Error handling for missing/invalid snapshots
- Full workflow integration tests

Run tests with:

```bash
bun test src/core/snapshot-manager.test.ts
```

## Type Definitions

```typescript
interface SnapshotManifest {
  timestamp: string;
  version: string;
  fileHashes: Record<string, string>;
  fileCount: number;
}

interface BuildResult {
  files: Map<string, string>;
  success: boolean;
}

interface SnapshotVerificationResult {
  matches: boolean;
  added: string[];
  removed: string[];
  modified: Array<{
    file: string;
    expectedHash: string;
    actualHash: string;
  }>;
  manifest: SnapshotManifest;
}
```
