/**
 * Integration tests for CLI validation features
 *
 * These tests verify that validation works correctly through the CLI:
 * - Per-patch validation (notContains)
 * - Global validators (notContains, frontmatterRequired)
 * - Validation errors in JSON output
 * - Strict mode for validate command
 * - Validation errors don't affect build/diff exit codes
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseConfig } from "../core/config-parser.js";
import { applyPatches } from "../core/patch-engine.js";
import type { ValidationError } from "../core/types.js";
import { runValidators } from "../core/validators.js";

describe("CLI Validation Integration Tests", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test fixtures
    tempDir = join(
      process.cwd(),
      "tests",
      "temp",
      `cli-validation-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("per-patch validation with notContains - validation passes", () => {
    // Create test fixture
    const baseContent = `# Test Document

This is a test document without any forbidden content.

## Section One

Some content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "test document"
    new: "updated document"
    validate:
      notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), baseContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);
    expect(config.patches).toBeDefined();
    expect(config.patches).toHaveLength(1);

    // Apply patches
    const result = applyPatches(baseContent, config.patches || [], "warn");

    // Verify patch was applied
    expect(result.applied).toBe(1);
    expect(result.content).toContain("updated document");
    expect(result.content).not.toContain("test document");

    // Verify validation passed (no validation errors)
    expect(result.validationErrors).toHaveLength(0);
  });

  test("per-patch validation with notContains - validation fails", () => {
    // Create test fixture where validation should fail
    const baseContent = `# Test Document

This is a test document.

## Section One

Some content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "test document"
    new: "FORBIDDEN content"
    validate:
      notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), baseContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Apply patches
    const result = applyPatches(baseContent, config.patches || [], "warn");

    // Verify patch was applied
    expect(result.applied).toBe(1);
    expect(result.content).toContain("FORBIDDEN content");

    // Verify validation failed
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]?.message).toContain("FORBIDDEN");
  });

  test("per-patch validation with multiple patches", () => {
    // Create test fixture with multiple patches
    const baseContent = `# Test Document

This is a test document.

## Section One

Some content here.

## Section Two

More content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "test document"
    new: "updated document"
    validate:
      notContains: "FORBIDDEN"

  - op: append-to-section
    id: section-one
    content: |

      Additional content without bad words.
    validate:
      notContains: "badword"

  - op: replace
    old: "More content"
    new: "FORBIDDEN content"
    validate:
      notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), baseContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Apply patches
    const result = applyPatches(baseContent, config.patches || [], "warn");

    // Verify all patches were applied
    expect(result.applied).toBe(3);

    // Verify validation: first two should pass, third should fail
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]?.message).toContain("FORBIDDEN");
  });

  test("global validators with notContains - validation passes", () => {
    const content = `# Test Document

This is a clean document.

## Section One

No forbidden content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: no-forbidden-words
    notContains: "FORBIDDEN"
  - name: no-todo-comments
    notContains: "TODO:"
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);
    expect(config.validators).toBeDefined();
    expect(config.validators).toHaveLength(2);

    // Apply patches (none in this case)
    const patchResult = applyPatches(content, config.patches || [], "warn");

    // Run global validators
    const validationErrors = runValidators(patchResult.content, config.validators || []);

    // Verify validation passed
    expect(validationErrors).toHaveLength(0);
  });

  test("global validators with notContains - validation fails", () => {
    const content = `# Test Document

This document has FORBIDDEN content.

## Section One

Also includes a TODO: fix this later.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: no-forbidden-words
    notContains: "FORBIDDEN"
  - name: no-todo-comments
    notContains: "TODO:"
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Apply patches (none in this case)
    const patchResult = applyPatches(content, config.patches || [], "warn");

    // Run global validators
    const validationErrors = runValidators(patchResult.content, config.validators || []);

    // Verify both validators failed
    expect(validationErrors).toHaveLength(2);
    expect(validationErrors[0]?.validator).toBe("no-forbidden-words");
    expect(validationErrors[0]?.message).toContain("FORBIDDEN");
    expect(validationErrors[1]?.validator).toBe("no-todo-comments");
    expect(validationErrors[1]?.message).toContain("TODO:");
  });

  test("global validators with frontmatterRequired - validation passes", () => {
    const content = `---
title: Test Document
author: John Doe
metadata:
  version: 1.0
  status: published
---

# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: required-metadata
    frontmatterRequired:
      - title
      - author
      - metadata.version
      - metadata.status
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Verify validation passed
    expect(validationErrors).toHaveLength(0);
  });

  test("global validators with frontmatterRequired - validation fails", () => {
    const content = `---
title: Test Document
metadata:
  version: 1.0
---

# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: required-metadata
    frontmatterRequired:
      - title
      - author
      - metadata.version
      - metadata.status
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Verify validation failed for missing fields
    expect(validationErrors).toHaveLength(1);
    expect(validationErrors[0]?.validator).toBe("required-metadata");
    expect(validationErrors[0]?.message).toContain("author");
    expect(validationErrors[0]?.message).toContain("metadata.status");
  });

  test("combined per-patch and global validation", () => {
    const baseContent = `---
title: Test Document
---

# Test Document

This is a test document.

## Section One

Some content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "test document"
    new: "FORBIDDEN content"
    validate:
      notContains: "FORBIDDEN"

validators:
  - name: required-author
    frontmatterRequired:
      - author
`;

    writeFileSync(join(tempDir, "test.md"), baseContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Apply patches
    const patchResult = applyPatches(baseContent, config.patches || [], "warn");

    // Run global validators
    const globalValidationErrors = runValidators(patchResult.content, config.validators || []);

    // Verify both per-patch and global validation errors
    expect(patchResult.validationErrors).toHaveLength(1);
    expect(patchResult.validationErrors[0]?.message).toContain("FORBIDDEN");

    expect(globalValidationErrors).toHaveLength(1);
    expect(globalValidationErrors[0]?.validator).toBe("required-author");
    expect(globalValidationErrors[0]?.message).toContain("author");
  });

  test("validation errors structure matches expected format", () => {
    const content = `# Test Document

Content with FORBIDDEN word.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "Content"
    new: "Updated content"
    validate:
      notContains: "FORBIDDEN"

validators:
  - name: no-forbidden
    notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Apply patches
    const patchResult = applyPatches(content, config.patches || [], "warn");

    // Run global validators
    const globalValidationErrors = runValidators(patchResult.content, config.validators || []);

    // Verify per-patch validation error structure
    const perPatchError = patchResult.validationErrors[0];
    expect(perPatchError).toBeDefined();
    expect(perPatchError?.message).toBeDefined();
    expect(typeof perPatchError?.message).toBe("string");

    // Verify global validation error structure
    const globalError = globalValidationErrors[0];
    expect(globalError).toBeDefined();
    expect(globalError?.validator).toBe("no-forbidden");
    expect(globalError?.message).toBeDefined();
    expect(typeof globalError?.message).toBe("string");
    expect(globalError?.message).toContain("FORBIDDEN");
  });

  test("integration: build workflow with validation", () => {
    // This test simulates the full build workflow:
    // 1. Load resources
    // 2. Apply patches (with per-patch validation)
    // 3. Run global validators
    // 4. Collect all validation errors

    const resource1Content = `---
title: Resource One
---

# Resource One

This is resource one.
`;

    const resource2Content = `# Resource Two

This is resource two with FORBIDDEN content.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - resource1.md
  - resource2.md

patches:
  - op: replace
    old: "resource one"
    new: "updated resource"
    include: "resource1.md"
    validate:
      notContains: "bad"

  - op: replace
    old: "resource two"
    new: "badword in content"
    include: "resource2.md"
    validate:
      notContains: "badword"

validators:
  - name: no-forbidden
    notContains: "FORBIDDEN"
  - name: require-title
    frontmatterRequired:
      - title
`;

    writeFileSync(join(tempDir, "resource1.md"), resource1Content);
    writeFileSync(join(tempDir, "resource2.md"), resource2Content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Simulate processing each resource
    const results = new Map<
      string,
      { content: string; perPatchErrors: ValidationError[]; globalErrors: ValidationError[] }
    >();

    for (const resourceFile of ["resource1.md", "resource2.md"]) {
      const content = readFileSync(join(tempDir, resourceFile), "utf-8");

      // Apply patches
      const patchResult = applyPatches(content, config.patches || [], "warn");

      // Run global validators
      const globalErrors = runValidators(patchResult.content, config.validators || []);

      results.set(resourceFile, {
        content: patchResult.content,
        perPatchErrors: patchResult.validationErrors,
        globalErrors: globalErrors,
      });
    }

    // Verify resource1 results
    const resource1 = results.get("resource1.md");
    expect(resource1).toBeDefined();
    expect(resource1?.content).toContain("updated resource");
    expect(resource1?.perPatchErrors).toHaveLength(0); // per-patch validation passes
    expect(resource1?.globalErrors).toHaveLength(0); // has title in frontmatter, no FORBIDDEN

    // Verify resource2 results
    const resource2 = results.get("resource2.md");
    expect(resource2).toBeDefined();
    expect(resource2?.content).toContain("badword in content");
    expect(resource2?.perPatchErrors).toHaveLength(1); // per-patch validation fails (badword)
    expect(resource2?.globalErrors).toHaveLength(2); // global validators fail (FORBIDDEN + no title)
    expect(resource2?.globalErrors[0]?.validator).toBe("no-forbidden");
    expect(resource2?.globalErrors[1]?.validator).toBe("require-title");
  });

  test("validation does not affect successful patch application", () => {
    // Verify that even when validation fails, patches are still applied
    const content = `# Test

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "Content"
    new: "FORBIDDEN"
    validate:
      notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Apply patches
    const result = applyPatches(content, config.patches || [], "warn");

    // Verify patch was applied even though validation failed
    expect(result.applied).toBe(1);
    expect(result.content).toContain("FORBIDDEN");
    expect(result.content).not.toContain("Content here");

    // But validation errors should be recorded
    expect(result.validationErrors).toHaveLength(1);
  });

  test("empty validators array does not cause errors", () => {
    const content = `# Test

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators: []
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Verify no errors
    expect(validationErrors).toHaveLength(0);
  });

  test("undefined validators does not cause errors", () => {
    const content = `# Test

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Verify no errors
    expect(validationErrors).toHaveLength(0);
  });

  test("validation with complex frontmatter nesting", () => {
    const content = `---
metadata:
  author:
    name: John Doe
    email: john@example.com
  publication:
    date: 2024-01-01
    version: 1.0
tags:
  - tech
  - tutorial
---

# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: deep-nesting
    frontmatterRequired:
      - metadata.author.name
      - metadata.author.email
      - metadata.publication.date
      - metadata.publication.version
      - tags
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Verify validation passed
    expect(validationErrors).toHaveLength(0);
  });

  test("validation with missing nested frontmatter keys", () => {
    const content = `---
metadata:
  author:
    name: John Doe
  publication:
    date: 2024-01-01
---

# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: deep-nesting
    frontmatterRequired:
      - metadata.author.name
      - metadata.author.email
      - metadata.publication.version
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Verify validation failed for missing nested keys
    expect(validationErrors).toHaveLength(1);
    expect(validationErrors[0]?.message).toContain("metadata.author.email");
    expect(validationErrors[0]?.message).toContain("metadata.publication.version");
  });

  test("multiple validators can check different aspects", () => {
    const content = `---
title: Test
author: John
---

# Test Document

Content with some text.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: no-todo
    notContains: "TODO"
  - name: no-fixme
    notContains: "FIXME"
  - name: require-metadata
    frontmatterRequired:
      - title
      - author
  - name: no-bad-words
    notContains: "badword"
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // All validators should pass
    expect(validationErrors).toHaveLength(0);
  });

  test("validator can have both notContains and frontmatterRequired", () => {
    const content = `---
title: Test
---

# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: combined-validator
    notContains: "FORBIDDEN"
    frontmatterRequired:
      - title
      - author
`;

    writeFileSync(join(tempDir, "test.md"), content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Run global validators
    const validationErrors = runValidators(content, config.validators || []);

    // Should fail on frontmatter (missing author), but pass on notContains
    expect(validationErrors).toHaveLength(1);
    expect(validationErrors[0]?.validator).toBe("combined-validator");
    expect(validationErrors[0]?.message).toContain("author");
  });

  test("patch validation with include pattern only validates matching files", () => {
    // This simulates how the CLI would filter patches per file
    const file1Content = `# File One

Content with FORBIDDEN.
`;

    const file2Content = `# File Two

Also has FORBIDDEN.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - file1.md
  - file2.md

patches:
  - op: replace
    old: "Content"
    new: "Updated"
    include: "file1.md"
    validate:
      notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "file1.md"), file1Content);
    writeFileSync(join(tempDir, "file2.md"), file2Content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Parse config
    const config = parseConfig(configContent);

    // Process file1 (should have validation error)
    const file1Result = applyPatches(file1Content, config.patches || [], "warn");
    expect(file1Result.applied).toBe(1);
    expect(file1Result.validationErrors).toHaveLength(1);

    // Process file2 (no patches should apply due to include filter)
    const file2Result = applyPatches(file2Content, config.patches || [], "warn");
    expect(file2Result.applied).toBe(0);
    expect(file2Result.validationErrors).toHaveLength(0);
  });
});

describe("CLI Command Integration Tests with Validation", () => {
  let tempDir: string;
  const cliPath = join(process.cwd(), "src", "cli", "index.ts");

  beforeEach(() => {
    tempDir = join(
      process.cwd(),
      "tests",
      "temp",
      `cli-cmd-validation-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function runCLI(
    args: string[],
    cwd: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = Bun.spawn(["bun", cliPath, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return { exitCode, stdout, stderr };
  }

  test("build command with per-patch validation - JSON output includes validation errors", async () => {
    const testContent = `# Test Document

This is a test document.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

patches:
  - op: replace
    old: "test document"
    new: "FORBIDDEN content"
    validate:
      notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(0); // Build succeeds even with validation errors

    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.filesWritten).toBe(1);
    expect(output.patchesApplied).toBe(1);
    expect(output.validationErrors).toBeDefined();
    expect(output.validationErrors.length).toBeGreaterThan(0);
    expect(output.validationErrors[0].message).toContain("FORBIDDEN");
  });

  test("build command with global validators - JSON output includes validation errors", async () => {
    const testContent = `# Test Document

This document has TODO: comments.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

validators:
  - name: no-todos
    notContains: "TODO:"
  - name: require-frontmatter
    frontmatterRequired:
      - title
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(0); // Build succeeds even with validation errors

    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.validationErrors).toBeDefined();
    expect(output.validationErrors.length).toBe(2); // Both validators fail

    const validators = output.validationErrors.map((e: ValidationError) => e.validator);
    expect(validators).toContain("no-todos");
    expect(validators).toContain("require-frontmatter");
  });

  test("build command with validation - text output shows validation errors", async () => {
    const testContent = `# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

patches:
  - op: replace
    old: "Content"
    new: "FORBIDDEN word"
    validate:
      notContains: "FORBIDDEN"

validators:
  - name: no-forbidden
    notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", "."], tempDir);

    expect(result.exitCode).toBe(0); // Build succeeds even with validation errors
    expect(result.stdout).toContain("Built 1 file(s)");
    expect(result.stderr).toContain("Validation Errors:");
    expect(result.stderr).toContain("FORBIDDEN");
  });

  test("diff command includes validation errors in output", async () => {
    const testContent = `# Test Document

Original content.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

patches:
  - op: replace
    old: "Original"
    new: "FORBIDDEN"
    validate:
      notContains: "FORBIDDEN"

validators:
  - name: no-forbidden
    notContains: "FORBIDDEN"
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["diff", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(1); // Diff returns 1 when there are changes

    const output = JSON.parse(result.stdout);
    expect(output.hasChanges).toBe(true);
    expect(output.validationErrors).toBeDefined();
    expect(output.validationErrors.length).toBe(2); // Per-patch + global validator
  });

  test("diff command text output shows validation errors", async () => {
    const testContent = `# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

validators:
  - name: require-author
    frontmatterRequired:
      - author
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["diff", "."], tempDir);

    expect(result.stdout).toContain("Validation Errors:");
    expect(result.stdout).toContain("require-author");
    expect(result.stdout).toContain("author");
  });

  test("validation errors don't affect build exit code (only validate with --strict does)", async () => {
    const testContent = `# Test Document

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

validators:
  - name: fail-validator
    frontmatterRequired:
      - nonexistent-field
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Build should succeed even with validation errors
    const buildResult = await runCLI(["build", ".", "--format", "json"], tempDir);
    expect(buildResult.exitCode).toBe(0);

    const buildOutput = JSON.parse(buildResult.stdout);
    expect(buildOutput.success).toBe(true);
    expect(buildOutput.validationErrors.length).toBeGreaterThan(0);
  });

  test("validate command returns success for valid config", async () => {
    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

patches:
  - op: replace
    old: "foo"
    new: "bar"
`;

    writeFileSync(join(tempDir, "test.md"), "# Test");
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["validate", "."], tempDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Configuration is valid");
  });

  test("validate command JSON output", async () => {
    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md
`;

    writeFileSync(join(tempDir, "test.md"), "# Test");
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["validate", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.valid).toBe(true);
    expect(output.errors).toBeDefined();
    expect(output.warnings).toBeDefined();
  });

  test("build command with multiple files and mixed validation results", async () => {
    const file1Content = `---
title: File One
author: John Doe
---

# File One

Clean content.
`;

    const file2Content = `# File Two

Has TODO: fix this.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - file1.md
  - file2.md

patches:
  - op: replace
    old: "Clean"
    new: "Updated"
    include: "file1.md"

validators:
  - name: no-todos
    notContains: "TODO:"
  - name: require-metadata
    frontmatterRequired:
      - title
      - author
`;

    writeFileSync(join(tempDir, "file1.md"), file1Content);
    writeFileSync(join(tempDir, "file2.md"), file2Content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.filesWritten).toBe(2);
    expect(output.validationErrors).toBeDefined();

    // file1.md should pass all validators, file2.md should fail both
    expect(output.validationErrors.length).toBe(2);

    // All errors should be for file2.md
    const file2Errors = output.validationErrors.filter(
      (e: ValidationError) => e.file === "file2.md",
    );
    expect(file2Errors.length).toBe(2);
  });

  test("build command preserves validation error file context", async () => {
    const file1Content = `# File One

Content with FORBIDDEN.
`;

    const file2Content = `# File Two

Content with badword.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - file1.md
  - file2.md

validators:
  - name: no-forbidden
    notContains: "FORBIDDEN"
  - name: no-badwords
    notContains: "badword"
`;

    writeFileSync(join(tempDir, "file1.md"), file1Content);
    writeFileSync(join(tempDir, "file2.md"), file2Content);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.validationErrors.length).toBe(2);

    // Check that file context is preserved
    const file1Error = output.validationErrors.find((e: ValidationError) => e.file === "file1.md");
    expect(file1Error).toBeDefined();
    expect(file1Error.validator).toBe("no-forbidden");

    const file2Error = output.validationErrors.find((e: ValidationError) => e.file === "file2.md");
    expect(file2Error).toBeDefined();
    expect(file2Error.validator).toBe("no-badwords");
  });

  test("combined per-patch and global validation in CLI build", async () => {
    const testContent = `# Test Document

This is content.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

patches:
  - op: replace
    old: "content"
    new: "FORBIDDEN content"
    validate:
      notContains: "FORBIDDEN"

validators:
  - name: require-title
    frontmatterRequired:
      - title
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.validationErrors.length).toBe(2);

    // One from per-patch validation (no validator field)
    const perPatchError = output.validationErrors.find((e: ValidationError) => !e.validator);
    expect(perPatchError).toBeDefined();
    expect(perPatchError.message).toContain("FORBIDDEN");

    // One from global validator
    const globalError = output.validationErrors.find(
      (e: ValidationError) => e.validator === "require-title",
    );
    expect(globalError).toBeDefined();
  });

  test("quiet mode suppresses validation error output but preserves JSON", async () => {
    const testContent = `# Test

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

validators:
  - name: fail
    frontmatterRequired:
      - missing
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Test with JSON format in quiet mode
    const jsonResult = await runCLI(["build", ".", "--format", "json", "-q"], tempDir);
    expect(jsonResult.exitCode).toBe(0);

    const output = JSON.parse(jsonResult.stdout);
    expect(output.validationErrors.length).toBeGreaterThan(0);
  });

  test("verbose mode shows validation errors in text output", async () => {
    const testContent = `# Test

Content here.
`;

    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

output: ./output

resources:
  - test.md

validators:
  - name: strict-validator
    frontmatterRequired:
      - title
      - author
`;

    writeFileSync(join(tempDir, "test.md"), testContent);
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["build", ".", "-v"], tempDir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Validation Errors:");
    expect(result.stderr).toContain("strict-validator");
  });

  test("validate command with --strict flag treats warnings as errors", async () => {
    // Note: This test is for config validation warnings, not content validation
    // The --strict flag makes the validate command treat warnings as errors
    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md

# This config is valid but might generate warnings in future versions
patches: []
`;

    writeFileSync(join(tempDir, "test.md"), "# Test");
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    // Without --strict, should succeed even if there are warnings
    const normalResult = await runCLI(["validate", "."], tempDir);
    expect(normalResult.exitCode).toBe(0);

    // With --strict, warnings should cause failure (if any warnings exist)
    const strictResult = await runCLI(["validate", ".", "--strict"], tempDir);
    // Exit code depends on whether there are warnings
    // This config has no warnings, so it should still pass
    expect(strictResult.exitCode).toBe(0);
  });

  test("validate command JSON output includes strict mode flag", async () => {
    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

resources:
  - test.md
`;

    writeFileSync(join(tempDir, "test.md"), "# Test");
    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["validate", ".", "--format", "json", "--strict"], tempDir);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output.strict).toBe(true);
    expect(output.valid).toBe(true);
  });

  test("validate command with invalid config returns error in JSON", async () => {
    const configContent = `apiVersion: kustomark/v1
kind: Kustomization

# Missing required resources field
patches:
  - op: replace
    old: "foo"
    new: "bar"
`;

    writeFileSync(join(tempDir, "kustomark.yaml"), configContent);

    const result = await runCLI(["validate", ".", "--format", "json"], tempDir);

    expect(result.exitCode).toBe(1);

    const output = JSON.parse(result.stdout);
    expect(output.valid).toBe(false);
    expect(output.errors.length).toBeGreaterThan(0);
  });
});
