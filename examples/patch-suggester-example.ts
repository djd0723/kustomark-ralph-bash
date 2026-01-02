#!/usr/bin/env bun

/**
 * Example demonstrating the patch suggester functionality
 *
 * This example shows how to use the patch suggester to analyze
 * differences between two markdown files and get intelligent
 * patch operation suggestions.
 */

import { analyzeDiff, scorePatches, suggestPatches } from "../src/core/patch-suggester.js";

const sourceContent = `---
title: My API Documentation
version: 1.0.0
author: Original Author
---

# Introduction

Welcome to the API documentation for version 1.0.0.

## Getting Started

To get started, install the package:

\`\`\`bash
npm install my-api@1.0.0
\`\`\`

## Authentication

Use your API key to authenticate:

\`\`\`javascript
const client = new APIClient({ apiKey: 'your-key' });
\`\`\`

## Endpoints

### GET /users

Retrieves all users.

### POST /users

Creates a new user.

## Troubleshooting

If you encounter issues, contact support.
`;

const targetContent = `---
title: My API Documentation
version: 2.0.0
author: Original Author
maintainer: New Maintainer
---

# Introduction

Welcome to the API documentation for version 2.0.0.

## Getting Started

To get started, install the package:

\`\`\`bash
npm install my-api@2.0.0
\`\`\`

## Authentication

Use your API key to authenticate:

\`\`\`javascript
const client = new APIClient({ apiKey: 'your-key', version: '2.0.0' });
\`\`\`

## Endpoints

### GET /users

Retrieves all users with pagination support.

### POST /users

Creates a new user.

### DELETE /users/:id

Deletes a user by ID.

## Support

If you encounter issues, contact our support team at support@example.com.
`;

console.log("=== Patch Suggester Example ===\n");

// 1. Analyze differences
console.log("1. Analyzing differences...\n");
const analysis = analyzeDiff(sourceContent, targetContent);

console.log(`   Frontmatter changes:`);
console.log(`   - Added fields: ${Object.keys(analysis.frontmatterChanges.added).join(", ") || "none"}`);
console.log(`   - Removed fields: ${analysis.frontmatterChanges.removed.join(", ") || "none"}`);
console.log(`   - Modified fields: ${Object.keys(analysis.frontmatterChanges.modified).join(", ") || "none"}`);

console.log(`\n   Section changes:`);
console.log(`   - Total changes: ${analysis.sectionChanges.length}`);
for (const change of analysis.sectionChanges) {
  console.log(`     • ${change.type}: ${change.sectionId}`);
}

console.log(`\n   Line-level changes:`);
console.log(`   - Added lines: ${analysis.addedLines.length}`);
console.log(`   - Removed lines: ${analysis.removedLines.length}`);
console.log(`   - Modified lines: ${analysis.modifiedLines.length}`);

// 2. Suggest patches
console.log("\n2. Suggesting patches...\n");
const patches = suggestPatches(sourceContent, targetContent);

console.log(`   Total suggested patches: ${patches.length}\n`);

// 3. Score patches
console.log("3. Scoring patches by confidence...\n");
const scoredPatches = scorePatches(patches, sourceContent, targetContent);

console.log("   Top suggestions (sorted by confidence):\n");
for (const { patch, score, description } of scoredPatches.slice(0, 10)) {
  console.log(`   [${(score * 100).toFixed(0)}%] ${description}`);
  console.log(`        Operation: ${patch.op}`);
  console.log("");
}

// 4. Generate a kustomization file from suggestions
console.log("\n4. Generated kustomization.yaml:\n");

const kustomization = {
  apiVersion: "kustomark/v1",
  kind: "Kustomization",
  resources: ["docs/api.md"],
  patches: scoredPatches
    .filter((p) => p.score > 0.7) // Only high-confidence patches
    .map((p) => p.patch),
};

console.log("```yaml");
console.log("apiVersion: kustomark/v1");
console.log("kind: Kustomization");
console.log("resources:");
console.log("  - docs/api.md");
console.log("\npatches:");
for (const patch of kustomization.patches) {
  console.log(`  - op: ${patch.op}`);
  for (const [key, value] of Object.entries(patch)) {
    if (key !== "op") {
      const valueStr = typeof value === "string" && value.length > 50
        ? `"${value.substring(0, 47)}..."`
        : JSON.stringify(value);
      console.log(`    ${key}: ${valueStr}`);
    }
  }
}
console.log("```");

console.log("\n=== Example Complete ===\n");
