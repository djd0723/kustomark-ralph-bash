/**
 * Tests for parallel build processing
 *
 * These tests verify that parallel mode:
 * - Produces identical output to sequential mode
 * - Handles concurrent file operations correctly
 * - Respects job limits
 * - Maintains deterministic output
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// We'll test by actually running the CLI since we need to test integration
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", "src/cli/index.ts", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("Parallel Build Tests", () => {
  const fixtureRoot = resolve(__dirname, "../fixtures/parallel");

  // Setup fixture directory structure
  function setupFixture() {
    // Clean up if exists
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }

    mkdirSync(fixtureRoot, { recursive: true });

    // Create multiple markdown files
    const files = [
      { name: "file1.md", content: "# Header 1\n\nContent for file 1.\n" },
      { name: "file2.md", content: "# Header 2\n\nContent for file 2.\n" },
      { name: "file3.md", content: "# Header 3\n\nContent for file 3.\n" },
      { name: "file4.md", content: "# Header 4\n\nContent for file 4.\n" },
      { name: "file5.md", content: "# Header 5\n\nContent for file 5.\n" },
    ];

    for (const file of files) {
      writeFileSync(join(fixtureRoot, file.name), file.content);
    }

    // Create kustomark.yaml with patches
    const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "Content"
    new: "Updated content"
  - op: set-frontmatter
    key: "modified"
    value: true
`;

    writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);
  }

  function cleanupFixture() {
    if (existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }

  test("sequential and parallel builds produce identical output", async () => {
    setupFixture();

    try {
      // Run sequential build
      const seqOutputDir = join(fixtureRoot, "output-seq");
      const configSeq = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output-seq
patches:
  - op: replace
    old: "Content"
    new: "Updated content"
  - op: set-frontmatter
    key: "modified"
    value: true
`;
      writeFileSync(join(fixtureRoot, "kustomark-seq.yaml"), configSeq);

      const seqResult = await runCLI(["build", join(fixtureRoot, "kustomark-seq.yaml")]);
      expect(seqResult.exitCode).toBe(0);

      // Run parallel build
      const parOutputDir = join(fixtureRoot, "output-par");
      const configPar = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output-par
patches:
  - op: replace
    old: "Content"
    new: "Updated content"
  - op: set-frontmatter
    key: "modified"
    value: true
`;
      writeFileSync(join(fixtureRoot, "kustomark-par.yaml"), configPar);

      const parResult = await runCLI([
        "build",
        join(fixtureRoot, "kustomark-par.yaml"),
        "--parallel",
        "--jobs=2",
      ]);
      expect(parResult.exitCode).toBe(0);

      // Compare outputs - should be identical
      const seqFiles = ["file1.md", "file2.md", "file3.md", "file4.md", "file5.md"];

      for (const file of seqFiles) {
        const seqContent = readFileSync(join(seqOutputDir, file), "utf-8");
        const parContent = readFileSync(join(parOutputDir, file), "utf-8");

        expect(parContent).toBe(seqContent);
      }
    } finally {
      cleanupFixture();
    }
  });

  test("parallel mode with --stats shows correct statistics", async () => {
    setupFixture();

    try {
      const result = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=2", "--stats"]);

      expect(result.exitCode).toBe(0);

      // Stats output goes to stdout (console.log)
      const output = result.stdout;
      expect(output).toContain("Build Statistics:");
      expect(output).toContain("Files processed: 5");
      expect(output).toContain("Files written: 5");
      expect(output).toContain("Patches applied:");
      expect(output).toContain("Duration:");
    } finally {
      cleanupFixture();
    }
  });

  test("parallel mode respects job limit", async () => {
    setupFixture();

    try {
      // Run with jobs=1 (should still work, just sequentially within parallel infrastructure)
      const result = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=1"]);

      expect(result.exitCode).toBe(0);

      // Verify output exists
      const outputDir = join(fixtureRoot, "output");
      expect(existsSync(join(outputDir, "file1.md"))).toBe(true);
      expect(existsSync(join(outputDir, "file2.md"))).toBe(true);
    } finally {
      cleanupFixture();
    }
  });

  test("parallel mode produces deterministic operation counts", async () => {
    setupFixture();

    try {
      // Run parallel build twice and compare stats
      const result1 = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=2", "--stats"]);
      expect(result1.exitCode).toBe(0);

      // Clean output and run again
      rmSync(join(fixtureRoot, "output"), { recursive: true, force: true });

      const result2 = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=2", "--stats"]);
      expect(result2.exitCode).toBe(0);

      // Both should report the same statistics (stats go to stdout)
      expect(result1.stdout).toContain("Patches applied:");
      expect(result2.stdout).toContain("Patches applied:");

      // Extract patch counts (they should be identical)
      const extractPatchCount = (stdout: string) => {
        const match = stdout.match(/Patches applied: (\d+)/);
        return match ? Number.parseInt(match[1], 10) : -1;
      };

      const count1 = extractPatchCount(result1.stdout);
      const count2 = extractPatchCount(result2.stdout);

      expect(count1).toBe(count2);
      expect(count1).toBeGreaterThan(0);
    } finally {
      cleanupFixture();
    }
  });

  test("parallel mode handles validation errors correctly", async () => {
    setupFixture();

    try {
      // Create a config with validation that will fail
      const config = `apiVersion: kustomark/v1
kind: Kustomization
resources:
  - "*.md"
output: output
patches:
  - op: replace
    old: "Content"
    new: "BadContent"
    validate:
      notContains: "BadContent"
`;

      writeFileSync(join(fixtureRoot, "kustomark.yaml"), config);

      const result = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=2"]);

      // Should complete but report validation errors
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Validation Errors:");
    } finally {
      cleanupFixture();
    }
  });

  test("parallel mode works with verbose output", async () => {
    setupFixture();

    try {
      const result = await runCLI(["build", fixtureRoot, "--parallel", "--jobs=2", "-vv"]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Processing");
      expect(result.stderr).toContain("parallel jobs");
    } finally {
      cleanupFixture();
    }
  });

  test("parallel mode disabled by default (backward compatibility)", async () => {
    setupFixture();

    try {
      // Run without --parallel flag
      const result = await runCLI(["build", fixtureRoot]);

      expect(result.exitCode).toBe(0);

      // Should not mention parallel processing
      expect(result.stderr).not.toContain("parallel jobs");

      // Output should still be created
      const outputDir = join(fixtureRoot, "output");
      expect(existsSync(join(outputDir, "file1.md"))).toBe(true);
    } finally {
      cleanupFixture();
    }
  });
});
