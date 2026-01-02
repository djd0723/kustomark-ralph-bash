/**
 * Tests for exec patch operation
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { applyExec, applyPatches } from "../../src/core/patch-engine.js";
import type { ExecPatch } from "../../src/core/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Create a temporary directory for test scripts
let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kustomark-exec-test-"));
});

afterAll(() => {
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("applyExec", () => {
  test("executes simple command with stdin/stdout", async () => {
    // Use a simple command that reads stdin and writes to stdout
    const content = "hello world\n";
    const result = await applyExec(content, "cat");

    expect(result.count).toBe(1);
    expect(result.content).toBe(content);
  });

  test("transforms content with tr command", async () => {
    const content = "hello world";
    // Transform to uppercase using tr
    const result = await applyExec(content, "tr a-z A-Z");

    expect(result.count).toBe(1);
    expect(result.content).toBe("HELLO WORLD");
  });

  test("handles multiline content", async () => {
    const content = "line 1\nline 2\nline 3\n";
    const result = await applyExec(content, "cat");

    expect(result.count).toBe(1);
    expect(result.content).toBe(content);
  });

  test("respects timeout for long-running commands", async () => {
    // Use sleep command that will timeout
    const content = "test";
    const result = await applyExec(content, "sleep 10", 100); // 100ms timeout

    // Should fail and return original content
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("handles command failure with non-zero exit code", async () => {
    const content = "test content";
    // Use a command that will fail
    const result = await applyExec(content, "false");

    // Should fail and return original content
    expect(result.count).toBe(0);
    expect(result.content).toBe(content);
  });

  test("executes custom script from file", async () => {
    // Create a simple script that adds a line
    const scriptPath = path.join(tempDir, "add-line.sh");
    const scriptContent = `#!/bin/bash
cat
echo "Added by script"
`;
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, 0o755);

    const content = "Original content\n";
    const result = await applyExec(content, scriptPath);

    expect(result.count).toBe(1);
    expect(result.content).toBe("Original content\nAdded by script\n");
  });

  test("handles empty content", async () => {
    const content = "";
    const result = await applyExec(content, "cat");

    expect(result.count).toBe(1);
    expect(result.content).toBe("");
  });

  test("uses default timeout when not specified", async () => {
    const content = "test";
    // Quick command should complete within default 30s timeout
    const result = await applyExec(content, "echo hello");

    expect(result.count).toBe(1);
    expect(result.content).toContain("hello");
  });
});

describe("exec patch in applyPatches", () => {
  test("applies exec patch in sequence with other patches", async () => {
    const content = "# Header\n\nhello world\n";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "tr a-z A-Z",
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.content).toContain("HELLO WORLD");
  });

  test("exec patch respects onNoMatch setting", async () => {
    const content = "test content";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "false", // This will fail
        onNoMatch: "skip",
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(0);
    expect(result.warnings.length).toBe(0); // skip = no warnings
    expect(result.content).toBe(content); // Original content unchanged
  });

  test("exec patch with custom timeout", async () => {
    const content = "test";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "cat",
        timeout: 5000,
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.content).toBe(content);
  });

  test("exec patch with validation", async () => {
    const content = "hello";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "tr a-z A-Z",
        validate: {
          notContains: "lowercase",
        },
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.validationErrors.length).toBe(0);
    expect(result.content).toBe("HELLO");
  });

  test("exec patch fails validation when forbidden content present", async () => {
    const content = "hello";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "cat", // Just echo back the content
        validate: {
          notContains: "hello", // But content contains "hello"
        },
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.validationErrors.length).toBe(1);
  });

  test("multiple exec patches in sequence", async () => {
    // Create two scripts
    const script1Path = path.join(tempDir, "step1.sh");
    fs.writeFileSync(
      script1Path,
      `#!/bin/bash
cat
echo "Step 1 complete"
`
    );
    fs.chmodSync(script1Path, 0o755);

    const script2Path = path.join(tempDir, "step2.sh");
    fs.writeFileSync(
      script2Path,
      `#!/bin/bash
cat
echo "Step 2 complete"
`
    );
    fs.chmodSync(script2Path, 0o755);

    const content = "Initial content\n";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: script1Path,
      },
      {
        op: "exec",
        command: script2Path,
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(2);
    expect(result.content).toContain("Initial content");
    expect(result.content).toContain("Step 1 complete");
    expect(result.content).toContain("Step 2 complete");
  });

  test("exec patch with conditional execution", async () => {
    const content = "# Header\n\nSome content with special marker\n";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "tr a-z A-Z",
        when: {
          type: "fileContains",
          value: "special marker",
        },
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.content).toContain("SPECIAL MARKER");
  });

  test("exec patch skipped when condition not met", async () => {
    const content = "# Header\n\nSome content\n";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "tr a-z A-Z",
        when: {
          type: "fileContains",
          value: "nonexistent",
        },
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(0);
    expect(result.conditionSkipped).toBe(1);
    expect(result.content).toBe(content); // Original unchanged
  });
});

describe("exec patch security and determinism", () => {
  test("command timeout prevents infinite loops", async () => {
    const content = "test";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "sleep 100",
        timeout: 100,
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(0);
    expect(result.content).toBe(content);
  });

  test("deterministic transformation produces same output", async () => {
    const content = "hello world";
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "tr a-z A-Z",
      },
    ];

    const result1 = await applyPatches(content, patches);
    const result2 = await applyPatches(content, patches);

    expect(result1.content).toBe(result2.content);
    expect(result1.content).toBe("HELLO WORLD");
  });

  test("handles large content efficiently", async () => {
    // Generate large content (1MB)
    const content = "a".repeat(1024 * 1024);
    const patches: ExecPatch[] = [
      {
        op: "exec",
        command: "cat",
      },
    ];

    const result = await applyPatches(content, patches);

    expect(result.applied).toBe(1);
    expect(result.content.length).toBe(content.length);
  });
});

describe("exec patch with markdown transformations", () => {
  test("generates table of contents", async () => {
    // Create a script that generates a simple TOC
    const tocScript = path.join(tempDir, "gen-toc.sh");
    const scriptContent = `#!/bin/bash
# Read input and generate a simple TOC
cat
echo ""
echo "## Table of Contents"
grep "^#" /dev/stdin 2>/dev/null | sed 's/^# /- /' || true
`;
    fs.writeFileSync(tocScript, scriptContent);
    fs.chmodSync(tocScript, 0o755);

    const content = `# Introduction

Welcome to the guide.

# Installation

Install steps here.

# Usage

How to use.
`;

    const result = await applyExec(content, tocScript);

    // The script should have added TOC
    expect(result.count).toBe(1);
    expect(result.content).toContain("Table of Contents");
  });

  test("adds frontmatter via script", async () => {
    const addFrontmatterScript = path.join(tempDir, "add-frontmatter.sh");
    const scriptContent = `#!/bin/bash
echo "---"
echo "generated: true"
echo "timestamp: $(date +%Y-%m-%d)"
echo "---"
echo ""
cat
`;
    fs.writeFileSync(addFrontmatterScript, scriptContent);
    fs.chmodSync(addFrontmatterScript, 0o755);

    const content = "# My Document\n\nContent here.";
    const result = await applyExec(content, addFrontmatterScript);

    expect(result.count).toBe(1);
    expect(result.content).toContain("---");
    expect(result.content).toContain("generated: true");
    expect(result.content).toContain("# My Document");
  });
});
