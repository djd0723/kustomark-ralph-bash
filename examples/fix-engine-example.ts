/**
 * Example usage of the fix-engine
 *
 * This demonstrates how to use the fix-engine to analyze failed patches
 * and apply intelligent fixes.
 */

import { applyPatches } from "../src/core/patch-engine.js";
import {
  analyzeFilePatchFailures,
  applyAutoFix,
  generateFixSuggestions,
  type FixSuggestion,
} from "../src/core/fix-engine.js";
import type { PatchOperation } from "../src/core/types.js";

// Example 1: Simple case-insensitive fix
console.log("=== Example 1: Case-Insensitive String Replacement ===\n");

const content1 = "HELLO world! Welcome to the guide.";
const patches1: PatchOperation[] = [
  { op: "replace", old: "hello", new: "hi" }, // Will fail - case mismatch
];

const failures1 = analyzeFilePatchFailures(content1, patches1);
console.log(`Found ${failures1.length} failed patch(es)`);

if (failures1[0]) {
  console.log(`\nFix suggestion:`);
  console.log(`  Strategy: ${failures1[0].strategy}`);
  console.log(`  Confidence: ${failures1[0].confidence}%`);
  console.log(`  Description: ${failures1[0].description}`);

  // Apply the fix
  const fixResult = applyAutoFix(content1, failures1[0]);
  if (fixResult.success) {
    console.log(`\n  Fixed content: ${fixResult.content}`);
  }
}

// Example 2: Section name typo
console.log("\n\n=== Example 2: Section Name Typo ===\n");

const content2 = `# Introduction

Welcome to the documentation.

# Getting Started

Follow these steps to get started.

# Configuration

Configure your application.`;

const patches2: PatchOperation[] = [
  { op: "remove-section", id: "introductio" }, // Typo: should be "introduction"
  { op: "replace", old: "started", new: "going" }, // Will succeed
];

const failures2 = analyzeFilePatchFailures(content2, patches2);
console.log(`Found ${failures2.length} failed patch(es)`);

if (failures2[0]) {
  console.log(`\nFix suggestion:`);
  console.log(`  Strategy: ${failures2[0].strategy}`);
  console.log(`  Confidence: ${failures2[0].confidence}%`);
  console.log(`  Description: ${failures2[0].description}`);

  if (failures2[0].modifiedPatch) {
    console.log(`  Suggested section ID: ${(failures2[0].modifiedPatch as any).id}`);
  }
}

// Example 3: Fuzzy matching for similar strings
console.log("\n\n=== Example 3: Fuzzy String Matching ===\n");

const content3 = "The configuration file is located in the settings directory.";
const patches3: PatchOperation[] = [
  { op: "replace", old: "confiuration", new: "setup" }, // Typo: missing 'g'
];

const failures3 = analyzeFilePatchFailures(content3, patches3);
console.log(`Found ${failures3.length} failed patch(es)`);

if (failures3[0]) {
  console.log(`\nFix suggestion:`);
  console.log(`  Strategy: ${failures3[0].strategy}`);
  console.log(`  Confidence: ${failures3[0].confidence}%`);
  console.log(`  Description: ${failures3[0].description}`);

  if (failures3[0].fuzzyMatches) {
    console.log(`\n  Fuzzy matches:`);
    for (const match of failures3[0].fuzzyMatches.slice(0, 3)) {
      console.log(`    - "${match.value}" (distance: ${match.distance}, confidence: ${match.confidence}%)`);
    }
  }

  // Apply the fix with a lower confidence threshold
  const fixResult = applyAutoFix(content3, failures3[0], 70);
  if (fixResult.success) {
    console.log(`\n  Fixed content: ${fixResult.content}`);
  }
}

// Example 4: Multiple patch failures with batch analysis
console.log("\n\n=== Example 4: Batch Analysis of Multiple Failures ===\n");

const content4 = `---
title: API Documentation
version: 1.0
---

# Overview

This is the API documentation.

# Endpoints

## GET /users

Returns a list of users.

## POST /users

Creates a new user.`;

const patches4: PatchOperation[] = [
  { op: "set-frontmatter", key: "author", value: "John Doe" }, // Succeeds
  { op: "remove-section", id: "endponts" }, // Typo
  { op: "replace", old: "documantation", new: "guide" }, // Typo
  { op: "replace", old: "user", new: "account" }, // Succeeds
];

const failures4 = analyzeFilePatchFailures(content4, patches4);
console.log(`Found ${failures4.length} failed patch(es) out of ${patches4.length} total patches`);

for (const failure of failures4) {
  console.log(`\nPatch #${failure.patchIndex}:`);
  console.log(`  Original patch: ${JSON.stringify(failure.originalPatch)}`);
  console.log(`  Strategy: ${failure.strategy}`);
  console.log(`  Confidence: ${failure.confidence}%`);
  console.log(`  Description: ${failure.description}`);

  // Try to auto-fix high-confidence failures
  if (failure.confidence >= 75) {
    const fixResult = applyAutoFix(content4, failure);
    if (fixResult.success) {
      console.log(`  ✓ Auto-fix applied successfully`);
    } else {
      console.log(`  ✗ Auto-fix failed: ${fixResult.error}`);
    }
  } else if (failure.strategy === "fuzzy-match" && failure.fuzzyMatches) {
    console.log(`  Suggested alternatives:`);
    for (const match of failure.fuzzyMatches.slice(0, 2)) {
      console.log(`    - "${match.value}"`);
    }
  }
}

// Example 5: Progressive fix application
console.log("\n\n=== Example 5: Progressive Fix Application ===\n");

const content5 = `# Installation

First, install the dependencies:

\`\`\`bash
npm install
\`\`\`

Then configure the application.`;

const patches5: PatchOperation[] = [
  { op: "replace", old: "dependencys", new: "packages" }, // Typo
  { op: "replace", old: "configure", new: "setup" }, // Will succeed
];

console.log("Analyzing failures...");
const failures5 = analyzeFilePatchFailures(content5, patches5);

if (failures5.length > 0) {
  console.log(`\nAttempting to fix ${failures5.length} failed patch(es)...`);

  let currentContent = content5;
  let fixedCount = 0;

  for (const failure of failures5) {
    if (failure.confidence >= 70) {
      const fixResult = applyAutoFix(currentContent, failure, 70);
      if (fixResult.success) {
        currentContent = fixResult.content;
        fixedCount++;
        console.log(`  ✓ Fixed patch #${failure.patchIndex}`);
      } else {
        console.log(`  ✗ Could not fix patch #${failure.patchIndex}: ${fixResult.error}`);
      }
    } else {
      console.log(`  - Skipped patch #${failure.patchIndex} (low confidence: ${failure.confidence}%)`);
    }
  }

  console.log(`\nFixed ${fixedCount} out of ${failures5.length} failures`);
  console.log(`\nFinal content:\n${currentContent}`);
}

console.log("\n=== End of Examples ===\n");
